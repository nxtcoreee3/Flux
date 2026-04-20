// index-boot.js — minimal homepage boot to keep first paint fast

// Hide loader ASAP (do not wait for big modules) when Fast Boot is enabled
function hideLoaderFast() {
  try {
    if (localStorage.getItem('flux_fast_boot') !== '1') return;
  } catch {
    return;
  }
  const loader = document.getElementById('global-page-loader');
  if (!loader) return;
  loader.style.opacity = '0';
  setTimeout(() => loader.remove(), 420);
}

setTimeout(hideLoaderFast, 80);
requestAnimationFrame(hideLoaderFast);
window.addEventListener('pageshow', hideLoaderFast, { once: true });

// Nav toggle + year (tiny UX essentials)
document.addEventListener('click', (e) => {
  const toggle = document.querySelector('.nav-toggle');
  if (!toggle) return;
  if (e.target === toggle) {
    const nav = document.getElementById('main-nav');
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!expanded));
    nav.style.display = expanded ? '' : 'flex';
  }
});

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Render a tiny placeholder so it doesn't feel empty
const grid = document.getElementById('game-grid');
if (grid && !grid.children.length) {
  grid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);font-size:13px;padding:14px 0;">Loading featured games…</div>';
}

// Load the full app bundle in idle time (does not block first paint)
const loadFull = () => import('./script.js').catch(() => {});
try {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadFull, { timeout: 1200 });
  } else {
    setTimeout(loadFull, 350);
  }
} catch {
  setTimeout(loadFull, 350);
}
