// Client-side generation gallery. Always saved to localStorage (this browser).
// When a wallet is connected, items are also synced server-side (tied to the
// address) so they survive a cleared browser / new device — see /api/history.

export type HistoryItem = {
  id: string;
  urls: string[];
  kind: "image" | "video";
  prompt: string;
  mode: "image" | "gif" | "recreate" | "wiz";
  createdAt: number;
};

const KEY = "wizardz_history";
const MAX = 120; // keep in sync with the server cap in app/api/history/route.ts

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function save(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* quota / unavailable — ignore */
  }
}

export function addHistory(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem {
  const full: HistoryItem = {
    ...item,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  save([full, ...loadHistory()]);
  return full;
}

export function removeHistory(id: string): HistoryItem[] {
  const items = loadHistory().filter((i) => i.id !== id);
  save(items);
  return items;
}

export function clearHistory(): HistoryItem[] {
  save([]);
  return [];
}

// Merge server items into local (dedupe by id, newest first).
export function mergeHistory(remote: HistoryItem[]): HistoryItem[] {
  const byId = new Map<string, HistoryItem>();
  for (const i of [...remote, ...loadHistory()]) byId.set(i.id, i);
  const merged = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX);
  save(merged);
  return merged;
}
