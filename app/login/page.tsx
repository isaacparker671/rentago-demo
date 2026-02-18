"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "../../lib/authClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await signIn(email.trim(), password);

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    router.push("/profile");
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-24 pt-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Log in</h1>
        <p className="mt-2 text-sm text-slate-600">Welcome back.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black placeholder: text-slate-900 placeholder:text-slate-400"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black placeholder: text-slate-900 placeholder:text-slate-400"
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {msg ? <p className="mt-3 text-sm text-rose-600">{msg}</p> : null}

        <p className="mt-4 text-sm text-slate-600">
          New here?{" "}
          <Link className="font-semibold text-sky-600" href="/signup">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
