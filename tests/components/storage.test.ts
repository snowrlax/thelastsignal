// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/route";
import { readFlag, readText, STORAGE_KEYS, writeFlag, writeText } from "@/libs/storage";

describe("preferences storage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("round-trips flags and text under a prefix", () => {
    writeFlag(STORAGE_KEYS.muted, true);
    expect(readFlag(STORAGE_KEYS.muted)).toBe(true);
    expect(window.localStorage.getItem("tls:muted")).toBe("1");
    writeText(STORAGE_KEYS.callsign, "RAVEN");
    expect(readText(STORAGE_KEYS.callsign)).toBe("RAVEN");
    writeFlag(STORAGE_KEYS.muted, false);
    expect(readFlag(STORAGE_KEYS.muted)).toBe(false);
  });

  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readText(STORAGE_KEYS.callsign)).toBeNull();
    expect(() => writeFlag(STORAGE_KEYS.seenOpening, true)).not.toThrow();
  });
});

describe("GET /api", () => {
  it("reports health", async () => {
    expect(await (await GET()).json()).toEqual({ status: "ok" });
  });
});
