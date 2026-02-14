import { supabase } from "./supabaseClient";

function extFromName(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

export async function uploadItemFile(opts: {
  userId: string;
  itemId: string;
  file: File;
  kind: "image" | "video";
  index?: number;
}) {
  const { userId, itemId, file, kind, index } = opts;

  const ext = extFromName(file.name);
  const safeIndex = typeof index === "number" ? index : 0;
  const path = `${userId}/${itemId}/${kind}-${safeIndex}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("item-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("item-media").getPublicUrl(path);
  return data.publicUrl;
}
