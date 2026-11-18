# Shayari BD - Test Results

Run #369, 12:00 slot, 2026-11-18. All figures below are real, recorded from actual runs.

## 1. Hand-verified expectations table

These values were computed by hand BEFORE the tests were written; the tests assert exactly these values.

### Daily pick - `dailyIndex(year, month, day) = (year*365 + month*31 + day) % 48`

| Date | Hand computation | Index | Shayari id |
| --- | --- | --- | --- |
| 2026-11-18 | 2026*365=739490; 11*31=341; +18 = 739849; 48*15413=739824; 739849-739824 = **25** | 25 | b02 |
| 2026-01-01 | 739490 + 31 + 1 = 739522; 48*15406=739488; 739522-739488 = **34** | 34 | m03 |
| 2026-11-19 | 739850; 739850-739824 = **26** | 26 | b03 |

### Search counts (48 shayaris, search matches Bengali text, Roman text, category EN/BN/Roman)

| Query | Hand reasoning | Expected |
| --- | --- | --- |
| (Bengali "brishti") | l04 line 1 + all 8 rain shayaris contain the word | 9 |
| `brishti` (Roman) | same 9 items via Roman text (category name adds nothing new) | 9 |
| `shuprovat` | category Roman name matches all 8 morning shayaris | 8 |
| `bhalobasha` | 6 love items by Roman text + 2 more love items by category name = 8 love, plus s08, b01, b07 | 11 |
| (Bengali "bhalobasha") | same 11 items | 11 |
| `bondhutto` | category Roman name matches all 8 friend shayaris | 8 |
| `jonmodin` | category Roman name matches all 8 birthday shayaris | 8 |
| `chand` | l02 ("Chand utheche...") and b05 ("chander moto") | 2 |
| (Bengali "hasi") | l01, l05, f02, f04, f07, s01, s07, b05, b06, b07 | 10 |
| `zzzqqq` | no match anywhere | 0 |
| (empty) | empty query returns everything | 48 |

### Favourites

| Case | Expected |
| --- | --- |
| `toggleFav(['l01'], 'r03')` | `['l01', 'r03']`, input array unmutated |
| `toggleFav(['l01','r03'], 'l01')` | `['r03']` |
| `favShayaris(all, ['r03','l01'])` | `['l01','r03']` (bank order) |

### Bengali digits

| Input | Expected |
| --- | --- |
| `toBengaliDigits('48')` | Bengali digits for 48 |
| `toBengaliDigits('2026')` | Bengali digits for 2026 |
| `formatNumber(48, 'bn')` | Bengali digits for 48 |
| `formatNumber(48, 'en')` | `48` |

### Copy-text format

| Case | Expected |
| --- | --- |
| `copyText(b02, 'roman')` | `Jonmodiner onek onek shubhechha,\nTomar shopnogulo shotti hok.\nCake kato, mombati jalao,\nAjker dinta shudhu tomar.\n\n- Shayari BD` |

### Import validation

| Input | Expected |
| --- | --- |
| `{not json` | rejected `badJson` |
| `{"a":1}` | rejected `badShape` |
| `{"favourites":"nope"}` | rejected `badShape` |
| favourites `['l01','nope','l01',42,'r03']` | added `['l01','r03']`; rejected unknownId (index 1), duplicateId (index 2), badEntry (index 3) |
| bare array `['f02','m05']` | added both, 0 rejected |
| export of `['l01','r03','b02']` then import | round-trip restores exactly those 3 ids |

## 2. Node unit tests

Command: `node --test tests/test.js`

**Result: 23 tests, 23 passed, 0 failed.**

Coverage: data validity (48 items, 6 x 8, unique ids/texts, 2-4 lines each), validation error detection (duplicate id, missing Roman, unknown category, 1-line shayari), daily-pick determinism for the 3 fixed dates above plus a full-year in-range sweep, random-index exclusion, all search counts above, category filter, favourites store, copy-text format, import rejection cases, export/import round-trip, erase guard, Bengali digits, constants.

## 3. Headless-Chrome smoke test

Command: `node tests/smoke.mjs` (cached `chromium_headless_shell-1187`, page over `file://`, fresh profile)

**Result: 41 checks, 41 passed, 0 failed - at 1280px and 390px.**

- Load: title, `window.ShayariCore` / `window.ShayariData` / `window.__app` present, header text, 48 cards, stats 48 / 0 / 6, 8 filter chips.
- Hero: daily shayari shown for the run date - **b02** (2026-11-18), matching `dailyShayari` computed in-page; shuffle changes the hero text.
- Search + filter: `brishti` -> 9 cards, Bengali rain word -> 9 cards, `shuprovat` -> 8 cards, nonsense -> empty state shown, love chip -> 8 cards, rain chip -> 8 cards.
- Script toggle: hero switches to the exact Roman text of the same shayari (verified pure ASCII), then back to Bengali.
- Favourites: first card favourited -> stat 1; favourites-only view -> 1 card; **persists across reload** (stat still 1, view still 1 card); unfavourite -> stat 0 and the "no favourites yet" empty state appears.
- Copy: click shows a toast; `copyText(b02, 'roman')` matches the hand-computed format exactly.
- Export/import/erase: export JSON builds 3 favourites; app import round-trip -> 2 added / 0 rejected, stat 2; `{"a":1}` rejected with message "Import failed: not a favourites file."; unknown-id import keeps the valid id and reports `unknownId`; erase with `delete` refused; erase with `DELETE` works, stat back to 0.
- Language toggle: heading switches to the Bengali app title; stat total shows Bengali digits for 48; back to English.
- Responsive: `document.documentElement.scrollWidth` **390 at 390px** and **1280 at 1280px** - no horizontal overflow at either width.
- **Console errors: 0. Page exceptions: 0.**

## 4. ASCII check

Command: `grep -rP '[^\x00-\x7F]' .` (run from the build directory)

**Result: no output - zero non-ASCII bytes in any committed file.** Bengali text exists only as `\uXXXX` escapes in `js/data.js` and `js/i18n.js`.

## 5. Repairs made

1. **Raw Bengali digits in `js/logic.js`** - the `BN_DIGITS` map was first written with literal Bengali digits (copied from the mirror project's style). The ASCII grep caught it; replaced with `\u09e6`-`\u09ef` escapes. Unit tests re-run: 23/23 pass.
2. **Em dashes in `index.html`** - two fallback strings contained a literal em dash; replaced with `-`. ASCII grep then clean.
3. **Raw Bengali literals in `tests/test.js`** - an early draft used literal Bengali words in a sanity check and in two assertions; all replaced with `\uXXXX` escapes before the first test run.
4. **Em dash in `tests/smoke.mjs`** - the failure-formatting line contained a literal em dash; replaced with `-`.
5. **Non-ASCII in `README.md` and `TEST_RESULTS.md`** - the docs themselves contained em dashes, arrows, and Bengali words/digits; all replaced with ASCII equivalents ("Bangla", "48", "->", "-"). Final grep over the whole directory is clean.

No app bugs were found by the tests; no test expectation had to be corrected after writing (all hand-computed values matched on first run).
