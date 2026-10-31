# File Placement

## Where code goes

- **Game rules, story content, engine state** → `game/` (pure TypeScript, no React, no I/O)
- **Page or layout** → `app/`
- **API route handler** → `app/api/<name>/route.ts`
- **UI component** → `components/<area>/<ComponentName>.tsx` (`crt/`, `screens/`, `terminal/`, `game/`)
- **Library/service helper** → `libs/<service>.ts` (Ollama, Prisma, audio, storage, rate limiting)
- **Custom React hook / client store** → `hooks/use<Name>.ts`
- **Tests** → `tests/unit`, `tests/integration`, `tests/components`, `tests/e2e`
- **Secret/credential** → `.env.local` (update `.env.example` when adding new vars)

## Wrong placements that must be caught

- Gameplay rules or state transitions in components or hooks (they belong in `game/`)
- LLM output written into game state anywhere
- API logic in `libs/` or `components/`
- Secrets in source files
