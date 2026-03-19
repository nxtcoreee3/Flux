/* script.js — Flux
   Features: game rendering, play modal, search/sort,
   favorites (cloud+local), dark mode, toasts, recently played, new badge, stats button
*/

import { initAuthUI, loadCloudFavs, saveCloudFavs, syncProfileFavs, syncProfileRecents, initPresence, initStatsButton, trackDailyVisitor, initServerStatus, initBroadcast, initChaos, initJumpscare, initCookieConsent, trackLoginStreak, trackTimeOnSite, trackGamePlay, fetchHotGame, fetchGameFirstSeen, fetchAllGameStats, setCurrentlyPlaying, clearCurrentlyPlaying, rateGame, getUserRating, reportGame } from './firebase-auth.js';

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
  },
  {
    id: 'drift-boss',
    title: 'Drift Boss',
    thumb: 'assets/drift-boss.png',
    url: 'https://nxtcoreee3.github.io/Drift-Boss/',
    desc: 'Drift around tight corners and stay on the track as long as possible.'
  },
  {
    id: 'polytrack',
    title: 'Polytrack',
    thumb: 'assets/polytrack.png',
    url: 'https://nxtcoreee3.github.io/Polytrack/',
    desc: 'Drive and race against your older records.'
  },
  {
    id: 'crazy-motorcycle',
    title: 'Crazy Motorcycle',
    thumb: 'assets/crazy-motorcycle.png',
    url: 'https://nxtcoreee3.github.io/Crazy-Motorcycle/',
    desc: 'Ride through obstacle-filled tracks, jump gaps, and reach the finish line.'
  },
  {
    id: 'crazy-cars',
    title: 'Crazy Cars',
    thumb: 'assets/crazy-cars.png',
    url: 'https://nxtcoreee3.github.io/Crazy-Cars/',
    desc: 'Race at high speed while dodging traffic and obstacles.'
  },
  {
    id: 'table-tennis-world-tour',
    title: 'Table Tennis World Tour',
    thumb: 'assets/table-tennis-world-tour.png',
    url: 'https://nxtcoreee3.github.io/Table-Tennis-World-Tour/',
    desc: 'Play fast‑paced table tennis matches against players worldwide.'
  },
  {
    id: 'moto-x3m',
    title: 'Moto X3M',
    thumb: 'assets/moto-x3m.png',
    url: 'https://nxtcoreee3.github.io/Moto-X3M/',
    desc: 'Race through crazy bike levels, do stunts, and beat the clock.'
  },
  {
    id: '8-ball-classic',
    title: '8 Ball Classic',
    thumb: 'assets/8-ball-classic.png',
    url: 'https://nxtcoreee3.github.io/8-Ball-Classic/',
    desc: 'Play classic 8-ball pool against friends or the AI in a fun, simple game.'
  }
];

// expose game count globally for stats button
window._FLUX_GAME_COUNT = GAMES.length;
window._FLUX_GAMES = GAMES;

// Hot game and new game tracking
let _hotGameId = null;
let _allGameStats = {}; // gameId -> { compatibility, ratingTotal, ratingCount, firstSeen }
const _newGameCache = {}; // gameId -> firstSeen timestamp
const NEW_GAME_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function loadHotGame() {
  const hot = await fetchHotGame();
  if (hot) {
    _hotGameId = hot.id;
    applyFilters(); // re-render with badge
  }
}

async function isNewGame(gameId) {
  if (_newGameCache[gameId] !== undefined) {
    return _newGameCache[gameId] && (Date.now() - new Date(_newGameCache[gameId]).getTime() < NEW_GAME_TTL);
  }
  const firstSeen = await fetchGameFirstSeen(gameId);
  _newGameCache[gameId] = firstSeen;
  return firstSeen && (Date.now() - new Date(firstSeen).getTime() < NEW_GAME_TTL);
}

/* --- Utilities --- */
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
  syncProfileRecents(recent);
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
  await syncProfileFavs(_favsCache);
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

  const isHot = _hotGameId === game.id;
  const isNew = _newGameCache[game.id] && (Date.now() - new Date(_newGameCache[game.id]).getTime() < NEW_GAME_TTL);
  const stats = _allGameStats[game.id] || {};
  const compat = stats.compatibility || '';
  const avgRating = stats.ratingCount ? (stats.ratingTotal / stats.ratingCount).toFixed(1) : null;

  const compatBadge = compat === 'ipad'
    ? '<span class="compat-badge" data-tip="📱 Touchscreen compatible — works great on iPad and touch devices">📱 iPad</span>'
    : compat === 'pc'
    ? '<span class="compat-badge" data-tip="🖥️ Requires a keyboard — best played on PC or laptop">🖥️ PC Only</span>'
    : compat === 'both'
    ? '<span class="compat-badge" data-tip="✅ Works on both — touchscreen friendly and also works with a keyboard">✅ iPad & PC</span>'
    : '';

  const ratingHTML = avgRating
    ? `<span style="font-size:11px;color:#f59e0b;font-weight:700;">★ ${avgRating} <span style="color:var(--muted);font-weight:400;">(${stats.ratingCount})</span></span>`
    : '';

  div.innerHTML = `
    ${isHot ? '<span class="hot-badge">🔥 HOT</span>' : ''}
    ${isNew && !isHot ? '<span class="new-badge">NEW</span>' : ''}
    <img class="thumb" src="${game.thumb}" alt="${game.title} thumbnail" loading="lazy">
    <div class="card-body">
      <h3 class="title">${game.title}</h3>
      <div class="meta">${game.desc || ''}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
        ${compatBadge}
        ${ratingHTML}
      </div>
    </div>
    <div class="card-foot">
      <div style="display:flex;gap:8px;align-items:center">
        <button class="favorite" title="Toggle favourite" aria-pressed="${isFav(game.id)}">${isFav(game.id) ? '★' : '☆'}</button>
        <button class="rate-btn" title="Rate game" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted);">☆ Rate</button>
        <button class="report-btn" title="Report game" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--muted);">⚑</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
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

  // Rating
  div.querySelector('.rate-btn').addEventListener('click', () => showRatingModal(game));

  // Report
  div.querySelector('.report-btn').addEventListener('click', () => showReportModal(game));

  div.querySelector('.play-btn').addEventListener('click', (e) => {
    addRecent(game.id);
    renderRecentSection();
    trackGamePlay(game.id, game.title).then(() => {
      fetchHotGame().then(hot => {
        if (hot && hot.id !== _hotGameId) { _hotGameId = hot.id; applyFilters(); }
      });
    });
    setCurrentlyPlaying(game.id, game.title);
    openPlayModal(e.currentTarget.dataset.url, e.currentTarget.dataset.title);
  });

  return div;
}

function showRatingModal(game) {
  const existing = document.getElementById('rating-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'rating-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);';

  const userRating = _allGameStats[game.id]?.userRating || 0;
  modal.innerHTML = `
    <div style="background:var(--panel);border-radius:20px;padding:28px;width:100%;max-width:340px;box-shadow:0 30px 80px rgba(0,0,0,0.2);text-align:center;position:relative;">
      <button id="rating-close" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      <div style="font-size:32px;margin-bottom:8px;">⭐</div>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text);margin:0 0 6px;">${game.title}</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 16px;">How would you rate this game?</p>
      <div id="star-row" style="display:flex;justify-content:center;gap:8px;margin-bottom:16px;">
        ${[1,2,3,4,5].map(s => `<button class="star-btn" data-star="${s}" style="background:none;border:none;font-size:32px;cursor:pointer;transition:transform 0.1s;color:${s <= userRating ? '#f59e0b' : '#d1d5db'};">★</button>`).join('')}
      </div>
      <p id="rating-msg" style="font-size:12px;color:var(--muted);margin:0;min-height:18px;"></p>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('rating-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  const stars = modal.querySelectorAll('.star-btn');
  stars.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const val = parseInt(btn.dataset.star);
      stars.forEach(s => s.style.color = parseInt(s.dataset.star) <= val ? '#f59e0b' : '#d1d5db');
    });
    btn.addEventListener('mouseleave', () => {
      const cur = parseInt(modal.querySelector('.star-btn[data-active]')?.dataset.star || 0);
      stars.forEach(s => s.style.color = parseInt(s.dataset.star) <= cur ? '#f59e0b' : '#d1d5db');
    });
    btn.addEventListener('click', async () => {
      const rating = parseInt(btn.dataset.star);
      stars.forEach(s => { s.removeAttribute('data-active'); });
      btn.setAttribute('data-active', '1');
      stars.forEach(s => s.style.color = parseInt(s.dataset.star) <= rating ? '#f59e0b' : '#d1d5db');
      const result = await rateGame(game.id, game.title, rating);
      const msgEl = document.getElementById('rating-msg');
      if (result.ok) {
        msgEl.style.color = '#22c55e';
        msgEl.textContent = '✓ Rating saved!';
        // Update local cache
        if (!_allGameStats[game.id]) _allGameStats[game.id] = {};
        _allGameStats[game.id].userRating = rating;
        setTimeout(() => modal.remove(), 1000);
      } else {
        msgEl.style.color = '#ef4444';
        msgEl.textContent = result.error;
      }
    });
  });
}

function showReportModal(game) {
  const existing = document.getElementById('report-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'report-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);';
  modal.innerHTML = `
    <div style="background:var(--panel);border-radius:20px;padding:28px;width:100%;max-width:340px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;">
      <button id="report-close" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text);margin:0 0 6px;">Report ${game.title}</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 14px;">What's wrong with this game?</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
        ${['Game is broken / won\'t load','Game crashes my browser','Content is inappropriate','Other'].map(r =>
          `<button class="report-reason-btn" data-reason="${r}" style="padding:10px 14px;text-align:left;border:1px solid var(--glass-border);border-radius:10px;background:var(--bg);color:var(--text);font-size:13px;cursor:pointer;transition:border-color 0.15s;">${r}</button>`
        ).join('')}
      </div>
      <p id="report-msg" style="font-size:12px;text-align:center;margin:0;min-height:18px;"></p>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('report-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.report-reason-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.borderColor = 'var(--accent)');
    btn.addEventListener('mouseleave', () => btn.style.borderColor = 'var(--glass-border)');
    btn.addEventListener('click', async () => {
      const result = await reportGame(game.id, game.title, btn.dataset.reason);
      const msgEl = document.getElementById('report-msg');
      msgEl.style.color = result.ok ? '#22c55e' : '#ef4444';
      msgEl.textContent = result.ok ? '✓ Report sent to admins. Thanks!' : result.error;
      if (result.ok) setTimeout(() => modal.remove(), 1500);
    });
  });
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
  initCookieConsent();
  initDarkMode();
  initStatsButton();
  initPresence();
  initServerStatus();
  initBroadcast();
  initChaos();
  initJumpscare();
  trackDailyVisitor();
  injectBuildNumber();
  showSocialBanner();
  initMobileWarning();

  if (document.getElementById('quick-search')) {
    document.getElementById('quick-search').addEventListener('input', debounce(applyFilters, 120));
  }

  initAuthUI(async (user) => {
    await refreshFavsCache();
    if (user && !user.isAnonymous) {
      trackLoginStreak();
      trackTimeOnSite();
      if (!sessionStorage.getItem('flux_welcomed')) {
        showToast(`Welcome back! 👋`, 'success');
        sessionStorage.setItem('flux_welcomed', '1');
      }
    }
  });

  // Load favs from cloud then render games so stars are correct from the start
  loadCloudFavs().then(async cloud => {
    if (cloud !== null) { _favsCache = cloud; saveLocalFavs(cloud); }
    // Load all game stats (hot, new, compatibility, ratings) before rendering
    _allGameStats = await fetchAllGameStats();
    const hotGame = await fetchHotGame();
    if (hotGame) _hotGameId = hotGame.id;
    // Populate newGameCache from allGameStats
    GAMES.forEach(g => { _newGameCache[g.id] = _allGameStats[g.id]?.firstSeen || null; });
    if (document.getElementById('game-grid') || document.getElementById('games-grid')) {
      renderGames(GAMES);
    }
  });
});

/* ===================== MOBILE WARNING ===================== */
function initMobileWarning() {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    && ('ontouchstart' in window || navigator.maxTouchPoints > 1);
  if (!isMobile) return;

  const deviceModel = (() => {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    const m = ua.match(/\(Linux;.*?;\s*(.*?)\s*Build/);
    if (m) return m[1];
    return ua.match(/\(([^)]+)\)/)?.[1] || 'Unknown Mobile';
  })();

  const skipKey = 'flux_mobile_skip';
  if (localStorage.getItem(skipKey) === '1') return;

  // Check Firestore blacklist before showing
  const showWarning = () => {
    const overlay = document.createElement('div');
    overlay.id = 'mobile-warn-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99995;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    overlay.innerHTML = `
      <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.3);text-align:center;font-family:inherit;">
        <div style="font-size:44px;margin-bottom:12px;">📱</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text,#111827);margin-bottom:8px;letter-spacing:0.5px;">Not Optimized for Mobile</div>
        <p style="font-size:14px;color:var(--muted,#6b7280);line-height:1.6;margin:0 0 24px;">Flux is designed for desktop browsers. Some features and games may not work correctly on your device.</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="mobile-warn-continue" style="padding:13px 20px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Continue Anyway</button>
          <button id="mobile-warn-notmobile" style="padding:13px 20px;background:var(--bg,#f3f4f6);color:var(--text,#111827);border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">I'm Not on a Mobile Device</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // "Continue anyway" — ask about sending device info
    document.getElementById('mobile-warn-continue').addEventListener('click', () => {
      overlay.innerHTML = `
        <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.3);text-align:center;font-family:inherit;">
          <div style="font-size:36px;margin-bottom:12px;">📊</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--text,#111827);margin-bottom:8px;">Help Us Improve</div>
          <p style="font-size:13px;color:var(--muted,#6b7280);line-height:1.6;margin:0 0 6px;">Would you like to send your device info to the developers? This helps us identify which devices to officially support.</p>
          <p style="font-size:12px;color:var(--muted,#6b7280);margin:0 0 20px;">Device: <strong style="color:var(--text,#111827);">${deviceModel}</strong></p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="mobile-warn-send" style="padding:12px 20px;background:#22c55e;color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">✓ Yes, Send Info</button>
            <button id="mobile-warn-nosend" style="padding:12px 20px;background:var(--bg,#f3f4f6);color:var(--text,#111827);border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">No Thanks</button>
          </div>
        </div>
      `;

      document.getElementById('mobile-warn-send').addEventListener('click', async () => {
        overlay.remove();
        try {
          const { getFirestore, collection: col, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
          const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
          const firestore = getFirestore(getApp());
          await addDoc(col(firestore, 'deviceRequests'), {
            deviceModel,
            userAgent: navigator.userAgent,
            platform: navigator.platform || '',
            screenW: screen.width,
            screenH: screen.height,
            submittedAt: serverTimestamp(),
            status: 'pending'
          });
        } catch (err) { console.warn('Device report failed:', err); }
      });

      document.getElementById('mobile-warn-nosend').addEventListener('click', () => { overlay.remove(); });
    });

    // "Not on mobile" — suppress popup permanently for this browser
    document.getElementById('mobile-warn-notmobile').addEventListener('click', () => {
      localStorage.setItem(skipKey, '1');
      overlay.remove();
    });
  };

  // Check Firestore blacklist for this device model
  (async () => {
    try {
      const { getFirestore, doc: docRef, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const firestore = getFirestore(getApp());
      const key = deviceModel.replace(/\s+/g, '_');
      const snap = await getDoc(docRef(firestore, 'mobileBlacklist', key));
      if (snap.exists()) return; // blacklisted — don't show
    } catch {}
    showWarning();
  })();
}

function showSocialBanner() {
  // Don't show on social page itself
  if (window.location.pathname.includes('social.html')) return;

  const banner = document.createElement('div');
  banner.id = 'social-beta-banner';
  banner.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    z-index:9000;display:flex;align-items:center;gap:12px;
    background:var(--panel, #fff);
    border:1px solid var(--glass-border, rgba(0,0,0,0.08));
    border-radius:16px;padding:12px 16px;
    box-shadow:0 12px 40px rgba(0,0,0,0.15);
    max-width:420px;width:calc(100vw - 48px);
    animation:banner-slide-up 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
  `;
  banner.innerHTML = `
    <style>
      @keyframes banner-slide-up { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      @keyframes beta-pulse-banner { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:0} }
      #social-beta-banner .bp::before { content:''; position:absolute; inset:-2px; border-radius:20px; background:linear-gradient(135deg,#f59e0b,#ef4444); opacity:0.4; animation:beta-pulse-banner 2s ease-in-out infinite; z-index:-1; }
    </style>
    <span style="font-size:24px;flex-shrink:0;">💬</span>
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
        <span style="font-size:14px;font-weight:700;color:var(--text,#111827);">Chat with other players!</span>
        <span class="bp" style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;letter-spacing:0.8px;text-transform:uppercase;position:relative;">Beta</span>
      </div>
      <div style="font-size:12px;color:var(--muted,#6b7280);">Profiles, follows & global chat — now live.</div>
    </div>
    <a href="social.html" style="padding:8px 14px;background:var(--accent,#3a7dff);color:white;border-radius:10px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0;">Try it →</a>
    <button id="social-banner-close" style="background:none;border:none;color:var(--muted,#9ca3af);cursor:pointer;font-size:18px;padding:0 0 0 4px;flex-shrink:0;line-height:1;">✕</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('social-banner-close').addEventListener('click', () => {
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(-50%) translateY(20px)';
    banner.style.transition = 'all 0.25s ease';
    setTimeout(() => banner.remove(), 250);
  });

  // Auto-dismiss after 8s
  setTimeout(() => {
    if (document.getElementById('social-beta-banner')) {
      document.getElementById('social-banner-close')?.click();
    }
  }, 8000);
}

/* ===================== BUILD SHA ===================== */
async function injectBuildNumber() {
  try {
    const res = await fetch('https://api.github.com/repos/nxtcoreee3/Flux/commits/main', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return;
    const data = await res.json();
    const sha = data.sha?.slice(0, 7);
    if (!sha) return;
    window._fluxBuildSHA = sha;
    window._fluxBuildURL = `https://github.com/nxtcoreee3/Flux/commit/${data.sha}`;
    window._fluxBuildMsg = (data.commit?.message || '').replace(/"/g, '').split('\n')[0];
    const tryInject = () => {
      const dd = document.getElementById('profile-dropdown');
      if (!dd || dd.querySelector('.build-sha-item')) return;
      const item = document.createElement('div');
      item.className = 'build-sha-item';
      item.style.cssText = 'padding:10px 16px;border-top:1px solid var(--glass-border,rgba(0,0,0,0.06));font-size:11px;color:var(--muted,#6b7280);display:flex;align-items:center;gap:6px;';
      item.innerHTML = `<span>🔨</span> Build: <a href="${window._fluxBuildURL}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;font-family:monospace;font-weight:700;" title="${window._fluxBuildMsg}">${sha}</a>`;
      dd.appendChild(item);
    };
    tryInject();
    const obs = new MutationObserver(tryInject);
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 30000);
  } catch {}
}

/* ===================== FULLSCREEN ===================== */
function openFullscreen(url, title) {
  document.getElementById('flux-fullscreen')?.remove();
  const fs = document.createElement('div');
  fs.id = 'flux-fullscreen';
  fs.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#000;display:flex;flex-direction:column;';
  fs.innerHTML = `
    <div id="fs-bar" style="position:absolute;top:0;left:0;right:0;z-index:2;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(to bottom,rgba(0,0,0,0.75),transparent);transition:opacity 0.3s;">
      <button id="fs-exit" style="background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px);">✕ Exit</button>
      <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);flex:1;">${title}</span>
      <button id="fs-newtab" style="display:none;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;backdrop-filter:blur(4px);">↗ Open in New Tab</button>
    </div>
    <iframe id="fs-iframe" src="${url}" style="flex:1;border:0;width:100%;height:100%;" allow="autoplay; fullscreen" sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
    <div id="fs-embed-warn" style="display:none;position:absolute;inset:0;z-index:3;display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:rgba(0,0,0,0.85);">
      <span style="font-size:32px;">🚫</span>
      <span style="color:white;font-size:15px;font-weight:600;">This game can't be embedded.</span>
      <button id="fs-fallback-btn" style="background:#3a7dff;color:white;border:none;border-radius:10px;padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;">↗ Open in New Tab</button>
    </div>
  `;
  document.body.appendChild(fs);
  const bar = fs.querySelector('#fs-bar');
  const fsIframe = fs.querySelector('#fs-iframe');
  const fsWarn = fs.querySelector('#fs-embed-warn');
  const fsNewTab = fs.querySelector('#fs-newtab');
  let barTimer;
  const showBar = () => { bar.style.opacity = '1'; clearTimeout(barTimer); barTimer = setTimeout(() => { bar.style.opacity = '0'; }, 3000); };
  showBar();
  fs.addEventListener('mousemove', showBar);
  fs.addEventListener('touchstart', showBar, { passive: true });
  fs.querySelector('#fs-exit').addEventListener('click', () => fs.remove());
  fsNewTab.addEventListener('click', () => window.open(url, '_blank', 'noopener'));
  fs.querySelector('#fs-fallback-btn').addEventListener('click', () => window.open(url, '_blank', 'noopener'));
  // Detect embed failure
  let fsLoaded = false;
  fsIframe.addEventListener('load', () => { fsLoaded = true; }, { once: true });
  setTimeout(() => {
    if (!fsLoaded) {
      fsWarn.style.display = 'flex';
      fsNewTab.style.display = '';
    }
  }, 2200);
  const escHandler = (e) => { if (e.key === 'Escape') { fs.remove(); window.removeEventListener('keydown', escHandler); } };
  window.addEventListener('keydown', escHandler);
}

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
  const tools = modal.querySelector('.modal-tools');

  if (modalTitle) modalTitle.textContent = title;
  modal.setAttribute('aria-hidden', 'false');
  if (openTabBtn) { openTabBtn.style.display = 'none'; openTabBtn.onclick = () => window.open(url, '_blank', 'noopener'); }

  // Add fullscreen button if not already present
  let fsBtn = tools?.querySelector('.fs-btn');
  if (tools && !fsBtn) {
    fsBtn = document.createElement('button');
    fsBtn.className = 'tool-btn fs-btn';
    fsBtn.textContent = '⛶ Fullscreen';
    tools.insertBefore(fsBtn, tools.firstChild);
  }
  if (fsBtn) { fsBtn.style.display = ''; fsBtn.onclick = () => { closeModal(); openFullscreen(url, title); }; }

  const closeModal = () => { modal.setAttribute('aria-hidden','true'); if(iframe) iframe.src='about:blank'; clearCurrentlyPlaying(); };
  if (closeBtn) closeBtn.onclick = closeModal;
  modal.querySelectorAll('[data-close]').forEach(el => el.onclick = closeModal);
  window.addEventListener('keydown', function escClose(e) { if(e.key==='Escape'){ closeModal(); window.removeEventListener('keydown',escClose); } });

  if (iframe) {
    embedWarning?.classList.add('hidden');
    if (fsBtn) fsBtn.style.display = '';
    iframe.src = url;
    let loaded = false;
    iframe.addEventListener('load', () => { loaded=true; embedWarning?.classList.add('hidden'); }, { once:true });
    setTimeout(() => {
      if (!loaded) {
        embedWarning?.classList.remove('hidden');
        if (fsBtn) fsBtn.style.display = 'none'; // hide if embedding blocked
        if (openTabBtn) openTabBtn.style.display = ''; // show new tab only now
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

/* ===================== TUTORIAL ===================== */
(function() {
  const TUTORIAL_KEY = 'flux_tutorial_done';
  const TUTORIAL_OFFERED_KEY = 'flux_tutorial_offered';

  const STEPS = [
    {
      target: () => document.querySelector('.nav-list'),
      title: 'Navigation',
      body: 'Use the nav bar to jump between Home, Games, Social, Messages and more. On mobile it scrolls sideways.',
      position: 'bottom',
      page: 'any',
    },
    {
      target: () => document.getElementById('game-grid')?.querySelector('.card') || document.getElementById('games-grid')?.querySelector('.card'),
      title: 'Game Cards',
      body: 'Each card shows a game thumbnail, description, compatibility badge and rating. Hover to see more details.',
      position: 'right',
      page: 'any',
    },
    {
      target: () => document.querySelector('.play-btn'),
      title: 'Play a Game',
      body: 'Hit Play to launch the game in a popup. Use ⛶ Fullscreen to go full-screen. If embedding fails, you\'ll get a link to open it in a new tab.',
      position: 'top',
      page: 'any',
    },
    {
      target: () => document.querySelector('.favorite'),
      title: 'Favourites ★',
      body: 'Click the star on any card to add it to your Favourites. Favourites sync across all your devices when signed in.',
      position: 'top',
      page: 'any',
    },
    {
      target: () => document.getElementById('quick-search') || document.getElementById('games-search'),
      title: 'Search Games',
      body: 'Type here to instantly filter games by name or description. Works in real time.',
      position: 'bottom',
      page: 'any',
    },
    {
      target: () => document.querySelector('#sort-select'),
      title: 'Sort Games',
      body: 'Sort games by Featured order, A→Z alphabetical, or Recently Added.',
      position: 'bottom',
      page: 'games',
    },
    {
      target: () => document.querySelector('.nav .right-actions, .right-actions'),
      title: 'Your Profile',
      body: 'Click your name/avatar up here to open the profile menu — access favourites, dark mode, social, messages, and more.',
      position: 'bottom',
      page: 'any',
    },
    {
      target: () => document.querySelector('[id^="visitor-count"]')?.parentElement,
      title: 'Live Stats 👁️',
      body: 'The eye icon in the nav shows how many players are online right now, plus peak users and total visits.',
      position: 'top',
      page: 'any',
    },
    {
      target: null,
      title: 'You\'re all set! 🎉',
      body: 'That\'s the tour! Jump into Games to start playing, or visit Social to chat with other players.',
      position: 'center',
      page: 'any',
    },
  ];

  function getVisibleSteps() {
    return STEPS.filter(s => {
      if (s.page === 'games' && !window.location.pathname.includes('games')) return false;
      return true;
    });
  }

  let _currentStep = 0;
  let _steps = [];
  let _overlay = null;
  let _spotlight = null;
  let _tooltip = null;
  let _resizeObs = null;

  function cleanup() {
    _overlay?.remove(); _overlay = null;
    _spotlight?.remove(); _spotlight = null;
    _tooltip?.remove(); _tooltip = null;
    if (_resizeObs) { _resizeObs.disconnect(); _resizeObs = null; }
    document.removeEventListener('keydown', _keyHandler);
  }

  function _keyHandler(e) {
    if (e.key === 'ArrowRight' || e.key === 'Enter') advance(1);
    else if (e.key === 'ArrowLeft') advance(-1);
    else if (e.key === 'Escape') endTutorial();
  }

  function endTutorial() {
    cleanup();
    localStorage.setItem(TUTORIAL_KEY, '1');
  }

  function positionTooltip(targetEl, pos, tooltipEl) {
    if (!targetEl || pos === 'center') {
      tooltipEl.style.top = '50%';
      tooltipEl.style.left = '50%';
      tooltipEl.style.transform = 'translate(-50%, -50%)';
      tooltipEl.style.position = 'fixed';
      return;
    }
    const rect = targetEl.getBoundingClientRect();
    const tw = tooltipEl.offsetWidth || 300;
    const th = tooltipEl.offsetHeight || 150;
    const gap = 16;
    let top, left;
    tooltipEl.style.transform = '';
    tooltipEl.style.position = 'fixed';

    if (pos === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tw / 2;
    } else if (pos === 'top') {
      top = rect.top - th - gap;
      left = rect.left + rect.width / 2 - tw / 2;
    } else if (pos === 'right') {
      top = rect.top + rect.height / 2 - th / 2;
      left = rect.right + gap;
    } else {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tw / 2;
    }
    // Clamp to viewport
    left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - th - 12));
    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
  }

  function spotlightEl(el) {
    if (!el || !_spotlight) { if (_spotlight) _spotlight.style.cssText = 'display:none'; return; }
    const rect = el.getBoundingClientRect();
    const pad = 8;
    _spotlight.style.cssText = `
      position:fixed;
      top:${rect.top - pad}px;
      left:${rect.left - pad}px;
      width:${rect.width + pad*2}px;
      height:${rect.height + pad*2}px;
      border-radius:12px;
      box-shadow:0 0 0 9999px rgba(0,0,0,0.55);
      z-index:99996;
      pointer-events:none;
      transition:all 0.3s cubic-bezier(0.4,0,0.2,1);
      border:2px solid rgba(58,125,255,0.8);
    `;
  }

  function renderStep(idx) {
    const step = _steps[idx];
    if (!step) { endTutorial(); return; }
    const targetEl = step.target ? step.target() : null;

    // Scroll target into view
    if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    // Spotlight
    setTimeout(() => {
      spotlightEl(targetEl);

      // Arrow direction
      const arrowMap = { bottom: '↑', top: '↓', right: '←', left: '→', center: '' };
      const arrow = step.position !== 'center' && targetEl ? arrowMap[step.position] || '' : '';

      _tooltip.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;">
          <div style="font-size:11px;font-weight:700;color:var(--accent,#3a7dff);letter-spacing:0.5px;text-transform:uppercase;">Step ${idx + 1} of ${_steps.length}</div>
          <button id="tut-close" style="background:none;border:none;color:var(--muted,#6b7280);font-size:16px;cursor:pointer;line-height:1;padding:0;flex-shrink:0;" title="Close tutorial">✕</button>
        </div>
        ${arrow ? `<div style="font-size:28px;text-align:center;margin-bottom:6px;color:var(--accent,#3a7dff);">${arrow}</div>` : ''}
        <div style="font-weight:700;font-size:16px;color:var(--text,#111827);margin-bottom:8px;">${step.title}</div>
        <div style="font-size:13px;color:var(--muted,#6b7280);line-height:1.6;margin-bottom:18px;">${step.body}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${idx > 0 ? `<button id="tut-back" style="padding:8px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:10px;background:none;font-size:13px;font-weight:600;cursor:pointer;color:var(--text,#111827);">← Back</button>` : '<span style="flex:1"></span>'}
          <div style="flex:1;display:flex;gap:4px;align-items:center;justify-content:center;">
            ${_steps.map((_, i) => `<span style="width:${i===idx?'18':'6'}px;height:6px;border-radius:3px;background:${i===idx?'var(--accent,#3a7dff)':'var(--glass-border,rgba(0,0,0,0.12))'};transition:all 0.2s;display:inline-block;"></span>`).join('')}
          </div>
          <button id="tut-next" style="padding:8px 18px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">
            ${idx === _steps.length - 1 ? '🎉 Done' : 'Next →'}
          </button>
        </div>
      `;

      positionTooltip(targetEl, step.position, _tooltip);

      document.getElementById('tut-next').addEventListener('click', () => advance(1));
      document.getElementById('tut-back')?.addEventListener('click', () => advance(-1));
      document.getElementById('tut-close').addEventListener('click', endTutorial);
    }, targetEl ? 320 : 0);
  }

  function advance(dir) {
    _currentStep = Math.max(0, Math.min(_currentStep + dir, _steps.length - 1));
    if (dir > 0 && _currentStep >= _steps.length) { endTutorial(); return; }
    renderStep(_currentStep);
    if (_currentStep === _steps.length - 1 && dir > 0) {
      // On last step, clicking Next again ends
      setTimeout(() => {
        const nextBtn = document.getElementById('tut-next');
        if (nextBtn) nextBtn.addEventListener('click', endTutorial, { once: true });
      }, 50);
    }
  }

  function launchTutorial() {
    cleanup();
    _steps = getVisibleSteps();
    _currentStep = 0;

    // Dim overlay (click-through)
    _overlay = document.createElement('div');
    _overlay.id = 'flux-tutorial-overlay';
    _overlay.style.cssText = 'position:fixed;inset:0;z-index:99995;pointer-events:none;';
    document.body.appendChild(_overlay);

    // Spotlight ring
    _spotlight = document.createElement('div');
    _spotlight.id = 'flux-tutorial-spotlight';
    document.body.appendChild(_spotlight);

    // Tooltip card
    _tooltip = document.createElement('div');
    _tooltip.id = 'flux-tutorial-tooltip';
    _tooltip.style.cssText = `
      position:fixed;z-index:99997;
      background:var(--panel,#fff);
      border:1px solid var(--glass-border,rgba(0,0,0,0.08));
      border-radius:16px;padding:18px 18px 16px;
      width:300px;max-width:calc(100vw - 24px);
      box-shadow:0 20px 60px rgba(0,0,0,0.2);
      font-family:inherit;
      pointer-events:all;
      transition:top 0.3s cubic-bezier(0.4,0,0.2,1), left 0.3s cubic-bezier(0.4,0,0.2,1);
    `;
    document.body.appendChild(_tooltip);

    document.addEventListener('keydown', _keyHandler);

    // Reposition on resize
    _resizeObs = new ResizeObserver(() => {
      const step = _steps[_currentStep];
      if (!step) return;
      const el = step.target ? step.target() : null;
      spotlightEl(el);
      positionTooltip(el, step.position, _tooltip);
    });
    _resizeObs.observe(document.body);

    renderStep(0);
  }

  // Offer prompt for existing users
  function showTutorialOffer() {
    const offer = document.createElement('div');
    offer.id = 'flux-tutorial-offer';
    offer.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      z-index:9001;display:flex;align-items:center;gap:14px;
      background:var(--panel,#fff);border:1px solid var(--glass-border,rgba(0,0,0,0.08));
      border-radius:16px;padding:14px 18px;
      box-shadow:0 12px 40px rgba(0,0,0,0.15);
      max-width:440px;width:calc(100vw - 48px);
      animation:tut-offer-up 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
      font-family:inherit;
    `;
    offer.innerHTML = `
      <style>@keyframes tut-offer-up { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }</style>
      <span style="font-size:28px;flex-shrink:0;">🎓</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text,#111827);margin-bottom:2px;">Want a quick tour?</div>
        <div style="font-size:12px;color:var(--muted,#6b7280);">Learn how to get the most out of Flux in 60 seconds.</div>
      </div>
      <button id="tut-offer-yes" style="padding:8px 14px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0;font-family:inherit;">Show me →</button>
      <button id="tut-offer-no" style="background:none;border:none;color:var(--muted,#9ca3af);cursor:pointer;font-size:18px;padding:0 0 0 4px;flex-shrink:0;line-height:1;">✕</button>
    `;
    document.body.appendChild(offer);

    const dismiss = () => {
      offer.style.opacity = '0';
      offer.style.transform = 'translateX(-50%) translateY(16px)';
      offer.style.transition = 'all 0.2s ease';
      setTimeout(() => offer.remove(), 220);
      localStorage.setItem(TUTORIAL_OFFERED_KEY, '1');
    };

    document.getElementById('tut-offer-yes').addEventListener('click', () => { dismiss(); setTimeout(launchTutorial, 300); });
    document.getElementById('tut-offer-no').addEventListener('click', dismiss);
    setTimeout(dismiss, 12000);
  }

  // Public API
  window.startFluxTutorial = function({ force = false, isNew = false } = {}) {
    // Only run on pages that have game content
    const hasContent = document.getElementById('game-grid') || document.getElementById('games-grid');
    if (!hasContent && !force) return;

    if (force) { launchTutorial(); return; }

    if (localStorage.getItem(TUTORIAL_KEY)) return; // already completed

    if (isNew) {
      // Brand new user — start tutorial automatically
      launchTutorial();
    } else {
      // Existing user — offer once
      if (localStorage.getItem(TUTORIAL_OFFERED_KEY)) return;
      showTutorialOffer();
    }
  };
})();

/* ===================== FLOATING TOOLTIP ===================== */
(function() {
  const tip = document.createElement('div');
  tip.id = 'flux-tooltip';
  tip.style.cssText = 'position:fixed;z-index:99999;background:#111827;color:#fff;font-size:12px;font-weight:500;padding:7px 11px;border-radius:9px;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.3);white-space:nowrap;opacity:0;transition:opacity 0.15s ease;max-width:260px;white-space:normal;line-height:1.4;';
  document.body.appendChild(tip);

  document.addEventListener('mouseover', (e) => {
    const badge = e.target.closest('.compat-badge');
    if (!badge) return;
    const text = badge.dataset.tip;
    if (!text) return;
    tip.textContent = text;
    tip.style.opacity = '1';
  });

  document.addEventListener('mousemove', (e) => {
    const badge = e.target.closest('.compat-badge');
    if (!badge) { tip.style.opacity = '0'; return; }
    const x = e.clientX;
    const y = e.clientY;
    tip.style.left = (x - tip.offsetWidth / 2) + 'px';
    tip.style.top = (y - tip.offsetHeight - 10) + 'px';
  });

  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest('.compat-badge')) return;
    tip.style.opacity = '0';
  });
})();
