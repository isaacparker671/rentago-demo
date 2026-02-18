"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import { uploadItemFile } from "../../../../lib/uploadItemMedia";
import AvailabilityEditor from "../../../../components/AvailabilityEditor";

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
  image_urls: string[] | null;
  video_url: string | null;
  availability_days: string[] | null; // YYYY-MM-DD, null = anytime
};

const CATEGORIES = ["Tools", "Camera", "Electronics", "Yard", "Home", "Other"] as const;

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const itemId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listingType, setListingType] = useState<Item["listing_type"]>("rent");
  const [price, setPrice] = useState<string>("");
  const [priceType, setPriceType] = useState<Item["price_type"]>("day");
  const [category, setCategory] = useState<string>("Tools");
  const [condition, setCondition] = useState<Item["condition"]>("used");
  const [zip, setZip] = useState("");
  const [county, setCounty] = useState("");
  const [status, setStatus] = useState<Item["status"]>("available");

  // availability
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilityDays, setAvailabilityDays] = useState<string[]>([]); // empty => anytime

  // media
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newVideo, setNewVideo] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    if (!itemId) return;

    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id ?? null;
      if (!uid) {
        router.push("/login");
        return;
      }
      setViewerId(uid);

      const { data, error } = await supabase
        .from("items")
        .select(
          "id,owner_id,title,description,listing_type,price,price_type,category,condition,zip,county,status,image_urls,video_url,availability_days"
        )
        .eq("id", itemId)
        .single();

      if (error || !data) {
        setMsg(error?.message || "Item not found.");
        setLoading(false);
        return;
      }

      const it = data as Item;
      setItem(it);

      if (it.owner_id !== uid) {
        setMsg("You can only edit your own listing.");
        setLoading(false);
        return;
      }

      setTitle(it.title);
      setDescription(it.description);
      setListingType(it.listing_type);
      setPrice(String(it.price));
      setPriceType(it.price_type);
      setCategory(it.category || "Tools");
      setCondition(it.condition);
      setZip(it.zip);
      setCounty(it.county);
      setStatus(it.status);

      setImages((it.image_urls ?? []).filter(Boolean));
      setVideoUrl(it.video_url ?? null);

      // null/[] => anytime
      setAvailabilityDays((it.availability_days ?? []).filter(Boolean));

      setLoading(false);
    }

    load();
  }, [itemId, router]);

  const remainingImageSlots = useMemo(() => Math.max(0, 5 - images.length), [images.length]);

  function validate() {
    if (!title.trim()) return "Title is required.";
    if (!description.trim()) return "Description is required.";
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return "Price must be a valid number > 0.";
    if (!zip.trim()) return "ZIP is required.";
    if (!county.trim()) return "County is required.";
    return null;
  }

  async function saveMediaIfNeeded(id: string) {
    if (!newImages.length && !newVideo) return;

    if (images.length + newImages.length > 5) {
      throw new Error("You can only have up to 5 photos. Remove some first.");
    }

    setUploadingMedia(true);

    let nextImages = [...images];
    let nextVideoUrl = videoUrl;

    for (const f of newImages) {
      if (!f.type.startsWith("image/")) continue;
      const url = await uploadItemFile(id, f);
      nextImages.push(url);
    }

    if (newVideo) {
      if (!newVideo.type.startsWith("video/")) throw new Error("Video must be a video file.");
      const url = await uploadItemFile(id, newVideo);
      nextVideoUrl = url;
    }

    const { error } = await supabase
      .from("items")
      .update({ image_urls: nextImages, video_url: nextVideoUrl })
      .eq("id", id);

    setUploadingMedia(false);
    if (error) throw new Error(error.message);

    setImages(nextImages);
    setVideoUrl(nextVideoUrl);
    setNewImages([]);
    setNewVideo(null);
  }

  async function save() {
    setMsg(null);
    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }
    if (!item || !viewerId || item.owner_id !== viewerId) {
      setMsg("Not allowed.");
      return;
    }

    setSaving(true);

    try {
      await saveMediaIfNeeded(item.id);

      const payload: Partial<Item> = {
        title: title.trim(),
        description: description.trim(),
        listing_type: listingType,
        price: Number(price),
        price_type: listingType === "sell" ? "day" : priceType,
        category,
        condition,
        zip: zip.trim(),
        county: county.trim(),
        status,

        // ✅ KEY RULE:
        // - owner picked days => save them
        // - owner picked none => save null (anytime)
        availability_days: listingType === "rent" && availabilityDays.length ? availabilityDays : null,
      };

      const { error } = await supabase.from("items").update(payload).eq("id", item.id);
      if (error) throw new Error(error.message);

      setSaving(false);
      router.push(`/items/${item.id}`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save.");
      setSaving(false);
      setUploadingMedia(false);
    }
  }

  async function removeListing() {
    if (!item || !viewerId || item.owner_id !== viewerId) return;
    const ok = confirm("Delete this listing? This cannot be undone.");
    if (!ok) return;

    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (error) {
      setMsg(error.message);
      return;
    }
    router.push("/profile");
  }

  if (loading) {
    return (
      <main className="px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="px-4 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <Link href={item ? `/items/${item.id}` : "/browse"} className="text-sm font-semibold text-sky-600">
          ← Back
        </Link>
        {item ? (
          <button onClick={removeListing} className="text-sm font-semibold text-rose-600">
            Delete
          </button>
        ) : null}
      </div>

      <h1 className="mt-3 text-xl font-extrabold tracking-tight">Edit Listing</h1>

      {/* Availability */}
      {listingType === "rent" ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900">Availability</div>
              <div className="mt-1 text-xs font-semibold text-slate-600">
                {availabilityDays.length ? `${availabilityDays.length} date(s) selected` : "No dates selected — available anytime."}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAvailabilityOpen(true)}
              className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
            >
              Set available dates
            </button>
          </div>

          <div className="mt-2 text-xs font-semibold text-slate-500">
            If you pick dates, ONLY those dates will be available. If you pick none, EVERY day is available.
          </div>

          <AvailabilityEditor
            open={availabilityOpen}
            onClose={() => setAvailabilityOpen(false)}
            mode="owner"
            title="Set available dates"
            subtitle="Tap dates to make them available. Leave blank for available anytime."
            primaryLabel="Save"
            availabilityDays={availabilityDays}
            onSave={(days: string[]) => setAvailabilityDays(days)}
            onConfirm={(days: string[]) => setAvailabilityDays(days)}
          />
        </div>
      ) : null}

      {/* Core fields (minimal) */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Title</div>
        <input
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black placeholder:text-slate-400"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="mt-4 text-sm font-semibold text-slate-900">Description</div>
        <textarea
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black placeholder:text-slate-400"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Price</div>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Status</div>
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400 text-black"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="rented">Rented</option>
              <option value="sold">Sold</option>
            </select>
          </div>
        </div>

        {msg ? <p className="mt-3 text-sm text-rose-600">{msg}</p> : null}

        <button
          onClick={save}
          disabled={saving || uploadingMedia}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {uploadingMedia ? "Uploading media…" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </main>
  );
}
