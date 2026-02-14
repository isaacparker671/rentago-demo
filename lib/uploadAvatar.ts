import { supabase } from "./supabaseClient";

function extFromName(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

export async function uploadAvatar(userId: string, file: File) {
  const ext = extFromName(file.name);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("profile-avatars")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("profile-avatars")
    .getPublicUrl(path);

  return data.publicUrl;
}
