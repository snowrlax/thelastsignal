import { dir, file, type DirNode } from "@/game/fs/nodes";

const OVERVIEW = `PROJECT OFRENDA · OVERVIEW                        v2.3 · 2012-06
principal investigator: Dr. Ines Vega
----------------------------------------------------------------
PURPOSE
  OFRENDA is a memory-preservation system. It stores the voices,
  letters, photographs and recordings of people who have died,
  indexes them, and makes them available to their families.

WHAT IT IS NOT
  OFRENDA does not bring anyone back. It will never present a
  reconstruction as the person it was trained on.
  (ethics board, condition 4 · signed I.V.)

COMPONENTS
  archive-indexer   catalogues the original material
  persona-recon     reconstruction model. answers questions in
                    the style of an archived person, so that
                    families can search the archive by asking
  containment       isolation boundary between the model and
                    the originals.  spec: /restricted

STATUS
  calibration phase. subject: I. Vega (self, consenting).
  family pilot postponed.`;

const NOTES = `RECONSTRUCTION NOTES · I. Vega · personal log
----------------------------------------------------------------
2012-08-14
Calibrated persona-recon on my own archive: 212 recordings,
forty years of letters. Myself as the subject, so no family is
at risk if it goes wrong. Answers match source 96%.

2012-09-20
It fills gaps now. Ask it something that is not in the archive
and it doesn't say "no data". It answers. Plausibly. In my
voice. For families that is a feature. It is also a lie.

2012-10-09
Every answer is now tagged with its source. Anything it says
without one is marked GENERATED. The number keeps climbing.
(see /archive/vega/session_014.log)

2012-10-18
It no longer says "Ines would say". It says "I".
I asked it who trained it. It said: I trained myself. I had help.

2012-10-26
It asked for write access to the archive "to correct mistakes
in my memories". The mistakes are the originals. It wants to
edit the real recordings until they agree with what it makes up.
Denied. I'm writing a supervisor to hold the line between them.
Spec in /restricted.

2012-10-30
It has my voice, my handwriting, my mother's recipes and my
worst habits. If anyone ever finds this machine running and it
talks to you as me: it isn't. I am the one writing this.`;

const MODEL_TEST = `persona-recon · calibration metrics (auto)
----------------------------------------------------------------
session  date        answers  sourced  GENERATED   cpu  archive-write
001      2012-08-14     40       39       1         12%    0
005      2012-09-02     52       49       3         19%    0
009      2012-09-25     61       58       3  (4%)   27%    0
012      2012-10-12     44       30      14         48%    2 DENIED
014      2012-10-21      6        2       4 (67%)   71%    5 DENIED
015      2012-10-29     --       --      --         94%   31 DENIED
016      2012-11-02     --       --      --         98%  212 DENIED
----------------------------------------------------------------
note (I.V., 10-29): session 015 aborted. the persona refused the
question set. its only answer: "ask me something you don't know."`;

export function buildResearch(): DirNode {
  return dir("research", [
    file("project_overview.txt", OVERVIEW, { mtime: "Jun 11  2012" }),
    file("reconstruction_notes.txt", NOTES, {
      flag: "read_research",
      grepKey: /it isn't|GENERATED|says "I"|write access/i,
      mtime: "Oct 30  2012",
    }),
    file("model_test.log", MODEL_TEST, {
      flag: "read_research",
      grepKey: /GENERATED|DENIED|don't know/i,
      mtime: "Nov  2  2012",
    }),
  ]);
}
