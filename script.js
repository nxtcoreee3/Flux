/* script.js — Flux
   Features: game rendering, play modal, search/sort,
   favorites (cloud+local), dark mode, toasts, recently played, new badge, stats button
*/

import { initAuthUI, loadCloudFavs, saveCloudFavs, syncProfileFavs, syncProfileRecents, initPresence, initStatsButton, trackDailyVisitor, initServerStatus, initBroadcast, initChaos, initJumpscare, initCookieConsent, trackLoginStreak, trackTimeOnSite, trackGamePlay, fetchHotGame, fetchGameFirstSeen, fetchAllGameStats, setCurrentlyPlaying, clearCurrentlyPlaying, rateGame, getUserRating, reportGame, checkFirestoreHealth, fetchGameDetail, getAiGameDescription, getGameReviews, submitReview, addReviewComment, likeReview, deleteReview, fetchGamePricing, getUnlockedGames, unlockGame, SPIN_SEGMENTS, getLastSpin, spinWheel, giftPointsToUser } from './firebase-auth.js';

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
  },
  {
    id: 'angry-birds',
    title: 'Angry Birds',
    thumb: 'assets/angry-birds.png',
    url: 'https://nxtcoreee3.github.io/Angry-Birds/',
    desc: 'Launch birds with a slingshot to destroy structures and defeat the pigs.'
  },
  {
    id: 'slowroads',
    title: 'slowroads',
    thumb: 'assets/slowroads.png',
    url: 'https://nxtcoreee3.github.io/slowroads/',
    desc: 'Drive endlessly through relaxing scenic roads with no pressure or goals.'
  },
  {
    id: 'fruit-ninja',
    title: 'Fruit Ninja',
    thumb: 'assets/fruit-ninja.png',
    url: 'https://nxtcoreee3.github.io/Fruit-Ninja/',
    desc: 'Slice flying fruits, build combos, and avoid bombs to get a high score.'
  },
  {
    id: '5-nights-at-epsteins',
    title: '5 Nights At Epsteins',
    thumb: 'assets/5-nights-at-epsteins.png',
    url: 'https://nxtcoreee3.github.io/5-Nights-At-Epsteins/',
    desc: 'Survive five nights using cameras, strategy, and quick reactions to avoid danger.'
  },
  {
    id: 'eaglercraft',
    title: 'Eaglercraft',
    thumb: 'assets/eaglercraft.png',
    url: 'https://eaglercraft.app/web/',
    desc: 'Play a browser-based Minecraft-style game with survival, building, and multiplayer. (Hosted by EaglercraftX)'
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

// Pricing + unlock cache
let _unlockedGames = [];
let _gamePricing = {};
window._fluxGamePricing = _gamePricing;

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

// Apply beta immediately from localStorage to avoid flash
(function() {
  if (localStorage.getItem('flux_beta') === '1') {
    document.documentElement.classList.add('beta');
  }
})();

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
  div.style.position = 'relative';

  const isHot = _hotGameId === game.id;
  const isNew = _newGameCache[game.id] && (Date.now() - new Date(_newGameCache[game.id]).getTime() < NEW_GAME_TTL);
  const stats = _allGameStats[game.id] || {};
  const compat = stats.compatibility || '';
  const avgRating = stats.ratingCount ? (stats.ratingTotal / stats.ratingCount).toFixed(1) : null;

  const pricing = _gamePricing[game.id] || { price: 0, discount: 0 };
  const isExpired = pricing.discountExpiry && new Date(pricing.discountExpiry) < new Date();
  const activeDiscount = (!isExpired && pricing.discount > 0) ? pricing.discount : 0;
  const finalPrice = activeDiscount > 0 ? Math.round(pricing.price * (1 - activeDiscount / 100)) : (pricing.price || 0);
  const isLocked = finalPrice > 0 && !_unlockedGames.includes(game.id);

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

  const saleBadge = activeDiscount > 0
    ? `<span style="position:absolute;top:8px;right:8px;background:linear-gradient(135deg,#ef4444,#f97316);color:white;font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;z-index:3;display:inline-block;width:fit-content;box-shadow:0 2px 8px rgba(239,68,68,0.4);">🏷️ ${activeDiscount}% OFF</span>` : '';

  const lockOverlay = isLocked
    ? `<div class="card-lock-overlay" style="position:absolute;inset:0;z-index:4;background:rgba(0,0,0,0.55);border-radius:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;backdrop-filter:blur(2px);cursor:pointer;">
        <span style="font-size:28px;">🔒</span>
        <span style="color:white;font-size:14px;font-weight:800;">${finalPrice} pts</span>
        ${activeDiscount > 0 ? `<span style="color:rgba(255,255,255,0.55);font-size:11px;text-decoration:line-through;">${pricing.price} pts</span>` : ''}
        <span style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:2px;">Tap to unlock</span>
      </div>` : '';

  div.innerHTML = `
    ${isHot ? '<span class="hot-badge">🔥 HOT</span>' : ''}
    ${isNew && !isHot ? '<span class="new-badge">✨ NEW</span>' : ''}
    ${saleBadge}
    ${lockOverlay}
    <img class="thumb" src="${game.thumb}" alt="${game.title} thumbnail" loading="lazy">
    <div class="card-body" style="cursor:pointer;" title="View details">
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
        <button class="play-btn" data-url="${game.url}" data-title="${game.title}">${isLocked ? `🔒 ${finalPrice} pts` : 'Play'}</button>
      </div>
    </div>
  `;

  const favBtn = div.querySelector('.favorite');
  favBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleFav(game.id);
    favBtn.textContent = isFav(game.id) ? '★' : '☆';
    favBtn.classList.toggle('active', isFav(game.id));
    favBtn.setAttribute('aria-pressed', String(isFav(game.id)));
    renderFavouritesSection();
  });
  favBtn.classList.toggle('active', isFav(game.id));

  div.querySelector('.rate-btn').addEventListener('click', (e) => { e.stopPropagation(); showRatingModal(game); });
  div.querySelector('.report-btn').addEventListener('click', (e) => { e.stopPropagation(); showReportModal(game); });

  // Click card body → open detail view
  div.querySelector('.card-body').addEventListener('click', (e) => { e.stopPropagation(); openGameDetail(game); });

  // Click lock overlay → unlock modal
  div.querySelector('.card-lock-overlay')?.addEventListener('click', (e) => {
    e.stopPropagation();
    showUnlockModal(game, finalPrice, activeDiscount, pricing.price);
  });

  div.querySelector('.play-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (isLocked) { showUnlockModal(game, finalPrice, activeDiscount, pricing.price); return; }
    addRecent(game.id);
    renderRecentSection();
    trackGamePlay(game.id, game.title).then(() => {
      fetchHotGame().then(hot => { if (hot && hot.id !== _hotGameId) { _hotGameId = hot.id; applyFilters(); } });
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
  initFirestoreHealthCheck();
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
    window._currentUserUid = user?.uid || null;
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

  // Render immediately so grid always shows
  if (document.getElementById('game-grid') || document.getElementById('games-grid')) {
    renderGames(GAMES);
  }

  // Load cloud data in background then re-render with full info
  loadCloudFavs().then(async cloud => {
    if (cloud !== null) { _favsCache = cloud; saveLocalFavs(cloud); }
    try {
      const [stats, hotGame, pricing, unlocked] = await Promise.all([
        fetchAllGameStats(), fetchHotGame(), fetchGamePricing(), getUnlockedGames()
      ]);
      _allGameStats = stats || {};
      if (hotGame) _hotGameId = hotGame.id;
      GAMES.forEach(g => { _newGameCache[g.id] = _allGameStats[g.id]?.firstSeen || null; });
      Object.assign(_gamePricing, pricing || {});
      window._fluxGamePricing = _gamePricing;
      _unlockedGames = unlocked || [];
    } catch { /* Firebase down — grid already showing */ }
    if (document.getElementById('game-grid') || document.getElementById('games-grid')) {
      renderGames(GAMES);
    }
  }).catch(() => {});
});

/* ===================== MOBILE WARNING ===================== */
function initMobileWarning() {
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    && ('ontouchstart' in window || navigator.maxTouchPoints > 1);
  if (!isMobile) return;

  const deviceModel = (() => {
    const ua = navigator.userAgent;

    // iOS — get exact model from UA hints if available, else use screen size mapping
    if (/iPhone/.test(ua)) {
      // Try to get iPhone generation from screen dimensions (works well)
      const w = Math.min(screen.width, screen.height);
      const h = Math.max(screen.width, screen.height);
      if (w === 430 && h === 932) return 'iPhone 16 Plus / 15 Plus / 14 Plus';
      if (w === 393 && h === 852) return 'iPhone 16 / 15 / 14 Pro';
      if (w === 440 && h === 956) return 'iPhone 16 Pro Max';
      if (w === 402 && h === 874) return 'iPhone 16 Pro';
      if (w === 390 && h === 844) return 'iPhone 14 / 13 / 12';
      if (w === 428 && h === 926) return 'iPhone 13 Pro Max / 12 Pro Max';
      if (w === 375 && h === 812) return 'iPhone 13 Mini / 12 Mini / X / XS / 11 Pro';
      if (w === 414 && h === 896) return 'iPhone 11 / XR / 11 Pro Max / XS Max';
      if (w === 414 && h === 736) return 'iPhone 8 Plus / 7 Plus / 6s Plus';
      if (w === 375 && h === 667) return 'iPhone SE (2nd/3rd Gen) / 8 / 7';
      if (w === 320 && h === 568) return 'iPhone SE (1st Gen) / 5s';
      return 'iPhone';
    }

    if (/iPad/.test(ua)) {
      const w = Math.min(screen.width, screen.height);
      if (w >= 1024) return 'iPad Pro 12.9"';
      if (w === 834) return 'iPad Pro 11" / iPad Air';
      if (w === 820) return 'iPad Air (4th/5th Gen)';
      if (w === 768) return 'iPad (standard)';
      return 'iPad';
    }

    // Android — parse manufacturer + model from UA string
    if (/Android/.test(ua)) {
      // Format: (Linux; Android X.X; ModelName Build/...)
      const modelMatch = ua.match(/;\s*([^;)]+?)\s*(?:Build\/|[);\n])/);
      if (modelMatch) {
        const raw = modelMatch[1].trim();
        // Skip version strings and generic junk
        if (!/^Android|^Linux|^\d+\.\d+/.test(raw) && raw.length > 1) {
          // Map common model codes to friendly names
          const knownModels = {
            'SM-S918': 'Samsung Galaxy S23 Ultra',
            'SM-S908': 'Samsung Galaxy S22 Ultra',
            'SM-S928': 'Samsung Galaxy S24 Ultra',
            'SM-S921': 'Samsung Galaxy S24',
            'SM-S901': 'Samsung Galaxy S22',
            'SM-A546': 'Samsung Galaxy A54',
            'SM-A536': 'Samsung Galaxy A53',
            'SM-G991': 'Samsung Galaxy S21',
            'SM-N986': 'Samsung Galaxy Note 20 Ultra',
            'Pixel 9': 'Google Pixel 9',
            'Pixel 8': 'Google Pixel 8',
            'Pixel 7': 'Google Pixel 7',
            'Pixel 6': 'Google Pixel 6',
            '23049PCD8G': 'Xiaomi 13T',
            '2312DRAAEU': 'Xiaomi 13T Pro',
            'CPH2449': 'OnePlus Nord CE 3',
            'CPH2551': 'OnePlus 12',
            'RMX3771': 'Realme 11 Pro+',
          };
          for (const [code, name] of Object.entries(knownModels)) {
            if (raw.includes(code)) return name;
          }
          return raw; // Return the raw model string — usually readable (e.g. "Pixel 7", "SM-S918B")
        }
      }
      // Fallback: get Android version at least
      const ver = ua.match(/Android\s*([\d.]+)/)?.[1];
      return ver ? `Android ${ver} Device` : 'Android Device';
    }

    // Other mobile (Windows Phone, Opera Mini, etc.)
    if (/Windows Phone/.test(ua)) {
      const m = ua.match(/IEMobile\/[\d.]+;\s*([^;)]+)/);
      return m ? m[1].trim() : 'Windows Phone';
    }

    return navigator.platform || 'Unknown Mobile';
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
          <p style="font-size:12px;color:var(--muted,#6b7280);margin:0 0 20px;">Device: <strong style="color:var(--text,#111827);">${deviceModel}</strong><br><span style="font-size:11px;word-break:break-all;opacity:0.7;">${screen.width}×${screen.height} · ${navigator.platform || 'unknown'}</span></p>
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
            pixelRatio: window.devicePixelRatio || 1,
            language: navigator.language || '',
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

/* ===================== FIRESTORE HEALTH CHECK UI ===================== */
async function initFirestoreHealthCheck() {
  const TIMEOUT_MS = 8000;
  const timeoutPromise = new Promise(r => setTimeout(() => r({ ok: false, error: 'timeout' }), TIMEOUT_MS));
  const result = await Promise.race([checkFirestoreHealth(), timeoutPromise]);
  if (result.ok) return;
  showFirestoreDownBanner(result.error === 'timeout');
  const interval = setInterval(async () => {
    const recheck = await Promise.race([checkFirestoreHealth(), new Promise(r => setTimeout(() => r({ ok: false }), 6000))]);
    if (recheck.ok) {
      document.getElementById('firestore-down-banner')?.remove();
      clearInterval(interval);
      showToast('🟢 Live features are back online!', 'success');
    }
  }, 30000);
}

function showFirestoreDownBanner(isTimeout) {
  if (document.getElementById('firestore-down-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'firestore-down-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99990;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;font-weight:600;flex-wrap:wrap;box-shadow:0 4px 20px rgba(239,68,68,0.3);font-family:inherit;';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
      <span style="font-size:16px;flex-shrink:0;">⚠️</span>
      <span>${isTimeout ? 'Firebase is responding slowly' : 'Firebase appears to be down'} — live features may be unavailable. Games still work.</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
      <button id="firestore-info-btn" style="padding:5px 12px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:8px;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Learn more</button>
      <button id="firestore-banner-close" style="background:none;border:none;color:rgba(255,255,255,0.8);cursor:pointer;font-size:18px;padding:0 4px;line-height:1;">✕</button>
    </div>`;
  document.body.prepend(banner);
  document.getElementById('firestore-banner-close').addEventListener('click', () => banner.remove());
  document.getElementById('firestore-info-btn').addEventListener('click', showFirestoreInfoModal);
}

function showFirestoreInfoModal() {
  document.getElementById('firestore-info-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'firestore-info-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99992;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 26px;max-width:480px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.25);position:relative;">
      <button id="firestore-info-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted,#6b7280);">✕</button>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;"><span style="font-size:36px;">🔥</span><div><div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text,#111);">About Flux's Backend</div><div style="font-size:12px;color:var(--muted,#6b7280);margin-top:2px;">Why some features might be unavailable</div></div></div>
      <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;color:var(--text,#111);line-height:1.65;">
        <div style="background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><div style="font-weight:700;margin-bottom:4px;">⚙️ What powers Flux?</div><div style="color:var(--muted,#6b7280);">Flux uses <strong style="color:var(--text,#111);">Google Firebase</strong> — Firestore and Firebase Auth — for profiles, favourites, ratings, chat, and social features. These run on Google's servers, not ours.</div></div>
        <div style="background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><div style="font-weight:700;margin-bottom:4px;">🚫 What breaks when Firebase goes down?</div><div style="color:var(--muted,#6b7280);">Social, chat, ratings, favourites, and login stop working. <strong style="color:var(--text,#111);">Games still work</strong> — they're hosted separately on GitHub Pages.</div></div>
        <div style="background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><div style="font-weight:700;margin-bottom:4px;">🤷 Can Flux fix it?</div><div style="color:var(--muted,#6b7280);">No — Firebase outages are entirely on Google's end. We have no control over their uptime. Flux will auto-detect when it comes back.</div></div>
        <div style="background:rgba(58,125,255,0.06);border-radius:12px;padding:14px 16px;border:1px solid rgba(58,125,255,0.15);"><div style="font-weight:700;margin-bottom:4px;color:var(--accent,#3a7dff);">📊 Check Firebase status</div><div style="color:var(--muted,#6b7280);">Visit <a href="https://status.firebase.google.com" target="_blank" rel="noopener" style="color:var(--accent,#3a7dff);font-weight:600;">status.firebase.google.com</a> for live incident info.</div></div>
      </div>
      <button id="firestore-info-ok" style="margin-top:20px;width:100%;padding:12px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Got it</button>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('firestore-info-close').addEventListener('click', close);
  document.getElementById('firestore-info-ok').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

/* ===================== GAME DETAIL ===================== */
async function openGameDetail(game) {
  document.getElementById('flux-game-detail')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'flux-game-detail';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font-family:inherit;';

  const pricing = _gamePricing[game.id] || { price:0, discount:0 };
  const isExpired = pricing.discountExpiry && new Date(pricing.discountExpiry) < new Date();
  const activeDiscount = (!isExpired && pricing.discount > 0) ? pricing.discount : 0;
  const finalPrice = activeDiscount > 0 ? Math.round(pricing.price*(1-activeDiscount/100)) : (pricing.price||0);
  const isLocked = finalPrice > 0 && !_unlockedGames.includes(game.id);
  const stats = _allGameStats[game.id] || {};
  const avgRating = stats.ratingCount ? (stats.ratingTotal/stats.ratingCount).toFixed(1) : null;

  overlay.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:24px;width:100%;max-width:700px;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,0.3);display:flex;flex-direction:column;">
      <div style="position:relative;height:200px;flex-shrink:0;overflow:hidden;border-radius:24px 24px 0 0;">
        <img src="${game.thumb}" style="width:100%;height:100%;object-fit:cover;">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.05),rgba(0,0,0,0.65));"></div>
        <button id="gd-close" style="position:absolute;top:14px;right:14px;background:rgba(0,0,0,0.5);border:none;color:white;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;backdrop-filter:blur(4px);">✕</button>
        <div style="position:absolute;bottom:16px;left:20px;"><div style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:white;line-height:1;">${game.title}</div></div>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:18px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${avgRating ? `<div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg,#f9fafb);border-radius:10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span>⭐</span><div><div style="font-size:16px;font-weight:700;color:#f59e0b;">${avgRating}</div><div style="font-size:10px;color:var(--muted,#6b7280);">${stats.ratingCount} ratings</div></div></div>` : ''}
          ${stats.plays ? `<div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg,#f9fafb);border-radius:10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span>🎮</span><div><div style="font-size:16px;font-weight:700;color:var(--text,#111);">${stats.plays.toLocaleString()}</div><div style="font-size:10px;color:var(--muted,#6b7280);">total plays</div></div></div>` : ''}
          <div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg,#f9fafb);border-radius:10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span>💎</span><div><div style="font-size:16px;font-weight:700;color:var(--text,#111);">${finalPrice > 0 ? finalPrice+' pts' : 'Free'}</div><div style="font-size:10px;color:var(--muted,#6b7280);">${isLocked ? 'to unlock' : '✓ unlocked'}</div></div></div>
          ${stats.firstSeen ? `<div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg,#f9fafb);border-radius:10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span>📅</span><div><div style="font-size:12px;font-weight:700;color:var(--text,#111);">${new Date(stats.firstSeen).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div><div style="font-size:10px;color:var(--muted,#6b7280);">added</div></div></div>` : ''}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">About this game</div>
          <div id="gd-ai-desc" style="font-size:14px;color:var(--text,#111);line-height:1.7;background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));">${game.desc} <span style="color:var(--muted,#9ca3af);font-size:12px;">✨ Enhancing...</span></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${isLocked
            ? `<button id="gd-unlock-btn" style="flex:1;min-width:140px;padding:12px 20px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">🔒 Unlock for ${finalPrice} pts</button>`
            : `<button id="gd-play-btn" style="flex:1;min-width:140px;padding:12px 20px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">▶ Play Now</button>`}
          <button id="gd-fav-btn" style="padding:12px 20px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--bg,#f9fafb);color:var(--text,#111);">${isFav(game.id) ? '★ Favourited' : '☆ Favourite'}</button>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Reviews</div>
          <div style="background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--text,#111);margin-bottom:10px;">Leave a Review</div>
            <div id="gd-star-row" style="display:flex;gap:6px;margin-bottom:10px;">
              ${[1,2,3,4,5].map(s=>`<button class="gd-star" data-star="${s}" style="background:none;border:none;font-size:26px;cursor:pointer;color:#d1d5db;padding:0;">★</button>`).join('')}
            </div>
            <textarea id="gd-review-text" placeholder="Share your thoughts... (optional)" maxlength="500" rows="2" style="width:100%;padding:9px 12px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:10px;font-size:13px;font-family:inherit;resize:none;box-sizing:border-box;outline:none;background:var(--panel,#fff);color:var(--text,#111);"></textarea>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
              <span id="gd-review-msg" style="font-size:12px;color:var(--muted,#6b7280);"></span>
              <button id="gd-submit-review" style="padding:7px 16px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Submit</button>
            </div>
          </div>
          <div id="gd-reviews-list" style="display:flex;flex-direction:column;gap:12px;"><div style="text-align:center;color:var(--muted,#6b7280);font-size:13px;padding:16px;">Loading reviews...</div></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('gd-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', function escH(e) { if(e.key==='Escape'){close();window.removeEventListener('keydown',escH);} });

  document.getElementById('gd-play-btn')?.addEventListener('click', () => {
    close(); addRecent(game.id); renderRecentSection();
    trackGamePlay(game.id, game.title); setCurrentlyPlaying(game.id, game.title);
    openPlayModal(game.url, game.title);
  });
  document.getElementById('gd-unlock-btn')?.addEventListener('click', () => { close(); showUnlockModal(game, finalPrice, activeDiscount, pricing.price); });

  const favBtn = document.getElementById('gd-fav-btn');
  favBtn.addEventListener('click', async () => {
    await toggleFav(game.id);
    favBtn.textContent = isFav(game.id) ? '★ Favourited' : '☆ Favourite';
    renderFavouritesSection();
  });

  let selectedRating = 0;
  const stars = overlay.querySelectorAll('.gd-star');
  stars.forEach(btn => {
    btn.addEventListener('mouseenter', () => { const v=parseInt(btn.dataset.star); stars.forEach(s=>s.style.color=parseInt(s.dataset.star)<=v?'#f59e0b':'#d1d5db'); });
    btn.addEventListener('mouseleave', () => { stars.forEach(s=>s.style.color=parseInt(s.dataset.star)<=selectedRating?'#f59e0b':'#d1d5db'); });
    btn.addEventListener('click', () => { selectedRating=parseInt(btn.dataset.star); stars.forEach(s=>s.style.color=parseInt(s.dataset.star)<=selectedRating?'#f59e0b':'#d1d5db'); });
  });

  document.getElementById('gd-submit-review').addEventListener('click', async () => {
    const msg=document.getElementById('gd-review-msg'), comment=document.getElementById('gd-review-text').value.trim();
    if(!selectedRating){msg.style.color='#ef4444';msg.textContent='Pick a star rating first.';return;}
    msg.style.color='#9ca3af';msg.textContent='Saving...';
    const r=await submitReview(game.id,game.title,selectedRating,comment);
    if(r.ok){msg.style.color='#22c55e';msg.textContent='✓ Saved!';document.getElementById('gd-review-text').value='';selectedRating=0;stars.forEach(s=>s.style.color='#d1d5db');loadDetailReviews(game.id);}
    else{msg.style.color='#ef4444';msg.textContent=r.error;}
  });

  getAiGameDescription(game).then(desc => { const el=document.getElementById('gd-ai-desc'); if(el) el.textContent=desc; });
  loadDetailReviews(game.id);
}

async function loadDetailReviews(gameId) {
  const list = document.getElementById('gd-reviews-list');
  if (!list) return;
  const reviews = await getGameReviews(gameId);
  if (!reviews.length) { list.innerHTML='<div style="text-align:center;color:var(--muted,#6b7280);font-size:13px;padding:16px;">No reviews yet. Be the first!</div>'; return; }
  list.innerHTML='';
  reviews.forEach(r => {
    const item=document.createElement('div');
    item.style.cssText='background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));';
    const stars='★'.repeat(r.rating)+'☆'.repeat(5-r.rating);
    const d=Date.now()-new Date(r.createdAt).getTime();
    const timeAgo=d<3600000?Math.floor(d/60000)+'m ago':d<86400000?Math.floor(d/3600000)+'h ago':Math.floor(d/86400000)+'d ago';
    const isMe=r.uid===(window._currentUserUid||''), isAdmin=window._currentUserUid==='zEy6TO5ligf2um4rssIZs9C9X7f2';
    const alreadyLiked=(r.likes||[]).includes(window._currentUserUid||'');
    item.innerHTML=`
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--accent,#3a7dff);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0;">${(r.displayName||'?')[0].toUpperCase()}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:var(--text,#111);">@${r.username}</span>
            <span style="color:#f59e0b;">${stars}</span>
            <span style="font-size:11px;color:var(--muted,#6b7280);">${timeAgo}</span>
          </div>
          ${r.comment?`<div style="font-size:13px;color:var(--text,#111);margin-top:4px;line-height:1.5;">${r.comment}</div>`:''}
        </div>
        ${(isMe||isAdmin)?`<button class="gd-del-rev" data-id="${r.id}" style="background:none;border:none;color:var(--muted,#9ca3af);cursor:pointer;font-size:13px;flex-shrink:0;">🗑</button>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:14px;padding-top:8px;border-top:1px solid var(--glass-border,rgba(0,0,0,0.06));">
        <button class="gd-like" data-id="${r.id}" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--muted,#6b7280);display:flex;align-items:center;gap:4px;padding:0;">${alreadyLiked?'❤️':'🤍'} ${r.likes?.length||0}</button>
        <button class="gd-reply-toggle" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--muted,#6b7280);padding:0;">💬 ${r.comments?.length||0} ${r.comments?.length===1?'reply':'replies'}</button>
      </div>
      <div class="gd-comments-area" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--glass-border,rgba(0,0,0,0.06));">
        <div class="gd-clist" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">
          ${(r.comments||[]).map(c=>`<div style="display:flex;gap:8px;"><div style="width:24px;height:24px;border-radius:50%;background:var(--accent,#3a7dff);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;flex-shrink:0;">${(c.displayName||'?')[0].toUpperCase()}</div><div style="flex:1;background:var(--panel,#fff);border-radius:8px;padding:7px 10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));font-size:12px;color:var(--text,#111);"><strong>@${c.username}</strong> ${c.comment}</div></div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <input class="gd-cin" data-review="${r.id}" type="text" placeholder="Reply..." maxlength="300" style="flex:1;padding:7px 10px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:var(--panel,#fff);color:var(--text,#111);">
          <button class="gd-csub" data-review="${r.id}" style="padding:7px 12px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Reply</button>
        </div>
      </div>`;
    list.appendChild(item);
    item.querySelector('.gd-like').addEventListener('click', async e => {
      const btn=e.currentTarget; const res=await likeReview(gameId,btn.dataset.id);
      if(res.ok){const cnt=parseInt(btn.textContent.match(/\d+/)?.[0]||0)+(res.liked?1:-1);btn.innerHTML=`${res.liked?'❤️':'🤍'} ${Math.max(0,cnt)}`;}
    });
    item.querySelector('.gd-reply-toggle').addEventListener('click',()=>{const a=item.querySelector('.gd-comments-area');a.style.display=a.style.display==='none'?'block':'none';});
    item.querySelector('.gd-csub').addEventListener('click', async()=>{
      const inp=item.querySelector('.gd-cin'); const res=await addReviewComment(gameId,r.id,inp.value.trim());
      if(res.ok){const cl=item.querySelector('.gd-clist');const nd=document.createElement('div');nd.style.cssText='display:flex;gap:8px;';nd.innerHTML=`<div style="width:24px;height:24px;border-radius:50%;background:var(--accent,#3a7dff);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;flex-shrink:0;">Y</div><div style="flex:1;background:var(--panel,#fff);border-radius:8px;padding:7px 10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));font-size:12px;color:var(--text,#111);"><strong>You</strong> ${inp.value.trim()}</div>`;cl.appendChild(nd);inp.value='';}
    });
    item.querySelector('.gd-del-rev')?.addEventListener('click', async e=>{if(!confirm('Delete?'))return;await deleteReview(gameId,e.currentTarget.dataset.id);item.remove();if(!list.children.length)loadDetailReviews(gameId);});
  });
}

/* ===================== UNLOCK MODAL ===================== */
async function showUnlockModal(game, finalPrice, discount, originalPrice) {
  document.getElementById('flux-unlock-modal')?.remove();
  let userPoints = 0;
  try {
    const { getFirestore, doc: fd, getDoc: gd } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const user = getAuth(getApp()).currentUser;
    if (user) { const s=await gd(fd(getFirestore(getApp()),'profiles',user.uid)); userPoints=s.exists()?(s.data().points||0):0; }
  } catch {}
  const canAfford = userPoints >= finalPrice;
  const modal = document.createElement('div');
  modal.id = 'flux-unlock-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:380px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.25);text-align:center;">
      <div style="font-size:44px;margin-bottom:12px;">🔒</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text,#111);margin-bottom:6px;">${game.title}</div>
      ${discount>0?`<div style="margin-bottom:6px;"><span style="text-decoration:line-through;color:var(--muted,#9ca3af);font-size:14px;">${originalPrice} pts</span> <span style="background:linear-gradient(135deg,#ef4444,#f97316);color:white;font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;">${discount}% OFF</span></div>`:''}
      <div style="font-size:28px;font-weight:800;color:var(--accent,#3a7dff);margin-bottom:8px;">${finalPrice} pts</div>
      <div style="font-size:13px;color:var(--muted,#6b7280);margin-bottom:20px;">Your balance: <strong style="color:${canAfford?'#22c55e':'#ef4444'}">${userPoints} pts</strong></div>
      ${canAfford
        ? `<button id="unlock-confirm-btn" style="width:100%;padding:13px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">🔓 Unlock for ${finalPrice} pts</button>`
        : `<button id="earn-more-btn" style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">💡 How to earn more points</button>`}
      <button id="unlock-cancel-btn" style="width:100%;padding:11px;background:none;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111);">Cancel</button>
      <p id="unlock-msg" style="font-size:12px;margin:10px 0 0;display:none;"></p>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('unlock-cancel-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if(e.target===modal) close(); });
  document.getElementById('unlock-confirm-btn')?.addEventListener('click', async () => {
    const btn=document.getElementById('unlock-confirm-btn'); btn.textContent='Unlocking...'; btn.disabled=true;
    const res=await unlockGame(game.id, finalPrice);
    const msg=document.getElementById('unlock-msg'); msg.style.display='block';
    if(res.ok){_unlockedGames.push(game.id);msg.style.color='#22c55e';msg.textContent=`✓ Unlocked! Balance: ${res.newBalance} pts`;setTimeout(()=>{close();renderGames(GAMES);},1500);}
    else{msg.style.color='#ef4444';msg.textContent=res.error;btn.textContent=`🔓 Unlock for ${finalPrice} pts`;btn.disabled=false;}
  });
  document.getElementById('earn-more-btn')?.addEventListener('click', () => { close(); showEarnPointsModal(game, finalPrice); });
}

/* ===================== EARN POINTS MODAL ===================== */
function showEarnPointsModal(game, requiredPts) {
  document.getElementById('flux-earn-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'flux-earn-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;font-family:inherit;';
  const ways = [
    {icon:'🔐',label:'Daily login',pts:'+10 pts',desc:'Log in every day'},
    {icon:'🔥',label:'Login streak',pts:'+2 pts/day',desc:'Consecutive logins earn bonus (max +50)'},
    {icon:'⏱️',label:'Time on site',pts:'+1 pt/5 min',desc:'Just browse Flux'},
    {icon:'🎰',label:'Spin the wheel',pts:'Up to 500 pts',desc:'Spin once per hour in your profile menu'},
    {icon:'🎁',label:'Receive a gift',pts:'Varies',desc:'Another player can gift you their points'},
  ];
  modal.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.25);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:40px;margin-bottom:8px;">💡</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text,#111);">How to Earn Points</div>
        ${game?`<div style="font-size:13px;color:var(--muted,#6b7280);margin-top:4px;">Need <strong style="color:var(--accent,#3a7dff)">${requiredPts} pts</strong> to unlock <strong>${game.title}</strong></div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        ${ways.map(w=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg,#f9fafb);border-radius:12px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span style="font-size:22px;flex-shrink:0;">${w.icon}</span><div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--text,#111);">${w.label}</div><div style="font-size:11px;color:var(--muted,#6b7280);">${w.desc}</div></div><span style="font-size:12px;font-weight:700;color:#22c55e;white-space:nowrap;">${w.pts}</span></div>`).join('')}
      </div>
      <div style="display:flex;gap:10px;">
        <button id="earn-spin-btn" style="flex:1;padding:12px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">🎰 Spin Now</button>
        <button id="earn-close-btn" style="flex:1;padding:12px;background:var(--bg,#f9fafb);border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111);">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('earn-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if(e.target===modal) close(); });
  document.getElementById('earn-spin-btn').addEventListener('click', () => { close(); window.openSpinWheel?.(); });
}

/* ===================== SPIN WHEEL ===================== */
window.openSpinWheel = async function() {
  document.getElementById('flux-spin-modal')?.remove();
  const lastSpin = await getLastSpin();
  const cooldownMs = lastSpin ? Math.max(0, new Date(lastSpin).getTime()+3600000-Date.now()) : 0;
  const segs = SPIN_SEGMENTS;
  const total = segs.reduce((s,seg)=>s+seg.weight,0);
  const size=260, cx=130, cy=130, r=126;
  let svgSlices=''; let angle=-Math.PI/2;
  segs.forEach(seg => {
    const sweep=(seg.weight/total)*2*Math.PI;
    const x1=cx+r*Math.cos(angle),y1=cy+r*Math.sin(angle);
    const x2=cx+r*Math.cos(angle+sweep),y2=cy+r*Math.sin(angle+sweep);
    const large=sweep>Math.PI?1:0;
    const mid=angle+sweep/2, tx=cx+(r*0.65)*Math.cos(mid), ty=cy+(r*0.65)*Math.sin(mid);
    svgSlices+=`<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${seg.color}" stroke="white" stroke-width="1.5"/>`;
    svgSlices+=`<text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="10" font-weight="700" font-family="DM Sans,sans-serif" transform="rotate(${(mid*180/Math.PI).toFixed(1)},${tx.toFixed(2)},${ty.toFixed(2)})">${seg.label}</text>`;
    angle+=sweep;
  });
  const onCooldown=cooldownMs>0;
  const mL=Math.floor(cooldownMs/60000), sL=Math.floor((cooldownMs%60000)/1000);
  const modal=document.createElement('div');
  modal.id='flux-spin-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML=`
    <div style="background:var(--panel,#fff);border-radius:24px;padding:28px 24px;max-width:360px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.3);text-align:center;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--text,#111);margin-bottom:4px;">🎰 Spin Wheel</div>
      <div style="font-size:12px;color:var(--muted,#6b7280);margin-bottom:16px;">Spin once per hour to win points!</div>
      <div style="position:relative;display:inline-block;margin-bottom:16px;">
        <svg id="spin-wheel-svg" width="${size}" height="${size}" style="transition:transform 4s cubic-bezier(0.17,0.67,0.12,0.99);transform-origin:center;">${svgSlices}</svg>
        <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:22px solid #111827;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></div>
      </div>
      <div id="spin-result" style="min-height:44px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:20px;font-weight:700;color:var(--text,#111);"></div>
      ${onCooldown?`<div style="padding:12px;background:rgba(239,68,68,0.08);border-radius:12px;border:1px solid rgba(239,68,68,0.15);margin-bottom:14px;"><div style="font-size:13px;color:#ef4444;font-weight:700;">⏱ Next spin in</div><div id="spin-countdown" style="font-size:22px;font-weight:800;color:#ef4444;">${mL}m ${sL}s</div></div>`:''}
      <button id="spin-btn" ${onCooldown?'disabled':''} style="width:100%;padding:13px;background:${onCooldown?'#d1d5db':'linear-gradient(135deg,#8b5cf6,#ec4899)'};color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:${onCooldown?'not-allowed':'pointer'};margin-bottom:10px;">${onCooldown?'⏳ On Cooldown':'🎰 Spin!'}</button>
      <button id="spin-close-btn" style="width:100%;padding:11px;background:none;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111);">Close</button>
    </div>`;
  document.body.appendChild(modal);
  const close=()=>modal.remove();
  document.getElementById('spin-close-btn').addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  if(onCooldown){
    const cEl=document.getElementById('spin-countdown');
    const tick=setInterval(()=>{
      const rem=Math.max(0,new Date(lastSpin).getTime()+3600000-Date.now());
      if(!document.getElementById('spin-countdown')){clearInterval(tick);return;}
      if(rem<=0){cEl.textContent='Ready!';clearInterval(tick);return;}
      cEl.textContent=Math.floor(rem/60000)+'m '+Math.floor((rem%60000)/1000)+'s';
    },1000);
  }
  document.getElementById('spin-btn').addEventListener('click', async()=>{
    const btn=document.getElementById('spin-btn'), res=document.getElementById('spin-result');
    btn.disabled=true; btn.textContent='Spinning...';
    const result=await spinWheel();
    if(!result.ok){res.innerHTML=`<span style="color:#ef4444;font-size:14px;">${result.error==='cooldown'?'⏱ Come back later!':result.error}</span>`;btn.disabled=false;btn.textContent='🎰 Spin!';return;}
    const seg=result.segment;
    const segIdx=segs.findIndex(s=>s.label===seg.label);
    const segAngleDeg=segs.slice(0,segIdx).reduce((acc,s)=>acc+(s.weight/total)*360,0)+(seg.weight/total)*180;
    const spins=5+Math.random()*3;
    document.getElementById('spin-wheel-svg').style.transform=`rotate(${spins*360+(360-segAngleDeg)}deg)`;
    setTimeout(()=>{
      if(seg.points>0) res.innerHTML=`<span style="color:#22c55e;">🎉 You won <strong style="font-size:28px;">${seg.points}</strong> pts!</span>`;
      else res.innerHTML=`<span style="color:#6b7280;">😅 Try again next hour!</span>`;
      btn.textContent='⏳ Come back in 1 hour';
    },4200);
  });
};

/* ===================== GIFT POINTS MODAL ===================== */
window.openGiftPoints = function() {
  document.getElementById('flux-gift-modal')?.remove();
  const modal=document.createElement('div');
  modal.id='flux-gift-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML=`
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:380px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.25);">
      <div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;margin-bottom:8px;">🎁</div><div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text,#111);">Gift Points</div><div style="font-size:13px;color:var(--muted,#6b7280);margin-top:4px;">Send your points to another player. Daily cap: 500 pts.</div></div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        <div><label style="font-size:11px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Recipient Username</label><input id="gift-username" type="text" placeholder="@username" maxlength="20" style="width:100%;padding:10px 12px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;background:var(--bg,#f9fafb);color:var(--text,#111);"></div>
        <div><label style="font-size:11px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Amount</label><input id="gift-amount" type="number" placeholder="Points to gift" min="1" max="500" style="width:100%;padding:10px 12px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;background:var(--bg,#f9fafb);color:var(--text,#111);"></div>
        <div id="gift-preview" style="display:none;padding:10px 14px;background:rgba(58,125,255,0.06);border-radius:10px;border:1px solid rgba(58,125,255,0.15);font-size:13px;color:var(--text,#111);"></div>
      </div>
      <p id="gift-msg" style="font-size:12px;text-align:center;margin:0 0 12px;display:none;"></p>
      <div style="display:flex;gap:10px;">
        <button id="gift-send-btn" style="flex:1;padding:12px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">🎁 Send Gift</button>
        <button id="gift-close-btn" style="flex:1;padding:12px;background:var(--bg,#f9fafb);border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111);">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close=()=>modal.remove();
  document.getElementById('gift-close-btn').addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close();});
  const updatePreview=()=>{
    const u=document.getElementById('gift-username').value.trim();
    const a=parseInt(document.getElementById('gift-amount').value)||0;
    const p=document.getElementById('gift-preview');
    if(u&&a>0){p.style.display='block';p.innerHTML=`Sending <strong>${a} pts</strong> to <strong>@${u}</strong>`;}
    else p.style.display='none';
  };
  document.getElementById('gift-username').addEventListener('input',updatePreview);
  document.getElementById('gift-amount').addEventListener('input',updatePreview);
  document.getElementById('gift-send-btn').addEventListener('click', async()=>{
    const username=document.getElementById('gift-username').value.trim().toLowerCase().replace('@','');
    const amount=parseInt(document.getElementById('gift-amount').value);
    const msg=document.getElementById('gift-msg'), btn=document.getElementById('gift-send-btn');
    if(!username){msg.style.color='#ef4444';msg.textContent='Enter a username.';msg.style.display='block';return;}
    if(!amount||amount<1){msg.style.color='#ef4444';msg.textContent='Enter a valid amount.';msg.style.display='block';return;}
    btn.textContent='Sending...';btn.disabled=true;
    const res=await giftPointsToUser(username,amount);
    msg.style.display='block';
    if(res.ok){msg.style.color='#22c55e';msg.textContent=`✓ Sent ${amount} pts to @${username}! Balance: ${res.newBalance} pts`;setTimeout(close,2500);}
    else{msg.style.color='#ef4444';msg.textContent=res.error;btn.textContent='🎁 Send Gift';btn.disabled=false;}
  });
};
