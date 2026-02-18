"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AvailabilityEditor from "../../../components/AvailabilityEditor";
import { StarsDisplay, StarsInput } from "../../../components/Stars";

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
  availability_days?: string[] | null; // IMPORTANT
};

type Owner = { id: string; name: string | null; bio: string | null };
type ItemReview = {
  id: string;
  item_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer_name?: string | null;
  reviewer_avatar?: string | null;
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
  const [reviews, setReviews] = useState<ItemReview[]>([]);
  const [canReviewItem, setCanReviewItem] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [reviewFeatureReady, setReviewFeatureReady] = useState(true);
  const [markingReturned, setMarkingReturned] = useState(false);

  // media UI
  const [mediaIndex, setMediaIndex] = useState(0);

  // renter calendar
  const [rentCalOpen, setRentCalOpen] = useState(false);
  const [requestedDays, setRequestedDays] = useState<string[]>([]);

  async function loadItemReviews(itemId: string, currentViewerId: string | null, currentItem: Item) {
    if (currentItem.listing_type !== "rent") {
      setReviews([]);
      setCanReviewItem(false);
      return;
    }

    const { data: rawReviews, error: reviewsErr } = await supabase
      .from("item_reviews")
      .select("id,item_id,reviewer_id,rating,comment,created_at")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    if (reviewsErr) {
      const msg = reviewsErr.message || "";
      if (msg.includes("Could not find the table") || msg.includes("item_reviews")) {
        setReviewFeatureReady(false);
        setReviews([]);
        setCanReviewItem(false);
        return;
      }
      setReviewFeatureReady(false);
      setReviews([]);
      setCanReviewItem(false);
      return;
    }

    setReviewFeatureReady(true);

    const list = ((rawReviews as ItemReview[] | null) ?? []).map((r) => ({
      ...r,
      rating: Number(r.rating || 0),
    }));

    const reviewerIds = Array.from(new Set(list.map((r) => r.reviewer_id))).filter(Boolean);
    const reviewerMap = new Map<string, { name: string | null; avatar_url: string | null }>();
    if (reviewerIds.length) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id,name,avatar_url")
        .in("id", reviewerIds);

      ((profileRows as Array<{ id: string; name: string | null; avatar_url: string | null }> | null) ?? []).forEach(
        (p) => reviewerMap.set(p.id, { name: p.name, avatar_url: p.avatar_url })
      );
    }

    const merged = list.map((r) => ({
      ...r,
      reviewer_name: reviewerMap.get(r.reviewer_id)?.name ?? null,
      reviewer_avatar: reviewerMap.get(r.reviewer_id)?.avatar_url ?? null,
    }));
    setReviews(merged);

    if (!currentViewerId) {
      setCanReviewItem(false);
      return;
    }

    const { data: txRows } = await supabase
      .from("transactions")
      .select("id")
      .eq("item_id", itemId)
      .eq("type", "rent")
      .eq("status", "completed")
      .eq("buyer_id", currentViewerId)
      .limit(1);

    const hasCompletedRent = !!(txRows && txRows.length);
    const hasAlreadyReviewed = merged.some((r) => r.reviewer_id === currentViewerId);
    setCanReviewItem(hasCompletedRent && currentItem.status === "available" && !hasAlreadyReviewed);
  }

  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const vid = sessionData.session?.user.id ?? null;
      setViewerId(vid);

      const { data, error } = await supabase
        .from("items")
        .select("id,owner_id,title,description,listing_type,price,price_type,category,condition,zip,county,status,image_urls,video_url,availability_days")
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
      await loadItemReviews(typedItem.id, vid, typedItem);

      setLoading(false);
    }

    load();
  }, [id]);

  async function openChatAndSendPreset() {
    if (!viewerId) {
      router.push("/login");
      return;
    }
    if (!item) return;

    const userA = viewerId;
    const userB = item.owner_id;

    // get or create conversation
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("item_id", item.id)
      .or(`and(user_a.eq.${userA},user_b.eq.${userB}),and(user_a.eq.${userB},user_b.eq.${userA})`)
      .maybeSingle();

    let convoId: string | null = existing?.id ?? null;

    if (!convoId) {
      const { data: created, error: createErr } = await supabase
        .from("conversations")
        .insert({
          item_id: item.id,
          user_a: userA,
          user_b: userB,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createErr || !created?.id) return;
      convoId = created.id as string;
    }

    // preset message
    const datesLine =
      item.listing_type === "rent" && requestedDays.length
        ? `\nRequested dates: ${requestedDays.join(", ")}`
        : "";

    const body =
      item.listing_type === "rent"
        ? `Hi! I’d like to rent "${item.title}".${datesLine}\nIs this available?`
        : `Hi! I’m interested in buying "${item.title}". Is it still available?`;

    // insert message (best effort)
    await supabase.from("messages").insert({
      conversation_id: convoId,
      sender_id: userA,
      body,
      created_at: new Date().toISOString(),
    });

    // update conversation last_message_at (best effort)
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", convoId);

    router.push(`/messages/${convoId}`);
  }

  async function markReturned() {
    if (!item || !viewerId) return;
    if (viewerId !== item.owner_id) return;
    if (item.listing_type !== "rent" || item.status !== "rented") return;

    const ok = confirm("Mark this rental as returned and available again?");
    if (!ok) return;

    setMarkingReturned(true);
    const { error } = await supabase
      .from("items")
      .update({ status: "available" })
      .eq("id", item.id);

    if (!error) {
      const nextItem = { ...item, status: "available" as const };
      setItem(nextItem);
      await loadItemReviews(item.id, viewerId, nextItem);
    }
    setMarkingReturned(false);
  }

  async function submitItemReview() {
    if (!item || !viewerId || !canReviewItem || !reviewFeatureReady) return;
    if (!reviewComment.trim()) {
      setReviewMsg("Write a quick review comment.");
      return;
    }

    setSavingReview(true);
    setReviewMsg(null);

    const { error } = await supabase
      .from("item_reviews")
      .upsert(
        {
          item_id: item.id,
          reviewer_id: viewerId,
          rating: Math.max(1, Math.min(5, Math.round(reviewRating))),
          comment: reviewComment.trim(),
        },
        { onConflict: "item_id,reviewer_id" }
      );

    if (error) {
      const msg = error.message || "Could not save review.";
      if (msg.includes("Could not find the table") || msg.includes("item_reviews")) {
        setReviewFeatureReady(false);
        setReviewMsg("Reviews are not set up yet. Ask admin to create item_reviews table.");
        setSavingReview(false);
        return;
      }
      setReviewMsg(error.message || "Could not save review.");
      setSavingReview(false);
      return;
    }

    setReviewComment("");
    setReviewRating(5);
    await loadItemReviews(item.id, viewerId, item);
    setSavingReview(false);
  }

  if (!id) {
    return (
      <main className="px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading item…</p>
      </main>
    );
  }

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

  const isOwner = !!viewerId && viewerId === item.owner_id;

  const images = (item.image_urls ?? []).filter(Boolean);
  const videoUrl = item?.video_url ?? null;
  const hasVideo = !!videoUrl;
  const mediaCount = images.length + (hasVideo ? 1 : 0);

  function mediaAt(idx: number) {
    if (idx < images.length) return { kind: "image" as const, url: images[idx] };
    if (hasVideo && idx === images.length && videoUrl) return { kind: "video" as const, url: videoUrl };
    return null;
  }

  const active = mediaAt(Math.min(mediaIndex, Math.max(0, mediaCount - 1)));
  const availabilityAnytime = !item.availability_days || item.availability_days.length === 0;

  return (
    <main className="px-4 pb-24 pt-6">
      <Link href="/browse" className="text-sm font-semibold text-sky-600">
        ← Back
      </Link>

      {/* Media */}
      {mediaCount > 0 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-[320px] w-full bg-slate-100 sm:h-[420px]">
            {active?.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.url} alt={item.title} className="h-full w-full object-contain" />
            ) : active?.kind === "video" ? (
              <video className="h-full w-full object-contain" controls playsInline src={active.url} />
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

          {mediaCount > 1 ? (
            <div className="flex gap-2 overflow-x-auto border-t border-slate-200 p-3">
              {images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setMediaIndex(i)}
                  className={`h-16 w-20 flex-none overflow-hidden rounded-xl border ${
                    mediaIndex === i ? "border-slate-900" : "border-slate-200"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
              {hasVideo ? (
                <button
                  type="button"
                  onClick={() => setMediaIndex(images.length)}
                  className={`h-16 w-20 flex-none overflow-hidden rounded-xl border ${
                    mediaIndex === images.length ? "border-slate-900" : "border-slate-200"
                  } bg-slate-50`}
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

      {/* Details */}
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

        <p className="mt-4 text-sm leading-6 text-slate-700">{item.description}</p>

        {/* Rent calendar for viewers */}
        {item.listing_type === "rent" ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-extrabold text-slate-900">Pick rental dates</div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {availabilityAnytime ? "Owner set: available anytime." : "Owner set specific available days (green)."}
            </div>

            <button
              type="button"
              onClick={() => setRentCalOpen(true)}
              className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-slate-900/15 active:scale-[0.99]"
            >
              Choose dates
            </button>

            <div className="mt-2 text-xs font-semibold text-slate-600">
              {requestedDays.length ? `Selected: ${requestedDays.join(", ")}` : "No dates selected — you can request any days."}
            </div>

            <AvailabilityEditor
              open={rentCalOpen}
              mode="renter"
              title="Select rental dates"
              availabilityDays={item.availability_days ?? []}
              bookedDays={[]}
              onConfirm={(days) => setRequestedDays(days)}
              onClose={() => setRentCalOpen(false)}
            />
          </div>
        ) : null}

        {/* Owner card */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Owner</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{owner?.name || "User"}</div>
          <p className="mt-1 text-sm text-slate-700">{owner?.bio || "No bio yet."}</p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={`/u/${item.owner_id}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900"
            >
              View Profile
            </Link>

            {isOwner ? (
              <Link href={`/items/${item.id}/edit`} className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white">
                Edit Listing
              </Link>
            ) : (
              <button onClick={openChatAndSendPreset} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
                {item.listing_type === "rent" ? "Request Rent" : "Message Owner"}
              </button>
            )}
          </div>

          {isOwner && item.listing_type === "rent" && item.status === "rented" ? (
            <button
              type="button"
              onClick={markReturned}
              disabled={markingReturned}
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {markingReturned ? "Marking returned…" : "Returned"}
            </button>
          ) : null}
        </div>

        {item.listing_type === "rent" ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-extrabold text-slate-900">Item reviews</div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              Only completed renters can review after the item is marked returned.
            </div>

            {!reviewFeatureReady ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Reviews are not set up yet. Create the <code>item_reviews</code> table in Supabase.
              </div>
            ) : null}

            {canReviewItem && reviewFeatureReady ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold text-slate-600">Your rating</div>
                <div className="mt-1">
                  <StarsInput value={reviewRating} onChange={setReviewRating} />
                </div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="How was the item?"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400"
                />
                {reviewMsg ? (
                  <div className="mt-2 text-xs font-semibold text-rose-600">{reviewMsg}</div>
                ) : null}
                <button
                  type="button"
                  onClick={submitItemReview}
                  disabled={savingReview}
                  className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  {savingReview ? "Saving…" : "Submit review"}
                </button>
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {reviews.length ? (
                reviews.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 truncate text-xs font-semibold text-slate-700">
                        {r.reviewer_name || "Renter"}
                      </div>
                      <StarsDisplay value={r.rating} />
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{r.comment}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm font-semibold text-slate-600">No item reviews yet.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
