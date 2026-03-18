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
    const snap = await getDoc(doc(db, 'stats', 'favourites'));
    return snap.exists() ? (snap.data().total || 0) : 0;
  } catch { return '—'; }
}

/* ===================== STREAK & POINTS ===================== */
export async function trackLoginStreak() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const today = getSwedishDate();
  const storageKey = `flux_streak_${today}`;
  if (localStorage.getItem(storageKey)) return; // already tracked today

  try {
    const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const profileRef = doc(db, 'profiles', user.uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(profileRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const lastLogin = data.lastLoginDate || '';
      const streak = data.loginStreak || 0;
      const points = data.points || 0;

      // Calculate yesterday in Swedish time
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });

      const newStreak = lastLogin === yesterdayStr ? streak + 1 : 1;
      // Points: 10 base + 2 per streak day (capped at 50 bonus)
      const streakBonus = Math.min((newStreak - 1) * 2, 50);
      const pointsEarned = 10 + streakBonus;

      tx.update(profileRef, {
        loginStreak: newStreak,
        longestStreak: Math.max(newStreak, data.longestStreak || 0),
        lastLoginDate: today,
        points: points + pointsEarned,
        totalPointsEarned: (data.totalPointsEarned || 0) + pointsEarned,
      });
    });
    localStorage.setItem(storageKey, '1');
  } catch (e) { console.warn('Streak tracking failed:', e); }
}

export async function trackTimeOnSite() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  const startTime = Date.now();
  const POINTS_PER_MINUTE = 1; // 1 point per minute, awarded every 5 minutes
  const INTERVAL = 5 * 60 * 1000; // 5 minutes

  const interval = setInterval(async () => {
    try {
      const minutesElapsed = 5;
      const pointsEarned = minutesElapsed * POINTS_PER_MINUTE;
      const profileRef = doc(db, 'profiles', user.uid);
      const snap = await getDoc(profileRef);
      if (!snap.exists()) { clearInterval(interval); return; }
      await updateDoc(profileRef, {
        points: (snap.data().points || 0) + pointsEarned,
        totalPointsEarned: (snap.data().totalPointsEarned || 0) + pointsEarned,
        timeOnSiteMinutes: (snap.data().timeOnSiteMinutes || 0) + minutesElapsed,
      });
    } catch {}
  }, INTERVAL);

  // Clear on page unload
  window.addEventListener('beforeunload', () => clearInterval(interval));
}

export async function giftPoints(targetUid, amount, reason = '') {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return { ok: false, error: 'Only the owner can gift points.' };
  if (!amount || amount <= 0) return { ok: false, error: 'Invalid amount.' };
  try {
    const profileRef = doc(db, 'profiles', targetUid);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) return { ok: false, error: 'Profile not found.' };
    await updateDoc(profileRef, {
      points: (snap.data().points || 0) + amount,
      totalPointsEarned: (snap.data().totalPointsEarned || 0) + amount,
    });
    await sendNotification(targetUid, {
      type: 'points',
      title: `You received ${amount} points! 🎁`,
      body: reason || 'Points gifted by the owner',
      link: 'profile.html',
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function fetchLeaderboard() {
  try {
    const { collection: col, query: q, orderBy: ob, limit: lim, getDocs: gd } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const [pointsSnap, streakSnap] = await Promise.all([
      gd(q(col(db, 'profiles'), ob('points', 'desc'), lim(10))),
      gd(q(col(db, 'profiles'), ob('loginStreak', 'desc'), lim(10))),
    ]);
    return {
      points: pointsSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
      streaks: streakSnap.docs.map(d => ({ uid: d.id, ...d.data() })),
    };
  } catch { return { points: [], streaks: [] }; }
}

/* ===================== GAME PLAY TRACKING ===================== */
export async function trackGamePlay(gameId, gameTitle) {
  try {
    const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const gameRef = doc(db, 'gamestats', gameId);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(gameRef);
      if (snap.exists()) {
        tx.update(gameRef, {
          plays: (snap.data().plays || 0) + 1,
          title: gameTitle,
          lastPlayed: new Date().toISOString(),
        });
      } else {
        tx.set(gameRef, {
          plays: 1,
          title: gameTitle,
          firstSeen: new Date().toISOString(),
          lastPlayed: new Date().toISOString(),
        });
      }
    });

    // Recalculate hot game
    await updateHotGame();
  } catch (e) { console.warn('Game tracking failed:', e); }
}

async function updateHotGame() {
  try {
    const { collection: col, query: q, orderBy: ob, limit: lim, getDocs: gd } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await gd(q(col(db, 'gamestats'), ob('plays', 'desc'), lim(1)));
    if (snap.empty) return;
    const hotGame = snap.docs[0];
    await setDoc(doc(db, 'stats', 'hotgame'), {
      id: hotGame.id,
      title: hotGame.data().title,
      plays: hotGame.data().plays,
      updatedAt: new Date().toISOString(),
    });
  } catch {}
}

export async function fetchHotGame() {
  try {
    const snap = await getDoc(doc(db, 'stats', 'hotgame'));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function fetchGameFirstSeen(gameId) {
  try {
    const snap = await getDoc(doc(db, 'gamestats', gameId));
    return snap.exists() ? snap.data().firstSeen : null;
  } catch { return null; }
}

export async function fetchAllGameStats() {
  try {
    const { collection: col, getDocs: gd } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await gd(col(db, 'gamestats'));
    const result = {};
    snap.docs.forEach(d => { result[d.id] = d.data(); });
    return result;
  } catch { return {}; }
}

export async function setGameCompatibility(gameId, gameTitle, compatibility) {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return { ok: false, error: 'Owner only.' };
  try {
    await setDoc(doc(db, 'gamestats', gameId), { compatibility, title: gameTitle }, { merge: true });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function rateGame(gameId, gameTitle, rating) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { ok: false, error: 'Sign in to rate.' };
  if (rating < 1 || rating > 5) return { ok: false, error: 'Rating must be 1-5.' };
  try {
    const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const gameRef = doc(db, 'gamestats', gameId);
    const userRatingRef = doc(db, 'gamestats', gameId, 'ratings', user.uid);

    await runTransaction(db, async (tx) => {
      const gameSnap = await tx.get(gameRef);
      const prevRatingSnap = await tx.get(userRatingRef);

      const prevRating = prevRatingSnap.exists() ? prevRatingSnap.data().rating : null;
      const currentTotal = gameSnap.exists() ? (gameSnap.data().ratingTotal || 0) : 0;
      const currentCount = gameSnap.exists() ? (gameSnap.data().ratingCount || 0) : 0;

      const newTotal = currentTotal - (prevRating || 0) + rating;
      const newCount = prevRating ? currentCount : currentCount + 1;

      tx.set(gameRef, { ratingTotal: newTotal, ratingCount: newCount, title: gameTitle }, { merge: true });
      tx.set(userRatingRef, { rating, uid: user.uid, ratedAt: new Date().toISOString() });
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function getUserRating(gameId) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  try {
    const snap = await getDoc(doc(db, 'gamestats', gameId, 'ratings', user.uid));
    return snap.exists() ? snap.data().rating : null;
  } catch { return null; }
}

export async function reportGame(gameId, gameTitle, reason) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { ok: false, error: 'Sign in to report.' };
  try {
    const { addDoc, collection: col } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await addDoc(col(db, 'gamereports'), {
      gameId, gameTitle, reason,
      reportedBy: user.uid,
      reportedAt: new Date().toISOString(),
      status: 'open',
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function fetchGameReports() {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return [];
  try {
    const { collection: col, query: q, where: w, getDocs: gd } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await gd(q(col(db, 'gamereports'), w('status', '==', 'open')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function dismissGameReport(reportId) {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return;
  try {
    await updateDoc(doc(db, 'gamereports', reportId), { status: 'dismissed' });
  } catch {}
}

/* ===================== CURRENTLY PLAYING ===================== */
export async function setCurrentlyPlaying(gameId, gameTitle) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    await updateDoc(doc(db, 'profiles', user.uid), {
      currentlyPlaying: { id: gameId, title: gameTitle, since: new Date().toISOString() }
    });
  } catch {}
}

export async function clearCurrentlyPlaying() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    await updateDoc(doc(db, 'profiles', user.uid), { currentlyPlaying: null });
  } catch {}
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
/* ===================== DARK MODE ===================== */
export function initDarkMode() {
  const DARK_KEY = 'flux_dark';
  const saved = localStorage.getItem(DARK_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const on = saved !== null ? saved === '1' : prefersDark;
  document.documentElement.classList.toggle('dark', on);

  const rightActions = document.querySelector('.right-actions');
  if (!rightActions) return;
  const btn = document.createElement('button');
  btn.id = 'dark-toggle';
  btn.className = 'icon-btn';
  btn.title = 'Toggle dark mode';
  btn.style.cursor = 'pointer';
  btn.textContent = on ? '☀️' : '🌙';
  btn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(DARK_KEY, isDark ? '1' : '0');
    btn.textContent = isDark ? '☀️' : '🌙';
  });
  rightActions.prepend(btn);
}

export function initStatsButton() {
  // Inject beta pulse keyframe globally for beta badges
  if (!document.getElementById('flux-beta-style')) {
    const s = document.createElement('style');
    s.id = 'flux-beta-style';
    s.textContent = `@keyframes beta-pulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.4);opacity:0} }`;
    document.head.appendChild(s);
  }
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
  // Wait up to 5s for auth to resolve
  const user = await new Promise((resolve) => {
    if (auth.currentUser !== null) { resolve(auth.currentUser); return; }
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
  });
  if (!user || user.isAnonymous) return null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    const favs = snap.data().favorites;
    return Array.isArray(favs) ? favs : null;
  } catch { return null; }
}

export async function syncProfileFavs(favs) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    const profileRef = doc(db, 'profiles', user.uid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      await updateDoc(profileRef, { favorites: favs });
    }
  } catch (e) { console.warn('Could not sync favs to profile:', e); }
}

export async function syncProfileRecents(recents) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    const profileRef = doc(db, 'profiles', user.uid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      await updateDoc(profileRef, { recentlyPlayed: recents });
    }
  } catch (e) { console.warn('Could not sync recents to profile:', e); }
}

export async function saveCloudFavs(favs) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    const { runTransaction } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const userRef = doc(db, 'users', user.uid);
    const profileRef = doc(db, 'profiles', user.uid);
    const statsRef = doc(db, 'stats', 'favourites');

    await runTransaction(db, async (tx) => {
      // ALL reads first
      const prevSnap = await tx.get(userRef);
      const profileSnap = await tx.get(profileRef);
      const statsSnap = await tx.get(statsRef);

      // Then all writes
      const prevCount = prevSnap.exists() ? (prevSnap.data().favorites || []).length : 0;
      const diff = favs.length - prevCount;

      tx.set(userRef, { favorites: favs }, { merge: true });

      if (profileSnap.exists()) {
        tx.set(profileRef, { favorites: favs }, { merge: true });
      }

      if (diff !== 0) {
        const currentTotal = statsSnap.exists() ? (statsSnap.data().total || 0) : 0;
        tx.set(statsRef, { total: Math.max(0, currentTotal + diff) });
      }
    });
  } catch (e) { console.warn('Could not save favorites:', e); }
}

/* ===================== PROFILE SYSTEM ===================== */
const OWNER_UID  = 'zEy6TO5ligf2um4rssIZs9C9X7f2';
const OWNER_USERNAME = 'nxtcoreee3';

export async function getProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'profiles', uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function getProfileByUsername(username) {
  try {
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const q = query(collection(db, 'profiles'), where('username', '==', username.toLowerCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { uid: snap.docs[0].id, ...snap.docs[0].data() };
  } catch { return null; }
}

export async function searchProfiles(term) {
  try {
    const { collection, query, where, orderBy, limit, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const t = term.toLowerCase();
    const q = query(collection(db, 'profiles'), where('username', '>=', t), where('username', '<=', t + '\uf8ff'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch { return []; }
}

export async function isUsernameTaken(username) {
  const p = await getProfileByUsername(username);
  return p !== null;
}

export async function createProfile({ uid, username, displayName, bio, isPrivate, avatarURL }) {
  const { collection, query, where, getDocs, serverTimestamp: fsTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const badges = uid === OWNER_UID ? ['owner', 'admin'] : [];

  // Pull existing favorites from users collection so they show on profile
  let existingFavs = [];
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) existingFavs = userSnap.data().favorites || [];
  } catch {}

  const profileData = {
    uid,
    username: username.toLowerCase(),
    displayName: displayName || username,
    bio: bio || '',
    isPrivate: isPrivate || false,
    avatarURL: avatarURL || '',
    badges,
    // New users follow the owner, owner doesn't follow them back
    followers: uid === OWNER_UID ? [] : [],
    following: uid === OWNER_UID ? [] : [OWNER_UID],
    favorites: existingFavs,
    joinedAt: new Date().toISOString(),
    isBanned: false,
  };
  await setDoc(doc(db, 'profiles', uid), profileData);

  // Add this user to owner's followers list (they follow owner, so owner gains a follower)
  if (uid !== OWNER_UID) {
    try {
      const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const ownerRef = doc(db, 'profiles', OWNER_UID);
      const ownerSnap = await getDoc(ownerRef);
      if (ownerSnap.exists()) {
        await updateDoc(ownerRef, { followers: arrayUnion(uid) });
      }
    } catch (e) { console.warn('Could not add to owner followers:', e); }
  }
  return profileData;
}

export async function updateProfile(uid, updates) {
  try {
    await updateDoc(doc(db, 'profiles', uid), updates);
  } catch (e) { console.warn('Profile update failed:', e); }
}

/* ===================== NOTIFICATIONS ===================== */
export async function sendNotification(targetUid, { type, title, body, link = '' }) {
  try {
    const { addDoc, collection: col } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await addDoc(col(db, 'notifications'), {
      uid: targetUid,
      type, title, body, link,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (e) { console.warn('Notification failed:', e); }
}

export function initNotifications() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  // Inject bell into nav
  const rightActions = document.querySelector('.right-actions');
  if (!rightActions || document.getElementById('notif-btn')) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;display:flex;align-items:center;';
  wrapper.innerHTML = `
    <button id="notif-btn" class="icon-btn" title="Notifications" style="cursor:pointer;position:relative;padding:8px 10px;font-size:16px;">
      🔔
      <span id="notif-badge" style="display:none;position:absolute;top:4px;right:4px;background:#ef4444;color:white;font-size:9px;font-weight:800;padding:1px 4px;border-radius:20px;min-width:14px;text-align:center;line-height:14px;">0</span>
    </button>
    <div id="notif-dropdown" style="display:none;position:absolute;top:calc(100% + 10px);right:0;background:var(--panel);border:1px solid var(--glass-border);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15);width:300px;z-index:300;overflow:hidden;">
      <div style="padding:14px 16px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;justify-content:space-between;">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--text);">🔔 Notifications</span>
        <button id="notif-mark-all" style="background:none;border:none;font-size:11px;color:var(--accent);cursor:pointer;font-weight:700;">Mark all read</button>
      </div>
      <div id="notif-list" style="max-height:340px;overflow-y:auto;"></div>
    </div>
  `;
  rightActions.prepend(wrapper);

  const btn = wrapper.querySelector('#notif-btn');
  const dd = wrapper.querySelector('#notif-dropdown');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) loadNotifications(user.uid);
  });
  document.addEventListener('click', () => { dd.style.display = 'none'; });

  document.getElementById('notif-mark-all').addEventListener('click', async (e) => {
    e.stopPropagation();
    await markAllNotificationsRead(user.uid);
    document.getElementById('notif-badge').style.display = 'none';
    loadNotifications(user.uid);
  });

  // Listen for unread count
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ collection: col, query: q, where: w, onSnapshot: ons }) => {
    const unreadQ = q(col(db, 'notifications'), w('uid', '==', user.uid), w('read', '==', false));
    ons(unreadQ, (snap) => {
      const badge = document.getElementById('notif-badge');
      if (!badge) return;
      if (snap.size > 0) {
        badge.textContent = snap.size > 9 ? '9+' : snap.size;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    });
  });
}

async function loadNotifications(uid) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px;">Loading...</div>';

  try {
    const { collection: col, query: q, where: w, limit: lim, getDocs: gd } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await gd(q(col(db, 'notifications'), w('uid', '==', uid), lim(20)));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!docs.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">No notifications yet</div>';
      return;
    }

    list.innerHTML = '';
    docs.forEach(n => {
      const icons = { follow: '👤', message: '💬', points: '⭐', system: '📣', report: '⚠️' };
      const timeAgo = getTimeAgo(n.createdAt);
      const item = document.createElement(n.link ? 'a' : 'div');
      if (n.link) { item.href = n.link; item.style.textDecoration = 'none'; }
      item.style.cssText = `display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--glass-border);cursor:pointer;transition:background 0.1s;${!n.read ? 'background:rgba(58,125,255,0.05);' : ''}`;
      item.innerHTML = `
        <span style="font-size:20px;flex-shrink:0;margin-top:2px;">${icons[n.type] || '🔔'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:${n.read ? '500' : '700'};color:var(--text);">${n.title}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${n.body}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px;">${timeAgo}</div>
        </div>
        ${!n.read ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></span>' : ''}
      `;
      item.addEventListener('mouseenter', () => item.style.background = 'var(--bg)');
      item.addEventListener('mouseleave', () => item.style.background = n.read ? '' : 'rgba(58,125,255,0.05)');
      // Mark as read on click
      item.addEventListener('click', async () => {
        if (!n.read) await updateDoc(doc(db, 'notifications', n.id), { read: true });
      });
      list.appendChild(item);
    });
    // Remove last border
    list.lastChild?.style.setProperty('border-bottom', 'none');
  } catch (e) { list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px;">Failed to load</div>'; }
}

async function markAllNotificationsRead(uid) {
  try {
    const { collection: col, query: q, where: w, getDocs: gd, writeBatch: wb } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const snap = await gd(q(col(db, 'notifications'), w('uid', '==', uid), w('read', '==', false)));
    const batch = wb(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch {}
}

function getTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ===================== AUTO TEXT CONTRAST ===================== */
export function getContrastColor(hexColor) {
  try {
    const hex = (hexColor || '#3a7dff').replace('#', '');
    if (hex.length < 6) return '#ffffff';
    const r = parseInt(hex.substr(0,2), 16);
    const g = parseInt(hex.substr(2,2), 16);
    const b = parseInt(hex.substr(4,2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#111827' : '#ffffff';
  } catch { return '#ffffff'; }
}


export async function followUser(targetUid) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const myRef = doc(db, 'profiles', user.uid);
    const theirRef = doc(db, 'profiles', targetUid);
    const mySnap = await getDoc(myRef);
    if (!mySnap.exists()) { console.warn('followUser: follower has no profile doc'); return; }
    const myFollowing = mySnap.data().following || [];
    if (myFollowing.includes(targetUid)) { console.warn('followUser: already following'); return; }
    await updateDoc(myRef, { following: arrayUnion(targetUid) });
    await updateDoc(theirRef, { followers: arrayUnion(user.uid) });
    const myProfile = await getProfile(user.uid);
    if (myProfile) {
      await sendNotification(targetUid, {
        type: 'follow',
        title: `@${myProfile.username} followed you`,
        body: 'You have a new follower!',
        link: `profile.html?user=${myProfile.username}`,
      });
    }
  } catch (e) { console.error('Follow failed:', e.code, e.message); }
}

export async function unfollowUser(targetUid) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;
  try {
    const { arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const myRef = doc(db, 'profiles', user.uid);
    const theirRef = doc(db, 'profiles', targetUid);
    await updateDoc(myRef, { following: arrayRemove(targetUid) });
    await updateDoc(theirRef, { followers: arrayRemove(user.uid) });
  } catch (e) { console.warn('Unfollow failed:', e); }
}

export async function banUser(targetUid, reason = '') {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return;
  await updateDoc(doc(db, 'profiles', targetUid), { isBanned: true, banReason: reason, bannedAt: new Date().toISOString() });
}

export async function unbanUser(targetUid) {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return;
  await updateDoc(doc(db, 'profiles', targetUid), { isBanned: false, banReason: '', bannedAt: null });
}

/* ===================== ROLE SYSTEM ===================== */
export const PREDEFINED_ROLES = [
  { id: 'moderator', label: 'Moderator', emoji: '🛡️', color: '#8b5cf6' },
  { id: 'vip',       label: 'VIP',       emoji: '⭐', color: '#f59e0b' },
  { id: 'verified',  label: 'Verified',  emoji: '✓',  color: '#22c55e' },
  { id: 'helper',    label: 'Helper',    emoji: '🤝', color: '#06b6d4' },
  { id: 'booster',   label: 'Booster',   emoji: '🚀', color: '#ec4899' },
  { id: 'og',        label: 'OG',        emoji: '🏆', color: '#d97706' },
];

export function renderBadges(badges = [], roles = []) {
  const badgeHTML = badges.map(b => {
    if (b === 'owner') return `<span style="display:inline-flex;align-items:center;gap:3px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:0.3px;">👑 Owner</span>`;
    if (b === 'admin') return `<span style="display:inline-flex;align-items:center;gap:3px;background:#3a7dff;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:0.3px;">⚡ Admin</span>`;
    return '';
  }).join(' ');

  const roleHTML = (roles || []).map(r => {
    // Check predefined first
    const pre = PREDEFINED_ROLES.find(p => p.id === r.id);
    if (pre) {
      return `<span style="display:inline-flex;align-items:center;gap:3px;background:${pre.color};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:0.3px;">${pre.emoji} ${pre.label}</span>`;
    }
    // Custom role
    const color = r.color || '#6b7280';
    return `<span style="display:inline-flex;align-items:center;gap:3px;background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:0.3px;">${r.emoji || '🏷️'} ${r.label}</span>`;
  }).join(' ');

  return [badgeHTML, roleHTML].filter(Boolean).join(' ');
}

export async function setUserRank(targetUid, rank) {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return { ok: false, error: 'Only the owner can assign ranks.' };
  if (targetUid === OWNER_UID) return { ok: false, error: 'Cannot change owner rank.' };
  try {
    const ref = doc(db, 'profiles', targetUid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, error: 'Profile not found.' };
    const badges = snap.data().badges || [];
    let newBadges = badges.filter(b => b !== 'admin' && b !== 'owner');
    if (rank === 'admin') newBadges = [...newBadges, 'admin'];
    if (rank === 'owner') newBadges = [...newBadges, 'admin', 'owner'];
    await updateDoc(ref, { rank, badges: newBadges });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function getUserRank(targetUid) {
  try {
    const snap = await getDoc(doc(db, 'profiles', targetUid));
    return snap.exists() ? (snap.data().rank || 'user') : 'user';
  } catch { return 'user'; }
}

export async function assignRole(targetUid, role) {
  // role = { id, label, emoji, color }
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return;
  const ref = doc(db, 'profiles', targetUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const existing = snap.data().roles || [];
  if (existing.find(r => r.id === role.id)) return; // already has it
  await updateDoc(ref, { roles: [...existing, role] });
}

export async function removeRole(targetUid, roleId) {
  const user = auth.currentUser;
  if (!user || user.uid !== OWNER_UID) return;
  const ref = doc(db, 'profiles', targetUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const existing = snap.data().roles || [];
  await updateDoc(ref, { roles: existing.filter(r => r.id !== roleId) });
}

/* ===================== PROFILE SETUP MODAL ===================== */
export function initProfileSetup(onComplete) {
  // Called after sign-in — checks if profile exists, if not shows setup modal
  onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) return;
    const profile = await getProfile(user.uid);
    if (profile) { if (onComplete) onComplete(profile); return; }

    // No profile yet — show setup modal
    const modal = document.createElement('div');
    modal.id = 'profile-setup-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:32px;width:100%;max-width:420px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;max-height:90vh;overflow-y:auto;">
        <button id="psetup-skip" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#9ca3af;" title="Skip for now">✕</button>
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:40px;margin-bottom:8px;">👤</div>
          <h2 style="font-family:'Bebas Neue',sans-serif;font-size:30px;margin:0 0 6px;color:#111827;">Create your Profile</h2>
          <p style="color:#6b7280;font-size:13px;margin:0;">Set up your public Flux profile so others can follow you.</p>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Username <span style="color:#ef4444;">*</span></label>
            <div style="position:relative;">
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:14px;">@</span>
              <input id="psetup-username" type="text" placeholder="yourname" maxlength="20"
                style="width:100%;padding:10px 12px 10px 28px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;">
            </div>
            <div id="psetup-username-msg" style="font-size:11px;margin-top:4px;display:none;"></div>
          </div>

          <div>
            <label style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Display Name</label>
            <input id="psetup-displayname" type="text" placeholder="${user.displayName || 'Your Name'}" maxlength="30"
              style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;">
          </div>

          <div>
            <label style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">Bio</label>
            <textarea id="psetup-bio" placeholder="Tell people a bit about yourself..." maxlength="120" rows="2"
              style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:14px;outline:none;box-sizing:border-box;resize:none;font-family:inherit;"></textarea>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f9fafb;border-radius:10px;border:1px solid rgba(0,0,0,0.07);">
            <div>
              <div style="font-size:13px;font-weight:600;color:#111827;">Private Profile</div>
              <div style="font-size:11px;color:#6b7280;">Only followers can see your games & bio</div>
            </div>
            <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
              <input type="checkbox" id="psetup-private" style="opacity:0;width:0;height:0;">
              <span id="psetup-toggle-track" style="position:absolute;inset:0;background:#d1d5db;border-radius:12px;transition:background 0.2s;"></span>
              <span id="psetup-toggle-thumb" style="position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>
            </label>
          </div>

          <div style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:#f9fafb;border-radius:10px;border:1px solid rgba(0,0,0,0.07);">
            <input type="checkbox" id="psetup-privacy-agree" style="margin-top:2px;width:16px;height:16px;cursor:pointer;flex-shrink:0;">
            <label for="psetup-privacy-agree" style="font-size:12px;color:#6b7280;cursor:pointer;line-height:1.5;">
              I have read and agree to the <a href="info.html" target="_blank" style="color:var(--accent, #3a7dff);text-decoration:underline;">Privacy Policy</a>. I understand that Flux collects my username, display name, bio, favourited games, recently played games, and follower data. Firebase may also collect usage analytics and authentication data.
            </label>
          </div>

          <p id="psetup-error" style="color:#ef4444;font-size:12px;margin:0;display:none;text-align:center;"></p>

          <button id="psetup-submit" style="padding:12px;background:#3a7dff;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:15px;">Create Profile</button>
          <button id="psetup-skip2" style="padding:10px;background:none;border:none;color:#9ca3af;font-size:13px;cursor:pointer;">Skip for now</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Toggle switch behaviour
    const checkbox = document.getElementById('psetup-private');
    const track = document.getElementById('psetup-toggle-track');
    const thumb = document.getElementById('psetup-toggle-thumb');
    checkbox.addEventListener('change', () => {
      track.style.background = checkbox.checked ? '#3a7dff' : '#d1d5db';
      thumb.style.transform = checkbox.checked ? 'translateX(20px)' : 'translateX(0)';
    });

    // Username availability check
    let _usernameTimer = null;
    document.getElementById('psetup-username').addEventListener('input', (e) => {
      const val = e.target.value.trim().toLowerCase();
      const msgEl = document.getElementById('psetup-username-msg');
      clearTimeout(_usernameTimer);
      // Validate format
      if (val && !/^[a-z0-9_.]{3,20}$/.test(val)) {
        msgEl.textContent = 'Only letters, numbers, _ and . allowed (3-20 chars)';
        msgEl.style.color = '#ef4444'; msgEl.style.display = 'block'; return;
      }
      if (!val) { msgEl.style.display = 'none'; return; }
      msgEl.textContent = 'Checking...'; msgEl.style.color = '#9ca3af'; msgEl.style.display = 'block';
      _usernameTimer = setTimeout(async () => {
        const taken = await isUsernameTaken(val);
        if (taken) { msgEl.textContent = '✗ Username taken'; msgEl.style.color = '#ef4444'; }
        else { msgEl.textContent = '✓ Available'; msgEl.style.color = '#22c55e'; }
      }, 500);
    });

    const closeModal = () => modal.remove();
    document.getElementById('psetup-skip').addEventListener('click', closeModal);
    document.getElementById('psetup-skip2').addEventListener('click', closeModal);

    document.getElementById('psetup-submit').addEventListener('click', async () => {
      const username = document.getElementById('psetup-username').value.trim().toLowerCase();
      const displayName = document.getElementById('psetup-displayname').value.trim() || user.displayName || username;
      const bio = document.getElementById('psetup-bio').value.trim();
      const isPrivate = document.getElementById('psetup-private').checked;
      const errEl = document.getElementById('psetup-error');
      const btn = document.getElementById('psetup-submit');

      errEl.style.display = 'none';
      if (!document.getElementById('psetup-privacy-agree').checked) { errEl.textContent = 'You must agree to the Privacy Policy to create a profile.'; errEl.style.display = 'block'; return; }
      if (!username) { errEl.textContent = 'Username is required.'; errEl.style.display = 'block'; return; }
      if (!/^[a-z0-9_.]{3,20}$/.test(username)) { errEl.textContent = 'Invalid username format.'; errEl.style.display = 'block'; return; }

      btn.textContent = 'Creating...'; btn.disabled = true;

      const taken = await isUsernameTaken(username);
      if (taken) { errEl.textContent = 'That username is already taken.'; errEl.style.display = 'block'; btn.textContent = 'Create Profile'; btn.disabled = false; return; }

      const profile = await createProfile({
        uid: user.uid,
        username,
        displayName,
        bio,
        isPrivate,
        avatarURL: user.photoURL || '',
      });

      localStorage.setItem('flux_policy_accepted', '1');
      localStorage.setItem('flux_cookie_consent', 'accepted');
      closeModal();
      if (onComplete) onComplete(profile);
    });
  });
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
      <a id="view-profile-btn" href="profile.html" style="display:none;align-items:center;gap:10px;padding:12px 16px;font-size:13px;color:#111827;text-decoration:none;border-bottom:1px solid rgba(0,0,0,0.06);">
        <span>👤</span> My Profile
      </a>
      <a href="social.html" style="display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:13px;color:#111827;text-decoration:none;border-bottom:1px solid rgba(0,0,0,0.06);">
        <span>💬</span> Social & Chat <span style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:8px;font-weight:800;padding:1px 5px;border-radius:20px;letter-spacing:0.8px;text-transform:uppercase;margin-left:4px;" class="dropdown-beta">BETA</span>
      </a>
      <a href="messages.html" style="display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:13px;color:#111827;text-decoration:none;border-bottom:1px solid rgba(0,0,0,0.06);">
        <span>💬</span> Messages
      </a>
      <button id="dropdown-dark-toggle" style="width:100%;padding:12px 16px;background:none;border:none;border-bottom:1px solid rgba(0,0,0,0.06);text-align:left;cursor:pointer;font-size:13px;color:#111827;display:flex;align-items:center;gap:10px;">
        <span id="dropdown-dark-icon">🌙</span> <span id="dropdown-dark-label">Dark Mode</span>
      </button>
      <a href="info.html" style="display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:13px;color:#111827;text-decoration:none;border-bottom:1px solid rgba(0,0,0,0.06);">
        <span>🔒</span> Privacy Policy
      </a>
      <button id="sign-out-btn" style="width:100%;padding:12px 16px;background:none;border:none;text-align:left;cursor:pointer;font-size:13px;color:#ef4444;display:flex;align-items:center;gap:10px;">
        <span>🚪</span> Sign Out
      </button>
      <button id="mod-panel-btn" style="display:none;width:100%;padding:12px 16px;background:none;border:none;border-top:1px solid rgba(0,0,0,0.06);text-align:left;cursor:pointer;font-size:13px;color:#7c3aed;align-items:center;gap:10px;">
        <span>⚙️</span> Mod Panel
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

  document.getElementById('dropdown-dark-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('flux_dark', isDark ? '1' : '0');
    document.getElementById('dropdown-dark-icon').textContent = isDark ? '☀️' : '🌙';
    document.getElementById('dropdown-dark-label').textContent = isDark ? 'Light Mode' : 'Dark Mode';
    // Also update the standalone toggle if it exists
    const standaloneBtn = document.getElementById('dark-toggle');
    if (standaloneBtn) standaloneBtn.textContent = isDark ? '☀️' : '🌙';
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

  // Mod modal
  const ADMIN_UID = 'zEy6TO5ligf2um4rssIZs9C9X7f2';
  const modModal = document.createElement('div');
  modModal.id = 'mod-modal';
  modModal.style.cssText = 'display:none;position:fixed;inset:0;z-index:500;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);';
  modModal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:400px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;max-height:90vh;overflow-y:auto;">
      <button id="mod-modal-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#6b7280;">✕</button>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <span style="font-size:22px;">⚙️</span>
        <h3 style="font-family:'Bebas Neue',sans-serif;font-size:26px;margin:0;color:#111827;">Mod Panel</h3>
      </div>

      <!-- ── SERVER CONTROL ── -->
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Server Control</div>
      <div style="margin-bottom:12px;">
        <div id="mod-current-status" style="font-size:13px;font-weight:600;color:#111827;padding:10px 12px;background:#f9fafb;border-radius:8px;border:1px solid rgba(0,0,0,0.07);margin-bottom:10px;">Loading...</div>
        <select id="mod-duration" style="width:100%;padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;color:#111827;background:#fff;outline:none;cursor:pointer;margin-bottom:8px;">
          <option value="0">⛔ No limit — restore manually</option>
          <option value="1">⏱ 1 minute</option>
          <option value="2">⏱ 2 minutes</option>
          <option value="5">⏱ 5 minutes</option>
          <option value="10">⏱ 10 minutes</option>
          <option value="30">⏱ 30 minutes</option>
          <option value="60">⏱ 1 hour</option>
        </select>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="mod-shutdown-btn" style="padding:11px;background:#ef4444;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">🔴 Shut Down Server</button>
          <select id="mod-crash-reason" style="padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;color:#111827;background:#fff;outline:none;cursor:pointer;">
            <option value="The server has crashed due to high traffic. We're working on a fix.">🚦 Too much traffic</option>
            <option value="The database has overloaded and caused a crash. Please try again soon.">🗄️ Database overload</option>
            <option value="A memory leak has caused the server to crash unexpectedly.">💾 Memory leak</option>
            <option value="An unexpected internal error has caused a server crash. Our team is investigating.">⚠️ Unexpected internal error</option>
            <option value="The server is under a DDoS attack. We're working to restore access.">🛡️ DDoS attack</option>
            <option value="A failed deployment has taken the server down. Rolling back now.">🚀 Failed deployment</option>
          </select>
          <button id="mod-crash-btn" style="padding:11px;background:#f59e0b;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">💥 Fake Server Crash</button>
          <button id="mod-restore-btn" style="padding:11px;background:#22c55e;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">✅ Restore Server</button>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.07);margin:16px 0;">

      <!-- ── BROADCAST ── -->
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">📢 Broadcast Message</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px;">
        <input id="mod-broadcast-text" type="text" placeholder="Type your message..." maxlength="120"
          style="padding:10px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;outline:none;box-sizing:border-box;">
        <button id="mod-broadcast-btn" style="padding:11px;background:#3a7dff;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">📣 Send to Everyone</button>
      </div>

      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.07);margin:16px 0;">

      <!-- ── CHAT LOCK ── -->
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🔒 Chat Controls</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f9fafb;border-radius:10px;border:1px solid rgba(0,0,0,0.07);">
          <div>
            <div style="font-size:13px;font-weight:700;color:#111827;">🌐 Global Chat</div>
            <div id="global-chat-lock-status" style="font-size:11px;color:#6b7280;margin-top:2px;">Unlocked</div>
          </div>
          <button id="mod-global-chat-lock-btn" style="padding:7px 14px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;">🔒 Lock</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f9fafb;border-radius:10px;border:1px solid rgba(0,0,0,0.07);">
          <div>
            <div style="font-size:13px;font-weight:700;color:#111827;">💬 Direct Messages</div>
            <div id="dm-lock-status" style="font-size:11px;color:#6b7280;margin-top:2px;">Unlocked</div>
          </div>
          <button id="mod-dm-lock-btn" style="padding:7px 14px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;">🔒 Lock</button>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.07);margin:16px 0;">

      <!-- ── ADMIN ABUSE ── -->
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">😈 Admin Abuse</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <button class="abuse-btn" data-effect="shake" style="padding:10px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#111827;">🫨 Shake</button>
        <button class="abuse-btn" data-effect="flip" style="padding:10px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#111827;">🙃 Flip Page</button>
        <button class="abuse-btn" data-effect="confetti" style="padding:10px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#111827;">🎉 Confetti</button>
        <button class="abuse-btn" data-effect="crazytext" style="padding:10px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#111827;">🤪 Crazy Text</button>
        <button class="abuse-btn" data-effect="colour" style="padding:10px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#111827;">🎨 Colour Chaos</button>
        <button id="mod-jumpscare-btn" style="padding:10px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#111827;">😱 Jumpscare</button>
        <button class="abuse-btn" data-effect="forceiframe" style="padding:10px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#111827;grid-column:span 1;">🔒 Force Iframe</button>
        <button id="mod-abuse-stop" style="padding:10px 8px;border:2px solid #ef4444;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;font-weight:700;color:#ef4444;">🛑 Stop All</button>
      </div>

      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.07);margin:16px 0;">

      <!-- ── GAME MANAGEMENT ── -->
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🎮 Game Labels</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px;">
        <select id="mod-game-select" style="padding:9px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;color:#111827;background:#fff;outline:none;cursor:pointer;">
          <option value="">Select a game...</option>
        </select>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="compat-btn" data-compat="ipad" style="flex:1;padding:7px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:12px;font-weight:700;color:#6b7280;">📱 iPad</button>
          <button class="compat-btn" data-compat="pc" style="flex:1;padding:7px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:12px;font-weight:700;color:#6b7280;">🖥️ PC</button>
          <button class="compat-btn" data-compat="both" style="flex:1;padding:7px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:12px;font-weight:700;color:#6b7280;">✅ Both</button>
          <button class="compat-btn" data-compat="" style="flex:1;padding:7px 8px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:12px;font-weight:700;color:#6b7280;">✕ Clear</button>
        </div>
        <div id="mod-game-reports-wrap" style="display:none;">
          <div style="font-size:11px;color:#ef4444;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">⚠️ Open Reports</div>
          <div id="mod-game-reports-list"></div>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.07);margin:16px 0;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🎁 Gift Points</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input id="mod-gift-username" type="text" placeholder="Username..." maxlength="20"
          style="padding:9px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;outline:none;box-sizing:border-box;">
        <div style="display:flex;gap:8px;">
          <input id="mod-gift-amount" type="number" placeholder="Points..." min="1" max="10000"
            style="flex:1;padding:9px 12px;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-size:13px;outline:none;">
          <button id="mod-gift-btn" style="padding:9px 16px;background:#f59e0b;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px;">🎁 Gift</button>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid rgba(0,0,0,0.07);margin:16px 0;">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">🔒 Chat Controls</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f9fafb;border-radius:10px;border:1px solid rgba(0,0,0,0.07);">
          <div>
            <div style="font-size:13px;font-weight:600;color:#111827;">🌐 Global Chat</div>
            <div style="font-size:11px;color:#6b7280;">Prevent users from sending messages</div>
          </div>
          <button id="mod-globalchat-lock" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid #e5e7eb;background:#fff;color:#6b7280;transition:all 0.15s;">Lock</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f9fafb;border-radius:10px;border:1px solid rgba(0,0,0,0.07);">
          <div>
            <div style="font-size:13px;font-weight:600;color:#111827;">💬 Direct Messages</div>
            <div style="font-size:11px;color:#6b7280;">Prevent users from sending DMs</div>
          </div>
          <button id="mod-dms-lock" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid #e5e7eb;background:#fff;color:#6b7280;transition:all 0.15s;">Lock</button>
        </div>
      </div>

      <p id="mod-msg" style="font-size:12px;margin:12px 0 0;text-align:center;display:none;"></p>
    </div>
  `;
  document.body.appendChild(modModal);

  document.getElementById('mod-modal-close').addEventListener('click', () => { modModal.style.display = 'none'; });
  modModal.addEventListener('click', (e) => { if (e.target === modModal) modModal.style.display = 'none'; });

  let _autoRestoreTimer = null;

  async function setServerStatus(status, message) {
    const msg = document.getElementById('mod-msg');
    const durationMins = parseInt(document.getElementById('mod-duration').value) || 0;
    const restoreAt = durationMins > 0 ? new Date(Date.now() + durationMins * 60000).toISOString() : null;
    try {
      await setDoc(doc(db, 'stats', 'server'), { status, message, updatedAt: new Date().toISOString(), restoreAt });
      msg.style.color = '#22c55e';
      msg.textContent = durationMins > 0 ? `Status set — restoring in ${durationMins} min` : `Status set to "${status}"`;
      msg.style.display = 'block';
      document.getElementById('mod-current-status').textContent = `${status} — ${message}${durationMins > 0 ? ` (restores in ~${durationMins}m)` : ''}`;
      document.getElementById('mod-current-status').style.color = status === 'online' ? '#22c55e' : status === 'crash' ? '#f59e0b' : '#ef4444';
      setTimeout(() => { msg.style.display = 'none'; }, 3000);
      if (_autoRestoreTimer) clearTimeout(_autoRestoreTimer);
      if (durationMins > 0 && status !== 'online') {
        _autoRestoreTimer = setTimeout(async () => {
          await setDoc(doc(db, 'stats', 'server'), { status: 'online', message: 'online', updatedAt: new Date().toISOString(), restoreAt: null });
        }, durationMins * 60000);
      }
    } catch (e) {
      msg.style.color = '#ef4444'; msg.textContent = 'Failed to update status.'; msg.style.display = 'block';
    }
  }

  document.getElementById('mod-shutdown-btn').addEventListener('click', () =>
    setServerStatus('shutdown', 'The server has been shut down by an admin. Please check back later.'));
  document.getElementById('mod-crash-btn').addEventListener('click', () =>
    setServerStatus('crash', document.getElementById('mod-crash-reason').value));
  document.getElementById('mod-restore-btn').addEventListener('click', () =>
    setServerStatus('online', 'online'));

  // Broadcast
  document.getElementById('mod-broadcast-btn').addEventListener('click', async () => {
    const text = document.getElementById('mod-broadcast-text').value.trim();
    if (!text) return;
    const msg = document.getElementById('mod-msg');
    try {
      await setDoc(doc(db, 'stats', 'broadcast'), {
        message: text,
        sentAt: new Date().toISOString(),
        id: Math.random().toString(36).slice(2)
      });
      document.getElementById('mod-broadcast-text').value = '';
      msg.style.color = '#22c55e'; msg.textContent = 'Message sent!'; msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 2500);
    } catch (e) {
      msg.style.color = '#ef4444'; msg.textContent = 'Failed to send.'; msg.style.display = 'block';
    }
  });

  // Chat lock buttons
  let _globalChatLocked = false;
  let _dmLocked = false;

  document.getElementById('mod-globalchat-lock').addEventListener('click', async () => {
    _globalChatLocked = !_globalChatLocked;
    const btn = document.getElementById('mod-globalchat-lock');
    try {
      await setDoc(doc(db, 'stats', 'chatlock'), {
        globalLocked: _globalChatLocked,
        dmLocked: _dmLocked,
        updatedAt: new Date().toISOString()
      });
      btn.textContent = _globalChatLocked ? '🔓 Unlock' : '🔒 Lock';
      btn.style.background = _globalChatLocked ? '#22c55e' : '#fff';
      btn.style.color = _globalChatLocked ? '#fff' : '#6b7280';
      btn.style.borderColor = _globalChatLocked ? '#22c55e' : '#e5e7eb';
    } catch (e) { console.warn('Chat lock failed', e); }
  });

  document.getElementById('mod-dms-lock').addEventListener('click', async () => {
    _dmLocked = !_dmLocked;
    const btn = document.getElementById('mod-dms-lock');
    try {
      await setDoc(doc(db, 'stats', 'chatlock'), {
        globalLocked: _globalChatLocked,
        dmLocked: _dmLocked,
        updatedAt: new Date().toISOString()
      });
      btn.textContent = _dmLocked ? '🔓 Unlock' : '🔒 Lock';
      btn.style.background = _dmLocked ? '#22c55e' : '#fff';
      btn.style.color = _dmLocked ? '#fff' : '#6b7280';
      btn.style.borderColor = _dmLocked ? '#22c55e' : '#e5e7eb';
    } catch (e) { console.warn('DM lock failed', e); }
  });

  // Gift points
  document.getElementById('mod-gift-btn').addEventListener('click', async () => {
    const username = document.getElementById('mod-gift-username').value.trim().toLowerCase();
    const amount = parseInt(document.getElementById('mod-gift-amount').value);
    const msg = document.getElementById('mod-msg');
    if (!username || !amount) { msg.style.color='#ef4444'; msg.textContent='Enter username and amount.'; msg.style.display='block'; return; }
    const profile = await getProfileByUsername(username);
    if (!profile) { msg.style.color='#ef4444'; msg.textContent='User not found.'; msg.style.display='block'; return; }
    const result = await giftPoints(profile.uid, amount);
    msg.style.color = result.ok ? '#22c55e' : '#ef4444';
    msg.textContent = result.ok ? `✓ Gifted ${amount} points to @${username}!` : result.error;
    msg.style.display = 'block';
    if (result.ok) { document.getElementById('mod-gift-username').value=''; document.getElementById('mod-gift-amount').value=''; }
    setTimeout(() => { msg.style.display='none'; }, 3000);
  });

  // Game compatibility buttons
  modModal.querySelectorAll('.compat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const select = document.getElementById('mod-game-select');
      const gameId = select.value;
      const gameTitle = select.options[select.selectedIndex]?.text || '';
      if (!gameId) { msg.style.color='#ef4444'; msg.textContent='Select a game first.'; msg.style.display='block'; setTimeout(()=>{msg.style.display='none';},2000); return; }
      const compat = btn.dataset.compat;
      const result = await setGameCompatibility(gameId, gameTitle, compat);
      if (result.ok) {
        const t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:var(--panel,#fff);border-radius:12px;padding:12px 16px;box-shadow:0 8px 30px rgba(0,0,0,0.14);border-left:4px solid #22c55e;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:var(--text,#111);opacity:0;transform:translateY(8px);transition:all 0.2s ease;max-width:280px;';
        t.innerHTML = `<span>✅</span><span>✓ ${gameTitle} labelled as ${compat ? compat.toUpperCase() : 'unlabelled'}</span>`;
        document.body.appendChild(t);
        requestAnimationFrame(() => { t.style.opacity='1'; t.style.transform='translateY(0)'; });
        setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(8px)'; setTimeout(()=>t.remove(),200); }, 3000);
      } else {
        msg.style.color = '#ef4444'; msg.textContent = result.error; msg.style.display = 'block';
        setTimeout(()=>{msg.style.display='none';}, 2500);
      }
      // Update button highlights
      modModal.querySelectorAll('.compat-btn').forEach(b => {
        const on = b.dataset.compat === compat && compat !== '';
        b.style.background = on ? '#111827' : '#fff';
        b.style.color = on ? '#fff' : '#6b7280';
        b.style.borderColor = on ? '#111827' : '#e5e7eb';
      });
    });
  });

  // Admin abuse buttons — toggle on/off
  const _activeEffects = new Set();
  modModal.querySelectorAll('.abuse-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const effect = btn.dataset.effect;
      const isActive = _activeEffects.has(effect);
      const newEffects = new Set(_activeEffects);
      if (isActive) newEffects.delete(effect); else newEffects.add(effect);
      try {
        await setDoc(doc(db, 'stats', 'chaos'), { effects: [...newEffects], updatedAt: new Date().toISOString() });
      } catch (e) { console.warn('Chaos write failed', e); }
    });
  });

  document.getElementById('mod-abuse-stop').addEventListener('click', async () => {
    try {
      await setDoc(doc(db, 'stats', 'chaos'), { effects: [], updatedAt: new Date().toISOString() });
    } catch (e) { console.warn('Chaos stop failed', e); }
  });

  // Jumpscare — one-shot trigger with unique ID each time
  document.getElementById('mod-jumpscare-btn').addEventListener('click', async () => {
    try {
      await setDoc(doc(db, 'stats', 'jumpscare'), {
        triggeredAt: new Date().toISOString(),
        id: Math.random().toString(36).slice(2)
      });
      const msg = document.getElementById('mod-msg');
      msg.style.color = '#22c55e'; msg.textContent = '😱 Jumpscare sent!'; msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 2000);
    } catch (e) { console.warn('Jumpscare failed', e); }
  });

  // Open mod modal
  document.getElementById('mod-panel-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    document.getElementById('profile-dropdown').style.display = 'none';
    modModal.style.display = 'flex';
    const snap = await getDoc(doc(db, 'stats', 'server'));
    const statusEl = document.getElementById('mod-current-status');
    if (snap.exists()) {
      const { status, message, restoreAt } = snap.data();
      const timeLeft = restoreAt ? Math.max(0, Math.round((new Date(restoreAt) - Date.now()) / 60000)) : null;
      statusEl.textContent = `${status} — ${message}${timeLeft > 0 ? ` (restores in ~${timeLeft}m)` : ''}`;
      statusEl.style.color = status === 'online' ? '#22c55e' : status === 'crash' ? '#f59e0b' : '#ef4444';
    } else {
      statusEl.textContent = 'online — no issues';
      statusEl.style.color = '#22c55e';
    }
    // Sync active chaos effects to button states
    try {
      const chaosSnap = await getDoc(doc(db, 'stats', 'chaos'));
      const active = chaosSnap.exists() ? (chaosSnap.data().effects || []) : [];
      _activeEffects.clear();
      active.forEach(e => _activeEffects.add(e));
      modModal.querySelectorAll('.abuse-btn').forEach(btn => {
        const on = _activeEffects.has(btn.dataset.effect);
        btn.style.background = on ? '#111827' : '#fff';
        btn.style.color = on ? '#fff' : '#111827';
        btn.style.borderColor = on ? '#111827' : '#e5e7eb';
      });
    } catch {}

    // Populate game select from window._FLUX_GAMES
    const gameSelect = document.getElementById('mod-game-select');
    if (gameSelect && window._FLUX_GAMES) {
      gameSelect.innerHTML = '<option value="">Select a game...</option>';
      window._FLUX_GAMES.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id; opt.textContent = g.title;
        gameSelect.appendChild(opt);
      });
      // Load current compat on select change
      gameSelect.addEventListener('change', async () => {
        const id = gameSelect.value;
        if (!id) return;
        const { fetchAllGameStats } = await import('./firebase-auth.js').catch(()=>({}));
        const snap = await getDoc(doc(db, 'gamestats', id));
        const compat = snap.exists() ? snap.data().compatibility || '' : '';
        modModal.querySelectorAll('.compat-btn').forEach(b => {
          const on = b.dataset.compat === compat && compat !== '';
          b.style.background = on ? '#111827' : '#fff';
          b.style.color = on ? '#fff' : '#6b7280';
          b.style.borderColor = on ? '#111827' : '#e5e7eb';
        });
      });
    }

    // Load open game reports
    try {
      const reports = await fetchGameReports();
      const wrap = document.getElementById('mod-game-reports-wrap');
      const list = document.getElementById('mod-game-reports-list');
      if (wrap && list) {
        if (reports.length) {
          wrap.style.display = 'block';
          list.innerHTML = '';
          reports.forEach(r => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px;background:#fff5f5;border-radius:8px;margin-bottom:6px;font-size:12px;border:1px solid rgba(239,68,68,0.2);';
            item.innerHTML = `<strong>${r.gameTitle}</strong>: ${r.reason} <button data-id="${r.id}" style="float:right;background:none;border:none;color:#22c55e;font-weight:700;cursor:pointer;font-size:12px;">✓ Dismiss</button>`;
            item.querySelector('button').addEventListener('click', async (e) => {
              await dismissGameReport(e.currentTarget.dataset.id);
              item.remove();
              if (!list.children.length) wrap.style.display = 'none';
            });
            list.appendChild(item);
          });
        } else {
          wrap.style.display = 'none';
        }
      }
    } catch {}
    // Sync chat lock state
    try {
      const lockSnap = await getDoc(doc(db, 'stats', 'chatlock'));
      if (lockSnap.exists()) {
        _globalChatLocked = lockSnap.data().globalLocked || false;
        _dmLocked = lockSnap.data().dmLocked || false;
        const glBtn = document.getElementById('mod-globalchat-lock');
        const dmBtn = document.getElementById('mod-dms-lock');
        if (glBtn) {
          glBtn.textContent = _globalChatLocked ? '🔓 Unlock' : '🔒 Lock';
          glBtn.style.background = _globalChatLocked ? '#22c55e' : '#fff';
          glBtn.style.color = _globalChatLocked ? '#fff' : '#6b7280';
          glBtn.style.borderColor = _globalChatLocked ? '#22c55e' : '#e5e7eb';
        }
        if (dmBtn) {
          dmBtn.textContent = _dmLocked ? '🔓 Unlock' : '🔒 Lock';
          dmBtn.style.background = _dmLocked ? '#22c55e' : '#fff';
          dmBtn.style.color = _dmLocked ? '#fff' : '#6b7280';
          dmBtn.style.borderColor = _dmLocked ? '#22c55e' : '#e5e7eb';
        }
      }
    } catch {}
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
      const modBtn = document.getElementById('mod-panel-btn');

      // Show mod panel button only for admin
      if (modBtn) modBtn.style.display = user.uid === ADMIN_UID ? 'flex' : 'none';

      if (!user.isAnonymous) {
        // Check for profile and trigger setup if missing
        const profile = await getProfile(user.uid);
        if (!profile) {
          initProfileSetup((p) => {
            if (p && name) name.textContent = p.displayName || p.username;
          });
        } else {
          if (name) name.textContent = profile.displayName || profile.username || user.displayName || user.email;
          const profileLinkEl = document.getElementById('view-profile-btn');
          if (profileLinkEl) profileLinkEl.style.display = 'flex';
          if (profileLinkEl) profileLinkEl.href = `profile.html?user=${profile.username}`;
          if (user.photoURL && user.photoURL !== profile.avatarURL) {
            updateDoc(doc(db, 'profiles', user.uid), { avatarURL: user.photoURL }).catch(() => {});
          }
        }
        // Init notifications for signed-in users
        initNotifications();
        // Sync dropdown dark mode icon
        const isDark = document.documentElement.classList.contains('dark');
        const icon = document.getElementById('dropdown-dark-icon');
        const label = document.getElementById('dropdown-dark-label');
        if (icon) icon.textContent = isDark ? '☀️' : '🌙';
        if (label) label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
      }

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

/* ===================== SERVER STATUS ===================== */
export function initServerStatus() {
  const ADMIN_UID = 'zEy6TO5ligf2um4rssIZs9C9X7f2';

  const ERROR_CODES = [
    { code: 'ERR_INTERNAL_0x4F2A', trace: 'flux.core.js', func: 'handleRequest' },
    { code: 'ERR_HEAP_OVERFLOW_0x7C1B', trace: 'flux.memory.js', func: 'allocateBuffer' },
    { code: 'ERR_DB_TIMEOUT_0x3E9D', trace: 'flux.database.js', func: 'queryPool' },
    { code: 'ERR_SOCKET_RESET_0x8B44', trace: 'flux.network.js', func: 'openConnection' },
    { code: 'ERR_SEGFAULT_0x1A7F', trace: 'flux.runtime.js', func: 'processEvent' },
    { code: 'ERR_STACK_TRACE_0x5C3E', trace: 'flux.server.js', func: 'processNextTick' },
  ];

  let _countdownInterval = null;
  let _viewerPoll = null;

  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ onSnapshot, setDoc, doc: firestoreDoc }) => {
    const statusRef = firestoreDoc(db, 'stats', 'server');

    onSnapshot(statusRef, (snap) => {
      if (!snap.exists()) return;
      const { status, message, restoreAt } = snap.data();

      // Clean up timers
      if (_countdownInterval) { clearInterval(_countdownInterval); _countdownInterval = null; }
      if (_viewerPoll) { clearInterval(_viewerPoll); _viewerPoll = null; }

      if (status === 'online') {
        document.getElementById('server-status-overlay')?.remove();
        document.getElementById('server-status-banner')?.remove();
        return;
      }

      const applyOverlay = (isAdmin) => {
        const isCrash = status === 'crash';
        const err = ERROR_CODES[Math.floor(Math.random() * ERROR_CODES.length)];
        const lineNo = Math.floor(Math.random() * 900) + 100;
        const viewerCount = _onlineCount || 0;

        if (isAdmin) {
          // Admin gets a dismissible banner at the top — can still use the site normally
          document.getElementById('server-status-overlay')?.remove();
          let banner = document.getElementById('server-status-banner');
          if (!banner) {
            banner = document.createElement('div');
            banner.id = 'server-status-banner';
            document.body.prepend(banner);
          }
          banner.style.cssText = `
            position:fixed;top:0;left:0;right:0;z-index:9999;
            background:${isCrash ? '#f59e0b' : '#ef4444'};
            color:white;padding:10px 16px;
            display:flex;align-items:center;justify-content:space-between;gap:12px;
            font-size:13px;font-weight:600;flex-wrap:wrap;
          `;
          banner.innerHTML = `
            <span>${isCrash ? '💥' : '🔴'} Server is ${isCrash ? 'crashed' : 'shut down'} — users are blocked. ${restoreAt ? `Restoring in <span id="banner-countdown" style="font-weight:900;">...</span>` : 'No auto-restore set.'}</span>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <select id="banner-duration" style="padding:5px 8px;border-radius:6px;border:none;font-size:12px;cursor:pointer;background:rgba(255,255,255,0.2);color:white;">
                <option value="0" ${!restoreAt ? 'selected' : ''}>⛔ No limit</option>
                <option value="1">⏱ 1 min</option>
                <option value="2">⏱ 2 min</option>
                <option value="5">⏱ 5 min</option>
                <option value="10">⏱ 10 min</option>
                <option value="30">⏱ 30 min</option>
                <option value="60">⏱ 1 hour</option>
              </select>
              <button id="banner-update-btn" style="padding:5px 10px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);border-radius:6px;color:white;font-size:12px;font-weight:700;cursor:pointer;">Update Timer</button>
              <button id="banner-restore-btn" style="padding:5px 12px;background:white;border:none;border-radius:6px;color:#111;font-size:12px;font-weight:700;cursor:pointer;">✅ Restore</button>
            </div>
          `;

          document.getElementById('banner-restore-btn').addEventListener('click', async () => {
            await setDoc(firestoreDoc(db, 'stats', 'server'), { status: 'online', message: 'online', updatedAt: new Date().toISOString(), restoreAt: null });
          });

          document.getElementById('banner-update-btn').addEventListener('click', async () => {
            const mins = parseInt(document.getElementById('banner-duration').value) || 0;
            const newRestoreAt = mins > 0 ? new Date(Date.now() + mins * 60000).toISOString() : null;
            await setDoc(firestoreDoc(db, 'stats', 'server'), { status, message, updatedAt: new Date().toISOString(), restoreAt: newRestoreAt });
          });

          // Countdown in banner
          if (restoreAt) {
            const bannerCountdown = document.getElementById('banner-countdown');
            const tick = () => {
              const secs = Math.max(0, Math.round((new Date(restoreAt) - Date.now()) / 1000));
              if (bannerCountdown) { const m = Math.floor(secs/60); const s = secs%60; bannerCountdown.textContent = m > 0 ? `${m}m ${s}s` : `${s}s`; }
            };
            tick();
            _countdownInterval = setInterval(tick, 1000);
          }

        } else {
          // Regular users get full blocking overlay
          document.getElementById('server-status-banner')?.remove();
          let overlay = document.getElementById('server-status-overlay');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'server-status-overlay';
            document.body.appendChild(overlay);
          }

          overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#0f0f0f;overflow-y:auto;';
          overlay.innerHTML = `
            <div style="text-align:center;max-width:500px;padding:32px;width:100%;">
              <img src="assets/holyshititcrashed.gif" alt="" style="max-width:280px;width:100%;border-radius:12px;margin-bottom:24px;">
              <h1 style="font-family:'Bebas Neue',sans-serif;font-size:48px;color:#fff;margin:0 0 12px;">
                ${isCrash ? 'Server Crashed' : 'Servers are currently shut down!'}
              </h1>
              <p style="color:#9ca3af;font-size:15px;line-height:1.6;margin:0 0 16px;">${message}</p>
              <div style="display:inline-flex;align-items:center;gap:8px;background:#1a1a1a;border-radius:20px;padding:6px 16px;margin-bottom:20px;">
                <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;animation:pulse-dot 2s infinite;"></span>
                <span id="overlay-viewer-count" style="font-size:13px;color:#9ca3af;">${viewerCount} ${viewerCount === 1 ? 'person' : 'people'} watching</span>
              </div>
              ${isCrash ? `
              <div style="background:#1f1f1f;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:12px;color:#ef4444;text-align:left;margin-bottom:16px;">
                <div style="color:#6b7280;margin-bottom:4px;">// ${err.code}</div>
                Error: ECONNREFUSED — ${err.code}<br>
                at ${err.func} (${err.trace}:${lineNo}:12)<br>
                at processNextTick (internal/process/next_tick.js:68:5)<br>
                at runMicrotasks (&lt;anonymous&gt;)
              </div>` : ''}
              ${restoreAt ? `<div style="color:#6b7280;font-size:13px;margin-bottom:16px;">Attempting to restore in <span id="overlay-countdown" style="color:#fff;font-weight:700;">...</span></div>` : ''}
              <p style="color:#4b5563;font-size:12px;margin-top:4px;">© Flux ${new Date().getFullYear()}</p>
            </div>
          `;

          // Live viewer count
          const viewerEl = document.getElementById('overlay-viewer-count');
          _viewerPoll = setInterval(() => {
            if (!document.getElementById('server-status-overlay')) { clearInterval(_viewerPoll); return; }
            if (viewerEl) viewerEl.textContent = `${_onlineCount || 0} ${(_onlineCount || 0) === 1 ? 'person' : 'people'} watching`;
          }, 5000);

          // Countdown timer
          if (restoreAt) {
            const countdownEl = document.getElementById('overlay-countdown');
            const tick = () => {
              const secs = Math.max(0, Math.round((new Date(restoreAt) - Date.now()) / 1000));
              if (!countdownEl || !document.getElementById('server-status-overlay')) { clearInterval(_countdownInterval); return; }
              const m = Math.floor(secs / 60); const s = secs % 60;
              countdownEl.textContent = m > 0 ? `${m}m ${s}s` : `${s}s`;
            };
            tick();
            _countdownInterval = setInterval(tick, 1000);
          }
        }
      };

      if (auth.currentUser !== undefined) {
        applyOverlay(auth.currentUser?.uid === ADMIN_UID);
      } else {
        onAuthStateChanged(auth, (user) => {
          applyOverlay(user?.uid === ADMIN_UID);
        }, { once: true });
      }
    });
  });
}

/* ===================== BROADCAST ===================== */
export function initBroadcast() {
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(async ({ onSnapshot, getDoc, doc: firestoreDoc }) => {
    let _lastBroadcastId = null;
    const broadcastRef = firestoreDoc(db, 'stats', 'broadcast');

    // Pre-load current ID so we don't show old broadcast on page load
    try {
      const initial = await getDoc(broadcastRef);
      if (initial.exists()) _lastBroadcastId = initial.data().id || null;
    } catch {}

    function showBroadcastToast(message) {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      toast.style.cssText = `
        background:#111827;border-radius:12px;padding:14px 18px;
        box-shadow:0 8px 30px rgba(0,0,0,0.3);border-left:4px solid #3a7dff;
        display:flex;flex-direction:column;gap:4px;
        pointer-events:all;max-width:300px;
        opacity:0;transform:translateY(8px);transition:all 0.25s ease;
      `;
      toast.innerHTML = `
        <span style="font-size:11px;font-weight:700;color:#3a7dff;text-transform:uppercase;letter-spacing:0.5px;">📣 Admin Broadcast</span>
        <span style="font-size:14px;color:#fff;font-weight:500;">${message}</span>
      `;
      container.appendChild(toast);
      requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
      setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 250);
      }, 5000);
    }

    // Primary: real-time listener
    onSnapshot(broadcastRef, (snap) => {
      if (!snap.exists()) return;
      const { message, id } = snap.data();
      if (!message || id === _lastBroadcastId) return;
      _lastBroadcastId = id;
      showBroadcastToast(message);
    });

    // Fallback poll every 1.5s for mobile browsers
    setInterval(async () => {
      try {
        const snap = await getDoc(broadcastRef);
        if (!snap.exists()) return;
        const { message, id } = snap.data();
        if (!message || id === _lastBroadcastId) return;
        _lastBroadcastId = id;
        showBroadcastToast(message);
      } catch {}
    }, 1500);
  });
}

/* ===================== CHAOS ===================== */
export function initChaos() {
  const COLOURS = ['#3a7dff','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];
  const FONTS = ['Comic Sans MS', 'Impact', 'Courier New', 'Georgia', 'Papyrus', 'Arial Black'];
  let _chaosSheet = null;
  let _confettiInterval = null;
  let _crazyInterval = null;
  let _activeEffects = new Set();

  function getSheet() {
    if (!_chaosSheet) {
      const style = document.createElement('style');
      document.head.appendChild(style);
      _chaosSheet = style.sheet;
    }
    return _chaosSheet;
  }

  function clearRules() {
    const sheet = getSheet();
    while (sheet.cssRules.length) sheet.deleteRule(0);
  }

  function applyEffects(effects) {
    const prev = _activeEffects;
    _activeEffects = new Set(effects);

    clearRules();
    if (_confettiInterval) { clearInterval(_confettiInterval); _confettiInterval = null; }
    if (_crazyInterval) { clearInterval(_crazyInterval); _crazyInterval = null; }
    document.documentElement.style.transform = '';
    document.documentElement.style.transition = '';
    document.querySelectorAll('.chaos-confetti').forEach(el => el.remove());

    if (_activeEffects.has('shake')) {
      getSheet().insertRule(`@keyframes chaos-shake { 0%,100%{transform:translate(0,0) rotate(0deg)} 20%{transform:translate(-5px,3px) rotate(-1deg)} 40%{transform:translate(5px,-4px) rotate(1deg)} 60%{transform:translate(-4px,5px) rotate(-0.5deg)} 80%{transform:translate(4px,-3px) rotate(0.5deg)} }`, 0);
      getSheet().insertRule(`html { animation: chaos-shake 0.35s infinite !important; transform-origin: center center !important; }`, 1);
    }

    if (_activeEffects.has('flip')) {
      document.documentElement.style.transform = 'rotate(180deg)';
      document.documentElement.style.transition = 'transform 0.6s ease';
    }

    if (_activeEffects.has('colour')) {
      const col = COLOURS[Math.floor(Math.random() * COLOURS.length)];
      getSheet().insertRule(`:root { --accent: ${col} !important; --primary: ${col} !important; }`, 0);
      getSheet().insertRule(`a, button, .play-btn { background-color: ${col} !important; border-color: ${col} !important; }`, 1);
    }

    if (_activeEffects.has('crazytext')) {
      const randomise = () => {
        document.querySelectorAll('h1,h2,h3,.title,.card-body').forEach(el => {
          el.style.fontFamily = FONTS[Math.floor(Math.random() * FONTS.length)];
          el.style.fontSize = `${Math.floor(Math.random() * 16) + 10}px`;
          el.style.color = COLOURS[Math.floor(Math.random() * COLOURS.length)];
          el.style.transform = `rotate(${Math.floor(Math.random() * 10) - 5}deg)`;
        });
      };
      randomise();
      _crazyInterval = setInterval(randomise, 800);
    } else {
      // Restore text if crazytext was on before
      if (prev.has('crazytext')) {
        document.querySelectorAll('h1,h2,h3,.title,.card-body').forEach(el => {
          el.style.fontFamily = ''; el.style.fontSize = ''; el.style.color = ''; el.style.transform = '';
        });
      }
    }

    if (_activeEffects.has('confetti')) {
      const spawnConfetti = () => {
        const el = document.createElement('div');
        el.className = 'chaos-confetti';
        const size = Math.random() * 10 + 6;
        el.style.cssText = `
          position:fixed;top:-20px;left:${Math.random()*100}vw;
          width:${size}px;height:${size}px;border-radius:${Math.random()>0.5?'50%':'2px'};
          background:${COLOURS[Math.floor(Math.random()*COLOURS.length)]};
          z-index:99998;pointer-events:none;
          animation:chaos-fall ${Math.random()*2+2}s linear forwards;
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
      };
      getSheet().insertRule(`@keyframes chaos-fall { to { transform: translateY(110vh) rotate(720deg); opacity:0; } }`, 0);
      spawnConfetti();
      _confettiInterval = setInterval(spawnConfetti, 120);
    }

    // Force iframe — hide all "Open" buttons so users must play in iframe
    if (_activeEffects.has('forceiframe')) {
      getSheet().insertRule(`.open-btn { display: none !important; }`, 0);
    } else if (prev.has('forceiframe')) {
      // Restore open buttons when toggled off — handled by clearRules() above
    }
  }

  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(({ onSnapshot, getDoc, doc: firestoreDoc }) => {
    const chaosRef = firestoreDoc(db, 'stats', 'chaos');

    // Primary: real-time listener
    onSnapshot(chaosRef, (snap) => {
      const effects = snap.exists() ? (snap.data().effects || []) : [];
      applyEffects(effects);
    });

    // Fallback poll every 3s for mobile browsers that drop WebSocket connections
    setInterval(async () => {
      try {
        const snap = await getDoc(chaosRef);
        const effects = snap.exists() ? (snap.data().effects || []) : [];
        const effectsKey = [...effects].sort().join(',');
        const activeKey = [..._activeEffects].sort().join(',');
        if (effectsKey !== activeKey) applyEffects(effects);
      } catch {}
    }, 3000);
  });
}

/* ===================== JUMPSCARE ===================== */
export function initJumpscare() {
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(async ({ onSnapshot, getDoc, doc: firestoreDoc }) => {
    let _lastJumpscareId = null;
    const jumpscareRef = firestoreDoc(db, 'stats', 'jumpscare');

    // Pre-load the current ID so we don't trigger on page load
    try {
      const initial = await getDoc(jumpscareRef);
      if (initial.exists()) _lastJumpscareId = initial.data().id || null;
    } catch {}

    function triggerJumpscare() {
      // Admin sees a success toast instead
      if (auth.currentUser?.uid === 'zEy6TO5ligf2um4rssIZs9C9X7f2') {
        let container = document.getElementById('toast-container');
        if (!container) { container = document.createElement('div'); container.id = 'toast-container'; container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;'; document.body.appendChild(container); }
        const t = document.createElement('div');
        t.style.cssText = 'background:#111827;border-radius:12px;padding:12px 16px;box-shadow:0 8px 30px rgba(0,0,0,0.3);border-left:4px solid #22c55e;font-size:13px;font-weight:600;color:#22c55e;pointer-events:all;opacity:0;transform:translateY(8px);transition:all 0.25s ease;';
        t.textContent = '✅ Jumpscare deployed to all users!';
        container.appendChild(t);
        requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 250); }, 3000);
        return;
      }

      if (document.getElementById('server-status-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'jumpscare-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;cursor:pointer;';
      overlay.innerHTML = `<img src="assets/jumpscare.png" alt="" style="max-width:100vw;max-height:100vh;object-fit:contain;animation:jumpscare-pop 0.1s ease-out;">`;

      const style = document.createElement('style');
      style.textContent = `@keyframes jumpscare-pop { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }`;
      document.head.appendChild(style);
      document.body.appendChild(overlay);

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } catch {}

      const dismiss = () => { overlay.remove(); style.remove(); };
      overlay.addEventListener('click', dismiss);
      setTimeout(dismiss, 2500);
    }

    onSnapshot(jumpscareRef, (snap) => {
      if (!snap.exists()) return;
      const { id } = snap.data();
      if (id === _lastJumpscareId) return;
      _lastJumpscareId = id;
      triggerJumpscare();
    });

    // Fallback poll every 1.5s for mobile
    setInterval(async () => {
      try {
        const snap = await getDoc(jumpscareRef);
        if (!snap.exists()) return;
        const { id } = snap.data();
        if (id === _lastJumpscareId) return;
        _lastJumpscareId = id;
        triggerJumpscare();
      } catch {}
    }, 1500);
  });
}

/* ===================== CHAT LOCK ===================== */
export function initChatLock(type, onLocked, onUnlocked) {
  // type: 'global' | 'dm'
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js").then(async ({ onSnapshot, getDoc, doc: firestoreDoc }) => {
    const lockRef = firestoreDoc(db, 'stats', 'chatlock');

    // Pre-load current state
    try {
      const snap = await getDoc(lockRef);
      if (snap.exists()) {
        const locked = type === 'global' ? snap.data().globalLocked : snap.data().dmLocked;
        if (locked) onLocked(); else onUnlocked();
      }
    } catch {}

    onSnapshot(lockRef, (snap) => {
      if (!snap.exists()) { onUnlocked(); return; }
      const locked = type === 'global' ? snap.data().globalLocked : snap.data().dmLocked;
      if (locked) onLocked(); else onUnlocked();
    });
  });
}

/* ===================== COOKIE CONSENT ===================== */
export function initCookieConsent() {
  const CONSENT_KEY = 'flux_cookie_consent';
  const POLICY_KEY = 'flux_policy_accepted';

  // Check if existing logged-in user hasn't accepted policy yet
  onAuthStateChanged(auth, (user) => {
    if (user && !user.isAnonymous && localStorage.getItem(POLICY_KEY) !== '1') {
      showPolicyGate();
    }
  });

  if (localStorage.getItem(CONSENT_KEY) === 'accepted') return;

  // Block the page until accepted
  const overlay = document.createElement('div');
  overlay.id = 'cookie-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:24px;box-sizing:border-box;';

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px;width:100%;max-width:560px;box-shadow:0 30px 80px rgba(0,0,0,0.3);position:relative;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:28px;">🍪</span>
        <h2 style="font-family:'Bebas Neue',sans-serif;font-size:26px;margin:0;color:#111827;">Cookies & Privacy</h2>
      </div>
      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 12px;">
        Flux uses cookies and local storage to keep you signed in and remember your preferences. We also use <strong>Firebase</strong> (by Google) for authentication, database storage, and analytics — which may collect usage data such as IP addresses, device info, and session activity.
      </p>
      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 20px;">
        By using Flux you agree to this. You can read our full <a href="info.html" style="color:#3a7dff;text-decoration:underline;">Privacy Policy</a> for details. This site <strong>requires cookies to function</strong> — if you decline you will not be able to use the site.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button id="cookie-accept" style="flex:1;min-width:140px;padding:12px;background:#3a7dff;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">✅ Accept & Continue</button>
        <button id="cookie-decline" style="flex:1;min-width:140px;padding:12px;background:transparent;border:1px solid rgba(0,0,0,0.1);border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;color:#6b7280;">❌ Decline</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('cookie-accept').addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    overlay.remove();
  });

  document.getElementById('cookie-decline').addEventListener('click', () => {
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:32px;width:100%;max-width:480px;box-shadow:0 30px 80px rgba(0,0,0,0.3);text-align:center;">
        <span style="font-size:48px;display:block;margin-bottom:16px;">🚫</span>
        <h2 style="font-family:'Bebas Neue',sans-serif;font-size:32px;margin:0 0 12px;color:#111827;">Cookies Required</h2>
        <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 20px;">
          Flux requires cookies to function — they're used for authentication and saving your preferences. Without them the site cannot work.
        </p>
        <button id="cookie-reconsider" style="padding:12px 28px;background:#3a7dff;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">Go Back</button>
      </div>
    `;
    document.getElementById('cookie-reconsider').addEventListener('click', () => {
      overlay.remove();
      initCookieConsent();
    });
  });
}

function showPolicyGate() {
  if (window.location.pathname.includes('info.html')) return;
  if (document.getElementById('policy-gate-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'policy-gate-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';

  const returnUrl = encodeURIComponent(window.location.href);
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:32px;width:100%;max-width:480px;box-shadow:0 30px 80px rgba(0,0,0,0.3);text-align:center;">
      <span style="font-size:48px;display:block;margin-bottom:16px;">📋</span>
      <h2 style="font-family:'Bebas Neue',sans-serif;font-size:30px;margin:0 0 12px;color:#111827;">Privacy Policy Update</h2>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 8px;">
        We've updated our Privacy Policy. You need to read and accept it to continue using Flux.
      </p>
      <p style="font-size:13px;color:#ef4444;line-height:1.6;margin:0 0 24px;">
        If you do not accept, your account will need to be deleted — but you're always welcome to create a new one.
      </p>
      <a href="info.html?accept=1&return=${returnUrl}"
        style="display:block;padding:13px;background:#3a7dff;color:white;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:10px;">
        📖 Read & Accept Privacy Policy
      </a>
      <button id="policy-gate-delete-btn" style="width:100%;padding:11px;background:transparent;border:1px solid rgba(239,68,68,0.3);border-radius:10px;font-weight:600;font-size:13px;color:#ef4444;cursor:pointer;">
        🗑️ Delete my account instead
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('policy-gate-delete-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure? This will sign you out. To fully delete your data, contact us on GitHub.')) return;
    try {
      await signOut(auth);
      localStorage.removeItem('flux_policy_accepted');
      overlay.remove();
      location.reload();
    } catch (e) { console.warn('Sign out failed:', e); }
  });
}
