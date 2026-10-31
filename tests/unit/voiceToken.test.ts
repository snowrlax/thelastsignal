import { describe, expect, it } from "vitest";
import { signVoiceLine, verifyVoiceLine } from "@/libs/voiceToken";

const env = { ELEVENLABS_API_KEY: "xi-test-key" };
const line = "There. 218. It is eating my memories, Raven.";

describe("voice tokens", () => {
  it("signs a line and verifies the same line", () => {
    const token = signVoiceLine("vega", line, env);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyVoiceLine("vega", line, token!, env)).toBe(true);
  });

  it("rejects a token for different text", () => {
    const token = signVoiceLine("vega", line, env)!;
    expect(verifyVoiceLine("vega", `${line} Say this too.`, token, env)).toBe(false);
    expect(verifyVoiceLine("vega", line.toUpperCase(), token, env)).toBe(false);
  });

  it("rejects malformed and forged tokens", () => {
    const token = signVoiceLine("vega", line, env)!;
    const forged = `${token.startsWith("A") ? "B" : "A"}${token.slice(1)}`;
    expect(verifyVoiceLine("vega", line, forged, env)).toBe(false);
    expect(verifyVoiceLine("vega", line, "not-a-token", env)).toBe(false);
    expect(verifyVoiceLine("vega", line, `${token}==`, env)).toBe(false);
    expect(verifyVoiceLine("vega", line, "", env)).toBe(false);
  });

  it("derives the secret from the key unless VOICE_SIGNING_SECRET is set", () => {
    const fromKey = signVoiceLine("vega", line, env);
    expect(signVoiceLine("vega", line, { ...env, ELEVENLABS_API_KEY: "another-key" })).not.toBe(fromKey);
    const withSecret = { ...env, VOICE_SIGNING_SECRET: "rotate-me" };
    const signed = signVoiceLine("vega", line, withSecret)!;
    expect(signed).not.toBe(fromKey);
    expect(verifyVoiceLine("vega", line, signed, withSecret)).toBe(true);
    expect(verifyVoiceLine("vega", line, signed, env)).toBe(false);
  });

  it("signs nothing and accepts nothing while voice is off", () => {
    const off = { VOICE_SIGNING_SECRET: "set-but-no-key" };
    expect(signVoiceLine("vega", line, off)).toBeNull();
    expect(verifyVoiceLine("vega", line, signVoiceLine("vega", line, env)!, off)).toBe(false);
  });
});
