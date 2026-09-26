/*
 * Flux server profiles and repository-relative game discovery.
 * Local Library maps each catalog game to ./games/<repository-folder>/index.html.
 */

export const SERVER_STORAGE_KEY = 'flux_active_server';
export const LOCAL_MANIFEST_KEY = 'flux_local_repository_manifest';
export const PROVIDER_BLACKLIST_KEY = 'flux_provider_blacklist';
export const REPOSITORY_GAMES_ROOT = './games/';

export const EXTERNAL_PROVIDER_KEY = 'flux_external_provider';
export const EXTERNAL_PROVIDERS = Object.freeze({
  zapgames: Object.freeze({ id: 'zapgames', name: 'ZapGames', icon: '🎮', attribution: 'ZapGames B.V. · zapgames.io', description: '220 public games from ZapGames.io.' }),
  poki: Object.freeze({ id: 'poki', name: 'Poki', icon: '🟣', attribution: 'Poki · poki.com', description: 'Curated games from Poki.com.' }),
});
export const SERVER_PROFILES = Object.freeze({
  cloud: Object.freeze({
    id: 'cloud', name: 'Flux Cloud', shortName: 'Cloud', icon: '☁️',
    eyebrow: 'Official hosted service', description: 'Use the official Flux-hosted game library.', kind: 'remote',
  }),
  all: Object.freeze({
    id: 'all', name: 'All Game Providers', shortName: 'All', icon: '🌐',
    eyebrow: 'Combined game catalog', description: 'Browse games from Flux Cloud, Local Library, and available external providers.', kind: 'remote',
    allProviders: true,
  }),
  external: Object.freeze({
    id: 'external', name: 'External Cloud Gaming', shortName: 'External', icon: '🎮',
    eyebrow: 'External provider category', description: 'Choose a catalog from supported external game providers.', kind: 'remote',
    external: true,
  }),
  local: Object.freeze({
    id: 'local', name: 'Local Library', shortName: 'Local', icon: '💾',
    eyebrow: 'Repository game service', description: 'Use game folders shipped inside this Flux repository.', kind: 'repository',
  }),
});
const availability = new Map();
const paths = new Map();
let scanInFlight = null;

function safeStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeStorageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

function normalizeFolderName(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '');
}

function getCatalogFolderName(game) {
  // Flux catalog URLs already use the exact repository folder names, for example
  // https://nxtcoreee3.github.io/Drive-Mad/ -> games/Drive-Mad/.
  // Eaglercraft is the one catalog entry whose hosted URL is on a different
  // provider, so its local repository folder keeps the catalog name explicitly.
  if (String(game?.id || '').toLowerCase() === 'eaglercraft') return 'Eaglercraft';
  try {
    const pathname = new URL(game?.url || '', window.location.href).pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length) return decodeURIComponent(segments[segments.length - 1]);
  } catch {}
  return String(game?.id || '').replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`);
}

export function getRepositoryGameFolder(game) {
  return normalizeFolderName(getCatalogFolderName(game));
}

export function getRepositoryGameCandidates(game) {
  const folder = getRepositoryGameFolder(game);
  return folder ? [`${REPOSITORY_GAMES_ROOT}${encodeURIComponent(folder)}/index.html`, `${REPOSITORY_GAMES_ROOT}${encodeURIComponent(folder)}/index.htm`] : [];
}

function readManifest() {
  try {
    const value = JSON.parse(safeStorageGet(LOCAL_MANIFEST_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function saveManifest(entries) {
  const compact = entries.map(entry => ({ id: entry.id, folder: entry.folder, path: entry.path, status: entry.status }));
  safeStorageSet(LOCAL_MANIFEST_KEY, JSON.stringify(compact));
  try { window.dispatchEvent(new CustomEvent('flux-local-library-changed', { detail: { entries: compact } })); } catch {}
  return compact;
}

function readProviderBlacklist() {
  try {
    const value = JSON.parse(safeStorageGet(PROVIDER_BLACKLIST_KEY) || '[]');
    return Array.isArray(value) ? value.filter(id => Object.prototype.hasOwnProperty.call(EXTERNAL_PROVIDERS, id)) : [];
  } catch { return []; }
}
export function getBlacklistedProviders() { return readProviderBlacklist(); }
export function isProviderBlacklisted(id) { return readProviderBlacklist().includes(id); }
export function getAvailableExternalProviders() {
  return Object.values(EXTERNAL_PROVIDERS).filter(provider => !isProviderBlacklisted(provider.id));
}
export function getExternalProviderId() {
  const saved = safeStorageGet(EXTERNAL_PROVIDER_KEY);
  if (saved && EXTERNAL_PROVIDERS[saved] && !isProviderBlacklisted(saved)) return saved;
  return getAvailableExternalProviders()[0]?.id || null;
}
export function setExternalProvider(providerId) {
  const id = EXTERNAL_PROVIDERS[providerId] && !isProviderBlacklisted(providerId)
    ? providerId : getAvailableExternalProviders()[0]?.id || null;
  if (id) safeStorageSet(EXTERNAL_PROVIDER_KEY, id);
  try { window.dispatchEvent(new CustomEvent('flux-external-provider-changed', { detail: EXTERNAL_PROVIDERS[id] || null })); } catch {}
  return id ? EXTERNAL_PROVIDERS[id] : null;
}
export function setProviderBlacklisted(id, blocked) {
  if (!EXTERNAL_PROVIDERS[id]) return getBlacklistedProviders();
  const next = new Set(readProviderBlacklist());
  if (blocked) next.add(id); else next.delete(id);
  const value = [...next];
  safeStorageSet(PROVIDER_BLACKLIST_KEY, JSON.stringify(value));
  if (blocked && getExternalProviderId() === id) setExternalProvider(id);
  try { window.dispatchEvent(new CustomEvent('flux-provider-blacklist-changed', { detail: value })); } catch {}
  return value;
}
export function getSelectableServerProfiles() {
  return Object.values(SERVER_PROFILES).filter(profile => profile.id !== 'external' || getAvailableExternalProviders().length > 0);
}
export function getActiveServerId() {
  const saved = safeStorageGet(SERVER_STORAGE_KEY);
  if (saved === 'zapgames' || saved === 'poki') {
    safeStorageSet(EXTERNAL_PROVIDER_KEY, saved);
    safeStorageSet(SERVER_STORAGE_KEY, 'external');
    return 'external';
  }
  return Object.prototype.hasOwnProperty.call(SERVER_PROFILES, saved) && (saved !== 'external' || getAvailableExternalProviders().length > 0) ? saved : 'cloud';
}
export function getActiveServer() { return SERVER_PROFILES[getActiveServerId()]; }
export function setActiveServer(serverId) {
  const id = Object.prototype.hasOwnProperty.call(SERVER_PROFILES, serverId) && (serverId !== 'external' || getAvailableExternalProviders().length > 0) ? serverId : 'cloud';
  safeStorageSet(SERVER_STORAGE_KEY, id);
  const profile = SERVER_PROFILES[id];
  try { window.dispatchEvent(new CustomEvent('flux-server-changed', { detail: profile })); } catch {}
  return profile;
}
export function getLocalManifest() {
  return readManifest();
}

export function getLocalLibraryState() {
  const entries = readManifest();
  const availableCount = entries.filter(entry => entry.status === 'available').length;
  const checkedCount = entries.filter(entry => entry.status !== 'checking').length;
  return {
    ready: true,
    live: true,
    rootName: '/games',
    entries,
    availableCount,
    checkedCount,
    source: 'repository',
  };
}

export function getGameLocalEntry(game) {
  const path = paths.get(game?.id);
  const status = availability.get(game?.id);
  return status === 'available' && path ? { path } : null;
}

export function getGameAvailability(game) {
  const server = getActiveServer();
  if (server.kind !== 'repository') return { available: true, checking: false, configured: true, server, entry: null };
  const status = availability.get(game?.id);
  const entry = getGameLocalEntry(game);
  return {
    available: status === 'available',
    checking: status === undefined || status === 'checking',
    configured: true,
    server,
    entry,
  };
}

export function isGameAvailable(game) {
  return getGameAvailability(game).available;
}

function toAbsolutePath(path) {
  try { return new URL(path, document.baseURI).href; } catch { return path; }
}

async function headOrGet(path) {
  try {
    const head = await fetch(toAbsolutePath(path), { method: 'HEAD', cache: 'no-store' });
    if (head.ok) return true;
    if (head.status !== 405 && head.status !== 501) return false;
  } catch {}
  try {
    const response = await fetch(toAbsolutePath(path), { method: 'GET', cache: 'no-store' });
    return response.ok;
  } catch { return false; }
}

export async function checkRepositoryGame(game) {
  if (!game?.id) return { id: '', status: 'missing', path: null };
  const candidates = getRepositoryGameCandidates(game);
  availability.set(game.id, 'checking');
  for (const candidate of candidates) {
    if (await headOrGet(candidate)) {
      availability.set(game.id, 'available');
      paths.set(game.id, candidate);
      return { id: game.id, folder: getRepositoryGameFolder(game), path: candidate, status: 'available' };
    }
  }
  availability.set(game.id, 'missing');
  paths.delete(game.id);
  return { id: game.id, folder: getRepositoryGameFolder(game), path: null, status: 'missing' };
}

export async function scanLocalGames(games = []) {
  if (getActiveServerId() !== 'local') return [];
  if (scanInFlight) return scanInFlight;
  scanInFlight = Promise.all(games.map(game => checkRepositoryGame(game)))
    .then(results => {
      saveManifest(results);
      return results;
    })
    .finally(() => { scanInFlight = null; });
  return scanInFlight;
}

export async function getGameLaunchUrl(game) {
  const server = getActiveServer();
  if (server.id === 'all' && game?.sourceServer === 'external') return game?.url || null;
  if (server.kind !== 'repository' || (server.id === 'all' && game?.sourceServer !== 'local')) return game?.url || null;
  if (availability.get(game?.id) !== 'available') await checkRepositoryGame(game);
  return paths.get(game?.id) ? toAbsolutePath(paths.get(game?.id)) : null;
}
export async function initializeServerRuntime(games = []) {
  if (getActiveServerId() === 'local' && games.length) await scanLocalGames(games);
  return getLocalLibraryState();
}

export function getServerSummary() {
  const server = getActiveServer();
  const state = getLocalLibraryState();
  return { ...server, localReady: true, localEntryCount: state.availableCount, localRootName: state.rootName };
}
