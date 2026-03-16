/* profile.js — Flux Profile Page */

import {
  getProfile, getProfileByUsername, updateProfile,
  followUser, unfollowUser, banUser, unbanUser,
  renderBadges, assignRole, removeRole, PREDEFINED_ROLES,
  initAuthUI, initServerStatus, initCookieConsent,
  initBroadcast, initChaos, initJumpscare, initPresence
} from './firebase-auth.js';

// Firebase imports (reuse same app)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

const OWNER_UID = 'zEy6TO5ligf2um4rssIZs9C9X7f2';

const GAMES_MAP = {
  'drive-mad':        { title: 'Drive Mad',         thumb: 'assets/Drive-Mad.png',         url: 'https://nxtcoreee3.github.io/Drive-Mad/' },
  'stickman-hook':    { title: 'Stickman Hook',      thumb: 'assets/Stickman-Hook.png',      url: 'https://nxtcoreee3.github.io/Stickman-Hook/' },
  'geometry-dash-lite':{ title: 'Geometry Dash Lite',thumb: 'assets/Geometry-Dash-Lite.png', url: 'https://nxtcoreee3.github.io/Geometry-Dash-Lite/' },
  'paper-io':         { title: 'Paper.io',           thumb: 'assets/Paper-io.png',           url: 'https://nxtcoreee3.github.io/Paper-io/' },
  'cookie-clicker':   { title: 'Cookie Clicker',     thumb: 'assets/Cookie-Clicker.png',     url: 'https://nxtcoreee3.github.io/Cookie-Clicker/' },
  'monkey-mart':      { title: 'Monkey Mart',        thumb: 'assets/Monkey-Mart.png',        url: 'https://nxtcoreee3.github.io/Monkey-Mart/' },
  'drift-boss':       { title: 'Drift Boss',         thumb: 'assets/drift-boss.png',         url: 'https://nxtcoreee3.github.io/Drift-Boss/' },
  'polytrack':        { title: 'Polytrack',           thumb: 'assets/polytrack.png',          url: 'https://nxtcoreee3.github.io/Polytrack/' },
};

/* ── year footer ── */
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

  loadProfilePage();
});

async function loadProfilePage() {
  const root = document.getElementById('profile-root');
  const params = new URLSearchParams(location.search);
  const usernameParam = params.get('user');

  if (!usernameParam) {
    root.innerHTML = renderNotFound('No profile specified.');
    return;
  }

  // Fetch profile by username
  const profile = await getProfileByUsername(usernameParam);
  if (!profile) {
    root.innerHTML = renderNotFound(`@${usernameParam} doesn't exist.`);
    return;
  }

  // Update page title
  document.title = `${profile.displayName || profile.username} — Flux`;

  // Wait for auth to resolve before rendering
  onAuthStateChanged(auth, async (currentUser) => {
    // Re-fetch profile after auth so follower state is always fresh
    const freshProfile = await getProfileByUsername(usernameParam) || profile;
    const isOwn = currentUser && currentUser.uid === freshProfile.uid;
    const isAdmin = currentUser && currentUser.uid === OWNER_UID;
    const isFollowing = currentUser && (freshProfile.followers || []).includes(currentUser.uid);

    const canSeeContent = !freshProfile.isPrivate || isOwn || isFollowing || isAdmin;

    root.innerHTML = renderProfile(freshProfile, { isOwn, isAdmin, isFollowing, canSeeContent, currentUser });
    bindEvents(freshProfile, { isOwn, isAdmin, isFollowing, currentUser });
  });
}

function renderProfile(profile, { isOwn, isAdmin, isFollowing, canSeeContent, currentUser }) {
  const avatarHTML = profile.avatarURL
    ? `<img class="profile-avatar" src="${profile.avatarURL}" alt="${profile.displayName}">`
    : `<div class="profile-avatar-placeholder">${(profile.displayName || profile.username || '?')[0].toUpperCase()}</div>`;

  const joinDate = profile.joinedAt
    ? new Date(profile.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '';

  const followersCount = (profile.followers || []).length;
  const followingCount = (profile.following || []).length;
  const favsCount = (profile.favorites || []).length;

  let followBtn = '';
  if (currentUser && !currentUser.isAnonymous && !isOwn) {
    followBtn = `<button id="follow-btn" class="btn-follow ${isFollowing ? 'following' : ''}">${isFollowing ? 'Following' : 'Follow'}</button>`;
  }

  let editBtn = isOwn ? `<button id="edit-profile-btn" class="edit-profile-btn">✏️ Edit Profile</button>` : '';

  let adminPanel = '';
  if (isAdmin && !isOwn) {
    const currentRoles = profile.roles || [];
    const activeRoleIds = currentRoles.map(r => r.id);

    const predefinedBtns = PREDEFINED_ROLES.map(r => {
      const has = activeRoleIds.includes(r.id);
      return `<button class="role-toggle-btn" data-role-id="${r.id}" data-role-label="${r.label}" data-role-emoji="${r.emoji}" data-role-color="${r.color}"
        style="padding:5px 10px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid ${r.color};
        background:${has ? r.color : 'transparent'};color:${has ? '#fff' : r.color};transition:all 0.15s;">
        ${r.emoji} ${r.label}
      </button>`;
    }).join('');

    const activeRoleChips = currentRoles.length
      ? currentRoles.map(r => `<span style="display:inline-flex;align-items:center;gap:4px;background:${r.color || '#6b7280'};color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;">
          ${r.emoji || '🏷️'} ${r.label}
          <button class="role-remove-btn" data-role-id="${r.id}" style="background:none;border:none;color:rgba(255,255,255,0.8);cursor:pointer;font-size:12px;padding:0 0 0 2px;line-height:1;">✕</button>
        </span>`).join('')
      : '<span style="font-size:12px;color:var(--muted);">No roles assigned</span>';

    adminPanel = `
      <div class="ban-panel">
        <div class="ban-panel-title">⚙️ Admin Controls</div>

        <!-- Roles section -->
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Roles</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">${activeRoleChips}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">${predefinedBtns}</div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <input id="custom-role-label" type="text" placeholder="Custom role name..." maxlength="20"
              style="flex:1;min-width:120px;padding:6px 10px;border:1px solid rgba(0,0,0,0.15);border-radius:8px;font-size:12px;background:transparent;color:var(--text);outline:none;">
            <input id="custom-role-emoji" type="text" placeholder="🏷️" maxlength="2"
              style="width:44px;padding:6px 8px;border:1px solid rgba(0,0,0,0.15);border-radius:8px;font-size:14px;text-align:center;background:transparent;color:var(--text);outline:none;">
            <input id="custom-role-color" type="color" value="#6b7280"
              style="width:36px;height:32px;border:1px solid rgba(0,0,0,0.15);border-radius:8px;cursor:pointer;padding:2px;">
            <button id="custom-role-add" style="padding:6px 12px;background:#3a7dff;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;">+ Add</button>
          </div>
        </div>

        <!-- Ban section -->
        ${profile.isBanned
          ? `<button id="unban-btn" style="padding:8px 16px;background:#22c55e;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">✅ Unban User</button>`
          : `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <input id="ban-reason" type="text" placeholder="Ban reason..." style="flex:1;min-width:160px;padding:8px 10px;border:1px solid rgba(239,68,68,0.3);border-radius:8px;font-size:13px;background:transparent;color:var(--text);outline:none;">
              <button id="ban-btn" style="padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">🚫 Ban User</button>
            </div>`
        }
      </div>`;
  }

  let contentHTML = '';
  if (profile.isBanned && !isAdmin) {
    contentHTML = `<div class="private-notice"><span class="lock-icon">🚫</span><p>This account has been banned.</p></div>`;
  } else if (!canSeeContent) {
    contentHTML = `<div class="private-notice"><span class="lock-icon">🔒</span><p>This profile is private.</p><p style="font-size:12px;margin-top:4px;">Follow <strong>@${profile.username}</strong> to see their games.</p></div>`;
  } else {
    // Favourites
    const favs = (profile.favorites || []).map(id => GAMES_MAP[id]).filter(Boolean);
    const favsHTML = favs.length
      ? `<div class="mini-game-grid">${favs.map(g => `
          <div class="mini-game-card" data-url="${g.url}">
            <img src="${g.thumb}" alt="${g.title}" loading="lazy">
            <div class="mini-game-card-title">${g.title}</div>
          </div>`).join('')}</div>`
      : `<p style="color:var(--muted);font-size:13px;margin:0;">No favourited games yet.</p>`;

    // Recently played
    const recent = (profile.recentlyPlayed || []).map(id => GAMES_MAP[id]).filter(Boolean).slice(0, 6);
    const recentHTML = recent.length
      ? `<div class="mini-game-grid">${recent.map(g => `
          <div class="mini-game-card" data-url="${g.url}">
            <img src="${g.thumb}" alt="${g.title}" loading="lazy">
            <div class="mini-game-card-title">${g.title}</div>
          </div>`).join('')}</div>`
      : `<p style="color:var(--muted);font-size:13px;margin:0;">No recently played games.</p>`;

    contentHTML = `
      <div class="profile-section">
        <div class="profile-section-title">★ Favourited Games <span style="font-size:14px;font-weight:400;color:var(--muted);font-family:'DM Sans',sans-serif;">${favs.length}</span></div>
        ${favsHTML}
      </div>
      <div class="profile-section">
        <div class="profile-section-title">🕹️ Recently Played <span style="font-size:14px;font-weight:400;color:var(--muted);font-family:'DM Sans',sans-serif;">${recent.length}</span></div>
        ${recentHTML}
      </div>
    `;
  }

  return `
    <div class="profile-hero">
      <div class="profile-top">
        <div class="profile-avatar-wrap">${avatarHTML}</div>
        <div class="profile-info">
          <h1 class="profile-displayname">${profile.displayName || profile.username}</h1>
          <p class="profile-username">@${profile.username} ${profile.isPrivate ? '🔒' : ''} ${profile.isBanned ? '<span class="ban-badge">🚫 Banned</span>' : ''}</p>
          <div class="profile-badges">${renderBadges(profile.badges || [], profile.roles || [])}</div>
          ${profile.bio ? `<p class="profile-bio">${profile.bio}</p>` : ''}
        </div>
      </div>

      <div class="profile-actions">
        ${followBtn}
        ${editBtn}
        ${joinDate ? `<span style="font-size:12px;color:var(--muted);">Joined ${joinDate}</span>` : ''}
      </div>

      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat-num">${followersCount}</span>
          <span class="profile-stat-label">Followers</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-num">${followingCount}</span>
          <span class="profile-stat-label">Following</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-num">${favsCount}</span>
          <span class="profile-stat-label">Favourites</span>
        </div>
      </div>

      ${adminPanel}
    </div>

    ${contentHTML}
  `;
}

function bindEvents(profile, { isOwn, isAdmin, isFollowing, currentUser }) {
  // Follow / unfollow
  document.getElementById('follow-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const nowFollowing = btn.classList.contains('following');
    btn.disabled = true;

    // Find the followers count element and update it optimistically
    const followerStatEl = document.querySelector('.profile-stat-num');

    if (nowFollowing) {
      await unfollowUser(profile.uid);
      btn.classList.remove('following');
      btn.textContent = 'Follow';
      if (followerStatEl) followerStatEl.textContent = Math.max(0, parseInt(followerStatEl.textContent) - 1);
    } else {
      await followUser(profile.uid);
      btn.classList.add('following');
      btn.textContent = 'Following';
      if (followerStatEl) followerStatEl.textContent = parseInt(followerStatEl.textContent) + 1;
    }
    btn.disabled = false;
  });

  // Mini game cards — open in new tab
  document.querySelectorAll('.mini-game-card').forEach(card => {
    card.addEventListener('click', () => window.open(card.dataset.url, '_blank', 'noopener'));
  });

  // Edit profile
  document.getElementById('edit-profile-btn')?.addEventListener('click', () => showEditModal(profile));

  // Ban / unban
  document.getElementById('ban-btn')?.addEventListener('click', async () => {
    const reason = document.getElementById('ban-reason').value.trim();
    if (!reason) { alert('Please enter a ban reason.'); return; }
    await banUser(profile.uid, reason);
    location.reload();
  });
  document.getElementById('unban-btn')?.addEventListener('click', async () => {
    await unbanUser(profile.uid);
    location.reload();
  });

  // Role toggle (predefined)
  document.querySelectorAll('.role-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { roleId, roleLabel, roleEmoji, roleColor } = btn.dataset;
      const currentRoles = profile.roles || [];
      const has = currentRoles.find(r => r.id === roleId);
      if (has) {
        await removeRole(profile.uid, roleId);
      } else {
        await assignRole(profile.uid, { id: roleId, label: roleLabel, emoji: roleEmoji, color: roleColor });
      }
      location.reload();
    });
  });

  // Role remove chip
  document.querySelectorAll('.role-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeRole(profile.uid, btn.dataset.roleId);
      location.reload();
    });
  });

  // Custom role add
  document.getElementById('custom-role-add')?.addEventListener('click', async () => {
    const label = document.getElementById('custom-role-label').value.trim();
    const emoji = document.getElementById('custom-role-emoji').value.trim() || '🏷️';
    const color = document.getElementById('custom-role-color').value;
    if (!label) { alert('Enter a role name.'); return; }
    const id = 'custom_' + label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await assignRole(profile.uid, { id, label, emoji, color });
    location.reload();
  });
}

function showEditModal(profile) {
  const existing = document.getElementById('edit-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'edit-modal-overlay';
  overlay.className = 'edit-modal-overlay';
  overlay.innerHTML = `
    <div class="edit-modal-box">
      <button id="edit-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:26px;margin:0 0 20px;color:var(--text);">Edit Profile</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label class="field-label">Display Name</label>
          <input id="edit-displayname" class="input-field" type="text" value="${profile.displayName || ''}" maxlength="30">
        </div>
        <div>
          <label class="field-label">Bio</label>
          <textarea id="edit-bio" class="input-field" rows="3" maxlength="120" style="resize:none;">${profile.bio || ''}</textarea>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg);border-radius:10px;border:1px solid var(--glass-border);">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">Private Profile</div>
            <div style="font-size:11px;color:var(--muted);">Only followers see your content</div>
          </div>
          <label style="position:relative;display:inline-block;width:44px;height:24px;cursor:pointer;">
            <input type="checkbox" id="edit-private" style="opacity:0;width:0;height:0;" ${profile.isPrivate ? 'checked' : ''}>
            <span id="edit-toggle-track" style="position:absolute;inset:0;background:${profile.isPrivate ? 'var(--accent)' : '#d1d5db'};border-radius:12px;transition:background 0.2s;"></span>
            <span id="edit-toggle-thumb" style="position:absolute;top:2px;left:${profile.isPrivate ? '22px' : '2px'};width:20px;height:20px;background:#fff;border-radius:50%;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></span>
          </label>
        </div>
        <p id="edit-error" style="color:#ef4444;font-size:12px;margin:0;display:none;text-align:center;"></p>
        <button id="edit-save" style="padding:12px;background:var(--accent);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Toggle
  const cb = document.getElementById('edit-private');
  const track = document.getElementById('edit-toggle-track');
  const thumb = document.getElementById('edit-toggle-thumb');
  cb.addEventListener('change', () => {
    track.style.background = cb.checked ? 'var(--accent)' : '#d1d5db';
    thumb.style.left = cb.checked ? '22px' : '2px';
  });

  document.getElementById('edit-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('edit-save').addEventListener('click', async () => {
    const displayName = document.getElementById('edit-displayname').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const isPrivate = document.getElementById('edit-private').checked;
    const btn = document.getElementById('edit-save');
    const errEl = document.getElementById('edit-error');

    if (!displayName) { errEl.textContent = 'Display name cannot be empty.'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Saving...'; btn.disabled = true;

    await updateProfile(profile.uid, { displayName, bio, isPrivate });
    overlay.remove();
    location.reload();
  });
}

function renderNotFound(msg) {
  return `
    <div class="not-found">
      <h2>404</h2>
      <p>${msg}</p>
      <a href="index.html" style="color:var(--accent);font-size:14px;">← Back to Flux</a>
    </div>
  `;
}
