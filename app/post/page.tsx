"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  name?: string | null;
  zip?: string | null;
  county?: string | null;
};

type ZipRow = {
  city?: string | null;
  county_name?: string | null;
};

const CATEGORIES = ["Tools", "Camera", "Electronics", "Yard", "Home", "Other"] as const;
const CONDITIONS = [
  { value: "brand_new", label: "Brand new" },
  { value: "used", label: "Used" },
  { value: "old", label: "Old" },
] as const;

export default function PostItemPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [listingType, setListingType] = useState<"rent" | "sell">("rent");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<"hour" | "day" | "week">("day");

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Tools");
  const [condition, setCondition] = useState<"brand_new" | "used" | "old">("used");

  // ✅ Per-item location (vacation support)
  const [zip, setZip] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [zipLookupMsg, setZipLookupMsg] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load auth + profile
  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;
      setUserId(uid);

      if (!uid) return;

      const { data: p } = await supabase
        .from("profiles")
        .select("id,name,zip,county")
        .eq("id", uid)
        .single();

      const prof = (p as Profile) || null;
      setProfile(prof);

      // Default item location from profile (but editable)
      const pzip = (prof?.zip || "").toString().trim();
      const pcounty = (prof?.county || "").toString().trim();

      if (pzip) setZip(pzip);
      if (pcounty) setCounty(pcounty);

      // If profile zip exists, auto-fill city/county_name from zip_coords too
      if (/^\d{5}$/.test(pzip)) {
        await lookupZip(pzip, true);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupZip(z: string, silent = false) {
    const clean = z.trim();
    if (!/^\d{5}$/.test(clean)) {
      setCity("");
      if (!silent) setZipLookupMsg("ZIP must be 5 digits.");
      return;
    }

    setZipLookupMsg(null);

    const { data, error } = await supabase
      .from("zip_coords")
      .select("city,county_name")
      .eq("zip", clean)
      .single();

    if (error || !data) {
      setCity("");
      if (!silent) setZipLookupMsg("ZIP not found in ZIP database.");
      return;
    }

    const row = data as ZipRow;
    const cty = (row.city || "").toString();
    const cnty = (row.county_name || "").toString();

    setCity(cty);
    // If we get county_name, use it as item county (best for search)
    if (cnty) setCounty(cnty);

    if (!silent) setZipLookupMsg(cty || cnty ? "Location found ✅" : null);
  }

  const canSubmit = useMemo(() => {
    if (!userId) return false;
    if (!title.trim()) return false;
    if (!description.trim()) return false;
    if (!price.trim() || !Number.isFinite(Number(price))) return false;
    if (!/^\d{5}$/.test(zip.trim())) return false;
    if (!county.trim()) return false;
    if (!category) return false;
    if (!condition) return false;
    return true;
  }, [userId, title, description, price, zip, county, category, condition]);

  async function onSubmit() {
    setErr(null);

    if (!userId) {
      setErr("You must be logged in to post.");
      return;
    }
    if (!canSubmit) {
      setErr("Please fill out all required fields correctly.");
      return;
    }

    setSubmitting(true);

    // For SELL listings, we still store a price_type to satisfy schemas that require it.
    // It won't be shown in UI.
    const safePriceType = listingType === "sell" ? "day" : priceType;

    const payload = {
      owner_id: userId,
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      price_type: safePriceType,
      listing_type: listingType,
      status: "available",
      zip: zip.trim(),
      county: county.trim(),
      city: city.trim(),
      category,
      condition,
    };

    const { data, error } = await supabase.from("items").insert(payload).select("id").single();

    if (error || !data) {
      setErr(error?.message || "Failed to post item.");
      setSubmitting(false);
      return;
    }

    // Go to item page
    router.push(`/items/${data.id}`);
  }

  if (!userId) {
    return (
      <main className="px-4 pb-24 pt-6">
        <h1 className="text-xl font-extrabold tracking-tight">Post Item</h1>
        <p className="mt-2 text-sm text-slate-600">Please log in first.</p>
      </main>
    );
  }

  return (
    <main className="px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold tracking-tight">Post Item</h1>
      </div>

      {/* Listing type toggle */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setListingType("rent")}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            listingType === "rent" ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-900"
          }`}
        >
          Rent
        </button>
        <button
          type="button"
          onClick={() => setListingType("sell")}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            listingType === "sell" ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-900"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Basics */}
      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
          rows={4}
        />
      </div>

      {/* Price */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={listingType === "sell" ? "Price" : "Price"}
          inputMode="decimal"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
        />

        {/* ✅ Only show price type for RENT */}
        {listingType === "rent" ? (
          <select
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as any)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
          >
            <option value="hour">per hour</option>
            <option value="day">per day</option>
            <option value="week">per week</option>
          </select>
        ) : (
          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            One-time sale
          </div>
        )}
      </div>

      {/* Category + Condition */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as any)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* ✅ Location (per item) */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-900">Item location</div>
          <button
            type="button"
            onClick={async () => {
              const pzip = (profile?.zip || "").toString().trim();
              const pcounty = (profile?.county || "").toString().trim();
              if (pzip) setZip(pzip);
              if (pcounty) setCounty(pcounty);
              if (/^\d{5}$/.test(pzip)) await lookupZip(pzip, true);
              setZipLookupMsg("Using profile location ✅");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
          >
            Use profile
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            value={zip}
            onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
            setZip(digits);
          }}
            onBlur={() => lookupZip(zip)}
            placeholder="ZIP (5 digits)"
            maxLength={5}
            pattern="\d{5}"
            inputMode="numeric"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
          />
          <input
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            placeholder="County"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
          />
        </div>

        <div className="mt-2 text-xs text-slate-600">
          {city ? <span className="font-semibold text-slate-900">{city}</span> : null}
          {zipLookupMsg ? <span className={city ? "ml-2" : ""}>{zipLookupMsg}</span> : null}
        </div>

        <div className="mt-2 text-xs text-slate-500">
          This ZIP/county is saved on the item — so you can post items while traveling.
        </div>
      </div>

      {err ? <div className="mt-4 text-sm font-semibold text-red-600">{err}</div> : null}

      <button
        disabled={!canSubmit || submitting}
        onClick={onSubmit}
        className={`mt-5 w-full rounded-2xl px-4 py-4 text-sm font-extrabold ${
          !canSubmit || submitting ? "bg-slate-200 text-slate-500" : "bg-sky-600 text-white"
        }`}
      >
        {submitting ? "Posting…" : "Post item"}
      </button>
    </main>
  );
}
