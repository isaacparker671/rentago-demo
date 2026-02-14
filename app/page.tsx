import Link from "next/link";

export default function HomePage() {
  return (
    <main className="px-4 pb-24 pt-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">Welcome to Rentago</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Rent or sell items locally. Use the tabs below to browse, post, message, and manage your profile.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link
            href="/browse"
            className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Browse
          </Link>
          <Link
            href="/post"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900"
          >
            Post Item
          </Link>
        </div>
      </div>
    </main>
  );
}
