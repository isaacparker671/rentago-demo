"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "../../lib/authClient";
import { supabase } from "../../lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [zip, setZip] = useState("");
  const [county, setCounty] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const zipClean = zip.replace(/\D/g, "").slice(0, 5);
    const countyClean = county.trim();
    if (zipClean.length !== 5) {
      setMsg("ZIP must be 5 digits.");
      setLoading(false);
      return;
    }
    if (!countyClean) {
      setMsg("County is required.");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setMsg("Passwords do not match.");
      setLoading(false);
      return;
    }

    const { data, error } = await signUp(email.trim(), password, {
      zip: zipClean,
      county: countyClean,
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    // Best effort: ensure profile has location fields for browse defaults.
    const createdUserId = data?.user?.id;
    if (createdUserId) {
      await supabase
        .from("profiles")
        .upsert(
          { id: createdUserId, zip: zipClean, county: countyClean, updated_at: new Date().toISOString() },
          { onConflict: "id" }
        );
    }

    // Auto sign in immediately after successful sign up.
    const login = await signIn(email.trim(), password);
    if (login.error) {
      setMsg("Account created, but auto sign-in failed. Please log in.");
      setLoading(false);
      return;
    }

    router.push("/profile");
    router.refresh();
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
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black placeholder: text-slate-900 placeholder:text-slate-400"
            placeholder="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="relative">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-3 pr-10 text-sm outline-none focus:border-sky-400 text-black placeholder: text-slate-900 placeholder:text-slate-400"
              placeholder="Password (min 6 chars)"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="relative">
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-3 pr-10 text-sm outline-none focus:border-sky-400 text-black placeholder:text-slate-400"
              placeholder="Confirm password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-extrabold text-slate-600 hover:bg-slate-100"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black placeholder:text-slate-400"
            placeholder="ZIP code"
            inputMode="numeric"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            required
          />
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black placeholder:text-slate-400"
            placeholder="County"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
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
