import {
  SERVER_PROFILES,
  getActiveServer,
  setActiveServer,
  getLocalLibraryState,
} from './server-config.js';

const serverProfilesEl = document.getElementById('server-profiles-settings');
const activeServerLabel = document.getElementById('active-server-settings-label');
const localLibraryStatus = document.getElementById('local-library-status');

if (serverProfilesEl && activeServerLabel && localLibraryStatus) {
  function serverToast(message, type = 'info') {
    const colors = { info: '#111827', success: '#16a34a', warning: '#d97706' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:${colors[type] || colors.info};color:white;padding:12px 20px;border-radius:18px;font-size:13px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.22);opacity:0;transition:opacity 0.2s;max-width:calc(100vw - 40px);text-align:center;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.style.opacity = '1');
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 200); }, 2600);
  }

  function refreshRepositoryStatus() {
    const state = getLocalLibraryState();
    const count = state.availableCount || 0;
    localLibraryStatus.textContent = count
      ? `/games/ repository scan found ${count} playable game folder${count === 1 ? '' : 's'}.`
      : 'Games are loaded from /games/<exact-game-name>/index.html in this repository. The Games page checks availability automatically.';
  }

  function renderServerSettings() {
    const active = getActiveServer();
    activeServerLabel.textContent = `${active.icon} ${active.name}`;
    serverProfilesEl.innerHTML = Object.values(SERVER_PROFILES).map(profile => `
      <button type="button" class="server-profile-option" data-server-id="${profile.id}" style="width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:12px;border:1px solid ${active.id === profile.id ? 'rgba(58,125,255,0.55)' : 'var(--glass-border)'};border-radius:12px;background:${active.id === profile.id ? 'rgba(58,125,255,0.08)' : 'var(--bg,#f9fafb)'};color:var(--text);cursor:pointer;font-family:inherit;transition:all 0.15s;">
        <span style="font-size:22px;line-height:1;">${profile.icon}</span>
        <span style="flex:1;min-width:0;"><span style="display:block;font-size:13px;font-weight:800;">${profile.name}</span><span style="display:block;font-size:11px;color:var(--muted);margin-top:2px;">${profile.description}</span></span>
        <span style="font-size:10px;font-weight:800;color:${active.id === profile.id ? 'var(--accent)' : 'var(--muted)'};">${active.id === profile.id ? 'ACTIVE' : 'USE'}</span>
      </button>
    `).join('');
    serverProfilesEl.querySelectorAll('[data-server-id]').forEach(button => button.addEventListener('click', () => {
      const profile = setActiveServer(button.dataset.serverId);
      renderServerSettings();
      refreshRepositoryStatus();
      serverToast(`${profile.icon} ${profile.name} selected`, 'success');
      if (profile.id === 'local') serverToast('Local Library uses the repository /games folder.', 'info');
    }));
  }

  renderServerSettings();
  refreshRepositoryStatus();
  window.addEventListener('flux-server-changed', renderServerSettings);
  window.addEventListener('flux-local-library-changed', refreshRepositoryStatus);
}
