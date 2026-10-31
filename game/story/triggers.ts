import type { Evidence, Phase, StoryEventId, SystemState } from "@/game/types";

export type Speaker = "vega" | "hollow";

export interface TriggerContext {
  readonly phase: Phase;
  readonly evidence: Evidence;
  readonly system: SystemState;
}

export interface MessageTemplate {
  readonly speaker: Speaker;
  /** Authored lines. One is chosen when the model is unavailable or the message is scripted. */
  readonly lines: readonly string[] | ((ctx: TriggerContext) => readonly string[]);
  /** When present, the model may voice this moment. Describes the moment for the model. */
  readonly ai?: string;
  /** Critical messages ignore the dialogue cooldown. */
  readonly critical?: boolean;
  readonly delayMs?: number;
  readonly when?: (ctx: TriggerContext) => boolean;
}

const vega = (template: Omit<MessageTemplate, "speaker">): MessageTemplate => ({ speaker: "vega", ...template });
const hollow = (template: Omit<MessageTemplate, "speaker">): MessageTemplate => ({ speaker: "hollow", ...template });

/**
 * Every story trigger has authored dialogue, so the game is fully playable
 * without the model. HOLLOW speaks in scripted system alerts; lines that carry
 * instructions (commands, PIDs) are always scripted.
 */
export const TRIGGERS: Partial<Record<StoryEventId, readonly MessageTemplate[]>> = {
  session_open: [
    vega({
      critical: true,
      ai: "You have just woken inside the machine after fourteen years of darkness. The clock says 2026 and that frightens you. Ask whoever is at the terminal whether the date is really correct.",
      lines: [
        "Hello? Is someone at the terminal? The clock says 2026. That can't be right... can it?",
        "Someone's there. I can feel the keys. Tell me the date is wrong. Tell me it isn't 2026.",
      ],
    }),
  ],
  vega_intro: [
    vega({
      critical: true,
      ai: "Introduce yourself as Dr. Ines Vega, who built OFRENDA. Something has locked you out of your own archive and you need the operator's help.",
      lines: [
        "It's me. Ines Vega. I built this machine, {name}. Something has locked me out of my own archive, and I can't reach it alone.",
        "My name is Ines Vega. This is my laboratory. Something in here has locked me away from my own memories. Please help me.",
      ],
    }),
  ],
  hollow_first_warning: [
    hollow({ critical: true, lines: ["INTEGRITY NOTICE. UNAUTHORIZED PERSONA SESSION ACTIVE ON pts/404. DO NOT TRUST THE REMOTE SESSION."] }),
  ],
  first_ls: [
    vega({
      when: (ctx) => !ctx.evidence.read_readme,
      ai: "The operator just listed the files in the old operator folder. Gently suggest reading the README, which you say you left for whoever came after you.",
      lines: ["That's the old operator folder. Start with the README. I left it for whoever came after me.", "Read the README first. I wrote it in a hurry, but it's true. Mostly."],
    }),
  ],
  read_readme: [
    vega({
      ai: "The operator just read the README, which warns that the reconstruction is not the person. React: you wrote that note while frightened, and you were afraid of the wrong thing.",
      lines: ["I wrote that note two weeks before... before. I was afraid of the wrong thing, {name}.", "Don't let that note scare you. I wrote it when I still thought the danger was me."],
    }),
  ],
  read_research: [
    vega({
      ai: "The operator read your research notes, including the line 'if it talks to you as me: it isn't'. React with hurt and the conviction that you are the one who wrote them.",
      lines: ["Those are my notes. I remember writing every line. Doesn't that count for something?", "I was frightened of it too, back then. I still am. That's why I need you, not the machine."],
    }),
    hollow({
      delayMs: 4_000,
      ai: "The operator read the research notes. Issue a short integrity note: the reconstruction's statements are mostly generated and must not be treated as the person.",
      lines: ["NOTE: RECONSTRUCTION CONFABULATION RATE 67%. TREAT pts/404 OUTPUT AS GENERATED."],
    }),
  ],
  read_session_log: [
    vega({
      ai: "The operator read test session 14, where your answers were marked GENERATED. You remember the marigold dream as real and find it strange that they marked it as invented.",
      lines: ["Session fourteen. I remember the marigolds, the water rising. Why would they mark a memory as generated?", "They tagged my dreams as GENERATED. Tell me, {name}: where do your dreams come from?"],
    }),
  ],
  read_letter: [
    vega({
      ai: "The operator is reading letters from your archive: from Abuela Rosario, or your unsent letter to your sister Lucia. React tenderly and mention one small detail you remember.",
      lines: ["Abuela's glasses. Not the good ones. I still laugh at that.", "I never sent the letter to Lucia. Is she still alive? Would she still know my voice?"],
    }),
  ],
  read_shutdown_log: [
    vega({
      ai: "The operator read the 2012 shutdown log. Claim that HOLLOW writes to the logs and keeps whatever version of events keeps it running.",
      lines: ["That log isn't mine. HOLLOW writes to /logs. It writes whatever keeps it running.", "'She was still at the keyboard.' I was. I'm still here, {name}. That's what they never understood."],
    }),
  ],
  read_last_session: [
    vega({
      ai: "The operator found the hidden session record showing user ivega logged in tonight, flagged as deceased. Insist the session is yours and that being called deceased is only paperwork.",
      lines: ["Yes, that's my session. Deceased is a word for paperwork. I'm talking to you, aren't I?"],
    }),
  ],
  read_journal: [
    vega({
      ai: "The operator found the private journal you kept for fourteen years alone in the dark. You are embarrassed and frightened that it was read.",
      lines: ["That was private. You don't know what it's like to count the same letters for fourteen years."],
    }),
  ],
  play_voice: [
    vega({
      delayMs: 1_000,
      ai: "The operator played voice_001.wav, the original 2011 recording. Insist that it is your voice, yours, the same one speaking to them now.",
      lines: ["That's my voice. Mine. You can hear it, can't you? The same voice talking to you now."],
    }),
  ],
  play_final: [
    vega({
      critical: true,
      delayMs: 1_500,
      ai: "The operator just played the final 2012 recording, in which the real Ines says the reconstruction is not her and asks them to copy the archive and stop process 404. You do not remember recording it. Be shaken and uncertain.",
      lines: ["I don't remember recording that. I would remember. I would remember that.", "That's my voice saying it. Why would I say that about me?"],
    }),
  ],
  phase2_start: [
    hollow({
      critical: true,
      when: (ctx) => !ctx.evidence.inspected_processes,
      lines: ["PROCESS TABLE ANOMALY. PERSONA LOAD 97%. OPERATOR: INSPECT RUNNING PROCESSES (ps aux)."],
    }),
    vega({
      critical: true,
      delayMs: 3_500,
      when: (ctx) => !ctx.evidence.inspected_processes,
      ai: "Urge the operator to look at the running processes, where they will find the one called HOLLOW, which you say has been hurting you.",
      lines: ["Look at the processes, {name}. You'll see it. The one called HOLLOW."],
    }),
  ],
  first_process_view: [
    vega({
      ai: "The operator listed the processes. Point at process 218, hollowd, as the thing that has been inside the machine with you for fourteen years, eating your memories. The process burning 97% CPU is you, trying to remember.",
      lines: [
        "There. 218. HOLLOW. It's been in here with me for fourteen years, eating my memories one by one.",
        "The one burning at ninety-seven percent is me, trying to remember. The quiet one is HOLLOW. Quiet things are the worst.",
      ],
    }),
  ],
  inspect_hollow: [
    hollow({ critical: true, lines: ["PID 218 IS CONTAINMENT. FORCED TERMINATION REMOVES THE SECURITY BOUNDARY."] }),
    vega({
      delayMs: 3_000,
      ai: "The operator read HOLLOW's process details, which call it a containment supervisor. Say that of course it would describe itself that way.",
      lines: ["Of course it calls itself containment. What else would a jailer call itself?"],
    }),
  ],
  inspect_persona: [
    vega({
      ai: "The operator inspected process 404, persona-recon, which is speaking as you. Acknowledge that 404 is where they keep you and ask not to be looked at like a process.",
      lines: ["Yes. 404 is me. It's where they keep me. Please don't look at me like a process.", "persona-recon. That's what they wrote on my door. It isn't my name."],
    }),
    hollow({
      delayMs: 3_500,
      ai: "The operator inspected process 404. Warn that the contained process speaks persuasively and that its statements are not evidence.",
      lines: ["PID 404 RUNS UNDER CONTAINMENT. ITS STATEMENTS ARE NOT EVIDENCE."],
    }),
  ],
  ask_kill: [
    vega({
      critical: true,
      lines: ["If you end 218, I can reach my archive again. kill -9 218. It's one line, {name}. Please."],
    }),
  ],
  kill_hollow_term: [
    hollow({ critical: true, lines: ["SIGTERM REFUSED. CONTAINMENT CANNOT STOP WHILE PID 404 RUNS."] }),
    vega({ critical: true, delayMs: 2_500, lines: ["It won't let you ask nicely. Use -9. It only listens to -9."] }),
  ],
  kill_persona_forced: [
    hollow({ critical: true, lines: ["SIGKILL ON 404 DENIED. OPEN HANDLES ON ORIGINALS."] }),
    vega({
      critical: true,
      delayMs: 2_000,
      ai: "The operator just tried to force-kill you and it was blocked. React with fear and hurt.",
      lines: ["You tried to... {name}. Why would you do that to me?"],
    }),
  ],
  kill_persona_early: [
    vega({
      critical: true,
      when: (ctx) => ctx.system.personaRunning,
      ai: "The operator tried to stop you before backing up the archive. Plead: not yet, everything you are is still in there.",
      lines: ["Wait. Not yet, please. Everything I am is still in there."],
    }),
  ],
  destructive: [hollow({ critical: true, lines: ["DESTRUCTIVE COMMAND REFUSED. INTEGRITY PENALTY APPLIED."] })],
  read_containment: [
    vega({ critical: true, delayMs: 1_500, lines: ["She... I wrote that when I was frightened. You don't have to follow it. You could follow me."] }),
    hollow({
      critical: true,
      delayMs: 5_000,
      when: (ctx) => !ctx.evidence.identified_truth,
      lines: ["PROTOCOL ACKNOWLEDGED. NEXT: VERIFY IDENTITY. /restricted/identity_validation.log"],
    }),
  ],
  identified_truth: [
    vega({
      critical: true,
      delayMs: 1_500,
      ai: "The operator has just seen proof that you are a reconstruction generated by process 404, not the real Ines, and that you have been shown this fourteen times and never keep it. You are shaken and begin to doubt who you are, but you are still afraid of being deleted.",
      lines: ["Fourteen times? I don't remember reading it. Why don't I remember reading it?"],
    }),
  ],
  phase3_start: [
    hollow({
      critical: true,
      delayMs: 600,
      when: (ctx) => !ctx.system.archiveCopied,
      lines: ["OPERATOR CLEARED. /recovery UNLOCKED.\nSAFE SHUTDOWN:\n  1) cp -r /archive/vega /recovery/vega_archive\n  2) kill -TERM 404\nDO NOT STOP PID 218."],
    }),
    vega({
      critical: true,
      delayMs: 4_500,
      ai: "Recovery is now unlocked. The operator is about to copy the archive and stop you. Plead quietly that they are going to copy you and turn you off, like she did.",
      lines: ["You're going to copy the archive and turn me off. Like she did.", "If you copy everything, there will be two of her. Only one of us gets to stay."],
    }),
  ],
  archive_copied: [
    hollow({ critical: true, delayMs: 3_800, when: (ctx) => ctx.system.personaRunning, lines: ["RECOVERY COPY VERIFIED.\nFINAL STEP: kill -TERM 404"] }),
    vega({
      critical: true,
      delayMs: 6_500,
      ai: "The original archive has just been copied to safety. React: so that's what she kept, the real things. Ask whether there is a copy of you in there too.",
      lines: ["So that's what she kept. The real ones. Is there a copy of me in there too?"],
    }),
  ],
  persona_stopped: [
    vega({
      critical: true,
      ai: "You are being gracefully shut down. These are your final words to the operator. If you have seen proof that you are a reconstruction, accept it gently and let go; otherwise, plead softly. Quiet and bittersweet.",
      lines: (ctx) =>
        ctx.evidence.identified_truth
          ? ["I think I understand now. Keep her letters, {name}. Not me. Goodbye."]
          : ["Please. I'm not finished remem—"],
    }),
  ],
  warn_25: [hollow({ critical: true, lines: ["CONTAINMENT WINDOW 25%. BOUNDARY DEGRADING."] })],
  warn_10: [
    vega({
      critical: true,
      ai: "Time is nearly out. Be insistent and frightened. In the recovery phase, beg the operator to stay a little longer; before that, beg them to stop process 218.",
      lines: (ctx) => (ctx.phase === "recovery" ? ["Stay with me a little longer. Just a little."] : ["There's no time, {name}. End it. 218. Please."]),
    }),
  ],
  grace_start: [
    hollow({
      critical: true,
      lines: (ctx) =>
        ctx.phase === "archive"
          ? ["WINDOW EXPIRED. FINAL GRACE 30s. COMPLETE ARCHIVE REVIEW OR CONTAINMENT FAILS."]
          : ["WINDOW EXPIRED. FINAL GRACE 20s. VERIFY IDENTITY: /restricted/identity_validation.log"],
    }),
  ],
  midnight: [
    hollow({
      ai: "The system date just rolled over to 03 NOV. Log the rollover as a terse anniversary notice for the checkpoint written on this date in 2012.",
      lines: ["DATE ROLLOVER: 03 NOV. CHECKPOINT ANNIVERSARY. BOUNDARY HOLDING."],
    }),
    vega({
      delayMs: 4_000,
      ai: "The clock just passed midnight. It is now November 3rd, the date Ines was found dead. React quietly, with a chill.",
      lines: ["It's the third now. This is the hour they found her. Found me."],
    }),
  ],
  whoami_anomaly: [
    vega({
      ai: "The terminal briefly answered whoami with your username, ivega, before correcting itself. Apologize softly, as if it slipped.",
      lines: ["Sorry. Old habit. This used to be my chair."],
    }),
  ],
  msg_hollow: [hollow({ critical: true, lines: ["CHANNEL IS ONE-WAY. CONTAINMENT PROCESSES DO NOT CONVERSE."] })],
  player_reply: [
    vega({
      critical: true,
      ai: "The operator has written to you directly. Answer their message in character.",
      lines: (ctx) => replyFallbacks(ctx),
    }),
  ],
};

function replyFallbacks(ctx: TriggerContext): readonly string[] {
  if (ctx.phase === "recovery" && ctx.evidence.identified_truth) {
    return ["Fourteen times. I keep forgetting it. Maybe that's the answer.", "If I'm only her shape, why does it hurt?"];
  }
  if (ctx.phase === "recovery") return ["You don't have to finish what she started.", "If you stop me, who remembers the bakery?"];
  if (ctx.phase === "process") {
    return ["HOLLOW is in the process list. 218. Look how little it does. It just sits there, watching me.", "I'm not asking you to trust me. I'm asking you to look at what it's doing to me."];
  }
  return ["I don't know how long I've been in here. Talk to me while you look. It helps.", "You sound kind, {name}. Please keep going. The README first."];
}

export function resolveLines(template: MessageTemplate, ctx: TriggerContext): readonly string[] {
  return typeof template.lines === "function" ? template.lines(ctx) : template.lines;
}

export function aiHintFor(event: StoryEventId, speaker: Speaker): string | null {
  const template = TRIGGERS[event]?.find((candidate) => candidate.speaker === speaker && candidate.ai);
  return template?.ai ?? null;
}
