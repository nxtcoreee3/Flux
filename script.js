/* script.js — Flux
   Features: game rendering, play modal, search/sort,
   favorites (cloud+local), dark mode, toasts, recently played, new badge
*/

import { initAuthUI, loadCloudFavs, saveCloudFavs } from './firebase-auth.js';

const GAMES = [
  {
    id: 'drive-mad',
    title: 'Drive Mad',
    thumb: 'assets/Drive-Mad.png',
    url: 'https://nxtcoreee3.github.io/Drive-Mad/',
    desc: 'High speed driving challenge'
  },
  {
    id: 'stickman-hook',
    title: 'Stickman Hook',
    thumb: 'assets/Stickman-Hook.png',
    url: 'https://nxtcoreee3.github.io/Stickman-Hook/',
    desc: 'Swing through levels with perfect timing'
  },
  {
    id: 'geometry-dash-lite',
    title: 'Geometry Dash Lite',
    thumb: 'assets/Geometry-Dash-Lite.png',
    url: 'https://nxtcoreee3.github.io/Geometry-Dash-Lite/',
    desc: 'Rhythm-based platformer — lite'
  },
  {
    id: 'paper-io',
    title: 'Paper.io',
    thumb: 'assets/Paper-io.png',
    url: 'https://nxtcoreee3.github.io/Paper-io/',
    desc: 'Conquer territory and outmaneuver rivals'
  },
  {
    id: 'cookie-clicker',
    title: 'Cookie Clicker',
    thumb: 'assets/Cookie-Clicker.png',
    url: 'https://nxtcoreee3.github.io/Cookie-Clicker/',
    desc: 'Click cookies, build an empire'
  },
  {
    id: 'monkey-mart',
    title: 'Monkey Mart',
    thumb: 'assets/Monkey-Mart.png',
    url: 'https://nxtcoreee3.github.io/Monkey-Mart/',
    desc: 'Run your own monkey supermarket',
    isNew: true
  },
  {
   id: 'polytrack',
   title: 'Polytrack',
   thumb: 'assets/polytrack.png',
   url: 'https://nxtcoreee3.github.io/Polytrack/',
   desc: 'Drive and race against your older records.'
  }
];

/* --- Utilities --- */
const $ = sel => document.querySelector(sel);
const quickSearch = document.getElementById('quick-search') || document.getElementById('games-search');
const sortSelect = document.getElementById('sort-select');

/* NAV TOGGLE */
document.addEventListener('click', (e) => {
  const toggle = document.querySelector('.nav-toggle');
  if (!toggle) return;
  if (e.target === toggle) {
    const nav = document.getElementById('main-nav');
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    nav.style.display = expanded ? '' : 'flex';
  }
});

/* YEAR footers */
['year','year2','year3','year4','year5'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.textContent = new Date().getFullYear();
});

/* ===================== DARK MODE ===================== */
const DARK_KEY = 'flux_dark';

function applyDark(on) {
  document.documentElement.classList.toggle('dark', on);
  localStorage.setItem(DARK_KEY, on ? '1' : '0');
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = on ? '☀️' : '🌙';
}

function initDarkMode() {
  const saved = localStorage.getItem(DARK_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyDark(saved !== null ? saved === '1' : prefersDark);

  const rightActions = document.querySelector('.right-actions');
  if (!rightActions) return;
  const btn = document.createElement('button');
  btn.id = 'dark-toggle';
  btn.className = 'icon-btn';
  btn.title = 'Toggle dark mode';
  btn.style.cursor = 'pointer';
  btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
  btn.addEventListener('click', () => applyDark(!document.documentElement.classList.contains('dark')));
  rightActions.prepend(btn);
}

/* ===================== TOASTS ===================== */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const colors = { info: '#3a7dff', success: '#22c55e', error: '#ef4444', warning: '#f59e0b' };
  const icons  = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };

  const toast = document.createElement('div');
  toast.style.cssText = `
    background:var(--panel);border-radius:12px;padding:12px 16px;
    box-shadow:0 8px 30px rgba(0,0,0,0.14);border-left:4px solid ${colors[type]};
    display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:var(--text);
    pointer-events:all;max-width:280px;
    opacity:0;transform:translateY(8px);transition:all 0.2s ease;
  `;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity='1'; toast.style.transform='translateY(0)'; });
  setTimeout(() => {
    toast.style.opacity='0'; toast.style.transform='translateY(8px)';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

/* ===================== RECENTLY PLAYED ===================== */
const RECENT_KEY = 'flux_recent';
const MAX_RECENT = 6;

function loadRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } }

function addRecent(id) {
  let recent = loadRecent();
  recent = [id, ...recent.filter(r => r !== id)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function renderRecentSection() {
  const section = document.getElementById('recent-section');
  const grid = document.getElementById('recent-grid');
  if (!section || !grid) return;
  const recentGames = loadRecent().map(id => GAMES.find(g => g.id === id)).filter(Boolean);
  grid.innerHTML = '';
  if (recentGames.length > 0) {
    recentGames.forEach(g => grid.appendChild(createCard(g)));
    section.style.display = '';
  } else {
    section.style.display = 'none';
  }
}

/* ===================== FAVORITES ===================== */
const FAVORITES_KEY = 'flux_favs';
function loadLocalFavs() { try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch { return []; } }
function saveLocalFavs(arr) { localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr)); }

let _favsCache = loadLocalFavs();

async function refreshFavsCache() {
  const cloud = await loadCloudFavs();
  if (cloud !== null) { _favsCache = cloud; saveLocalFavs(cloud); }
  else { _favsCache = loadLocalFavs(); }
  const countEl = document.getElementById('profile-fav-count');
  if (countEl) countEl.textContent = `${_favsCache.length} favourited game${_favsCache.length !== 1 ? 's' : ''}`;
  applyFilters();
}

function isFav(id) { return _favsCache.includes(id); }

async function toggleFav(id) {
  const adding = !isFav(id);
  if (adding) _favsCache.push(id);
  else _favsCache.splice(_favsCache.indexOf(id), 1);
  saveLocalFavs(_favsCache);
  await saveCloudFavs(_favsCache);
  const countEl = document.getElementById('profile-fav-count');
  if (countEl) countEl.textContent = `${_favsCache.length} favourited game${_favsCache.length !== 1 ? 's' : ''}`;
  const game = GAMES.find(g => g.id === id);
  showToast(adding ? `Added ${game?.title} to favourites ★` : `Removed ${game?.title} from favourites`, adding ? 'success' : 'info');
}

/* ===================== CARD ===================== */
function createCard(game) {
  const div = document.createElement('article');
  div.className = 'card';
  div.setAttribute('data-id', game.id);

  div.innerHTML = `
    ${game.isNew ? '<span class="new-badge">NEW</span>' : ''}
    <img class="thumb" src="${game.thumb}" alt="${game.title} thumbnail" loading="lazy">
    <div class="card-body">
      <h3 class="title">${game.title}</h3>
      <div class="meta">${game.desc || ''}</div>
    </div>
    <div class="card-foot">
      <div style="display:flex;gap:8px;align-items:center">
        <button class="favorite" title="Toggle favourite" aria-pressed="${isFav(game.id)}">${isFav(game.id) ? '★' : '☆'}</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="open-btn" data-url="${game.url}" aria-label="Open in new tab">Open</button>
        <button class="play-btn" data-url="${game.url}" data-title="${game.title}">Play</button>
      </div>
    </div>
  `;

  const favBtn = div.querySelector('.favorite');
  favBtn.addEventListener('click', async () => {
    await toggleFav(game.id);
    favBtn.textContent = isFav(game.id) ? '★' : '☆';
    favBtn.classList.toggle('active', isFav(game.id));
    favBtn.setAttribute('aria-pressed', String(isFav(game.id)));
    renderFavouritesSection();
  });
  favBtn.classList.toggle('active', isFav(game.id));

  div.querySelector('.open-btn').addEventListener('click', (e) => {
    window.open(e.currentTarget.dataset.url, '_blank', 'noopener');
  });

  div.querySelector('.play-btn').addEventListener('click', (e) => {
    addRecent(game.id);
    renderRecentSection();
    openPlayModal(e.currentTarget.dataset.url, e.currentTarget.dataset.title);
  });

  return div;
}

/* ===================== RENDER ===================== */
function renderFavouritesSection() {
  const favsGrid = document.getElementById('favourites-grid');
  const favsSection = document.getElementById('favourites-section');
  if (!favsGrid || !favsSection) return;
  const favGames = GAMES.filter(g => isFav(g.id));
  favsGrid.innerHTML = '';
  if (favGames.length > 0) {
    favGames.forEach(g => favsGrid.appendChild(createCard(g)));
    favsSection.style.display = '';
  } else {
    favsSection.style.display = 'none';
  }
}

function renderGames(list) {
  const grid = document.getElementById('game-grid') || document.getElementById('games-grid');
  if (!grid) return;
  grid.innerHTML = '';
  list.forEach(g => grid.appendChild(createCard(g)));
  renderFavouritesSection();
  renderRecentSection();
}

/* ===================== SEARCH + SORT ===================== */
function applyFilters() {
  const query = (quickSearch?.value || '').toLowerCase().trim();
  const sort = sortSelect?.value || 'featured';
  let list = [...GAMES];
  if (query) list = list.filter(g => g.title.toLowerCase().includes(query) || (g.desc||'').toLowerCase().includes(query));
  if (sort === 'alpha') list.sort((a,b) => a.title.localeCompare(b.title));
  else if (sort === 'recent') list = list.slice().reverse();
  renderGames(list);
}

if (quickSearch) quickSearch.addEventListener('input', debounce(applyFilters, 160));
if (sortSelect) sortSelect.addEventListener('change', applyFilters);

function debounce(fn, wait=120) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();

  if (document.getElementById('game-grid') || document.getElementById('games-grid')) {
    renderGames(GAMES);
  }
  if (document.getElementById('quick-search')) {
    document.getElementById('quick-search').addEventListener('input', debounce(applyFilters, 120));
  }

  initAuthUI(async (user) => {
    await refreshFavsCache();
    if (user && !user.isAnonymous) showToast(`Welcome back! 👋`, 'success');
  });
});

/* ===================== PLAY MODAL ===================== */
const MODAL_ID = 'play-modal';

function openPlayModal(url, title) {
  const modal = document.getElementById(MODAL_ID) || document.querySelector('.modal');
  if (!modal) { window.open(url, '_blank', 'noopener'); return; }

  const iframe = modal.querySelector('iframe');
  const modalTitle = modal.querySelector('[id^="modal-title"]') || modal.querySelector('.modal-header div');
  const openTabBtn = modal.querySelector('[id^="open-tab"]') || modal.querySelector('.tool-btn');
  const closeBtn = modal.querySelector('[id^="close-modal"]') || modal.querySelector('.tool-btn[aria-label="Close"]');
  const embedWarning = modal.querySelector('.embed-warning');

  if (modalTitle) modalTitle.textContent = title;
  modal.setAttribute('aria-hidden', 'false');
  if (openTabBtn) openTabBtn.onclick = () => window.open(url, '_blank', 'noopener');

  const closeModal = () => { modal.setAttribute('aria-hidden','true'); if(iframe) iframe.src='about:blank'; };
  if (closeBtn) closeBtn.onclick = closeModal;
  modal.querySelectorAll('[data-close]').forEach(el => el.onclick = closeModal);
  window.addEventListener('keydown', function escClose(e) { if(e.key==='Escape'){ closeModal(); window.removeEventListener('keydown',escClose); } });

  if (iframe) {
    embedWarning?.classList.add('hidden');
    iframe.src = url;
    let loaded = false;
    iframe.addEventListener('load', () => { loaded=true; embedWarning?.classList.add('hidden'); }, { once:true });
    setTimeout(() => {
      if (!loaded) {
        embedWarning?.classList.remove('hidden');
        const fb = embedWarning?.querySelector('a');
        if (fb) { fb.href=url; fb.onclick=()=>{ window.open(url,'_blank','noopener'); return true; }; }
      }
    }, 2200);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

document.addEventListener('click', (e) => {
  if (!e.target) return;
  if (e.target.matches('[data-close]') || e.target.classList.contains('modal-backdrop')) {
    const m = e.target.closest('.modal');
    if (m) { m.setAttribute('aria-hidden','true'); const iframe=m.querySelector('iframe'); if(iframe) iframe.src='about:blank'; }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key==='Escape') {
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => {
      m.setAttribute('aria-hidden','true');
      const iframe=m.querySelector('iframe'); if(iframe) iframe.src='about:blank';
    });
  }
});
