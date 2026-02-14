import { supabase } from "./supabaseClient";

export async function canLeaveItemReview(opts: { viewerId: string; itemId: string }) {
  const { viewerId, itemId } = opts;

  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("item_id", itemId)
    .eq("status", "completed")
    .or(`buyer_id.eq.${viewerId},seller_id.eq.${viewerId}`)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function canLeaveUserReview(opts: { viewerId: string; reviewedUserId: string }) {
  const { viewerId, reviewedUserId } = opts;

  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("status", "completed")
    .or(
      `and(buyer_id.eq.${viewerId},seller_id.eq.${reviewedUserId}),and(buyer_id.eq.${reviewedUserId},seller_id.eq.${viewerId})`
    )
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}
