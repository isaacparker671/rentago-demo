"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Conversation = {
  id: string;
  item_id: string | null;
  user_a: string;
  user_b: string;
};

type Msg = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type Item = {
  id: string;
  owner_id: string;
  title: string;
  listing_type: "rent" | "sell";
  status: "available" | "reserved" | "rented" | "sold";
};

type Transaction = {
  id: string;
  status: "pending" | "accepted" | "denied" | "cancelled" | "completed";
  type: "rent" | "sell";
  buyer_id: string;
  seller_id: string;
};

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const convoId = params?.id;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<{ id: string; name: string | null; avatar_url: string | null } | null>(null);
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [tx, setTx] = useState<Transaction | null>(null);

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function reloadMessages() {
    if (!convoId) return;
    const { data: msgData } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    setMsgs((msgData as Msg[]) || []);
  }

  async function reloadTx(conversationId: string) {
    const { data } = await supabase
      .from("transactions")
      .select("id, status, type, buyer_id, seller_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setTx((data as Transaction) ?? null);
  }

  async function reloadItem(itemId: string) {
    const { data } = await supabase
      .from("items")
      .select("id, owner_id, title, listing_type, status")
      .eq("id", itemId)
      .single();

    setItem((data as Item) ?? null);
  }

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.push("/login");
        return;
      }
      setViewerId(session.user.id);

      if (!convoId) return;

      const { data: convoData, error: convoErr } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", convoId)
        .single();

      if (convoErr || !convoData) {
        setLoading(false);
        return;
      }

      const typedConvo = convoData as Conversation;
      setConvo(typedConvo);

      // Load the other participant profile (avatar + name)
      const otherId =
        typedConvo.user_a === session.user.id ? typedConvo.user_b : typedConvo.user_a;

      const { data: otherProf } = await supabase
        .from("profiles")
        .select("id,name,avatar_url")
        .eq("id", otherId)
        .maybeSingle();

      setOtherUser((otherProf as any) ?? null);

      if (typedConvo.item_id) {
        await reloadItem(typedConvo.item_id);
      } else {
        setItem(null);
      }

      await reloadMessages();
      await reloadTx(typedConvo.id);

      setLoading(false);
    }

    init();
  }, [convoId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    if (!viewerId || !convoId) return;
    const body = text.trim();
    if (!body) return;

    setText("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: convoId,
      sender_id: viewerId,
      body,
    });

    if (!error) {
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convoId);

      await reloadMessages();
    }
  }

  const canRequest =
    !!viewerId &&
    !!item &&
    viewerId !== item.owner_id &&
    !tx;

  async function createRequest() {
    if (!viewerId || !convo || !item) return;

    setActionLoading("request");

    const type = item.listing_type; // rent or sell
    const buyerId = viewerId;
    const sellerId = item.owner_id;

    const { data: created, error } = await supabase
      .from("transactions")
      .insert({
        conversation_id: convo.id,
        item_id: item.id,
        buyer_id: buyerId,
        seller_id: sellerId,
        type,
        status: "pending",
      })
      .select("id, status, type, buyer_id, seller_id")
      .single();

    if (error || !created) {
      setActionLoading(null);
      return;
    }

    const auto =
      type === "rent"
        ? `Request: I'd like to rent this item. When can I pick it up?`
        : `Request: I'd like to buy this item. Is it still available?`;

    await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_id: buyerId,
      body: auto,
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convo.id);

    await reloadTx(convo.id);
    await reloadMessages();

    setActionLoading(null);
  }

  // Role helpers
  const isSeller = !!viewerId && !!tx && viewerId === tx.seller_id;
  const isBuyer = !!viewerId && !!tx && viewerId === tx.buyer_id;

  // Buttons visibility
  const showSellerDecision = !!tx && tx.status === "pending" && isSeller;
  const showBuyerCancel = !!tx && tx.status === "accepted" && isBuyer;
  const showSellerFinalize = !!tx && tx.status === "accepted" && isSeller;

  async function acceptTx() {
    if (!tx || !item || !convo) return;
    setActionLoading("accept");

    // accept transaction
    await supabase
      .from("transactions")
      .update({ status: "accepted" })
      .eq("id", tx.id);

    // update item status to reserved for both rent/sell
    await supabase
      .from("items")
      .update({ status: "reserved" })
      .eq("id", item.id);

    await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_id: tx.seller_id,
      body: "✅ Accepted. We can finalize after pickup/meetup.",
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convo.id);

    await reloadTx(convo.id);
    await reloadItem(item.id);
    await reloadMessages();
    setActionLoading(null);
  }

  async function denyTx() {
    if (!tx || !convo) return;
    setActionLoading("deny");

    await supabase
      .from("transactions")
      .update({ status: "denied" })
      .eq("id", tx.id);

    await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_id: tx.seller_id,
      body: "❌ Denied. Request not accepted.",
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convo.id);

    await reloadTx(convo.id);
    await reloadMessages();
    setActionLoading(null);
  }

  async function cancelTx() {
    if (!tx || !item || !convo) return;
    setActionLoading("cancel");

    await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", tx.id);

    // item goes back available
    await supabase
      .from("items")
      .update({ status: "available" })
      .eq("id", item.id);

    await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_id: tx.buyer_id,
      body: "⚠️ Cancelled the request.",
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convo.id);

    await reloadTx(convo.id);
    await reloadItem(item.id);
    await reloadMessages();
    setActionLoading(null);
  }

  async function finalizeTx() {
    if (!tx || !item || !convo) return;
    setActionLoading("finalize");

    await supabase
      .from("transactions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", tx.id);

    // finalize item status:
    // rent -> rented, sell -> sold
    const nextStatus = tx.type === "rent" ? "rented" : "sold";

    await supabase
      .from("items")
      .update({ status: nextStatus })
      .eq("id", item.id);

    await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_id: tx.seller_id,
      body: "🎉 Finalized. You can now leave a review.",
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", convo.id);

    await reloadTx(convo.id);
    await reloadItem(item.id);
    await reloadMessages();
    setActionLoading(null);
  }

  if (loading) {
    return (
      <main className="px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading chat…</p>
      </main>
    );
  }

  if (!convo) {
    return (
      <main className="px-4 pb-24 pt-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-bold tracking-tight">Chat not found</h1>
          <Link href="/messages" className="mt-3 inline-block text-sm font-semibold text-sky-600">
            Back to Messages
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pb-24 pt-6">
      <Link href="/messages" className="text-sm font-semibold text-sky-600">
        ← Back
      </Link>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Conversation</div>
          <div className="text-xs text-slate-600">
            {item ? `Item: ${item.title}` : "Direct message"}
            {item ? ` • Item status: ${item.status.toUpperCase()}` : ""}
          </div>

          {tx ? (
            <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Transaction: {tx.type.toUpperCase()} • {tx.status.toUpperCase()}
            </div>
          ) : null}
        </div>

        {/* Request CTA */}
        {canRequest ? (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <button
              onClick={createRequest}
              disabled={actionLoading === "request"}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {actionLoading === "request"
                ? "Creating request…"
                : item!.listing_type === "rent"
                ? "Request Rent"
                : "Request Buy"}
            </button>
            <p className="mt-2 text-xs text-slate-600">
              Chat first, then send an official request when you're ready.
            </p>
          </div>
        ) : null}

        {/* Seller decision buttons */}
        {showSellerDecision ? (
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={acceptTx}
                disabled={actionLoading === "accept"}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {actionLoading === "accept" ? "Accepting…" : "Accept"}
              </button>
              <button
                onClick={denyTx}
                disabled={actionLoading === "deny"}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                {actionLoading === "deny" ? "Denying…" : "Deny"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Accepting reserves the item. You can finalize after meetup.
            </p>
          </div>
        ) : null}

        {/* Buyer cancel button */}
        {showBuyerCancel ? (
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <button
              onClick={cancelTx}
              disabled={actionLoading === "cancel"}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 disabled:opacity-60"
            >
              {actionLoading === "cancel" ? "Cancelling…" : "Cancel Request"}
            </button>
          </div>
        ) : null}

        {/* Seller finalize button */}
        {showSellerFinalize ? (
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <button
              onClick={finalizeTx}
              disabled={actionLoading === "finalize"}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {actionLoading === "finalize" ? "Finalizing…" : "Finalize"}
            </button>
            <p className="mt-2 text-xs text-slate-600">
              Finalize marks it complete and unlocks reviews.
            </p>
          </div>
        ) : null}

        <div className="max-h-[55vh] overflow-y-auto px-3 py-3">
          {msgs.map((m) => {
            const mine = viewerId === m.sender_id;
            const otherAvatar = otherUser?.avatar_url || null;

            return (
              <div key={m.id} className={`mb-3 flex ${mine ? "justify-end" : "justify-start"} gap-2`}>
                {!mine ? (
                  <div className="mt-1 h-8 w-8 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center flex-none">
                    {otherAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={otherAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-600">
                        {(otherUser?.name?.[0] || "U").toUpperCase()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="h-8 w-8 flex-none" />
                )}

                <div
                  className={[
                    "max-w-[78%] rounded-2xl px-4 py-2 text-sm leading-6",
                    mine
                      ? "bg-slate-900 text-white rounded-br-md"
                      : "bg-white border border-slate-200 text-slate-900 rounded-bl-md",
                  ].join(" ")}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-slate-500"}`}>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-400"
              placeholder="Message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button
              onClick={send}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
