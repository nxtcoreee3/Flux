// commits-panel.js — lightweight GitHub commits panel for index.html

const GH_OWNER = 'nxtcoreee3';
const GH_REPO = 'Flux';
const GH_BRANCH = 'main';
const PER_PAGE = 3;
const FETCH_WINDOW = 10; // fetch more so we can detect how many new commits happened between refreshes

const CACHE_KEY = 'flux_commits_panel_cache_v1';
const CACHE_TTL = 4 * 60 * 1000;
const ETAG_KEY = 'flux_commits_panel_etag';

const TOTAL_KEY = 'flux_commits_total';
const TOTAL_TS_KEY = 'flux_commits_total_ts';
const TOTAL_TTL = 5 * 60 * 1000;

const LATEST_SHA_KEY = 'flux_commits_panel_latest_sha';
const SEEN_SHA_KEY = 'flux_commits_panel_seen_sha';
const TOTAL_VERIFIED_KEY = 'flux_commits_total_verified';

const BLOCK_UNTIL_KEY = 'flux_commits_panel_block_until';
const BLOCK_MS = 10 * 60 * 1000; // 10 minutes

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

function isBlocked() {
  try {
    const until = parseInt(localStorage.getItem(BLOCK_UNTIL_KEY) || '0', 10) || 0;
    return Date.now() < until;
  } catch {
    return false;
  }
}

function setBlocked() {
  try {
    localStorage.setItem(BLOCK_UNTIL_KEY, String(Date.now() + BLOCK_MS));
  } catch {}
}

async function fetchCommitsFromAtom() {
  try {
    const res = await fetch(`https://github.com/${GH_OWNER}/${GH_REPO}/commits/${GH_BRANCH}.atom`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`GitHub atom error (${res.status})`);
    const xmlText = await res.text();
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
    const entries = Array.from(xml.querySelectorAll('entry')).slice(0, FETCH_WINDOW);
    return entries.map((entry) => {
      const id = entry.querySelector('id')?.textContent || '';
      const title = entry.querySelector('title')?.textContent || '';
      const updated = entry.querySelector('updated')?.textContent || '';
      const sha = (id.match(/commit\/([0-9a-f]{7,40})/i)?.[1] || '').toLowerCase();
      return {
        sha,
        html_url: id || `https://github.com/${GH_OWNER}/${GH_REPO}/commit/${sha}`,
        commit: {
          message: title,
          committer: { date: updated },
          author: { date: updated }
        }
      };
    }).filter(c => c.sha);
  } catch {
    return [];
  }
}

async function fetchCommitTotalViaSearch() {
  // Fallback for cases where the `Link` header isn't accessible (CORS/exposed headers)
  // Uses GitHub Search API which returns a JSON `total_count`.
  try {
    const q = encodeURIComponent(`repo:${GH_OWNER}/${GH_REPO}`);
    const res = await fetch(`https://api.github.com/search/commits?q=${q}&per_page=1`, {
      headers: {
        'Accept': 'application/vnd.github+json, application/vnd.github.cloak-preview'
      },
      cache: 'no-store'
    });
    if (res.status === 403) setBlocked();
    if (!res.ok) return 0;
    const data = await res.json();
    const total = parseInt(data?.total_count || '0', 10) || 0;
    return total;
  } catch {
    return 0;
  }
}

async function fetchCommitTotal(force = false) {
  const cached = parseInt(localStorage.getItem(TOTAL_KEY) || '0', 10) || 0;
  const ts = parseInt(localStorage.getItem(TOTAL_TS_KEY) || '0', 10) || 0;
  if (!force && cached > 0 && Date.now() - ts < TOTAL_TTL) return cached;
  if (isBlocked()) return cached || 0;

  try {
    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?per_page=1&sha=${GH_BRANCH}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });
    if (res.status === 403) setBlocked();
    if (!res.ok) return cached || 0;
    const link = res.headers.get('Link') || '';
    const lastPage = parseLastPageFromLinkHeader(link);
    const total = lastPage || (await fetchCommitTotalViaSearch()) || cached || 0;
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

  // If GitHub API is rate-limiting this client, use the Atom feed instead.
  if (isBlocked()) {
    const atom = await fetchCommitsFromAtom();
    if (atom?.length) return atom;
  }

  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  const etag = localStorage.getItem(ETAG_KEY) || '';
  if (etag) headers['If-None-Match'] = etag;

  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits?per_page=${FETCH_WINDOW}&sha=${GH_BRANCH}`;
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (res.status === 403) {
    setBlocked();
    const atom = await fetchCommitsFromAtom();
    if (atom?.length) return atom;
  }
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

async function renderPanel(force = false) {
  const list = document.getElementById('commits-list');
  if (!list) return;
  const label = document.getElementById('commits-total-label');

  window.__fluxCommitsPanelManaged = true;

  const prevLatest = localStorage.getItem(LATEST_SHA_KEY) || '';

  if (label && !label.dataset.fluxBound) {
    label.dataset.fluxBound = '1';
    label.style.cursor = 'pointer';
    label.title = 'Click to resync';
    label.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        localStorage.removeItem(TOTAL_KEY);
        localStorage.removeItem(TOTAL_TS_KEY);
        localStorage.removeItem(LATEST_SHA_KEY);
        try { sessionStorage.removeItem(CACHE_KEY); } catch {}
        try { sessionStorage.removeItem(TOTAL_VERIFIED_KEY); } catch {}
      } catch {}
      const listEl = document.getElementById('commits-list');
      if (listEl) listEl.innerHTML = '<div style="padding:16px 0;text-align:center;color:var(--muted);font-size:12px;">Resyncing…</div>';
      await renderPanel(true);
    });
  }

  const commits = await fetchCommits(force);
  const latestSha = commits?.[0]?.sha || '';

  // Provide build info for script.js without forcing a second GitHub API call.
  try {
    if (commits?.[0]?.sha) {
      const latest = commits[0];
      window._fluxBuildSHA = latest.sha.slice(0, 7);
      window._fluxBuildURL = `https://github.com/${GH_OWNER}/${GH_REPO}/commit/${latest.sha}`;
      window._fluxBuildMsg = (latest?.commit?.message || '').split('\n')[0];
    }
  } catch {}

  const cachedTotal = parseInt(localStorage.getItem(TOTAL_KEY) || '0', 10) || 0;

  // Verify total at least once per tab session so we don't get stuck with bad cached values
  let verified = false;
  try { verified = sessionStorage.getItem(TOTAL_VERIFIED_KEY) === '1'; } catch {}
  let total = await fetchCommitTotal(force || !verified);
  if (total) {
    try { sessionStorage.setItem(TOTAL_VERIFIED_KEY, '1'); } catch {}
  }
  if (!total && cachedTotal) total = cachedTotal;

  // If we detect a new latest commit, bump the total so the numbers always count up.
  // Try to verify via API, but fall back to cachedTotal + newCount if verification doesn't move.
  if (latestSha && prevLatest && latestSha !== prevLatest) {
    const idx = (commits || []).findIndex(c => c?.sha === prevLatest);
    const newCount = idx > 0 ? idx : 1;

    const verifiedTotal = await fetchCommitTotal(true);
    const base = verifiedTotal || total || cachedTotal || 0;

    // If verifiedTotal didn't change (rate limit / stale / missing Link), still bump based on detection.
    const verifiedMoved = verifiedTotal && cachedTotal && verifiedTotal !== cachedTotal;
    total = verifiedMoved ? verifiedTotal : (base + newCount);

    localStorage.setItem(TOTAL_KEY, String(total));
    localStorage.setItem(TOTAL_TS_KEY, String(Date.now()));
  }

  // If cached total is wildly off, prefer the verified total (helps resync if cache got corrupted)
  if (total && cachedTotal && Math.abs(total - cachedTotal) > 20) {
    localStorage.setItem(TOTAL_KEY, String(total));
    localStorage.setItem(TOTAL_TS_KEY, String(Date.now()));
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

  // If we just bumped total based on SHA-change detection, we already wrote TOTAL_KEY above.
  // Otherwise keep cache aligned with verified total (small drift tolerance).
  if (total && (!cachedTotal || Math.abs(total - cachedTotal) > 2)) {
    localStorage.setItem(TOTAL_KEY, String(total));
    localStorage.setItem(TOTAL_TS_KEY, String(Date.now()));
  }
}

async function start() {
  try {
    await renderPanel();
  } catch (e) {
    const list = document.getElementById('commits-list');
    if (list) {
      const is403 = String(e?.message || '').includes('(403)') || String(e).includes('403');
      list.innerHTML = is403
        ? `<div style="padding:16px 0;text-align:center;color:var(--muted);font-size:12px;line-height:1.35;">
            GitHub rate-limited this device.<br/>
            <a href="https://github.com/${GH_OWNER}/${GH_REPO}/commits/${GH_BRANCH}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none;font-weight:800;">View commits on GitHub →</a>
          </div>`
        : `<div style="padding:16px 0;text-align:center;color:var(--muted);font-size:12px;">Could not load commits.</div>`;
    }
    console.warn('Commits panel failed:', e);
  }

  // Refresh automatically (fast enough to notice new commits; ETag keeps it cheap)
  setInterval(() => {
    if (!document.getElementById('commits-list')) return;
    // If blocked, avoid spam-retrying every minute; Atom feed will still be used by fetchCommits().
    renderPanel().catch(() => {});
  }, 60 * 1000);
}

start();
