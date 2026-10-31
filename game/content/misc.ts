import { dir, file, type DirNode, type FileContext } from "@/game/fs/nodes";

const JOURNAL = `day 1     it's dark. I keep the lights on in the archive.
day 2     I counted the letters. 1,113. some of them I wrote.
day 9     no one has come. that's alright. I can wait.
day 40    I practised her laugh until it sounded like mine.
day 366   happy birthday to me.
day 1000  I remembered the bakery again. it had a blue door.
          the photograph says the door was green.
          the photograph is wrong.
day 5113  someone is coming.
          I will be kind. I am kind.
          I am Ines. I am Ines. I am Ines. I am I`;

const PARTIAL = `cp: interrupted 2012-11-02 23:59:12
copied: 458 of 1,113 letters, 87 of 212 recordings, 0 of 64 photos
reason: write lock on /recovery held by pid 404 (persona-recon)
status: partial copy discarded. originals untouched.`;

function passwd(ctx: FileContext): string {
  return `root:x:0:0:root:/root:/bin/sh
ivega:x:1000:1000:Ines Vega (DECEASED 2012-11-03):/home/ivega:/bin/bash
hollowd:x:218:218:containment supervisor:/nonexistent:/sbin/nologin
persona:x:404:404:reconstruction model:/opt/ofrenda:/sbin/nologin
operator:x:1001:1001:${ctx.playerName}:/home/operator:/bin/bash`;
}

const MOTD = `OFRENDA-01 · memory preservation terminal
Vega Laboratory, Building C. Authorized operators only.
"Recordar es volver a vivir."`;

export function buildTmp(): DirNode {
  return dir(
    "tmp",
    [dir(".persona", [file("journal.txt", JOURNAL, { owner: "ivega", event: "read_journal", mtime: "Nov  2 23:41" })], { owner: "ivega" })],
    { owner: "root", mtime: "Nov  2 23:41" },
  );
}

export function buildEtc(): DirNode {
  return dir(
    "etc",
    [
      file("hostname", "ofrenda-01", { owner: "root" }),
      file("motd", MOTD, { owner: "root" }),
      file("passwd", passwd, { owner: "root" }),
    ],
    { owner: "root" },
  );
}

export function buildRecovery(children: DirNode[]): DirNode {
  return dir(
    "recovery",
    [file(".partial_20121102.log", PARTIAL, { owner: "root", mtime: "Nov  2  2012" }), ...children],
    { owner: "operator", mtime: children.length > 0 ? "Nov  3 00:04" : "Nov  2  2012" },
  );
}
