import "server-only";
import { prisma } from "@/libs/prisma";
import type { RunRecord } from "@/game/story/schema";

export interface RunStats {
  readonly total: number;
  readonly preserved: number;
  readonly lost: number;
  readonly preservedPct: number;
}

export interface RunRepository {
  create(run: RunRecord): Promise<void>;
  stats(): Promise<RunStats>;
}

export function computeStats(preserved: number, lost: number): RunStats {
  const total = preserved + lost;
  return { total, preserved, lost, preservedPct: total === 0 ? 0 : Math.round((preserved / total) * 100) };
}

export const runRepository: RunRepository = {
  async create(run) {
    await prisma.signalRun.create({ data: run });
  },
  async stats() {
    const groups = await prisma.signalRun.groupBy({ by: ["ending"], _count: { _all: true } });
    const count = (ending: string) => groups.find((group) => group.ending === ending)?._count._all ?? 0;
    return computeStats(count("preserved"), count("lost"));
  },
};

export function storageConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
