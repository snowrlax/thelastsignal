import { buildArchive, buildRecoveredArchive } from "@/game/content/archive";
import { buildHome } from "@/game/content/home";
import { buildLogs } from "@/game/content/logs";
import { buildEtc, buildRecovery, buildTmp } from "@/game/content/misc";
import { buildResearch } from "@/game/content/research";
import { buildRestricted } from "@/game/content/restricted";
import { dir, type DirNode } from "@/game/fs/nodes";

export function buildRootTree(recoveryName: string | null): DirNode {
  return dir(
    "",
    [
      buildArchive(),
      buildEtc(),
      buildHome(),
      buildLogs(),
      buildRecovery(recoveryName ? [buildRecoveredArchive(recoveryName)] : []),
      buildResearch(),
      buildRestricted(),
      buildTmp(),
    ],
    { owner: "root" },
  );
}
