'use strict';
/**
 * Shayari BD - pure logic (no DOM). Node-testable.
 *
 * Daily pick: deterministic date-seeded index into the 48 shayaris.
 *   index = (year * 365 + month * 31 + day) % 48
 *   2026-11-18: (2026*365 + 11*31 + 18) = 739849; 739849 % 48 = 25 -> b02
 *   2026-01-01: (2026*365 + 1*31 + 1)   = 739522; 739522 % 48 = 34 -> m03
 * Search: substring match over Bengali text, Roman text, and the category
 * name in English, Bengali and Roman. Empty query returns all 48.
 * Favourites: a plain array of shayari ids; export is a JSON file of those
 * ids; import validates shape strictly and rejects unknown ids.
 */
const STORAGE_KEY = 'shayariBD.v1';
const APP_ID = 'shayari-bd';
const EXPORT_VERSION = 1;
const TOTAL_SHAYARIS = 48;
const CATEGORY_COUNT = 6;

const BN_DIGITS = { '0': '\u09e6', '1': '\u09e7', '2': '\u09e8', '3': '\u09e9', '4': '\u09ea', '5': '\u09eb', '6': '\u09ec', '7': '\u09ed', '8': '\u09ee', '9': '\u09ef' };

function toBengaliDigits(v) {
  return String(v).replace(/[0-9]/g, (d) => BN_DIGITS[d]);
}
function formatNumber(n, lang) {
  const s = String(n);
  return lang === 'bn' ? toBengaliDigits(s) : s;
}

function isNonEmptyStr(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Validate the bundled shayari bank. Returns an array of error strings (empty = valid). */
function validateShayariData(shayaris, categories) {
  const errs = [];
  if (!Array.isArray(shayaris) || shayaris.length === 0) return ['noShayaris'];
  const catIds = new Set((categories || []).map((c) => c.id));
  const ids = new Set();
  const bnTexts = new Set();
  const romanTexts = new Set();
  shayaris.forEach((s, i) => {
    if (!s || typeof s !== 'object') { errs.push('badEntry:' + i); return; }
    if (!isNonEmptyStr(s.id)) errs.push('missingId:' + i);
    else if (ids.has(s.id)) errs.push('dupId:' + s.id);
    else ids.add(s.id);
    if (!isNonEmptyStr(s.bn)) errs.push('missingBn:' + (s.id || i));
    else if (bnTexts.has(s.bn)) errs.push('dupBn:' + s.id);
    else bnTexts.add(s.bn);
    if (!isNonEmptyStr(s.roman)) errs.push('missingRoman:' + (s.id || i));
    else if (romanTexts.has(s.roman)) errs.push('dupRoman:' + s.id);
    else romanTexts.add(s.roman);
    if (s.cat && !catIds.has(s.cat)) errs.push('unknownCat:' + s.id);
    if (isNonEmptyStr(s.bn)) {
      const lines = s.bn.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length < 2 || lines.length > 4) errs.push('lineCount:' + s.id);
    }
    if (isNonEmptyStr(s.roman)) {
      const lines = s.roman.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length < 2 || lines.length > 4) errs.push('romanLineCount:' + s.id);
    }
  });
  return errs;
}

/** Deterministic daily index (0..47) for a calendar date. */
function dailyIndex(year, month, day) {
  return (year * 365 + month * 31 + day) % TOTAL_SHAYARIS;
}

function dailyShayari(shayaris, date) {
  const d = date || new Date();
  return shayaris[dailyIndex(d.getFullYear(), d.getMonth() + 1, d.getDate())];
}

/** Random index different from `exclude` (used by the Shuffle button). */
function randomIndex(exclude, rng) {
  const r = rng || Math.random;
  let i = Math.floor(r() * TOTAL_SHAYARIS);
  if (i === exclude) i = (i + 1) % TOTAL_SHAYARIS;
  return i;
}

function filterByCategory(shayaris, catId) {
  if (!catId || catId === 'all') return shayaris.slice();
  return shayaris.filter((s) => s.cat === catId);
}

/**
 * Search across Bengali text, Roman text, and category names (EN/BN/Roman).
 * Empty query returns the whole list. Case-insensitive for Roman/English;
 * Bengali matching is an exact substring match.
 */
function searchShayaris(shayaris, categories, query) {
  const q = String(query || '').trim();
  if (!q) return shayaris.slice();
  const qLower = q.toLowerCase();
  const catById = {};
  (categories || []).forEach((c) => { catById[c.id] = c; });
  return shayaris.filter((s) => {
    if (s.bn && s.bn.includes(q)) return true;
    if (s.roman && s.roman.toLowerCase().includes(qLower)) return true;
    const c = catById[s.cat];
    if (c) {
      if (c.en && c.en.toLowerCase().includes(qLower)) return true;
      if (c.bn && c.bn.includes(q)) return true;
      if (c.roman && c.roman.toLowerCase().includes(qLower)) return true;
    }
    return false;
  });
}

function isFav(favs, id) {
  return Array.isArray(favs) && favs.indexOf(id) !== -1;
}

/** Toggle one id in a favourites array. Returns a new array (no mutation). */
function toggleFav(favs, id) {
  const list = Array.isArray(favs) ? favs.slice() : [];
  const i = list.indexOf(id);
  if (i === -1) list.push(id);
  else list.splice(i, 1);
  return list;
}

function favShayaris(shayaris, favs) {
  const set = new Set(Array.isArray(favs) ? favs : []);
  return shayaris.filter((s) => set.has(s.id));
}

/** Text copied/shared for one shayari in the chosen script. */
function copyText(item, script) {
  const text = script === 'roman' ? item.roman : item.bn;
  return text + '\n\n- Shayari BD';
}

/** Favourites export JSON (ASCII-safe). */
function buildExportJson(favIds) {
  return JSON.stringify({
    app: APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    favourites: (favIds || []).slice(),
  }, null, 2);
}

/**
 * Strictly validate a favourites import JSON string.
 * Accepts a bare array of ids or the app's own export shape
 * { app, version, exportedAt, favourites: [...] }.
 * Returns { added: [id, ...], rejected: [{ index, reason }] }.
 * Reasons: badJson, badShape, badEntry, unknownId, duplicateId.
 * Only ids present in `validIds` are accepted.
 */
function validateImport(text, validIds) {
  const valid = new Set(validIds || []);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { added: [], rejected: [{ index: -1, reason: 'badJson' }] };
  }
  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.favourites)) arr = parsed.favourites;
  else return { added: [], rejected: [{ index: -1, reason: 'badShape' }] };

  const added = [];
  const rejected = [];
  const seen = new Set();
  arr.forEach((entry, i) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      rejected.push({ index: i, reason: 'badEntry' });
      return;
    }
    const id = entry.trim();
    if (!valid.has(id)) { rejected.push({ index: i, reason: 'unknownId' }); return; }
    if (seen.has(id)) { rejected.push({ index: i, reason: 'duplicateId' }); return; }
    seen.add(id);
    added.push(id);
  });
  return { added, rejected };
}

/** Erase-all guard: the user must type DELETE exactly. */
function eraseConfirmed(input) {
  return input === 'DELETE';
}

const logicApi = {
  STORAGE_KEY,
  APP_ID,
  EXPORT_VERSION,
  TOTAL_SHAYARIS,
  CATEGORY_COUNT,
  toBengaliDigits,
  formatNumber,
  validateShayariData,
  dailyIndex,
  dailyShayari,
  randomIndex,
  filterByCategory,
  searchShayaris,
  isFav,
  toggleFav,
  favShayaris,
  copyText,
  buildExportJson,
  validateImport,
  eraseConfirmed,
};

if (typeof module !== 'undefined' && module.exports) module.exports = logicApi;
if (typeof window !== 'undefined') window.ShayariCore = logicApi;
