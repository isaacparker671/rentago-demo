"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp } from "../../lib/authClient";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await signUp(email.trim(), password);

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setMsg("Account created. Now log in.");
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use email + password to join Rentago.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
            placeholder="Password (min 6 chars)"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Creating..." : "Sign up"}
          </button>
        </form>

        {msg ? <p className="mt-3 text-sm text-slate-700">{msg}</p> : null}

        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="font-semibold text-sky-600" href="/login">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
