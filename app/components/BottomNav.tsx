"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { computeUnreadCounts, readHiddenChats } from "../../lib/messageState";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Tab({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-2 transition",
        active ? "text-sky-700" : "text-slate-500 hover:text-slate-700"
      )}
    >
      <div className={cx("text-lg leading-none", active && "scale-[1.08]")}>
        {icon}
      </div>
      <div className="text-[11px] font-semibold">{label}</div>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileInitial, setProfileInitial] = useState("U");
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    let uidForSub: string | null = null;
    async function refreshUnread(uid: string) {
      const { data: rows } = await supabase
        .from("conversations")
        .select("id,last_message_at,user_a,user_b")
        .or(`user_a.eq.${uid},user_b.eq.${uid}`);

      const hidden = readHiddenChats(uid);
      const list = ((rows as Array<{ id: string; last_message_at: string | null }> | null) ?? [])
        .filter((r) => !hidden.has(r.id));

      const convoIds = list.map((c) => c.id);
      if (!convoIds.length) {
        setUnreadTotal(0);
        return;
      }

      const { data: msgRows } = await supabase
        .from("messages")
        .select("conversation_id,sender_id,created_at")
        .in("conversation_id", convoIds);

      const counts = computeUnreadCounts(
        uid,
        list.map((c) => ({ id: c.id })),
        ((msgRows as Array<{ conversation_id: string; sender_id: string; created_at: string | null }> | null) ?? [])
      );
      setUnreadTotal(Object.values(counts).reduce((a, b) => a + b, 0));
    }

    async function loadMyAvatar() {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      uidForSub = uid ?? null;
      if (!uid) {
        setAvatarUrl(null);
        setProfileInitial("U");
        setUnreadTotal(0);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("avatar_url,name")
        .eq("id", uid)
        .maybeSingle();

      setAvatarUrl((data?.avatar_url ?? null) as string | null);
      setProfileInitial(((data?.name ?? "U").toString().trim()[0] || "U").toUpperCase());
      await refreshUnread(uid);
    }
    loadMyAvatar();

    const channel = supabase
      .channel(`bottom-nav-unread-${pathname}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          if (uidForSub) void refreshUnread(uidForSub);
        }
      )
      .subscribe();

    const onUnreadChanged = () => {
      if (uidForSub) void refreshUnread(uidForSub);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("rentago:unread-changed", onUnreadChanged);
    }

    return () => {
      void supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("rentago:unread-changed", onUnreadChanged);
      }
    };
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/browse") return pathname === "/" || pathname.startsWith("/browse");
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto w-full max-w-[1100px] px-3 pb-3">
        <div className="rounded-[30px] border border-slate-200/70 bg-white/75 shadow-2xl backdrop-blur-xl">
          <div className="flex px-2 py-2">
            <Tab href="/post" label="Post" icon="＋" active={isActive("/post")} />
            <Tab href="/browse" label="Browse" icon="⌕" active={isActive("/browse")} />
            <Tab
              href="/messages"
              label="Messages"
              active={isActive("/messages")}
              icon={
                <span className="relative inline-flex">
                  <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden>
                    <rect x="3.5" y="6.5" width="17" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 8l7 5 7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {unreadTotal > 0 ? (
                    <span className="absolute -right-2 -top-2 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 py-0.5 text-[9px] font-extrabold leading-none text-white ring-2 ring-white">
                      {unreadTotal > 99 ? "99+" : unreadTotal}
                    </span>
                  ) : null}
                </span>
              }
            />
            <Tab
              href="/profile"
              label="Profile"
              active={isActive("/profile")}
              icon={
                <span className="flex h-[18px] w-[18px] items-center justify-center overflow-hidden rounded-full border border-current/20 bg-white/80">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold leading-none">{profileInitial}</span>
                  )}
                </span>
              }
            />
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  );
}
