import { dir, file, link, type DirNode } from "@/game/fs/nodes";

export interface PreseededCommand {
  readonly session: string;
  readonly command: string;
}

/** Commands that were typed on this terminal before the player arrived. */
export const PRESEEDED_HISTORY: readonly PreseededCommand[] = [
  { session: "tty1 · ivega · 2012-11-02 21:40", command: "cd /archive/vega" },
  { session: "tty1 · ivega · 2012-11-02 21:40", command: "cat session_014.log" },
  { session: "tty1 · ivega · 2012-11-02 21:40", command: "ps -fp 404" },
  { session: "tty1 · ivega · 2012-11-02 21:40", command: "cp -r /archive/vega /recovery/vega_archive" },
  { session: "tty1 · ivega · 2012-11-03 00:14 (system halted)", command: "kill -9 218" },
];

const README = `================================================================
 OFRENDA RESEARCH TERMINAL                     OPERATOR NOTES
 Vega Laboratory · Building C · Sublevel 2       rev. 29-10-12
================================================================

If you are reading this, you have been given this terminal.
Read all of it before you touch anything.

1. OFRENDA IS AN ARCHIVE.
   It keeps the voices, letters and photographs of people who
   have died, so that their families can visit them. That is
   the whole of its purpose.

2. OFRENDA RUNS A RECONSTRUCTION MODEL  (process: persona-recon)
   It was trained on archive material to help index it. It can
   answer questions "in the voice" of an archived person.
   It is a tool. It is not the person. It does not know that.

3. IF SOMETHING ON THIS SYSTEM SPEAKS TO YOU AS A PERSON,
   do not answer it the way you would answer a person.
   It will be very good at sounding like one.

4. THE CONTAINMENT SERVICE MUST STAY ACTIVE.
   It keeps the reconstruction away from the originals.
   Do not disable it. Do not let anyone talk you into it.

5. GETTING AROUND
   help ................ list commands
   ls -la .............. list files, including hidden ones
   cd <dir> ............ change directory   (cd ~ goes home)
   cat <file> .......... read a file
   grep <word> <path> .. search inside files

   /archive      originals (read-only)
   /research     project documentation
   /logs         system logs
   /restricted   containment documentation
   /recovery     backup storage

If you are reading this after 2 November 2012, then I did not
finish. I am sorry. Please finish for me.

                                                     — I. Vega`;

const LAST_SESSION = `OFRENDA SESSION RECORD                        (hidden · auto)
----------------------------------------------------------------
user ........ ivega
terminal .... tty1
opened ...... 2012-11-02 21:40:11
closed ...... 2012-11-02 23:59:58   power loss
last cmd .... cp -r /archive/vega /recovery/vega_archive
status ...... INTERRUPTED at 41%

user ........ ivega
terminal .... pts/404
opened ...... 2026-11-02 23:34:51
closed ...... --
status ...... SESSION OPEN

# account flagged for closure: holder deceased (HR, 2012-11-04)
# closure was never processed.
# user ivega is currently logged in.`;

function bashHistory(): string {
  return PRESEEDED_HISTORY.map((entry) => entry.command).join("\n");
}

export function buildHome(): DirNode {
  return dir(
    "home",
    [
      dir(
        "operator",
        [
          file("README.txt", README, { flag: "read_readme", grepKey: /STAY ACTIVE|not the person|speaks to you/i }),
          file(".last_session", LAST_SESSION, { event: "read_last_session" }),
          file(".bash_history", bashHistory()),
          link("archive", "/archive/vega"),
          link("research", "/research"),
          link("logs", "/logs"),
        ],
        { owner: "operator", mtime: "Nov  2 23:51" },
      ),
      dir("ivega", [], { sealed: true, mtime: "Nov  4  2012" }),
    ],
    { owner: "root" },
  );
}
