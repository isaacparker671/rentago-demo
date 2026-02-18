"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Profile = {
  id: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  zip: string | null;
  city: string | null;
  county: string | null;
};

type Item = {
  id: string;
  owner_id: string;
  title: string;
  price: number;
  price_type: "hour" | "day" | "week";
  listing_type: "rent" | "sell";
  status: "available" | "reserved" | "rented" | "sold";
  zip: string;
  city?: string | null;
  county: string;
  category: string;
  condition: "brand_new" | "used" | "old";
  image_urls?: string[] | null;
  created_at: string;
};

type UserReview = {
  id: string;
  reviewed_user_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name?: string | null;
  reviewer_avatar?: string | null;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={cx("text-sm", i < v ? "text-amber-500" : "text-slate-200")}>
          ★
        </span>
      ))}
    </div>
  );
}

function statusLabel(status: Item["status"]) {
  if (status === "available") return "Available";
  if (status === "reserved") return "Reserved";
  if (status === "rented") return "Rented";
  return "Sold";
}

function statusPill(status: Item["status"]) {
  if (status === "sold") return "bg-black/85 text-white";
  if (status === "rented") return "bg-amber-600/90 text-white";
  if (status === "reserved") return "bg-slate-900/75 text-white";
  return "bg-emerald-600/90 text-white";
}

function conditionLabel(c: Item["condition"]) {
  if (c === "brand_new") return "Brand new";
  if (c === "used") return "Used";
  return "Old";
}

export default function PublicProfilePage() {
  const params = useParams() as { id: string };
  const router = useRouter();

  const [meId, setMeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      setMeId(auth?.user?.id ?? null);

      const { data: p } = await supabase
        .from("profiles")
        .select("id,name,bio,avatar_url,zip,city,county")
        .eq("id", params.id)
        .single();

      setProfile((p as Profile) || null);

      const { data: it } = await supabase
        .from("items")
        .select(
          "id,owner_id,title,price,price_type,listing_type,status,zip,city,county,category,condition,image_urls,created_at"
        )
        .eq("owner_id", params.id)
        .order("created_at", { ascending: false });

      setItems(((it as any[]) || []) as Item[]);

      const { data: ur } = await supabase
        .from("user_reviews")
        .select("id,reviewed_user_id,reviewer_id,rating,comment,created_at")
        .eq("reviewed_user_id", params.id)
        .order("created_at", { ascending: false });

      const base = (((ur as any[]) || []) as UserReview[]) || [];

      const reviewerIds = Array.from(new Set(base.map((r) => r.reviewer_id))).filter(Boolean);
      const reviewerMap = new Map<string, { name?: string | null; avatar_url?: string | null }>();

      if (reviewerIds.length) {
        const { data: rp } = await supabase
          .from("profiles")
          .select("id,name,avatar_url")
          .in("id", reviewerIds);

        ((rp as any[]) || []).forEach((x) => {
          reviewerMap.set(x.id, { name: x.name ?? null, avatar_url: x.avatar_url ?? null });
        });
      }

      setReviews(
        base.map((r) => {
          const m = reviewerMap.get(r.reviewer_id);
          return { ...r, reviewer_name: m?.name ?? null, reviewer_avatar: m?.avatar_url ?? null };
        })
      );

      setLoading(false);
    }

    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="h-6 w-44 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-28 w-full animate-pulse rounded-3xl bg-slate-100" />
        <div className="mt-4 h-40 w-full animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="text-xl font-extrabold text-slate-900">Profile not found</div>
        <div className="mt-2 text-sm font-semibold text-slate-600">This user may not exist.</div>
        <Link
          href="/browse"
          className="mt-5 inline-flex rounded-2xl bg-sky-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-sky-700"
        >
          Back to Browse
        </Link>
      </div>
    );
  }

  const initials = (profile.name || "U").slice(0, 1).toUpperCase();
  const locationLine = `${profile.city ? profile.city + " • " : ""}${profile.zip || ""}${
    profile.county ? " • " + profile.county : ""
  }`;

  return (
    <main className="pb-24"><div className="mx-auto max-w-3xl px-4 pt-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur"><div className="flex items-center justify-between gap-2">
        <button
          onClick={() => router.back()}
          className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur hover:bg-white"
        >
          ← Back
        </button>

        <Link
          href={`/messages/new?userId=${encodeURIComponent(profile.id)}`}
          className="rounded-2xl bg-sky-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-sky-700 active:scale-[0.99]"
        >
          Message
        </Link>
      </div></div>

      <section className="mt-4 rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-lg shadow-slate-900/5 backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-slate-500">
                {initials}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900">{profile.name || "User"}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{locationLine || "Location not set"}</div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {reviews.length ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur">
                  <Stars value={avgRating} />
                  <span className="text-slate-700">{avgRating.toFixed(1)}</span>
                  <span className="text-slate-500">({reviews.length})</span>
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur">
                  No reviews yet
                </span>
              )}

              <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur">
                {items.length} listing(s)
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm font-semibold text-slate-700">{profile.bio || "No bio yet."}</div>
      </section>

      <section className="mt-6">
        <div className="text-lg font-extrabold text-slate-900">Listings</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {items.map((it) => {
            const hero = (it.image_urls ?? []).filter(Boolean)[0] || null;
            const loc = `${it.city ? it.city + " • " : ""}${it.zip} • ${it.county}`;
            return (
              <Link
                key={it.id}
                href={`/items/${it.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
              >
                <div className="relative aspect-[16/11] w-full bg-slate-50">
                  {hero ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hero} alt={it.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                      No photo
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />

                  <div className="absolute left-3 top-3 flex gap-2">
                    <span className="rounded-full border border-white/20 bg-white/90 px-3 py-1 text-xs font-extrabold text-slate-900 shadow-sm">
                      {it.listing_type === "sell" ? "Buy" : "Rent"}
                    </span>
                    <span className={cx("rounded-full px-3 py-1 text-xs font-extrabold shadow-sm", statusPill(it.status))}>
                      {statusLabel(it.status)}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-extrabold text-white">{it.title}</div>
                      <div className="mt-0.5 truncate text-xs font-semibold text-white/90">{loc}</div>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-white/20 bg-white/90 px-3 py-2 text-right shadow-sm">
                      <div className="text-base font-extrabold text-slate-900">${it.price}</div>
                      <div className="text-[11px] font-semibold text-slate-600">
                        {it.listing_type === "rent" ? `per ${it.price_type}` : "for sale"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <div className="truncate text-xs font-semibold text-slate-600">
                      {it.category} • {conditionLabel(it.condition)}
                    </div>
                    <div className="text-xs font-extrabold text-sky-700 group-hover:text-sky-800">View →</div>
                  </div>
                </div>
              </Link>
            );
          })}

          {!items.length ? (
            <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur sm:col-span-2 lg:col-span-3">
              <div className="text-base font-extrabold text-slate-900">No listings yet</div>
              <div className="mt-1 text-sm font-semibold text-slate-600">This user hasn’t posted any items.</div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-lg shadow-slate-900/5 backdrop-blur">
        <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur"><div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-slate-900">Reviews</div>
            <div className="text-sm font-semibold text-slate-600">Unlocked only after finalized transactions</div>
          </div>

          {reviews.length ? (
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
              <Stars value={avgRating} />
              {avgRating.toFixed(1)}
            </div>
          ) : null}
        </div></div>

        {reviews.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-white">
                    {r.reviewer_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.reviewer_avatar} alt="reviewer" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-extrabold text-slate-500">
                        {(r.reviewer_name || "U").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-slate-900">{r.reviewer_name || "User"}</div>
                    <div className="text-xs font-semibold text-slate-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Stars value={r.rating} />
                  </div>
                </div>

                <div className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm font-semibold text-slate-700">
                  {r.comment}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-sm font-semibold text-slate-600">No reviews yet.</div>
        )}
      </section>
    </div></main>
  );
}
