import { ONLINE_WINDOW_MS } from "@/lib/constants";

export function nowIso() {
  return new Date().toISOString();
}

export function isDeviceOnline(lastSeen: string | null) {
  if (!lastSeen) {
    return false;
  }

  const lastSeenMs = new Date(lastSeen).getTime();

  if (Number.isNaN(lastSeenMs)) {
    return false;
  }

  return Date.now() - lastSeenMs <= ONLINE_WINDOW_MS;
}
