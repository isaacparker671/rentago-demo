import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Rentago",
  description: "Rent or sell items locally.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900">
        {/* Top Bar */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
            <Link href="/" className="text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-sky-500 to-cyan-300 bg-clip-text text-transparent">
                Rentago
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 active:scale-[0.99]"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95 active:scale-[0.99]"
              >
                Sign up
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="mx-auto max-w-md">{children}</div>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2 text-xs text-slate-600">
            <NavItem href="/browse" label="Browse" />
            <NavItem href="/post" label="Post" />
            <NavItem href="/messages" label="Messages" />
            <NavItem href="/profile" label="Profile" />
          </div>
        </nav>
      </body>
    </html>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 font-semibold hover:bg-slate-50 active:scale-[0.99]"
    >
      <div className="h-1.5 w-6 rounded-full bg-gradient-to-r from-sky-500 to-cyan-300 opacity-80" />
      <div>{label}</div>
    </Link>
  );
}
