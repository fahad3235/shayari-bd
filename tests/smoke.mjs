'use strict';
/**
 * Shayari BD - headless-Chrome smoke test (raw CDP, no deps).
 * Drives the cached headless_shell-1187 over file:// and asserts live behaviour.
 * Usage: node tests/smoke.mjs
 * Requires: ~/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell
 * Bengali literals are \uXXXX escapes so this file stays pure ASCII.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHELL = path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const PROFILE = '/tmp/shayari-bd-profile';
const PAGE_URL = 'file://' + path.resolve(import.meta.dirname, '..', 'index.html');
const PORT = 9335;

const BN_BRISHTI = '\u09ac\u09c3\u09b7\u09cd\u099f\u09bf';
const BN_48 = '\u09ea\u09ee';
const BN_1 = '\u09e7';

let passed = 0;
let failed = 0;
const failures = [];
const consoleErrors = [];
const pageExceptions = [];

function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; failures.push(name + (extra ? ' - ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' - ' + extra : '')); }
}

async function main() {
  if (!fs.existsSync(SHELL)) throw new Error('headless_shell not found at ' + SHELL);
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(SHELL, [
    '--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + PROFILE,
    '--remote-debugging-port=' + PORT,
    'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(250);
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      const j = await res.json();
      wsUrl = j.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
  }
  if (!wsUrl) throw new Error('CDP did not come up');

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error(JSON.stringify(m.error)));
      else res(m.result);
    } else if (m.method) {
      for (const fn of listeners) fn(m);
    }
  };
  function send(method, params) {
    return new Promise((res, rej) => {
      const id = ++msgId;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      pageExceptions.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    }
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      consoleErrors.push(m.params.type + ': ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200));
    }
  });

  try {
    const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
    const page = list.find((t) => t.type === 'page');
    const pageWs = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { pageWs.onopen = res; pageWs.onerror = rej; });
    let pId = 0;
    const pPending = new Map();
    pageWs.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pPending.has(m.id)) {
        const { res, rej } = pPending.get(m.id);
        pPending.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error)));
        else res(m.result);
      } else if (m.method) {
        for (const fn of listeners) fn(m);
      }
    };
    const psend = (method, params) => new Promise((res, rej) => {
      const id = ++pId;
      pPending.set(id, { res, rej });
      pageWs.send(JSON.stringify({ id, method, params: params || {} }));
    });
    const peval = async (expression) => {
      const r = await psend('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
      return r.result ? r.result.value : undefined;
    };

    await psend('Page.enable');
    await psend('Runtime.enable');
    await psend('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await psend('Page.navigate', { url: PAGE_URL });
    await sleep(1200);

    console.log('== load ==');
    check('title', await peval('document.title') === 'Shayari BD - Short Bangla Shayaris to Share');
    check('window globals present', await peval('!!window.__app && !!window.ShayariCore && !!window.ShayariData'));
    check('header text', (await peval(`document.querySelector('h1').textContent`)) === 'Shayari BD');
    check('48 shayari cards render', (await peval(`document.querySelectorAll('.shayari-card').length`)) === 48);
    check('stat total = 48', (await peval(`document.getElementById('statTotal').textContent`)) === '48');
    check('stat favs = 0', (await peval(`document.getElementById('statFavs').textContent`)) === '0');
    check('stat cats = 6', (await peval(`document.getElementById('statCats').textContent`)) === '6');
    check('7 filter chips (All + Favs + 6 cats)', (await peval(`document.querySelectorAll('.chip').length`)) === 8);

    console.log('== hero: daily shayari ==');
    const heroCheck = await peval(`
      (() => {
        const d = new Date();
        const item = window.ShayariCore.dailyShayari(window.ShayariData.SHAYARIS, d);
        const shown = document.getElementById('heroText').textContent;
        return { expect: item.bn, shown, id: item.id };
      })()`);
    check('hero shows today\'s daily shayari (' + heroCheck.id + ')', heroCheck.shown === heroCheck.expect, JSON.stringify(heroCheck).slice(0, 120));
    check('hero category shown', (await peval(`document.getElementById('heroCat').textContent`)).length > 0);
    const heroBefore = await peval(`document.getElementById('heroText').textContent`);
    await peval(`document.getElementById('shuffleBtn').click();`);
    await sleep(200);
    const heroAfter = await peval(`document.getElementById('heroText').textContent`);
    check('shuffle changes the hero shayari', heroAfter !== heroBefore && heroAfter.length > 0);

    console.log('== search + filter ==');
    check('search "brishti" -> 9 cards', await peval(`
      (() => { const i = document.getElementById('searchInput'); i.value = 'brishti';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        return document.querySelectorAll('.shayari-card').length; })()` ) === 9);
    check('search Bengali rain word -> 9 cards', await peval(`
      (() => { const i = document.getElementById('searchInput'); i.value = ${JSON.stringify(BN_BRISHTI)};
        i.dispatchEvent(new Event('input', { bubbles: true }));
        return document.querySelectorAll('.shayari-card').length; })()` ) === 9);
    check('search "shuprovat" -> 8 cards (category)', await peval(`
      (() => { const i = document.getElementById('searchInput'); i.value = 'shuprovat';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        return document.querySelectorAll('.shayari-card').length; })()` ) === 8);
    check('search nonsense -> empty state', await peval(`
      (() => { const i = document.getElementById('searchInput'); i.value = 'zzzqqq';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        return !document.getElementById('emptyState').hidden; })()` ) === true);
    check('category chip love -> 8 cards', await peval(`
      (() => { const i = document.getElementById('searchInput'); i.value = '';
        i.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.chip[data-filter="love"]').click();
        return document.querySelectorAll('.shayari-card').length; })()` ) === 8);
    check('category chip rain -> 8 cards', await peval(`
      (() => { document.querySelector('.chip[data-filter="rain"]').click();
        return document.querySelectorAll('.shayari-card').length; })()` ) === 8);
    await peval(`document.querySelector('.chip[data-filter="all"]').click();`);

    console.log('== script toggle ==');
    const bnText = await peval(`document.getElementById('heroText').textContent`);
    await peval(`document.getElementById('scriptToggle').click();`);
    await sleep(200);
    const romanCheck = await peval(`
      (() => {
        const d = new Date();
        const idx = window.__app.state.heroIndex;
        const item = window.ShayariData.SHAYARIS[idx];
        return { shown: document.getElementById('heroText').textContent, expect: item.roman };
      })()`);
    check('script toggle shows Roman text', romanCheck.shown === romanCheck.expect, JSON.stringify(romanCheck).slice(0, 100));
    check('roman text is pure ASCII', /^[\x00-\x7F\n.,'-]+$/.test(romanCheck.shown));
    await peval(`document.getElementById('scriptToggle').click();`);
    await sleep(200);
    check('script toggle back to Bengali', (await peval(`document.getElementById('heroText').textContent`)) === bnText);

    console.log('== favourites ==');
    check('favourite first card -> stat 1', await peval(`
      (() => { document.querySelector('.shayari-card .fav-btn').click();
        return document.getElementById('statFavs').textContent; })()` ) === '1');
    check('favourites-only view -> 1 card', await peval(`
      (() => { document.querySelector('.chip[data-filter="fav"]').click();
        return document.querySelectorAll('.shayari-card').length; })()` ) === 1);
    check('favourites empty state hidden when 1 fav', await peval(`document.getElementById('emptyState').hidden`) === true);
    await psend('Page.reload', { ignoreCache: true });
    await sleep(1000);
    check('favourite persists across reload (stat 1)', (await peval(`document.getElementById('statFavs').textContent`)) === '1');
    check('favourites-only view still 1 card after reload', await peval(`
      (() => { document.querySelector('.chip[data-filter="fav"]').click();
        return document.querySelectorAll('.shayari-card').length; })()` ) === 1);
    check('unfavourite -> stat 0, empty state shows', await peval(`
      (() => { document.querySelector('.shayari-card .fav-btn').click();
        return document.getElementById('statFavs').textContent + '|' +
          (!document.getElementById('emptyState').hidden); })()` ) === '0|true');
    await peval(`document.querySelector('.chip[data-filter="all"]').click();`);

    console.log('== copy / share ==');
    check('copy click shows a toast', await peval(`
      (async () => { document.querySelector('.shayari-card .btn-small').click();
        await new Promise(r => setTimeout(r, 300));
        return document.getElementById('toast').textContent.length > 0; })()` ) === true);
    check('copy text format via Core', await peval(`
      (() => { const item = window.ShayariData.SHAYARIS.find(s => s.id === 'b02');
        return window.ShayariCore.copyText(item, 'roman'); })()` ) ===
      'Jonmodiner onek onek shubhechha,\nTomar shopnogulo shotti hok.\nCake kato, mombati jalao,\nAjker dinta shudhu tomar.\n\n- Shayari BD');

    console.log('== export / import / erase ==');
    check('export JSON builds 3 favs', await peval(`
      (() => { const j = window.__app.Core.buildExportJson(['l01', 'r03', 'b02']);
        return JSON.parse(j).favourites.length; })()` ) === 3);
    check('import round-trip via app -> 2 favs', await peval(`
      (() => { const j = window.__app.Core.buildExportJson(['l01', 'r03']);
        const r = window.__app.importText(j);
        return r.added.length + '/' + r.rejected.length + '/' +
          document.getElementById('statFavs').textContent; })()` ) === '2/0/2');
    check('bad import rejected with message', await peval(`
      (() => { window.__app.importText('{"a":1}');
        return document.getElementById('importMsg').textContent; })()` ) === 'Import failed: not a favourites file.');
    check('unknown-id import rejected, valid kept', await peval(`
      (() => { const r = window.__app.importText(JSON.stringify({ favourites: ['l02', 'nope'] }));
        return r.added.length + '/' + r.rejected[0].reason + '/' +
          document.getElementById('statFavs').textContent; })()` ) === '1/unknownId/1');
    check('erase with wrong word refused', await peval(`
      (() => { document.getElementById('eraseInput').value = 'delete';
        document.getElementById('eraseBtn').click();
        return document.getElementById('eraseMsg').textContent; })()` ) === 'Type DELETE exactly to erase.');
    check('erase with DELETE works', await peval(`
      (() => { document.getElementById('eraseInput').value = 'DELETE';
        document.getElementById('eraseBtn').click();
        return document.getElementById('eraseMsg').textContent + '|' +
          document.getElementById('statFavs').textContent; })()` ) === 'All favourites were erased.|0');

    console.log('== language toggle ==');
    await peval(`document.getElementById('langToggle').click();`);
    await sleep(200);
    const bnTitle = await peval(`document.querySelector('h1').textContent`);
    check('heading switches to Bengali', bnTitle === await peval(`window.__app.I18N.bn.appTitle`), bnTitle);
    check('stat total shows Bengali digits 48', (await peval(`document.getElementById('statTotal').textContent`)) === BN_48);
    await peval(`document.getElementById('langToggle').click();`);
    await sleep(200);
    check('heading back to English', (await peval(`document.querySelector('h1').textContent`)) === 'Shayari BD');

    console.log('== responsive ==');
    await psend('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(400);
    const sw390 = await peval(`document.documentElement.scrollWidth`);
    check('no horizontal overflow at 390px', sw390 <= 390, 'scrollWidth=' + sw390);
    await psend('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    const sw1280 = await peval(`document.documentElement.scrollWidth`);
    check('no horizontal overflow at 1280px', sw1280 <= 1280, 'scrollWidth=' + sw1280);

    console.log('== errors ==');
    check('zero page exceptions', pageExceptions.length === 0, pageExceptions.join(' | '));
    check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

    pageWs.close();
  } finally {
    ws.close();
    chrome.kill('SIGKILL');
  }

  console.log(`\nSMOKE: ${passed} passed, ${failed} failed`);
  if (failed) { console.log('FAILURES:'); failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }
}

main().catch((e) => { console.error('SMOKE RUNNER ERROR:', e); process.exit(2); });
