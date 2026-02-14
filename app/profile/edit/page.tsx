"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadAvatar } from "../../../lib/uploadAvatar";

export default function EditProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [zip, setZip] = useState("");
  const [county, setCounty] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("name,bio,zip,county,avatar_url")
        .eq("id", session.user.id)
        .single();

      if (error) {
        setMsg(error.message);
        setLoading(false);
        return;
      }

      setName((data?.name ?? "").toString());
      setBio((data?.bio ?? "").toString());
      setZip((data?.zip ?? "").toString());
      setCounty((data?.county ?? "").toString());
      setAvatarUrl((data?.avatar_url ?? null) as any);

      setLoading(false);
    }
    load();
  }, [router]);

  function validate() {
    if (!name.trim()) return "Name is required.";
    if (!zip.trim()) return "ZIP is required.";
    if (!county.trim()) return "County is required.";
    return null;
  }

  async function uploadProfilePhotoIfNeeded(uid: string) {
    if (!avatarFile) return avatarUrl; // no change
    if (!avatarFile.type.startsWith("image/")) throw new Error("Avatar must be an image file.");

    setAvatarUploading(true);
    const url = await uploadAvatar(uid, avatarFile);

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", uid);

    setAvatarUploading(false);

    if (error) throw new Error(error.message);

    setAvatarUrl(url);
    setAvatarFile(null);
    return url;
  }

  async function save() {
    setMsg(null);
    const err = validate();
    if (err) {
      setMsg(err);
      return;
    }

    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) {
      router.push("/login");
      return;
    }

    try {
      await uploadProfilePhotoIfNeeded(uid);

      const { error } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          bio: bio.trim() || null,
          zip: zip.trim(),
          county: county.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", uid);

      if (error) throw new Error(error.message);

      setSaving(false);
      router.push("/profile");
    } catch (e: any) {
      setMsg(e?.message || "Failed to save.");
      setSaving(false);
    }
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
      <Link href="/profile" className="text-sm font-semibold text-sky-600">← Back</Link>

      <h1 className="mt-3 text-xl font-extrabold tracking-tight">Edit Profile</h1>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Avatar */}
        <div className="text-sm font-semibold text-slate-900">Profile photo</div>

        <div className="mt-3 flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-slate-600">
                {(name?.[0] || "U").toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            <p className="mt-1 text-xs text-slate-600">
              {avatarFile ? `Selected: ${avatarFile.name}` : "Choose a photo (jpg/png)."}
            </p>
          </div>
        </div>

        <div className="mt-5 text-sm font-semibold text-slate-900">Name</div>
        <input
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />

        <div className="mt-4 text-sm font-semibold text-slate-900">Bio</div>
        <textarea
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell people about you…"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">ZIP</div>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
              value={zip}
              onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
            setZip(digits);
          }}
              placeholder="e.g., 30318"
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">County</div>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              placeholder="e.g., Fulton County"
            />
          </div>
        </div>

        {msg ? (
          <p className="mt-3 text-sm text-rose-600">
            {msg}
          </p>
        ) : null}

        <button
          onClick={save}
          disabled={saving || avatarUploading}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {avatarUploading ? "Uploading photo…" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </main>
  );
}
