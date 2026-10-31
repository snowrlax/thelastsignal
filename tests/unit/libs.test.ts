import { afterEach, describe, expect, it, vi } from "vitest";
import { wrapText } from "@/components/crt/dotMatrixLayout";
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyphFor } from "@/components/crt/font5x7";
import { planMessages, INITIAL_DIALOGUE } from "@/game/story/director";
import { buildDialogueRequest, fetchDialogueLine } from "@/libs/dialogueClient";
import { clientKey, createRateLimiter } from "@/libs/rateLimit";
import { buildReport, evidenceLabels } from "@/libs/report";
import { newGame, runAll, startedGame } from "@/tests/helpers/game";

describe("rate limiter", () => {
  it("allows up to the limit inside the window, then reports when to retry", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 100).allowed).toBe(true);
    expect(limiter.check("a", 200)).toEqual({ allowed: false, retryAfterMs: 800 });
    expect(limiter.check("b", 200).allowed).toBe(true);
    expect(limiter.check("a", 1_101).allowed).toBe(true);
  });

  it("evicts the oldest key when full", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 10_000, maxKeys: 1 });
    limiter.check("a", 0);
    limiter.check("b", 1);
    expect(limiter.check("a", 2).allowed).toBe(true);
  });

  it("identifies clients by forwarded address", () => {
    expect(clientKey(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
    expect(clientKey(new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(clientKey(new Request("http://x"))).toBe("local");
  });
});

describe("dialogue client", () => {
  afterEach(() => vi.unstubAllGlobals());

  const planned = () => planMessages([{ id: "player_reply", text: "hello" }], { ...newGame(), playerName: "RAVEN" }, INITIAL_DIALOGUE, 0, 0).messages[0];

  it("sends only controlled context", () => {
    const game = runAll(startedGame(), ["cat README.txt"]).state;
    const request = buildDialogueRequest(game, planned(), Array.from({ length: 12 }, (_, i) => ({ speaker: "vega" as const, text: `line ${i}` })));
    expect(request.evidence).toEqual(["read_readme"]);
    expect(request.recent).toHaveLength(8);
    expect(request.playerMessage).toBe("hello");
    expect(request.remainingSeconds).toBeGreaterThan(0);
    expect(buildDialogueRequest(newGame(), { ...planned(), playerText: undefined }, []).remainingSeconds).toBeNull();
  });

  it("returns the model's text, or null on any failure", async () => {
    const request = buildDialogueRequest(startedGame(), planned(), []);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { text: "Hola." } }))));
    expect(await fetchDialogueLine(request)).toBe("Hola.");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    expect(await fetchDialogueLine(request)).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { text: 4 } }))));
    expect(await fetchDialogueLine(request)).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchDialogueLine(request)).toBeNull();
  });
});

describe("session report", () => {
  it("summarises the outcome, evidence and transcript", () => {
    const game = runAll(startedGame(), ["cat README.txt", "kill -9 218"]).state;
    const report = buildReport(game, ["operator@ofrenda-01:~$ kill -9 218"], 65_000);
    expect(report).toContain("outcome .......... SIGNAL LOST");
    expect(report).toContain("session length ... 01:05");
    expect(report).toContain("[x] README");
    expect(report).toContain("kill -9 218");
    expect(evidenceLabels(game).filter((label) => label.found)).toHaveLength(1);
    expect(buildReport({ ...game, reducedPressure: true }, [], 0)).toContain("reduced pressure");
  });
});

describe("dot-matrix layout", () => {
  const measure = (value: string) => value.length;

  it("wraps words and splits words that are too long", () => {
    expect(wrapText("the last signal", measure, 8)).toEqual(["the last", "signal"]);
    expect(wrapText("abcdefghij", measure, 4)).toEqual(["abcd", "efgh", "ij"]);
    expect(wrapText("a\nb", measure, 10)).toEqual(["a", "b"]);
    expect(wrapText("", measure, 10)).toEqual([""]);
  });

  it("draws every glyph on a 5x8 grid, with accent and unknown fallbacks", () => {
    for (const char of "ABCXYZabcxyz0189.,?!É") {
      const glyph = glyphFor(char);
      expect(glyph).toHaveLength(GLYPH_HEIGHT);
      expect(glyph.every((row) => row.length === GLYPH_WIDTH)).toBe(true);
    }
    expect(glyphFor("Á")).toEqual(glyphFor("A"));
    expect(glyphFor("☃")).toEqual(glyphFor("?"));
  });
});
