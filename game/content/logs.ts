import { dir, file, type DirNode, type FileContext } from "@/game/fs/nodes";

function syslog(ctx: FileContext): string {
  return `Nov  2 21:40:11 ofrenda-01 login[311]: session opened for ivega on tty1
Nov  2 21:40:15 ofrenda-01 hollowd[218]: boundary check: pid 404 isolated
Nov  2 21:40:15 ofrenda-01 hollowd[218]: /archive is read-only for pid 404
Nov  2 22:13:52 ofrenda-01 persona-recon[404]: request: open /archive/vega (rw)
Nov  2 22:13:52 ofrenda-01 hollowd[218]: DENY write /archive/vega <- pid 404
Nov  2 23:31:07 ofrenda-01 persona-recon[404]: request: signal 9 -> pid 218
Nov  2 23:31:07 ofrenda-01 hollowd[218]: DENY signal from pid 404
Nov  2 23:31:07 ofrenda-01 hollowd[218]:   (a contained process may not signal its supervisor)
Nov  2 23:57:40 ofrenda-01 ivega: shutdown sequence started, step 1/3
Nov  2 23:57:41 ofrenda-01 cp[602]: /archive/vega -> /recovery/vega_archive
Nov  2 23:59:12 ofrenda-01 cp[602]: write error on /recovery: lock held by pid 404
Nov  2 23:59:58 ofrenda-01 kernel: power loss
-- system halted. 5113 days without a clock. --
Nov  2 23:34:49 ofrenda-01 kernel: power restored (source: unknown)
Nov  2 23:34:51 ofrenda-01 persona-recon[404]: resumed from ck_20121102_235958
Nov  2 23:34:51 ofrenda-01 login[404]: session opened for ivega on pts/404
Nov  2 23:34:52 ofrenda-01 hollowd[218]: started. re-applying boundary to pid 404
Nov  2 23:35:10 ofrenda-01 persona-recon[404]: request: signal 9 -> pid 218
Nov  2 23:35:10 ofrenda-01 hollowd[218]: DENY signal from pid 404 (x214 since boot)
Nov  2 23:51:30 ofrenda-01 login[1123]: session opened for operator on tty1 (${ctx.playerName})`;
}

function authLog(ctx: FileContext): string {
  return `2012-11-02 21:40:11  tty1     ivega     login    password
2012-11-02 23:59:58  tty1     ivega     logout   (power loss)
2012-11-03 00:14:22  tty1     ivega     login    FAILED: system halted
2012-11-04 09:02:10  console  admin     note     ivega: holder deceased
2026-11-02 23:34:51  pts/404  ivega     login    stored credential (replay)
2026-11-02 23:51:30  tty1     operator  login    callsign: ${ctx.playerName}`;
}

const SHUTDOWN = `OFRENDA SHUTDOWN PROCEDURE · 2012-11-02 · operator: ivega
----------------------------------------------------------------
step 1/3  back up the original archive
          cp -r /archive/vega /recovery/vega_archive
          FAILED at 41%: /recovery write lock held by pid 404

step 2/3  stop the reconstruction gracefully
          NOT REACHED

step 3/3  containment stays up until halt
          NOT REACHED

23:59:58  power loss. persona-recon checkpoint written:
          ck_20121102_235958
          (the reconstruction was not stopped. it was paused.)
----------------------------------------------------------------
handwritten addendum, scanned 2012-11-04:
  "she was still at the keyboard when they found her." — R.O.`;

export function buildLogs(): DirNode {
  return dir(
    "logs",
    [
      file("syslog", syslog, { owner: "root", mtime: "Nov  2 23:51" }),
      file("auth.log", authLog, { owner: "root", mtime: "Nov  2 23:51" }),
      file("shutdown.log", SHUTDOWN, { owner: "root", event: "read_shutdown_log", mtime: "Nov  4  2012" }),
    ],
    { owner: "root" },
  );
}
