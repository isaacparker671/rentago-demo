import Link from "next/link";

function Card({
  title,
  desc,
  href,
  badge,
}: {
  title: string;
  desc: string;
  href: string;
  badge: string;
}) {
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]"
    >
      <div className="p-5">
        <div className="inline-flex items-center rounded-full bg-sky-600/10 px-3 py-1 text-xs font-extrabold text-sky-700">
          {badge}
        </div>
        <div className="mt-3 text-lg font-extrabold tracking-tight text-slate-900">
          {title}
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-600">
          {desc}
        </div>

        <div className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white shadow-sm">
          Open <span className="opacity-80">→</span>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="pb-24">
      {/* Hero */}
      <section className="rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-600/10 px-3 py-1 text-xs font-extrabold text-sky-700">
          Investor-ready demo
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
        </div>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Rent & buy items locally —
          <span className="text-sky-700"> fast, clean, and modern.</span>
        </h1>

        <p className="mt-3 max-w-[65ch] text-sm font-semibold text-slate-600">
          Rentago lets users post items for rent or sale, message each other, and complete transactions
          with reviews unlocked only after finalize — built as a clean web demo for investors.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/browse"
            className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-sky-700 active:scale-[0.99]"
          >
            Browse listings
          </Link>
          <Link
            href="/post"
            className="rounded-2xl border border-slate-200/70 bg-white/70 px-5 py-3 text-sm font-extrabold text-slate-900 shadow-sm backdrop-blur hover:bg-white active:scale-[0.99]"
          >
            Post an item
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          badge="Browse"
          title="Find what you need"
          desc="Search listings, filter by location and category, and open item details."
          href="/browse"
        />
        <Card
          badge="Post"
          title="List items in minutes"
          desc="Add photos, set rent vs sell, save ZIP/county, and publish instantly."
          href="/post"
        />
        <Card
          badge="Messages"
          title="Talk before you commit"
          desc="Negotiate in chat, then accept/deny and finalize when ready."
          href="/messages"
        />
        <Card
          badge="Profile"
          title="Trust & reputation"
          desc="View user profiles, listings, and reviews after finalized transactions."
          href="/profile"
        />
      </section>
    </main>
  );
}
