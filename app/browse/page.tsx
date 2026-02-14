"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Item = {
  id: string;
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

function statusBadge(status: Item["status"]) {
  if (status === "available") return "Available";
  if (status === "reserved") return "Reserved";
  if (status === "rented") return "Rented";
  return "Sold";
}

function conditionLabel(c: Item["condition"]) {
  if (c === "brand_new") return "Brand new";
  if (c === "used") return "Used";
  return "Old";
}

const CATEGORY_OPTIONS = ["Tools", "Camera", "Electronics", "Yard", "Home", "Other"] as const;
type CategoryOpt = (typeof CATEGORY_OPTIONS)[number];

const CONDITION_OPTIONS = [
  { value: "brand_new", label: "Brand new" },
  { value: "used", label: "Used" },
  { value: "old", label: "Old" },
] as const;

const RADIUS_OPTIONS = [10, 20, 30, 40, 50, 100] as const;
type RadiusMiles = (typeof RADIUS_OPTIONS)[number];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm active:scale-[0.99]"
    >
      {label}
      <span className="text-slate-400">✕</span>
    </button>
  );
}

function CheckboxRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-sky-600"
      />
    </label>
  );
}

export default function BrowsePage() {
  const [baseItems, setBaseItems] = useState<Item[]>([]);
  const [baseLoading, setBaseLoading] = useState(true);

  // ZIP + miles (real miles via RPC)
  const [radiusItems, setRadiusItems] = useState<Item[] | null>(null);
  const [radiusLoading, setRadiusLoading] = useState(false);

  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Location mode dropdown
  const [locationMode, setLocationMode] = useState<"zip" | "city" | "county">("zip");
  const [locationValue, setLocationValue] = useState("");
  const [radiusMiles, setRadiusMiles] = useState<RadiusMiles>(10);

  // Other filters
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [typeFilter, setTypeFilter] = useState<"any" | "rent" | "sell">("any");

  // ✅ Multi-selects
  const [categoryFilters, setCategoryFilters] = useState<CategoryOpt[]>([]);
  const [conditionFilters, setConditionFilters] = useState<Array<Item["condition"]>>([]);

  // Load base list once
  useEffect(() => {
    async function loadBase() {
      setBaseLoading(true);
      const { data } = await supabase
        .from("items")
        .select("id,title,price,price_type,listing_type,status,zip,city,county,category,condition,image_urls,created_at")
        .order("created_at", { ascending: false });

      setBaseItems((data as Item[]) || []);
      setBaseLoading(false);
    }
    loadBase();
  }, []);

  // Load ZIP+miles results via RPC (real distance)
  useEffect(() => {
    async function loadRadius() {
      const zip = locationValue.trim();
      if (locationMode !== "zip" || !/^\d{5}$/.test(zip)) {
        setRadiusItems(null);
        return;
      }

      setRadiusLoading(true);
      const { data, error } = await supabase.rpc("items_within_zip_miles", {
        zip_in: zip,
        miles_in: radiusMiles,
      });

      if (error || !data) {
        console.warn("items_within_zip_miles failed:", error);
        setRadiusItems(null);
        setRadiusLoading(false);
        return;
      }

      const rows = data as any[];
      const mapped: Item[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        price: Number(r.price),
        price_type: r.price_type,
        listing_type: r.listing_type,
        status: r.status,
        zip: r.zip,
        city: r.city ?? null,
        county: r.county,
        category: r.category,
        condition: r.condition,
        image_urls: r.image_urls,
        created_at: r.created_at,
      }));

      setRadiusItems(mapped);
      setRadiusLoading(false);
    }

    loadRadius();
  }, [locationMode, locationValue, radiusMiles]);

  const loading = baseLoading || radiusLoading;

  // Pick source: ZIP mode uses RPC list if available
  const sourceItems = useMemo(() => {
    const zip = locationValue.trim();
    if (locationMode === "zip" && /^\d{5}$/.test(zip) && radiusItems) return radiusItems;
    return baseItems;
  }, [baseItems, radiusItems, locationMode, locationValue]);

  const filteredList = useMemo(() => {
    const query = q.trim().toLowerCase();
    const loc = locationValue.trim().toLowerCase();

    const minP = minPrice.trim() ? Number(minPrice) : null;
    const maxP = maxPrice.trim() ? Number(maxPrice) : null;

    return sourceItems.filter((it) => {
      // Search (title/category/condition/city/county)
      if (query) {
        const hay = `${it.title} ${it.category} ${it.condition} ${it.city ?? ""} ${it.county}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      // Rent/Buy
      if (typeFilter !== "any" && it.listing_type !== typeFilter) return false;

      // Multi-category
      if (categoryFilters.length) {
        const c = (it.category || "").toLowerCase();
        if (!categoryFilters.some((x) => x.toLowerCase() === c)) return false;
      }

      // Multi-condition
      if (conditionFilters.length) {
        if (!conditionFilters.includes(it.condition)) return false;
      }

      // Location (ZIP is handled by RPC list when available)
      if (loc) {
        if (locationMode === "zip") {
          // fallback exact match if RPC isn’t active
          if (!radiusItems) {
            if (String(it.zip || "").trim() !== locationValue.trim()) return false;
          }
        } else if (locationMode === "city") {
          const city = String(it.city || "").toLowerCase();
          if (!city.includes(loc)) return false;
        } else {
          const county = String(it.county || "").toLowerCase();
          if (!county.includes(loc)) return false;
        }
      }

      // Price range
      if (minP !== null && (!Number.isFinite(it.price) || it.price < minP)) return false;
      if (maxP !== null && (!Number.isFinite(it.price) || it.price > maxP)) return false;

      return true;
    });
  }, [
    sourceItems,
    q,
    locationValue,
    locationMode,
    radiusItems,
    minPrice,
    maxPrice,
    typeFilter,
    categoryFilters,
    conditionFilters,
  ]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];

    if (locationValue.trim()) {
      chips.push({
        key: "loc",
        label:
          locationMode === "zip"
            ? `ZIP: ${locationValue.trim()}${locationMode === "zip" && /^\d{5}$/.test(locationValue.trim()) ? ` • ${radiusMiles}mi` : ""}`
            : locationMode === "city"
            ? `City: ${locationValue.trim()}`
            : `County: ${locationValue.trim()}`,
        clear: () => {
          setLocationValue("");
          setRadiusItems(null);
        },
      });
    }

    if (minPrice.trim()) chips.push({ key: "min", label: `Min $${minPrice}`, clear: () => setMinPrice("") });
    if (maxPrice.trim()) chips.push({ key: "max", label: `Max $${maxPrice}`, clear: () => setMaxPrice("") });
    if (typeFilter !== "any") chips.push({ key: "type", label: typeFilter === "rent" ? "Rent" : "Buy", clear: () => setTypeFilter("any") });

    categoryFilters.forEach((c) =>
      chips.push({
        key: `cat-${c}`,
        label: c,
        clear: () => setCategoryFilters((prev) => prev.filter((x) => x !== c)),
      })
    );

    conditionFilters.forEach((c) =>
      chips.push({
        key: `cond-${c}`,
        label: conditionLabel(c),
        clear: () => setConditionFilters((prev) => prev.filter((x) => x !== c)),
      })
    );

    return chips;
  }, [locationValue, locationMode, radiusMiles, minPrice, maxPrice, typeFilter, categoryFilters, conditionFilters]);

  function clearAll() {
    setLocationMode("zip");
    setLocationValue("");
    setRadiusMiles(10);
    setMinPrice("");
    setMaxPrice("");
    setTypeFilter("any");
    setCategoryFilters([]);
    setConditionFilters([]);
    setRadiusItems(null);
  }

  // Input sanitizer for location
  function handleLocationChange(v: string) {
    if (locationMode === "zip") {
      const digits = v.replace(/\D/g, "").slice(0, 5);
      setLocationValue(digits);
    } else {
      setLocationValue(v);
    }
  }

  return (
    <main className="px-4 pb-24 pt-6">
      {/* Sticky top */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-white/90 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold tracking-tight">Browse</h1>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm"
          >
            Filters
          </button>
        </div>

        <div className="mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items, category, city..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
          />
        </div>

        {/* chips row */}
        {activeChips.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {activeChips.slice(0, 6).map((c) => (
              <Chip key={c.key} label={c.label} onRemove={c.clear} />
            ))}
            {activeChips.length > 6 ? (
              <span className="text-xs font-semibold text-slate-500">+{activeChips.length - 6} more</span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2 text-xs text-slate-600">
          Showing <span className="font-semibold text-slate-900">{filteredList.length}</span> item(s)
          {radiusLoading ? <span className="ml-2">• Loading miles…</span> : null}
        </div>
      </div>

      {/* List */}
      <p className="mt-4 text-sm text-slate-600">Latest listings</p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Loading…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {filteredList.map((it) => {
            const hero = (it.image_urls ?? []).filter(Boolean)[0] || null;

            return (
              <Link
                key={it.id}
                href={`/items/${it.id}`}
                className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all active:scale-[0.99] hover:shadow-md"
              >
                <div className="h-[120px] w-full bg-slate-50 flex items-center justify-center">
                  {hero ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hero} alt={it.title} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                      No photo
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-extrabold text-slate-900">{it.title}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {it.city ? `${it.city} • ` : ""}{it.zip} • {it.county}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-900">${it.price}</div>
                      <div className="text-xs text-slate-600">
                        {it.listing_type === "rent" ? `per ${it.price_type}` : "for sale"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="truncate text-xs font-semibold text-slate-600">
                      {it.category} • {conditionLabel(it.condition)}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
                        {it.listing_type === "sell" ? "Buy" : "Rent"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {statusBadge(it.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Filter drawer (smaller + nicer) */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setFiltersOpen(false)} />

          <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white shadow-2xl">
            {/* header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-base font-extrabold text-slate-900">Filters</div>
                <div className="text-xs text-slate-500">Tighter, cleaner controls</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAll}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  Clear
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* body (smaller height) */}
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {/* Location */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-900">Location</div>

                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-600">Search by</label>
                  <select
                    value={locationMode}
                    onChange={(e) => {
                      const next = e.target.value as any;
                      setLocationMode(next);
                      setLocationValue("");
                      setRadiusItems(null);
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-sky-400"
                  >
                    <option value="zip">ZIP</option>
                    <option value="city">City</option>
                    <option value="county">County</option>
                  </select>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-600">
                    {locationMode === "zip" ? "ZIP (5 digits)" : locationMode === "city" ? "City" : "County"}
                  </label>
                  <input
                    value={locationValue}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    placeholder={locationMode === "zip" ? "e.g. 30303" : locationMode === "city" ? "e.g. Atlanta" : "e.g. Fulton"}
                    maxLength={locationMode === "zip" ? 5 : undefined}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
                  />
                </div>

                {locationMode === "zip" ? (
                  <div className="mt-3">
                    <label className="text-xs font-semibold text-slate-600">Miles radius</label>
                    <select
                      value={radiusMiles}
                      onChange={(e) => setRadiusMiles(Number(e.target.value) as RadiusMiles)}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-sky-400"
                    >
                      {RADIUS_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m} miles
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {/* Price + Rent/Buy */}
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-extrabold text-slate-900">Price</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <input
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      placeholder="Min"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
                    />
                    <input
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="Max"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
                    />
                  </div>

                  <div className="mt-4">
                    <div className="text-xs font-semibold text-slate-600">Rent / Buy</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["any", "rent", "sell"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTypeFilter(t)}
                          className={cx(
                            "rounded-2xl px-3 py-3 text-sm font-extrabold",
                            typeFilter === t ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-900"
                          )}
                        >
                          {t === "any" ? "Any" : t === "rent" ? "Rent" : "Buy"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Category multi-select dropdown */}
                <details className="rounded-2xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">Categories</div>
                        <div className="text-xs text-slate-500">
                          {categoryFilters.length ? `${categoryFilters.length} selected` : "Any"}
                        </div>
                      </div>
                      <div className="text-slate-400">▾</div>
                    </div>
                  </summary>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-2">
                    {CATEGORY_OPTIONS.map((c) => (
                      <CheckboxRow
                        key={c}
                        label={c}
                        checked={categoryFilters.includes(c)}
                        onChange={(checked) => {
                          setCategoryFilters((prev) =>
                            checked ? [...prev, c] : prev.filter((x) => x !== c)
                          );
                        }}
                      />
                    ))}
                    <div className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setCategoryFilters([])}
                        className="text-xs font-semibold text-sky-700"
                      >
                        Clear categories
                      </button>
                    </div>
                  </div>
                </details>

                {/* Condition multi-select dropdown */}
                <details className="rounded-2xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">Condition</div>
                        <div className="text-xs text-slate-500">
                          {conditionFilters.length ? `${conditionFilters.length} selected` : "Any"}
                        </div>
                      </div>
                      <div className="text-slate-400">▾</div>
                    </div>
                  </summary>

                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-2">
                    {CONDITION_OPTIONS.map((c) => (
                      <CheckboxRow
                        key={c.value}
                        label={c.label}
                        checked={conditionFilters.includes(c.value)}
                        onChange={(checked) => {
                          setConditionFilters((prev) =>
                            checked ? [...prev, c.value] : prev.filter((x) => x !== c.value)
                          );
                        }}
                      />
                    ))}
                    <div className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setConditionFilters([])}
                        className="text-xs font-semibold text-sky-700"
                      >
                        Clear conditions
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* footer spacer for mobile safe area */}
            <div className="h-3" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
