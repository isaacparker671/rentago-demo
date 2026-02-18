"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { cx, rCard, rCardPad, rH1, rSub } from "../../components/ui/ui";

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

function hiddenChatsKey(userId: string) {
  return `rentago:hidden_chats:${userId}`;
}

function readHiddenChats(userId: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(hiddenChatsKey(userId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function niceDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  // short, clean
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string) {
  const s = (name || "U").trim();
  if (!s) return "U";
  return s[0].toUpperCase();
}

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

      const hidden = readHiddenChats(uid);
      const list = ((rows as ConversationRow[]) || []).filter((row) => !hidden.has(row.id));
      setConvos(list);

      const otherIds = Array.from(
        new Set(list.map((c) => (c.user_a === uid ? c.user_b : c.user_a)).filter(Boolean))
      );

      const itemIds = Array.from(new Set(list.map((c) => c.item_id).filter(Boolean))) as string[];

      if (otherIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,name,avatar_url")
          .in("id", otherIds);

        const map: Record<string, ProfileMini> = {};
        (profs as ProfileMini[] | null)?.forEach((p) => (map[p.id] = p));
        setProfiles(map);
      }

      if (itemIds.length) {
        const { data: its } = await supabase.from("items").select("id,title").in("id", itemIds);

        const map: Record<string, ItemMini> = {};
        (its as ItemMini[] | null)?.forEach((it) => (map[it.id] = it));
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
        <div className={cx("mx-auto max-w-2xl", rCard, rCardPad)}>
          <div className="text-sm font-semibold text-slate-700">Loading…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pb-24 pt-6">
      <div className="mx-auto max-w-2xl">
        {/* Header - Rork vibe */}
        <div className={cx("mb-5", rCard, "p-5")}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
              <span className="text-lg font-extrabold">💬</span>
            </div>
            <div className="min-w-0">
              <h1 className={rH1}>Messages</h1>
              <p className={cx(rSub, "mt-1")}>All your conversations in one place.</p>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {list.length === 0 ? (
            <div className={cx(rCard, "p-6")}>
              <div className="text-base font-extrabold text-slate-900">No conversations yet</div>
              <p className="mt-2 text-sm text-slate-600">
                Message a seller from an item page to start your first chat.
              </p>
              <Link
                href="/browse"
                className="mt-4 inline-flex rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20"
              >
                Browse items
              </Link>
            </div>
          ) : (
            list.map(({ c, otherId, profile, item }) => {
              const name = profile?.name || "User";
              const avatar = profile?.avatar_url || null;
              const subtitle = item?.title ? `Re: ${item.title}` : "Direct message";
              const when = niceDate(c.last_message_at);

              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/messages/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/messages/${c.id}`);
                    }
                  }}
                  className={cx(
                    "group block",
                    "rounded-3xl border border-slate-200/70 bg-white/70 shadow-sm backdrop-blur",
                    "transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
                  )}
                >
                  <div className="flex items-center gap-3 p-4 sm:p-5">
                    {/* Avatar */}
                    <Link
                      href={`/u/${otherId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="relative h-12 w-12 flex-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm"
                      aria-label={`View ${name}'s profile`}
                    >
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-sm font-extrabold text-slate-700">{initials(name)}</span>
                        </div>
                      )}
                      {/* tiny online dot (purely visual) */}
                      <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </Link>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-extrabold text-slate-900">
                          {name}
                        </div>
                        <div className="text-xs font-semibold text-slate-500">{when}</div>
                      </div>

                      <div className="mt-1 truncate text-xs font-semibold text-slate-600">
                        {subtitle}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-500">
                          Tap to open chat
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 group-hover:text-sky-700">
                          Open →
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
