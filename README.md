# THE LAST SIGNAL

*A short interactive psychological horror experience.*

November 2, 2026. You are the night technician sent to recover one last archive from a sealed laboratory. The old research computer, **OFRENDA**, should not be running. A message is already waiting.

Someone on the other end says she is Dr. Inés Vega, the scientist who built the machine and died fourteen years ago tonight. A process called **HOLLOW** says not to trust her. You have a terminal, a handful of Linux commands, and a containment window that is closing.

One command decides everything. Play it to find out which.

- **Length:** 10–15 minutes
- **Endings:** two (*Archive Preserved* and *Signal Lost*)
- **Platform:** any modern desktop browser (phones work, keyboards help)

## How to play

Type commands at the prompt. `help` lists them, `hint` nudges you, and **F1** opens the manual (the clock holds while it is open).

| You'll use | For |
|---|---|
| `ls -la`, `cd`, `pwd` | moving around (hidden files start with `.`) |
| `cat`, `play`, `grep`, `find` | reading notes and logs, listening to recordings, searching |
| `ps aux`, `ps -fp <pid>`, `top`, `dmesg` | seeing what is really running |
| `cp -r`, `kill -TERM`, `kill -9` | acting. Choose carefully. |
| `reply <message>` | talking back to the session on `pts/404` |

The timer pauses while you read long files, play recordings, or open the manual. Mistyped commands never cost time. Reduced-pressure mode (1.5× timers) is on the identification screen.

## Running it

```bash
npm install                  # also generates the Prisma client
cp .env.example .env.local   # optional: add OLLAMA_API_KEY and DATABASE_URL
npm run db:push              # optional: creates the anonymous stats table
npm run dev                  # http://localhost:3000
```

Both integrations are optional. Without `OLLAMA_API_KEY` every line is authored dialogue. Without `DATABASE_URL` the ending screen simply skips the "operators who preserved the archive" figure.

| Variable | Purpose |
|---|---|
| `OLLAMA_API_KEY` | Ollama Cloud key for M_VEGA and HOLLOW's live dialogue |
| `OLLAMA_MODEL` / `OLLAMA_FALLBACK_MODEL` | open-weight models (default `gemma4:31b`, then `gpt-oss:20b`) |
| `DATABASE_URL` | Postgres for anonymous run outcomes (no names or personal data are stored) |

## How it is built

```
game/          Pure, deterministic engine: no React, no network, no randomness in outcomes
  engine.ts      runCommand(state, input) and tick(state, ms) → new state + output + story events
  commands/      the shell: ls, cd, cat, grep, find, ps, top, kill, cp, play, reply, ...
  content/       every file on the machine (the story lives here)
  fs/            virtual filesystem, paths, symlinks
  timer.ts       phase windows, warnings, grace periods, reading holds
  phases.ts      evidence → phase transitions
  story/         triggers + authored dialogue, director (cooldowns), LLM prompts, sanitizer, schemas
components/
  crt/           monitor, pillow-shaped glass, LED dot-matrix font, handset status icons
  screens/       landing → identify → cinematic → boot → terminal → ending
  terminal/      status bar, scrollback, message windows, prompt, side panel, manual
hooks/           zustand store around the engine; printer, dialogue, game loop, ending sequence
libs/            Ollama client, Prisma, rate limiting, Web Audio synth, storage, session report
app/api/         /api/dialogue (character lines), /api/runs (anonymous stats), /api (health)
```

**The model never touches game state.** The engine owns every file, process, timer, flag and ending. The model is only asked to *voice* a story beat that the engine already decided. The client sends an event id and a fixed set of facts, not a prompt. The server builds the prompt from canon, enforces a knowledge gate so the twist cannot leak early, and sanitizes the reply (length, no out-of-character text, no invented numbers or commands). If the model is slow, unavailable or off-script, the authored line is used and nothing waits on it.

Everything you hear is synthesized live with the Web Audio API: the CRT hum, the soft typewriter strikes and carriage returns as the opening types itself out, key clicks, drive seeks, radio static, warning tones. There are no audio files.

## Deploying (Vercel)

1. On vercel.com choose **Add New → Project** and import this GitHub repository. Vercel detects Next.js; keep the default build settings. `npm install` runs `prisma generate` for you.
2. Under **Settings → Environment Variables**, add `OLLAMA_API_KEY` and `DATABASE_URL` (and the optional model variables) for Production and Preview.
3. Deploy. Every push to `main` then deploys to production, and every other branch gets a preview URL.

For Supabase on serverless functions, prefer the **transaction pooler** connection string (port `6543`) with `?pgbouncer=true&connection_limit=1` appended. The stats table only needs to be created once (`npm run db:push`). Placing the functions in the same region as the database (**Settings → Functions → Region**) keeps the stats calls fast. Rate limits are kept in memory per function instance, which is enough for a game like this but not a hard global cap.

From a terminal instead: `npx vercel link`, `npx vercel env add OLLAMA_API_KEY` (repeat for each variable), then `npx vercel --prod`.

## Tests

```bash
npm test               # unit + integration + component (Vitest)
npm run test:coverage  # with coverage (thresholds: 80% lines/functions/statements, 75% branches)
npm run test:e2e       # Playwright: both endings, the timeout path, onboarding, the terminal
npm run typecheck && npm run lint
```

End-to-end tests stub the model and the stats endpoint, so they are deterministic and never write to the database. In development, `?timescale=N` speeds up game time (production ignores it).

## Credits

Story, design and code for Día de los Muertos 2026. *Some memories are meant to be kept. Not recreated.*
