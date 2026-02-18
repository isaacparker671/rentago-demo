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

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cx(
              "text-lg transition active:scale-95",
              active ? "text-amber-500" : "text-slate-200 hover:text-slate-300"
            )}
            aria-label={`${n} star`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams() as { id: string };
  const router = useRouter();

  const [meId, setMeId] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [eligibleForUserReview, setEligibleForUserReview] = useState(false);
  const [loading, setLoading] = useState(true);

  // review editor state (for *my* review of this user)
  const [myReview, setMyReview] = useState<UserReview | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  const isSelf = !!meId && !!profile && meId === profile.id;

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id ?? null;
    setMeId(uid);

    // Eligibility: only allow profile review after a finalized transaction between these two users
    let eligible = false;
    if (uid) {
      const { data: tx } = await supabase
        .from("transactions")
        .select("id")
        .eq("status", "completed")
        .or(
          `and(buyer_id.eq.${uid},seller_id.eq.${params.id}),and(buyer_id.eq.${params.id},seller_id.eq.${uid})`
        )
        .limit(1);

      eligible = !!(tx && tx.length);
    }
    setEligibleForUserReview(eligible);


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

    // reviews about this user
    const { data: ur } = await supabase
      .from("user_reviews")
      .select("id,reviewed_user_id,reviewer_id,rating,comment,created_at")
      .eq("reviewed_user_id", params.id)
      .order("created_at", { ascending: false });

    const base = (((ur as any[]) || []) as UserReview[]) || [];

    // my review (if any) — used to switch between "Leave" and "Edit"
    const mine = uid ? base.find((r) => r.reviewer_id === uid) ?? null : null;
    setMyReview(mine);
    if (mine) {
      setRating(mine.rating ?? 5);
      setComment(mine.comment ?? "");
    } else {
      setRating(5);
      setComment("");
    }

    // hydrate reviewer names/avatars (best effort)
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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function saveReview() {
    setMsg(null);

    if (!meId) {
      setMsg("Log in to leave a review.");
      return;
    }
    if (!profile) return;

    // block self-reviews in UI (DB also blocks)
    if (meId === profile.id) {
      setMsg("You can’t review yourself.");
      return;
    }
    if (!comment.trim()) {
      setMsg("Write a quick comment.");
      return;
    }

    setSaving(true);

    // If a review exists, update; otherwise insert.
    const payload = {
      reviewer_id: meId,
      reviewed_user_id: profile.id,
      rating,
      comment: comment.trim(),
    };

    let error: any = null;

    if (myReview?.id) {
      const res = await supabase.from("user_reviews").upsert(payload, { onConflict: "reviewer_id,reviewed_user_id" });
      error = res.error;
    } else {
      const res = await supabase.from("user_reviews").upsert(payload, { onConflict: "reviewer_id,reviewed_user_id" });
      error = res.error;
    }

    setSaving(false);

    if (error) {
      setMsg(error.message || "Could not save review.");
      return;
    }

    setEditOpen(false);
    await load();
  }

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
        <div className="text-xl font-extrabold text-slate-900">User not found</div>
        <div className="mt-2 text-sm font-semibold text-slate-600">This profile may not exist.</div>
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
  const locationLine = `${profile.city ? profile.city + " • " : ""}${profile.zip || ""}${profile.county ? " • " + profile.county : ""}`;

  return (
    <main className="pb-24">
      <div className="flex items-center justify-between gap-2">
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
      </div>

      <section className="mt-4 rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm">
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
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">{profile.name || "User"}</div>
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

          {/* Review button: hide completely on self */}
          {!isSelf && meId && eligibleForUserReview ? (
            <button
              onClick={() => setEditOpen(true)}
              className="self-start rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur hover:bg-white active:scale-[0.99]"
            >
              {myReview ? "Edit review" : "Leave review"}
            </button>
          ) : isSelf ? (
            <span className="self-start rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-extrabold text-slate-500 shadow-sm backdrop-blur">
              This is you
            </span>
          ) : null}
        </div>

        <div className="mt-4 text-sm font-semibold text-slate-700">{profile.bio || "No bio yet."}</div>

        {msg ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {msg}
          </div>
        ) : null}
      </section>

      {/* Listings */}
      <section className="mt-6">
        <div className="text-lg font-extrabold text-slate-900">Listings</div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const hero = (it.image_urls ?? []).filter(Boolean)[0] || null;
            const loc = `${it.city ? it.city + " • " : ""}${it.zip} • ${it.county}`;
            return (
              <Link
                key={it.id}
                href={`/items/${it.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
              >
                <div className="relative aspect-[16/11] w-full flex-none bg-slate-50">
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

      {/* Reviews */}
      <section className="mt-8 rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-slate-900">Reviews</div>
            <div className="text-sm font-semibold text-slate-600">One review per person — editable</div>
          </div>

          {reviews.length ? (
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
              <Stars value={avgRating} />
              {avgRating.toFixed(1)}
            </div>
          ) : null}
        </div>

        {reviews.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4">
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

      {/* Review modal */}
      {editOpen && eligibleForUserReview ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-slate-900">
                  {myReview ? "Edit your review" : "Leave a review"}
                </div>
                <div className="text-sm font-semibold text-slate-600">One review per person.</div>
              </div>

              <button
                onClick={() => setEditOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-900 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <div className="text-xs font-extrabold text-slate-700">Rating</div>
              <div className="mt-2">
                <StarPicker value={rating} onChange={setRating} />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-xs font-extrabold text-slate-700">Comment</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400"
                placeholder="Be honest and helpful…"
              />
            </div>

            {msg ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {msg}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                onClick={saveReview}
                disabled={saving}
                className="flex-1 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60 active:scale-[0.99]"
              >
                {saving ? "Saving..." : (myReview ? "Save changes" : "Submit review")}
              </button>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-900 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
