"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import AvailabilityEditor from "../../components/AvailabilityEditor";
import { uploadItemFile } from "../../lib/uploadItemMedia";

type ListingType = "rent" | "sell";
type PriceType = "hour" | "day" | "week";
type Condition = "brand_new" | "used" | "old";

const CATEGORIES = ["Tools", "Camera", "Electronics", "Yard", "Home", "Other"] as const;

function onlyZip5(v: string) {
  return v.replace(/\D/g, "").slice(0, 5);
}
function formatMoneyInput(v: string) {
  // keep digits + one dot max
  const cleaned = v.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("").slice(0, 2);
}
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function PostPage() {
  const router = useRouter();

  // core
  const [listingType, setListingType] = useState<ListingType>("sell");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("day");
  const [zip, setZip] = useState("");
  const [county, setCounty] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Tools");
  const [condition, setCondition] = useState<Condition>("used");

  // availability (owner sets on post page)
  const [showCalendar, setShowCalendar] = useState(false);
  const [availabilityDays, setAvailabilityDays] = useState<string[]>([]); // YYYY-MM-DD

  // media (post page)
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const vidInputRef = useRef<HTMLInputElement | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // ui
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required.";
    if (!description.trim()) e.description = "Description is required.";
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) e.price = "Enter a valid price.";
    if (zip.trim().length !== 5) e.zip = "ZIP must be 5 digits.";
    if (!county.trim()) e.county = "County is required.";
    return e;
  }, [title, description, price, zip, county]);

  const canSubmit = Object.keys(errors).length === 0 && !submitting;

  async function handleSubmit() {
    setMessage(null);

    if (!canSubmit) {
      setMessage("Fix the highlighted fields first.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        router.push("/login");
        return;
      }

      // 1) Create item first (so we have item_id for storage uploads)
      const insertPayload: any = {
        owner_id: uid,
        title: title.trim(),
        description: description.trim(),
        listing_type: listingType,
        price: Number(price),
        price_type: listingType === "rent" ? priceType : "day",
        category,
        condition,
        zip: zip.trim(),
        county: county.trim(),
        status: "available",
        // IMPORTANT: availability_days column must exist in Supabase.
        // If owner selects no days => store [] or null (either works for "available anytime" logic).
        availability_days: (listingType === "rent" && availabilityDays.length ? availabilityDays : null),
      };

      const { data: created, error: createErr } = await supabase
        .from("items")
        .insert(insertPayload)
        .select("id")
        .single();

      if (createErr || !created?.id) {
        // If you see “column availability_days does not exist”, you haven’t added that column yet.
        throw new Error(createErr?.message || "Failed to create listing.");
      }

      const itemId = created.id as string;

      // 2) Upload media (optional) and save URLs
      const imageUrls: string[] = [];
      for (const f of imageFiles.slice(0, 5)) {
        if (!f.type.startsWith("image/")) continue;
        const url = await uploadItemFile(itemId, f);
        imageUrls.push(url);
      }

      let videoUrl: string | null = null;
      if (videoFile) {
        if (!videoFile.type.startsWith("video/")) {
          throw new Error("Video must be a video file.");
        }
        videoUrl = await uploadItemFile(itemId, videoFile);
      }

      if (imageUrls.length || videoUrl) {
        const { error: mediaErr } = await supabase
          .from("items")
          .update({ image_urls: imageUrls, video_url: videoUrl })
          .eq("id", itemId);

        if (mediaErr) throw new Error(mediaErr.message);
      }

      setSubmitting(false);
      router.push(`/items/${itemId}`);
    } catch (e: any) {
      setSubmitting(false);
      setMessage(e?.message || "Failed to post listing.");
    }
  }

  return (
    <main className="px-4 pb-28 pt-6">
      <div className="mx-auto max-w-2xl">
        {/* Header (Rork-ish) */}
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
              <span className="text-lg font-extrabold">R</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Create Listing</h1>
              <p className="text-sm font-semibold text-slate-600">
                Post for sale or rent — clean & simple.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Link href="/browse" className="text-sm font-semibold text-sky-600">
              ← Back
            </Link>
            <div className="text-xs font-semibold text-slate-500">
              {listingType === "rent"
                ? "No dates selected = available anytime"
                : "For sale listings don’t need dates"}
            </div>
          </div>
        </div>

        {/* Sell / Rent toggle */}
        <div className="mb-5 rounded-3xl border border-slate-200 bg-white/80 p-2 shadow-sm backdrop-blur">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setListingType("sell")}
              className={cx(
                "flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-extrabold transition",
                listingType === "sell"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              Sell
            </button>

            <button
              type="button"
              onClick={() => setListingType("rent")}
              className={cx(
                "flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-extrabold transition",
                listingType === "rent"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              Rent
            </button>
          </div>
        </div>

        {/* Message */}
        {message ? (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur">
            {message}
          </div>
        ) : null}

        {/* Card: Item details */}
        <section className="mb-4 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="mb-1 text-base font-extrabold text-slate-900">Item details</div>
          <div className="mb-4 text-sm font-semibold text-slate-600">
            Make it clear — better titles sell faster.
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={cx(
                  "w-full rounded-2xl border px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400",
                  errors.title ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
                )}
                placeholder="e.g. Dewalt Drill Kit"
              />
              {errors.title ? (
                <div className="mt-2 text-sm font-semibold text-rose-600">{errors.title}</div>
              ) : null}
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Description</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={cx(
                  "w-full min-h-[120px] rounded-2xl border px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400",
                  errors.description ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
                )}
                placeholder="Condition, pickup details, what’s included…"
              />
              {errors.description ? (
                <div className="mt-2 text-sm font-semibold text-rose-600">{errors.description}</div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Card: Pricing */}
        <section className="mb-4 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 text-base font-extrabold text-slate-900">Pricing</div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Price</div>
              <input
                value={price}
                onChange={(e) => setPrice(formatMoneyInput(e.target.value))}
                className={cx(
                  "w-full rounded-2xl border px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400",
                  errors.price ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
                )}
                placeholder="25"
                inputMode="decimal"
              />
              {errors.price ? (
                <div className="mt-2 text-sm font-semibold text-rose-600">{errors.price}</div>
              ) : null}
            </div>

            {listingType === "rent" ? (
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Rate type</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["hour", "day", "week"] as PriceType[]).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPriceType(pt)}
                      className={cx(
                        "rounded-2xl border px-3 py-4 text-sm font-extrabold transition",
                        priceType === pt
                          ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                    >
                      {pt === "hour" ? "Hour" : pt === "day" ? "Day" : "Week"}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">Type</div>
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                  For sale
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Card: Location */}
        <section className="mb-4 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 text-base font-extrabold text-slate-900">Location</div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">Zip code</div>
              <input
                value={zip}
                onChange={(e) => setZip(onlyZip5(e.target.value))}
                className={cx(
                  "w-full rounded-2xl border px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400",
                  errors.zip ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
                )}
                placeholder="30318"
                inputMode="numeric"
              />
              {errors.zip ? (
                <div className="mt-2 text-sm font-semibold text-rose-600">{errors.zip}</div>
              ) : null}
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold text-slate-900">County</div>
              <input
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                className={cx(
                  "w-full rounded-2xl border px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400",
                  errors.county ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
                )}
                placeholder="Fulton"
              />
              {errors.county ? (
                <div className="mt-2 text-sm font-semibold text-rose-600">{errors.county}</div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Card: Category */}
        <section className="mb-4 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 text-base font-extrabold text-slate-900">Category</div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cx(
                    "rounded-full border px-4 py-3 text-sm font-extrabold transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/15"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </section>

        {/* Card: Condition */}
        <section className="mb-4 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 text-base font-extrabold text-slate-900">Condition</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { key: "brand_new" as const, label: "Brand new" },
              { key: "used" as const, label: "Used" },
              { key: "old" as const, label: "Old" },
            ].map((c) => {
              const active = condition === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCondition(c.key)}
                  className={cx(
                    "rounded-2xl border px-4 py-4 text-sm font-extrabold transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Card: Availability (rent only) */}
        {listingType === "rent" ? (
          <section className="mb-4 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-extrabold text-slate-900">Availability</div>
                <div className="mt-1 text-sm font-semibold text-slate-600">
                  {availabilityDays.length
                    ? `${availabilityDays.length} day(s) selected`
                    : "No dates selected → available anytime"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                className="shrink-0 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-extrabold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800 active:scale-[0.99]"
              >
                Set available dates
              </button>
            </div>

            <div className="mt-3 text-xs font-semibold text-slate-600">
              Leave blank if the item can be rented on any day.
            </div>
          </section>
        ) : null}

        {/* Card: Media */}
        <section className="mb-5 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
          <div className="mb-1 text-base font-extrabold text-slate-900">Photos & video</div>
          <div className="mb-4 text-sm font-semibold text-slate-600">
            Add pictures now (not just on edit).
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => imgInputRef.current?.click()}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-extrabold text-slate-900"
              >
                Add photos ({imageFiles.length})
              </button>

              <button
                type="button"
                onClick={() => vidInputRef.current?.click()}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-extrabold text-slate-900"
              >
                {videoFile ? "Video selected ✅" : "Add a video (optional)"}
              </button>
            </div>

            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setImageFiles(files.slice(0, 5));
              }}
            />

            <input
              ref={vidInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = (e.target.files || [])[0] || null;
                setVideoFile(file);
              }}
            />

            <div className="text-xs font-semibold text-slate-500">
              Photos: up to 5 • Video: 1 optional
            </div>
          </div>
        </section>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={cx(
            "w-full rounded-3xl px-5 py-5 text-base font-extrabold text-white",
            "shadow-xl shadow-slate-900/25 transition",
            !canSubmit || submitting ? "bg-slate-400" : "bg-slate-900 hover:translate-y-[-1px]"
          )}
        >
          {submitting ? "Posting…" : listingType === "sell" ? "Post for Sale" : "Post for Rent"}
        </button>

        <div className="h-10" />
      </div>

      {/* Availability popup */}
      <AvailabilityEditor
        open={showCalendar}
        mode="owner"
        title="Set available dates"
        availabilityDays={availabilityDays}
        lockedDays={[]}
        selectedDays={availabilityDays}
        onClose={() => setShowCalendar(false)}
        onSave={(days) => setAvailabilityDays(days)}
      />
    </main>
  );
}
