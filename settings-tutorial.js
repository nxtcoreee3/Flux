/* ===================== SETTINGS TUTORIAL ===================== */
const tutorialSteps = [
  {
    selector: '#game-servers-section',
    eyebrow: '1 of 5 · Game routing',
    title: 'Choose where your games come from',
    body: 'Flux Cloud loads the hosted games. Local Library reads the matching folders inside this repository’s /games directory.'
  },
  {
    selector: '#server-profiles-settings',
    eyebrow: '2 of 5 · Server profiles',
    title: 'Switch servers in one click',
    body: 'Pick a profile here, or use the same quick switcher from your profile dropdown on any Flux page. Your choice is saved in this browser.'
  },
  {
    selector: '#local-library-status',
    eyebrow: '3 of 5 · Local Library',
    title: 'See whether local games are ready',
    body: 'Flux checks /games/<exact-game-name>/index.html automatically. If a matching folder is missing, that game is shown as unavailable instead of opening a broken page.'
  },
  {
    selector: '#dark-toggle-settings',
    eyebrow: '4 of 5 · Appearance',
    title: 'Make Flux feel like yours',
    body: 'Toggle Dark Mode or try the Beta UI from Settings. These preferences are kept for your next visit.'
  },
  {
    selector: '#tutorial-settings-btn',
    eyebrow: '5 of 5 · Help',
    title: 'Replay this walkthrough anytime',
    body: 'You can restart this guide whenever you need a refresher. That’s the tour—enjoy Flux.'
  }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function startSettingsTutorial() {
  document.getElementById('flux-settings-tutorial')?.remove();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const overlay = document.createElement('div');
  overlay.id = 'flux-settings-tutorial';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Flux Settings tutorial');
  overlay.innerHTML = `
    <div class="flux-settings-tutorial__backdrop"></div>
    <div class="flux-settings-tutorial__spotlight" aria-hidden="true"></div>
    <section class="flux-settings-tutorial__card">
      <div class="flux-settings-tutorial__eyebrow" data-tutorial-eyebrow></div>
      <h2 data-tutorial-title></h2>
      <p data-tutorial-body></p>
      <div class="flux-settings-tutorial__footer">
        <button type="button" class="flux-settings-tutorial__skip" data-tutorial-skip>Skip tour</button>
        <div class="flux-settings-tutorial__actions">
          <button type="button" class="flux-settings-tutorial__back" data-tutorial-back>Back</button>
          <button type="button" class="flux-settings-tutorial__next" data-tutorial-next>Next</button>
        </div>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);

  const spotlight = overlay.querySelector('[data-tutorial-spotlight]') || overlay.querySelector('.flux-settings-tutorial__spotlight');
  const card = overlay.querySelector('.flux-settings-tutorial__card');
  const eyebrow = overlay.querySelector('[data-tutorial-eyebrow]');
  const title = overlay.querySelector('[data-tutorial-title]');
  const body = overlay.querySelector('[data-tutorial-body]');
  const backButton = overlay.querySelector('[data-tutorial-back]');
  const nextButton = overlay.querySelector('[data-tutorial-next]');
  const skipButton = overlay.querySelector('[data-tutorial-skip]');
  const previousOverflow = document.body.style.overflow;
  let currentStep = 0;
  let previousFocusedElement = document.activeElement;

  const close = () => {
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    document.body.style.overflow = previousOverflow;
    overlay.remove();
    previousFocusedElement?.focus?.({ preventScroll: true });
  };

  function position() {
    const step = tutorialSteps[currentStep];
    const target = document.querySelector(step.selector);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const pad = 7;
    spotlight.style.left = `${Math.max(8, rect.left - pad)}px`;
    spotlight.style.top = `${Math.max(8, rect.top - pad)}px`;
    spotlight.style.width = `${Math.max(0, rect.width + pad * 2)}px`;
    spotlight.style.height = `${Math.max(0, rect.height + pad * 2)}px`;

    const cardWidth = Math.min(370, window.innerWidth - 32);
    const cardHeight = card.getBoundingClientRect().height || 190;
    const gap = 18;
    let left = clamp(rect.left, 16, window.innerWidth - cardWidth - 16);
    let top = rect.bottom + gap;
    if (top + cardHeight > window.innerHeight - 16) top = rect.top - cardHeight - gap;
    if (top < 16) top = clamp((window.innerHeight - cardHeight) / 2, 16, window.innerHeight - cardHeight - 16);
    card.style.width = `${cardWidth}px`;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function renderStep() {
    const step = tutorialSteps[currentStep];
    const target = document.querySelector(step.selector);
    if (!target) {
      if (currentStep < tutorialSteps.length - 1) { currentStep += 1; renderStep(); }
      else close();
      return;
    }
    eyebrow.textContent = step.eyebrow;
    title.textContent = step.title;
    body.textContent = step.body;
    backButton.disabled = currentStep === 0;
    backButton.style.visibility = currentStep === 0 ? 'hidden' : 'visible';
    nextButton.textContent = currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next';
    target.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    requestAnimationFrame(() => setTimeout(position, reducedMotion ? 0 : 180));
    nextButton.focus({ preventScroll: true });
  }

  nextButton.addEventListener('click', () => {
    if (currentStep === tutorialSteps.length - 1) { close(); return; }
    currentStep += 1;
    renderStep();
  });
  backButton.addEventListener('click', () => {
    if (currentStep === 0) return;
    currentStep -= 1;
    renderStep();
  });
  skipButton.addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay || event.target.classList.contains('flux-settings-tutorial__backdrop')) close(); });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') nextButton.click();
    if (event.key === 'ArrowLeft') backButton.click();
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  document.body.style.overflow = 'hidden';
  renderStep();
}

window.startFluxTutorial = startSettingsTutorial;

if (new URLSearchParams(window.location.search).get('tutorial') === '1') {
  const launch = () => setTimeout(startSettingsTutorial, 350);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', launch, { once: true });
  else launch();
}

export { startSettingsTutorial };
