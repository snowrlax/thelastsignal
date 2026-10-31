# CLAUDE.md

Guidance for Claude Code when working in this repository.

@AGENTS.md

## What this is

THE LAST SIGNAL: a browser horror game played in a simulated Linux terminal on a CRT. The spec is the PRD the game was built from; `README.md` summarises play and architecture.

## Commands

```bash
npm run dev            # dev server (http://localhost:3000); ?timescale=N speeds up game time in dev
npm run build          # production build
npm test               # Vitest: unit, integration, component
npm run test:coverage  # coverage thresholds enforced (80/80/80, branches 75)
npm run test:e2e       # Playwright (starts its own dev server on :3210, or set PLAYWRIGHT_BASE_URL)
npm run typecheck && npm run lint
npm run db:push        # create/update the signal_runs table from prisma/schema.prisma
```

## Architecture rules

- `game/` is a **pure, deterministic engine**. Functions take a `GameState` and return a new one, never mutating. No React, DOM, network or `Math.random` for outcomes. All gameplay rules (files, processes, flags, timers, endings) live here and are unit tested.
- **The LLM must never affect game state.** `/api/dialogue` only voices a story beat the engine already emitted. Lines that carry instructions (commands, PIDs) are authored, not generated (`game/story/triggers.ts`, no `ai` hint). Every model reply passes `game/story/sanitize.ts`; every trigger has authored fallback lines.
- Story text lives in `game/content/*` (files) and `game/story/triggers.ts` (dialogue). Evidence flags are attached to files (`flag`, `grepKey`) and processes.
- UI lives in `components/` (crt, screens, terminal); client state is the zustand store in `hooks/useGameStore.ts`. Side effects (printing with delays, message delivery, ending sequences, the game loop) are hooks.
- Sound is synthesized in `libs/audio.ts` (Web Audio). It must never throw into the game.

## Stack

- Next.js 16.2 (App Router), React 19, TypeScript strict, Tailwind CSS 4 (CSS-configured; most styling is hand-written CRT CSS in `app/globals.css`)
- Fonts via `next/font/google`: VT323 (terminal), League Gothic (title), Pixelify Sans (handset soft keys); the LED dot-matrix is a hand-drawn 5x7 font in `components/crt/font5x7.ts`
- zustand (client state), zod (API validation), Prisma 5 + Postgres (anonymous run stats), open-weight dialogue via a provider chain in `libs/llm/` (Ollama Cloud, DigitalOcean serverless inference), Sentry agent tracing (`libs/tracing.ts`, `instrumentation.ts`)

## Next.js 16

This is not the Next.js in your training data. Read `node_modules/next/dist/docs/01-app/` before using any Next.js API.

## Secrets

`.env.local` only (see `.env.example` for the full list): `OLLAMA_*`, `DIGITALOCEAN_*`, `SENTRY_*`, `DATABASE_URL`. Production env vars are declared in `render.yaml`. Never commit them, never expose them to client code.
