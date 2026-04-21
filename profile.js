/* profile.js — Flux Profile Page */

import {
  getProfile, getProfileByUsername, updateProfile,
  followUser, unfollowUser, banUser, unbanUser,
  renderBadges, assignRole, removeRole, PREDEFINED_ROLES,
  setUserRank, getUserRank, getContrastColor,
  initAuthUI, initServerStatus, initCookieConsent,
  initBroadcast, initChaos, initJumpscare, initPresence, syncProfileAvatar
} from './firebase-auth.js';

import { buildFluxBuddyDataUrl, normalizeFluxBuddy, FLUX_BUDDY_DEFAULT } from './flux-buddy.js';

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
  'drive-mad':               { title: 'Drive Mad',              thumb: 'assets/Drive-Mad.png',              url: 'https://nxtcoreee3.github.io/Drive-Mad/' },
  'stickman-hook':           { title: 'Stickman Hook',           thumb: 'assets/Stickman-Hook.png',          url: 'https://nxtcoreee3.github.io/Stickman-Hook/' },
  'geometry-dash-lite':      { title: 'Geometry Dash Lite',      thumb: 'assets/Geometry-Dash-Lite.png',     url: 'https://nxtcoreee3.github.io/Geometry-Dash-Lite/' },
  'paper-io':                { title: 'Paper.io',                thumb: 'assets/Paper-io.png',               url: 'https://nxtcoreee3.github.io/Paper-io/' },
  'cookie-clicker':          { title: 'Cookie Clicker',          thumb: 'assets/Cookie-Clicker.png',         url: 'https://nxtcoreee3.github.io/Cookie-Clicker/' },
  'monkey-mart':             { title: 'Monkey Mart',             thumb: 'assets/Monkey-Mart.png',            url: 'https://nxtcoreee3.github.io/Monkey-Mart/' },
  'drift-boss':              { title: 'Drift Boss',              thumb: 'assets/drift-boss.png',             url: 'https://nxtcoreee3.github.io/Drift-Boss/' },
  'polytrack':               { title: 'Polytrack',               thumb: 'assets/polytrack.png',              url: 'https://nxtcoreee3.github.io/Polytrack/' },
  'crazy-motorcycle':        { title: 'Crazy Motorcycle',        thumb: 'assets/crazy-motorcycle.png',       url: 'https://nxtcoreee3.github.io/Crazy-Motorcycle/' },
  'crazy-cars':              { title: 'Crazy Cars',              thumb: 'assets/crazy-cars.png',             url: 'https://nxtcoreee3.github.io/Crazy-Cars/' },
  'table-tennis-world-tour': { title: 'Table Tennis World Tour', thumb: 'assets/table-tennis-world-tour.png',url: 'https://nxtcoreee3.github.io/Table-Tennis-World-Tour/' },
  'moto-x3m':                { title: 'Moto X3M',               thumb: 'assets/moto-x3m.png',               url: 'https://nxtcoreee3.github.io/Moto-X3M/' },
  '8-ball-classic':          { title: '8 Ball Classic',          thumb: 'assets/8-ball-classic.png',         url: 'https://nxtcoreee3.github.io/8-Ball-Classic/' },
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
    ? `<div class="avatar-container ${isOwn ? 'editable' : ''}" style="position:relative;width:fit-content;margin:0 auto;">
         <img class="profile-avatar" id="main-avatar" src="${profile.avatarURL}" alt="${profile.displayName}" style="${isOwn ? 'cursor:pointer;transition:all 0.3s;' : ''}">
         ${isOwn ? '<div class="avatar-edit-hint" style="position:absolute;inset:0;background:rgba(0,0,0,0.4);border-radius:50%;display:flex;items-center;justify-content:center;color:#fff;font-size:12px;opacity:0;transition:opacity 0.2s;pointer-events:none;display:flex;align-items:center;justify-content:center;font-weight:700;">CHANGE</div>' : ''}
       </div>`
    : `<div class="profile-avatar-placeholder ${isOwn ? 'editable' : ''}" id="main-avatar" style="${isOwn ? 'cursor:pointer;position:relative;' : ''}">
         ${(profile.displayName || profile.username || '?')[0].toUpperCase()}
         ${isOwn ? '<div class="avatar-edit-hint" style="position:absolute;inset:0;background:rgba(0,0,0,0.4);border-radius:50%;display:flex;items-center;justify-content:center;color:#fff;font-size:12px;opacity:0;transition:opacity 0.2s;pointer-events:none;display:flex;align-items:center;justify-content:center;font-weight:700;">CHANGE</div>' : ''}
       </div>`;

  // Inject animation styles
  if (!document.getElementById('flux-premium-styles')) {
    const style = document.createElement('style');
    style.id = 'flux-premium-styles';
    style.textContent = `
      @keyframes modalAppear {
        from { opacity: 0; transform: scale(0.9) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .avatar-container:hover .profile-avatar { transform: scale(1.05); }
      .avatar-container:hover .avatar-edit-hint { opacity: 1 !important; }
      .avatar-option:hover { transform: translateY(-4px); border-color: var(--accent) !important; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
      .profile-avatar-placeholder:hover .avatar-edit-hint { opacity: 1 !important; }
    `;
    document.head.appendChild(style);
  }

  const joinDate = profile.joinedAt
    ? new Date(profile.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : '';

  const followersCount = (profile.followers || []).length;
  const followingCount = (profile.following || []).length;
  const favsCount = (profile.favorites || []).length;

  let followBtn = '';
  if (currentUser && !currentUser.isAnonymous && !isOwn) {
    followBtn = `<button id="follow-btn" class="btn-follow ${isFollowing ? 'following' : ''}">${isFollowing ? 'Following' : 'Follow'}</button>
    <a href="messages.html?with=${profile.username}" style="padding:9px 16px;background:transparent;border:1.5px solid var(--glass-border);border-radius:20px;font-size:13px;font-weight:600;color:var(--text);text-decoration:none;transition:border-color 0.15s;" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--glass-border)';this.style.color='var(--text)'">💬 Message</a>`;
  }

  let editBtn = isOwn ? `<button id="edit-profile-btn" class="edit-profile-btn">✏️ Edit Profile</button>` : '';

  let adminPanel = '';
  if (isAdmin && !isOwn) {
    const currentRank = profile.rank || 'user';
    const currentRoles = profile.roles || [];
    const activeRoleIds = currentRoles.map(r => r.id);
    const isTargetOwner = profile.uid === OWNER_UID;

    const rankSection = !isTargetOwner ? `
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Rank</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="rank-btn" data-rank="user" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid #e5e7eb;background:${currentRank==='user'?'#6b7280':'#fff'};color:${currentRank==='user'?'#fff':'#6b7280'};">👤 User</button>
          <button class="rank-btn" data-rank="admin" style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid #3a7dff;background:${currentRank==='admin'?'#3a7dff':'#fff'};color:${currentRank==='admin'?'#fff':'#3a7dff'};">⚡ Admin</button>
        </div>
        <div id="rank-msg" style="font-size:11px;margin-top:6px;display:none;"></div>
      </div>
    ` : `<div style="font-size:12px;color:#6b7280;margin-bottom:14px;padding:8px;background:#f9fafb;border-radius:8px;">🔒 Cannot modify owner rank</div>`;

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

        ${rankSection}

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

  const theme = profile.theme || {};
  const bannerColor = theme.bannerColor || '#3a7dff';
  const accentColor = theme.accentColor || '';
  const bannerEmoji = theme.bannerEmoji || '';
  const effect = theme.effect || '';
  const cardStyle = theme.cardStyle || 'default';
  const bannerTextColor = getContrastColor(bannerColor);

  // Generate floating emojis for confetti effect
  let bannerInner = bannerEmoji ? `<span style="font-size:48px;position:relative;z-index:1;color:${bannerTextColor};">${bannerEmoji}</span>` : '';
  if (effect === 'confetti') {
    const confettiEmojis = ['🎉','✨','🎊','⭐','💫','🌟'];
    const positions = [[10,20],[25,60],[40,15],[55,70],[70,25],[85,55],[15,80],[90,40]];
    bannerInner += positions.map(([l,t], i) =>
      `<span style="position:absolute;left:${l}%;top:${t}%;font-size:18px;animation:banner-float ${2+i*0.3}s ease-in-out infinite;animation-delay:${i*0.2}s;">${confettiEmojis[i % confettiEmojis.length]}</span>`
    ).join('');
  } else if (effect === 'stars') {
    const starPos = [[8,30],[20,70],[35,20],[50,60],[65,30],[78,75],[90,20],[45,80]];
    bannerInner += starPos.map(([l,t], i) =>
      `<span style="position:absolute;left:${l}%;top:${t}%;font-size:14px;animation:banner-float ${2+i*0.4}s ease-in-out infinite;animation-delay:${i*0.25}s;">⭐</span>`
    ).join('');
  } else if (effect === 'fire') {
    const firePos = [[5,40],[18,65],[32,30],[47,70],[62,25],[75,60],[88,35]];
    bannerInner += firePos.map(([l,t], i) =>
      `<span style="position:absolute;left:${l}%;top:${t}%;font-size:16px;animation:banner-float ${1.5+i*0.3}s ease-in-out infinite;animation-delay:${i*0.15}s;">🔥</span>`
    ).join('');
  }

  const cardStyleMap = {
    default: '',
    rounded: 'border-radius:32px !important;',
    sharp: 'border-radius:4px !important;',
    glass: 'backdrop-filter:blur(20px) !important;border:1px solid rgba(255,255,255,0.15) !important;',
    minimal: 'border:none !important;box-shadow:none !important;',
  };

  return `
    ${accentColor ? `<style>
      #profile-root .btn-follow:not(.following) { background: ${accentColor} !important; }
      #profile-root .profile-stat-num { color: ${accentColor} !important; }
      #profile-root .profile-section-title { color: ${accentColor} !important; }
    </style>` : ''}

    <div class="profile-card" style="${cardStyleMap[cardStyle] || ''}">
      <div class="profile-banner">
        <div class="profile-banner-inner" style="background:${bannerColor};">${bannerInner}</div>
      </div>

      <div class="profile-body">
        <div class="profile-top-row">
          <div class="profile-avatar-ring">
            ${profile.avatarURL
              ? `<img class="profile-avatar" src="${profile.avatarURL}" alt="${profile.displayName}">`
              : `<div class="profile-avatar-placeholder">${(profile.displayName || profile.username || '?')[0].toUpperCase()}</div>`}
          </div>
          <div class="profile-name-block">
            <h1 class="profile-displayname">${profile.displayName || profile.username}</h1>
            <p class="profile-username">@${profile.username} ${profile.isPrivate ? '🔒' : ''} ${profile.isBanned ? '<span class="ban-badge">🚫 Banned</span>' : ''}</p>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;align-self:flex-start;">
            ${followBtn}
            ${editBtn}
          </div>
        </div>

        ${(profile.badges?.length || profile.roles?.length) ? `<div class="profile-badges">${renderBadges(profile.badges || [], profile.roles || [])}</div>` : ''}
        ${profile.bio ? `<p class="profile-bio">${profile.bio}</p>` : ''}
        ${profile.currentlyPlaying ? `<p style="font-size:13px;color:var(--muted);margin:0 0 10px;display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse-dot 2s infinite;flex-shrink:0;"></span>Playing <strong style="color:var(--text);">${profile.currentlyPlaying.title}</strong></p>` : ''}
        ${joinDate ? `<p style="font-size:12px;color:var(--muted);margin:0 0 16px;">Joined ${joinDate}</p>` : ''}

        <div class="profile-stats">
          <div class="profile-stat" id="stat-followers" style="cursor:pointer;" title="View followers">
            <span class="profile-stat-num">${followersCount}</span>
            <span class="profile-stat-label">Followers</span>
          </div>
          <div class="profile-stat" id="stat-following" style="cursor:pointer;" title="View following">
            <span class="profile-stat-num">${followingCount}</span>
            <span class="profile-stat-label">Following</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-num">${favsCount}</span>
            <span class="profile-stat-label">Favourites</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-num">${profile.points || 0}</span>
            <span class="profile-stat-label">⭐ Points</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-num">${profile.loginStreak || 0}</span>
            <span class="profile-stat-label">🔥 Streak</span>
          </div>
        </div>

        ${adminPanel}
      </div>
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

  // Rank buttons — owner only
  document.querySelectorAll('.rank-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const rank = btn.dataset.rank;
      const msgEl = document.getElementById('rank-msg');
      btn.disabled = true;
      const result = await setUserRank(profile.uid, rank);
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.color = result.ok ? '#22c55e' : '#ef4444';
        msgEl.textContent = result.ok ? `✓ Rank set to ${rank}` : result.error;
        setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 2500);
      }
      if (result.ok) setTimeout(() => location.reload(), 1000);
      else btn.disabled = false;
    });
  });

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

  // Avatar Click (If Own)
  document.getElementById('main-avatar')?.addEventListener('click', () => {
    if (isOwn) showAvatarSelectionModal(profile);
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

  // Followers / following clickable stats
  document.getElementById('stat-followers')?.addEventListener('click', () => {
    showFollowListModal('Followers', profile.followers || []);
  });
  document.getElementById('stat-following')?.addEventListener('click', () => {
    showFollowListModal('Following', profile.following || []);
  });
}

async function showFollowListModal(title, uids) {
  const existing = document.getElementById('follow-list-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'follow-list-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:700;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);padding:20px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:var(--panel);border-radius:20px;width:100%;max-width:400px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,0.25);position:relative;">
      <div style="padding:20px 20px 16px;border-bottom:1px solid var(--glass-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <span style="font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text);">${title} <span style="font-size:16px;color:var(--muted);font-family:'DM Sans',sans-serif;">${uids.length}</span></span>
        <button id="follow-list-close" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div id="follow-list-body" style="overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:4px;">
        <div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">Loading...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#follow-list-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const body = overlay.querySelector('#follow-list-body');

  if (!uids.length) {
    body.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px;">No ${title.toLowerCase()} yet.</div>`;
    return;
  }

  // Load profiles for each uid
  const profiles = await Promise.all(uids.slice(0, 50).map(uid => getProfile(uid).catch(() => null)));
  body.innerHTML = '';

  profiles.filter(Boolean).forEach(p => {
    const item = document.createElement('a');
    item.href = `profile.html?user=${p.username}`;
    item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;text-decoration:none;transition:background 0.1s;';
    item.addEventListener('mouseenter', () => item.style.background = 'var(--bg)');
    item.addEventListener('mouseleave', () => item.style.background = '');

    const avatarHTML = p.avatarURL
      ? `<img src="${p.avatarURL}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid var(--glass-border);">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:16px;flex-shrink:0;">${(p.displayName||p.username||'?')[0].toUpperCase()}</div>`;

    item.innerHTML = `
      ${avatarHTML}
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.displayName || p.username}</div>
        <div style="font-size:12px;color:var(--muted);">@${p.username} · ${(p.followers||[]).length} followers</div>
      </div>
      ${renderBadges(p.badges || [], p.roles || [])}
    `;
    body.appendChild(item);
  });

  if (uids.length > 50) {
    const note = document.createElement('div');
    note.style.cssText = 'padding:8px;text-align:center;font-size:11px;color:var(--muted);';
    note.textContent = `Showing 50 of ${uids.length}`;
    body.appendChild(note);
  }
}

function showEditModal(profile) {
  const existing = document.getElementById('edit-modal-overlay');
  if (existing) existing.remove();

  const theme = profile.theme || {};
  const bannerColor = theme.bannerColor || '#3a7dff';
  const accentColor = theme.accentColor || '#3a7dff';
  const bannerEmoji = theme.bannerEmoji || '🎮';
  const currentEffect = theme.effect || 'none';
  const currentCardStyle = theme.cardStyle || 'default';
  const buddy = profile?.fluxBuddy && typeof profile.fluxBuddy === 'object' ? normalizeFluxBuddy(profile.fluxBuddy) : null;
  const buddySrc = buddy ? buildFluxBuddyDataUrl(buddy) : '';

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
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg);border-radius:10px;border:1px solid var(--glass-border);">
           <div style="display:flex;align-items:center;gap:12px;">
             <img src="${profile.avatarURL || 'assets/default-avatar.png'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:1px solid var(--glass-border);">
             <div>
               <div style="font-size:13px;font-weight:600;color:var(--text);">Avatar</div>
               <div style="font-size:11px;color:var(--muted);">${profile.avatarSource === 'google' ? 'Synced from Google' : 'Flux Custom'}</div>
             </div>
           </div>
           <button id="edit-change-avatar-btn" type="button" style="padding:6px 14px;background:var(--accent);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px;">Change</button>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg);border-radius:10px;border:1px solid var(--glass-border);">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;">
            <div style="width:40px;height:40px;border-radius:12px;overflow:hidden;border:1px solid var(--glass-border);background:rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${buddySrc ? `<img id="edit-buddy-thumb" src="${buddySrc}" style="width:46px;height:46px;object-fit:contain;">` : `<span style="font-size:18px;">🧍‍♂️</span>`}
            </div>
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="font-size:13px;font-weight:800;color:var(--text);">Flux Buddy</div>
                <span style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:9px;font-weight:900;padding:2px 7px;border-radius:20px;letter-spacing:0.8px;text-transform:uppercase;">Beta</span>
              </div>
              <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Used in chat corners (watching/typing/stickers)</div>
            </div>
          </div>
          <button id="edit-buddy-btn" type="button" style="padding:6px 14px;background:transparent;border:1px solid var(--glass-border);color:var(--text);border-radius:8px;font-weight:800;cursor:pointer;font-size:12px;">Customize</button>
        </div>
        <div>
          <label class="field-label">Bio</label>
          <textarea id="edit-bio" class="input-field" rows="3" maxlength="120" style="resize:none;">${profile.bio || ''}</textarea>
        </div>

        <!-- Theme -->
        <div style="padding:12px;background:var(--bg);border-radius:10px;border:1px solid var(--glass-border);">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">🎨 Profile Theme</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
            <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
              <label class="field-label" style="margin:0;">Banner</label>
              <input type="color" id="edit-banner-color" value="${bannerColor}" style="width:40px;height:36px;border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;padding:2px;">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
              <label class="field-label" style="margin:0;">Accent</label>
              <input type="color" id="edit-accent-color" value="${accentColor}" style="width:40px;height:36px;border:1px solid var(--glass-border);border-radius:8px;cursor:pointer;padding:2px;">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:100px;">
              <label class="field-label" style="margin:0;">Banner Emoji</label>
              <input type="text" id="edit-banner-emoji" value="${bannerEmoji}" maxlength="2"
                style="padding:8px 10px;border:1px solid var(--glass-border);border-radius:8px;font-size:20px;text-align:center;background:var(--bg);color:var(--text);outline:none;width:100%;box-sizing:border-box;">
            </div>
          </div>
          <!-- Preview -->
          <div id="theme-preview" style="margin-top:10px;height:40px;border-radius:8px;background:${bannerColor};display:flex;align-items:center;justify-content:center;font-size:22px;transition:background 0.2s;">${bannerEmoji}</div>
          <div style="margin-top:10px;">
            <label class="field-label" style="margin-bottom:6px;">Banner Effect</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${[['none','✕ None'],['confetti','🎉 Confetti'],['stars','⭐ Stars'],['fire','🔥 Fire']].map(([val, label]) =>
                `<button type="button" class="effect-btn" data-effect="${val}" style="padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid ${currentEffect===val?'var(--accent)':'var(--glass-border)'};background:${currentEffect===val?'var(--accent)':'transparent'};color:${currentEffect===val?'#fff':'var(--text)'};">${label}</button>`
              ).join('')}
            </div>
            <input type="hidden" id="edit-effect" value="${currentEffect}">
          </div>
          <div style="margin-top:10px;">
            <label class="field-label" style="margin-bottom:6px;">Card Style</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              ${[['default','Default'],['rounded','Rounded'],['sharp','Sharp'],['glass','Glass'],['minimal','Minimal']].map(([val, label]) =>
                `<button type="button" class="cardstyle-btn" data-style="${val}" style="padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:2px solid ${currentCardStyle===val?'var(--accent)':'var(--glass-border)'};background:${currentCardStyle===val?'var(--accent)':'transparent'};color:${currentCardStyle===val?'#fff':'var(--text)'};">${label}</button>`
              ).join('')}
            </div>
            <input type="hidden" id="edit-card-style" value="${currentCardStyle}">
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:8px;">💡 Text on your banner auto-adjusts for readability</div>
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

  // Live theme preview
  const updatePreview = () => {
    const preview = document.getElementById('theme-preview');
    if (preview) {
      preview.style.background = document.getElementById('edit-banner-color').value;
      preview.textContent = document.getElementById('edit-banner-emoji').value || '🎮';
    }
  };
  document.getElementById('edit-banner-color').addEventListener('input', updatePreview);
  document.getElementById('edit-banner-emoji').addEventListener('input', updatePreview);

  // Effect buttons
  overlay.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('edit-effect').value = btn.dataset.effect;
      overlay.querySelectorAll('.effect-btn').forEach(b => {
        const on = b === btn;
        b.style.borderColor = on ? 'var(--accent)' : 'var(--glass-border)';
        b.style.background = on ? 'var(--accent)' : 'transparent';
        b.style.color = on ? '#fff' : 'var(--text)';
      });
    });
  });

  // Card style buttons
  overlay.querySelectorAll('.cardstyle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('edit-card-style').value = btn.dataset.style;
      overlay.querySelectorAll('.cardstyle-btn').forEach(b => {
        const on = b === btn;
        b.style.borderColor = on ? 'var(--accent)' : 'var(--glass-border)';
        b.style.background = on ? 'var(--accent)' : 'transparent';
        b.style.color = on ? '#fff' : 'var(--text)';
      });
    });
  });

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
    const bannerColor = document.getElementById('edit-banner-color').value;
    const accentColor = document.getElementById('edit-accent-color').value;
    const bannerEmoji = document.getElementById('edit-banner-emoji').value.trim() || '🎮';
    const effect = document.getElementById('edit-effect').value;
    const cardStyle = document.getElementById('edit-card-style').value;
    const btn = document.getElementById('edit-save');
    const errEl = document.getElementById('edit-error');

    if (!displayName) { errEl.textContent = 'Display name cannot be empty.'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Saving...'; btn.disabled = true;

    await updateProfile(profile.uid, {
      displayName, bio, isPrivate,
      theme: { bannerColor, accentColor, bannerEmoji, effect, cardStyle }
    });
    overlay.remove();
    location.reload();
  });

  document.getElementById('edit-change-avatar-btn')?.addEventListener('click', () => {
    showAvatarSelectionModal(profile);
  });

  document.getElementById('edit-buddy-btn')?.addEventListener('click', () => {
    showBuddyStudio(profile);
  });
}

function showAvatarSelectionModal(profile) {
  const existing = document.getElementById('avatar-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'avatar-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:700;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);';
  
  const avatars = [1,2,3,4,5,6,7,8,9,10,11,12].map(n => `profile pictures/Profile${n}.png`);
  
  overlay.innerHTML = `
    <div style="background:var(--panel,#fff);border-radius:20px;padding:28px;width:100%;max-width:380px;box-shadow:0 30px 80px rgba(0,0,0,0.2);position:relative;animation: modalAppear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
      <button id="avatar-close" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--muted);">✕</button>
      <h3 style="font-family:'Bebas Neue',sans-serif;font-size:26px;margin:0 0 4px;color:var(--text);text-align:center;">Change Avatar</h3>
      <p style="font-size:12px;color:var(--muted);text-align:center;margin:0 0 20px;">Choose a premade icon or upload your own</p>
      
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;margin-bottom:20px;">
        ${avatars.map(url => `
          <div class="avatar-option" data-url="${url}" style="aspect-ratio:1;border-radius:14px;overflow:hidden;cursor:pointer;border:3px solid transparent;transition:all 0.2s;background:#f3f4f6;">
            <img src="${url}" style="width:100%;height:100%;object-fit:cover;">
          </div>
        `).join('')}
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <label style="display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;background:var(--accent);color:white;border-radius:12px;font-weight:700;cursor:pointer;font-size:14px;transition:transform 0.1s;" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
          📤 Upload Custom
          <input type="file" id="avatar-upload-input" accept="image/*" style="display:none;">
        </label>
        
        <button id="avatar-sync-google" style="display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;background:transparent;border:1px solid var(--glass-border);color:var(--text);border-radius:12px;font-weight:600;cursor:pointer;font-size:13px;transition:background 0.2s;" onmouseover="this.style.background='var(--glass-border)'" onmouseout="this.style.background='transparent'">
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sync from Google
        </button>
      </div>

      <div id="avatar-loader" style="display:none;position:absolute;inset:0;background:rgba(255,255,255,0.8);border-radius:20px;align-items:center;justify-content:center;flex-direction:column;gap:12px;z-index:5;">
        <img src="assets/loading.gif" style="width:60px;">
        <span style="font-size:13px;color:var(--text);font-weight:600;">Updating...</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('avatar-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const setAvatar = async (url, source) => {
    document.getElementById('avatar-loader').style.display = 'flex';
    try {
      await updateProfile(profile.uid, { avatarURL: url, avatarSource: source });
      location.reload();
    } catch (err) {
      alert("Failed to update avatar: " + err.message);
      document.getElementById('avatar-loader').style.display = 'none';
    }
  };

  // Premade Icons
  overlay.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      opt.style.borderColor = 'var(--accent)';
      setAvatar(opt.dataset.url, 'premade');
    });
  });

  // Custom Upload
  document.getElementById('avatar-upload-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("File too large! Max 2MB."); return; }

    const reader = new FileReader();
    reader.onload = (re) => setAvatar(re.target.result, 'flux');
    reader.readAsDataURL(file);
  });

  // Google Sync
  document.getElementById('avatar-sync-google').addEventListener('click', async () => {
     document.getElementById('avatar-loader').style.display = 'flex';
     const updated = await syncProfileAvatar(true); // force = true
     if (updated) location.reload();
     else {
       alert("No change detected from Google Profile.");
       document.getElementById('avatar-loader').style.display = 'none';
     }
  });
}

function showBuddyStudio(profile) {
  const existing = document.getElementById('buddy-studio-overlay');
  if (existing) existing.remove();

  const start = normalizeFluxBuddy(profile?.fluxBuddy || FLUX_BUDDY_DEFAULT);

  const overlay = document.createElement('div');
  overlay.id = 'buddy-studio-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:750;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);';
  overlay.innerHTML = `
    <style>
      @keyframes buddyFloat {
        0%, 100% { transform: translateY(0) rotate(-0.6deg); }
        50% { transform: translateY(-6px) rotate(0.6deg); }
      }
    </style>
    <div style="width:min(860px, calc(100vw - 24px));background:var(--panel);border-radius:22px;border:1px solid var(--glass-border);box-shadow:0 30px 90px rgba(0,0,0,0.25);overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--glass-border);gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--text);letter-spacing:1px;">Flux Buddy</div>
          <span style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;font-size:9px;font-weight:900;padding:2px 7px;border-radius:20px;letter-spacing:0.8px;text-transform:uppercase;">Beta</span>
        </div>
        <button id="buddy-close" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:360px 1fr;gap:0;">
        <div style="padding:18px;border-right:1px solid var(--glass-border);">
          <div style="height:340px;border-radius:18px;border:1px solid var(--glass-border);background:radial-gradient(160px 120px at 50% 20%, rgba(58,125,255,0.25), rgba(0,0,0,0) 70%), var(--bg);display:flex;align-items:flex-end;justify-content:center;position:relative;overflow:hidden;">
            <div style="position:absolute;left:16px;right:16px;bottom:14px;height:26px;border-radius:999px;background:rgba(0,0,0,0.05);border:1px solid var(--glass-border);"></div>
            <img id="buddy-preview" alt="Buddy preview" style="width:220px;height:auto;transform-origin:50% 100%;animation:buddyFloat 2.8s ease-in-out infinite;filter:drop-shadow(0 10px 18px rgba(0,0,0,0.12));">
          </div>
          <div style="margin-top:12px;color:var(--muted);font-size:12px;line-height:1.35;">
            Buddy is separate from your profile picture and appears in chat corners (watching/typing/stickers).
          </div>
        </div>

        <div style="padding:18px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Skin</span>
              <input id="buddy-skin" type="color" value="${start.skin}" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:transparent;padding:2px;cursor:pointer;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Hair</span>
              <input id="buddy-hair" type="color" value="${start.hair}" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:transparent;padding:2px;cursor:pointer;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Shirt</span>
              <input id="buddy-shirt" type="color" value="${start.shirt}" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:transparent;padding:2px;cursor:pointer;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Pants</span>
              <input id="buddy-pants" type="color" value="${start.pants}" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:transparent;padding:2px;cursor:pointer;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Shoes</span>
              <input id="buddy-shoes" type="color" value="${start.shoes}" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:transparent;padding:2px;cursor:pointer;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Hair Style</span>
              <select id="buddy-hairStyle" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg);color:var(--text);padding:0 10px;font-weight:900;">
                ${['short','long','spiky','bun'].map(v => `<option value="${v}" ${start.hairStyle===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Eyes</span>
              <select id="buddy-eyes" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg);color:var(--text);padding:0 10px;font-weight:900;">
                ${['normal','happy'].map(v => `<option value="${v}" ${start.eyes===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Mouth</span>
              <select id="buddy-mouth" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg);color:var(--text);padding:0 10px;font-weight:900;">
                ${['smile','neutral'].map(v => `<option value="${v}" ${start.mouth===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </label>
            <label style="grid-column:1/-1;display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:10px;font-weight:900;color:var(--muted);letter-spacing:0.6px;text-transform:uppercase;">Accessory</span>
              <select id="buddy-accessory" style="height:34px;border-radius:10px;border:1px solid var(--glass-border);background:var(--bg);color:var(--text);padding:0 10px;font-weight:900;">
                ${['none','glasses','cap'].map(v => `<option value="${v}" ${start.accessory===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}
              </select>
            </label>
          </div>

          <div style="display:flex;gap:10px;margin-top:14px;">
            <button id="buddy-reset" style="flex:1;padding:10px 12px;border:1px solid var(--glass-border);border-radius:12px;background:transparent;color:var(--text);font-weight:900;cursor:pointer;">Reset</button>
            <button id="buddy-save" style="flex:1;padding:10px 12px;border:none;border-radius:12px;background:var(--accent);color:white;font-weight:900;cursor:pointer;">Save Buddy</button>
          </div>
          <div id="buddy-error" style="display:none;margin-top:10px;color:#ef4444;font-size:12px;font-weight:700;text-align:center;"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#buddy-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const els = {
    preview: overlay.querySelector('#buddy-preview'),
    skin: overlay.querySelector('#buddy-skin'),
    hair: overlay.querySelector('#buddy-hair'),
    shirt: overlay.querySelector('#buddy-shirt'),
    pants: overlay.querySelector('#buddy-pants'),
    shoes: overlay.querySelector('#buddy-shoes'),
    hairStyle: overlay.querySelector('#buddy-hairStyle'),
    eyes: overlay.querySelector('#buddy-eyes'),
    mouth: overlay.querySelector('#buddy-mouth'),
    accessory: overlay.querySelector('#buddy-accessory'),
    reset: overlay.querySelector('#buddy-reset'),
    save: overlay.querySelector('#buddy-save'),
    err: overlay.querySelector('#buddy-error'),
  };

  const read = () => normalizeFluxBuddy({
    skin: els.skin.value,
    hair: els.hair.value,
    shirt: els.shirt.value,
    pants: els.pants.value,
    shoes: els.shoes.value,
    hairStyle: els.hairStyle.value,
    eyes: els.eyes.value,
    mouth: els.mouth.value,
    accessory: els.accessory.value,
  });

  const render = () => { if (els.preview) els.preview.src = buildFluxBuddyDataUrl(read()); };
  render();
  [els.skin, els.hair, els.shirt, els.pants, els.shoes, els.hairStyle, els.eyes, els.mouth, els.accessory].forEach(el => {
    el?.addEventListener('input', render);
    el?.addEventListener('change', render);
  });

  els.reset?.addEventListener('click', () => {
    const d = { ...FLUX_BUDDY_DEFAULT };
    els.skin.value = d.skin; els.hair.value = d.hair; els.shirt.value = d.shirt; els.pants.value = d.pants; els.shoes.value = d.shoes;
    els.hairStyle.value = d.hairStyle; els.eyes.value = d.eyes; els.mouth.value = d.mouth; els.accessory.value = d.accessory;
    render();
  });

  els.save?.addEventListener('click', async () => {
    els.err.style.display = 'none';
    const prev = els.save.textContent;
    els.save.textContent = 'Saving…';
    els.save.disabled = true;
    try {
      const buddy = read();
      await updateProfile(profile.uid, { fluxBuddy: buddy, fluxBuddyUpdatedAt: new Date().toISOString() });
      close();
      location.reload();
    } catch (e) {
      els.err.textContent = 'Could not save Buddy.';
      els.err.style.display = 'block';
      console.warn('Buddy save failed:', e);
      els.save.textContent = prev;
      els.save.disabled = false;
    }
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


setTimeout(() => { if(window.hideGlobalLoader) window.hideGlobalLoader(); }, 600);
