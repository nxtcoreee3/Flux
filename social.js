/* social.js — Flux Social & Chat */

import {
  getProfile, searchProfiles, renderBadges,
  initAuthUI, initServerStatus, initBroadcast,
  initChaos, initJumpscare, initPresence, initCookieConsent
} from './firebase-auth.js';

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc,
  doc, query, orderBy, limit, onSnapshot,
  serverTimestamp, getDoc
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
  initPresence();
  initServerStatus();
  initBroadcast();
  initChaos();
  initJumpscare();
  initAuthUI(null);

  initChat();
  initSearch();
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
  } catch {}
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !_currentProfile) return;

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

/* ── helpers ── */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
