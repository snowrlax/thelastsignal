# Fonts

## Current fonts

- **Terminal:** VT323 via `--font-vt323` (token `--font-terminal`)
- **Title:** League Gothic (variable) via `--font-league-gothic` (token `--font-display`)
- **Handset soft keys / status bar:** Pixelify Sans (variable) via `--font-pixelify` (token `--font-pixel`)
- **LED dot-matrix:** not a web font. A hand-drawn 5x7 character set in `components/crt/font5x7.ts`, rendered by `components/crt/DotMatrix.tsx`

## Adding or changing a font

1. Import it from `next/font/google` in `app/layout.tsx` with a `variable` option and `display: "swap"`.
2. Add the variable to the `<html>` className in `app/layout.tsx`.
3. Map it to a token in the `@theme inline` block of `app/globals.css`.

Never load fonts via `<link>` tags or CSS `@import url()`.
