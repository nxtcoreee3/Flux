/* script.js
   Single data file that powers the UI and features:
   - Game list rendering
   - Play modal with iframe + fallback
   - Search & sort
   - Favorites (localStorage)
   - Small responsive nav
*/

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
    thumb: 'assets/paper-io.png',
    url: 'https://nxtcoreee3.github.io/Paper.io/',
    desc: 'Claim your territory and defeat other players!'
  }
];

/* --- Utilities --- */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* DOM elements (for index/games pages both) */
const gameGrid = document.getElementById('game-grid') || document.getElementById('games-grid') || document.getElementById('games-grid');
const quickSearch = document.getElementById('quick-search') || document.getElementById('games-search') || document.getElementById('games-search');
const sortSelect = document.getElementById('sort-select');

/* NAV TOGGLE (mobile) */
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
[ 'year','year2','year3','year4','year5' ].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.textContent = (new Date()).getFullYear();
});

/* FAVORITES */
const FAVORITES_KEY = 'flux_favs';
function loadFavs(){ try{ return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; }catch{ return []; } }
function saveFavs(arr){ localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr)); }
function isFav(id){ return loadFavs().includes(id); }
function toggleFav(id){
  const favs = loadFavs();
  const idx = favs.indexOf(id);
  if(idx === -1) favs.push(id); else favs.splice(idx,1);
  saveFavs(favs);
}

/* Renderers */
function createCard(game){
  const div = document.createElement('article');
  div.className = 'card';
  div.setAttribute('data-id', game.id);

  div.innerHTML = `
    <img class="thumb" src="${game.thumb}" alt="${game.title} thumbnail" loading="lazy">
    <div class="card-body">
      <h3 class="title">${game.title}</h3>
      <div class="meta">${game.desc || ''}</div>
    </div>
    <div class="card-foot">
      <div style="display:flex;gap:8px;align-items:center">
        <button class="favorite" title="Toggle favorite" aria-pressed="${isFav(game.id)}">${isFav(game.id) ? '★' : '☆'}</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="open-btn" data-url="${game.url}" aria-label="Open in new tab">Open</button>
        <button class="play-btn" data-url="${game.url}" data-title="${game.title}">Play</button>
      </div>
    </div>
  `;

  // favorite button
  const favBtn = div.querySelector('.favorite');
  favBtn.addEventListener('click', () => {
    toggleFav(game.id);
    favBtn.textContent = isFav(game.id) ? '★' : '☆';
    favBtn.classList.toggle('active', isFav(game.id));
  });
  favBtn.classList.toggle('active', isFav(game.id));
  favBtn.setAttribute('aria-pressed', String(isFav(game.id)));

  // open in new tab
  div.querySelector('.open-btn').addEventListener('click', (e) => {
    const url = e.currentTarget.dataset.url;
    window.open(url, '_blank', 'noopener');
  });

  // play button — modal attempt
  div.querySelector('.play-btn').addEventListener('click', async (e) => {
    const url = e.currentTarget.dataset.url;
    const title = e.currentTarget.dataset.title;
    openPlayModal(url, title);
  });

  return div;
}

function renderGames(list){
  const grid = document.getElementById('game-grid') || document.getElementById('games-grid');
  if(!grid) return;

  grid.innerHTML = '';
  list.forEach(g => {
    grid.appendChild(createCard(g));
  });
}

/* search + sort */
function applyFilters(){
  const query = (quickSearch && quickSearch.value || '').toLowerCase().trim();
  const sort = (sortSelect && sortSelect.value) || 'featured';

  let list = [...GAMES];
  if(query){
    list = list.filter(g => g.title.toLowerCase().includes(query) || (g.desc||'').toLowerCase().includes(query));
  }

  if(sort === 'alpha'){ list.sort((a,b)=> a.title.localeCompare(b.title)); }
  else if(sort === 'recent'){ /* keep given order — or reverse for demo */ list = list.slice().reverse(); }

  renderGames(list);
}

/* event hooking */
if (quickSearch) quickSearch.addEventListener('input', debounce(applyFilters, 160));
if (sortSelect) sortSelect.addEventListener('change', applyFilters);

/* Debounce helper */
function debounce(fn, wait=120){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(()=> fn(...args), wait); };
}

/* INITIAL RENDER */
document.addEventListener('DOMContentLoaded', () => {
  // render initial grid on pages that have one
  if(document.getElementById('game-grid') || document.getElementById('games-grid')) {
    renderGames(GAMES);
  }
  // wire search on index's quick search if present
  if(document.getElementById('quick-search')){
    document.getElementById('quick-search').addEventListener('input', debounce(applyFilters, 120));
  }
});

/* --- Play modal: robust iframe embedding with fallback --- */

const MODAL_ID = 'play-modal';

// Helper to open the modal and try to embed the URL
function openPlayModal(url, title){
  // find modal elements (handles index/games pages; script uses both IDs if present)
  const modal = document.getElementById(MODAL_ID) || document.querySelector('.modal');
  if(!modal) { window.open(url,'_blank','noopener'); return; }

  // support for both modal copies on different pages (IDs with suffix)
  const iframe = modal.querySelector('iframe');
  const modalTitle = modal.querySelector('[id^="modal-title"]') || modal.querySelector('.modal-header div');
  const openTabBtn = modal.querySelector('[id^="open-tab"]') || modal.querySelector('.tool-btn');
  const closeBtn = modal.querySelector('[id^="close-modal"]') || modal.querySelector('.tool-btn[aria-label="Close"]');
  const embedWarning = modal.querySelector('.embed-warning');

  // set title & visibility
  if(modalTitle) modalTitle.textContent = title;
  modal.setAttribute('aria-hidden','false');

  // set open-in-tab action
  if(openTabBtn){
    openTabBtn.onclick = () => { window.open(url,'_blank','noopener'); };
  }

  // close action
  const closeModal = () => {
    modal.setAttribute('aria-hidden','true');
    if(iframe) iframe.src = 'about:blank';
  };
  if(closeBtn) closeBtn.onclick = closeModal;
  modal.querySelectorAll('[data-close]').forEach(el => el.onclick = closeModal);
  window.addEventListener('keydown', escClose);

  function escClose(e){ if(e.key === 'Escape') closeModal(); }

  // Attempt to embed with a timeout & fallback
  if(iframe){
    // show loading placeholder
    embedWarning?.classList.add('hidden');
    iframe.src = url;

    // we can't reliably detect X-Frame-Options directly due to CORS,
    // so we use a heuristic: if the iframe doesn't load (onload not fired) within timeout, show fallback.
    let loaded = false;
    const onLoadHandler = () => { loaded = true; embedWarning?.classList.add('hidden'); };
    iframe.addEventListener('load', onLoadHandler, { once:true });

    // fallback timer (2.2s)
    setTimeout(() => {
      // if still not loaded, show warning and show fallback link
      if(!loaded){
        embedWarning?.classList.remove('hidden');
        const openFallback = embedWarning?.querySelector('a');
        if(openFallback){
          openFallback.href = url;
          openFallback.onclick = () => { window.open(url,'_blank','noopener'); return true; };
        }
      }
    }, 2200);
  } else {
    // no iframe available — just open in new tab
    window.open(url,'_blank','noopener');
  }
}

/* Close modals on outside click (delegated) */
document.addEventListener('click', (e) => {
  if(!e.target) return;
  if(e.target.matches('[data-close]') || e.target.classList.contains('modal-backdrop')) {
    const m = e.target.closest('.modal');
    if(m){ m.setAttribute('aria-hidden','true'); const iframe = m.querySelector('iframe'); if(iframe) iframe.src='about:blank'; }
  }
});

/* Ensure modals are closable by clicking outside & Escape */
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') {
    document.querySelectorAll('.modal[aria-hidden="false"]').forEach(m => { m.setAttribute('aria-hidden','true'); const iframe = m.querySelector('iframe'); if(iframe) iframe.src='about:blank'; });
  }
});
