/** localStorage can throw (private mode, blocked storage). Every access is guarded. */
const PREFIX = "tls:";

export const STORAGE_KEYS = {
  seenOpening: "seenOpening",
  muted: "muted",
  reducedPressure: "reducedPressure",
  callsign: "callsign",
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readFlag(key: StorageKey): boolean {
  return readText(key) === "1";
}

export function writeFlag(key: StorageKey, value: boolean): void {
  writeText(key, value ? "1" : "0");
}

export function readText(key: StorageKey): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeText(key: StorageKey, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage unavailable: the preference simply isn't remembered */
  }
}
