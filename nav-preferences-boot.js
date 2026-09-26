// Apply the persistent navigation preference before the page renders.
(() => {
  try {
    if (localStorage.getItem('flux_bottom_nav') === '1') {
      document.documentElement.classList.add('flux-bottom-nav');
    }
  } catch {}
})();
