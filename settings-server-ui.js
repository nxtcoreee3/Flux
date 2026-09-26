import {
  SERVER_PROFILES,
  getActiveServer,
  setActiveServer,
  getLocalLibraryState,
  setProviderBlacklisted,
  isProviderBlacklisted,
  getExternalProviderId,
  setExternalProvider,
  EXTERNAL_PROVIDERS,
} from './server-config.js';

const serverProfilesEl = document.getElementById('server-profiles-settings');
const activeServerLabel = document.getElementById('active-server-settings-label');
const blacklistEl = document.getElementById('provider-blacklist-settings');
const externalProviderEl = document.getElementById('external-provider-settings');
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
    const active = getActiveServer();
    if (active.external) {
      localLibraryStatus.textContent = `${active.name} is enabled. Games are loaded from the provider catalog.`;
      return;
    }
    const state = getLocalLibraryState();
    const count = state.availableCount || 0;
    localLibraryStatus.textContent = count
      ? `/games/ repository scan found ${count} playable game folder${count === 1 ? '' : 's'}.`
      : 'Games are loaded from /games/<exact-game-name>/index.html in this repository. The Games page checks availability automatically.';
  }

  function renderProviderBlacklist() {
    if (!blacklistEl) return;
    const providers = Object.values(EXTERNAL_PROVIDERS);
    blacklistEl.innerHTML = `
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:4px;">Provider access</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:10px;">Block a provider if its domain is unavailable on your Wi‑Fi. Blocked providers disappear from the external catalog options.</div>
      <div style="display:flex;flex-direction:column;gap:7px;">${providers.map(profile => `
        <label style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--glass-border);border-radius:10px;background:var(--bg,#f9fafb);cursor:pointer;">
          <input type="checkbox" data-provider-blacklist="${profile.id}" ${isProviderBlacklisted(profile.id) ? 'checked' : ''} style="accent-color:#ef4444;width:16px;height:16px;">
          <span style="font-size:17px;">${profile.icon}</span>
          <span style="flex:1;min-width:0;"><strong style="display:block;font-size:12px;color:var(--text);">${profile.name}</strong><small style="color:var(--muted);">${profile.attribution || profile.description}</small></span>
          <span style="font-size:10px;font-weight:800;color:${isProviderBlacklisted(profile.id) ? '#ef4444' : '#16a34a'};">${isProviderBlacklisted(profile.id) ? 'BLOCKED' : 'ALLOWED'}</span>
        </label>`).join('')}</div>`;
    blacklistEl.querySelectorAll('[data-provider-blacklist]').forEach(input => {
      input.addEventListener('change', () => {
        setProviderBlacklisted(input.dataset.providerBlacklist, input.checked);
        renderProviderBlacklist();
        renderServerSettings();
        serverToast(input.checked ? 'Provider blocked on this device' : 'Provider allowed again', input.checked ? 'warning' : 'success');
      });
    });
  }
  function renderExternalProvider() {
    if (!externalProviderEl) return;
    const activeId = getExternalProviderId();
    const providers = Object.values(EXTERNAL_PROVIDERS).filter(provider => !isProviderBlacklisted(provider.id));
    externalProviderEl.innerHTML = `
      <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:4px;">External catalog</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.45;margin-bottom:10px;">Choose which provider appears when External Cloud Gaming is selected.</div>
      <div style="display:flex;flex-direction:column;gap:7px;">${providers.map(provider => `
        <button type="button" data-external-provider="${provider.id}" style="display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:1px solid ${provider.id === activeId ? 'rgba(58,125,255,0.55)' : 'var(--glass-border)'};border-radius:10px;background:${provider.id === activeId ? 'rgba(58,125,255,0.08)' : 'var(--bg,#f9fafb)'};color:var(--text);cursor:pointer;text-align:left;font-family:inherit;">
          <span style="font-size:17px;">${provider.icon}</span><span style="flex:1;min-width:0;"><strong style="display:block;font-size:12px;">${provider.name}</strong><small style="color:var(--muted);">${provider.description}</small></span><span style="font-size:10px;font-weight:800;color:${provider.id === activeId ? 'var(--accent)' : 'var(--muted)'};">${provider.id === activeId ? 'ACTIVE' : 'USE'}</span>
        </button>`).join('')}</div>`;
    externalProviderEl.querySelectorAll('[data-external-provider]').forEach(button => button.addEventListener('click', () => {
      const provider = setExternalProvider(button.dataset.externalProvider);
      renderExternalProvider();
      serverToast(`${provider?.icon || ''} ${provider?.name || 'Provider'} selected`, 'success');
    }));
  }
  function renderServerSettings() {
    const active = getActiveServer();
    activeServerLabel.textContent = `${active.icon} ${active.name}`;
    serverProfilesEl.innerHTML = Object.values(SERVER_PROFILES).filter(profile => !isProviderBlacklisted(profile.id)).map(profile => `
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
  renderProviderBlacklist();
  renderExternalProvider();
  refreshRepositoryStatus();
  window.addEventListener('flux-server-changed', () => { renderServerSettings(); renderProviderBlacklist(); renderExternalProvider(); });
  window.addEventListener('flux-provider-blacklist-changed', () => { renderServerSettings(); renderProviderBlacklist(); renderExternalProvider(); });
  window.addEventListener('flux-external-provider-changed', renderExternalProvider);
  window.addEventListener('flux-local-library-changed', refreshRepositoryStatus);
}
