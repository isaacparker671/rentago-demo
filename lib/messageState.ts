type ReadMap = Record<string, string>;

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
