/* social.js — Flux Social & Chat */

import {
  getProfile, searchProfiles, renderBadges,
  initAuthUI, initServerStatus, initBroadcast,
  initChaos, initJumpscare, initPresence, initCookieConsent,
  initDarkMode, initChatLock, fetchLeaderboard, reportUser, updateProfile
} from './firebase-auth.js';

import { buildFluxBuddyDataUrl, normalizeFluxBuddy, FLUX_BUDDY_DEFAULT } from './flux-buddy.js';

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, setDoc,
  doc, query, orderBy, limit, onSnapshot,
  serverTimestamp, getDoc, getDocs, where, deleteField
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
const GLOBAL_CONVO_ID = 'global';
const PRESENCE_TTL_MS = 12000;
const TYPING_TTL_MS = 4500;
const TYPING_THROTTLE_MS = 1800;

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
let _unsubPresence = null;
let _presencePingTimer = null;
let _typingIdleTimer = null;
let _typingLastSend = 0;
let _pickerOpen = false;

const _presenceProfileCache = {};

async function getPresenceProfile(uid) {
  if (!uid) return null;
  if (_presenceProfileCache[uid]) return _presenceProfileCache[uid];
  const p = await getProfile(uid);
  if (p) _presenceProfileCache[uid] = p;
  return p;
}

function bestCornerAvatar(profile) {
  const buddy = profile?.fluxBuddy && typeof profile.fluxBuddy === 'object' ? profile.fluxBuddy : null;
  if (buddy) return buildFluxBuddyDataUrl(buddy, 'icon');
  return profile?.avatarURL || '';
}

function renderPresenceCorner(items = []) {
  const corner = document.getElementById('global-presence-corner');
  if (!corner) return;
  if (!items.length) { corner.innerHTML = ''; return; }

  const typingCount = items.filter(i => i.state === 'typing').length;
  const stickerCount = items.filter(i => i.state === 'stickers').length;
  const thinkingCount = items.filter(i => i.state === 'thinking').length;
  const watchingCount = items.filter(i => i.state === 'watching').length;

  const label = typingCount
    ? (typingCount === 1 ? 'Typing…' : `${typingCount} typing…`)
    : stickerCount
      ? (stickerCount === 1 ? 'Sticker…' : `${stickerCount} stickers…`)
      : thinkingCount
        ? (thinkingCount === 1 ? 'Thinking…' : `${thinkingCount} thinking…`)
        : (watchingCount === 1 ? 'Watching' : `${watchingCount} watching`);

  const icon = typingCount ? '✍️' : (stickerCount ? '🎬' : (thinkingCount ? '🧠' : '👀'));

  const stack = items.slice(0, 3).map((i, idx) => {
    const p = i.profile || null;
    const fallback = (p?.displayName || p?.username || i.uid || '?')[0] || '?';
    const src = bestCornerAvatar(p);
    const avatar = src
      ? `<img src="${src}" style="width:18px;height:18px;border-radius:6px;object-fit:cover;border:1px solid rgba(0,0,0,0.06);">`
      : `<div style="width:18px;height:18px;border-radius:6px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:900;border:1px solid rgba(0,0,0,0.06);">${escapeHtml(fallback.toUpperCase())}</div>`;
    return `<div style="margin-left:${idx === 0 ? 0 : -6}px;">${avatar}</div>`;
  }).join('');

  corner.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(0,0,0,0.04);border:1px solid var(--glass-border);">
      <div style="display:flex;align-items:center;">${stack}</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:900;color:var(--muted);white-space:nowrap;">
        <span>${icon}</span><span>${escapeHtml(label)}</span>
      </div>
    </div>
  `;
}

function startPresenceCornerListener() {
  if (_unsubPresence) { _unsubPresence(); _unsubPresence = null; }

  const q = query(
    collection(db, 'presence'),
    where('chatConvoId', '==', GLOBAL_CONVO_ID),
    orderBy('chatAt', 'desc'),
    limit(10)
  );

  _unsubPresence = onSnapshot(q, async (snap) => {
    const now = Date.now();
    const rows = [];
    snap.docs.forEach((d) => {
      const data = d.data() || {};
      const state = data.chatState || 'watching';
      const at = data.chatAt;
      const ms = at?.toMillis ? at.toMillis() : (typeof at === 'number' ? at : 0);
      if (!ms || (now - ms) > PRESENCE_TTL_MS) return;
      rows.push({ uid: d.id, state, ms });
    });

    const priority = (s) => s === 'typing' ? 4 : (s === 'stickers' ? 3 : (s === 'thinking' ? 2 : 1));
    rows.sort((a, b) => (priority(b.state) - priority(a.state)) || (b.ms - a.ms));

    const top = rows.slice(0, 6);
    const items = [];
    for (const r of top) {
      const p = await getPresenceProfile(r.uid);
      items.push({ ...r, profile: p });
    }
    renderPresenceCorner(items);
  }, () => renderPresenceCorner([]));
}

async function setGlobalChatState(state) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const payload = state
    ? { chatConvoId: GLOBAL_CONVO_ID, chatState: state, chatAt: serverTimestamp() }
    : { chatConvoId: deleteField(), chatState: deleteField(), chatAt: deleteField() };
  try {
    await setDoc(doc(db, 'presence', user.uid), payload, { merge: true });
  } catch {}
}

async function setGlobalTyping(isTyping) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  if (_typingIdleTimer) clearTimeout(_typingIdleTimer);

  if (!isTyping) {
    _typingLastSend = 0;
    if (_pickerOpen) return;
    const draft = (document.getElementById('chat-input')?.value || '').trim();
    setGlobalChatState(draft ? 'thinking' : 'watching').catch(() => {});
    return;
  }
  if (_pickerOpen) return;

  const now = Date.now();
  if (now - _typingLastSend < TYPING_THROTTLE_MS) {
    _typingIdleTimer = setTimeout(() => setGlobalTyping(false).catch(() => {}), TYPING_TTL_MS);
    return;
  }
  _typingLastSend = now;
  setGlobalChatState('typing').catch(() => {});
  _typingIdleTimer = setTimeout(() => setGlobalTyping(false).catch(() => {}), TYPING_TTL_MS);
}

function startPresencePings() {
  if (_presencePingTimer) { clearInterval(_presencePingTimer); _presencePingTimer = null; }
  setGlobalTyping(false).catch(() => {});
  _presencePingTimer = setInterval(() => {
    if (_pickerOpen) return;
    if (_typingLastSend && (Date.now() - _typingLastSend) < TYPING_TTL_MS) return;
    const draft = (document.getElementById('chat-input')?.value || '').trim();
    setGlobalChatState(draft ? 'thinking' : 'watching').catch(() => {});
  }, 9000);
}

function stopPresencePings() {
  if (_presencePingTimer) { clearInterval(_presencePingTimer); _presencePingTimer = null; }
  if (_typingIdleTimer) { clearTimeout(_typingIdleTimer); _typingIdleTimer = null; }
  _typingLastSend = 0;
  _pickerOpen = false;
  setGlobalChatState(null).catch(() => {});
}

function initFluxyRoom(profile) {
  const room = document.getElementById('buddy-room');
  if (!room) return;
  room.style.display = 'block';

  const img = document.getElementById('buddy-avatar');
  const hint = document.getElementById('buddy-room-hint');
  const btn = document.getElementById('buddy-customize');

  const buddy = profile?.fluxBuddy && typeof profile.fluxBuddy === 'object' ? profile.fluxBuddy : null;
  const src = buddy ? buildFluxBuddyDataUrl(buddy, 'full') : (profile?.avatarURL || '');

  if (img) {
    img.src = src || '';
    img.style.opacity = src ? '1' : '0';
    img.style.borderRadius = buddy ? '0' : '18px';
    img.style.objectFit = buddy ? 'contain' : 'cover';
    img.style.background = buddy ? 'transparent' : 'rgba(0,0,0,0.04)';
    img.style.border = buddy ? 'none' : '1px solid var(--glass-border)';
    img.style.padding = buddy ? '0' : '8px';
  }

  if (hint) {
    hint.innerHTML = buddy
      ? `Your Fluxy shows up in chat corners.`
      : `No Fluxy yet — using your profile picture.<br/><span style="font-size:11px;">Tap Customize to create one.</span>`;
  }

  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => showFluxyStudio(profile));
  }
}

function showFluxyStudio(profile) {
  const existing = document.getElementById('fluxy-studio-overlay');
  if (existing) existing.remove();

  const start = normalizeFluxBuddy(profile?.fluxBuddy || FLUX_BUDDY_DEFAULT);
  const FACES = [
    { id: 'neutral', label: 'Neutral' }, { id: 'smile', label: 'Smile' }, { id: 'grin', label: 'Grin' },
    { id: 'sad', label: 'Sad' }, { id: 'angry', label: 'Angry' }, { id: 'surprised', label: 'Surprised' },
    { id: 'sleepy', label: 'Sleepy' }, { id: 'wink', label: 'Wink' }, { id: 'cool', label: 'Cool' },
    { id: 'blush', label: 'Blush' }, { id: 'love', label: 'Love' }, { id: 'dead', label: 'Dead' },
  ];

  const overlay = document.createElement('div');
  overlay.id = 'fluxy-studio-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(10px);';
  overlay.innerHTML = `
    <style>
      @keyframes fluxyFloat { 0%,100%{transform:translateY(0) rotate(-0.6deg)} 50%{transform:translateY(-8px) rotate(0.6deg)} }
      @media (max-width: 860px) { #fluxy-grid { grid-template-columns: 1fr !important; } #fluxy-right { border-left: none !important; border-top: 1px solid var(--glass-border) !important; } }
      @media (max-width: 560px) { #fluxy-faces { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
    </style>
    <div style="width:min(980px, calc(100vw - 24px));max-height:88vh;background:var(--panel);border-radius:24px;border:1px solid var(--glass-border);box-shadow:0 30px 90px rgba(0,0,0,0.28);overflow:hidden;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--glass-border);gap:12px;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text);letter-spacing:1px;">Fluxy</div>
          <span style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:9px;font-weight:900;padding:2px 7px;border-radius:20px;letter-spacing:0.8px;text-transform:uppercase;">Beta</span>
        </div>
        <button id="fluxy-close" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;">✕</button>
      </div>

      <div id="fluxy-grid" style="display:grid;grid-template-columns:420px 1fr;min-height:0;flex:1;">
        <div style="padding:18px;min-height:0;display:flex;flex-direction:column;gap:12px;">
          <div style="flex:1;min-height:340px;border-radius:18px;border:1px solid var(--glass-border);background:
              radial-gradient(220px 140px at 50% 18%, rgba(58,125,255,0.22), rgba(0,0,0,0) 70%),
              url('assets/room.png') center bottom / cover no-repeat,
              var(--bg);
              display:flex;align-items:flex-end;justify-content:center;position:relative;overflow:hidden;padding-bottom:14px;">
            <div style="position:absolute;left:18px;right:18px;bottom:14px;height:28px;border-radius:999px;background:rgba(0,0,0,0.06);border:1px solid var(--glass-border);"></div>
            <img id="fluxy-preview" alt="Fluxy preview" style="width:260px;height:auto;transform-origin:50% 100%;animation:fluxyFloat 2.9s ease-in-out infinite;filter:drop-shadow(0 14px 24px rgba(0,0,0,0.12));">
          </div>
          <div style="text-align:center;color:var(--muted);font-size:12px;line-height:1.35;">
            Fluxy appears in chat corners (watching/typing/stickers).<br/>Arms & legs auto-darken from your body color.
          </div>
        </div>

        <div id="fluxy-right" style="padding:18px;border-left:1px solid var(--glass-border);overflow:auto;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;">
            <div style="display:flex;flex-direction:column;gap:2px;">
              <div style="font-size:12px;font-weight:900;color:var(--text);">Body Color</div>
              <div style="font-size:11px;color:var(--muted);">Pick a color — limbs shade automatically</div>
            </div>
            <input id="fluxy-body" type="color" value="${start.body}" style="width:46px;height:36px;border-radius:12px;border:1px solid var(--glass-border);background:transparent;padding:2px;cursor:pointer;flex-shrink:0;">
          </div>

          <div style="font-size:12px;font-weight:900;color:var(--text);margin:10px 0 8px;">Face</div>
          <div id="fluxy-faces" style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:10px;"></div>

          <div style="display:flex;gap:10px;margin-top:16px;">
            <button id="fluxy-reset" style="flex:1;padding:11px 12px;border:1px solid var(--glass-border);border-radius:12px;background:transparent;color:var(--text);font-weight:900;cursor:pointer;">Reset</button>
            <button id="fluxy-save" style="flex:1;padding:11px 12px;border:none;border-radius:12px;background:var(--accent);color:white;font-weight:900;cursor:pointer;">Save Fluxy</button>
          </div>
          <div id="fluxy-error" style="display:none;margin-top:10px;color:#ef4444;font-size:12px;font-weight:800;text-align:center;"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#fluxy-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const els = {
    preview: overlay.querySelector('#fluxy-preview'),
    body: overlay.querySelector('#fluxy-body'),
    faces: overlay.querySelector('#fluxy-faces'),
    reset: overlay.querySelector('#fluxy-reset'),
    save: overlay.querySelector('#fluxy-save'),
    err: overlay.querySelector('#fluxy-error'),
  };

  let selectedFace = start.face;

  const read = () => normalizeFluxBuddy({ body: els.body.value, face: selectedFace });

  const render = () => {
    const cur = read();
    if (els.preview) els.preview.src = buildFluxBuddyDataUrl(cur, 'full');
    if (els.faces) {
      els.faces.innerHTML = FACES.map(f => {
        const on = f.id === cur.face;
        const iconSrc = buildFluxBuddyDataUrl({ body: cur.body, face: f.id }, 'icon');
        return `
          <button type="button" data-face="${f.id}" title="${escapeHtml(f.label)}"
            style="border-radius:14px;border:2px solid ${on ? 'var(--accent)' : 'var(--glass-border)'};background:${on ? 'rgba(58,125,255,0.10)' : 'rgba(0,0,0,0.02)'};cursor:pointer;padding:8px;display:flex;flex-direction:column;align-items:center;gap:6px;">
            <img src="${iconSrc}" alt="${escapeHtml(f.label)}" style="width:40px;height:40px;object-fit:contain;display:block;">
            <span style="font-size:10px;font-weight:900;color:${on ? 'var(--accent)' : 'var(--muted)'};white-space:nowrap;">${escapeHtml(f.label)}</span>
          </button>
        `;
      }).join('');
    }
  };

  render();
  els.body?.addEventListener('input', render);
  els.faces?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button[data-face]');
    if (!btn) return;
    selectedFace = btn.dataset.face || selectedFace;
    render();
  });
  els.reset?.addEventListener('click', () => {
    selectedFace = FLUX_BUDDY_DEFAULT.face;
    if (els.body) els.body.value = FLUX_BUDDY_DEFAULT.body;
    render();
  });
  els.save?.addEventListener('click', async () => {
    if (!_currentProfile) return;
    if (els.err) els.err.style.display = 'none';
    const prev = els.save.textContent;
    els.save.textContent = 'Saving…';
    els.save.disabled = true;
    try {
      const buddy = read();
      await updateProfile(_currentProfile.uid, { fluxBuddy: buddy, fluxBuddyUpdatedAt: new Date().toISOString() });
      _currentProfile.fluxBuddy = buddy;
      initFluxyRoom(_currentProfile);
      close();
    } catch (e) {
      if (els.err) { els.err.textContent = 'Could not save Fluxy.'; els.err.style.display = 'block'; }
      console.warn('Fluxy save failed:', e);
      els.save.textContent = prev;
      els.save.disabled = false;
    }
  });
}

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

  // GIF button
  document.getElementById('global-gif-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    showGlobalGifPicker();
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
    ? `<img class="chat-msg-avatar" src="${msg.avatarURL}" style="width:28px;height:28px;border-radius:8px;object-fit:cover;margin-${isOwn?'left':'right'}:8px;flex-shrink:0;">`
    : `<div class="chat-msg-avatar-placeholder" style="width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;margin-${isOwn?'left':'right'}:8px;flex-shrink:0;">${(msg.displayName || msg.username || '?')[0].toUpperCase()}</div>`;

  // Use baked-in badges for instant render
  const badgesHTML = renderBadges(msg.badges || [], msg.roles || []);

  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.dataset.id = msg.id;
  div.dataset.uid = msg.uid;
  div.style.cssText = `display:flex;align-items:flex-end;margin-bottom:12px;flex-direction:${isOwn?'row-reverse':'row'}`;
  
  const isGif = msg.type === 'gif';
  const msgContent = isGif
    ? `<img src="${msg.text}" alt="GIF" style="max-width:180px;border-radius:10px;display:block;">`
    : `<div class="chat-msg-text" style="font-size:13px;line-height:1.4;word-break:break-word;">${escapeHtml(msg.text)}</div>`;

  const bubbleStyle = isGif
    ? 'padding:0;background:transparent;border:none;border-radius:18px;position:relative;'
    : isOwn
      ? 'padding:10px 14px;border-radius:18px;border-bottom-right-radius:4px;position:relative;background:var(--accent);color:white;'
      : 'padding:10px 14px;border-radius:18px;border-bottom-left-radius:4px;position:relative;background:var(--panel);color:var(--text);border:1px solid var(--glass-border);';

  div.innerHTML = `
    ${avatarHTML}
    <div class="chat-msg-body" style="max-width:55%;position:relative;">
      <div class="chat-msg-meta" style="display:flex;align-items:center;gap:6px;margin-bottom:2px;${isOwn?'flex-direction:row-reverse;':''}">
        <a class="chat-msg-name" href="profile.html?user=${msg.username}" style="font-size:11px;font-weight:700;color:var(--text);text-decoration:none;">@${msg.username}</a>
        <span class="msg-badges">${badgesHTML}</span>
        <span class="chat-msg-time" style="font-size:9px;color:var(--muted);">${time}</span>
      </div>
      <div class="msg-playing"></div>
      <div class="chat-msg-bubble" style="${bubbleStyle}">
        ${msgContent}
        <div class="msg-actions" style="position:absolute;top:-24px;${isOwn?'right:0;':'left:0;'}display:none;gap:4px;background:var(--panel);padding:2px 6px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid var(--glass-border);z-index:10;">
          <button class="msg-report" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;" title="Report">🚩</button>
          ${(isAdmin || isOwn) ? `<button class="chat-msg-delete" style="background:none;border:none;cursor:pointer;font-size:10px;padding:2px;" title="Delete">🗑️</button>` : ''}
        </div>
      </div>
    </div>
  `;

  div.addEventListener('mouseenter', () => div.querySelector('.msg-actions').style.display = 'flex');
  div.addEventListener('mouseleave', () => div.querySelector('.msg-actions').style.display = 'none');

  div.querySelector('.msg-report')?.addEventListener('click', async () => {
    const reason = prompt('Why are you reporting this user?');
    if (reason) {
      await reportUser(msg.uid, reason, `Social Chat Context: ${msg.text} (Msg: ${msg.id})`);
      alert('Report sent to moderators.');
      div.style.opacity = '0.4';
    }
  });

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
      type: 'text',
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

async function sendGifToChat(url, name) {
  if (!_currentProfile) return;
  try {
    const freshProfile = await getProfile(auth.currentUser.uid) || _currentProfile;
    if (freshProfile.isBanned) return;
    await addDoc(collection(db, 'chat'), {
      uid: auth.currentUser.uid,
      username: freshProfile.username,
      displayName: freshProfile.displayName,
      avatarURL: freshProfile.avatarURL || '',
      badges: freshProfile.badges || [],
      roles: freshProfile.roles || [],
      text: url,
      stickerName: name || '',
      type: 'gif',
      sentAt: serverTimestamp(),
    });
  } catch (e) { console.warn('GIF send failed:', e); }
}

function showGlobalGifPicker() {
  const existing = document.getElementById('global-gif-picker');
  if (existing) { existing.remove(); return; }

  const picker = document.createElement('div');
  picker.id = 'global-gif-picker';
  picker.style.cssText = 'position:absolute;bottom:60px;left:0;right:0;z-index:600;background:var(--panel);border-radius:16px 16px 0 0;padding:14px;box-shadow:0 -4px 30px rgba(0,0,0,0.15);border-top:1px solid var(--glass-border);max-height:280px;display:flex;flex-direction:column;';
  picker.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">
      <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--text);">🎬 Stickers <span style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:9px;font-weight:800;padding:2px 7px;border-radius:20px;letter-spacing:0.8px;text-transform:uppercase;vertical-align:middle;">Beta</span></span>
      <button id="global-gif-close" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0;">✕</button>
    </div>
    <input id="global-gif-search" type="text" placeholder="Search stickers..." style="width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg);color:var(--text);font-size:13px;outline:none;box-sizing:border-box;margin-bottom:10px;font-family:inherit;flex-shrink:0;">
    <div id="global-gif-results" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;overflow-y:auto;flex:1;"></div>
  `;

  const inputWrap = document.querySelector('.chat-input-wrap');
  if (inputWrap) {
    inputWrap.style.position = 'relative';
    inputWrap.appendChild(picker);
  } else {
    document.body.appendChild(picker);
  }

  picker.querySelector('#global-gif-close').addEventListener('click', () => picker.remove());

  let _allStickers = [];

  const renderStickers = (list) => {
    const results = picker.querySelector('#global-gif-results');
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
        picker.remove();
        await sendGifToChat(s.url, s.name);
      });
      results.appendChild(img);
    });
  };

  const loadStickers = async () => {
    const results = picker.querySelector('#global-gif-results');
    results.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:16px;color:var(--muted);font-size:12px;">Loading stickers...</div>';
    try {
      const resp = await fetch(`GIFs/manifest.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) throw new Error('No manifest');
      _allStickers = await resp.json();
      renderStickers(_allStickers);
    } catch {
      // Fallback: try to auto-discover common filenames
      results.innerHTML = '<div style="grid-column:1/-1;padding:12px;font-size:12px;color:var(--muted);text-align:center;">No stickers yet.<br><span style="font-size:10px;">Create a <strong>GIFs/manifest.json</strong> file.</span></div>';
    }
  };

  picker.querySelector('#global-gif-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    renderStickers(q ? _allStickers.filter(s => s.name.toLowerCase().includes(q)) : _allStickers);
  });

  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!picker.contains(e.target) && e.target.id !== 'global-gif-btn') {
        picker.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 50);

  loadStickers();
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
    document.getElementById('search-results').innerHTML = '<div class="search-empty"><img src="assets/loading.gif" style="width:40px;height:auto;opacity:0.6;"></div>';
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

  card.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;text-align:center;"><div style="display:flex;justify-content:center;padding:20px;"><img src="assets/loading.gif" style="width:80px;height:auto;" alt="Loading..."></div></div>';

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


setTimeout(() => { if(window.hideGlobalLoader) window.hideGlobalLoader(); }, 600);
