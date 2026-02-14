"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { StarsDisplay } from "../../components/Stars";

type Profile = {
  id: string;
  name: string | null;
  bio: string | null;
  zip: string | null;
  county: string | null;
  avatar_url?: string | null;
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
  county: string;
  category: string;
  condition: "brand_new" | "used" | "old";
  image_urls?: string[] | null;
  created_at: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [avgRating, setAvgRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.push("/login");
        return;
      }
      const uid = session.user.id;

      const { data: prof } = await supabase
        .from("profiles")
        .select("id,name,bio,zip,county,avatar_url")
        .eq("id", uid)
        .single();

      setProfile((prof as Profile) ?? null);

      const { data: myItems } = await supabase
        .from("items")
        .select("id,owner_id,title,price,price_type,listing_type,status,zip,county,category,condition,image_urls,created_at")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false });

      setItems((myItems as Item[]) || []);

      const { data: reviews } = await supabase
        .from("user_reviews")
        .select("rating")
        .eq("reviewed_user_id", uid);

      const rs = (reviews as { rating: number }[]) || [];
      setReviewCount(rs.length);
      setAvgRating(rs.length ? rs.reduce((a, r) => a + (r.rating || 0), 0) / rs.length : 0);

      setLoading(false);
    }

    load();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  const hero = profile?.avatar_url || null;

  return (
    <main className="px-4 pb-24 pt-6">
      {/* Header / top part restored */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
              {hero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-slate-600">
                  {(profile?.name?.[0] || "U").toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                {profile?.name || "My Profile"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {profile?.zip || "—"} • {profile?.county || "—"}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <StarsDisplay value={avgRating || 0} />
                <span className="text-xs font-semibold text-slate-600">
                  {reviewCount ? `${avgRating.toFixed(1)} (${reviewCount})` : "No reviews"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Log out
          </button>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-500">Bio</div>
          <p className="mt-1 text-sm text-slate-700">
            {profile?.bio || "No bio yet."}
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            href="/profile/edit"
            className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Edit Profile
          </Link>
          <Link
            href="/post"
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900"
          >
            Post Item
          </Link>
        </div>
      </div>

      {/* My Listings */}
      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">My Listings</h2>
      </div>

      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">You haven’t posted any items yet.</p>
        ) : (
          items.map((it) => {
            const img = (it.image_urls ?? []).filter(Boolean)[0] || null;
            return (
              <Link
                key={it.id}
                href={`/items/${it.id}`}
                className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex">
                  <div className="h-[92px] w-[120px] bg-slate-50 flex items-center justify-center">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={it.title} className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-xs font-semibold text-slate-500">No photo</div>
                    )}
                  </div>

                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-900">{it.title}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {it.zip} • {it.county}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-slate-900">${it.price}</div>
                        <div className="text-[11px] text-slate-600">
                          {it.listing_type === "rent" ? `per ${it.price_type}` : "for sale"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-[11px] font-semibold text-slate-600">
                        {it.category} • {it.condition.replace("_", " ")}
                      </div>
                      <span className="rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {it.status}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
