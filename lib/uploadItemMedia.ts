import { supabase } from "./supabaseClient";

function extFromName(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

export async function uploadItemFile(itemId: string, file: File) {
  const ext = extFromName(file.name);
  const path = `${itemId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("item-media")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("item-media").getPublicUrl(path);
  return data.publicUrl;
}
