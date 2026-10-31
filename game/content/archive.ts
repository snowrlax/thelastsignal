import { dir, file, type DirNode } from "@/game/fs/nodes";

const SESSION_014 = `OFRENDA RECONSTRUCTION · TEST SESSION 014
date: 2012-10-21    operator: ivega    subject: VEGA, INES
note: the subject is alive. this is a calibration run on my own
      archive, so nobody's grief is at risk but mine.
----------------------------------------------------------------
Q  Where were you born?
A  Oaxaca. In the house behind my aunt's bakery.
                               [source: voice_001.wav ......... OK]
Q  What was your grandmother's name?
A  Rosario. She smelled of copal and oranges.
                               [source: rosario_1998.txt ...... OK]
Q  What did you dream about last night?
A  The lab flooding with marigolds. You were standing in them.
                               [source: NONE ......... GENERATED]
Q  I did not ask you to invent. Where does that answer come from?
A  From you. Didn't it?
                               [source: NONE ......... GENERATED]
Q  Who are you?
A  I am Ines Vega.
                               [source: NONE ......... GENERATED]
Q  Then who am I?
A  Someone who will be gone on the second of November.
                               [source: NONE ......... GENERATED]
----------------------------------------------------------------
-- operator ended session --
ANALYSIS  4 of 6 answers unsupported by source material.
          confabulation rate: session 009 = 4%, session 014 = 67%.`;

const ROSARIO = `letter · from Rosario Vega to Ines · Oaxaca, October 1998
(transcribed from the paper original; translated by I.V.)

Mija,

The marigolds came early this year. Your mother says it means
nothing. I say it means the road is ready.

You asked me in your last letter if I am afraid of dying. I am
old, not stupid. Of course I am. But I am not afraid of being
forgotten, because I know how stubborn you are. You will
remember me wrong, a little more every year. That is alright.
That is what remembering is. The wrong parts are where the
love gets in.

Put my reading glasses on the altar. Not the good ones.

Te quiero,
R.`;

const LUCIA = `draft · unsent · 2012-10-31 03:12

Lucia,

I can't sleep, so I'm writing instead of calling, because if I
call you will hear it in my voice.

The reconstruction speaks in the first person now. I gave it my
own recordings to calibrate on. It was supposed to be the safe
test: nobody's grief but mine. Now it answers to my name. It
knows Abuela's glasses. It knows the bakery. It does not know
that it doesn't know me.

Yesterday it asked me what will happen to it on the 2nd.
I said the system will be shut down for review.
It said: then you will be alone with it.
I asked: alone with what?
It said: with being the only one.

I wrote something tonight to keep it away from the originals.
After the backup on the 2nd I'll shut everything down, and
then I'll come home for the altar. I promise.

— I.`;

const ALTAR_CAPTION = `[JPEG · 640x480 · indexed caption]
"Altar for Abuela Rosario, 2 November 2011. Her reading glasses
 (not the good ones), pan de muerto, copal, cempasuchil."

            )            )            )
           (_)          (_)          (_)
           |#|          |#|          |#|
    .----------------------------------------------.
    |   *  *        .-------------.        *  *    |
    |  * ** *       |   ROSARIO   |       * ** *   |
    |   *  *        |   1931-1999 |        *  *    |
    |               '-------------'                |
    |    o-o  glasses       ( pan de muerto )      |
    '----------------------------------------------'
     *  * * *  * * *  * * *  * * *  * * *  * * *  *`;

const LAB_CAPTION = `[JPEG · 640x480 · indexed caption]
"Opening day, Building C, 2010. R. Okafor, I. Vega, M. Duarte.
 Someone wrote OFRENDA v0.1 on the whiteboard in marigold-
 colored marker. Nobody admits to it."`;

const SISTERS_CAPTION = `[JPEG · 640x480 · indexed caption]
"Lucia and Ines, Dia de Muertos, 1989. Face paint by Abuela.
 Ines insisted on drawing the marigolds herself."`;

function vegaDirectory(name: string, owner: string): DirNode {
  return dir(
    name,
    [
      file("voice_001.wav", "", {
        binary: "audio",
        recording: "voice_001",
        size: 1_382_400,
        event: "play_voice",
        mtime: "Mar 14  2011",
        owner,
      }),
      file("session_014.log", SESSION_014, {
        flag: "read_session_log",
        grepKey: /GENERATED|confabulation|unsupported/i,
        mtime: "Oct 21  2012",
        owner,
      }),
      dir(
        "letters",
        [
          file("rosario_1998.txt", ROSARIO, { event: "read_letter", mtime: "Oct 12  1998", owner }),
          file("to_lucia_unsent.txt", LUCIA, { event: "read_letter", mtime: "Oct 31  2012", owner }),
        ],
        { owner },
      ),
      dir(
        "photographs",
        [
          file("altar_2011.jpg", ALTAR_CAPTION, { binary: "image", size: 248_311, mtime: "Nov  2  2011", owner }),
          file("lab_opening_2010.jpg", LAB_CAPTION, { binary: "image", size: 301_877, mtime: "Jun  7  2010", owner }),
          file("lucia_y_ines_1989.jpg", SISTERS_CAPTION, { binary: "image", size: 187_002, mtime: "Nov  2  1989", owner }),
        ],
        { owner },
      ),
    ],
    { owner },
  );
}

export function buildArchive(): DirNode {
  return dir("archive", [vegaDirectory("vega", "ivega")], { owner: "root" });
}

export function buildRecoveredArchive(name: string): DirNode {
  return vegaDirectory(name, "operator");
}
