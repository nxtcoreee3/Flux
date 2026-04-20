// commits-panel.js — lightweight GitHub commits panel for index.html

const GH_OWNER = 'nxtcoreee3';
const GH_REPO = 'Flux';
const GH_BRANCH = 'main';
const PER_PAGE = 3;

const CACHE_KEY = 'flux_commits_panel_cache_v1';
const CACHE_TTL = 4 * 60 * 1000;
const ETAG_KEY = 'flux_commits_panel_etag';

const TOTAL_KEY = 'flux_commits_total';
const TOTAL_TS_KEY = 'flux_commits_total_ts';
const TOTAL_TTL = 60 * 60 * 1000;

const LATEST_SHA_KEY = 'flux_commits_panel_latest_sha';
const SEEN_SHA_KEY = 'flux_commits_panel_seen_sha';

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgoShort(isoDate) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function parseLastPageFromLinkHeader(link) {
  if (!link) return null;
  const lastPart = String(link).split(',').find(p => /rel=\"last\"/.test(p));
  if (!lastPart) return null;
  const m = lastPart.match(/[\?&]page=(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function fetchCommitTotal(force = false) {
  const cached = parseInt(localStorage.getItem(TOTAL_KEY) || '0', 10) || 0;
  const ts = parseInt(localStorage.getItem(TOTAL_TS_KEY) || '0', 10) || 0;
  if (!force && cached > 0 && Date.now() - ts < TOTAL_TTL) return cached;

  try {
    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?per_page=1&sha=${GH_BRANCH}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });
    if (!res.ok) return cached || 0;
    const link = res.headers.get('Link') || '';
    const lastPage = parseLastPageFromLinkHeader(link);
    const total = lastPage || cached || 0;
    if (total) {
      localStorage.setItem(TOTAL_KEY, String(total));
      localStorage.setItem(TOTAL_TS_KEY, String(Date.now()));
    }
    return total;
  } catch {
    return cached || 0;
  }
}

async function fetchCommits(force = false) {
  if (!force) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
    } catch {}
  }

  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  const etag = localStorage.getItem(ETAG_KEY) || '';
  if (etag) headers['If-None-Match'] = etag;

  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?per_page=${PER_PAGE}&sha=${GH_BRANCH}`;
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (res.status === 304) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return cached?.data || [];
    } catch { return []; }
  }
  if (!res.ok) throw new Error(`GitHub API error (${res.status})`);
  const newEtag = res.headers.get('ETag');
  if (newEtag) localStorage.setItem(ETAG_KEY, newEtag);
  const data = await res.json();
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  return data;
}

function localSummary(commitMsg = '', files = []) {
  const msg = String(commitMsg || '').split('\n')[0].trim().toLowerCase();
  const names = (files || []).join(' ').toLowerCase();
  const blob = `${msg} ${names}`;
  if (/messages\.js|messages\.html|\bdm\b|direct message|conversations/.test(blob)) return 'Messaging: improved chats and reliability.';
  if (/social\.js|social\.html|\bglobal chat\b/.test(blob)) return 'Social: improved chat and social features.';
  if (/profile\.js|profile\.html|follow|followers/.test(blob)) return 'Profiles: improved follows and profile pages.';
  if (/games\.html|\bgames?\b|play/.test(blob)) return 'Games: improved browsing and performance.';
  if (/style\.css|\bui\b|css|design/.test(blob)) return 'UI: improved design and polish.';
  if (/\bfix\b|bug|broken/.test(msg)) return 'Fixed bugs and improved stability.';
  if (/\badd\b|\bnew\b/.test(msg)) return 'Added improvements and new features.';
  return 'Improved performance and polish.';
}

function inferPageFromMessage(commitMsg = '') {
  const m = String(commitMsg || '').toLowerCase();
  if (m.includes('social')) return { label: 'Social', url: 'social.html' };
  if (m.includes('message') || m.includes('dm')) return { label: 'Messages', url: 'messages.html' };
  if (m.includes('profile') || m.includes('follow')) return { label: 'Profiles', url: 'profile.html' };
  if (m.includes('games') || m.includes('game')) return { label: 'Games', url: 'games.html' };
  if (m.includes('settings')) return { label: 'Settings', url: 'settings.html' };
  return null;
}

async function renderPanel() {
  const list = document.getElementById('commits-list');
  if (!list) return;
  const label = document.getElementById('commits-total-label');

  window.__fluxCommitsPanelManaged = true;

  const prevLatest = localStorage.getItem(LATEST_SHA_KEY) || '';

  const commits = await fetchCommits(false);
  const latestSha = commits?.[0]?.sha || '';

  let total = await fetchCommitTotal(false);

  // If we detect a new latest commit, bump the total immediately so the numbers count up
  if (latestSha && prevLatest && latestSha !== prevLatest) {
    const idx = (commits || []).findIndex(c => c?.sha === prevLatest);
    if (idx > 0) {
      total = Math.max(total || 1, 1) + idx;
      localStorage.setItem(TOTAL_KEY, String(total));
      localStorage.setItem(TOTAL_TS_KEY, String(Date.now()));
    } else {
      total = await fetchCommitTotal(true);
    }
  }

  if (latestSha) localStorage.setItem(LATEST_SHA_KEY, latestSha);
  if (label && total) label.textContent = `${total} Commits`;

  const seenSha = localStorage.getItem(SEEN_SHA_KEY) || '';
  const showNewBadge = !!(latestSha && seenSha && latestSha !== seenSha);

  list.innerHTML = '';
  (commits || []).slice(0, PER_PAGE).forEach((c, idx) => {
    const fullSha = c?.sha || '';
    const sha7 = fullSha ? fullSha.slice(0, 7) : '';
    const msg = (c?.commit?.message || '').split('\n')[0];
    const date = c?.commit?.committer?.date || c?.commit?.author?.date || '';

    const commitUrl = `https://github.com/${GH_OWNER}/${GH_REPO}/commit/${fullSha}`;
    const number = total ? (total - idx) : null;
    const isNew = idx === 0 && showNewBadge;

    const row = document.createElement('div');
    row.className = 'commit-row';
    row.innerHTML = `
      <div class="commit-sha-line">
        <a class="commit-sha" href="${commitUrl}" target="_blank" rel="noopener" title="Open commit on GitHub" onclick="event.stopPropagation();">${number ? `#${number}` : `#${sha7}`}</a>
        ${isNew ? '<span class="commit-new-badge">New</span>' : ''}
        <span class="commit-msg">${escapeHtml(msg)}</span>
      </div>
      <div class="commit-ai-desc">${escapeHtml(localSummary(msg))}</div>
      <span class="commit-time">${escapeHtml(date ? timeAgoShort(date) : '')}</span>
    `;

    const pageLink = inferPageFromMessage(msg);
    if (pageLink?.url) {
      const desc = row.querySelector('.commit-ai-desc');
      if (desc) {
        desc.innerHTML = `<a href="${pageLink.url}" onclick="event.stopPropagation();" style="color:var(--accent);text-decoration:none;font-weight:800;" title="Go to ${pageLink.label}">→ ${pageLink.label}:</a> ${escapeHtml(localSummary(msg))}`;
      }
    }

    row.addEventListener('click', () => window.open(commitUrl, '_blank', 'noopener'));
    list.appendChild(row);
  });

  // Mark latest as "seen" after render (so New shows once)
  if (latestSha) localStorage.setItem(SEEN_SHA_KEY, latestSha);
}

async function start() {
  try {
    await renderPanel();
  } catch (e) {
    const list = document.getElementById('commits-list');
    if (list) {
      list.innerHTML = `<div style="padding:16px 0;text-align:center;color:var(--muted);font-size:12px;">Could not load commits.</div>`;
    }
    console.warn('Commits panel failed:', e);
  }

  // Refresh automatically (fast enough to notice new commits; ETag keeps it cheap)
  setInterval(() => {
    if (!document.getElementById('commits-list')) return;
    renderPanel().catch(() => {});
  }, 60 * 1000);
}

start();

