# Shayari BD

A free, fully offline bilingual (English / Bangla) Bangla shayari collection web app for Bangladesh. A pocket book of short, warm shayaris to read, save, and send to friends and loved ones - in Bengali script or Roman (Banglish) transliteration.

## Problem

Bangla shayaris shared on phones usually live scattered across screenshots, chat forwards, and memory. There is no simple offline place to browse them by mood, switch between Bengali script and Roman text, keep favourites, and copy one out in a single tap. Shayari BD is that place: 48 short shayaris, organised, searchable, and ready to share - with no account, no ads, and no network use.

## Features

- **48 original shayaris** in 6 categories x 8: Love (Bhalobasha), Friendship (Bondhutto), Good Morning (Shuprovat), Birthday (Jonmodin), Motivation (Onuprerona), Rain (Brishti). Every line was written fresh for this app; nothing is quoted from any poem, song, or published shayari.
- **Shayari of the Day** - a deterministic date-seeded pick on the home hero, plus a Shuffle button for a random one.
- **Browse + search** - category filter chips and live search that matches Bengali text, Roman text, and category names.
- **Script toggle** - switch every shayari between Bengali script and Roman transliteration; the choice is remembered.
- **Favourites** - heart any shayari, view favourites only, favourites count in the stats row; saved in localStorage.
- **Copy + Share** - one-tap copy with a toast confirmation; Web Share API with clipboard fallback.
- **Favourites export / import** - export favourites as JSON; strict import validates the file shape and reports unknown, duplicate, and invalid entries; erase-all requires typing DELETE.
- **Bilingual UI** - English / Bangla interface toggle (persisted) with Bengali digits for counts in Bangla mode.
- **Offline-first** - zero network requests; all data and logic are local. Works from a file or any static host.
- **Responsive** - clean layout at desktop width and at 390px mobile with no horizontal overflow.

## Stack

- Plain HTML, CSS, and JavaScript - no frameworks, no build step, no dependencies.
- Data: `js/data.js` (48 shayaris), `js/i18n.js` (UI strings), `js/logic.js` (pure functions), `js/app.js` (rendering + storage).
- Tests: Node's built-in test runner + a headless-Chrome smoke test over CDP.
- Storage: localStorage only (favourites, script choice, UI language).

## Prerequisites

- Any modern browser (Chrome, Firefox, Edge, Safari) for use.
- Node.js 20+ only if you want to run the tests.

## Install and run

```bash
git clone https://github.com/fahad3235/shayari-bd.git
cd shayari-bd
# Open index.html directly in a browser, or serve it:
npx serve .
# or
python3 -m http.server 8000
```

No install step, no environment variables, no API keys.

## Testing

```bash
# Unit tests (Node)
node --test tests/test.js

# Headless-Chrome smoke tests (uses the cached headless_shell binary)
node tests/smoke.mjs
```

Test results: **23/23 unit tests pass, 41/41 smoke checks pass** at 1280px and 390px, 0 console errors, 0 page exceptions (2026-11-18, factory run #372). Full hand-verified expectations and results are in `TEST_RESULTS.md`.

## Deployment

Static site - deploy the repository root to GitHub Pages (Settings -> Pages -> Deploy from a branch -> `main` / `/ (root)`), Netlify Drop, or any static host. Live site: https://fahad3235.github.io/shayari-bd/

## Limitations

- All 48 shayaris are original lines written for this app. They are short, everyday messages - not classical or literary poetry, and not quotations of famous poets.
- Favourites and settings live in the browser's localStorage on one device; there is no account or sync.
- Copy uses the Clipboard API, which needs a secure context (https or localhost); on plain `file://` the app falls back gracefully.
- Search matches substrings in the stored texts; it does not do fuzzy matching or spelling correction.

## Status

Complete MVP, published and verified 2026-11-18 (factory run #372). MIT-style free use for personal sharing; the shayaris in this app are original works, please credit Shayari BD if you republish them.
