const STORAGE_KEY = "bognot_bingo_device_id";

// Generates (or reuses) a random ID stored in this browser's localStorage.
// Because it's saved to localStorage, refreshing, closing the tab, or losing
// wifi and reconnecting will always find the SAME id — which is how the
// server recognizes "this is the same participant" without any login.
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
