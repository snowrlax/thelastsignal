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
npm run voice:render         # optional: pre-renders Ines's recordings with ElevenLabs (commit the mp3s)
npm run dev                  # http://localhost:3000
```

Every integration is optional and switches on only when its key is set. With no keys at all, every line is authored dialogue and the game is still completable from start to finish. Without `DATABASE_URL`, the ending screen skips the "operators who preserved the archive" figure.

| Variable | Purpose |
|---|---|
| `OLLAMA_API_KEY` | Ollama Cloud key for M_VEGA and HOLLOW's live dialogue |
| `OLLAMA_MODEL` / `OLLAMA_FALLBACK_MODEL` | open-weight models (default `gemma4:31b`, then `gpt-oss:20b`). Set `OLLAMA_HOST=http://localhost:11434` to use a local Ollama |
| `DIGITALOCEAN_INFERENCE_KEY` | DigitalOcean serverless inference model access key: the same Gemma 4 weights on a second provider (`DIGITALOCEAN_MODEL`, default `gemma-4-31B-it`) |
| `DIALOGUE_PRIMARY_PROVIDER` | `ollama` (default) or `digitalocean` to choose which provider is tried first |
| `ELEVENLABS_API_KEY` | ElevenLabs voices for M_VEGA's live lines and Ines's recordings (`ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, `VOICE_DAILY_LINE_LIMIT` optional) |
| `SENTRY_DSN` | Sentry agent tracing for the dialogue pipeline. `SENTRY_RECORD_DIALOGUE=true` also attaches prompts and lines (off by default) |
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
libs/            model provider chain (llm/), Sentry agent tracing, Prisma, rate limiting, Web Audio synth, storage
app/api/         /api/dialogue (character lines), /api/runs (anonymous stats), /api (health)
```

**The model never touches game state.** The engine owns every file, process, timer, flag and ending. The model is only asked to *voice* a story beat that the engine already decided. The client sends an event id and a fixed set of facts, not a prompt. The server builds the prompt from canon, enforces a knowledge gate so the twist cannot leak early, and sanitizes the reply (length, no out-of-character text, no invented numbers or commands). If the model is slow, unavailable or off-script, the authored line is used and nothing waits on it.

Lines come from a chain of open-weight models that share one 4.5-second budget: **Gemma 4 31B on Ollama Cloud**, then **the same Gemma 4 weights on DigitalOcean serverless inference**, then **gpt-oss-20b**. Every attempt except the last is capped, so one hung provider can't use up the whole budget. Each line is traced in **Sentry** as an `invoke_agent` span (M_VEGA or HOLLOW), with one `gen_ai.chat` span per attempt (provider, model, tokens, latency, failure code) and a `gen_ai.decide` span for the sanitizer's verdict.

Every sound effect is synthesized live with the Web Audio API: the CRT hum, the soft typewriter strikes and carriage returns as the opening types itself out, key clicks, drive seeks, radio static, warning tones. There are no sound-effect files.

**Voices come from ElevenLabs.** Dr. Ines Vega's authentic recordings are pre-rendered with Eleven v3 (`npm run voice:render`), where stage directions such as *(laughs)* become audio tags. They play off a hissing, wow-and-flutter "tape" while the transcript scrolls in sync with ElevenLabs' character timestamps. M_VEGA speaks every message live through the terminal's speaker with Flash v2.5. It's the same voice with the stability turned up and the style turned off, so it sounds slightly too steady: a voiceprint "99.1% synthesized from source." `/api/voice` only speaks lines the server wrote (model lines signed by `/api/dialogue`, or authored lines with nothing but the player's callsign filled in), and it's rate-limited per client, per minute, per hour and per day, so it can't be used as a free text-to-speech proxy. HOLLOW stays text: it's a system process.

## Deploying (Render)

The repo includes a Render Blueprint ([`render.yaml`](render.yaml)).

1. On render.com choose **New → Blueprint** and select this repository.
2. Render asks for each secret once: `OLLAMA_API_KEY`, `DIGITALOCEAN_INFERENCE_KEY`, `ELEVENLABS_API_KEY`, `SENTRY_DSN`, `DATABASE_URL` and `SITE_URL`. Leave any of them empty to switch that integration off. `VOICE_SIGNING_SECRET` is generated for you.
3. Apply. Render builds with `npm ci && npm run build`, health-checks `/api`, and redeploys `main` only after the GitHub Actions checks pass (`autoDeployTrigger: checksPass`).

The service runs as one long-lived Node process, so the in-memory rate limits act as a real global cap, and the Supabase session pooler string (port `5432`) works as is. The stats table only needs to be created once (`npm run db:push`). To use a custom domain such as a `.tech` one, add it under **Settings → Custom Domains**, point a CNAME at the `onrender.com` host, and set `SITE_URL` to it so social previews use it.

Vercel also works: import the repo and add the same environment variables. On serverless functions, prefer the Supabase transaction pooler (port `6543`) with `?pgbouncer=true&connection_limit=1`.

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
