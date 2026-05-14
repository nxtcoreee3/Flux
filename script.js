/* script.js — Flux
   Features: game rendering, play modal, search/sort,
   favorites (cloud+local), dark mode, toasts, recently played, new badge, stats button
*/

const isOfficial = window.location.hostname === 'nxtcoreee3.github.io' && 
  (window.location.pathname === '/Flux' || window.location.pathname.startsWith('/Flux/') ||
   window.location.pathname === '/Flux-Nightly' || window.location.pathname.startsWith('/Flux-Nightly/'));
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';

if (!isOfficial && !isLocal) {
  alert("You have to be redirected to the official site since this one can be dangerous");
  window.location.href = "https://nxtcoreee3.github.io/Flux";
}

import { initAuthUI, loadCloudFavs, saveCloudFavs, syncProfileFavs, syncProfileRecents, initPresence, initStatsButton, trackDailyVisitor, initServerStatus, initBroadcast, initChaos, initJumpscare, initCookieConsent, trackLoginStreak, trackTimeOnSite, trackGamePlay, fetchHotGame, fetchGameFirstSeen, fetchAllGameStats, setCurrentlyPlaying, clearCurrentlyPlaying, rateGame, getUserRating, reportGame, checkFirestoreHealth, fetchGameDetail, getAiGameDescription, getGameReviews, submitReview, addReviewComment, likeReview, deleteReview, fetchGamePricing, getUnlockedGames, unlockGame, SPIN_SEGMENTS, getLastSpin, spinWheel, giftPointsToUser, redeemCode, createRewardCode, getRewardCodes, deactivateRewardCode, initIncidentBanner, setServiceStatus, autoCheckServiceHealth, setIncidentBanner, checkNoAds, purchaseNoAds, NO_ADS_COST, setGameLockdown, initUpdateNotification } from './firebase-auth.js';

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
  },
  {
    id: 'elastic-man',
    title: 'Elastic Man',
    thumb: 'assets/elastic-man.png',
    url: 'https://nxtcoreee3.github.io/Elastic-Man/',
    desc: 'Stretch and squish a face with realistic physics in this weirdly satisfying game.'
  },
  {
    id: 'space-waves',
    title: 'Space Waves',
    thumb: 'assets/space-waves.png',
    url: 'https://nxtcoreee3.github.io/Space-Waves/',
    desc: 'Control an arrow and dodge obstacles through fast-paced levels.'
  },
  {
    id: 'jetpack-joyride',
    title: 'Jetpack Joyride',
    thumb: 'assets/jetpack-joyride.png',
    url: 'https://nxtcoreee3.github.io/Jetpack-Joyride/',
    desc: 'Fly with a jetpack, dodge lasers and missiles, and see how far you can go.'
  },
  {
    id: 'crossy-road',
    title: 'Crossy Road',
    thumb: 'assets/crossy-road.png',
    url: 'https://nxtcoreee3.github.io/Crossy-Road/',
    desc: 'Hop across roads, rivers, and tracks while avoiding traffic and obstacles.'
  },
  {
    id: 'stacktris',
    title: 'Stacktris',
    thumb: 'assets/stacktris.png',
    url: 'https://nxtcoreee3.github.io/Stacktris/',
    desc: 'Stack spinning blocks carefully and build the tallest tower without it falling.',
  },
  {
    id: 'guess-their-answer',
    title: 'Guess Their Answer',
    thumb: 'assets/guess-their-answer.png',
    url: 'https://nxtcoreee3.github.io/Guess-Their-Answer/',
    desc: 'Answer fun questions by guessing the most popular responses to beat your opponents.'
  },
  {
    id: 'block-blast',
    title: 'Block Blast',
    thumb: 'assets/block-blast.png',
    url: 'https://nxtcoreee3.github.io/Block-Blast/',
    desc: 'Place blocks, clear lines, and keep the board from filling up.'
  },
  {
    id: 'candy-crush',
    title: 'Candy Crush',
    thumb: 'assets/candy-crush.png',
    url: 'https://nxtcoreee3.github.io/Candy-Crush/',
    desc: 'Match candies to complete levels and earn high scores.'
  },
  {
    id: 'capybara-clicker',
    title: 'Capybara Clicker',
    thumb: 'assets/capybara-clicker.png',
    url: 'https://nxtcoreee3.github.io/Capybara-Clicker/',
    desc: 'Click to collect capybaras and upgrade your cute farm.'
  },
  {
    id: 'cleanup-io',
    title: 'Cleanup.io',
    thumb: 'assets/cleanup-io.png',
    url: 'https://nxtcoreee3.github.io/Cleanup.io/',
    desc: 'Collect trash, clean the area, and compete with other players.'
  },
  {
    id: 'ducklings-io',
    title: 'Ducklings.io',
    thumb: 'assets/ducklings-io.png',
    url: 'https://nxtcoreee3.github.io/Ducklings.io/',
    desc: 'Lead your ducklings, grow your flock, and dominate the pond.'
  },
  {
    id: 'monster-tracks',
    title: 'Monster Tracks',
    thumb: 'assets/monster-tracks.png',
    url: 'https://nxtcoreee3.github.io/Monster-Tracks/',
    desc: 'Drive monster trucks through crazy tracks and perform insane stunts.'
  },
  {
    id: 'basket-random',
    title: 'Basket Random',
    thumb: 'assets/basket-random.png',
    url: 'https://nxtcoreee3.github.io/Basket-Random/',
    desc: 'Play chaotic basketball with random physics and score before your opponent.'
  },
  {
    id: 'clash-of-vikings',
    title: 'Clash of Vikings',
    thumb: 'assets/clash-of-vikings.png',
    url: 'https://nxtcoreee3.github.io/Clash-of-Vikings/',
    desc: 'Build your deck, deploy units, and destroy enemy towers in fast-paced battles.'
  },
  {
    id: 'bowmasters',
    title: 'Bowmasters',
    thumb: 'assets/bowmasters.png',
    url: 'https://nxtcoreee3.github.io/Bowmasters/',
    desc: 'Aim carefully, throw weapons, and defeat your opponent in turn-based duels.'
  },
  {
    id: 'state-io',
    title: 'State.io',
    thumb: 'assets/state-io.png',
    url: 'https://nxtcoreee3.github.io/State.io/',
    desc: 'Send troops, capture territories, and conquer the map using smart strategy.'
  },
  {
    id: 'hole-io',
    title: 'Hole.io',
    thumb: 'assets/hole-io.png',
    url: 'https://nxtcoreee3.github.io/Hole.io/',
    desc: 'Control a black hole, swallow everything, and grow bigger than your rivals.'
  },
  {
    id: 'talking-tom-cat',
    title: 'Talking Tom Cat',
    thumb: 'assets/talking-tom-cat.png',
    url: 'https://gamejolt.net/?token=pUpjLeSCuADJLGguZw4X5LbU6NxbLv',
    desc: 'Play the original Talking Tom game through an emulator and interact with the classic pet. (Hosted by GameJolt)'
  },
  {
    id: 'subway-surfers-mexico',
    title: 'Subway Surfers Mexico',
    thumb: 'assets/subway-surfers-mexico.png',
    url: 'https://nxtcoreee3.github.io/Subway-Surfers-Mexico/',
    desc: 'Run through tracks, dodge trains, and collect coins in this Mexico-themed endless runner.'
  },
  {
    id: 'subway-surfers-houston',
    title: 'Subway Surfers Houston',
    thumb: 'assets/subway-surfers-houston.png',
    url: 'https://nxtcoreee3.github.io/Subway-Surfers-Houston/',
    desc: 'Run through tracks, dodge trains, and collect coins in this Houston-themed endless runner.'
  },
{
  id: 'eggy-car',
  title: 'Eggy Car',
  thumb: 'assets/eggy-car.png',
  url: 'https://nxtcoreee3.github.io/EggyCar/',
  desc: 'Drive carefully over hills while keeping a fragile egg from falling.'
},
{
  id: 'hill-climb-racing-lite',
  title: 'Hill Climb Racing Lite',
  thumb: 'assets/hill-climb-racing-lite.png',
  url: 'https://nxtcoreee3.github.io/Hill-Climb-Racing-Lite/',
  desc: 'Drive through hills, upgrade your vehicle, and go as far as possible without flipping.'
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
['year', 'year2', 'year3', 'year4', 'year5'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.textContent = new Date().getFullYear();
});

/* ===================== DARK MODE ===================== */
const DARK_KEY = 'flux_dark';

// Apply beta immediately from localStorage to avoid flash
(function () {
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
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };

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
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)';
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

  // Mod lockdown — owner can still play
  const isModLocked = stats.locked === true;
  const isOwnerView = window._fluxIsOwner === true;

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
    ${isModLocked && !isOwnerView ? `<div class="card-modlock-overlay" style="position:absolute;inset:0;z-index:5;background:rgba(239,68,68,0.15);border-radius:inherit;border:2px solid rgba(239,68,68,0.4);pointer-events:none;"></div>` : ''}
    <img class="thumb" src="${game.thumb}" alt="${game.title} thumbnail" loading="lazy" style="${isModLocked && !isOwnerView ? 'opacity:0.45;filter:grayscale(0.3);' : ''}">
    <div class="card-body" style="cursor:pointer;${isModLocked && !isOwnerView ? 'opacity:0.5;' : ''}" title="View details">
      <h3 class="title">${game.title}</h3>
      <div class="meta">${game.desc || ''}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
        ${compatBadge}
        ${ratingHTML}
        ${isModLocked && !isOwnerView ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;border:1px solid rgba(239,68,68,0.2);">🔒 Temporarily unavailable</span>' : ''}
        ${isModLocked && isOwnerView ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;border:1px solid rgba(239,68,68,0.2);">🔒 Locked (admin view)</span>' : ''}
      </div>
    </div>
    <div class="card-foot">
      <div style="display:flex;gap:8px;align-items:center">
        <button class="favorite" title="Toggle favourite" aria-pressed="${isFav(game.id)}">${isFav(game.id) ? '★' : '☆'}</button>
        ${!isModLocked || isOwnerView ? `<button class="rate-btn" title="Rate game" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--muted);">☆ Rate</button>` : ''}
        <button class="report-btn" title="Report game" style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--muted);">⚑</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${isModLocked && !isOwnerView
      ? `<button class="modlock-info-btn" style="padding:7px 14px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;">Get Info</button>`
      : `<button class="play-btn" data-url="${game.url}" data-title="${game.title}">${isLocked ? `🔒 ${finalPrice} pts` : 'Play'}</button>`
    }
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

  div.querySelector('.rate-btn')?.addEventListener('click', (e) => { e.stopPropagation(); showRatingModal(game); });
  div.querySelector('.report-btn')?.addEventListener('click', (e) => { e.stopPropagation(); showReportModal(game); });

  // Click card body → open detail view
  div.querySelector('.card-body')?.addEventListener('click', (e) => { e.stopPropagation(); if (!window._fluxBanned) openGameDetail(game); });

  // Click lock overlay → unlock modal (pricing lock)
  div.querySelector('.card-lock-overlay')?.addEventListener('click', (e) => {
    e.stopPropagation();
    showUnlockModal(game, finalPrice, activeDiscount, pricing.price);
  });

  // Mod lock info button
  div.querySelector('.modlock-info-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    showModLockInfoModal(game, stats);
  });

  div.querySelector('.play-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window._fluxBanned) return;
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
        ${[1, 2, 3, 4, 5].map(s => `<button class="star-btn" data-star="${s}" style="background:none;border:none;font-size:32px;cursor:pointer;transition:transform 0.1s;color:${s <= userRating ? '#f59e0b' : '#d1d5db'};">★</button>`).join('')}
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
        ${['Game is broken / won\'t load', 'Game crashes my browser', 'Content is inappropriate', 'Other'].map(r =>
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

function showModLockInfoModal(game, stats) {
  const existing = document.getElementById('modlock-info-modal');
  if (existing) existing.remove();

  const lockedAt = stats.lockedAt
    ? new Date(stats.lockedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown';

  const modal = document.createElement('div');
  modal.id = 'modlock-info-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);padding:24px;';
  modal.innerHTML = `
    <div style="background:var(--panel);border-radius:20px;padding:28px;width:100%;max-width:380px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;text-align:center;">
      <button id="modlock-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      <div style="width:56px;height:56px;border-radius:50%;background:rgba(239,68,68,0.1);border:2px solid rgba(239,68,68,0.3);display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 16px;">🔒</div>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text);margin:0 0 6px;">${game.title}</h3>
      <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:20px;">🔒 Temporarily Unavailable</div>

      <div style="background:var(--bg);border-radius:12px;padding:16px;text-align:left;display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Reason</div>
          <div style="font-size:14px;color:var(--text);line-height:1.5;">${stats.lockReason || 'No reason provided.'}</div>
        </div>
        ${stats.lockETA ? `<div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Estimated Return</div>
          <div style="font-size:14px;color:#22c55e;font-weight:600;">${stats.lockETA}</div>
        </div>` : ''}
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Locked Since</div>
          <div style="font-size:13px;color:var(--muted);">${lockedAt}</div>
        </div>
      </div>

      <p style="font-size:12px;color:var(--muted);margin:0 0 16px;">We're working on it. Check back soon!</p>
      <button id="modlock-close-btn" style="width:100%;padding:11px;background:var(--accent);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">Got it</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('modlock-close').addEventListener('click', () => modal.remove());
  document.getElementById('modlock-close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
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
  if (query) list = list.filter(g => g.title.toLowerCase().includes(query) || (g.desc || '').toLowerCase().includes(query));
  if (sort === 'alpha') list.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === 'recent') list = list.slice().reverse();
  renderGames(list);
}

if (quickSearch) quickSearch.addEventListener('input', debounce(applyFilters, 160));
if (sortSelect) sortSelect.addEventListener('change', applyFilters);

function debounce(fn, wait = 120) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/* ===================== ADS ===================== */
let _adsDisabled = false;

async function initAds() {
  // Only show on pages that have the game grid (index)
  if (!document.getElementById('game-grid')) return;

  // Check cache first so there's no flash
  if (localStorage.getItem('flux_no_ads') === '1') {
    _adsDisabled = true;
    return;
  }

  // Check Firestore for signed-in users
  try {
    const noAds = await checkNoAds();
    if (noAds) {
      _adsDisabled = true;
      localStorage.setItem('flux_no_ads', '1');
      return;
    }
  } catch { }

  // Render the banner
  const slot = document.getElementById('flux-ad-banner');
  if (!slot) return;

  slot.innerHTML = `
    <div id="flux-ad-inner" style="
      position:relative;
      max-width:860px;
      margin:0 auto 28px;
      border-radius:16px;
      overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,0.08);
    ">
      <img
        src="Ads/tweakbreak-ad.png"
        alt="Advertisement"
        style="width:100%;height:auto;display:block;border-radius:16px;cursor:pointer;"
        onclick="window.open('https://discord.gg/tweakbreak-1443331342799601666','_blank','noopener')"
      >
      <button id="ad-close-btn" title="Remove ads" style="
        position:absolute;top:8px;right:8px;
        width:28px;height:28px;border-radius:50%;
        background:rgba(0,0,0,0.55);border:none;
        color:#fff;font-size:14px;line-height:1;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        backdrop-filter:blur(4px);transition:background 0.15s;
      ">✕</button>
    </div>
  `;

  document.getElementById('ad-close-btn').addEventListener('click', () => showNoAdsModal());
}

function showNoAdsModal() {
  document.getElementById('flux-no-ads-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'flux-no-ads-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;';

  const renderContent = (balance) => {
    const isLoggedIn = !!window._currentUserUid && window._currentUserUid !== null;
    const hasEnough = isLoggedIn && balance >= NO_ADS_COST;

    if (!isLoggedIn) {
      return `
        <div style="text-align:center;padding:8px 0 4px;">
          <div style="font-size:48px;margin-bottom:12px;">🔒</div>
          <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:#111827;margin-bottom:6px;">Sign in required</div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:24px;">You need to be signed in to disable ads.</div>
          <button id="no-ads-cancel" style="width:100%;padding:11px;background:#f3f4f6;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;color:#6b7280;">Cancel</button>
        </div>`;
    }

    return `
      <div style="text-align:center;padding:8px 0 4px;">
        <div style="font-size:48px;margin-bottom:12px;">🔒</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:#111827;margin-bottom:4px;">No Ads</div>
        <div style="font-size:32px;font-weight:800;color:#3a7dff;margin-bottom:4px;">${NO_ADS_COST.toLocaleString()} pts</div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">
          Your balance: <span style="font-weight:700;color:${hasEnough ? '#22c55e' : '#ef4444'};">${balance.toLocaleString()} pts</span>
        </div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:20px;">One-time purchase. Permanent, no expiry.</div>
        ${hasEnough
        ? `<button id="no-ads-buy" style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:8px;">Remove Ads Forever</button>`
        : `<button id="no-ads-earn" style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:8px;">💡 How to earn more points</button>`
      }
        <button id="no-ads-cancel" style="width:100%;padding:11px;background:#f3f4f6;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;color:#6b7280;">Cancel</button>
        <p id="no-ads-msg" style="font-size:12px;margin:10px 0 0;display:none;"></p>
      </div>`;
  };

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:100%;max-width:340px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;">
      <button id="no-ads-close-x" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:18px;cursor:pointer;color:#9ca3af;">✕</button>
      <div id="no-ads-body">
        <div style="text-align:center;padding:20px 0;color:#9ca3af;font-size:13px;"><div style="display:flex;justify-content:center;padding:20px;"><img src="assets/loading.gif" style="width:80px;height:auto;" alt="Loading..."></div></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('no-ads-close-x').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Load balance then render
  (async () => {
    let balance = 0;
    if (window._currentUserUid) {
      try {
        const { getFirestore, doc: fd, getDoc: gd } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const { getApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const snap = await gd(fd(getFirestore(getApp()), 'profiles', window._currentUserUid));
        if (snap.exists()) balance = snap.data().points || 0;
      } catch { }
    }

    document.getElementById('no-ads-body').innerHTML = renderContent(balance);

    document.getElementById('no-ads-cancel')?.addEventListener('click', () => overlay.remove());

    document.getElementById('no-ads-earn')?.addEventListener('click', () => {
      overlay.remove();
      // Open spin wheel if available, otherwise show toast
      if (typeof window.openSpinWheel === 'function') window.openSpinWheel();
      else showToast('Earn points by logging in daily, playing games, and spinning the wheel!', 'info');
    });

    document.getElementById('no-ads-buy')?.addEventListener('click', async () => {
      const btn = document.getElementById('no-ads-buy');
      const msgEl = document.getElementById('no-ads-msg');
      btn.textContent = 'Processing…'; btn.disabled = true;

      const result = await purchaseNoAds();

      if (result.ok) {
        _adsDisabled = true;
        localStorage.setItem('flux_no_ads', '1');
        // Hide the banner immediately
        const slot = document.getElementById('flux-ad-banner');
        if (slot) { slot.style.opacity = '0'; slot.style.transition = 'opacity 0.3s'; setTimeout(() => { slot.innerHTML = ''; slot.style.opacity = ''; }, 300); }
        overlay.innerHTML = `
          <div style="background:#fff;border-radius:20px;padding:36px 24px;width:100%;max-width:340px;box-shadow:0 30px 80px rgba(0,0,0,0.2);text-align:center;">
            <div style="font-size:56px;margin-bottom:12px;">🎉</div>
            <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:#111827;margin-bottom:6px;">Ads Removed!</div>
            <div style="font-size:13px;color:#6b7280;margin-bottom:20px;">Thanks for supporting Flux. You'll never see ads again.</div>
            <button onclick="this.closest('#flux-no-ads-modal').remove()" style="padding:11px 28px;background:#3a7dff;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Done</button>
          </div>`;
      } else if (result.error === 'not_logged_in') {
        if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.textContent = 'You must be signed in.'; }
        btn.textContent = 'Remove Ads Forever'; btn.disabled = false;
      } else {
        if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.textContent = result.error || 'Something went wrong.'; }
        btn.textContent = 'Remove Ads Forever'; btn.disabled = false;
      }
    });
  })();
}

/* ===================== INIT ===================== */
function bootFlux() {
  initCookieConsent();
  initDarkMode();
  initUpdateNotification();
  if (window.hideGlobalLoader) window.hideGlobalLoader();

  const fastBoot = (() => { try { return localStorage.getItem('flux_fast_boot') === '1'; } catch { return false; } })();
  const defer = (fn, timeout = 800) => {
    try {
      if ('requestIdleCallback' in window) return requestIdleCallback(fn, { timeout });
    } catch {}
    return setTimeout(fn, 0);
  };

  // Render immediately so the page never feels empty
  if (document.getElementById('game-grid') || document.getElementById('games-grid')) {
    renderGames(GAMES);
  }

  if (document.getElementById('quick-search')) {
    document.getElementById('quick-search').addEventListener('input', debounce(applyFilters, 120));
  }

  // Non-critical boot work (delay more aggressively in Fast Boot)
  const base = fastBoot ? 2200 : 1200;
  defer(() => initFirestoreHealthCheck(), base);
  defer(() => initIncidentBanner(), base);
  defer(() => initStatsButton(), base);
  defer(() => initPresence(), base);
  defer(() => initServerStatus(), base + 200);
  defer(() => initBroadcast(), base + 200);
  defer(() => initChaos(), base + 400);
  defer(() => initJumpscare(), base + 400);
  defer(() => trackDailyVisitor(), base + 600);
  defer(() => injectBuildNumber(), base + 800);
  defer(() => showSocialBanner(), base + 900);
  defer(() => initAIPicker(), base + 1000);
  defer(() => initMobileWarning(), base + 1100);
  defer(() => initAds(), base + 1400);

  const initAuth = () => initAuthUI(async (user) => {
    window._currentUserUid = user?.uid || null;
    window._fluxIsOwner = user?.uid === 'zEy6TO5ligf2um4rssIZs9C9X7f2';
    await refreshFavsCache();
    if (user && !user.isAnonymous) {
      defer(() => trackLoginStreak(), base);
      defer(() => trackTimeOnSite(), base);

      // Re-check no-ads status now that we're signed in
      if (!_adsDisabled) {
        try {
          const noAds = await checkNoAds();
          if (noAds) {
            _adsDisabled = true;
            localStorage.setItem('flux_no_ads', '1');
            const slot = document.getElementById('flux-ad-banner');
            if (slot) slot.innerHTML = '';
          }
        } catch {}
      }
      if (!sessionStorage.getItem('flux_welcomed')) {
        showToast(`Welcome back! 👋`, 'success');
        sessionStorage.setItem('flux_welcomed', '1');
      }
    }
  });

  // Fast Boot: defer Firebase/auth work so first paint is instant
  if (fastBoot) defer(() => initAuth(), base + 400);
  else initAuth();

  // Load cloud data in background then re-render with full info
  defer(() => {
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
    }).catch(() => { });
  }, base + 600);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootFlux);
else bootFlux();

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
    } catch { }
    showWarning();
  })();
}

/* ===================== AI GAME PICKER ===================== */
async function initAIPicker() {
  const btn = document.getElementById('ai-spin-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = '🎲 Thinking...';
    document.getElementById('slot-machine').style.display = 'block';
    document.getElementById('slot-results').style.display = 'none';

    // Get recommendations based on collaborative filtering
    const recommendations = await getAIRecommendations();

    // Run the slot machine animation then show results
    await runSlotMachine(recommendations);

    btn.disabled = false;
    btn.textContent = '🎰 Spin again';
  });
}

async function getAIRecommendations() {
  // Get what the current user has played
  const myRecent = loadRecent(); // local recent games
  const myFavs = _favsCache || [];
  const myGames = [...new Set([...myFavs, ...myRecent])];

  // Fetch all game stats to find co-play patterns
  const stats = _allGameStats || {};

  // Score each game based on:
  // 1. Players who played games I like also played X (collaborative filtering)
  // 2. Hot game bonus
  // 3. New game bonus
  // 4. Exclude games I've already played a lot

  const scores = {};
  const playedSet = new Set(myGames);

  // Simple collaborative filtering: find games played by fans of my games
  // We approximate this using play counts as a proxy for popularity overlap
  GAMES.forEach(g => {
    if (playedSet.has(g.id)) {
      scores[g.id] = (scores[g.id] || 0) - 50; // penalise already played
      return;
    }
    const gStats = stats[g.id] || {};
    const plays = gStats.plays || 0;
    const rating = gStats.ratingCount ? gStats.ratingTotal / gStats.ratingCount : 0;
    const isHot = _hotGameId === g.id;
    const isNew = _newGameCache[g.id] && (Date.now() - new Date(_newGameCache[g.id]).getTime() < 24 * 60 * 60 * 1000);

    // Base score from plays and rating
    let score = Math.min(plays * 2, 60) + (rating * 8);

    // Bonus for hot/new
    if (isHot) score += 25;
    if (isNew) score += 15;

    // Collaborative signal: if user plays action games, boost similar ones
    // We use a simple category heuristic based on game IDs
    const actionGames = ['drive-mad', 'crazy-motorcycle', 'crazy-cars', 'moto-x3m', 'drift-boss'];
    const casualGames = ['cookie-clicker', 'monkey-mart', 'paper-io'];
    const skillGames = ['geometry-dash-lite', 'stickman-hook', 'polytrack', '8-ball-classic', 'table-tennis-world-tour'];

    const myActionCount = myGames.filter(id => actionGames.includes(id)).length;
    const myCasualCount = myGames.filter(id => casualGames.includes(id)).length;
    const mySkillCount = myGames.filter(id => skillGames.includes(id)).length;

    if (actionGames.includes(g.id)) score += myActionCount * 12;
    if (casualGames.includes(g.id)) score += myCasualCount * 12;
    if (skillGames.includes(g.id)) score += mySkillCount * 12;

    // Add some randomness so it's not always the same
    score += Math.random() * 20;

    scores[g.id] = score;
  });

  // Sort by score, take top games
  const ranked = GAMES
    .filter(g => !playedSet.has(g.id) || scores[g.id] > 0)
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));

  // If we don't have enough unplayed games, include some played ones
  const pool = ranked.length >= 3 ? ranked : [...ranked, ...GAMES.filter(g => playedSet.has(g.id))];

  // Pick top 3 with match percentages
  const top3 = pool.slice(0, 3);
  const maxScore = scores[top3[0]?.id] || 1;

  return top3.map(game => ({
    game,
    matchPct: Math.min(99, Math.max(55, Math.round(((scores[game.id] || 0) / maxScore) * 99))),
    reason: getRecommendationReason(game.id, myGames, stats),
  }));
}

function getRecommendationReason(gameId, myGames, stats) {
  const actionGames = ['drive-mad', 'crazy-motorcycle', 'crazy-cars', 'moto-x3m', 'drift-boss'];
  const casualGames = ['cookie-clicker', 'monkey-mart', 'paper-io'];
  const skillGames = ['geometry-dash-lite', 'stickman-hook', 'polytrack', '8-ball-classic', 'table-tennis-world-tour'];

  const myAction = myGames.some(id => actionGames.includes(id));
  const myCasual = myGames.some(id => casualGames.includes(id));
  const mySkill = myGames.some(id => skillGames.includes(id));

  if (actionGames.includes(gameId) && myAction) return 'Players who like racing games love this';
  if (casualGames.includes(gameId) && myCasual) return 'Popular with fans of casual games';
  if (skillGames.includes(gameId) && mySkill) return 'Skill game players rate this highly';
  if (_hotGameId === gameId) return 'Currently the hottest game on Flux';
  const plays = stats[gameId]?.plays || 0;
  if (plays > 10) return `Played ${plays} times by Flux players`;
  return 'Trending with players like you';
}

async function runSlotMachine(recommendations) {
  const reels = [
    document.getElementById('reel-0'),
    document.getElementById('reel-1'),
    document.getElementById('reel-2'),
  ];

  // Build a shuffled pool of all games for spinning illusion
  const allGames = [...GAMES].sort(() => Math.random() - 0.5);

  // Set up each reel with many items + the final result at the end
  reels.forEach((reel, i) => {
    reel.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'slot-reel-inner';
    inner.id = `reel-inner-${i}`;

    // Add highlight indicator
    const highlight = document.createElement('div');
    highlight.className = 'slot-highlight';
    reel.appendChild(highlight);

    // Fill with random games (for spin animation)
    const spinItems = [...allGames, ...allGames, ...allGames, recommendations[i].game];
    spinItems.forEach(g => {
      const item = document.createElement('div');
      item.className = 'slot-item';
      item.innerHTML = `
        <img src="${g.thumb}" alt="${g.title}">
        <div class="slot-item-title">${g.title}</div>
      `;
      inner.appendChild(item);
    });

    reel.appendChild(inner);
  });

  // Animate each reel with staggered stops
  const ITEM_HEIGHT = 160;
  const spinDurations = [2200, 2800, 3400];

  const spinPromises = reels.map((reel, i) => new Promise(resolve => {
    const inner = document.getElementById(`reel-inner-${i}`);
    const totalItems = inner.children.length;
    const targetIndex = totalItems - 1; // last item is our result

    // Fast scroll animation using CSS
    let currentPos = 0;
    const targetPos = targetIndex * ITEM_HEIGHT;
    const startTime = performance.now();
    const duration = spinDurations[i];

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      currentPos = eased * targetPos;

      inner.style.transform = `translateY(-${currentPos}px)`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        inner.style.transform = `translateY(-${targetPos}px)`;
        resolve();
      }
    };

    requestAnimationFrame(animate);
  }));

  await Promise.all(spinPromises);

  // Flash the reels
  reels.forEach(reel => {
    reel.style.boxShadow = '0 0 20px rgba(58,125,255,0.6)';
    reel.style.borderColor = 'var(--accent)';
    setTimeout(() => {
      reel.style.boxShadow = '';
      reel.style.borderColor = 'var(--glass-border)';
    }, 600);
  });

  // Show results
  await new Promise(r => setTimeout(r, 400));
  showSlotResults(recommendations);
}

function showSlotResults(recommendations) {
  const resultsEl = document.getElementById('slot-results');
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Your matches</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${recommendations.map(({ game, matchPct, reason }) => `
        <div class="result-card" onclick="window._openGameFromPicker('${game.id}')">
          <img src="${game.thumb}" alt="${game.title}" style="width:64px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:var(--text);">${game.title}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px;">${reason}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <div class="match-bar" style="width:${matchPct}%;"></div>
              <span style="font-size:11px;font-weight:700;color:var(--accent);white-space:nowrap;">${matchPct}% match</span>
            </div>
          </div>
          <button style="padding:7px 14px;background:var(--accent);color:white;border:none;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">Play</button>
        </div>
      `).join('')}
    </div>
  `;
}

window._openGameFromPicker = (gameId) => {
  const game = GAMES.find(g => g.id === gameId);
  if (!game) return;
  addRecent(game.id);
  renderRecentSection();
  trackGamePlay(game.id, game.title);
  setCurrentlyPlaying(game.id, game.title);
  openPlayModal(game.url, game.title);
};

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
/* ===================== COMMITS PANEL + BUILD NUMBER ===================== */

// Maps changed files → page links users can navigate to
const FILE_TO_PAGE = {
  'social.js':        { label: 'Social', url: 'social.html' },
  'social.html':      { label: 'Social', url: 'social.html' },
  'messages.js':      { label: 'Messages', url: 'messages.html' },
  'messages.html':    { label: 'Messages', url: 'messages.html' },
  'profile.js':       { label: 'Profiles', url: 'profile.html' },
  'profile.html':     { label: 'Profiles', url: 'profile.html' },
  'games.html':       { label: 'Games', url: 'games.html' },
  'script.js':        { label: 'Home', url: 'index.html' },
  'index.html':       { label: 'Home', url: 'index.html' },
  'settings.html':    { label: 'Settings', url: 'settings.html' },
  'status.html':      { label: 'Status', url: 'status.html' },
  'firebase-auth.js': { label: 'Core', url: null },
  'style.css':        { label: 'Design', url: null },
};

const COMMITS_CACHE_KEY = 'flux_commits_cache';
const COMMITS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const COMMITS_PER_PAGE = 3;
const COMMITS_TOTAL_KEY = 'flux_commits_total';
const COMMITS_TOTAL_TS_KEY = 'flux_commits_total_ts';
const COMMITS_TOTAL_TTL = 60 * 60 * 1000; // 1 hour

function timeAgoShort(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function fetchCommitsFromAtom() {
  try {
    const res = await fetch(`https://github.com/nxtcoreee3/Flux/commits/main.atom`, { cache: 'no-store' });
    if (!res.ok) return [];
    const xmlText = await res.text();
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
    const entries = Array.from(xml.querySelectorAll('entry')).slice(0, COMMITS_PER_PAGE);
    return entries.map((entry) => {
      const id = entry.querySelector('id')?.textContent || '';
      const title = entry.querySelector('title')?.textContent || '';
      const updated = entry.querySelector('updated')?.textContent || '';
      const sha = (id.match(/commit\/([0-9a-f]{7,40})/i)?.[1] || '').toLowerCase();
      return {
        sha,
        html_url: `https://github.com/nxtcoreee3/Flux/commit/${sha}`,
        commit: { message: title, committer: { date: updated }, author: { date: updated } }
      };
    }).filter(c => c.sha);
  } catch { return []; }
}

async function fetchCommits(force = false) {
  try {
    const res = await fetch(`https://api.github.com/repos/nxtcoreee3/Flux/commits?per_page=${COMMITS_PER_PAGE}&sha=main`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('GitHub API error');
    return await res.json();
  } catch (e) {
    // Fallback to atom feed if rate-limited
    const atom = await fetchCommitsFromAtom();
    if (atom.length) return atom;
    throw e;
  }
}

function parseLastPageFromLinkHeader(link) {
  if (!link) return null;
  const parts = String(link).split(',');
  const lastPart = parts.find(p => /rel=\"last\"/.test(p));
  if (!lastPart) return null;
  const m = lastPart.match(/[\?&]page=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function fetchCommitTotal(force = false) {
  const cached = parseInt(localStorage.getItem(COMMITS_TOTAL_KEY) || '0', 10) || 0;
  
  try {
    const res = await fetch('https://api.github.com/repos/nxtcoreee3/Flux/commits?per_page=1&sha=main', {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });
    if (!res.ok) return cached || 0;
    const link = res.headers.get('Link') || '';
    const lastPage = parseLastPageFromLinkHeader(link);
    const total = lastPage || cached || 0;
    if (total) {
      localStorage.setItem(COMMITS_TOTAL_KEY, String(total));
      localStorage.setItem(COMMITS_TOTAL_TS_KEY, String(Date.now()));
    }
    return total;
  } catch {

    return cached || 0;
  }
}

async function getCommitFiles(sha) {
  try {
    const res = await fetch(`https://api.github.com/repos/nxtcoreee3/Flux/commits/${sha}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files || []).map(f => f.filename.split('/').pop());
  } catch { return []; }
}

async function getAICommitDescription(commitMsg, files) {
  // Check local cache first
  const cacheKey = `flux_commit_ai_${commitMsg.slice(0, 30)}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    // Fast, local "AI-like" summary (no external API keys required)
    const msg = String(commitMsg || '').split('\n')[0].trim();
    const lower = msg.toLowerCase();
    const names = (files || []).join(' ').toLowerCase();

    const describe = () => {
      if (/messages\.js|messages\.html|dm|direct message|conversations/.test(names + ' ' + lower)) return 'Messaging: improved chats and reliability.';
      if (/social\.js|social\.html|\bglobal chat\b/.test(names + ' ' + lower)) return 'Social: improved chat and social features.';
      if (/profile\.js|profile\.html|follow|followers/.test(names + ' ' + lower)) return 'Profiles: improved follows and profile pages.';
      if (/games\.html|\bgames?\b|play/.test(names + ' ' + lower)) return 'Games: improved browsing and performance.';
      if (/style\.css|\bui\b|css|design/.test(names + ' ' + lower)) return 'UI: improved design and polish.';
      if (/\bfix\b|bug|broken/.test(lower)) return 'Fixed bugs and improved stability.';
      if (/\badd\b|\bnew\b/.test(lower)) return 'Added improvements and new features.';
      return 'Improved performance and polish.';
    };

    const desc = describe();
    localStorage.setItem(cacheKey, JSON.stringify(desc));
    return desc;
  } catch { return null; }
}

function getPageLinkFromFiles(files) {
  for (const file of files) {
    const match = FILE_TO_PAGE[file];
    if (match) return match;
  }
  return null;
}

async function renderCommitsPanel(commits) {
  const list = document.getElementById('commits-list');
  if (!list) return;

  const totalLabel = document.getElementById('commits-total-label');
  const commitTotal = await fetchCommitTotal(false);
  if (totalLabel && commitTotal) totalLabel.textContent = `${commitTotal} Commits`;

  // Mark commits newer than last seen
  const lastSeenSha = localStorage.getItem('flux_last_seen_commit');
  const latestSha = commits[0]?.sha;

  list.innerHTML = '';

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    const sha = c.sha.slice(0, 7);
    const msg = (c.commit?.message || '').split('\n')[0];
    const date = c.commit?.committer?.date || c.commit?.author?.date;
    const isNew = lastSeenSha && c.sha !== lastSeenSha && i === 0;
    const commitUrl = `https://github.com/nxtcoreee3/Flux/commit/${c.sha}`;
    const num = commitTotal ? (commitTotal - i) : null;

    const row = document.createElement('div');
    row.className = 'commit-row';

    row.innerHTML = `
      <div class="commit-sha-line">
        <a class="commit-sha" href="${commitUrl}" target="_blank" rel="noopener" title="Open commit on GitHub" onclick="event.stopPropagation();">${num ? `#${num}` : `#${sha}`}</a>
        ${isNew ? '<span class="commit-new-badge">New</span>' : ''}
        <span class="commit-msg">${msg}</span>
      </div>
      <div class="commit-ai-desc" id="ai-desc-${sha}">
        <span style="color:var(--muted);font-size:10px;">✨ Summarising...</span>
      </div>
      <span class="commit-time">${timeAgoShort(date)}</span>
    `;

    // Clicking the row opens the commit on GitHub
    row.addEventListener('click', () => {
      window.open(commitUrl, '_blank', 'noopener');
    });

    list.appendChild(row);

    // Fetch AI description + files asynchronously per commit
    (async (sha7, fullSha, rowEl) => {
      const descEl = rowEl.querySelector(`#ai-desc-${sha7}`);
      if (!descEl) return;
      try {
        const files = await getCommitFiles(fullSha);
        const aiDesc = await getAICommitDescription(msg, files);
        const pageLink = getPageLinkFromFiles(files);

        if (aiDesc) {
          if (pageLink?.url) {
            descEl.innerHTML = `<a href="${pageLink.url}" onclick="event.stopPropagation();" style="color:var(--accent);text-decoration:none;font-weight:600;" title="Go to ${pageLink.label}">→ ${pageLink.label}:</a> ${aiDesc}`;
          } else {
            descEl.textContent = aiDesc;
          }
        } else {
          descEl.textContent = msg.length > 60 ? msg.slice(0, 60) + '…' : msg;
        }
      } catch {
        descEl.textContent = msg.length > 60 ? msg.slice(0, 60) + '…' : msg;
      }
    })(sha, c.sha, row);
  }

  // Store latest sha so we know what's "new" next time
  if (latestSha) localStorage.setItem('flux_last_seen_commit', latestSha);
}

async function injectBuildNumber() {
  try {
    const commits = await fetchCommits();
    if (!commits?.length) return;

    const latest = commits[0];
    const sha = latest.sha.slice(0, 7);
    window._fluxBuildSHA = sha;
    window._fluxBuildURL = `https://github.com/nxtcoreee3/Flux/commit/${latest.sha}`;
    window._fluxBuildMsg = (latest.commit?.message || '').split('\n')[0];

    // Inject SHA into profile dropdown
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

    // Render commits panel (index.html only)
    if (document.getElementById('hero-commits')) {
      await renderCommitsPanel(commits);

      // Auto-refresh every 5 minutes
      setInterval(async () => {
        try {
          const fresh = await fetchCommits(true);
          if (fresh?.length) await renderCommitsPanel(fresh);
        } catch {}
      }, COMMITS_CACHE_TTL);
    }
  } catch { }
}

/* ===================== FULLSCREEN ===================== */
function openFullscreen(url, title) {
  document.getElementById('flux-fullscreen')?.remove();
  const fs = document.createElement('div');
  fs.id = 'flux-fullscreen';
  fs.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#000;display:flex;flex-direction:column;';
  fs.innerHTML = `
    <div id="fs-hover-zone" style="position:absolute;top:0;left:0;right:0;height:60px;z-index:5;pointer-events:auto;"></div>
    <div id="fs-bar" style="position:absolute;top:0;left:0;right:0;z-index:6;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(to bottom,rgba(0,0,0,0.85),transparent);transition:opacity 0.3s;pointer-events:auto;">
      <button id="fs-exit" style="background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.3);color:white;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px);pointer-events:auto;">✕ Exit</button>
      <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);flex:1;">${title}</span>
      ${isKillSwitchEnabled() ? `<div style="display:flex;align-items:center;">
        <button id="fs-kill-btn" title="Kill Switch (Shift+Esc)" style="background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:none;border-radius:8px 0 0 8px;padding:7px 13px;font-size:13px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px;box-shadow:0 2px 10px rgba(239,68,68,0.4);">⚡ Kill</button>
        <button id="fs-kill-settings-btn" title="Configure Kill Switch" style="background:rgba(239,68,68,0.25);color:#fca5a5;border:none;border-left:1px solid rgba(239,68,68,0.4);border-radius:0 8px 8px 0;padding:7px 8px;font-size:11px;cursor:pointer;">⚙</button>
      </div>` : ''}
    </div>
    <div id="fs-loading-bg" style="position:absolute;inset:0;background:#fff url('assets/loading.gif') center center / 250px no-repeat;z-index:1;"></div>
    <iframe id="fs-iframe" src="${url}" style="flex:1;border:0;width:100%;height:100%;opacity:0;transition:opacity 0.4s ease;position:relative;z-index:2;" allow="autoplay; fullscreen" sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
    <div id="fs-embed-warn" style="display:none;position:absolute;inset:0;z-index:3;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:rgba(0,0,0,0.85);">
      <span style="font-size:32px;">🕒</span>
      <span style="color:white;font-size:15px;font-weight:600;text-align:center;padding:0 20px;">This game might be having trouble loading. Please wait, or report it to an Admin.</span>
      <button id="fs-fallback-btn" style="background:#3a7dff;color:white;border:none;border-radius:10px;padding:10px 22px;font-size:14px;font-weight:700;cursor:pointer;">Keep Waiting</button>
      <a href="social.html" style="color:#9ca3af;font-size:12px;margin-top:8px;text-decoration:underline;">Or report to an Admin</a>
    </div>
  `;
  document.body.appendChild(fs);
  const bar = fs.querySelector('#fs-bar');
  const hoverZone = fs.querySelector('#fs-hover-zone');
  const fsIframe = fs.querySelector('#fs-iframe');
  const fsWarn = fs.querySelector('#fs-embed-warn');
  let barTimer;

  const showBar = () => {
    bar.style.opacity = '1';
    clearTimeout(barTimer);
    barTimer = setTimeout(() => { bar.style.opacity = '0'; }, 3000);
  };
  const hideBar = () => { bar.style.opacity = '0'; };

  // Show bar on hover zone (transparent area at top of screen above iframe)
  hoverZone.addEventListener('mouseenter', showBar);
  hoverZone.addEventListener('mousemove', showBar);
  bar.addEventListener('mouseenter', showBar);
  bar.addEventListener('mousemove', showBar);

  // Touch: tap anywhere shows bar
  fs.addEventListener('touchstart', showBar, { passive: true });

  // Always show bar initially
  showBar();

  fs.querySelector('#fs-exit').addEventListener('click', () => fs.remove());
  fs.querySelector('#fs-kill-btn')?.addEventListener('click', () => triggerKillSwitch());
  fs.querySelector('#fs-kill-settings-btn')?.addEventListener('click', (e) => { e.stopPropagation(); buildKillSwitchPopover(); });
  fs.querySelector('#fs-fallback-btn').addEventListener('click', () => { fsWarn.style.display = 'none'; });

  let fsLoaded = false;
  fsIframe.addEventListener('load', () => {
    fsLoaded = true;
    fsIframe.style.opacity = '1';
    const lbg = fs.querySelector('#fs-loading-bg');
    if (lbg) lbg.style.display = 'none';
  }, { once: true });
  setTimeout(() => {
    if (!fsLoaded) {
      fsWarn.style.display = 'flex';
      const lbg = fs.querySelector('#fs-loading-bg');
      if (lbg) lbg.style.display = 'none';
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

  // Wire keep-waiting button in play modal
  const keepWaitingBtn = embedWarning?.querySelector('#keep-waiting') || embedWarning?.querySelector('#keep-waiting-2');
  if (keepWaitingBtn) {
    keepWaitingBtn.onclick = () => { embedWarning.classList.add('hidden'); };
  }

  const closeModal = () => { modal.setAttribute('aria-hidden', 'true'); if (iframe) iframe.src = 'about:blank'; clearCurrentlyPlaying(); };
  if (closeBtn) closeBtn.onclick = closeModal;
  modal.querySelectorAll('[data-close]').forEach(el => el.onclick = closeModal);
  window.addEventListener('keydown', function escClose(e) { if (e.key === 'Escape') { closeModal(); window.removeEventListener('keydown', escClose); } });

  if (iframe) {
    embedWarning?.classList.add('hidden');
    if (fsBtn) fsBtn.style.display = '';
    iframe.src = url;
    iframe.style.opacity = '0';
    iframe.style.transition = 'opacity 0.4s ease';
    if (iframe.parentElement) {
      iframe.parentElement.style.background = "#fff url('assets/loading.gif') center center / 250px no-repeat";
    }

    let loaded = false;
    iframe.addEventListener('load', () => {
      loaded = true;
      embedWarning?.classList.add('hidden');
      iframe.style.opacity = '1';
      if (iframe.parentElement) {
        iframe.parentElement.style.background = ""; // remove loading gif once loaded
      }
    }, { once: true });
    setTimeout(() => {
      if (!loaded) {
        // Fallback for X-Frame-Options
        embedWarning?.classList.remove('hidden');
        if (fsBtn) fsBtn.style.display = 'none'; // hide if embedding blocked
        
        const fb = embedWarning?.querySelector('a');
        if (fb) {
          fb.href = 'social.html';
        }
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
    if (m) { m.setAttribute('aria-hidden', 'true'); const iframe = m.querySelector('iframe'); if (iframe) iframe.src = 'about:blank'; }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => {
      m.setAttribute('aria-hidden', 'true');
      const iframe = m.querySelector('iframe'); if (iframe) iframe.src = 'about:blank';
    });
  }
});

/* ===================== FLOATING TOOLTIP ===================== */
(function () {
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

  const pricing = _gamePricing[game.id] || { price: 0, discount: 0 };
  const isExpired = pricing.discountExpiry && new Date(pricing.discountExpiry) < new Date();
  const activeDiscount = (!isExpired && pricing.discount > 0) ? pricing.discount : 0;
  const finalPrice = activeDiscount > 0 ? Math.round(pricing.price * (1 - activeDiscount / 100)) : (pricing.price || 0);
  const isLocked = finalPrice > 0 && !_unlockedGames.includes(game.id);
  const stats = _allGameStats[game.id] || {};
  const avgRating = stats.ratingCount ? (stats.ratingTotal / stats.ratingCount).toFixed(1) : null;
  const isModLocked = stats.locked === true;
  const isOwnerView = window._fluxIsOwner === true;

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
          <div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg,#f9fafb);border-radius:10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span>💎</span><div><div style="font-size:16px;font-weight:700;color:var(--text,#111);">${finalPrice > 0 ? finalPrice + ' pts' : 'Free'}</div><div style="font-size:10px;color:var(--muted,#6b7280);">${isLocked ? 'to unlock' : '✓ unlocked'}</div></div></div>
          ${stats.firstSeen ? `<div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg,#f9fafb);border-radius:10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span>📅</span><div><div style="font-size:12px;font-weight:700;color:var(--text,#111);">${new Date(stats.firstSeen).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div><div style="font-size:10px;color:var(--muted,#6b7280);">added</div></div></div>` : ''}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">About this game</div>
          <div id="gd-ai-desc" style="font-size:14px;color:var(--text,#111);line-height:1.7;background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));">${game.desc} <span style="color:var(--muted,#9ca3af);font-size:12px;">✨ Enhancing...</span></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${isModLocked && !isOwnerView
      ? `<button id="gd-modlock-info" style="flex:1;min-width:140px;padding:12px 20px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">🔒 Temporarily Unavailable (Get Info)</button>`
      : isLocked
        ? `<button id="gd-unlock-btn" style="flex:1;min-width:140px;padding:12px 20px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">🔒 Unlock for ${finalPrice} pts</button>`
        : `<button id="gd-play-btn" style="flex:1;min-width:140px;padding:12px 20px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">▶ Play Now</button>`}
          <button id="gd-fav-btn" style="padding:12px 20px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;background:var(--bg,#f9fafb);color:var(--text,#111);">${isFav(game.id) ? '★ Favourited' : '☆ Favourite'}</button>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--muted,#6b7280);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Reviews</div>
          <div style="background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--text,#111);margin-bottom:10px;">Leave a Review</div>
            <div id="gd-star-row" style="display:flex;gap:6px;margin-bottom:10px;">
              ${[1, 2, 3, 4, 5].map(s => `<button class="gd-star" data-star="${s}" style="background:none;border:none;font-size:26px;cursor:pointer;color:#d1d5db;padding:0;">★</button>`).join('')}
            </div>
            <textarea id="gd-review-text" placeholder="Share your thoughts... (optional)" maxlength="500" rows="2" style="width:100%;padding:9px 12px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:10px;font-size:13px;font-family:inherit;resize:none;box-sizing:border-box;outline:none;background:var(--panel,#fff);color:var(--text,#111);"></textarea>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
              <span id="gd-review-msg" style="font-size:12px;color:var(--muted,#6b7280);"></span>
              <button id="gd-submit-review" style="padding:7px 16px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Submit</button>
            </div>
          </div>
          <div id="gd-reviews-list" style="display:flex;flex-direction:column;gap:12px;"><div style="text-align:center;color:var(--muted,#6b7280);font-size:13px;padding:16px;"><div style="display:flex;justify-content:center;padding:20px;"><img src="assets/loading.gif" style="width:80px;height:auto;" alt="Loading..."></div></div></div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  document.getElementById('gd-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', function escH(e) { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', escH); } });

  document.getElementById('gd-play-btn')?.addEventListener('click', () => {
    close(); addRecent(game.id); renderRecentSection();
    trackGamePlay(game.id, game.title); setCurrentlyPlaying(game.id, game.title);
    openPlayModal(game.url, game.title);
  });
  document.getElementById('gd-unlock-btn')?.addEventListener('click', () => { close(); showUnlockModal(game, finalPrice, activeDiscount, pricing.price); });
  document.getElementById('gd-modlock-info')?.addEventListener('click', () => { close(); showModLockInfoModal(game, stats); });

  const favBtn = document.getElementById('gd-fav-btn');
  favBtn.addEventListener('click', async () => {
    await toggleFav(game.id);
    favBtn.textContent = isFav(game.id) ? '★ Favourited' : '☆ Favourite';
    renderFavouritesSection();
  });

  let selectedRating = 0;
  const stars = overlay.querySelectorAll('.gd-star');
  stars.forEach(btn => {
    btn.addEventListener('mouseenter', () => { const v = parseInt(btn.dataset.star); stars.forEach(s => s.style.color = parseInt(s.dataset.star) <= v ? '#f59e0b' : '#d1d5db'); });
    btn.addEventListener('mouseleave', () => { stars.forEach(s => s.style.color = parseInt(s.dataset.star) <= selectedRating ? '#f59e0b' : '#d1d5db'); });
    btn.addEventListener('click', () => { selectedRating = parseInt(btn.dataset.star); stars.forEach(s => s.style.color = parseInt(s.dataset.star) <= selectedRating ? '#f59e0b' : '#d1d5db'); });
  });

  document.getElementById('gd-submit-review').addEventListener('click', async () => {
    const msg = document.getElementById('gd-review-msg'), comment = document.getElementById('gd-review-text').value.trim();
    if (!selectedRating) { msg.style.color = '#ef4444'; msg.textContent = 'Pick a star rating first.'; return; }
    msg.style.color = '#9ca3af'; msg.textContent = 'Saving...';
    const r = await submitReview(game.id, game.title, selectedRating, comment);
    if (r.ok) { msg.style.color = '#22c55e'; msg.textContent = '✓ Saved!'; document.getElementById('gd-review-text').value = ''; selectedRating = 0; stars.forEach(s => s.style.color = '#d1d5db'); loadDetailReviews(game.id); }
    else { msg.style.color = '#ef4444'; msg.textContent = r.error; }
  });

  getAiGameDescription(game).then(desc => { const el = document.getElementById('gd-ai-desc'); if (el) el.textContent = desc; });
  loadDetailReviews(game.id);
}

async function loadDetailReviews(gameId) {
  const list = document.getElementById('gd-reviews-list');
  if (!list) return;
  const reviews = await getGameReviews(gameId);
  if (!reviews.length) { list.innerHTML = '<div style="text-align:center;color:var(--muted,#6b7280);font-size:13px;padding:16px;">No reviews yet. Be the first!</div>'; return; }
  list.innerHTML = '';
  reviews.forEach(r => {
    const item = document.createElement('div');
    item.style.cssText = 'background:var(--bg,#f9fafb);border-radius:12px;padding:14px 16px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));';
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const d = Date.now() - new Date(r.createdAt).getTime();
    const timeAgo = d < 3600000 ? Math.floor(d / 60000) + 'm ago' : d < 86400000 ? Math.floor(d / 3600000) + 'h ago' : Math.floor(d / 86400000) + 'd ago';
    const isMe = r.uid === (window._currentUserUid || ''), isAdmin = window._currentUserUid === 'zEy6TO5ligf2um4rssIZs9C9X7f2';
    const alreadyLiked = (r.likes || []).includes(window._currentUserUid || '');
    item.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--accent,#3a7dff);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0;">${(r.displayName || '?')[0].toUpperCase()}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:13px;font-weight:700;color:var(--text,#111);">@${r.username}</span>
            <span style="color:#f59e0b;">${stars}</span>
            <span style="font-size:11px;color:var(--muted,#6b7280);">${timeAgo}</span>
          </div>
          ${r.comment ? `<div style="font-size:13px;color:var(--text,#111);margin-top:4px;line-height:1.5;">${r.comment}</div>` : ''}
        </div>
        ${(isMe || isAdmin) ? `<button class="gd-del-rev" data-id="${r.id}" style="background:none;border:none;color:var(--muted,#9ca3af);cursor:pointer;font-size:13px;flex-shrink:0;">🗑</button>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:14px;padding-top:8px;border-top:1px solid var(--glass-border,rgba(0,0,0,0.06));">
        <button class="gd-like" data-id="${r.id}" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--muted,#6b7280);display:flex;align-items:center;gap:4px;padding:0;">${alreadyLiked ? '❤️' : '🤍'} ${r.likes?.length || 0}</button>
        <button class="gd-reply-toggle" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--muted,#6b7280);padding:0;">💬 ${r.comments?.length || 0} ${r.comments?.length === 1 ? 'reply' : 'replies'}</button>
      </div>
      <div class="gd-comments-area" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--glass-border,rgba(0,0,0,0.06));">
        <div class="gd-clist" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">
          ${(r.comments || []).map(c => `<div style="display:flex;gap:8px;"><div style="width:24px;height:24px;border-radius:50%;background:var(--accent,#3a7dff);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;flex-shrink:0;">${(c.displayName || '?')[0].toUpperCase()}</div><div style="flex:1;background:var(--panel,#fff);border-radius:8px;padding:7px 10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));font-size:12px;color:var(--text,#111);"><strong>@${c.username}</strong> ${c.comment}</div></div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <input class="gd-cin" data-review="${r.id}" type="text" placeholder="Reply..." maxlength="300" style="flex:1;padding:7px 10px;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:var(--panel,#fff);color:var(--text,#111);">
          <button class="gd-csub" data-review="${r.id}" style="padding:7px 12px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Reply</button>
        </div>
      </div>`;
    list.appendChild(item);
    item.querySelector('.gd-like').addEventListener('click', async e => {
      const btn = e.currentTarget; const res = await likeReview(gameId, btn.dataset.id);
      if (res.ok) { const cnt = parseInt(btn.textContent.match(/\d+/)?.[0] || 0) + (res.liked ? 1 : -1); btn.innerHTML = `${res.liked ? '❤️' : '🤍'} ${Math.max(0, cnt)}`; }
    });
    item.querySelector('.gd-reply-toggle').addEventListener('click', () => { const a = item.querySelector('.gd-comments-area'); a.style.display = a.style.display === 'none' ? 'block' : 'none'; });
    item.querySelector('.gd-csub').addEventListener('click', async () => {
      const inp = item.querySelector('.gd-cin'); const res = await addReviewComment(gameId, r.id, inp.value.trim());
      if (res.ok) { const cl = item.querySelector('.gd-clist'); const nd = document.createElement('div'); nd.style.cssText = 'display:flex;gap:8px;'; nd.innerHTML = `<div style="width:24px;height:24px;border-radius:50%;background:var(--accent,#3a7dff);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700;flex-shrink:0;">Y</div><div style="flex:1;background:var(--panel,#fff);border-radius:8px;padding:7px 10px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));font-size:12px;color:var(--text,#111);"><strong>You</strong> ${inp.value.trim()}</div>`; cl.appendChild(nd); inp.value = ''; }
    });
    item.querySelector('.gd-del-rev')?.addEventListener('click', async e => { if (!confirm('Delete?')) return; await deleteReview(gameId, e.currentTarget.dataset.id); item.remove(); if (!list.children.length) loadDetailReviews(gameId); });
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
    if (user) { const s = await gd(fd(getFirestore(getApp()), 'profiles', user.uid)); userPoints = s.exists() ? (s.data().points || 0) : 0; }
  } catch { }
  const canAfford = userPoints >= finalPrice;
  const modal = document.createElement('div');
  modal.id = 'flux-unlock-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:380px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.25);text-align:center;">
      <div style="font-size:44px;margin-bottom:12px;">🔒</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text,#111);margin-bottom:6px;">${game.title}</div>
      ${discount > 0 ? `<div style="margin-bottom:6px;"><span style="text-decoration:line-through;color:var(--muted,#9ca3af);font-size:14px;">${originalPrice} pts</span> <span style="background:linear-gradient(135deg,#ef4444,#f97316);color:white;font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;">${discount}% OFF</span></div>` : ''}
      <div style="font-size:28px;font-weight:800;color:var(--accent,#3a7dff);margin-bottom:8px;">${finalPrice} pts</div>
      <div style="font-size:13px;color:var(--muted,#6b7280);margin-bottom:20px;">Your balance: <strong style="color:${canAfford ? '#22c55e' : '#ef4444'}">${userPoints} pts</strong></div>
      ${canAfford
      ? `<button id="unlock-confirm-btn" style="width:100%;padding:13px;background:var(--accent,#3a7dff);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">🔓 Unlock for ${finalPrice} pts</button>`
      : `<button id="earn-more-btn" style="width:100%;padding:13px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">💡 How to earn more points</button>`}
      <button id="unlock-cancel-btn" style="width:100%;padding:11px;background:none;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111);">Cancel</button>
      <p id="unlock-msg" style="font-size:12px;margin:10px 0 0;display:none;"></p>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('unlock-cancel-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('unlock-confirm-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('unlock-confirm-btn'); btn.textContent = 'Unlocking...'; btn.disabled = true;
    const res = await unlockGame(game.id, finalPrice);
    const msg = document.getElementById('unlock-msg'); msg.style.display = 'block';
    if (res.ok) { _unlockedGames.push(game.id); msg.style.color = '#22c55e'; msg.textContent = `✓ Unlocked! Balance: ${res.newBalance} pts`; setTimeout(() => { close(); renderGames(GAMES); }, 1500); }
    else { msg.style.color = '#ef4444'; msg.textContent = res.error; btn.textContent = `🔓 Unlock for ${finalPrice} pts`; btn.disabled = false; }
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
    { icon: '🔐', label: 'Daily login', pts: '+10 pts', desc: 'Log in every day' },
    { icon: '🔥', label: 'Login streak', pts: '+2 pts/day', desc: 'Consecutive logins earn bonus (max +50)' },
    { icon: '⏱️', label: 'Time on site', pts: '+1 pt/5 min', desc: 'Just browse Flux' },
    { icon: '🎰', label: 'Spin the wheel', pts: 'Up to 500 pts', desc: 'Spin once per hour in your profile menu' },
    { icon: '🎁', label: 'Receive a gift', pts: 'Varies', desc: 'Another player can gift you their points' },
  ];
  modal.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.25);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:40px;margin-bottom:8px;">💡</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--text,#111);">How to Earn Points</div>
        ${game ? `<div style="font-size:13px;color:var(--muted,#6b7280);margin-top:4px;">Need <strong style="color:var(--accent,#3a7dff)">${requiredPts} pts</strong> to unlock <strong>${game.title}</strong></div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        ${ways.map(w => `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg,#f9fafb);border-radius:12px;border:1px solid var(--glass-border,rgba(0,0,0,0.07));"><span style="font-size:22px;flex-shrink:0;">${w.icon}</span><div style="flex:1;"><div style="font-size:13px;font-weight:700;color:var(--text,#111);">${w.label}</div><div style="font-size:11px;color:var(--muted,#6b7280);">${w.desc}</div></div><span style="font-size:12px;font-weight:700;color:#22c55e;white-space:nowrap;">${w.pts}</span></div>`).join('')}
      </div>
      <div style="display:flex;gap:10px;">
        <button id="earn-spin-btn" style="flex:1;padding:12px;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">🎰 Spin Now</button>
        <button id="earn-close-btn" style="flex:1;padding:12px;background:var(--bg,#f9fafb);border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111);">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('earn-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.getElementById('earn-spin-btn').addEventListener('click', () => { close(); window.openSpinWheel?.(); });
}

/* ===================== SPIN WHEEL ===================== */
window.openSpinWheel = async function () {
  document.getElementById('flux-spin-modal')?.remove();
  const lastSpin = await getLastSpin();
  const cooldownMs = lastSpin ? Math.max(0, new Date(lastSpin).getTime() + 3600000 - Date.now()) : 0;
  const segs = SPIN_SEGMENTS;
  const total = segs.reduce((s, seg) => s + seg.weight, 0);
  const size = 260, cx = 130, cy = 130, r = 126;
  let svgSlices = ''; let angle = -Math.PI / 2;
  segs.forEach(seg => {
    const sweep = (1 / segs.length) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const mid = angle + sweep / 2, tx = cx + (r * 0.65) * Math.cos(mid), ty = cy + (r * 0.65) * Math.sin(mid);
    svgSlices += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${seg.color}" stroke="white" stroke-width="1.5"/>`;
    svgSlices += `<text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="10" font-weight="700" font-family="DM Sans,sans-serif" transform="rotate(${(mid * 180 / Math.PI).toFixed(1)},${tx.toFixed(2)},${ty.toFixed(2)})">${seg.label}</text>`;
    angle += sweep;
  });
  const onCooldown = cooldownMs > 0;
  const mL = Math.floor(cooldownMs / 60000), sL = Math.floor((cooldownMs % 60000) / 1000);
  const modal = document.createElement('div');
  modal.id = 'flux-spin-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(8px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:24px;padding:28px 24px;max-width:360px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.3);text-align:center;">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--text,#111);margin-bottom:4px;">🎰 Spin Wheel</div>
      <div style="font-size:12px;color:var(--muted,#6b7280);margin-bottom:16px;">Spin once per hour to win points!</div>
      <div style="position:relative;display:inline-block;margin-bottom:16px;">
        <svg id="spin-wheel-svg" width="${size}" height="${size}" style="transition:transform 4s cubic-bezier(0.17,0.67,0.12,0.99);transform-origin:center;">${svgSlices}</svg>
        <div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:22px solid #111827;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></div>
      </div>
      <div id="spin-result" style="min-height:44px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;font-size:20px;font-weight:700;color:var(--text,#111);"></div>
      ${onCooldown ? `<div style="padding:12px;background:rgba(239,68,68,0.08);border-radius:12px;border:1px solid rgba(239,68,68,0.15);margin-bottom:14px;"><div style="font-size:13px;color:#ef4444;font-weight:700;">⏱ Next spin in</div><div id="spin-countdown" style="font-size:22px;font-weight:800;color:#ef4444;">${mL}m ${sL}s</div></div>` : ''}
      <button id="spin-btn" ${onCooldown ? 'disabled' : ''} style="width:100%;padding:13px;background:${onCooldown ? '#d1d5db' : 'linear-gradient(135deg,#8b5cf6,#ec4899)'};color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:${onCooldown ? 'not-allowed' : 'pointer'};margin-bottom:10px;">${onCooldown ? '⏳ On Cooldown' : '🎰 Spin!'}</button>
      <button id="spin-close-btn" style="width:100%;padding:11px;background:none;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111);">Close</button>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('spin-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  if (onCooldown) {
    const cEl = document.getElementById('spin-countdown');
    const tick = setInterval(() => {
      const rem = Math.max(0, new Date(lastSpin).getTime() + 3600000 - Date.now());
      if (!document.getElementById('spin-countdown')) { clearInterval(tick); return; }
      if (rem <= 0) { cEl.textContent = 'Ready!'; clearInterval(tick); return; }
      cEl.textContent = Math.floor(rem / 60000) + 'm ' + Math.floor((rem % 60000) / 1000) + 's';
    }, 1000);
  }
  document.getElementById('spin-btn').addEventListener('click', async () => {
    const btn = document.getElementById('spin-btn'), res = document.getElementById('spin-result');
    btn.disabled = true; btn.textContent = 'Spinning...';
    const result = await spinWheel();
    if (!result.ok) { res.innerHTML = `<span style="color:#ef4444;font-size:14px;">${result.error === 'cooldown' ? '⏱ Come back later!' : result.error}</span>`; btn.disabled = false; btn.textContent = '🎰 Spin!'; return; }
    const seg = result.segment;
    const segIdx = segs.findIndex(s => s.label === seg.label);
    const segAngleDeg = (segIdx * (360 / segs.length)) + (180 / segs.length);
    const spins = 5 + Math.floor(Math.random() * 3);
    document.getElementById('spin-wheel-svg').style.transform = `rotate(${spins * 360 + (360 - segAngleDeg)}deg)`;
    setTimeout(() => {
      if (seg.points > 0) res.innerHTML = `<span style="color:#22c55e;">🎉 You won <strong style="font-size:28px;">${seg.points}</strong> pts!</span>`;
      else res.innerHTML = `<span style="color:#6b7280;">😅 Try again next hour!</span>`;
      btn.textContent = '⏳ Come back in 1 hour';
    }, 4200);
  });
};

/* ===================== GIFT POINTS MODAL ===================== */
window.openGiftPoints = function () {
  document.getElementById('flux-gift-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'flux-gift-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML = `
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
  const close = () => modal.remove();
  document.getElementById('gift-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  const updatePreview = () => {
    const u = document.getElementById('gift-username').value.trim();
    const a = parseInt(document.getElementById('gift-amount').value) || 0;
    const p = document.getElementById('gift-preview');
    if (u && a > 0) { p.style.display = 'block'; p.innerHTML = `Sending <strong>${a} pts</strong> to <strong>@${u}</strong>`; }
    else p.style.display = 'none';
  };
  document.getElementById('gift-username').addEventListener('input', updatePreview);
  document.getElementById('gift-amount').addEventListener('input', updatePreview);
  document.getElementById('gift-send-btn').addEventListener('click', async () => {
    const username = document.getElementById('gift-username').value.trim().toLowerCase().replace('@', '');
    const amount = parseInt(document.getElementById('gift-amount').value);
    const msg = document.getElementById('gift-msg'), btn = document.getElementById('gift-send-btn');
    if (!username) { msg.style.color = '#ef4444'; msg.textContent = 'Enter a username.'; msg.style.display = 'block'; return; }
    if (!amount || amount < 1) { msg.style.color = '#ef4444'; msg.textContent = 'Enter a valid amount.'; msg.style.display = 'block'; return; }
    btn.textContent = 'Sending...'; btn.disabled = true;
    const res = await giftPointsToUser(username, amount);
    msg.style.display = 'block';
    if (res.ok) { msg.style.color = '#22c55e'; msg.textContent = `✓ Sent ${amount} pts to @${username}! Balance: ${res.newBalance} pts`; setTimeout(close, 2500); }
    else { msg.style.color = '#ef4444'; msg.textContent = res.error; btn.textContent = '🎁 Send Gift'; btn.disabled = false; }
  });
};

/* ===================== REDEEM CODE MODAL ===================== */
window.openRedeemCode = function () {
  document.getElementById('flux-redeem-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'flux-redeem-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;font-family:inherit;';
  modal.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px 24px;max-width:380px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.25);">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:44px;margin-bottom:8px;">🎟️</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--text,#111827);">Redeem a Code</div>
        <div style="font-size:13px;color:var(--muted,#6b7280);margin-top:4px;">Enter a reward code to claim points, games, or free spins.</div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <input id="redeem-code-input" type="text" placeholder="Enter code..." maxlength="20"
          style="flex:1;padding:12px 14px;border:2px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:15px;font-family:monospace;letter-spacing:2px;text-transform:uppercase;outline:none;box-sizing:border-box;background:var(--bg,#f9fafb);color:var(--text,#111827);transition:border-color 0.15s;">
        <button id="redeem-submit-btn" style="padding:12px 18px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(124,58,237,0.35);transition:opacity 0.15s;">Redeem</button>
      </div>
      <div id="redeem-result" style="display:none;padding:14px 16px;border-radius:12px;font-size:14px;font-weight:600;text-align:center;margin-bottom:12px;"></div>
      <button id="redeem-close-btn" style="width:100%;padding:11px;background:none;border:1px solid var(--glass-border,rgba(0,0,0,0.1));border-radius:12px;font-size:14px;cursor:pointer;color:var(--text,#111827);">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('redeem-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  window.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', esc); } });

  const input = document.getElementById('redeem-code-input');
  const result = document.getElementById('redeem-result');
  input.focus();

  // Format input as uppercase
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  // Submit on Enter
  input.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('redeem-submit-btn').click(); });

  document.getElementById('redeem-submit-btn').addEventListener('click', async () => {
    const code = input.value.trim();
    const btn = document.getElementById('redeem-submit-btn');
    if (!code) {
      input.style.borderColor = '#ef4444';
      setTimeout(() => input.style.borderColor = '', 800);
      return;
    }
    btn.textContent = 'Checking...'; btn.disabled = true; btn.style.opacity = '0.7';
    result.style.display = 'none';
    const res = await redeemCode(code);
    btn.textContent = 'Redeem'; btn.disabled = false; btn.style.opacity = '1';

    if (res.ok) {
      result.style.display = 'block';
      result.style.background = 'rgba(34,197,94,0.1)';
      result.style.border = '1px solid rgba(34,197,94,0.25)';
      result.style.color = '#16a34a';
      result.innerHTML = `${res.message}<br><span style="font-size:12px;font-weight:400;opacity:0.8;">${res.type === 'points' ? 'Points added to your balance instantly.' :
          res.type === 'game' ? 'Game is now unlocked — play it from the games page.' :
            `${res.value} free spin${res.value > 1 ? 's' : ''} added. Use them from your profile menu.`
        }</span>`;
      input.value = '';
      input.style.borderColor = '#22c55e';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
      // If game unlocked, refresh the card grid
      if (res.type === 'game') {
        _unlockedGames.push(res.value);
        if (document.getElementById('game-grid') || document.getElementById('games-grid')) renderGames(GAMES);
      }
    } else {
      result.style.display = 'block';
      result.style.background = 'rgba(239,68,68,0.08)';
      result.style.border = '1px solid rgba(239,68,68,0.2)';
      result.style.color = '#dc2626';
      result.textContent = res.error;
      input.style.borderColor = '#ef4444';
      setTimeout(() => { input.style.borderColor = ''; }, 1000);
    }
  });
};

function updateGlobalUnreadBadge(total) {
  let navLink = null;
  document.querySelectorAll('#main-nav a').forEach(a => {
    if (a.getAttribute('href') === 'messages.html') navLink = a;
  });
  
  if (!navLink) return;

  let badge = navLink.querySelector('.global-unread-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'global-unread-badge';
    badge.style.cssText = `
      margin-left: 6px; background: #ef4444; color: white;
      font-size: 10px; font-weight: 800; padding: 2px 6px;
      border-radius: 20px; display: none; align-items: center;
      justify-content: center; min-width: 18px; height: 18px;
    `;
    navLink.appendChild(badge);
  }
  
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline-flex' : 'none';
}

function showNotificationToast(title, text, avatar, link) {
  const container = document.getElementById('toast-container') || document.body;
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    width: 300px; background: #fff; border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.05);
    padding: 12px; display: flex; gap: 12px; align-items: center;
    cursor: pointer; animation: toastSlideIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    font-family: 'Inter', sans-serif;
  `;
  
  const avatarHTML = avatar 
    ? `<img src="${avatar}" style="width:44px;height:44px;border-radius:12px;object-fit:cover;flex-shrink:0;">`
    : `<div style="width:44px;height:44px;border-radius:12px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:700;flex-shrink:0;">💬</div>`;

  toast.innerHTML = `
    ${avatarHTML}
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:2px;">${title}</div>
      <div style="font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${text}</div>
    </div>
  `;
  
  toast.addEventListener('click', () => { window.location.href = link; });
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastSlideIn {
      from { transform: translateX(100%) scale(0.9); opacity: 0; }
      to { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes toastSlideOut {
      from { transform: translateX(0) scale(1); opacity: 1; }
      to { transform: translateX(100%) scale(0.9); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/* ===================== KILL SWITCH (Boss Key) ===================== */

const KILL_SWITCH_KEY = 'flux_kill_switch';

const KILL_SWITCH_PRESETS = [
  { label: '📊 Google Sheets', value: 'https://docs.google.com/spreadsheets/', type: 'web' },
  { label: '🔍 Google', value: 'https://www.google.com', type: 'web' },
  { label: '📰 BBC News', value: 'https://www.bbc.co.uk/news', type: 'web' },
  { label: '📧 Gmail', value: 'https://mail.google.com', type: 'web' },
  { label: '📅 Google Calendar', value: 'https://calendar.google.com', type: 'web' },
  { label: '📄 Google Docs', value: 'https://docs.google.com/document/', type: 'web' },
  { label: '🔧 Custom…', value: 'custom', type: 'custom' },
];

function loadKillSwitch() {
  try {
    return JSON.parse(localStorage.getItem(KILL_SWITCH_KEY)) || { value: 'https://www.google.com', label: '🔍 Google', custom: '' };
  } catch { return { value: 'https://www.google.com', label: '🔍 Google', custom: '' }; }
}

function saveKillSwitch(data) {
  localStorage.setItem(KILL_SWITCH_KEY, JSON.stringify(data));
}

function isValidKillUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url, window.location.href);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

let killOverlayState = null;
function closeKillOverlay() {
  const overlay = document.getElementById('flux-kill-overlay');
  if (!overlay) return;
  overlay.remove();
  if (killOverlayState?.playModal && killOverlayState.wasPlayModalOpen) {
    killOverlayState.playModal.setAttribute('aria-hidden', 'false');
  }
  killOverlayState = null;
}

function openKillOverlay(url) {
  if (!isValidKillUrl(url)) return;

  const existing = document.getElementById('flux-kill-overlay');
  if (existing) {
    const iframe = existing.querySelector('iframe');
    if (iframe) iframe.src = url;
    return;
  }

  const playModal = document.getElementById('play-modal');
  const wasPlayModalOpen = !!(playModal && playModal.getAttribute('aria-hidden') !== 'true');
  if (playModal && wasPlayModalOpen) {
    playModal.setAttribute('aria-hidden', 'true');
  }
  killOverlayState = { playModal, wasPlayModalOpen };

  const overlay = document.createElement('div');
  overlay.id = 'flux-kill-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: #fff;
  `;

  overlay.innerHTML = `
    <div style="position:absolute;inset:0;">
      <iframe src="${url}" title="Kill Switch" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;"></iframe>
      <div id="flux-kill-exit-hint" style="position:absolute;left:12px;bottom:12px;z-index:2;background:rgba(15,23,36,0.85);color:#fff;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:700;backdrop-filter:blur(6px);cursor:pointer;user-select:none;">
        Tap 5× quickly to return
      </div>
    </div>
  `;

  let tapTimes = [];
  const hint = overlay.querySelector('#flux-kill-exit-hint');
  hint?.addEventListener('pointerdown', () => {
    const now = Date.now();
    tapTimes = tapTimes.filter(t => now - t < 900);
    tapTimes.push(now);
    if (tapTimes.length >= 5) {
      closeKillOverlay();
    }
  }, { passive: true });

  document.body.appendChild(overlay);
}

function triggerKillSwitch() {
  if (document.getElementById('flux-kill-overlay')) {
    closeKillOverlay();
    return;
  }
  const cfg = loadKillSwitch();
  const target = cfg.value === 'custom' ? cfg.custom : cfg.value;
  if (!target || !isValidKillUrl(target)) return;
  openKillOverlay(target);
}

function buildKillSwitchPopover() {
  const existing = document.getElementById('kill-switch-popover');
  if (existing) { existing.remove(); return; }

  const cfg = loadKillSwitch();

  const pop = document.createElement('div');
  pop.id = 'kill-switch-popover';
  pop.style.cssText = `
    position: fixed;
    top: 70px; right: 16px;
    width: 300px;
    background: var(--panel);
    border: 1px solid var(--glass-border);
    border-radius: 18px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    z-index: 9999;
    padding: 18px;
    animation: killPopIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both;
  `;

  const isCustom = cfg.value === 'custom';
  pop.innerHTML = `
    <style>
      @keyframes killPopIn {
        from { opacity: 0; transform: scale(0.92) translateY(-8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      .kill-preset-opt {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border-radius: 10px; cursor: pointer; font-size: 13px;
        color: var(--text); transition: background 0.12s;
        border: 1px solid transparent;
      }
      .kill-preset-opt:hover { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.15); }
      .kill-preset-opt.selected { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #ef4444; font-weight: 700; }
      .kill-preset-opt .opt-type { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 20px; flex-shrink: 0; }
      .kill-preset-opt .opt-type.web { background: rgba(34,197,94,0.15); color: #16a34a; }
      .kill-preset-opt .opt-type.app { background: rgba(58,125,255,0.15); color: #3a7dff; }
    </style>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div style="font-size:14px;font-weight:800;color:var(--text);">⚡ Kill Switch</div>
      <button id="kill-pop-close" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:2px;">✕</button>
    </div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5;">Choose a website to instantly escape to when you hit Kill Switch. It opens in a full-screen iframe. <strong style="color:var(--text);">Shift+Esc</strong> also works as a hotkey. To return, tap <strong style="color:var(--text);">5× quickly</strong> on the screen (the bottom-left hint).</p>
    <div id="kill-presets-list" style="display:flex;flex-direction:column;gap:3px;max-height:220px;overflow-y:auto;margin-bottom:12px;">
      ${KILL_SWITCH_PRESETS.map(p => `
        <div class="kill-preset-opt ${cfg.value === p.value ? 'selected' : ''}" data-value="${p.value}" data-label="${p.label}" data-type="${p.type}">
          <span style="flex:1;">${p.label}</span>
          ${p.type !== 'custom' ? `<span class="opt-type ${p.type}">${p.type === 'app' ? 'App' : 'Web'}</span>` : ''}
        </div>
      `).join('')}
    </div>
    <div id="kill-custom-wrap" style="display:${isCustom ? 'block' : 'none'};margin-bottom:12px;">
      <input id="kill-custom-input" type="text" placeholder="e.g. https://example.com"
        value="${cfg.custom || ''}"
        style="width:100%;padding:8px 12px;border:1px solid var(--glass-border);border-radius:10px;font-size:13px;box-sizing:border-box;background:var(--bg);color:var(--text);outline:none;">
    </div>
    <button id="kill-save-btn" style="width:100%;padding:10px;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;border:none;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;letter-spacing:0.3px;">
      Save & Close
    </button>
  `;

  document.body.appendChild(pop);

  let currentSelection = { value: cfg.value, label: cfg.label, custom: cfg.custom || '' };

  const presetsList = pop.querySelector('#kill-presets-list');
  const customWrap = pop.querySelector('#kill-custom-wrap');
  const customInput = pop.querySelector('#kill-custom-input');

  presetsList.querySelectorAll('.kill-preset-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      presetsList.querySelectorAll('.kill-preset-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      currentSelection.value = opt.dataset.value;
      currentSelection.label = opt.dataset.label;
      customWrap.style.display = opt.dataset.type === 'custom' ? 'block' : 'none';
    });
  });

  customInput?.addEventListener('input', () => { currentSelection.custom = customInput.value.trim(); });

  pop.querySelector('#kill-pop-close').addEventListener('click', () => pop.remove());
  pop.querySelector('#kill-save-btn').addEventListener('click', () => {
    if (currentSelection.value === 'custom' && !currentSelection.custom) {
      customInput.style.borderColor = '#ef4444';
      customInput.focus();
      return;
    }
    saveKillSwitch(currentSelection);
    pop.remove();
    showToast('Kill Switch configured! ⚡', 'success');
    document.querySelectorAll('.flux-kill-btn').forEach(btn => {
      btn.title = `Kill Switch → ${currentSelection.value === 'custom' ? currentSelection.custom : currentSelection.label}`;
    });
  });

  setTimeout(() => {
    document.addEventListener('click', function outsideClick(e) {
      if (!pop.contains(e.target) && !e.target.closest('.flux-kill-btn-settings')) {
        pop.remove();
        document.removeEventListener('click', outsideClick);
      }
    });
  }, 0);
}

function createKillButton(compact = false) {
  const cfg = loadKillSwitch();
  const target = cfg.value === 'custom' ? cfg.custom : cfg.label;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;flex-shrink:0;';

  const killBtn = document.createElement('button');
  killBtn.className = 'flux-kill-btn';
  killBtn.title = `Kill Switch → ${target} (Shift+Esc)`;
  killBtn.style.cssText = `
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    border: none;
    border-radius: ${compact ? '8px 0 0 8px' : '10px 0 0 10px'};
    padding: ${compact ? '6px 10px' : '8px 13px'};
    font-weight: 800;
    font-size: ${compact ? '12px' : '13px'};
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    letter-spacing: 0.3px;
    transition: opacity 0.15s, transform 0.1s;
    box-shadow: 0 2px 12px rgba(239,68,68,0.35);
  `;
  killBtn.innerHTML = `<span>⚡</span>${compact ? '' : '<span>Kill</span>'}`;
  killBtn.addEventListener('click', triggerKillSwitch);
  killBtn.addEventListener('mouseenter', () => { killBtn.style.opacity = '0.88'; });
  killBtn.addEventListener('mouseleave', () => { killBtn.style.opacity = '1'; });

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'flux-kill-btn-settings';
  settingsBtn.title = 'Configure Kill Switch';
  settingsBtn.style.cssText = `
    background: rgba(239,68,68,0.15);
    color: #ef4444;
    border: none;
    border-left: 1px solid rgba(239,68,68,0.3);
    border-radius: ${compact ? '0 8px 8px 0' : '0 10px 10px 0'};
    padding: ${compact ? '6px 7px' : '8px 8px'};
    font-size: ${compact ? '10px' : '11px'};
    cursor: pointer;
    transition: background 0.15s;
    box-shadow: 0 2px 12px rgba(239,68,68,0.15);
  `;
  settingsBtn.textContent = '⚙';
  settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); buildKillSwitchPopover(); });
  settingsBtn.addEventListener('mouseenter', () => { settingsBtn.style.background = 'rgba(239,68,68,0.25)'; });
  settingsBtn.addEventListener('mouseleave', () => { settingsBtn.style.background = 'rgba(239,68,68,0.15)'; });

  wrap.appendChild(killBtn);
  wrap.appendChild(settingsBtn);
  return wrap;
}

const KILL_ENABLED_KEY = 'flux_kill_switch_enabled';
function isKillSwitchEnabled() { return localStorage.getItem(KILL_ENABLED_KEY) !== '0'; }

function initKillSwitch() {
  if (!isKillSwitchEnabled()) return;

  // 1. Inject into topbar right-actions
  const rightActions = document.querySelector('.right-actions');
  if (rightActions && !rightActions.querySelector('.flux-kill-btn')) {
    rightActions.prepend(createKillButton(false));
  }

  // 2. Fill dedicated modal slots (index.html + games.html)
  ['modal-kill-btn-wrap', 'modal-kill-btn-wrap-2'].forEach(id => {
    const wrap = document.getElementById(id);
    if (wrap && !wrap.querySelector('.flux-kill-btn')) {
      wrap.appendChild(createKillButton(true));
    }
  });

  // Keyboard shortcut: Shift + Escape
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'Escape') { e.preventDefault(); triggerKillSwitch(); }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKillSwitch);
} else {
  initKillSwitch();
}
