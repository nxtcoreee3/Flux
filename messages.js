/* messages.js — Flux Direct Messages & Group Chats */

import {
  getProfile, getProfileByUsername, renderBadges,
  sendNotification,
  initAuthUI, initServerStatus, initBroadcast,
  initChaos, initJumpscare, initPresence, initCookieConsent,
  initDarkMode, initChatLock, reportUser, syncProfileAvatar
} from './firebase-auth.js';

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, setDoc,
  doc, query, orderBy, limit, onSnapshot, where,
  serverTimestamp, getDoc, getDocs, updateDoc, arrayUnion, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getDatabase, ref as rref, onValue as onRtdbValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

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
const rtdb = getDatabase(app);

let _currentUser = null;
let _currentProfile = null;
let _activeConvoId = null;
let _unsubMessages = null;
let _unsubConvos = null;
let _unsubTyping = null;
let _typingIdleTimer = null;
let _typingLastSend = 0;
let _activeTab = 'inbox'; // 'inbox' | 'requests'
let _convoRenderSeq = 0;

const TYPING_TTL_MS = 4500;
const TYPING_THROTTLE_MS = 1800;
const PRESENCE_TTL_MS = 12000;

let _pickerOpen = false;
let _presencePingTimer = null;
let _unsubOnline = null;
let _onlineUidCounts = new Map();
let _activeMembers = [];
let _activeIsGroup = false;
let _activeMemberProfiles = new Map(); // uid -> profile
let _mentionMenuIndex = 0;
let _mentionMenuItems = [];
let _mentionAnimatedMsgIds = new Set();
let _mentionGlobalListenersSet = false;

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initCookieConsent();
  initDarkMode();
  initPresence();
  initServerStatus();
  initBroadcast();
  initChaos();
  initJumpscare();
  initAuthUI(null);

  onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) { showSignInPrompt(); return; }
    _currentUser = user;
    _currentProfile = await getProfile(user.uid);
    if (!_currentProfile) { showSignInPrompt(); return; }
    initMessagesUI();

    // Enforce DM lock
    initChatLock('dm',
      () => {
        const input = document.getElementById('msg-input');
        const send = document.getElementById('msg-send');
        if (input) { input.disabled = true; input.placeholder = '🔒 Messages locked by an admin'; }
        if (send) send.disabled = true;
        let banner = document.getElementById('dm-lock-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'dm-lock-banner';
          banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#ef4444;color:white;padding:10px 16px;text-align:center;font-size:13px;font-weight:700;';
          banner.textContent = '🔒 Direct messages have been locked by an admin.';
          document.body.prepend(banner);
        }
      },
      () => {
        const input = document.getElementById('msg-input');
        const send = document.getElementById('msg-send');
        if (input) { input.disabled = false; input.placeholder = 'Message...'; }
        if (send) send.disabled = false;
        document.getElementById('dm-lock-banner')?.remove();
      }
    );

    const params = new URLSearchParams(location.search);
    const openWith = params.get('with');
    const openConvo = params.get('convo');
    if (openConvo) openConversationById(openConvo);
    else if (openWith) openDMWithUsername(openWith);
  });

  document.getElementById('new-dm-btn')?.addEventListener('click', () => {
    if (!_currentUser) return;
    showNewChatModal();
  });
  document.getElementById('new-group-btn')?.addEventListener('click', () => {
    if (!_currentUser) return;
    showNewGroupModal();
  });
  document.getElementById('tab-inbox')?.addEventListener('click', () => switchTab('inbox'));
  document.getElementById('tab-requests')?.addEventListener('click', () => switchTab('requests'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _pickerOpen = false;
      if (_presencePingTimer) { clearInterval(_presencePingTimer); _presencePingTimer = null; }
      setTyping(false).catch(() => {});
      setChatState(null).catch(() => {});
    }
  });
  window.addEventListener('beforeunload', () => {
    _pickerOpen = false;
    if (_presencePingTimer) { clearInterval(_presencePingTimer); _presencePingTimer = null; }
    stopTyping().catch(() => {});
    setChatState(null).catch(() => {});
  });
});

function switchTab(tab) {
  _activeTab = tab;
  document.getElementById('tab-inbox')?.classList.toggle('tab-active', tab === 'inbox');
  document.getElementById('tab-requests')?.classList.toggle('tab-active', tab === 'requests');
  if (tab === 'inbox') loadConversations();
  else loadRequests();
}

function showSignInPrompt() {
  document.getElementById('messages-root').style.display = 'none';
  const req = document.getElementById('messages-auth-required');
  if (req) req.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;padding:80px 40px;text-align:center;">
      <div>
        <div style="font-size:48px;margin-bottom:16px;">💬</div>
        <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--text);margin:0 0 8px;">Sign in to message</h2>
        <p style="color:var(--muted);font-size:14px;margin:0 0 20px;">You need a Flux profile to send and receive messages.</p>
        <a href="index.html" style="padding:10px 24px;background:var(--accent);color:white;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">Go to Home</a>
      </div>
    </div>
  `;
}

function initMessagesUI() {
  document.getElementById('messages-auth-required').innerHTML = '';
  document.getElementById('messages-root').style.display = 'flex';
  startOnlineListener();
  loadConversations();
}

function ensureMentionMenu() {
  let menu = document.getElementById('mention-menu');
  if (menu) return menu;
  menu = document.createElement('div');
  menu.id = 'mention-menu';
  document.body.appendChild(menu);
  return menu;
}

function hideMentionMenu() {
  const menu = document.getElementById('mention-menu');
  if (!menu) return;
  menu.style.display = 'none';
  menu.innerHTML = '';
  _mentionMenuIndex = 0;
  _mentionMenuItems = [];
}

function getActiveMentionCandidates() {
  const out = [];
  for (const uid of (_activeMembers || [])) {
    if (!uid) continue;
    if (uid === _currentUser?.uid) continue;
    const p = _activeMemberProfiles.get(uid) || null;
    const username = (p?.username || '').toLowerCase();
    if (!username) continue;
    out.push({ uid, profile: p, username });
  }
  // stable ordering: username
  out.sort((a, b) => a.username.localeCompare(b.username));
  return out;
}

function getMentionQueryAtCursor(inputEl) {
  const text = inputEl?.value || '';
  const pos = inputEl?.selectionStart ?? text.length;
  const before = text.slice(0, pos);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  // Only trigger if @ starts a token (start or whitespace)
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const typed = before.slice(at + 1);
  if (/\s/.test(typed)) return null;
  return { at, typed };
}

function positionMentionMenu(inputEl, menuEl) {
  const r = inputEl.getBoundingClientRect();
  const width = Math.min(320, Math.max(260, r.width));
  menuEl.style.width = `${width}px`;
  menuEl.style.left = `${Math.max(10, r.left)}px`;
  const top = r.top - 10;
  menuEl.style.top = `${Math.max(10, top)}px`;
  menuEl.style.transform = 'translateY(-100%)';
}

function renderMentionMenu(inputEl, filterText) {
  const menu = ensureMentionMenu();
  const candidates = getActiveMentionCandidates();
  const q = (filterText || '').toLowerCase();
  const filtered = candidates.filter(c => {
    const p = c.profile || {};
    const display = (p.displayName || '').toLowerCase();
    return !q || c.username.includes(q) || display.includes(q);
  }).slice(0, 8);

  if (!filtered.length) { hideMentionMenu(); return; }

  _mentionMenuItems = filtered;
  _mentionMenuIndex = Math.min(_mentionMenuIndex, filtered.length - 1);

  positionMentionMenu(inputEl, menu);
  menu.style.display = 'block';
  menu.innerHTML = filtered.map((c, idx) => {
    const p = c.profile || {};
    const name = p.displayName || c.username;
    const avatar = p.avatarURL
      ? `<img class="mention-avatar" src="${p.avatarURL}" alt="">`
      : `<div class="mention-placeholder">${escapeHtml((name[0] || '?').toUpperCase())}</div>`;
    return `
      <div class="mention-item ${idx === _mentionMenuIndex ? 'active' : ''}" data-idx="${idx}">
        ${avatar}
        <div style="min-width:0;">
          <div class="mention-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
          <div class="mention-username">@${escapeHtml(c.username)}</div>
        </div>
      </div>
    `;
  }).join('');

  menu.querySelectorAll('.mention-item').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      // prevent input blur
      e.preventDefault();
      const idx = Number(el.dataset.idx || '0');
      applyMentionSelection(inputEl, idx);
    });
  });
}

function applyMentionSelection(inputEl, idx) {
  const item = _mentionMenuItems[idx];
  if (!item) return;
  const query = getMentionQueryAtCursor(inputEl);
  if (!query) return;
  const text = inputEl.value || '';
  const before = text.slice(0, query.at);
  const after = text.slice((inputEl.selectionStart ?? text.length));
  const insert = `@${item.username} `;
  inputEl.value = before + insert + after;
  const nextPos = (before + insert).length;
  inputEl.setSelectionRange(nextPos, nextPos);
  hideMentionMenu();
  inputEl.focus();
  setTyping(true).catch(() => {});
}

async function primeMemberProfiles(members = []) {
  const list = Array.isArray(members) ? members : [];
  const uniq = Array.from(new Set(list.filter(Boolean)));
  const m = new Map();
  for (const uid of uniq) {
    if (uid === _currentUser?.uid) continue;
    try {
      m.set(uid, await getProfile(uid));
    } catch {
      m.set(uid, null);
    }
  }
  _activeMemberProfiles = m;
}

async function openConversationById(convoId) {
  if (!_currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'conversations', convoId));
    if (!snap.exists()) return;
    const convo = snap.data() || {};
    const members = convo.members || [];
    if (!Array.isArray(members) || !members.includes(_currentUser.uid)) return;

    const isGroup = convo.type === 'group';
    if (isGroup) {
      switchTab('inbox');
      openConversation(convoId, convo.name || 'Group Chat', true);
      return;
    }

    const otherUid = members.find(m => m !== _currentUser.uid);
    const other = await getProfile(otherUid);
    const name = other?.displayName || other?.username || 'Unknown';
    switchTab('inbox');
    openConversation(convoId, name, false);
  } catch {}
}

function startOnlineListener() {
  if (_unsubOnline) return;
  _unsubOnline = onRtdbValue(rref(rtdb, 'presence'), (snap) => {
    const val = snap.val() || {};
    const counts = new Map();
    Object.values(val).forEach((sess) => {
      const uid = sess?.uid || null;
      if (!uid) return;
      counts.set(uid, (counts.get(uid) || 0) + 1);
    });
    _onlineUidCounts = counts;
    refreshConvoOnlineBadges();
    refreshActiveOnlineBadge();
  }, () => {});
}

function extractMentions(text = '') {
  const out = new Set();
  const re = /@([a-z0-9_.]{3,20})/gi;
  let m;
  while ((m = re.exec(text))) out.add((m[1] || '').toLowerCase());
  return Array.from(out);
}

function renderTextWithMentions(text = '') {
  const re = /@([a-z0-9_.]{3,20})/gi;
  let last = 0;
  let m;
  const parts = [];
  while ((m = re.exec(text))) {
    const start = m.index;
    const raw = m[0] || '';
    const uname = (m[1] || '').toLowerCase();
    parts.push(escapeHtml(text.slice(last, start)));
    parts.push(`<a href="profile.html?user=${encodeURIComponent(uname)}" class="flux-mention-link">${escapeHtml(raw[0] === '@' ? `@${uname}` : raw)}</a>`);
    last = start + raw.length;
  }
  parts.push(escapeHtml(text.slice(last)));
  return parts.join('').replace(/\n/g, '<br>');
}

function messageMentionsMe(msg) {
  const me = (_currentProfile?.username || '').toLowerCase();
  if (!me) return false;
  const direct = Array.isArray(msg?.mentions) ? msg.mentions.map(x => String(x || '').toLowerCase()) : [];
  if (direct.includes(me)) return true;
  const fromText = extractMentions(String(msg?.text || ''));
  return fromText.includes(me);
}

function isUidOnline(uid) {
  return !!uid && (_onlineUidCounts.get(uid) || 0) > 0;
}

function countOnline(members = []) {
  if (!Array.isArray(members)) return 0;
  let c = 0;
  for (const uid of members) if (isUidOnline(uid)) c++;
  return c;
}

function refreshConvoOnlineBadges() {
  document.querySelectorAll('.convo-item').forEach((el) => {
    const type = el.dataset.type || '';
    if (type === 'dm') {
      const otherUid = el.dataset.otherUid || '';
      const online = isUidOnline(otherUid);
      const dot = el.querySelector('.convo-online-dot');
      const pill = el.querySelector('.convo-online-pill');
      if (dot) dot.style.opacity = online ? '1' : '0';
      if (pill) pill.style.display = online ? 'inline-flex' : 'none';
    } else if (type === 'group') {
      let members = [];
      try { members = JSON.parse(el.dataset.members || '[]'); } catch {}
      const onlineCount = countOnline(members);
      const pill = el.querySelector('.convo-group-online-pill');
      if (pill) {
        pill.textContent = `${onlineCount} online`;
        pill.style.display = onlineCount > 0 ? 'inline-flex' : 'none';
      }
    }
  });
}

function refreshActiveOnlineBadge() {
  const el = document.getElementById('chat-online-left');
  if (!el || !_activeConvoId) return;

  const avatarChip = (uid) => {
    const p = _activeMemberProfiles.get(uid) || null;
    const label = (p?.displayName || p?.username || uid || '?')[0] || '?';
    const src = p?.avatarURL || '';
    if (src) {
      return `<img src="${src}" style="width:18px;height:18px;border-radius:7px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);">`;
    }
    return `<div style="width:18px;height:18px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:900;border:1px solid rgba(0,0,0,0.06);">${escapeHtml(label.toUpperCase())}</div>`;
  };

  const renderStack = (uids = []) => {
    const top = uids.slice(0, 3);
    const stack = top.map((uid, idx) => `<div style="margin-left:${idx === 0 ? 0 : -6}px;">${avatarChip(uid)}</div>`).join('');
    return `<div style="display:flex;align-items:center;">${stack}</div>`;
  };

  if (_activeIsGroup) {
    const onlineUids = (_activeMembers || []).filter(uid => uid && uid !== _currentUser?.uid && isUidOnline(uid));
    const onlineCount = onlineUids.length;
    if (onlineCount <= 0) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'inline-flex';
    el.innerHTML = `
      ${renderStack(onlineUids)}
      <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.12);color:#16a34a;border:1px solid rgba(34,197,94,0.18);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:900;">${onlineCount} online</span>
    `;
    return;
  }

  const otherUid = (_activeMembers || []).find(uid => uid && uid !== _currentUser?.uid) || '';
  const online = isUidOnline(otherUid);
  if (!online) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'inline-flex';
  el.innerHTML = `
    ${renderStack([otherUid])}
    <span style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.12);color:#16a34a;border:1px solid rgba(34,197,94,0.18);padding:4px 10px;border-radius:999px;font-size:11px;font-weight:900;">Online</span>
  `;
}

/* ── Tabs ── */
function loadConversations() {
  const list = document.getElementById('convo-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center;"><div style="display:flex;justify-content:center;padding:20px;"><img src="assets/loading.gif" style="width:80px;height:auto;" alt="Loading..."></div></div>';

  const q = query(
    collection(db, 'conversations'),
    where('members', 'array-contains', _currentUser.uid),
    orderBy('lastMessageAt', 'desc')
  );

  if (_unsubConvos) _unsubConvos();
  _unsubConvos = onSnapshot(q, async (snap) => {
    const seq = ++_convoRenderSeq;
    list.innerHTML = '';
    const docs = snap.docs.filter(d => {
      const data = d.data();
      return data.type === 'group' || !data.status || data.status === 'accepted';
    });
    if (!docs.length) {
      list.innerHTML = '<div style="padding:20px 16px;color:var(--muted);font-size:13px;text-align:center;">No conversations yet.<br>Start one below!</div>';
      return;
    }
    for (const d of docs) {
      const item = await buildConvoItem({ id: d.id, ...d.data() });
      if (seq !== _convoRenderSeq) return; // stale async render
      list.appendChild(item);
    }
  });
}

function loadRequests() {
  const list = document.getElementById('convo-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center;"><div style="display:flex;justify-content:center;padding:20px;"><img src="assets/loading.gif" style="width:80px;height:auto;" alt="Loading..."></div></div>';

  const q = query(
    collection(db, 'conversations'),
    where('to', '==', _currentUser.uid),
    where('status', '==', 'pending')
  );

  if (_unsubConvos) _unsubConvos();
  _unsubConvos = onSnapshot(q, async (snap) => {
    const seq = ++_convoRenderSeq;
    list.innerHTML = '';

    const badge = document.getElementById('requests-badge');
    if (badge) { badge.textContent = snap.size; badge.style.display = snap.size > 0 ? 'inline-flex' : 'none'; }

    if (snap.empty) {
      list.innerHTML = '<div style="padding:20px 16px;color:var(--muted);font-size:13px;text-align:center;">No message requests.</div>';
      return;
    }
    for (const d of snap.docs) {
      const item = await buildRequestItem({ id: d.id, ...d.data() });
      if (seq !== _convoRenderSeq) return; // stale async render
      list.appendChild(item);
    }
  });
}

async function buildConvoItem(convo) {
  const isGroup = convo.type === 'group';
  let name, avatarHTML;
  const members = Array.isArray(convo.members) ? convo.members : [];

  if (isGroup) {
    name = convo.name || 'Group Chat';
    avatarHTML = `<div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--accent),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${convo.emoji || '👥'}</div>`;
  } else {
    const otherUid = convo.members.find(m => m !== _currentUser.uid);
    const other = await getProfile(otherUid);
    name = other?.displayName || other?.username || 'Unknown';
    const online = isUidOnline(otherUid);
    const avatarCore = other?.avatarURL
      ? `<img src="${other.avatarURL}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      : `<div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0;">${(name[0]||'?').toUpperCase()}</div>`;
    avatarHTML = `
      <div style="position:relative;flex-shrink:0;">
        ${avatarCore}
        <span class="convo-online-dot" style="position:absolute;right:2px;bottom:2px;width:10px;height:10px;border-radius:999px;background:#22c55e;border:2px solid var(--panel);opacity:${online ? 1 : 0};transition:opacity 0.15s;"></span>
      </div>
    `;
  }

  const unread = (convo.unread || {})[_currentUser.uid] || 0;
  const item = document.createElement('div');
  item.className = 'convo-item';
  item.dataset.id = convo.id;
  item.dataset.type = isGroup ? 'group' : 'dm';
  item.dataset.members = JSON.stringify(members);
  if (convo.id === _activeConvoId) item.classList.add('active');
  if (!isGroup) item.dataset.otherUid = (members.find(m => m !== _currentUser.uid) || '');

  const onlinePill = isGroup
    ? (() => {
      const onlineCount = countOnline(members);
      return `<span class="convo-group-online-pill" style="display:${onlineCount > 0 ? 'inline-flex' : 'none'};align-items:center;gap:6px;background:rgba(34,197,94,0.12);color:#16a34a;border:1px solid rgba(34,197,94,0.18);padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;flex-shrink:0;">${onlineCount} online</span>`;
    })()
    : `<span class="convo-online-pill" style="display:${isUidOnline(item.dataset.otherUid) ? 'inline-flex' : 'none'};align-items:center;gap:6px;background:rgba(34,197,94,0.12);color:#16a34a;border:1px solid rgba(34,197,94,0.18);padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;flex-shrink:0;">Online</span>`;

  item.innerHTML = `
    ${avatarHTML}
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</span>
          ${onlinePill}
        </span>
        ${unread > 0 ? `<span style="background:var(--accent);color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:20px;flex-shrink:0;">${unread}</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">${escapeHtml(convo.lastMessage || '')}</div>
    </div>
  `;
  item.addEventListener('click', () => openConversation(convo.id, name, isGroup));
  return item;
}

async function buildRequestItem(convo) {
  const senderProfile = await getProfile(convo.from);
  const name = senderProfile?.displayName || senderProfile?.username || 'Unknown';
  const avatarHTML = senderProfile?.avatarURL
    ? `<img src="${senderProfile.avatarURL}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
    : `<div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0;">${(name[0]||'?').toUpperCase()}</div>`;

  const item = document.createElement('div');
  item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;border:1px solid var(--glass-border);margin-bottom:8px;';
  item.innerHTML = `
    ${avatarHTML}
    <div style="flex:1;min-width:0;">
      <div style="font-size:14px;font-weight:700;color:var(--text);">${escapeHtml(name)}</div>
      <div style="font-size:12px;color:var(--muted);">wants to message you</div>
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;">
      <button class="accept-btn" data-id="${convo.id}" style="padding:6px 12px;background:#22c55e;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✓ Accept</button>
      <button class="decline-btn" data-id="${convo.id}" style="padding:6px 12px;background:transparent;border:1px solid rgba(239,68,68,0.4);color:#ef4444;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✕ Decline</button>
    </div>
  `;

  item.querySelector('.accept-btn').addEventListener('click', async () => {
    await updateDoc(doc(db, 'conversations', convo.id), { status: 'accepted' });
    switchTab('inbox');
  });
  item.querySelector('.decline-btn').addEventListener('click', async () => {
    await deleteDoc(doc(db, 'conversations', convo.id));
    item.remove();
  });
  return item;
}

/* ── Open conversation ── */
async function openConversation(convoId, name, isGroup) {
  _activeConvoId = convoId;
  document.querySelectorAll('.convo-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === convoId);
  });

  if (!localStorage.getItem('flux_dm_disclaimer')) {
    showDisclaimer(() => loadConversationMessages(convoId, name, isGroup));
    return;
  }
  loadConversationMessages(convoId, name, isGroup);
}

function showDisclaimer(onAccept) {
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:32px;">
      <div style="max-width:400px;text-align:center;">
        <div style="font-size:40px;margin-bottom:16px;">🔒</div>
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--text);margin:0 0 12px;">Before you chat</h3>
        <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left;">
          <p style="font-size:13px;color:var(--text);margin:0 0 8px;font-weight:700;">⚠️ Privacy Notice</p>
          <p style="font-size:13px;color:var(--muted);margin:0;line-height:1.6;">Messages on Flux are <strong>not end-to-end encrypted</strong>. They are stored in our database and server administrators can access message content. Do not share sensitive personal information, passwords, or private data in chats.</p>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:0 0 20px;">By continuing you acknowledge and accept this.</p>
        <button id="disclaimer-accept" style="padding:10px 28px;background:var(--accent);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">I Understand</button>
      </div>
    </div>
  `;
  document.getElementById('disclaimer-accept').addEventListener('click', () => {
    localStorage.setItem('flux_dm_disclaimer', '1');
    onAccept();
  });
}

function loadConversationMessages(convoId, name, isGroup) {
  if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }
  if (_unsubTyping) { _unsubTyping(); _unsubTyping = null; }
  if (_presencePingTimer) { clearInterval(_presencePingTimer); _presencePingTimer = null; }
  stopTyping().catch(() => {});

  const panel = document.getElementById('chat-panel');
  if (!panel) return;

  const loadId = convoId;

  panel.innerHTML = `
    <div class="chat-header-bar">
      <button id="back-btn" class="back-btn">←</button>
      <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
        <div style="font-size:15px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</div>
        <div id="chat-online-left" style="display:none;align-items:center;gap:8px;flex-shrink:0;"></div>
      </div>
      <div id="chat-presence-corner" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:120px;"></div>
    </div>
    <div id="messages-list" class="messages-list"><div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;"><div style="display:flex;justify-content:center;padding:20px;"><img src="assets/loading.gif" style="width:80px;height:auto;" alt="Loading..."></div></div></div>
    <div id="typing-strip" style="display:none;padding:0 16px 8px 16px;"></div>
    <div class="message-input-bar" style="position:relative;">
      <button id="gif-btn" class="gif-btn" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 8px;">🎬</button>
      <input id="msg-input" type="text" placeholder="Message..." maxlength="1000" autocomplete="off" class="msg-input">
      <button id="msg-send" class="msg-send-btn">➤</button>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }
    if (_unsubTyping) { _unsubTyping(); _unsubTyping = null; }
    if (_presencePingTimer) { clearInterval(_presencePingTimer); _presencePingTimer = null; }
    stopTyping().catch(() => {});
    _pickerOpen = false;
    setChatState(null).catch(() => {});
    _activeConvoId = null;
    _activeMembers = [];
    _activeIsGroup = false;
    _activeMemberProfiles = new Map();
    hideMentionMenu();
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px;flex-direction:column;gap:12px;"><span style="font-size:40px;">💬</span><span>Select a conversation</span></div>';
    document.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));
  });

  document.getElementById('msg-send').addEventListener('click', sendMessage);
  const inputEl = document.getElementById('msg-input');
  inputEl.addEventListener('keydown', (e) => {
    if (document.getElementById('mention-menu')?.style?.display === 'block') {
      if (e.key === 'ArrowDown') { e.preventDefault(); _mentionMenuIndex = Math.min(_mentionMenuIndex + 1, _mentionMenuItems.length - 1); renderMentionMenu(inputEl, getMentionQueryAtCursor(inputEl)?.typed || ''); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); _mentionMenuIndex = Math.max(_mentionMenuIndex - 1, 0); renderMentionMenu(inputEl, getMentionQueryAtCursor(inputEl)?.typed || ''); return; }
      if (e.key === 'Enter') { e.preventDefault(); applyMentionSelection(inputEl, _mentionMenuIndex); return; }
      if (e.key === 'Escape') { e.preventDefault(); hideMentionMenu(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  inputEl.addEventListener('input', () => {
    setTyping(true).catch(() => {});
    const q = getMentionQueryAtCursor(inputEl);
    if (q) renderMentionMenu(inputEl, q.typed);
    else hideMentionMenu();
  });
  inputEl.addEventListener('blur', () => {
    setTyping(false).catch(() => {});
    setTimeout(() => hideMentionMenu(), 80);
  });
  document.getElementById('gif-btn').addEventListener('click', showGifPicker);
  if (!_mentionGlobalListenersSet) {
    _mentionGlobalListenersSet = true;
    document.addEventListener('scroll', () => hideMentionMenu(), true);
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('mention-menu');
      if (!menu || menu.style.display !== 'block') return;
      if (e.target.closest && (e.target.closest('#mention-menu') || e.target.closest('#msg-input'))) return;
      hideMentionMenu();
    }, true);
    window.addEventListener('resize', () => hideMentionMenu());
  }

  {
    const draft = (document.getElementById('msg-input')?.value || '').trim();
    setChatState(draft ? 'thinking' : 'watching').catch(() => {});
  }
  _presencePingTimer = setInterval(() => {
    if (!_activeConvoId) return;
    if (_pickerOpen) return;
    if (_typingLastSend && (Date.now() - _typingLastSend) < TYPING_TTL_MS) return;
    const draft = (document.getElementById('msg-input')?.value || '').trim();
    setChatState(draft ? 'thinking' : 'watching').catch(() => {});
  }, 9000);

  updateDoc(doc(db, 'conversations', convoId), { [`unread.${_currentUser.uid}`]: 0 }).catch(() => {});

  (async () => {
    try {
      const convoSnap = await getDoc(doc(db, 'conversations', convoId));
      const members = convoSnap.exists() ? (convoSnap.data().members || []) : [];
      _activeMembers = Array.isArray(members) ? members : [];
      _activeIsGroup = !!isGroup;
      await primeMemberProfiles(_activeMembers);
      refreshActiveOnlineBadge();
      bindTypingIndicators(convoId, members);
    } catch {
      bindTypingIndicators(convoId, []);
    }
  })();

  const q = query(collection(db, 'conversations', convoId, 'messages'), orderBy('sentAt', 'asc'), limit(100));
  _unsubMessages = onSnapshot(q, (snap) => {
    if (_activeConvoId !== loadId) return;
    const list = document.getElementById('messages-list');
    if (!list) return;
    const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">No messages yet. Say hi! 👋</div>';
      return;
    }
    snap.docs.forEach(d => list.appendChild(renderMessage({ id: d.id, ...d.data() })));
    if (wasAtBottom || snap.docs.length < 5) list.scrollTop = list.scrollHeight;
  });
}

function typingRowHTML(profile, fallbackLetter) {
  const src = profile?.avatarURL || '';
  const avatar = src
    ? `<img src="${src}" style="width:28px;height:28px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
    : `<div style="width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;flex-shrink:0;">${(fallbackLetter || '?')[0].toUpperCase()}</div>`;
  return `
    <div class="flux-typing-row">
      ${avatar}
      <div class="flux-typing-bubble" aria-label="Typing">
        <span class="flux-typing-dots"><i></i><i></i><i></i></span>
      </div>
    </div>
  `;
}

function thinkingRowHTML(profile, fallbackLetter) {
  const src = profile?.avatarURL || '';
  const avatar = src
    ? `<img src="${src}" style="width:28px;height:28px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
    : `<div style="width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;flex-shrink:0;">${(fallbackLetter || '?')[0].toUpperCase()}</div>`;
  return `
    <div class="flux-typing-row">
      ${avatar}
      <div class="flux-typing-bubble" aria-label="Thinking" style="gap:8px;">
        <span style="font-size:14px;">🧠</span>
        <span style="font-size:12px;font-weight:800;color:var(--muted);">Thinking…</span>
      </div>
    </div>
  `;
}

function stickerRowHTML(profile, fallbackLetter) {
  const src = profile?.avatarURL || '';
  const avatar = src
    ? `<img src="${src}" style="width:28px;height:28px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
    : `<div style="width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;flex-shrink:0;">${(fallbackLetter || '?')[0].toUpperCase()}</div>`;
  return `
    <div class="flux-typing-row">
      ${avatar}
      <div class="flux-typing-bubble" aria-label="Sticker" style="gap:8px;">
        <span style="font-size:14px;">🎬</span>
        <span style="font-size:12px;font-weight:800;color:var(--muted);">Picking a sticker…</span>
      </div>
    </div>
  `;
}

function setTypingUI(typingUsers = [], stickerUsers = [], thinkingUsers = []) {
  const strip = document.getElementById('typing-strip');
  if (!strip) return;
  if (!typingUsers.length && !stickerUsers.length && !thinkingUsers.length) {
    strip.style.display = 'none';
    strip.innerHTML = '';
    return;
  }
  strip.style.display = 'block';
  if (typingUsers.length) strip.innerHTML = typingUsers.map(u => typingRowHTML(u.profile, u.fallbackLetter)).join('');
  else if (stickerUsers.length) strip.innerHTML = stickerUsers.map(u => stickerRowHTML(u.profile, u.fallbackLetter)).join('');
  else strip.innerHTML = thinkingUsers.map(u => thinkingRowHTML(u.profile, u.fallbackLetter)).join('');
}

function setCornerUI({ typingCount = 0, stickerCount = 0, thinkingCount = 0, watchingCount = 0, users = [] } = {}) {
  const corner = document.getElementById('chat-presence-corner');
  if (!corner) return;
  if (!users.length) {
    corner.innerHTML = '';
    return;
  }

  const label = typingCount
    ? (typingCount === 1 ? 'Typing…' : `${typingCount} typing…`)
    : stickerCount
      ? (stickerCount === 1 ? 'Sticker…' : `${stickerCount} stickers…`)
      : thinkingCount
        ? (thinkingCount === 1 ? 'Thinking…' : `${thinkingCount} thinking…`)
        : (watchingCount === 1 ? 'Watching' : `${watchingCount} watching`);

  const icon = typingCount ? '✍️' : (stickerCount ? '🎬' : (thinkingCount ? '🧠' : '👀'));

  const stack = users.slice(0, 3).map((u, idx) => {
    const p = u.profile;
    const fallback = u.fallbackLetter || '?';
    const src = p?.avatarURL || '';
    const avatar = src
      ? `<img src="${src}" style="width:18px;height:18px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);">`
      : `<div style="width:18px;height:18px;border-radius:6px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:800;border:1px solid rgba(0,0,0,0.06);">${escapeHtml((fallback[0] || '?').toUpperCase())}</div>`;
    return `<div style="margin-left:${idx === 0 ? 0 : -6}px;">${avatar}</div>`;
  }).join('');

  corner.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.04);border:1px solid var(--glass-border);">
      <div style="display:flex;align-items:center;">${stack}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:var(--muted);white-space:nowrap;">
        <span>${icon}</span><span>${escapeHtml(label)}</span>
      </div>
    </div>
  `;
}

function bindTypingIndicators(convoId, members = []) {
  if (!_currentUser) return;
  if (_unsubTyping) { _unsubTyping(); _unsubTyping = null; }

  const otherUids = Array.from(new Set((members || []).filter(uid => uid && uid !== _currentUser.uid)));
  const latestTyping = new Map();
  const latestState = new Map();
  const profiles = new Map();
  let pruneTimer = null;

  const render = () => {
    if (_activeConvoId !== convoId) return;
    const now = Date.now();
    const typingUids = Array.from(latestTyping.entries())
      .filter(([, ms]) => now - ms < TYPING_TTL_MS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([uid]) => ({
        uid,
        profile: profiles.get(uid) || null,
        fallbackLetter: (profiles.get(uid)?.displayName || profiles.get(uid)?.username || uid)[0] || '?'
      }));

    const active = Array.from(latestState.entries())
      .filter(([, v]) => v?.ms && (now - v.ms) < PRESENCE_TTL_MS)
      .map(([uid, v]) => ({
        uid,
        state: v.state,
        ms: v.ms,
        profile: profiles.get(uid) || null,
        fallbackLetter: (profiles.get(uid)?.displayName || profiles.get(uid)?.username || uid)[0] || '?'
      }));

    const thinkingUids = active
      .filter(a => a.state === 'thinking' && !typingUids.some(t => t.uid === a.uid))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 3)
      .map(a => ({
        uid: a.uid,
        profile: a.profile || null,
        fallbackLetter: a.fallbackLetter || '?'
      }));
    const stickerUids = active
      .filter(a => a.state === 'stickers' && !typingUids.some(t => t.uid === a.uid))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 3)
      .map(a => ({
        uid: a.uid,
        profile: a.profile || null,
        fallbackLetter: a.fallbackLetter || '?'
      }));
    setTypingUI(typingUids, stickerUids, thinkingUids);

    if (!active.length) { setCornerUI({ users: [] }); return; }
    const typingCount = active.filter(a => a.state === 'typing').length;
    const stickerCount = active.filter(a => a.state === 'stickers').length;
    const thinkingCount = active.filter(a => a.state === 'thinking').length;
    const watchingCount = active.filter(a => a.state === 'watching').length;
    const priority = (s) => s === 'typing' ? 4 : (s === 'stickers' ? 3 : (s === 'thinking' ? 2 : 1));
    const top = active
      .sort((a, b) => (priority(b.state) - priority(a.state)) || (b.ms - a.ms))
      .slice(0, 3);
    setCornerUI({ typingCount, stickerCount, thinkingCount, watchingCount, users: top });
  };

  (async () => {
    for (const uid of otherUids) {
      try { profiles.set(uid, await getProfile(uid)); } catch {}
    }
    render();
  })();

  const unsubs = [];
  for (const uid of otherUids) {
    const ref = doc(db, 'presence', uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      const chatConvoId = data.chatConvoId || '';
      const chatState = data.chatState || '';
      const chatAt = data.chatAt;
      const chatMs = chatAt?.toMillis ? chatAt.toMillis() : (typeof chatAt === 'number' ? chatAt : 0);

      const typingConvoId = data.typingConvoId || '';
      const typingAt = data.typingAt;
      const typingMs = typingAt?.toMillis ? typingAt.toMillis() : (typeof typingAt === 'number' ? typingAt : 0);

      if (typingConvoId === convoId && typingMs) {
        latestTyping.set(uid, typingMs);
        latestState.set(uid, { state: 'typing', ms: typingMs });
      } else {
        latestTyping.delete(uid);
        if (chatConvoId === convoId && chatState && chatMs) latestState.set(uid, { state: chatState, ms: chatMs });
        else latestState.delete(uid);
      }
      render();
    }, () => {
      latestTyping.delete(uid);
      latestState.delete(uid);
      render();
    });
    unsubs.push(unsub);
  }

  pruneTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [uid, ms] of latestTyping.entries()) {
      if (now - ms >= TYPING_TTL_MS) { latestTyping.delete(uid); changed = true; }
    }
    for (const [uid, v] of latestState.entries()) {
      if (!v?.ms || now - v.ms >= PRESENCE_TTL_MS) { latestState.delete(uid); changed = true; }
    }
    if (changed) render();
  }, 900);

  _unsubTyping = () => {
    try { unsubs.forEach(fn => fn()); } catch {}
    try { clearInterval(pruneTimer); } catch {}
    setTypingUI([], [], []);
    setCornerUI({ users: [] });
  };
}

async function setChatState(state) {
  if (!_currentUser) return;
  if (state && !_activeConvoId) return;
  const payload = state
    ? { chatConvoId: _activeConvoId, chatState: state, chatAt: serverTimestamp() }
    : { chatConvoId: deleteField(), chatState: deleteField(), chatAt: deleteField() };
  try {
    await setDoc(doc(db, 'presence', _currentUser.uid), payload, { merge: true });
  } catch {}
}

async function setTyping(isTyping) {
  if (!_currentUser || !_activeConvoId) return;
  const convoId = _activeConvoId;

  if (_typingIdleTimer) clearTimeout(_typingIdleTimer);

  if (!isTyping) {
    await stopTyping();
    return;
  }
  if (_pickerOpen) return;

  const now = Date.now();
  if (now - _typingLastSend < TYPING_THROTTLE_MS) {
    _typingIdleTimer = setTimeout(() => stopTyping().catch(() => {}), TYPING_TTL_MS);
    return;
  }
  _typingLastSend = now;

  try {
    await setDoc(doc(db, 'presence', _currentUser.uid), {
      chatConvoId: convoId,
      chatState: 'typing',
      chatAt: serverTimestamp(),
      typingConvoId: convoId,
      typingAt: serverTimestamp()
    }, { merge: true });
  } catch {}

  _typingIdleTimer = setTimeout(() => stopTyping().catch(() => {}), TYPING_TTL_MS);
}

async function stopTyping() {
  if (_typingIdleTimer) { clearTimeout(_typingIdleTimer); _typingIdleTimer = null; }
  _typingLastSend = 0;
  if (!_currentUser) return;
  try {
    await setDoc(doc(db, 'presence', _currentUser.uid), {
      typingConvoId: deleteField(),
      typingAt: deleteField()
    }, { merge: true });
  } catch {}
  if (_activeConvoId && !_pickerOpen) {
    const draft = (document.getElementById('msg-input')?.value || '').trim();
    setChatState(draft ? 'thinking' : 'watching').catch(() => {});
  }
}

function renderMessage(msg) {
  const isOwn = msg.uid === _currentUser.uid;
  const time = msg.sentAt?.toDate
    ? msg.sentAt.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  const avatarHTML = msg.senderAvatar
    ? `<img src="${msg.senderAvatar}" style="width:28px;height:28px;border-radius:8px;object-fit:cover;margin-${isOwn?'left':'right'}:8px;flex-shrink:0;">`
    : `<div style="width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;margin-${isOwn?'left':'right'}:8px;flex-shrink:0;">${(msg.username||'?')[0].toUpperCase()}</div>`;

  const isGif = msg.type === 'gif';
  const div = document.createElement('div');
  div.className = `message-row ${isOwn ? 'own' : 'other'}`;
  div.style.cssText = `display:flex;align-items:flex-end;margin-bottom:12px;flex-direction:${isOwn?'row-reverse':'row'}`;

  const bubbleClass = isGif ? '' : (isOwn ? 'bubble-own' : 'bubble-other');
  const bubbleStyle = isGif ? 'padding:0;background:transparent;border:none;' : '';

  const content = isGif
    ? `<img src="${msg.text}" alt="${msg.stickerName || 'sticker'}" style="max-width:160px;max-height:160px;border-radius:12px;display:block;object-fit:contain;" loading="lazy">`
    : `${renderTextWithMentions(msg.text || '')}`;

  div.innerHTML = `
    ${avatarHTML}
    <div class="message-body" style="max-width:65%;min-width:0;">
      ${!isOwn ? `<div style="font-size:10px;color:var(--muted);margin-bottom:2px;padding-left:2px;">@${escapeHtml(msg.username || '')}</div>` : ''}
      <div class="message-bubble ${bubbleClass}" style="position:relative;display:inline-block;text-align:left;min-height:auto;height:auto;${bubbleStyle}">
        ${content}
        <div class="msg-actions" style="position:absolute;top:-20px;${isOwn?'right:0;':'left:0;'}display:none;gap:4px;background:var(--panel);padding:2px 6px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid var(--glass-border);z-index:10;">
          <button class="msg-report" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;">🚩</button>
          ${isOwn ? `<button class="msg-delete" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;">🗑️</button>` : ''}
        </div>
      </div>
      <div style="font-size:9px;color:var(--muted);margin-top:2px;${isOwn ? 'text-align:right;' : ''}">${time}</div>
    </div>
  `;

  // Pop animation when you get mentioned
  if (msg?.id && messageMentionsMe(msg) && !_mentionAnimatedMsgIds.has(msg.id)) {
    const bubble = div.querySelector('.message-bubble');
    if (bubble) {
      _mentionAnimatedMsgIds.add(msg.id);
      bubble.classList.add('flux-mention-pop');
      bubble.addEventListener('animationend', () => bubble.classList.remove('flux-mention-pop'), { once: true });
    }
  }

  div.addEventListener('mouseenter', () => div.querySelector('.msg-actions').style.display = 'flex');
  div.addEventListener('mouseleave', () => div.querySelector('.msg-actions').style.display = 'none');

  div.querySelector('.msg-report')?.addEventListener('click', async () => {
    const reason = prompt('Why are you reporting this message?');
    if (reason) {
      await reportUser(msg.uid, reason, `DM Context: ${msg.text} (Msg: ${msg.id}, Convo: ${_activeConvoId})`);
      alert('Report sent to moderators.');
      div.style.opacity = '0.3';
    }
  });

  div.querySelector('.msg-delete')?.addEventListener('click', async () => {
    if (confirm('Delete this message?')) {
      await deleteMessage(_activeConvoId, msg.id);
    }
  });

  return div;
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input?.value.trim();
  if (!text || !_activeConvoId || !_currentProfile) return;
  setTyping(false).catch(() => {});
  const mentionUsernames = extractMentions(text);

  try {
    const lockSnap = await getDoc(doc(db, 'stats', 'chatlock'));
    if (lockSnap.exists() && lockSnap.data().dmLocked) {
      input.value = '';
      const list = document.getElementById('messages-list');
      if (list) {
        const notice = document.createElement('div');
        notice.style.cssText = 'text-align:center;padding:8px;color:#ef4444;font-size:12px;font-weight:600;';
        notice.textContent = '🔒 Direct messages are currently locked by an admin.';
        list.appendChild(notice);
        list.scrollTop = list.scrollHeight;
        setTimeout(() => notice.remove(), 3000);
      }
      return;
    }
  } catch {}

  input.value = '';
  input.disabled = true;

  try {
    await addDoc(collection(db, 'conversations', _activeConvoId, 'messages'), {
      uid: _currentUser.uid,
      username: _currentProfile.username,
      displayName: _currentProfile.displayName,
      senderAvatar: _currentProfile.avatarURL || '',
      text,
      type: 'text',
      mentions: mentionUsernames,
      sentAt: serverTimestamp(),
    });
    const convoRef = doc(db, 'conversations', _activeConvoId);
    const convoSnap = await getDoc(convoRef);
    if (convoSnap.exists()) {
      const members = convoSnap.data().members || [];
      const unreadUpdate = {};
      members.forEach(uid => { if (uid !== _currentUser.uid) unreadUpdate[`unread.${uid}`] = (convoSnap.data().unread?.[uid] || 0) + 1; });
      await updateDoc(convoRef, { lastMessage: text.slice(0, 60), lastMessageAt: serverTimestamp(), ...unreadUpdate });

      // Mention pings (@username)
      if (mentionUsernames.length) {
        for (const uname of mentionUsernames) {
          try {
            const p = await getProfileByUsername(uname);
            const targetUid = p?.uid || '';
            if (!targetUid) continue;
            if (targetUid === _currentUser.uid) continue;
            if (!Array.isArray(members) || !members.includes(targetUid)) continue;
            await sendNotification(targetUid, {
              type: 'message',
              title: `💬 @${_currentProfile.username} mentioned you`,
              body: text.length > 90 ? (text.slice(0, 87) + '…') : text,
              link: `messages.html?convo=${encodeURIComponent(_activeConvoId)}`
            });
          } catch {}
        }
      }
    }
  } catch (e) { console.warn('Send failed:', e); }

  input.disabled = false;
  input.focus();
}

async function deleteMessage(convoId, msgId) {
  try {
    await deleteDoc(doc(db, 'conversations', convoId, 'messages', msgId));
  } catch (e) { console.warn('Delete failed:', e); }
}

/* ── Open DM from URL ── */
async function openDMWithUsername(username) {
  const profile = await getProfileByUsername(username);
  if (!profile) return;
  await startDM(profile.uid, profile);
}

/* ── Start DM ── */
async function startDM(targetUid, targetProfile) {
  if (!_currentUser || !_currentProfile) return;
  if (targetUid === _currentUser.uid) return;

  const convoId = [_currentUser.uid, targetUid].sort().join('_dm_');

  const convoRef = doc(db, 'conversations', convoId);
  const convoSnap = await getDoc(convoRef);

  if (convoSnap.exists()) {
    const data = convoSnap.data();
    if (data.status === 'pending' && data.to === _currentUser.uid) {
      await updateDoc(convoRef, { status: 'accepted' });
    }
    openConversation(convoId, targetProfile.displayName || targetProfile.username, false);
    return;
  }

  const myFollowing = _currentProfile.following || [];
  const theirProfile = await getProfile(targetUid);
  const theyFollowMe = (theirProfile?.following || []).includes(_currentUser.uid);
  const mutuals = myFollowing.includes(targetUid) && theyFollowMe;
  const status = mutuals ? 'accepted' : 'pending';

  await setDoc(convoRef, {
    type: 'dm',
    members: [_currentUser.uid, targetUid],
    from: _currentUser.uid,
    to: targetUid,
    status,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessage: '',
    unread: { [targetUid]: 0, [_currentUser.uid]: 0 }
  });

  openConversation(convoId, targetProfile.displayName || targetProfile.username, false);
}

/* ── New DM modal ── */
function showNewChatModal() {
  const existing = document.getElementById('new-chat-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'new-chat-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);';
  modal.innerHTML = `
    <div style="background:var(--panel);border-radius:20px;padding:28px;width:100%;max-width:380px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;">
      <button id="new-chat-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:26px;margin:0 0 16px;color:var(--text);">New Message</h3>
      <input id="new-chat-search" type="text" placeholder="Search by username..." autocomplete="off"
        style="width:100%;padding:10px 12px;border:1px solid var(--glass-border);border-radius:10px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;margin-bottom:12px;">
      <div id="new-chat-results" style="max-height:240px;overflow-y:auto;"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#new-chat-close');
  const searchInput = modal.querySelector('#new-chat-search');
  const resultsDiv = modal.querySelector('#new-chat-results');

  closeBtn.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  searchInput.focus();

  let timer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(timer);
    const val = e.target.value.trim();
    if (!val) { resultsDiv.innerHTML = ''; return; }
    resultsDiv.innerHTML = '<div style="padding:16px;text-align:center;"><img src="assets/loading.gif" style="width:40px;height:auto;opacity:0.6;"></div>';
    timer = setTimeout(async () => {
      try {
        const { searchProfiles } = await import('./firebase-auth.js');
        const results = await searchProfiles(val);
        resultsDiv.innerHTML = '';
        results.filter(p => p.uid !== _currentUser?.uid).forEach(p => {
          const item = document.createElement('div');
          item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;transition:background 0.1s;';
          item.innerHTML = `
            ${p.avatarURL ? `<img src="${p.avatarURL}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;flex-shrink:0;">${(p.displayName||p.username||'?')[0].toUpperCase()}</div>`}
            <div style="min-width:0;">
              <div style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.displayName || p.username)}</div>
              <div style="font-size:11px;color:var(--muted);">@${p.username}</div>
            </div>
          `;
          item.addEventListener('mouseenter', () => item.style.background = 'var(--bg)');
          item.addEventListener('mouseleave', () => item.style.background = '');
          item.addEventListener('click', () => { modal.remove(); startDM(p.uid, p); });
          resultsDiv.appendChild(item);
        });
        if (!results.length) resultsDiv.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px;text-align:center;">No users found</div>';
      } catch (e) {
        resultsDiv.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px;text-align:center;">Search failed. Try again.</div>';
      }
    }, 300);
  });
}

/* ── New Group modal ── */
function showNewGroupModal() {
  const existing = document.getElementById('new-group-modal');
  if (existing) existing.remove();
  const selectedMembers = new Map();
  const modal = document.createElement('div');
  modal.id = 'new-group-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);';
  modal.innerHTML = `
    <div style="background:var(--panel);border-radius:20px;padding:28px;width:100%;max-width:400px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;max-height:90vh;overflow-y:auto;">
      <button id="new-group-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:26px;margin:0 0 16px;color:var(--text);">New Group Chat</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input id="group-emoji" type="text" placeholder="👥" maxlength="2"
          style="width:52px;padding:10px;border:1px solid var(--glass-border);border-radius:10px;font-size:18px;text-align:center;background:var(--bg);color:var(--text);outline:none;">
        <input id="group-name" type="text" placeholder="Group name..." maxlength="30"
          style="flex:1;padding:10px 12px;border:1px solid var(--glass-border);border-radius:10px;font-size:14px;background:var(--bg);color:var(--text);outline:none;">
      </div>
      <input id="group-search" type="text" placeholder="Add members by username..." autocomplete="off"
        style="width:100%;padding:10px 12px;border:1px solid var(--glass-border);border-radius:10px;font-size:14px;background:var(--bg);color:var(--text);outline:none;box-sizing:border-box;margin-bottom:8px;">
      <div id="group-search-results" style="max-height:140px;overflow-y:auto;margin-bottom:8px;"></div>
      <div id="group-members-chips" style="display:flex;flex-wrap:wrap;gap:6px;min-height:28px;margin-bottom:14px;"></div>
      <button id="create-group-btn" style="width:100%;padding:12px;background:var(--accent);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">Create Group</button>
      <p id="group-error" style="color:#ef4444;font-size:12px;margin:8px 0 0;text-align:center;display:none;"></p>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('new-group-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  const updateChips = () => {
    const chips = document.getElementById('group-members-chips');
    chips.innerHTML = '';
    selectedMembers.forEach((p, uid) => {
      const chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:var(--accent);color:white;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;';
      chip.innerHTML = `@${p.username} <button style="background:none;border:none;color:rgba(255,255,255,0.8);cursor:pointer;font-size:12px;padding:0 0 0 2px;" data-uid="${uid}">✕</button>`;
      chip.querySelector('button').addEventListener('click', () => { selectedMembers.delete(uid); updateChips(); });
      chips.appendChild(chip);
    });
  };

  let timer;
  document.getElementById('group-search').addEventListener('input', (e) => {
    clearTimeout(timer);
    const val = e.target.value.trim();
    if (!val) { document.getElementById('group-search-results').innerHTML = ''; return; }
    timer = setTimeout(async () => {
      const { searchProfiles } = await import('./firebase-auth.js');
      const results = await searchProfiles(val);
      const container = document.getElementById('group-search-results');
      container.innerHTML = '';
      results.filter(p => p.uid !== _currentUser.uid).forEach(p => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px;border-radius:8px;cursor:pointer;';
        item.innerHTML = `<div style="font-size:13px;font-weight:700;color:var(--text);">@${escapeHtml(p.username)}</div>${selectedMembers.has(p.uid) ? '<span style="color:#22c55e;font-size:12px;">✓</span>' : ''}`;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--bg)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('click', () => {
          if (!selectedMembers.has(p.uid)) { selectedMembers.set(p.uid, p); updateChips(); }
          document.getElementById('group-search').value = '';
          container.innerHTML = '';
        });
        container.appendChild(item);
      });
    }, 300);
  });

  document.getElementById('create-group-btn').addEventListener('click', async () => {
    const name = document.getElementById('group-name').value.trim();
    const emoji = document.getElementById('group-emoji').value.trim() || '👥';
    const errEl = document.getElementById('group-error');
    if (!name) { errEl.textContent = 'Enter a group name.'; errEl.style.display = 'block'; return; }
    if (selectedMembers.size < 1) { errEl.textContent = 'Add at least one member.'; errEl.style.display = 'block'; return; }
    const members = [_currentUser.uid, ...selectedMembers.keys()];
    const unread = {};
    members.forEach(uid => { unread[uid] = 0; });
    const convoRef = await addDoc(collection(db, 'conversations'), {
      type: 'group', name, emoji, members,
      createdBy: _currentUser.uid,
      status: 'accepted',
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: '', unread
    });
    modal.remove();
    openConversation(convoRef.id, name, true);
  });
}

/* ── GIF / Sticker Picker ── */
async function showGifPicker() {
  const existing = document.getElementById('gif-picker-modal');
  if (existing) {
    try { existing.remove(); } catch {}
    _pickerOpen = false;
    stopTyping().catch(() => {});
    const draft = (document.getElementById('msg-input')?.value || '').trim();
    setChatState(_activeConvoId ? (draft ? 'thinking' : 'watching') : null).catch(() => {});
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'gif-picker-modal';
  modal.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:600;width:300px;background:var(--panel);border-radius:16px;padding:14px;box-shadow:0 10px 40px rgba(0,0,0,0.2);border:1px solid var(--glass-border);display:flex;flex-direction:column;max-height:340px;';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--text);">🎬 Stickers <span style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;letter-spacing:0.8px;text-transform:uppercase;vertical-align:middle;">Beta</span></span>
      <button id="gif-modal-close" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0;">✕</button>
    </div>
    <input id="gif-search" type="text" placeholder="Search stickers..." style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg);color:var(--text);font-size:13px;outline:none;box-sizing:border-box;margin-bottom:10px;font-family:inherit;flex-shrink:0;">
    <div id="gif-results" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;overflow-y:auto;flex:1;"></div>
  `;
  document.body.appendChild(modal);

  _pickerOpen = true;
  stopTyping().catch(() => {});
  setChatState('stickers').catch(() => {});

  const close = () => {
    try { modal.remove(); } catch {}
    _pickerOpen = false;
    stopTyping().catch(() => {});
    const draft = (document.getElementById('msg-input')?.value || '').trim();
    setChatState(_activeConvoId ? (draft ? 'thinking' : 'watching') : null).catch(() => {});
  };

  document.getElementById('gif-modal-close').addEventListener('click', close);

  const results = document.getElementById('gif-results');
  const search = document.getElementById('gif-search');
  let _allStickers = [];

  const renderStickers = (list) => {
    if (!list.length) {
      results.innerHTML = '<div style="grid-column:1/-1;padding:12px;font-size:12px;color:var(--muted);text-align:center;">No stickers found.<br><span style="font-size:10px;">Add GIFs to your GIFs/ folder.</span></div>';
      return;
    }
    results.innerHTML = '';
    list.forEach(s => {
      const img = document.createElement('img');
      img.src = s.url;
      img.title = s.name;
      img.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:border-color 0.15s;';
      img.addEventListener('mouseenter', () => img.style.borderColor = 'var(--accent)');
      img.addEventListener('mouseleave', () => img.style.borderColor = 'transparent');
      img.addEventListener('click', async () => {
        close();
        await sendGif(s.url, s.name);
      });
      results.appendChild(img);
    });
  };

  results.innerHTML = '<div style="grid-column:1/-1;padding:12px;font-size:12px;color:var(--muted);text-align:center;">Loading stickers...</div>';
  try {
    const resp = await fetch(`GIFs/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error('no manifest');
    _allStickers = await resp.json();
    renderStickers(_allStickers);
  } catch {
    results.innerHTML = '<div style="grid-column:1/-1;padding:12px;font-size:12px;color:var(--muted);text-align:center;">No stickers yet.<br><span style="font-size:10px;">Create a <strong>GIFs/manifest.json</strong> file.</span></div>';
  }

  search.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    renderStickers(q ? _allStickers.filter(s => s.name.toLowerCase().includes(q)) : _allStickers);
  });

  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!modal.contains(e.target)) { close(); document.removeEventListener('click', handler); }
    });
  }, 50);
}

async function sendGif(url, name) {
  if (!_activeConvoId || !_currentProfile) return;
  try {
    await addDoc(collection(db, 'conversations', _activeConvoId, 'messages'), {
      uid: _currentUser.uid,
      username: _currentProfile.username,
      displayName: _currentProfile.displayName,
      senderAvatar: _currentProfile.avatarURL || '',
      text: url,
      stickerName: name || '',
      type: 'gif',
      sentAt: serverTimestamp(),
    });
  } catch (e) { console.warn('GIF Send failed:', e); }
}

function escapeHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

setTimeout(() => { if(window.hideGlobalLoader) window.hideGlobalLoader(); }, 600);
