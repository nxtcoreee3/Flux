/* messages.js — Flux Direct Messages & Group Chats */

import {
  getProfile, getProfileByUsername, renderBadges,
  initAuthUI, initServerStatus, initBroadcast,
  initChaos, initJumpscare, initPresence, initCookieConsent,
  initDarkMode, initChatLock
} from './firebase-auth.js';

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, setDoc,
  doc, query, orderBy, limit, onSnapshot, where,
  serverTimestamp, getDoc, getDocs, updateDoc, arrayUnion
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

let _currentUser = null;
let _currentProfile = null;
let _activeConvoId = null;
let _unsubMessages = null;
let _unsubConvos = null;
let _activeTab = 'inbox'; // 'inbox' | 'requests'

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
        // Show banner
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
    if (openWith) openDMWithUsername(openWith);
  });

  document.getElementById('new-dm-btn')?.addEventListener('click', showNewChatModal);
  document.getElementById('new-group-btn')?.addEventListener('click', showNewGroupModal);
  document.getElementById('tab-inbox')?.addEventListener('click', () => switchTab('inbox'));
  document.getElementById('tab-requests')?.addEventListener('click', () => switchTab('requests'));
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
  loadConversations();
}

/* ── Tabs ── */
function loadConversations() {
  const list = document.getElementById('convo-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center;">Loading...</div>';

  const q = query(
    collection(db, 'conversations'),
    where('members', 'array-contains', _currentUser.uid),
    orderBy('lastMessageAt', 'desc')
  );

  if (_unsubConvos) _unsubConvos();
  _unsubConvos = onSnapshot(q, async (snap) => {
    list.innerHTML = '';
    // Filter client-side: show accepted OR group OR convos without status field
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
      list.appendChild(item);
    }
  });
}

function loadRequests() {
  const list = document.getElementById('convo-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center;">Loading...</div>';

  const q = query(
    collection(db, 'conversations'),
    where('to', '==', _currentUser.uid),
    where('status', '==', 'pending')
  );

  if (_unsubConvos) _unsubConvos();
  _unsubConvos = onSnapshot(q, async (snap) => {
    list.innerHTML = '';

    // Update requests badge
    const badge = document.getElementById('requests-badge');
    if (badge) { badge.textContent = snap.size; badge.style.display = snap.size > 0 ? 'inline-flex' : 'none'; }

    if (snap.empty) {
      list.innerHTML = '<div style="padding:20px 16px;color:var(--muted);font-size:13px;text-align:center;">No message requests.</div>';
      return;
    }
    for (const d of snap.docs) {
      const item = await buildRequestItem({ id: d.id, ...d.data() });
      list.appendChild(item);
    }
  });
}

async function buildConvoItem(convo) {
  const isGroup = convo.type === 'group';
  let name, avatarHTML;

  if (isGroup) {
    name = convo.name || 'Group Chat';
    avatarHTML = `<div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--accent),#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${convo.emoji || '👥'}</div>`;
  } else {
    const otherUid = convo.members.find(m => m !== _currentUser.uid);
    const other = await getProfile(otherUid);
    name = other?.displayName || other?.username || 'Unknown';
    avatarHTML = other?.avatarURL
      ? `<img src="${other.avatarURL}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
      : `<div style="width:44px;height:44px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0;">${(name[0]||'?').toUpperCase()}</div>`;
  }

  const unread = (convo.unread || {})[_currentUser.uid] || 0;
  const item = document.createElement('div');
  item.className = 'convo-item';
  item.dataset.id = convo.id;
  if (convo.id === _activeConvoId) item.classList.add('active');
  item.innerHTML = `
    ${avatarHTML}
    <div style="flex:1;min-width:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</span>
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
  // Unsubscribe old listener first
  if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }

  const panel = document.getElementById('chat-panel');
  if (!panel) return;

  // Stamp this load so stale snapshots can be ignored
  const loadId = convoId;

  panel.innerHTML = `
    <div class="chat-header-bar">
      <button id="back-btn" class="back-btn">←</button>
      <div style="font-size:15px;font-weight:700;color:var(--text);flex:1;">${escapeHtml(name)}</div>
    </div>
    <div id="messages-list" class="messages-list"><div style="text-align:center;padding:20px;color:var(--muted);font-size:13px;">Loading messages...</div></div>
    <div class="message-input-bar">
      <input id="msg-input" type="text" placeholder="Message..." maxlength="1000" autocomplete="off" class="msg-input">
      <button id="msg-send" class="msg-send-btn">➤</button>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    if (_unsubMessages) { _unsubMessages(); _unsubMessages = null; }
    _activeConvoId = null;
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px;flex-direction:column;gap:12px;"><span style="font-size:40px;">💬</span><span>Select a conversation</span></div>';
    document.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));
  });

  document.getElementById('msg-send').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Mark as read
  updateDoc(doc(db, 'conversations', convoId), { [`unread.${_currentUser.uid}`]: 0 }).catch(() => {});

  const q = query(collection(db, 'conversations', convoId, 'messages'), orderBy('sentAt', 'asc'), limit(100));
  _unsubMessages = onSnapshot(q, (snap) => {
    // Ignore if we've switched to a different convo
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

function renderMessage(msg) {
  const isOwn = msg.uid === _currentUser.uid;
  const time = msg.sentAt?.toDate
    ? msg.sentAt.toDate().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';
  const div = document.createElement('div');
  div.className = `message-row ${isOwn ? 'own' : 'other'}`;
  div.innerHTML = `
    ${!isOwn ? `<div style="font-size:11px;color:var(--muted);margin-bottom:3px;padding-left:4px;">@${escapeHtml(msg.username || '')}</div>` : ''}
    <div class="message-bubble ${isOwn ? 'bubble-own' : 'bubble-other'}">${escapeHtml(msg.text)}</div>
    <div style="font-size:10px;color:var(--muted);margin-top:3px;${isOwn ? 'text-align:right;' : ''}">${time}</div>
  `;
  return div;
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input?.value.trim();
  if (!text || !_activeConvoId || !_currentProfile) return;

  // Check if DMs are locked
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
      text,
      sentAt: serverTimestamp(),
    });
    const convoRef = doc(db, 'conversations', _activeConvoId);
    const convoSnap = await getDoc(convoRef);
    if (convoSnap.exists()) {
      const members = convoSnap.data().members || [];
      const unreadUpdate = {};
      members.forEach(uid => { if (uid !== _currentUser.uid) unreadUpdate[`unread.${uid}`] = (convoSnap.data().unread?.[uid] || 0) + 1; });
      await updateDoc(convoRef, { lastMessage: text.slice(0, 60), lastMessageAt: serverTimestamp(), ...unreadUpdate });
    }
  } catch (e) { console.warn('Send failed:', e); }

  input.disabled = false;
  input.focus();
}

/* ── Open DM from URL ── */
async function openDMWithUsername(username) {
  const profile = await getProfileByUsername(username);
  if (!profile) return;
  await startDM(profile.uid, profile);
}

/* ── Start DM ── */
async function startDM(targetUid, targetProfile) {
  if (targetUid === _currentUser.uid) return;

  // Check existing DM
  const q = query(collection(db, 'conversations'), where('type', '==', 'dm'), where('members', 'array-contains', _currentUser.uid));
  const snap = await getDocs(q);
  let existing = null;
  snap.docs.forEach(d => { if (d.data().members.includes(targetUid)) existing = { id: d.id, ...d.data() }; });

  if (existing) {
    // If it was a pending request to us, accept it
    if (existing.status === 'pending' && existing.to === _currentUser.uid) {
      await updateDoc(doc(db, 'conversations', existing.id), { status: 'accepted' });
    }
    openConversation(existing.id, targetProfile.displayName || targetProfile.username, false);
    return;
  }

  // Check if we follow each other — if yes, auto-accept; otherwise send as request
  const myFollowing = _currentProfile.following || [];
  const theirProfile = await getProfile(targetUid);
  const theyFollowMe = (theirProfile?.following || []).includes(_currentUser.uid);
  const mutuals = myFollowing.includes(targetUid) && theyFollowMe;
  const status = mutuals ? 'accepted' : 'pending';

  const convoData = {
    type: 'dm',
    members: [_currentUser.uid, targetUid],
    from: _currentUser.uid,
    to: targetUid,
    status,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessage: '',
    unread: { [targetUid]: 0, [_currentUser.uid]: 0 }
  };

  const convoRef = await addDoc(collection(db, 'conversations'), convoData);
  openConversation(convoRef.id, targetProfile.displayName || targetProfile.username, false);
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
  document.getElementById('new-chat-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  let timer;
  document.getElementById('new-chat-search').addEventListener('input', (e) => {
    clearTimeout(timer);
    const val = e.target.value.trim();
    if (!val) { document.getElementById('new-chat-results').innerHTML = ''; return; }
    timer = setTimeout(async () => {
      const { searchProfiles } = await import('./firebase-auth.js');
      const results = await searchProfiles(val);
      const container = document.getElementById('new-chat-results');
      container.innerHTML = '';
      results.filter(p => p.uid !== _currentUser.uid).forEach(p => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;cursor:pointer;transition:background 0.1s;';
        item.innerHTML = `
          ${p.avatarURL ? `<img src="${p.avatarURL}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">` : `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;">${(p.displayName||p.username||'?')[0].toUpperCase()}</div>`}
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);">${escapeHtml(p.displayName || p.username)}</div>
            <div style="font-size:11px;color:var(--muted);">@${p.username}</div>
          </div>
        `;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--bg)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('click', () => { modal.remove(); startDM(p.uid, p); });
        container.appendChild(item);
      });
      if (!results.length) container.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:13px;text-align:center;">No users found</div>';
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

function escapeHtml(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
