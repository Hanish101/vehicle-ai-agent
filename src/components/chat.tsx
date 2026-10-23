"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Stage } from "@/session/types";
import { logDev } from "@/lib/dev-log";
import { BrandLogo } from "./brand-mark";
import { MarkdownText } from "./markdown-text";
import {
  filterMissingFields,
  parseCollectMarker,
  SlotForm,
  type CollectRequest,
} from "./slot-form";

type SessionInfo = {
  stage: Stage;
  vehicle: string | null;
  city: string | null;
  name: string | null;
  demoDate: string | null;
  demoTime: string | null;
  hasPhone: boolean;
  hasEmail: boolean;
  bookingId: string | null;
  dealId: string | null;
};

const SUGGESTIONS = [
  { title: "Discover", text: "XUV 3XO specs and price?" },
  { title: "Your deal", text: "My deal — phone +919800000002" },
  { title: "Booking", text: "Booking MAH-9921 status" },
  { title: "Service", text: "Service for MH04 AB 1234" },
];

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function stageFromMessages(messages: UIMessage[], fallback: Stage): Stage {
  for (let i = messages.length - 1; i >= 0; i--) {
    const meta = messages[i].metadata as { stage?: Stage } | undefined;
    if (meta?.stage) return meta.stage;
  }
  return fallback;
}

export function Chat() {
  const [input, setInput] = useState("");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [dismissedCollect, setDismissedCollect] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );

  const { messages, sendMessage, status, error, setMessages, clearError } =
    useChat({
      transport,
      onError: (err) => {
        logDev("Chat request failed (dev build — hidden from UI)", err);
      },
    });

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session");
      const data = await res.json();
      if (res.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!res.ok) {
        logDev("Session load failed (dev build — hidden from UI)", data);
        return;
      }
      setSessionInfo(data as SessionInfo);
    } catch (err) {
      logDev("Session network error (dev build — hidden from UI)", err);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (status === "ready") {
      void refreshSession();
    }
  }, [status, refreshSession]);

  useEffect(() => {
    if (error) {
      logDev("Chat error (details for console only)", error);
    }
  }, [error]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const stage = stageFromMessages(messages, sessionInfo?.stage ?? "Discover");
  const busy = status === "submitted" || status === "streaming";

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const parsed = lastAssistant
    ? parseCollectMarker(textFromMessage(lastAssistant))
    : { clean: "", request: null as CollectRequest | null };

  const known = {
    name: sessionInfo?.name,
    city: sessionInfo?.city,
    hasPhone: sessionInfo?.hasPhone,
    hasEmail: sessionInfo?.hasEmail,
    bookingId: sessionInfo?.bookingId,
    dealId: sessionInfo?.dealId,
  };

  const visibleRequest =
    parsed.request &&
    lastAssistant &&
    dismissedCollect !== lastAssistant.id &&
    !busy &&
    filterMissingFields(parsed.request.fields, known).length > 0
      ? {
          ...parsed.request,
          fields: filterMissingFields(parsed.request.fields, known),
        }
      : null;

  async function clearLocalChat() {
    clearError();
    setMessages([]);
    setInput("");
    setDismissedCollect(null);
  }

  /** Wipe signed cookie slots (stage, phone, CRM ids) and clear the thread. */
  async function resetSession() {
    await clearLocalChat();
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      await refreshSession();
    } catch (err) {
      logDev("Session reset failed (dev build — hidden from UI)", err);
    }
  }

  async function onNewChat() {
    await resetSession();
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      logDev("Sign out failed (dev build — hidden from UI)", err);
    }
    window.location.assign("/login");
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    clearError();
    setDismissedCollect(null);
    try {
      await sendMessage({ text: trimmed });
    } catch (err) {
      logDev("sendMessage threw (dev build — hidden from UI)", err);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input;
    setInput("");
    await send(text);
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && input.trim()) {
        const text = input;
        setInput("");
        void send(text);
      }
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="accent-bar h-1 bg-accent" aria-hidden="true" />
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <h1 className="min-w-0 leading-none">
            <BrandLogo className="h-6 w-auto" />
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            {sessionInfo?.name && (
              <span className="max-w-[10rem] truncate text-xs text-muted">
                {sessionInfo.name}
              </span>
            )}
            <button
              type="button"
              onClick={() => void onNewChat()}
              disabled={busy}
              className="hover-lift rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-xs text-muted hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col p-3 sm:p-4">
        <section
          aria-label="Vehicle assistant"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">Vehicle assistant</p>
              {(sessionInfo?.demoDate || sessionInfo?.demoTime) && (
                <p className="truncate text-xs text-muted">
                  Demo
                  {sessionInfo.demoDate ? ` ${sessionInfo.demoDate}` : ""}
                  {sessionInfo.demoTime ? ` · ${sessionInfo.demoTime}` : ""}
                </p>
              )}
            </div>
            <span
              key={stage}
              className="enter-message shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent"
            >
              {stage}
            </span>
          </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div className="enter-up flex min-h-full flex-col justify-center pb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              How can we help?
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              Ask about a model, your deal, a booking, or a service visit.
            </p>
            <div className="stagger mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(s.text)}
                  className="hover-lift rounded-xl border border-border bg-surface px-3.5 py-3 text-left hover:border-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {s.title}
                  </span>
                  <span className="mt-1 block text-sm text-foreground">
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
        {messages.map((m) => {
          const raw = textFromMessage(m);
          if (!raw) return null;
          const { clean } = parseCollectMarker(raw);
          if (!clean) return null;
          const mine = m.role === "user";
          return (
            <div
              key={m.id}
              className={`enter-message flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                  mine
                    ? "rounded-2xl rounded-br-md bg-accent text-white"
                    : "rounded-2xl rounded-bl-md border border-border bg-background text-foreground"
                }`}
              >
                <MarkdownText text={clean} />
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="enter-message flex justify-start" aria-live="polite" aria-label="Assistant is typing">
            <div className="rounded-2xl bg-background px-3.5 py-3">
              <div className="typing-dots flex items-center gap-1">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        </div>

        {error && !busy && (
          <div
            role="alert"
            className="enter-message rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <p>We ran into a problem. Please try again.</p>
            <button
              type="button"
              className="mt-1 text-xs text-muted underline-offset-2 hover:underline"
              onClick={() => clearError()}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-surface px-5 py-4">
        {visibleRequest && lastAssistant && (
          <SlotForm
            request={visibleRequest}
            known={known}
            busy={busy}
            onDismiss={() => setDismissedCollect(lastAssistant.id)}
            onSubmit={(text) => {
              setDismissedCollect(lastAssistant.id);
              void send(text);
            }}
          />
        )}

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2 transition-[border-color,box-shadow] duration-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={1}
            placeholder="Type a message"
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.98] disabled:bg-border disabled:text-muted disabled:active:scale-100"
          >
            Send
          </button>
        </form>
      </div>
        </section>
      </div>
    </div>
  );
}
