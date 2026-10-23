"use client";

import { useState } from "react";
import { BrandLogo } from "./brand-mark";

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        mode === "sign-in" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "sign-in"
              ? { email, password }
              : { name, email, password },
          ),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not sign in.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <BrandLogo className="h-6 w-auto" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your name and email are saved to your account and used in the chat.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-3">
          {mode === "create" && (
            <label className="block text-xs text-muted">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
          )}
          <label className="block text-xs text-muted">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="block text-xs text-muted">
            Password
            <span className="relative mt-1 block">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                minLength={8}
                required
                className="w-full rounded-xl border border-border bg-surface py-2 pl-3 pr-16 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-2 text-xs font-medium text-muted hover:text-foreground"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-accent">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:bg-border disabled:text-muted"
          >
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 text-xs text-muted hover:text-foreground"
          onClick={() => {
            setMode(mode === "sign-in" ? "create" : "sign-in");
            setError(null);
          }}
        >
          {mode === "sign-in"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
