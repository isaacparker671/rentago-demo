type ReadMap = Record<string, string>;
type ConversationLite = { id: string };
type MessageLite = { conversation_id: string; sender_id: string; created_at: string | null };

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function hiddenChatsKey(userId: string) {
  return `rentago:hidden_chats:${userId}`;
}

export function readHiddenChats(userId: string) {
  return new Set(readJson<string[]>(hiddenChatsKey(userId), []));
}

export function readMapKey(userId: string) {
  return `rentago:convo_read_at:${userId}`;
}

export function readConversationReadMap(userId: string) {
  return readJson<ReadMap>(readMapKey(userId), {});
}

export function markConversationRead(userId: string, conversationId: string, atIso?: string) {
  const map = readConversationReadMap(userId);
  map[conversationId] = atIso || new Date().toISOString();
  writeJson(readMapKey(userId), map);
  emitUnreadChanged();
}

export function isConversationUnread(
  userId: string,
  conversationId: string,
  lastMessageAt: string | null
) {
  if (!lastMessageAt) return false;
  const readAt = readConversationReadMap(userId)[conversationId];
  if (!readAt) return true;
  return new Date(lastMessageAt).getTime() > new Date(readAt).getTime();
}

export function computeUnreadCounts(
  userId: string,
  conversations: ConversationLite[],
  messages: MessageLite[]
) {
  const readMap = readConversationReadMap(userId);
  const convoIds = new Set(conversations.map((c) => c.id));
  const counts: Record<string, number> = {};

  for (const convo of conversations) counts[convo.id] = 0;

  for (const m of messages) {
    if (!convoIds.has(m.conversation_id)) continue;
    if (!m.created_at) continue;
    if (m.sender_id === userId) continue;

    const readAt = readMap[m.conversation_id];
    if (!readAt || new Date(m.created_at).getTime() > new Date(readAt).getTime()) {
      counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
    }
  }

  return counts;
}

export function emitUnreadChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("rentago:unread-changed"));
}
