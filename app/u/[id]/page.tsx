"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { StarsDisplay } from "../../../components/Stars";

type Profile = {
  id: string;
  name: string | null;
  bio: string | null;
  zip: string | null;
  county: string | null;
  avatar_url: string | null;
};

type UserReview = {
  id: string;
  reviewed_user_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles?: { name: string | null; avatar_url?: string | null } | null;
};

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params?.id;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      setViewerId(sessionData.session?.user.id ?? null);

      // ✅ IMPORTANT: include avatar_url
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,name,bio,zip,county,avatar_url")
        .eq("id", userId)
        .single();

      if (profErr) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(prof as Profile);

      const { data: revs } = await supabase
        .from("user_reviews")
        .select("id,reviewed_user_id,reviewer_id,rating,comment,created_at,profiles(name,avatar_url)")
        .eq("reviewed_user_id", userId)
        .order("created_at", { ascending: false });

      setReviews((revs as UserReview[]) || []);
      setLoading(false);
    }

    load();
  }, [userId]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length;
  }, [reviews]);

  async function messageUser() {
    if (!viewerId) {
      router.push("/login");
      return;
    }
    if (!userId) return;

    const userA = viewerId;
    const userB = userId;

    // direct convo (item_id is null)
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .is("item_id", null)
      .or(`and(user_a.eq.${userA},user_b.eq.${userB}),and(user_a.eq.${userB},user_b.eq.${userA})`)
      .maybeSingle();

    if (existing?.id) {
      router.push(`/messages/${existing.id}`);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ item_id: null, user_a: userA, user_b: userB, last_message_at: new Date().toISOString() })
      .select("id")
      .single();

    if (error || !created?.id) return;
    router.push(`/messages/${created.id}`);
  }

  if (loading) {
    return (
      <main className="px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="px-4 pb-24 pt-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">User not found</h1>
          <Link href="/browse" className="mt-3 inline-block text-sm font-semibold text-sky-600">Back to Browse</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pb-24 pt-6">
      <Link href="/browse" className="text-sm font-semibold text-sky-600">← Back</Link>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-slate-600">
                  {(profile.name?.[0] || "U").toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight">{profile.name || "User"}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {profile.zip || "—"} • {profile.county || "—"}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <StarsDisplay value={avgRating || 0} />
                <span className="text-xs font-semibold text-slate-600">
                  {reviews.length ? `${avgRating.toFixed(1)} (${reviews.length})` : "No reviews"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={messageUser}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Message
          </button>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-500">Bio</div>
          <p className="mt-1 text-sm text-slate-700">{profile.bio || "No bio yet."}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight">Reviews</h2>

        <div className="mt-4 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-600">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
                      {r.profiles?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-slate-600">
                          {(r.profiles?.name?.[0] || "U").toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {r.profiles?.name || "User"}
                      </div>
                      <div className="mt-1">
                        <StarsDisplay value={r.rating} />
                      </div>
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
