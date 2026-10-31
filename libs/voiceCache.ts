export interface AudioCache {
  get(key: string): ArrayBuffer | undefined;
  set(key: string, audio: ArrayBuffer): void;
}

/**
 * Least-recently-used audio kept in memory, bounded by entries and bytes.
 * Authored lines repeat across players, so most of them are paid for once
 * per server instance.
 */
export function createAudioCache(options: { maxEntries: number; maxBytes: number }): AudioCache {
  const entries = new Map<string, ArrayBuffer>();
  let bytes = 0;

  const remove = (key: string) => {
    const existing = entries.get(key);
    if (!existing) return;
    entries.delete(key);
    bytes -= existing.byteLength;
  };

  return {
    get(key) {
      const audio = entries.get(key);
      if (!audio) return undefined;
      entries.delete(key);
      entries.set(key, audio);
      return audio;
    },
    set(key, audio) {
      if (audio.byteLength > options.maxBytes) return;
      remove(key);
      entries.set(key, audio);
      bytes += audio.byteLength;
      while (entries.size > options.maxEntries || bytes > options.maxBytes) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        remove(oldest);
      }
    },
  };
}
