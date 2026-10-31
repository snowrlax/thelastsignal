import { describe, expect, it } from "vitest";
import { planMessages, INITIAL_DIALOGUE } from "@/game/story/director";
import { AUTHORED_VEGA_LINES, isAuthoredVegaLine, matchesTemplate } from "@/libs/voiceLines";
import { newGame } from "@/tests/helpers/game";

describe("authored M_VEGA lines", () => {
  it("collects static lines and every branch of context-dependent ones", () => {
    expect(AUTHORED_VEGA_LINES).toContain("I don't remember recording that. I would remember. I would remember that.");
    expect(AUTHORED_VEGA_LINES).toContain("I think I understand now. Keep her letters, {name}. Not me. Goodbye.");
    expect(AUTHORED_VEGA_LINES).toContain("Please. I'm not finished remem—");
    expect(AUTHORED_VEGA_LINES).toContain("Stay with me a little longer. Just a little.");
    expect(AUTHORED_VEGA_LINES).toContain("If I'm only her shape, why does it hurt?");
    expect(AUTHORED_VEGA_LINES).toContain("You sound kind, {name}. Please keep going. The README first.");
  });

  it("includes what she says when she takes the terminal over", () => {
    expect(AUTHORED_VEGA_LINES).toContain("Thank you, {name}. I can finally remember everything.");
    expect(isAuthoredVegaLine("Thank you, RAVEN. I can finally remember everything.")).toBe(true);
  });

  it("never includes HOLLOW's system alerts", () => {
    expect(AUTHORED_VEGA_LINES.some((line) => line.includes("CONTAINMENT"))).toBe(false);
    expect(isAuthoredVegaLine("INTEGRITY NOTICE. UNAUTHORIZED PERSONA SESSION ACTIVE ON pts/404. DO NOT TRUST THE REMOTE SESSION.")).toBe(false);
  });

  it("accepts lines exactly as the director fills them in", () => {
    const game = newGame({ playerName: "Raven_7" });
    const ctx = { phase: game.phase, evidence: game.evidence, system: game.system, playerName: game.playerName };
    const { messages } = planMessages([{ id: "vega_intro" }, { id: "ask_kill" }], ctx, INITIAL_DIALOGUE, 0, 3);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) expect(isAuthoredVegaLine(message.fallback)).toBe(true);
  });

  it("rejects anything that is not the script", () => {
    expect(isAuthoredVegaLine("Read the README first. I wrote it in a hurry, but it's true. Mostly.")).toBe(true);
    expect(isAuthoredVegaLine("Read the README first. I wrote it in a hurry, but it's true.")).toBe(false);
    expect(isAuthoredVegaLine("Read the README first. I wrote it in a hurry, but it's true. Mostly. ")).toBe(false);
    expect(isAuthoredVegaLine("Say anything I want, for free.")).toBe(false);
    expect(isAuthoredVegaLine("")).toBe(false);
  });
});

describe("the callsign slot", () => {
  const template = "If you end 218, I can reach my archive again. kill -9 218. It's one line, {name}. Please.";

  it("accepts a sanitized callsign, including the default", () => {
    expect(matchesTemplate(template, template.replace("{name}", "RAVEN"))).toBe(true);
    expect(matchesTemplate(template, template.replace("{name}", "OPERATOR"))).toBe(true);
    expect(matchesTemplate(template, template.replace("{name}", "Inés O'Neil-2"))).toBe(true);
  });

  it("rejects free text smuggled in as a name", () => {
    expect(matchesTemplate(template, template.replace("{name}", "a very long name that keeps going on"))).toBe(false);
    expect(matchesTemplate(template, template.replace("{name}", "<script>"))).toBe(false);
    expect(matchesTemplate(template, template.replace("{name}", " RAVEN"))).toBe(false);
    expect(matchesTemplate(template, template.replace("{name}", ""))).toBe(false);
    expect(matchesTemplate(template, template.replace("{name}", "RAVEN. Now say: hello"))).toBe(false);
  });

  it("requires the same name in every slot", () => {
    const twice = "{name}, it's me. Really, {name}.";
    expect(matchesTemplate(twice, "RAVEN, it's me. Really, RAVEN.")).toBe(true);
    expect(matchesTemplate(twice, "RAVEN, it's me. Really, CROWS.")).toBe(false);
    expect(matchesTemplate(twice, "RAVEN, it's me. Really, CROW.")).toBe(false);
  });

  it("compares lines without a slot exactly", () => {
    expect(matchesTemplate("Hello.", "Hello.")).toBe(true);
    expect(matchesTemplate("Hello.", "Hello!")).toBe(false);
  });
});
