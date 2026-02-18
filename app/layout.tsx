import "./globals.css";
import type { Metadata } from "next";
import BottomNav from "./components/BottomNav";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Rentago",
  description: "Rent and sell items locally.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Premium background (soft blobs + gradient like your waitlist) */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -left-40 h-[720px] w-[720px] rounded-full bg-sky-200/55 blur-3xl" />
          <div className="absolute top-0 -right-40 h-[760px] w-[760px] rounded-full bg-indigo-200/45 blur-3xl" />
          <div className="absolute bottom-[-260px] left-1/2 h-[860px] w-[860px] -translate-x-1/2 rounded-full bg-sky-100/70 blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-slate-50/55 to-slate-50/90" />
        </div>

        {/* Glass header */}
        <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-2xl bg-sky-600 shadow-sm" />
              <div className="text-base font-extrabold tracking-tight text-slate-900">
                Rentago
              </div>
            </div>
            <div className="text-xs font-semibold text-slate-500">Demo</div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-[1100px] px-4 pb-28 pt-6">
          {children}
        </main>

        <BottomNav />
      </body>
    </html>
  );
}
