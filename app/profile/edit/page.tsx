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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  function storagePathFromPublicUrl(publicUrl: string, bucket: string) {
    try {
      const u = new URL(publicUrl);
      const marker = `/storage/v1/object/public/${bucket}/`;
      const i = u.pathname.indexOf(marker);
      if (i === -1) return null;
      return decodeURIComponent(u.pathname.slice(i + marker.length));
    } catch {
      return null;
    }
  }

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
      setAvatarUrl((data?.avatar_url ?? null) as string | null);

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save.";
      setMsg(message);
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleteMsg(null);
    if (deleteConfirmText.trim().toLowerCase() !== "delete") {
      setDeleteMsg("Type delete to confirm.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const uid = session?.user?.id;
    if (!uid) {
      router.push("/login");
      return;
    }

    const ok = confirm("This will permanently remove your account data. Continue?");
    if (!ok) return;

    setDeletingAccount(true);

    try {
      const { data: ownedItems } = await supabase
        .from("items")
        .select("id,image_urls,video_url")
        .eq("owner_id", uid);

      const ownedItemIds = ((ownedItems ?? []) as Array<{ id: string }>).map((x) => x.id);

      const mediaPaths = new Set<string>();
      ((ownedItems as Array<{ image_urls?: string[] | null; video_url?: string | null }> | null) ?? []).forEach((it) => {
        (it.image_urls ?? []).forEach((u) => {
          const p = storagePathFromPublicUrl(u, "item-media");
          if (p) mediaPaths.add(p);
        });
        if (it.video_url) {
          const p = storagePathFromPublicUrl(it.video_url, "item-media");
          if (p) mediaPaths.add(p);
        }
      });
      if (avatarUrl) {
        const avatarPath = storagePathFromPublicUrl(avatarUrl, "profile-avatars");
        if (avatarPath) {
          await supabase.storage.from("profile-avatars").remove([avatarPath]);
        }
      }
      if (mediaPaths.size > 0) {
        await supabase.storage.from("item-media").remove(Array.from(mediaPaths));
      }

      if (ownedItemIds.length) {
        await supabase.from("transactions").delete().in("item_id", ownedItemIds);
      }

      await supabase.from("transactions").delete().or(`buyer_id.eq.${uid},seller_id.eq.${uid}`);
      await supabase.from("messages").delete().eq("sender_id", uid);
      await supabase.from("conversations").delete().or(`user_a.eq.${uid},user_b.eq.${uid}`);
      await supabase.from("user_reviews").delete().eq("reviewer_id", uid);
      await supabase.from("user_reviews").delete().eq("reviewed_user_id", uid);
      await supabase.from("items").delete().eq("owner_id", uid);
      await supabase.from("profiles").delete().eq("id", uid);

      // Best effort credential rotation so the old email/password pair cannot be used.
      const replacementEmail = `deleted-${uid.slice(0, 8)}-${Date.now()}@deleted.rentago.local`;
      const replacementPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      await supabase.auth.updateUser({
        email: replacementEmail,
        password: replacementPassword,
      });

      await supabase.auth.signOut();
      router.push("/signup");
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to delete account.";
      setDeleteMsg(message);
      setDeletingAccount(false);
      return;
    }

    setDeletingAccount(false);
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link href="/profile" className="inline-flex rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-extrabold text-slate-900 shadow-sm backdrop-blur hover:bg-white">← Back</Link>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">Edit Profile</h1>

      <div className="mt-4 rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
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
              className="block w-full text-sm font-semibold text-slate-900 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-xs file:font-extrabold file:text-white hover:file:bg-slate-800"
            />
            <p className="mt-1 text-xs text-slate-600">
              {avatarFile ? `Selected: ${avatarFile.name}` : "Choose a photo (jpg/png)."}
            </p>
          </div>
        </div>

        <div className="mt-5 text-sm font-semibold text-slate-900">Name</div>
        <input
          className="mt-2 w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 shadow-sm backdrop-blur"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />

        <div className="mt-4 text-sm font-semibold text-slate-900">Bio</div>
        <textarea
          className="mt-2 w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 shadow-sm backdrop-blur"
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell people about you…"
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">ZIP</div>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 shadow-sm backdrop-blur"
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
              className="mt-2 w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 shadow-sm backdrop-blur"
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              placeholder="e.g., Fulton County"
            />
          </div>
        </div>

        {msg ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {msg}
          </p>
        ) : null}

        <button
          onClick={save}
          disabled={saving || avatarUploading}
          className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-4 text-sm font-extrabold text-white shadow-lg shadow-slate-900/15 disabled:opacity-60 hover:bg-slate-800 active:scale-[0.99]"
        >
          {avatarUploading ? "Uploading photo…" : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50/70 p-6 shadow-lg shadow-rose-900/5 backdrop-blur-xl">
        <h2 className="text-base font-extrabold tracking-tight text-rose-900">Delete Account</h2>
        <p className="mt-2 text-sm font-semibold text-rose-800">
          This permanently wipes your account data. Type <span className="font-extrabold">delete</span> to confirm.
        </p>

        <input
          className="mt-3 w-full rounded-2xl border border-rose-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-rose-400 shadow-sm"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder='Type "delete"'
        />

        {deleteMsg ? (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700">
            {deleteMsg}
          </p>
        ) : null}

        <button
          onClick={deleteAccount}
          disabled={deletingAccount || deleteConfirmText.trim().toLowerCase() !== "delete"}
          className="mt-4 w-full rounded-2xl bg-rose-600 px-4 py-4 text-sm font-extrabold text-white shadow-lg shadow-rose-900/15 disabled:opacity-60 hover:bg-rose-700 active:scale-[0.99]"
        >
          {deletingAccount ? "Deleting account…" : "Delete Account"}
        </button>
      </div>
    </main>
  );
}
