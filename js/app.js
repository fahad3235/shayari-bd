'use strict';
/* Shayari BD - DOM/UI layer. All math/validation lives in js/logic.js. */
(function () {
  const Core = window.ShayariCore;
  const Data = window.ShayariData;
  const STRINGS = window.I18N_STRINGS;

  const state = {
    lang: 'en',      // UI language: 'en' | 'bn'
    script: 'bn',    // shayari script: 'bn' | 'roman'
    favs: [],        // array of shayari ids
    filter: 'all',   // 'all' | 'fav' | category id
    query: '',
    heroIndex: 0,    // index into SHAYARIS shown in the hero
  };

  // ---------- storage ----------
  function load() {
    try {
      const raw = localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.lang === 'bn' || parsed.lang === 'en') state.lang = parsed.lang;
        if (parsed.script === 'bn' || parsed.script === 'roman') state.script = parsed.script;
        if (Array.isArray(parsed.favs)) {
          const valid = new Set(Data.SHAYARIS.map((s) => s.id));
          state.favs = parsed.favs.filter((id) => valid.has(id));
        }
      }
    } catch (e) { /* corrupted storage: start fresh */ }
  }
  function save() {
    try {
      localStorage.setItem(Core.STORAGE_KEY, JSON.stringify({
        lang: state.lang,
        script: state.script,
        favs: state.favs,
      }));
    } catch (e) { /* storage full/blocked: app still works in-memory */ }
  }

  const $ = (id) => document.getElementById(id);

  // ---------- i18n ----------
  function t(key, vars) {
    const dict = STRINGS[state.lang] || STRINGS.en;
    let s = dict[key] !== undefined ? dict[key] : (STRINGS.en[key] || key);
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    }
    return s;
  }
  function fmt(n) { return Core.formatNumber(n, state.lang); }
  function catName(cat) {
    if (state.lang === 'bn') return cat.bn;
    return cat.en;
  }
  function shayariText(item) {
    return state.script === 'roman' ? item.roman : item.bn;
  }

  // ---------- toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- hero ----------
  function renderHero() {
    const item = Data.SHAYARIS[state.heroIndex];
    const cat = Data.CATEGORIES.find((c) => c.id === item.cat);
    $('heroCat').textContent = catName(cat);
    $('heroText').textContent = shayariText(item);
    const favBtn = $('heroFavBtn');
    favBtn.classList.toggle('active', Core.isFav(state.favs, item.id));
    favBtn.setAttribute('aria-pressed', Core.isFav(state.favs, item.id) ? 'true' : 'false');
    favBtn.setAttribute('data-id', item.id);
  }
  function shuffleHero() {
    state.heroIndex = Core.randomIndex(state.heroIndex);
    renderHero();
  }

  // ---------- list ----------
  function visibleShayaris() {
    let list = Data.SHAYARIS;
    if (state.filter === 'fav') list = Core.favShayaris(list, state.favs);
    else if (state.filter !== 'all') list = Core.filterByCategory(list, state.filter);
    if (state.query.trim()) list = Core.searchShayaris(list, Data.CATEGORIES, state.query);
    return list;
  }

  function heartSvg(filled) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="' +
      (filled ? '#c0392b' : 'none') + '" stroke="#c0392b" stroke-width="2" ' +
      'd="M12 21s-7.5-4.7-10-9.3C.4 8.6 2.4 5 5.7 5c2 0 3.4 1.1 4.3 2.4h4C15 6.1 16.4 5 18.4 5c3.3 0 5.3 3.6 3.7 6.7C19.5 16.3 12 21 12 21z"/></svg>';
  }

  function renderList() {
    const list = visibleShayaris();
    const wrap = $('shayariList');
    wrap.innerHTML = '';
    const empty = $('emptyState');
    if (list.length === 0) {
      empty.hidden = false;
      empty.textContent = state.filter === 'fav' && !state.query.trim() ? t('noFavs') : t('noResults');
    } else {
      empty.hidden = true;
    }
    list.forEach((item) => {
      const cat = Data.CATEGORIES.find((c) => c.id === item.cat);
      const card = document.createElement('article');
      card.className = 'shayari-card';
      card.setAttribute('data-id', item.id);

      const head = document.createElement('div');
      head.className = 'card-head';
      const chip = document.createElement('span');
      chip.className = 'card-cat';
      chip.textContent = catName(cat);
      head.appendChild(chip);
      const fav = document.createElement('button');
      fav.type = 'button';
      fav.className = 'fav-btn' + (Core.isFav(state.favs, item.id) ? ' active' : '');
      fav.setAttribute('aria-pressed', Core.isFav(state.favs, item.id) ? 'true' : 'false');
      fav.setAttribute('aria-label', t('favBtn'));
      fav.setAttribute('data-id', item.id);
      fav.innerHTML = heartSvg(Core.isFav(state.favs, item.id));
      fav.addEventListener('click', () => onToggleFav(item.id));
      head.appendChild(fav);
      card.appendChild(head);

      const p = document.createElement('p');
      p.className = 'card-text';
      p.textContent = shayariText(item);
      card.appendChild(p);

      const actions = document.createElement('div');
      actions.className = 'card-actions';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-small';
      copyBtn.textContent = t('copyBtn');
      copyBtn.addEventListener('click', () => onCopy(item));
      actions.appendChild(copyBtn);
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'btn btn-small';
      shareBtn.textContent = t('shareBtn');
      shareBtn.addEventListener('click', () => onShare(item));
      actions.appendChild(shareBtn);
      card.appendChild(actions);

      wrap.appendChild(card);
    });
  }

  // ---------- stats + chips ----------
  function renderStats() {
    $('statTotal').textContent = fmt(Core.TOTAL_SHAYARIS);
    $('statFavs').textContent = fmt(state.favs.length);
    $('statCats').textContent = fmt(Core.CATEGORY_COUNT);
    const favChip = document.querySelector('.chip[data-filter="fav"]');
    if (favChip) favChip.textContent = t('filterFavs') + ' (' + fmt(state.favs.length) + ')';
  }

  function renderChips() {
    const wrap = $('filterChips');
    wrap.innerHTML = '';
    const defs = [{ id: 'all', label: t('filterAll') }, { id: 'fav', label: t('filterFavs') + ' (' + fmt(state.favs.length) + ')' }]
      .concat(Data.CATEGORIES.map((c) => ({ id: c.id, label: catName(c) })));
    defs.forEach((d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (state.filter === d.id ? ' active' : '');
      b.setAttribute('data-filter', d.id);
      b.textContent = d.label;
      b.addEventListener('click', () => {
        state.filter = d.id;
        renderChips();
        renderList();
      });
      wrap.appendChild(b);
    });
  }

  // ---------- actions ----------
  function onToggleFav(id) {
    state.favs = Core.toggleFav(state.favs, id);
    save();
    renderHero();
    renderList();
    renderStats();
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e2) { return false; }
    }
  }

  async function onCopy(item) {
    const ok = await copyToClipboard(Core.copyText(item, state.script));
    toast(ok ? t('copiedMsg') : t('copyFailMsg'));
  }

  async function onShare(item) {
    const text = Core.copyText(item, state.script);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        toast(t('sharedMsg'));
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    const ok = await copyToClipboard(text);
    toast(ok ? t('shareFailMsg') : t('copyFailMsg'));
  }

  function exportFavourites() {
    const json = Core.buildExportJson(state.favs);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shayari-bd-favourites.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importText(text) {
    const validIds = Data.SHAYARIS.map((s) => s.id);
    const res = Core.validateImport(text, validIds);
    const msg = $('importMsg');
    if (res.added.length === 0 && res.rejected.length > 0 && res.rejected[0].index === -1) {
      msg.textContent = t('dataImportBad', { reason: t('reason' + capFirst(res.rejected[0].reason)) });
      return res;
    }
    state.favs = res.added;
    save();
    renderHero();
    renderList();
    renderStats();
    msg.textContent = t('dataImportOk', { added: fmt(res.added.length), rejected: fmt(res.rejected.length) });
    return res;
  }
  function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function eraseFavourites() {
    const msg = $('eraseMsg');
    if (!Core.eraseConfirmed($('eraseInput').value)) {
      msg.textContent = t('dataEraseWrong');
      return false;
    }
    state.favs = [];
    save();
    $('eraseInput').value = '';
    renderHero();
    renderList();
    renderStats();
    msg.textContent = t('dataErased');
    return true;
  }

  // ---------- i18n apply ----------
  function applyI18n() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langToggle').textContent = t('langButton');
    $('scriptToggle').textContent = state.script === 'bn' ? t('scriptButtonRoman') : t('scriptButtonBn');
    renderChips();
    renderHero();
    renderList();
    renderStats();
  }

  // ---------- init ----------
  function init() {
    load();
    state.heroIndex = Core.dailyIndex(
      new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
    $('shuffleBtn').addEventListener('click', shuffleHero);
    $('heroFavBtn').addEventListener('click', () => {
      onToggleFav(Data.SHAYARIS[state.heroIndex].id);
    });
    $('heroCopyBtn').addEventListener('click', () => onCopy(Data.SHAYARIS[state.heroIndex]));
    $('heroShareBtn').addEventListener('click', () => onShare(Data.SHAYARIS[state.heroIndex]));
    $('searchInput').addEventListener('input', (e) => {
      state.query = e.target.value;
      renderList();
    });
    $('langToggle').addEventListener('click', () => {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      save();
      applyI18n();
    });
    $('scriptToggle').addEventListener('click', () => {
      state.script = state.script === 'bn' ? 'roman' : 'bn';
      save();
      $('scriptToggle').textContent = state.script === 'bn' ? t('scriptButtonRoman') : t('scriptButtonBn');
      renderHero();
      renderList();
    });
    $('exportBtn').addEventListener('click', exportFavourites);
    $('importFile').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importText(String(reader.result || ''));
      reader.readAsText(file);
      e.target.value = '';
    });
    $('eraseBtn').addEventListener('click', eraseFavourites);
    applyI18n();
  }

  window.__app = {
    state,
    Core,
    Data,
    I18N: STRINGS,
    t,
    renderList,
    renderHero,
    importText,
    exportFavourites,
    eraseFavourites,
    visibleShayaris,
    shuffleHero,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
