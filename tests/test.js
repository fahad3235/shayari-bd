'use strict';
/**
 * Shayari BD - unit tests for js/logic.js + js/data.js (pure logic, no DOM).
 * Hand-computed expected values (verified by hand before writing):
 *   dailyIndex(2026, 11, 18): 2026*365 + 11*31 + 18 = 739849; 739849 % 48 = 25 -> b02
 *     (48*15413 = 739824; 739849 - 739824 = 25)
 *   dailyIndex(2026, 1, 1): 2026*365 + 1*31 + 1 = 739522; 739522 % 48 = 34 -> m03
 *     (48*15406 = 739488; 739522 - 739488 = 34)
 *   dailyIndex(2026, 11, 19): 739850 % 48 = 26 -> b03
 *   search "brishti" (Bengali) = 9: l04 + r01..r08 (l04 line 1 is "Brishti bheja...";
 *     every rain shayari contains the word; the category name match adds nothing new)
 *   search "brishti" (Roman) = 9: same 9 items (roman text + category roman name)
 *   search "shuprovat" = 8: all morning shayaris via the category Roman name
 *   search "bhalobasha" = 11: all 8 love shayaris (6 by roman text, 2 more by the
 *     category Roman name) + s08, b01, b07 which contain the word in their text
 *   search "bhalobasha" (Bengali) = 11: same 11 items
 *   search "bondhutto" = 8: all friend shayaris via the category Roman name
 *   search "jonmodin" = 8: all birthday shayaris via the category Roman name
 *   search "chand" = 2: l02 ("Chand utheche...") and b05 ("chander moto")
 *   search "hasi" (Bengali) = 10: l01, l05, f02, f04, f07, s01, s07, b05, b06, b07
 *   search "zzzqqq" = 0; search "" = 48
 *   copyText(b02, 'roman') = the 4 roman lines + "\n\n- Shayari BD"
 *   toBengaliDigits('48') = '48' in Bengali digits; toBengaliDigits('2026') = '2026' likewise
 *   favourites: toggle adds then removes; round-trip export->import restores ids;
 *   import rejects bad JSON, wrong shape, unknown ids, duplicate ids.
 * Bengali literals below are \uXXXX escapes so this file stays pure ASCII.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/logic.js');
const Data = require('../js/data.js');

const BN_BRISHTI_ESC = '\u09ac\u09c3\u09b7\u09cd\u099f\u09bf';
const BN_BHALOBASHA_ESC = '\u09ad\u09be\u09b2\u09cb\u09ac\u09be\u09b8\u09be';
const BN_HASI_ESC = '\u09b9\u09be\u09b8\u09bf';
const BN_48 = '\u09ea\u09ee';
const BN_2026 = '\u09e8\u09e6\u09e8\u09ec';

// sanity: the escapes really are the Bengali words used in the data
test('escapes sanity: Bengali literals decode to the expected code points', () => {
  assert.equal(BN_BRISHTI_ESC.length, 6);
  assert.equal(BN_BRISHTI_ESC.codePointAt(0).toString(16), '9ac');
  assert.equal(BN_48.length, 2);
  assert.ok(Data.SHAYARIS.some((s) => s.bn.includes(BN_BRISHTI_ESC)));
  assert.ok(Data.SHAYARIS.some((s) => s.bn.includes(BN_BHALOBASHA_ESC)));
});

// ---------- data validity ----------
test('shayari bank: 48 items, 6 categories x 8, all valid', () => {
  assert.equal(Data.SHAYARIS.length, 48);
  assert.equal(Data.CATEGORIES.length, 6);
  assert.deepEqual(Core.validateShayariData(Data.SHAYARIS, Data.CATEGORIES), []);
  for (const c of Data.CATEGORIES) {
    assert.equal(Data.SHAYARIS.filter((s) => s.cat === c.id).length, 8, c.id);
  }
});

test('shayari bank: unique ids, unique Bengali and Roman texts, 2-4 lines each', () => {
  const ids = new Set(Data.SHAYARIS.map((s) => s.id));
  assert.equal(ids.size, 48);
  assert.equal(new Set(Data.SHAYARIS.map((s) => s.bn)).size, 48);
  assert.equal(new Set(Data.SHAYARIS.map((s) => s.roman)).size, 48);
  for (const s of Data.SHAYARIS) {
    const bnLines = s.bn.split('\n').filter(Boolean);
    const romanLines = s.roman.split('\n').filter(Boolean);
    assert.ok(bnLines.length >= 2 && bnLines.length <= 4, s.id);
    assert.equal(romanLines.length, bnLines.length, s.id);
    assert.ok(s.bn.trim().length > 0 && s.roman.trim().length > 0);
  }
});

test('validateShayariData: duplicate id, missing roman, unknown category detected', () => {
  const dup = Data.SHAYARIS.slice(0, 2);
  dup[1] = { ...dup[1], id: dup[0].id };
  assert.ok(Core.validateShayariData(dup, Data.CATEGORIES).some((e) => e.startsWith('dupId:')));
  const noRoman = [{ id: 'x1', cat: 'love', bn: '\u09b9\u09be\u0987\u0964', roman: '' }];
  assert.ok(Core.validateShayariData(noRoman, Data.CATEGORIES).includes('missingRoman:x1'));
  const badCat = [{ id: 'x2', cat: 'nope', bn: '\u09b9\u09be\u0987\u0964', roman: 'Hi.' }];
  assert.ok(Core.validateShayariData(badCat, Data.CATEGORIES).includes('unknownCat:x2'));
  const oneLine = [{ id: 'x3', cat: 'love', bn: '\u098f\u0995 \u09b2\u09be\u0987\u09a8\u0964', roman: 'One line.' }];
  assert.ok(Core.validateShayariData(oneLine, Data.CATEGORIES).includes('lineCount:x3'));
  assert.deepEqual(Core.validateShayariData([], Data.CATEGORIES), ['noShayaris']);
});

// ---------- daily pick ----------
test('dailyIndex: hand-computed values for 3 fixed dates', () => {
  assert.equal(Core.dailyIndex(2026, 11, 18), 25);
  assert.equal(Core.dailyIndex(2026, 1, 1), 34);
  assert.equal(Core.dailyIndex(2026, 11, 19), 26);
});

test('dailyShayari: deterministic, in range, changes across dates', () => {
  const a = Core.dailyShayari(Data.SHAYARIS, new Date(2026, 10, 18));
  const b = Core.dailyShayari(Data.SHAYARIS, new Date(2026, 10, 18));
  assert.equal(a.id, 'b02');
  assert.deepEqual(a, b);
  assert.equal(Core.dailyShayari(Data.SHAYARIS, new Date(2026, 0, 1)).id, 'm03');
  assert.equal(Core.dailyShayari(Data.SHAYARIS, new Date(2026, 10, 19)).id, 'b03');
  // every day of a year maps inside the bank
  for (let m = 0; m < 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const item = Core.dailyShayari(Data.SHAYARIS, new Date(2026, m, d));
      assert.ok(Data.SHAYARIS.includes(item));
    }
  }
});

test('randomIndex: stays in range and avoids the excluded index', () => {
  for (let i = 0; i < 50; i++) {
    const idx = Core.randomIndex(25, () => 25 / 48); // rng lands exactly on 25
    assert.equal(idx, 26);
  }
  const idx = Core.randomIndex(25, () => 0.5);
  assert.equal(idx, 24);
});

// ---------- search ----------
test('searchShayari: Bengali and Roman rain queries both find 9', () => {
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, BN_BRISHTI_ESC).length, 9);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'brishti').length, 9);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'Brishti').length, 9);
  const ids = Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'brishti').map((s) => s.id);
  assert.deepEqual(ids, ['l04', 'r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08']);
});

test('searchShayari: category-name queries match the whole category', () => {
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'shuprovat').length, 8);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'bondhutto').length, 8);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'jonmodin').length, 8);
});

test('searchShayari: bhalobasha finds 11 in both scripts', () => {
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'bhalobasha').length, 11);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, BN_BHALOBASHA_ESC).length, 11);
  const ids = Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'bhalobasha').map((s) => s.id);
  assert.deepEqual(ids, ['l01', 'l02', 'l03', 'l04', 'l05', 'l06', 'l07', 'l08', 's08', 'b01', 'b07']);
});

test('searchShayari: chand finds 2, hasi finds 10', () => {
  assert.deepEqual(
    Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'chand').map((s) => s.id),
    ['l02', 'b05']);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, BN_HASI_ESC).length, 10);
});

test('searchShayari: empty query returns all, nonsense returns none, whitespace trimmed', () => {
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, '').length, 48);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, '   ').length, 48);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, 'zzzqqq').length, 0);
  assert.equal(Core.searchShayaris(Data.SHAYARIS, Data.CATEGORIES, '  brishti  ').length, 9);
});

// ---------- category filter ----------
test('filterByCategory: all returns 48, each category returns 8', () => {
  assert.equal(Core.filterByCategory(Data.SHAYARIS, 'all').length, 48);
  assert.equal(Core.filterByCategory(Data.SHAYARIS, 'love').length, 8);
  assert.equal(Core.filterByCategory(Data.SHAYARIS, 'rain').length, 8);
  assert.equal(Core.filterByCategory(Data.SHAYARIS, 'nope').length, 0);
});

// ---------- favourites ----------
test('toggleFav: adds then removes, does not mutate the input array', () => {
  const start = ['l01'];
  const added = Core.toggleFav(start, 'r03');
  assert.deepEqual(added, ['l01', 'r03']);
  assert.deepEqual(start, ['l01']);
  const removed = Core.toggleFav(added, 'l01');
  assert.deepEqual(removed, ['r03']);
  assert.equal(Core.isFav(removed, 'r03'), true);
  assert.equal(Core.isFav(removed, 'l01'), false);
});

test('favShayaris: returns only the favourited items, in bank order', () => {
  const favs = Core.favShayaris(Data.SHAYARIS, ['r03', 'l01']);
  assert.deepEqual(favs.map((s) => s.id), ['l01', 'r03']);
  assert.deepEqual(Core.favShayaris(Data.SHAYARIS, []), []);
});

// ---------- copy text ----------
test('copyText: roman b02 lines plus attribution', () => {
  const b02 = Data.SHAYARIS.find((s) => s.id === 'b02');
  assert.equal(
    Core.copyText(b02, 'roman'),
    'Jonmodiner onek onek shubhechha,\nTomar shopnogulo shotti hok.\nCake kato, mombati jalao,\nAjker dinta shudhu tomar.\n\n- Shayari BD');
  assert.ok(Core.copyText(b02, 'bn').startsWith('\u099c\u09a8\u09cd\u09ae\u09a6\u09bf\u09a8\u09c7\u09b0 \u0985\u09a8\u09c7\u0995 \u0985\u09a8\u09c7\u0995 \u09b6\u09c1\u09ad\u09c7\u099a\u09cd\u099b\u09be,'));
  assert.ok(Core.copyText(b02, 'bn').endsWith('\n\n- Shayari BD'));
});

// ---------- export / import ----------
test('validateImport: bad JSON and wrong shape rejected', () => {
  assert.deepEqual(Core.validateImport('{not json', []).rejected, [{ index: -1, reason: 'badJson' }]);
  assert.deepEqual(Core.validateImport('{"a":1}', []).rejected, [{ index: -1, reason: 'badShape' }]);
  assert.deepEqual(Core.validateImport('"hello"', []).rejected, [{ index: -1, reason: 'badShape' }]);
  assert.deepEqual(Core.validateImport('{"favourites":"nope"}', []).rejected, [{ index: -1, reason: 'badShape' }]);
});

test('validateImport: unknown ids, duplicates and bad entries rejected individually', () => {
  const ids = Data.SHAYARIS.map((s) => s.id);
  const res = Core.validateImport(JSON.stringify({
    app: 'shayari-bd', version: 1, exportedAt: '2026-11-18T00:00:00.000Z',
    favourites: ['l01', 'nope', 'l01', 42, 'r03'],
  }), ids);
  assert.deepEqual(res.added, ['l01', 'r03']);
  assert.deepEqual(res.rejected, [
    { index: 1, reason: 'unknownId' },
    { index: 2, reason: 'duplicateId' },
    { index: 3, reason: 'badEntry' },
  ]);
});

test('validateImport: bare array of ids accepted', () => {
  const ids = Data.SHAYARIS.map((s) => s.id);
  const res = Core.validateImport(JSON.stringify(['f02', 'm05']), ids);
  assert.deepEqual(res, { added: ['f02', 'm05'], rejected: [] });
});

test('buildExportJson round-trip: export -> import restores the same ids', () => {
  const ids = Data.SHAYARIS.map((s) => s.id);
  const json = Core.buildExportJson(['l01', 'r03', 'b02']);
  const parsed = JSON.parse(json);
  assert.equal(parsed.app, 'shayari-bd');
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.favourites, ['l01', 'r03', 'b02']);
  const back = Core.validateImport(json, ids);
  assert.deepEqual(back, { added: ['l01', 'r03', 'b02'], rejected: [] });
  assert.deepEqual(Core.validateImport(Core.buildExportJson([]), ids), { added: [], rejected: [] });
});

// ---------- erase guard ----------
test('eraseConfirmed: only the exact word DELETE confirms', () => {
  assert.equal(Core.eraseConfirmed('DELETE'), true);
  assert.equal(Core.eraseConfirmed('delete'), false);
  assert.equal(Core.eraseConfirmed('DELETE '), false);
  assert.equal(Core.eraseConfirmed(''), false);
});

// ---------- formatting ----------
test('toBengaliDigits and formatNumber', () => {
  assert.equal(Core.toBengaliDigits('48'), BN_48);
  assert.equal(Core.toBengaliDigits('2026'), BN_2026);
  assert.equal(Core.toBengaliDigits('6'), '\u09ec');
  assert.equal(Core.formatNumber(48, 'bn'), BN_48);
  assert.equal(Core.formatNumber(48, 'en'), '48');
  assert.equal(Core.formatNumber(0, 'bn'), '\u09e6');
});

// ---------- constants ----------
test('constants: 48 shayaris, 6 categories, storage key and app id set', () => {
  assert.equal(Core.TOTAL_SHAYARIS, 48);
  assert.equal(Core.CATEGORY_COUNT, 6);
  assert.equal(Core.STORAGE_KEY, 'shayariBD.v1');
  assert.equal(Core.APP_ID, 'shayari-bd');
  assert.equal(Core.EXPORT_VERSION, 1);
});
