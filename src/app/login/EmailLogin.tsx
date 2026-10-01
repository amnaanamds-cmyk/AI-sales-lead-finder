"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Passwordless sign-in by email link, for people without (or not wanting to use) a Google account. */
export function EmailLogin({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (next) redirectTo.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo.toString() },
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        Check <strong>{email}</strong> for a sign-in link. It can take a minute; look in Spam too.
      </p>
    );
  }
  return (
    <form onSubmit={send} className="space-y-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2.5 dark:border-zinc-700"
      />
      <button
        disabled={state === "sending"}
        className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" && <p className="text-sm text-red-600">Couldn&apos;t send the link. Check the address and try again.</p>}
    </form>
  );
}
