/* social.js — Flux Social & Chat */

import {
  getProfile, searchProfiles, renderBadges,
  initAuthUI, initServerStatus, initBroadcast,
  initChaos, initJumpscare, initPresence, initCookieConsent,
  initDarkMode, initChatLock, fetchLeaderboard
} from './firebase-auth.js';

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, query, orderBy, limit, onSnapshot,
  serverTimestamp, getDoc, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHm6nxHzrIGHmWb1W_xDAYwnSoed6oTi4",
  authDomain: "fluxbynxtcoreee3.firebaseapp.com",
  projectId: "fluxbynxtcoreee3",
  storageBucket: "fluxbynxtcoreee3.firebasestorage.app",
  messagingSenderId: "1003023583985",
  appId: "1:1003023583985:web:58cec1087f433e2af97750",
  databaseURL: "https://fluxbynxtcoreee3-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const OWNER_UID = 'zEy6TO5ligf2um4rssIZs9C9X7f2';
const MAX_MESSAGES = 80;

/* ── Year footer ── */
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();

  initCookieConsent();
  initDarkMode();
  initPresence();
  initServerStatus();
  initBroadcast();
  initChaos();
  initJumpscare();
  initAuthUI(null);

  initChat();
  initSearch();
  initRecommended();
  initLeaderboard();

  initChatLock('global',
    () => {
      // Locked — disable input
      const input = document.getElementById('chat-input');
      const send = document.getElementById('chat-send');
      const area = document.getElementById('chat-input-area');
      if (input) { input.disabled = true; input.placeholder = '🔒 Chat is locked by an admin'; }
      if (send) send.disabled = true;
      if (area) area.style.opacity = '0.5';
    },
    () => {
      // Unlocked — re-enable
      const input = document.getElementById('chat-input');
      const send = document.getElementById('chat-send');
      const area = document.getElementById('chat-input-area');
      if (input) { input.disabled = false; input.placeholder = 'Say something...'; }
      if (send) send.disabled = false;
      if (area) area.style.opacity = '1';
    }
  );
});

/* ══════════════════════════════════════
   CHAT
══════════════════════════════════════ */
let _currentProfile = null;
let _unsubChat = null;

async function initChat() {
  onAuthStateChanged(auth, async (user) => {
    const inputArea = document.getElementById('chat-input-area');
    const signinPrompt = document.getElementById('chat-signin-prompt');

    if (!user || user.isAnonymous) {
      inputArea.style.display = 'none';
      signinPrompt.style.display = 'block';
      _currentProfile = null;
    } else {
      const profile = await getProfile(user.uid);
      _currentProfile = profile;

      if (profile && !profile.isBanned) {
        inputArea.style.display = 'flex';
        signinPrompt.style.display = 'none';
        // Show my profile card in sidebar
        showMyProfileCard(profile);
      } else if (!profile) {
        inputArea.style.display = 'none';
        signinPrompt.style.display = 'block';
        signinPrompt.innerHTML = '<p>Create a profile to join the chat.</p><a href="index.html" style="color:var(--accent);font-size:13px;font-weight:600;">Set up profile →</a>';
      } else {
        // Banned
        inputArea.style.display = 'none';
        signinPrompt.style.display = 'block';
        signinPrompt.innerHTML = '<p style="color:#ef4444;">🚫 You are banned from chat.</p>';
      }
    }

    startChatListener(user);
  });

  // Send on click
  document.getElementById('chat-send')?.addEventListener('click', sendMessage);

  // Send on Enter
  document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

const _profileCache = {};

async function getCachedProfile(uid) {
  if (_profileCache[uid]) return _profileCache[uid];
  const p = await getProfile(uid);
  if (p) _profileCache[uid] = p;
  return p;
}

let _lastChatDocId = null;

function renderChatSnap(snap, currentUser) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;

  container.innerHTML = '';

  if (snap.empty) {
    container.innerHTML = '<div class="chat-empty">No messages yet. Say hi! 👋</div>';
    return;
  }

  snap.docs.forEach(docSnap => {
    const msg = { id: docSnap.id, ...docSnap.data() };
    const el = renderMessageSync(msg, currentUser);
    container.appendChild(el);
    patchMessageBadges(el, msg.uid);
  });

  // Track last message id for poll comparison
  _lastChatDocId = snap.docs[snap.docs.length - 1]?.id || null;

  if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

function startChatListener(currentUser) {
  if (_unsubChat) _unsubChat();

  const q = query(collection(db, 'chat'), orderBy('sentAt', 'asc'), limit(MAX_MESSAGES));

  // Primary: real-time listener
  _unsubChat = onSnapshot(q, (snap) => {
    renderChatSnap(snap, currentUser);
  });

  // Fallback poll every 2s for mobile Safari
  setInterval(async () => {
    try {
      const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const snap = await getDocs(q);
      const latestId = snap.docs[snap.docs.length - 1]?.id || null;
      if (latestId !== _lastChatDocId) {
        renderChatSnap(snap, currentUser);
      }
    } catch {}
  }, 2000);
}

function renderMessageSync(msg, currentUser) {
  const isAdmin = currentUser?.uid === OWNER_UID;
  const isOwn = currentUser?.uid === msg.uid;
  const time = msg.sentAt?.toDate
    ? msg.sentAt.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  const avatarHTML = msg.avatarURL
    ? `<img class="chat-msg-avatar" src="${msg.avatarURL}" alt="">`
    : `<div class="chat-msg-avatar-placeholder">${(msg.displayName || msg.username || '?')[0].toUpperCase()}</div>`;

  // Use baked-in badges for instant render
  const badgesHTML = renderBadges(msg.badges || [], msg.roles || []);

  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.dataset.id = msg.id;
  div.dataset.uid = msg.uid;
  div.innerHTML = `
    ${avatarHTML}
    <div class="chat-msg-body">
      <div class="chat-msg-meta">
        <a class="chat-msg-name" href="profile.html?user=${msg.username}">@${msg.username}</a>
        <span class="msg-badges">${badgesHTML}</span>
        <span class="chat-msg-time">${time}</span>
        ${(isAdmin || isOwn) ? `<button class="chat-msg-delete" title="Delete">✕</button>` : ''}
      </div>
      <div class="msg-playing"></div>
      <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
    </div>
  `;

  div.querySelector('.chat-msg-delete')?.addEventListener('click', () => deleteMessage(msg.id));
  return div;
}

async function patchMessageBadges(el, uid) {
  try {
    const liveProfile = await getCachedProfile(uid);
    if (!liveProfile) return;
    const badgesEl = el.querySelector('.msg-badges');
    if (badgesEl) {
      badgesEl.innerHTML = renderBadges(liveProfile.badges || [], liveProfile.roles || []);
    }
    // Show currently playing
    const playingEl = el.querySelector('.msg-playing');
    if (playingEl && liveProfile.currentlyPlaying) {
      playingEl.innerHTML = `<span style="font-size:10px;color:#22c55e;">🎮 Playing ${liveProfile.currentlyPlaying.title}</span>`;
    }
  } catch {}
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !_currentProfile) return;

  // Check if global chat is locked
  try {
    const lockSnap = await getDoc(doc(db, 'stats', 'chatlock'));
    if (lockSnap.exists() && lockSnap.data().globalLocked) {
      input.value = '';
      // Show locked notice
      const container = document.getElementById('chat-messages');
      const notice = document.createElement('div');
      notice.style.cssText = 'text-align:center;padding:8px;color:#ef4444;font-size:12px;font-weight:600;';
      notice.textContent = '🔒 Global chat is currently locked by an admin.';
      container.appendChild(notice);
      setTimeout(() => notice.remove(), 3000);
      return;
    }
  } catch {}

  input.value = '';
  input.disabled = true;

  try {
    // Always re-fetch profile so roles/badges are current at send time
    const freshProfile = await getProfile(auth.currentUser.uid) || _currentProfile;
    if (freshProfile.isBanned) { input.disabled = false; return; }

    await addDoc(collection(db, 'chat'), {
      uid: auth.currentUser.uid,
      username: freshProfile.username,
      displayName: freshProfile.displayName,
      avatarURL: freshProfile.avatarURL || '',
      badges: freshProfile.badges || [],
      roles: freshProfile.roles || [],
      text,
      sentAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Send failed:', e);
  }

  input.disabled = false;
  input.focus();
}

async function deleteMessage(msgId) {
  try {
    await deleteDoc(doc(db, 'chat', msgId));
  } catch (e) { console.warn('Delete failed:', e); }
}

/* ══════════════════════════════════════
   USER SEARCH
══════════════════════════════════════ */
function initSearch() {
  const input = document.getElementById('user-search-input');
  let _timer = null;

  input?.addEventListener('input', () => {
    clearTimeout(_timer);
    const val = input.value.trim();
    if (!val) {
      document.getElementById('search-results').innerHTML = '<div class="search-empty">Type to search for players</div>';
      return;
    }
    document.getElementById('search-results').innerHTML = '<div class="search-empty">Searching...</div>';
    _timer = setTimeout(() => runSearch(val), 350);
  });
}

async function runSearch(term) {
  const results = await searchProfiles(term);
  const container = document.getElementById('search-results');

  if (!results.length) {
    container.innerHTML = '<div class="search-empty">No players found.</div>';
    return;
  }

  container.innerHTML = '';
  results.forEach(profile => {
    const avatarHTML = profile.avatarURL
      ? `<img class="search-result-avatar" src="${profile.avatarURL}" alt="">`
      : `<div class="search-result-placeholder">${(profile.displayName || profile.username || '?')[0].toUpperCase()}</div>`;

    const item = document.createElement('a');
    item.className = 'search-result-item';
    item.href = `profile.html?user=${profile.username}`;
    item.innerHTML = `
      ${avatarHTML}
      <div class="search-result-info">
        <span class="search-result-name">${profile.displayName || profile.username}</span>
        <span class="search-result-username">@${profile.username}</span>
      </div>
      <div>${renderBadges(profile.badges || [], profile.roles || [])}</div>
    `;
    container.appendChild(item);
  });
}

/* ══════════════════════════════════════
   MY PROFILE CARD
══════════════════════════════════════ */
function showMyProfileCard(profile) {
  const card = document.getElementById('my-profile-card');
  const preview = document.getElementById('my-profile-preview');
  if (!card || !preview) return;

  const avatarHTML = profile.avatarURL
    ? `<img style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid var(--glass-border);" src="${profile.avatarURL}" alt="">`
    : `<div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;">${(profile.displayName || profile.username || '?')[0].toUpperCase()}</div>`;

  preview.innerHTML = `
    <a href="profile.html?user=${profile.username}" style="display:flex;align-items:center;gap:12px;text-decoration:none;">
      ${avatarHTML}
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--text);">${profile.displayName || profile.username}</div>
        <div style="font-size:12px;color:var(--muted);">@${profile.username}</div>
        <div style="margin-top:4px;">${renderBadges(profile.badges || [], profile.roles || [])}</div>
      </div>
    </a>
    <div style="display:flex;gap:16px;margin-top:14px;padding-top:12px;border-top:1px solid var(--glass-border);">
      <div style="text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text);">${(profile.followers || []).length}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Followers</div>
      </div>
      <div style="text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text);">${(profile.following || []).length}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Following</div>
      </div>
      <div style="text-align:center;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text);">${(profile.favorites || []).length}</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Favs</div>
      </div>
    </div>
  `;
  card.style.display = 'block';
}

/* ══════════════════════════════════════
   LEADERBOARD
══════════════════════════════════════ */
async function initLeaderboard() {
  const card = document.getElementById('leaderboard-card');
  if (!card) return;

  card.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center;">Loading...</div>';

  const { points, streaks } = await fetchLeaderboard();

  const medals = ['🥇','🥈','🥉'];

  const renderList = (list, valueKey, valueLabel, icon) => {
    if (!list.length) return '<div style="color:var(--muted);font-size:12px;text-align:center;padding:8px;">No data yet</div>';
    return list.map((p, i) => {
      const avatarHTML = p.avatarURL
        ? `<img src="${p.avatarURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0;">${(p.displayName||p.username||'?')[0].toUpperCase()}</div>`;
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--glass-border);">
          <span style="font-size:16px;width:24px;text-align:center;flex-shrink:0;">${medals[i] || `${i+1}`}</span>
          ${avatarHTML}
          <a href="profile.html?user=${p.username}" style="flex:1;min-width:0;text-decoration:none;">
            <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.displayName || p.username}</div>
            <div style="font-size:11px;color:var(--muted);">@${p.username}</div>
          </a>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--accent);">${(p[valueKey]||0).toLocaleString()}</div>
            <div style="font-size:10px;color:var(--muted);">${icon} ${valueLabel}</div>
          </div>
        </div>
      `;
    }).join('');
  };

  card.innerHTML = `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text);margin-bottom:14px;">🏆 Leaderboards</div>

    <div style="display:flex;gap:4px;background:var(--bg);border-radius:10px;padding:3px;margin-bottom:12px;">
      <button id="lb-tab-points" class="lb-tab lb-tab-active" style="flex:1;padding:6px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:var(--panel);color:var(--text);">⭐ Points</button>
      <button id="lb-tab-streaks" class="lb-tab" style="flex:1;padding:6px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:transparent;color:var(--muted);">🔥 Streaks</button>
    </div>

    <div id="lb-points-list">${renderList(points, 'points', 'pts', '⭐')}</div>
    <div id="lb-streaks-list" style="display:none;">${renderList(streaks, 'loginStreak', 'days', '🔥')}</div>
  `;

  // Remove border from last items
  card.querySelectorAll('#lb-points-list > div:last-child, #lb-streaks-list > div:last-child').forEach(el => el.style.borderBottom = 'none');

  document.getElementById('lb-tab-points').addEventListener('click', () => {
    document.getElementById('lb-points-list').style.display = '';
    document.getElementById('lb-streaks-list').style.display = 'none';
    document.getElementById('lb-tab-points').style.background = 'var(--panel)';
    document.getElementById('lb-tab-points').style.color = 'var(--text)';
    document.getElementById('lb-tab-streaks').style.background = 'transparent';
    document.getElementById('lb-tab-streaks').style.color = 'var(--muted)';
  });
  document.getElementById('lb-tab-streaks').addEventListener('click', () => {
    document.getElementById('lb-streaks-list').style.display = '';
    document.getElementById('lb-points-list').style.display = 'none';
    document.getElementById('lb-tab-streaks').style.background = 'var(--panel)';
    document.getElementById('lb-tab-streaks').style.color = 'var(--text)';
    document.getElementById('lb-tab-points').style.background = 'transparent';
    document.getElementById('lb-tab-points').style.color = 'var(--muted)';
  });
}

/* ══════════════════════════════════════
   RECOMMENDED FOLLOWS
══════════════════════════════════════ */
async function initRecommended() {
  const card = document.getElementById('recommended-card');
  const list = document.getElementById('recommended-list');
  if (!card || !list) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) { card.style.display = 'none'; return; }

    const myProfile = await getProfile(user.uid);
    if (!myProfile) { card.style.display = 'none'; return; }

    const myFollowing = myProfile.following || [];
    const recommendations = [];
    const seen = new Set([user.uid, ...myFollowing]);

    // 1. Mutuals — people that people I follow also follow
    try {
      for (const followedUid of myFollowing.slice(0, 5)) {
        const theirProfile = await getProfile(followedUid);
        if (!theirProfile) continue;
        for (const uid of (theirProfile.following || [])) {
          if (!seen.has(uid)) {
            seen.add(uid);
            const p = await getProfile(uid);
            if (p && !p.isBanned) recommendations.push({ ...p, reason: `Followed by @${theirProfile.username}` });
          }
          if (recommendations.length >= 3) break;
        }
        if (recommendations.length >= 3) break;
      }
    } catch {}

    // 2. Fill remaining with newest users
    if (recommendations.length < 5) {
      try {
        const q = query(collection(db, 'profiles'), orderBy('joinedAt', 'desc'), limit(20));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          if (recommendations.length >= 5) break;
          const p = { uid: d.id, ...d.data() };
          if (!seen.has(p.uid) && !p.isBanned) {
            seen.add(p.uid);
            recommendations.push({ ...p, reason: 'New to Flux' });
          }
        }
      } catch {}
    }

    if (!recommendations.length) { card.style.display = 'none'; return; }

    list.innerHTML = '';
    recommendations.forEach(profile => {
      const avatarHTML = profile.avatarURL
        ? `<img src="${profile.avatarURL}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:1px solid var(--glass-border);flex-shrink:0;">`
        : `<div style="width:38px;height:38px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:15px;flex-shrink:0;">${(profile.displayName || profile.username || '?')[0].toUpperCase()}</div>`;

      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--glass-border);';
      item.innerHTML = `
        <a href="profile.html?user=${profile.username}" style="display:flex;align-items:center;gap:10px;text-decoration:none;flex:1;min-width:0;">
          ${avatarHTML}
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${profile.displayName || profile.username}</div>
            <div style="font-size:11px;color:var(--muted);">@${profile.username}</div>
            <div style="font-size:10px;color:var(--accent);margin-top:1px;">${profile.reason}</div>
          </div>
        </a>
        <button class="rec-follow-btn" data-uid="${profile.uid}" data-username="${profile.username}"
          style="padding:5px 12px;background:var(--accent);color:white;border:none;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">
          Follow
        </button>
      `;
      item.querySelector('.rec-follow-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const { followUser } = await import('./firebase-auth.js');
        btn.disabled = true;
        btn.textContent = '...';
        await followUser(btn.dataset.uid);
        btn.textContent = '✓';
        btn.style.background = '#22c55e';
        setTimeout(() => item.style.opacity = '0.4', 800);
      });
      list.appendChild(item);
    });

    // Remove border from last item
    list.lastChild?.style.setProperty('border-bottom', 'none');
    card.style.display = 'block';
  });
}

/* ── helpers ── */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
