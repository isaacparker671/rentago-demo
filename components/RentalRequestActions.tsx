"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type TxStatus = "pending" | "accepted" | "denied" | "cancelled" | "completed" | string;

type Transaction = {
  id: string;
  conversation_id: string;
  item_id: string | null;
  owner_id: string | null;
  renter_id: string | null;
  status: TxStatus;
  requested_dates: string[] | null;
  created_at?: string;
};

type Conversation = {
  id: string;
  item_id: string | null;
  user_a: string;
  user_b: string;
};

type Item = {
  id: string;
  owner_id: string;
  listing_type: "rent" | "sell";
};

export default function RentalRequestActions(props: { conversationId: string | null }) {
  const conversationId = props.conversationId;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [tx, setTx] = useState<Transaction | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isOwner = useMemo(() => {
    if (!viewerId || !item) return false;
    return viewerId === item.owner_id;
  }, [viewerId, item]);

  // If there is ANY transaction row for this conversation, renter already requested.
  const renterAlreadyRequested = useMemo(() => {
    return !!tx?.id;
  }, [tx]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!conversationId) return;
      setLoading(true);
      setMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id ?? null;
      if (!alive) return;
      setViewerId(uid);

      // conversation
      const { data: cData, error: cErr } = await supabase
        .from("conversations")
        .select("id,item_id,user_a,user_b")
        .eq("id", conversationId)
        .single();

      if (!alive) return;
      if (cErr || !cData) {
        setConv(null);
        setItem(null);
        setTx(null);
        setLoading(false);
        return;
      }

      const conversation = cData as Conversation;
      setConv(conversation);

      // item (needed to decide owner)
      if (conversation.item_id) {
        const { data: iData } = await supabase
          .from("items")
          .select("id,owner_id,listing_type")
          .eq("id", conversation.item_id)
          .single();

        if (!alive) return;
        setItem((iData as Item) ?? null);
      } else {
        setItem(null);
      }

      // latest tx (if any)
      const { data: tData } = await supabase
        .from("transactions")
        .select("id,conversation_id,item_id,owner_id,renter_id,status,requested_dates,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      setTx((tData as Transaction) ?? null);

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [conversationId]);

  async function setStatus(next: TxStatus) {
    if (!tx?.id) return;
    setBusy(true);
    setMsg(null);

    const { error } = await supabase.from("transactions").update({ status: next }).eq("id", tx.id);

    if (error) {
      setMsg(error.message);
      setBusy(false);
      return;
    }

    // reload tx
    const { data: tData } = await supabase
      .from("transactions")
      .select("id,conversation_id,item_id,owner_id,renter_id,status,requested_dates,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setTx((tData as Transaction) ?? null);
    setBusy(false);
  }

  // This island is ONLY for RENT listings
  const isRentListing = item?.listing_type === "rent";

  if (!conversationId) return null;
  if (loading) {
    return (
      <div className="mb-3 rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm backdrop-blur">
        <div className="text-xs font-semibold text-slate-600">Loading rental actions…</div>
      </div>
    );
  }

  if (!isRentListing) return null;

  // If no viewer (not logged in), don’t show actions
  if (!viewerId) return null;

  return (
    <div className="mb-3 rounded-2xl border border-slate-200/70 bg-white/70 p-3 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">Rental status</div>
          <div className="mt-1 text-xs font-semibold text-slate-600">
            {tx?.status ? (
              <>
                Current:{" "}
                <span className="font-extrabold text-slate-900">
                  {tx.status}
                </span>
                {tx.requested_dates?.length ? (
                  <>
                    {" "}
                    • Dates:{" "}
                    <span className="font-extrabold text-slate-900">
                      {tx.requested_dates.join(", ")}
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <>No request yet.</>
            )}
          </div>
        </div>
      </div>

      {/* Owner controls */}
      {isOwner ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tx?.status === "pending" ? (
            <>
              <button
                disabled={busy}
                onClick={() => setStatus("accepted")}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              >
                Accept
              </button>
              <button
                disabled={busy}
                onClick={() => setStatus("denied")}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
              >
                Deny
              </button>
            </>
          ) : null}

          {tx?.status === "accepted" ? (
            <button
              disabled={busy}
              onClick={() => setStatus("completed")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
            >
              Finalize
            </button>
          ) : null}
        </div>
      ) : (
        // Renter: once a request exists, do NOT show another request button here.
        <div className="mt-3 text-xs font-semibold text-slate-600">
          {renterAlreadyRequested ? (
            <>Request already sent ✅</>
          ) : (
            <>Use the “Request to rent” button on the item page to send a request.</>
          )}
        </div>
      )}

      {msg ? <div className="mt-2 text-xs font-semibold text-rose-600">{msg}</div> : null}
    </div>
  );
}
