"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { StarsDisplay, StarsInput } from "../../../components/Stars";
import { canLeaveItemReview } from "../../../lib/reviewEligibility";

type Item = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  listing_type: "rent" | "sell";
  price: number;
  price_type: "hour" | "day" | "week";
  category: string;
  condition: "brand_new" | "used" | "old";
  zip: string;
  county: string;
  status: "available" | "reserved" | "rented" | "sold";
  image_urls?: string[] | null;
  video_url?: string | null;
};

type Owner = { id: string; name: string | null; bio: string | null };

type Review = {
  id: string;
  item_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: { name: string | null } | null;
};

function formatCondition(c: Item["condition"]) {
  if (c === "brand_new") return "Brand New";
  if (c === "used") return "Used";
  return "Old";
}

export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);

  const [eligible, setEligible] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);

  // media UI
  const [mediaIndex, setMediaIndex] = useState(0);

  async function loadReviews(itemId: string) {
    const { data } = await supabase
      .from("item_reviews")
      .select("id, item_id, reviewer_id, rating, comment, created_at, profiles(name),video_url")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    setReviews((data as Review[]) || []);
  }

  useEffect(() => {
    if (!id) return;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const vid = sessionData.session?.user.id ?? null;
      setViewerId(vid);

      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setItem(null);
        setOwner(null);
        setLoading(false);
        return;
      }

      const typedItem = data as Item;
      setItem(typedItem);

      const { data: ownerData } = await supabase
        .from("profiles")
        .select("id, name, bio")
        .eq("id", typedItem.owner_id)
        .single();

      setOwner((ownerData as Owner) ?? null);

      await loadReviews(typedItem.id);

      if (vid) {
        const ok = await canLeaveItemReview({ viewerId: vid, itemId: typedItem.id });
        setEligible(ok);
      } else {
        setEligible(false);
      }
      setEligibilityChecked(true);

      setLoading(false);
    }

    load();
  }, [id]);

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((a, r) => a + (r.rating || 0), 0);
    return sum / reviews.length;
  }, [reviews]);

  async function messageOwner() {
    if (!viewerId) {
      router.push("/login");
      return;
    }
    if (!item) return;

    const userA = viewerId;
    const userB = item.owner_id;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("item_id", item.id)
      .or(`and(user_a.eq.${userA},user_b.eq.${userB}),and(user_a.eq.${userB},user_b.eq.${userA})`)
      .maybeSingle();

    if (existing?.id) {
      router.push(`/messages/${existing.id}`);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ item_id: item.id, user_a: userA, user_b: userB, last_message_at: new Date().toISOString() })
      .select("id")
      .single();

    if (error || !created?.id) return;

    router.push(`/messages/${created.id}`);
  }

  async function submitReview() {
    if (!viewerId || !item) return;

    setSavingReview(true);
    setReviewMsg(null);

    const body = comment.trim();
    const { error } = await supabase.from("item_reviews").insert({
      item_id: item.id,
      reviewer_id: viewerId,
      rating,
      comment: body.length ? body : null,
    });

    if (error) {
      setReviewMsg(error.message);
      setSavingReview(false);
      return;
    }

    setComment("");
    setRating(5);
    setReviewMsg("Review submitted.");
    await loadReviews(item.id);
    setSavingReview(false);
  }

  if (!id) return <main className="px-4 pb-24 pt-6"><p className="text-sm text-slate-600">Loading…</p></main>;
  if (loading) return <main className="px-4 pb-24 pt-6"><p className="text-sm text-slate-600">Loading item…</p></main>;

  if (!item) {
    return (
      <main className="px-4 pb-24 pt-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">Item not found</h1>
          <Link href="/browse" className="mt-4 inline-block text-sm font-semibold text-sky-600">
            Back to Browse
          </Link>
        </div>
      </main>
    );
  }

  const isOwner = viewerId && viewerId === item.owner_id;

  const images = (item.image_urls ?? []).filter(Boolean);
  const hasVideo = !!item.video_url;
  const mediaCount = images.length + (hasVideo ? 1 : 0);

  function mediaAt(idx: number) {
    // First N = images, last = video (if present)
    if (idx < images.length) return { kind: "image" as const, url: images[idx] };
    if (hasVideo && idx === images.length) return { kind: "video" as const, url: item.video_url! };
    return null;
  }

  const active = mediaAt(Math.min(mediaIndex, Math.max(0, mediaCount - 1)));

  return (
    <main className="px-4 pb-24 pt-6">
      <Link href="/browse" className="text-sm font-semibold text-sky-600">← Back</Link>

      {/* ✅ Media */}
      {mediaCount > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-[320px] sm:h-[420px] w-full bg-slate-100">
            {active?.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.url}
                alt={item.title}
                className="h-full w-full object-contain"
              />
            ) : active?.kind === "video" ? (
              <video
                className="h-full w-full object-contain"
                controls
                playsInline
                src={active.url}
              />
            ) : null}

            {mediaCount > 1 ? (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-white/80 px-2 py-1">
                {Array.from({ length: mediaCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMediaIndex(i)}
                    className={`h-2 w-2 rounded-full ${i === mediaIndex ? "bg-slate-900" : "bg-slate-300"}`}
                    aria-label={`Media ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Thumbnails */}
          {mediaCount > 1 ? (
            <div className="flex gap-2 overflow-x-auto border-t border-slate-200 p-3">
              {images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setMediaIndex(i)}
                  className={`h-16 w-20 flex-none overflow-hidden rounded-xl border ${mediaIndex === i ? "border-slate-900" : "border-slate-200"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
              {hasVideo ? (
                <button
                  type="button"
                  onClick={() => setMediaIndex(images.length)}
                  className={`h-16 w-20 flex-none overflow-hidden rounded-xl border ${mediaIndex === images.length ? "border-slate-900" : "border-slate-200"} bg-slate-50`}
                >
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-700">
                    Video
                  </div>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{item.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {item.zip} • {item.county} • {item.category} • {formatCondition(item.condition)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-extrabold text-slate-900">${item.price}</div>
            <div className="text-xs text-slate-600">
              {item.listing_type === "rent" ? `per ${item.price_type}` : "for sale"}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            Status: {item.status}
          </span>

          <div className="flex items-center gap-2">
            <StarsDisplay value={avgRating || 0} />
            <span className="text-xs font-semibold text-slate-600">
              {reviews.length ? `${avgRating.toFixed(1)} (${reviews.length})` : "No reviews"}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-700">{item.description}</p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Owner</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{owner?.name || "User"}</div>
          <p className="mt-1 text-sm text-slate-700">{owner?.bio || "No bio yet."}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={`/u/${item.owner_id}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900"
            >
              View Profile
            </Link>

            {isOwner ? (
              <Link
                href={`/items/${item.id}/edit`}
                className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Edit Listing
              </Link>
            ) : (
              <button
                onClick={messageOwner}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
              >
                Message Owner
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight">Item Reviews</h2>

        {eligibilityChecked && !eligible ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Reviews locked</div>
            <p className="mt-1 text-sm text-slate-600">
              You can leave a review after the seller finalizes the transaction.
            </p>
          </div>
        ) : null}

        {eligibilityChecked && eligible ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Leave a review</div>
            <div className="mt-2">
              <StarsInput value={rating} onChange={setRating} />
            </div>
            <textarea
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
              rows={3}
              placeholder="Optional comment…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              onClick={submitReview}
              disabled={savingReview}
              className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingReview ? "Submitting…" : "Submit Review"}
            </button>

            {reviewMsg ? <p className="mt-2 text-xs text-slate-600">{reviewMsg}</p> : null}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-600">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {r.profiles?.name || "User"}
                    </div>
                    <div className="mt-1">
                      <StarsDisplay value={r.rating} />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                {r.comment ? (
                  <p className="mt-2 text-sm leading-6 text-slate-700">{r.comment}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
