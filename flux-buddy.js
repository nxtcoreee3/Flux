// flux-buddy.js — Fluxy (simple buddy avatar) (BETA)
//
// NOTE: We keep the export names (`fluxBuddy`) for backwards compatibility with saved profiles.

export const FLUX_BUDDY_DEFAULT = Object.freeze({
  body: '#b7d7ff',
  face: 'neutral', // see `FACES`
});

const FACES = [
  'neutral',
  'smile',
  'grin',
  'sad',
  'angry',
  'surprised',
  'sleepy',
  'wink',
  'cool',
  'blush',
  'love',
  'dead',
];

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(v => Number.isNaN(v))) return null;
  return { r, g, b };
}

function rgbToHex({ r, g, b }) {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function darken(hex, amount = 0.18) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex({
    r: rgb.r * (1 - amount),
    g: rgb.g * (1 - amount),
    b: rgb.b * (1 - amount),
  });
}

function withAlpha(hex, a = 0.3) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

export function normalizeFluxBuddy(input) {
  const o = input && typeof input === 'object' ? input : {};

  // Migration: old schema → new schema
  const body = o.body || o.bodyColor || o.color || o.shirt || o.skin || FLUX_BUDDY_DEFAULT.body;
  const face = o.face || o.mood || FLUX_BUDDY_DEFAULT.face;

  return {
    body: typeof body === 'string' ? body : FLUX_BUDDY_DEFAULT.body,
    face: FACES.includes(face) ? face : FLUX_BUDDY_DEFAULT.face,
  };
}

function faceSvg(face) {
  const stroke = '#0b1220';
  const sw = 8;
  const dot = 8;

  const eyesNormal = `<circle cx="68" cy="86" r="${dot}" fill="${stroke}"/><circle cx="112" cy="86" r="${dot}" fill="${stroke}"/>`;
  const eyesHappy = `<path d="M56 86c8 10 16 10 24 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
                     <path d="M100 86c8 10 16 10 24 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const eyesSleepy = `<path d="M56 86h24" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
                      <path d="M100 86h24" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const eyesDead = `<path d="M58 78l20 16M58 94l20-16" stroke="${stroke}" stroke-width="${sw-1}" stroke-linecap="round" fill="none"/>
                    <path d="M102 78l20 16M102 94l20-16" stroke="${stroke}" stroke-width="${sw-1}" stroke-linecap="round" fill="none"/>`;
  const eyesWink = `<circle cx="68" cy="86" r="${dot}" fill="${stroke}"/><path d="M100 86h24" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const eyesCool = `<rect x="50" y="76" width="40" height="22" rx="10" fill="${stroke}"/><rect x="92" y="76" width="40" height="22" rx="10" fill="${stroke}"/><path d="M90 87h4" stroke="${stroke}" stroke-width="${sw-2}" stroke-linecap="round"/>`;
  const eyesLove = `<path d="M64 92c-8-6-14-12-14-20 0-6 4-10 10-10 5 0 8 3 10 7 2-4 5-7 10-7 6 0 10 4 10 10 0 8-6 14-14 20z" fill="${stroke}"/>
                    <path d="M108 92c-8-6-14-12-14-20 0-6 4-10 10-10 5 0 8 3 10 7 2-4 5-7 10-7 6 0 10 4 10 10 0 8-6 14-14 20z" fill="${stroke}"/>`;

  const mouthNeutral = `<path d="M70 126h40" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const mouthSmile = `<path d="M66 122c10 16 48 16 58 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const mouthGrin = `<path d="M66 120c10 18 48 18 58 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
                     <path d="M76 124h28" stroke="${stroke}" stroke-width="${sw-3}" stroke-linecap="round" opacity="0.45"/>`;
  const mouthSad = `<path d="M66 132c10-16 48-16 58 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const mouthAngry = `<path d="M70 132c12-10 28-10 40 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
  const mouthSurprised = `<circle cx="90" cy="128" r="12" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
  const mouthSleepy = `<path d="M74 128c8 6 24 6 32 0" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none" opacity="0.9"/>`;
  const blush = `<circle cx="48" cy="112" r="10" fill="rgba(244,63,94,0.28)"/><circle cx="132" cy="112" r="10" fill="rgba(244,63,94,0.28)"/>`;

  const browAngry = `<path d="M52 70c10-8 18-10 30-8" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
                     <path d="M128 70c-10-8-18-10-30-8" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;

  const browSad = `<path d="M52 70c10-8 18-10 30-8" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none" opacity="0.65"/>
                   <path d="M128 70c-10-2-18 2-30 10" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" fill="none" opacity="0.65"/>`;

  switch (face) {
    case 'smile': return `${eyesNormal}${mouthSmile}`;
    case 'grin': return `${eyesHappy}${mouthGrin}`;
    case 'sad': return `${browSad}${eyesNormal}${mouthSad}`;
    case 'angry': return `${browAngry}${eyesNormal}${mouthAngry}`;
    case 'surprised': return `${eyesNormal}${mouthSurprised}`;
    case 'sleepy': return `${eyesSleepy}${mouthSleepy}`;
    case 'wink': return `${eyesWink}${mouthSmile}`;
    case 'cool': return `${eyesCool}${mouthNeutral}`;
    case 'blush': return `${blush}${eyesHappy}${mouthSmile}`;
    case 'love': return `${eyesLove}${mouthSmile}`;
    case 'dead': return `${eyesDead}${mouthNeutral}`;
    default: return `${eyesNormal}${mouthNeutral}`;
  }
}

export function buildFluxBuddySvg(opts, variant = 'full') {
  const o = normalizeFluxBuddy(opts);
  const limb = darken(o.body, 0.22);
  const shadow = withAlpha('#000000', 0.12);
  const outline = withAlpha('#0b1220', 0.10);

  if (variant === 'icon') {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
        <defs>
          <filter id="f" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="${shadow}"/>
          </filter>
        </defs>
        <g filter="url(#f)">
          <path d="M42 18h96c22 0 40 18 40 40v74c0 22-18 40-40 40H42c-22 0-40-18-40-40V58c0-22 18-40 40-40z" fill="${o.body}" stroke="${outline}" stroke-width="3"/>
          <g transform="translate(0,-12)">${faceSvg(o.face)}</g>
        </g>
      </svg>
    `.trim();
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 260">
      <defs>
        <filter id="f" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="${shadow}"/>
        </filter>
      </defs>

      <g filter="url(#f)">
        <!-- Legs -->
        <path d="M76 200c-10 20-12 30-12 52" stroke="${limb}" stroke-width="18" stroke-linecap="round"/>
        <path d="M104 200c10 20 12 30 12 52" stroke="${limb}" stroke-width="18" stroke-linecap="round"/>
        <path d="M50 252c14 4 28 4 36 0 6-3 12 2 12 10H56c-8 0-14-6-14-10 0-4 4-12 8-10z" fill="${limb}"/>
        <path d="M124 262c0-8 6-13 12-10 8 4 22 4 36 0 4-2 8 6 8 10 0 4-6 10-14 10h-42z" fill="${limb}"/>

        <!-- Arms -->
        <path d="M56 156c-18 18-26 34-24 52" stroke="${limb}" stroke-width="16" stroke-linecap="round"/>
        <path d="M124 156c18 18 26 34 24 52" stroke="${limb}" stroke-width="16" stroke-linecap="round"/>

        <!-- Body -->
        <path d="M48 44h84c22 0 40 18 40 40v104c0 22-18 40-40 40H48c-22 0-40-18-40-40V84c0-22 18-40 40-40z" fill="${o.body}" stroke="${outline}" stroke-width="3"/>

        <!-- Face -->
        <g>${faceSvg(o.face)}</g>
      </g>
    </svg>
  `.trim();
}

export function buildFluxBuddyDataUrl(opts, variant) {
  const svg = buildFluxBuddySvg(opts, variant);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
