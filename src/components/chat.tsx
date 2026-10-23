"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Stage } from "@/session/types";
import { logDev } from "@/lib/dev-log";
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
  hasPhone: boolean;
  hasEmail: boolean;
  bookingId: string | null;
  dealId: string | null;
};

const SUGGESTIONS = [
  "XUV700 ex-showroom price?",
  "My deal — phone +919800000002",
  "Booking MAH-9921 status",
  "Service for MH04 AB 1234",
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

  async function onResetSession() {
    const ok = window.confirm(
      "Reset session? This clears stage, saved name/phone/email, and CRM ids in this browser.",
    );
    if (!ok) return;
    await resetSession();
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
    <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">
            Vehicle Assistant
          </h1>
          <p className="text-xs text-muted">Stage: {stage}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void onNewChat()}
            disabled={busy}
            className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={() => void onResetSession()}
            disabled={busy}
            className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            Reset session
          </button>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-8">
            <p className="text-sm text-muted">
              Ask about a model, your deal, a booking, or service.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(s)}
                  className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-foreground hover:bg-background disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const raw = textFromMessage(m);
          if (!raw) return null;
          const { clean } = parseCollectMarker(raw);
          if (!clean) return null;
          const mine = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? "bg-foreground text-white"
                    : "bg-background text-foreground"
                }`}
              >
                <MarkdownText text={clean} />
              </div>
            </div>
          );
        })}

        {busy && (
          <div className="flex justify-start" aria-live="polite" aria-label="Assistant is typing">
            <div className="rounded-2xl bg-background px-3.5 py-3">
              <div className="typing-dots flex items-center gap-1">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        {error && !busy && (
          <div
            role="alert"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
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

      <div className="border-t border-border px-4 py-3">
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

        <form onSubmit={(e) => void onSubmit(e)} className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={2}
            placeholder="Type a message…"
            className="flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/30"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="self-end rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
