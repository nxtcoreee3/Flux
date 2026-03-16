/* firebase-auth.js
   Handles Firebase Authentication + Firestore favorites + Live visitor counter + Stats button
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getDatabase,
  ref,
  onValue,
  onDisconnect,
  set,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHm6nxHzrIGHmWb1W_xDAYwnSoed6oTi4",
  authDomain: "fluxbynxtcoreee3.firebaseapp.com",
  projectId: "fluxbynxtcoreee3",
  storageBucket: "fluxbynxtcoreee3.firebasestorage.app",
  messagingSenderId: "1003023583985",
  appId: "1:1003023583985:web:58cec1087f433e2af97750",
  databaseURL: "https://fluxbynxtcoreee3-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

/* ===================== LIVE PRESENCE ===================== */
let _onlineCount = 0;

async function updatePeakOnline(count) {
  try {
    const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const peakRef = doc(db, 'stats', 'peak');
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(peakRef);
      const current = snap.exists() ? (snap.data().count || 0) : 0;
      if (count > current) {
        tx.set(peakRef, { count, date: new Date().toISOString() });
      }
    });
  } catch (e) { console.warn('Could not update peak:', e); }
}

export async function fetchPeakOnline() {
  try {
    const snap = await getDoc(doc(db, 'stats', 'peak'));
    if (snap.exists()) return snap.data().count;
    return '—';
  } catch { return '—'; }
}

export function initPresence() {
  const sessionId = Math.random().toString(36).slice(2);
  const presenceRef = ref(rtdb, `presence/${sessionId}`);
  const connectedRef = ref(rtdb, '.info/connected');

  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      set(presenceRef, { online: true, timestamp: serverTimestamp() });
      onDisconnect(presenceRef).remove();
    }
  });

  onValue(ref(rtdb, 'presence'), (snap) => {
    _onlineCount = snap.exists() ? Object.keys(snap.val()).length : 0;
    // update stats dropdown if open
    const el = document.getElementById('stats-online-count');
    if (el) el.textContent = _onlineCount;
    // update the eye button count
    const badge = document.getElementById('stats-btn-count');
    if (badge) badge.textContent = _onlineCount;
    // check and update peak
    if (_onlineCount > 0) updatePeakOnline(_onlineCount);
  });
}

/* ===================== GLOBAL FAV COUNT ===================== */
async function fetchGlobalFavCount() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    let total = 0;
    snap.forEach(d => {
      const favs = d.data().favorites || [];
      total += favs.length;
    });
    return total;
  } catch { return '—'; }
}

/* ===================== DAILY VISITOR TRACKING ===================== */
function getSwedishDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }); // "YYYY-MM-DD"
}

// Stores a flag in localStorage so each device is only counted once per day.
export async function trackDailyVisitor() {
  const today = getSwedishDate();
  const storageKey = `flux_visited_${today}`;
  if (localStorage.getItem(storageKey)) return; // already counted today on this device

  try {
    const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const visitorRef = doc(db, 'stats', 'visitors');

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(visitorRef);
      if (snap.exists() && snap.data().date === today) {
        // Same day — atomically increment so concurrent visitors don't overwrite each other
        tx.update(visitorRef, { count: increment(1) });
      } else {
        // New day (or first ever) — reset to 1
        tx.set(visitorRef, { date: today, count: 1 });
      }
    });

    localStorage.setItem(storageKey, '1');
  } catch (e) { console.warn('Could not track visitor:', e); }
}

async function fetchVisitorsToday() {
  try {
    const today = getSwedishDate();
    const snap = await getDoc(doc(db, 'stats', 'visitors'));
    if (snap.exists() && snap.data().date === today) return snap.data().count;
    return 0;
  } catch { return '—'; }
}

/* ===================== STATS BUTTON ===================== */
export function initStatsButton() {
  const rightActions = document.querySelector('.right-actions');
  if (!rightActions) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;display:flex;align-items:center;';

  wrapper.innerHTML = `
    <button id="stats-btn" class="icon-btn" title="Live stats" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:8px 12px;">
      <span style="font-size:15px;">👁️</span>
      <span id="stats-btn-count" style="font-size:13px;font-weight:700;color:var(--accent);">—</span>
    </button>

    <div id="stats-dropdown" style="
      display:none;position:absolute;top:calc(100% + 10px);right:0;
      background:var(--panel);border-radius:14px;
      box-shadow:0 20px 60px rgba(0,0,0,0.15);
      border:1px solid var(--glass-border);width:240px;z-index:300;overflow:hidden;
    ">
      <!-- header -->
      <div style="padding:14px 16px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">📊</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--text);">Flux Stats</span>
      </div>

      <!-- online now -->
      <div style="padding:14px 16px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(34,197,94,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;">👥</div>
        <div style="flex:1;">
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Online right now</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse-dot 2s infinite;"></span>
            <span id="stats-online-count" style="font-size:20px;font-weight:700;color:var(--text);">—</span>
            <span style="font-size:12px;color:var(--muted);">people</span>
          </div>
          <div id="stats-peak-row" style="margin-top:4px;font-size:11px;color:var(--muted);cursor:pointer;display:none;" title="All-time peak concurrent users">
            🏆 Peak: <span id="stats-peak-count" style="font-weight:700;color:var(--text);">—</span>
          </div>
        </div>
      </div>

      <!-- visitors today -->
      <div style="padding:14px 16px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(168,85,247,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;">📅</div>
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Visitors today</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span id="stats-visitors-today" style="font-size:20px;font-weight:700;color:var(--text);">—</span>
            <span style="font-size:12px;color:var(--muted);">people</span>
          </div>
        </div>
      </div>

      <!-- total favourites -->
      <div style="padding:14px 16px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,209,102,0.15);display:flex;align-items:center;justify-content:center;font-size:16px;">★</div>
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Total favourites</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span id="stats-fav-count" style="font-size:20px;font-weight:700;color:var(--text);">—</span>
            <span style="font-size:12px;color:var(--muted);">across all users</span>
          </div>
        </div>
      </div>

      <!-- total games -->
      <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:rgba(58,125,255,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;">🎮</div>
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">Games available</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
            <span id="stats-game-count" style="font-size:20px;font-weight:700;color:var(--text);">—</span>
            <span style="font-size:12px;color:var(--muted);">games</span>
          </div>
        </div>
      </div>
    </div>
  `;

  rightActions.prepend(wrapper);

  const btn = wrapper.querySelector('#stats-btn');
  const dd = wrapper.querySelector('#stats-dropdown');

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';

    if (!isOpen) {
      // fill in live data when opening
      document.getElementById('stats-online-count').textContent = _onlineCount;
      document.getElementById('stats-btn-count').textContent = _onlineCount;

      // fetch global fav count
      document.getElementById('stats-fav-count').textContent = '…';
      const favCount = await fetchGlobalFavCount();
      document.getElementById('stats-fav-count').textContent = favCount;

      // fetch visitors today
      document.getElementById('stats-visitors-today').textContent = '…';
      const visitorsToday = await fetchVisitorsToday();
      document.getElementById('stats-visitors-today').textContent = visitorsToday;

      // fetch peak online and show it
      const peak = await fetchPeakOnline();
      const peakCount = document.getElementById('stats-peak-count');
      const peakRow = document.getElementById('stats-peak-row');
      if (peakCount) peakCount.textContent = peak;
      if (peakRow) peakRow.style.display = 'block';

      // game count from GAMES array (passed via window)
      const gameCount = window._FLUX_GAME_COUNT || '—';
      document.getElementById('stats-game-count').textContent = gameCount;
    }
  });

  document.addEventListener('click', () => { dd.style.display = 'none'; });
}

/* ===================== AUTH ===================== */
export function signInWithGoogle() { return signInWithPopup(auth, googleProvider); }
export function signInAsGuest() { return signInAnonymously(auth); }
export function signInWithEmail(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export function registerWithEmail(email, password) { return createUserWithEmailAndPassword(auth, email, password); }
export function logOut() { return signOut(auth); }
export function onAuthChange(callback) { onAuthStateChanged(auth, callback); }
export function getCurrentUser() { return auth.currentUser; }

/* ===================== FIRESTORE FAVORITES ===================== */
export async function loadCloudFavs() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return snap.exists() ? snap.data().favorites || [] : [];
  } catch { return null; }
}

export async function saveCloudFavs(favs) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    await setDoc(doc(db, 'users', user.uid), { favorites: favs }, { merge: true });
  } catch (e) { console.warn('Could not save favorites:', e); }
}

/* ===================== AUTH UI ===================== */
export function initAuthUI(onUserChange) {
  const rightActions = document.querySelector('.right-actions');
  if (!rightActions) return;

  const authBtn = document.createElement('button');
  authBtn.id = 'auth-btn';
  authBtn.className = 'icon-btn';
  authBtn.textContent = 'Sign In';
  authBtn.style.cursor = 'pointer';
  rightActions.prepend(authBtn);

  const userDisplay = document.createElement('div');
  userDisplay.id = 'user-display';
  userDisplay.style.cssText = 'display:none;align-items:center;gap:8px;position:relative;cursor:pointer;';
  userDisplay.innerHTML = `
    <img id="user-avatar" src="" alt="avatar" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:1px solid rgba(0,0,0,0.1);display:none;">
    <span id="user-name" style="font-size:13px;font-weight:600;color:#111827;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
    <span style="color:#6b7280;font-size:11px;">▾</span>
    <div id="profile-dropdown" style="display:none;position:absolute;top:calc(100% + 10px);right:0;background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.15);border:1px solid rgba(0,0,0,0.07);width:260px;z-index:300;overflow:hidden;">
      <div style="padding:16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:12px;">
        <img id="profile-avatar-large" src="" alt="avatar" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:1px solid rgba(0,0,0,0.08);display:none;flex-shrink:0;">
        <div id="profile-avatar-placeholder" style="width:44px;height:44px;border-radius:50%;background:#3a7dff;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px;flex-shrink:0;">?</div>
        <div style="overflow:hidden;">
          <div id="profile-display-name" style="font-weight:700;font-size:14px;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
          <div id="profile-email" style="font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
        </div>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">★</span>
        <span id="profile-fav-count" style="font-size:13px;color:#111827;font-weight:600;">0 favourited games</span>
      </div>
      <button id="change-password-btn" style="width:100%;padding:12px 16px;background:none;border:none;border-bottom:1px solid rgba(0,0,0,0.06);text-align:left;cursor:pointer;font-size:13px;color:#111827;display:flex;align-items:center;gap:10px;">
        <span>🔑</span> Change Password
      </button>
      <a href="info.html" style="display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:13px;color:#111827;text-decoration:none;border-bottom:1px solid rgba(0,0,0,0.06);">
        <span>🔒</span> Privacy Policy
      </a>
      <button id="sign-out-btn" style="width:100%;padding:12px 16px;background:none;border:none;text-align:left;cursor:pointer;font-size:13px;color:#ef4444;display:flex;align-items:center;gap:10px;">
        <span>🚪</span> Sign Out
      </button>
    </div>
  `;
  rightActions.prepend(userDisplay);

  const pwModal = document.createElement('div');
  pwModal.id = 'pw-modal';
  pwModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:400;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);';
  pwModal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:340px;box-shadow:0 30px 80px rgba(0,0,0,0.15);position:relative;">
      <button id="pw-modal-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#6b7280;">✕</button>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:24px;margin:0 0 16px;color:#111827;">Change Password</h3>
      <input id="pw-new" type="password" placeholder="New password" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:14px;margin-bottom:8px;box-sizing:border-box;outline:none;">
      <input id="pw-confirm" type="password" placeholder="Confirm new password" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:14px;margin-bottom:12px;box-sizing:border-box;outline:none;">
      <button id="pw-save-btn" style="width:100%;padding:10px;background:#3a7dff;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">Save Password</button>
      <p id="pw-msg" style="font-size:12px;margin:8px 0 0;text-align:center;display:none;"></p>
    </div>
  `;
  document.body.appendChild(pwModal);

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:200;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);backdrop-filter:blur(4px);';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;width:100%;max-width:380px;box-shadow:0 30px 80px rgba(0,0,0,0.15);position:relative;">
      <button id="auth-modal-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#6b7280;">✕</button>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:28px;margin:0 0 6px;color:#111827;">Welcome to Flux</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">Sign in to save your favorites across devices.</p>
      <button id="google-signin-btn" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;background:#fff;cursor:pointer;font-weight:600;font-size:14px;margin-bottom:12px;">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Continue with Google
      </button>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="flex:1;height:1px;background:rgba(0,0,0,0.08);"></div>
        <span style="color:#6b7280;font-size:12px;">or</span>
        <div style="flex:1;height:1px;background:rgba(0,0,0,0.08);"></div>
      </div>
      <input id="auth-email" type="email" placeholder="Email" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:14px;margin-bottom:8px;box-sizing:border-box;outline:none;">
      <input id="auth-password" type="password" placeholder="Password" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:14px;margin-bottom:12px;box-sizing:border-box;outline:none;">
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button id="email-signin-btn" style="flex:1;padding:10px;background:#3a7dff;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">Sign In</button>
        <button id="email-register-btn" style="flex:1;padding:10px;background:transparent;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;color:#6b7280;">Register</button>
      </div>
      <button id="guest-signin-btn" style="width:100%;padding:10px;background:transparent;border:none;color:#6b7280;font-size:13px;cursor:pointer;text-decoration:underline;">Continue as guest</button>
      <p id="auth-error" style="color:#ef4444;font-size:12px;margin:8px 0 0;text-align:center;display:none;"></p>
    </div>
  `;
  document.body.appendChild(modal);

  authBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
  document.getElementById('auth-modal-close').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('google-signin-btn').addEventListener('click', async () => {
    try { await signInWithGoogle(); modal.style.display = 'none'; }
    catch (err) { showAuthError(err.message); }
  });
  document.getElementById('email-signin-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try { await signInWithEmail(email, password); modal.style.display = 'none'; }
    catch (err) { showAuthError(err.message); }
  });
  document.getElementById('email-register-btn').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try { await registerWithEmail(email, password); modal.style.display = 'none'; }
    catch (err) { showAuthError(err.message); }
  });
  document.getElementById('guest-signin-btn').addEventListener('click', async () => {
    try { await signInAsGuest(); modal.style.display = 'none'; }
    catch (err) { showAuthError(err.message); }
  });
  document.getElementById('sign-out-btn').addEventListener('click', async () => {
    await logOut();
    document.getElementById('profile-dropdown').style.display = 'none';
  });

  userDisplay.addEventListener('click', (e) => {
    const dd = document.getElementById('profile-dropdown');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    e.stopPropagation();
  });
  document.addEventListener('click', () => {
    const dd = document.getElementById('profile-dropdown');
    if (dd) dd.style.display = 'none';
  });

  document.getElementById('change-password-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('profile-dropdown').style.display = 'none';
    pwModal.style.display = 'flex';
  });
  document.getElementById('pw-modal-close').addEventListener('click', () => { pwModal.style.display = 'none'; });
  pwModal.addEventListener('click', (e) => { if (e.target === pwModal) pwModal.style.display = 'none'; });

  document.getElementById('pw-save-btn').addEventListener('click', async () => {
    const { updatePassword } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const newPw = document.getElementById('pw-new').value;
    const confirmPw = document.getElementById('pw-confirm').value;
    const msg = document.getElementById('pw-msg');
    msg.style.display = 'block';
    if (newPw !== confirmPw) { msg.style.color = '#ef4444'; msg.textContent = 'Passwords do not match.'; return; }
    if (newPw.length < 6) { msg.style.color = '#ef4444'; msg.textContent = 'Password must be at least 6 characters.'; return; }
    try {
      await updatePassword(auth.currentUser, newPw);
      msg.style.color = '#22c55e'; msg.textContent = 'Password updated!';
      setTimeout(() => { pwModal.style.display = 'none'; msg.style.display = 'none'; }, 1500);
    } catch (err) {
      msg.style.color = '#ef4444';
      msg.textContent = err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim();
    }
  });

  function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim();
    el.style.display = 'block';
  }

  onAuthChange(async (user) => {
    if (user) {
      authBtn.style.display = 'none';
      userDisplay.style.display = 'flex';
      const avatar = document.getElementById('user-avatar');
      const name = document.getElementById('user-name');
      const profileName = document.getElementById('profile-display-name');
      const profileEmail = document.getElementById('profile-email');
      const profileAvatarLarge = document.getElementById('profile-avatar-large');
      const profilePlaceholder = document.getElementById('profile-avatar-placeholder');

      if (user.isAnonymous) {
        name.textContent = 'Guest';
        avatar.style.display = 'none';
        profileName.textContent = 'Guest';
        profileEmail.textContent = 'Anonymous session';
        profilePlaceholder.textContent = '?';
        profileAvatarLarge.style.display = 'none';
        profilePlaceholder.style.display = 'flex';
        document.getElementById('change-password-btn').style.display = 'none';
      } else {
        const displayName = user.displayName || user.email;
        name.textContent = displayName;
        profileName.textContent = displayName;
        profileEmail.innerHTML = '';
        if (user.email) {
          const [local, domain] = user.email.split('@');
          profileEmail.innerHTML = `<span id="email-local" style="filter:blur(4px);transition:filter 0.2s;cursor:pointer;" title="Hover to reveal">${local}</span>@${domain}`;
          const localSpan = profileEmail.querySelector('#email-local');
          localSpan.addEventListener('mouseenter', () => localSpan.style.filter = 'none');
          localSpan.addEventListener('mouseleave', () => localSpan.style.filter = 'blur(4px)');
          localSpan.addEventListener('click', (e) => { e.stopPropagation(); localSpan.style.filter = localSpan.style.filter ? '' : 'blur(4px)'; });
        }
        profilePlaceholder.textContent = (user.displayName || user.email || '?')[0].toUpperCase();
        if (user.photoURL) {
          avatar.src = user.photoURL;
          avatar.style.display = 'block';
          profileAvatarLarge.src = user.photoURL;
          profileAvatarLarge.style.display = 'block';
          profilePlaceholder.style.display = 'none';
        } else {
          avatar.style.display = 'none';
          profileAvatarLarge.style.display = 'none';
          profilePlaceholder.style.display = 'flex';
        }
        document.getElementById('change-password-btn').style.display = 'flex';
      }
    } else {
      authBtn.style.display = '';
      userDisplay.style.display = 'none';
    }
    if (onUserChange) onUserChange(user);
  });
}
