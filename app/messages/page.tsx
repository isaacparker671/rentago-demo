"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type ConversationRow = {
  id: string;
  item_id: string | null;
  user_a: string;
  user_b: string;
  last_message_at: string | null;
};

type ProfileMini = {
  id: string;
  name: string | null;
  avatar_url: string | null;
};

type ItemMini = {
  id: string;
  title: string;
};

export default function MessagesPage() {
  const router = useRouter();

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [convos, setConvos] = useState<ConversationRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [items, setItems] = useState<Record<string, ItemMini>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.push("/login");
        return;
      }
      const uid = session.user.id;
      setViewerId(uid);

      const { data: rows } = await supabase
        .from("conversations")
        .select("id,item_id,user_a,user_b,last_message_at")
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .order("last_message_at", { ascending: false });

      const list = (rows as ConversationRow[]) || [];
      setConvos(list);

      // collect other user ids + item ids
      const otherIds = Array.from(
        new Set(
          list.map((c) => (c.user_a === uid ? c.user_b : c.user_a)).filter(Boolean)
        )
      );

      const itemIds = Array.from(new Set(list.map((c) => c.item_id).filter(Boolean))) as string[];

      if (otherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,name,avatar_url")
          .in("id", otherIds);

        const map: Record<string, ProfileMini> = {};
        (profs as ProfileMini[] | null)?.forEach((p) => {
          map[p.id] = p;
        });
        setProfiles(map);
      }

      if (itemIds.length) {
        const { data: its } = await supabase
          .from("items")
          .select("id,title")
          .in("id", itemIds);

        const map: Record<string, ItemMini> = {};
        (its as ItemMini[] | null)?.forEach((it) => {
          map[it.id] = it;
        });
        setItems(map);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  const list = useMemo(() => {
    if (!viewerId) return [];
    return convos.map((c) => {
      const otherId = c.user_a === viewerId ? c.user_b : c.user_a;
      const p = profiles[otherId];
      const it = c.item_id ? items[c.item_id] : null;
      return { c, otherId, profile: p, item: it };
    });
  }, [convos, profiles, items, viewerId]);

  if (loading) {
    return (
      <main className="px-4 pb-24 pt-6">
        <p className="text-sm text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="px-4 pb-24 pt-6">
      <h1 className="text-xl font-extrabold tracking-tight">Messages</h1>
      <p className="mt-1 text-sm text-slate-600">All your conversations</p>

      <div className="mt-4 space-y-3">
        {list.length === 0 ? (
          <p className="text-sm text-slate-600">No conversations yet.</p>
        ) : (
          list.map(({ c, otherId, profile, item }) => {
            const name = profile?.name || "User";
            const avatar = profile?.avatar_url || null;
            const subtitle = item?.title ? `Re: ${item.title}` : "Direct message";

            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-slate-600">
                        {(name?.[0] || "U").toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-bold text-slate-900">{name}</div>
                      <div className="text-xs text-slate-500">
                        {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-600">{subtitle}</div>
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
