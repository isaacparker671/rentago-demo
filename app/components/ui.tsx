"use client";

import React from "react";

export function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-xl",
        "transition hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold transition active:scale-[0.99]";
  const styles =
    variant === "primary"
      ? "bg-sky-600 text-white shadow-sm hover:bg-sky-700"
      : "border border-slate-200/70 bg-white/70 text-slate-900 hover:bg-white";
  return <button className={cx(base, styles, className)} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm font-semibold",
        "text-slate-900 placeholder:text-slate-400 outline-none shadow-sm backdrop-blur",
        "focus:border-sky-400",
        props.className
      )}
    />
  );
}
