// flux-buddy.js — Flux Buddy (Bitmoji-like) avatar (BETA)

export const FLUX_BUDDY_DEFAULT = Object.freeze({
  skin: '#f1c27d',
  hair: '#111827',
  shirt: '#3a7dff',
  pants: '#1f2937',
  shoes: '#0b1220',
  hairStyle: 'short',   // short | long | spiky | bun
  eyes: 'normal',       // normal | happy
  mouth: 'smile',       // smile | neutral
  accessory: 'none',    // none | glasses | cap
});

export function normalizeFluxBuddy(input) {
  const o = input && typeof input === 'object' ? input : {};
  const out = { ...FLUX_BUDDY_DEFAULT };
  for (const k of Object.keys(out)) if (o[k] != null) out[k] = o[k];
  if (!['short', 'long', 'spiky', 'bun'].includes(out.hairStyle)) out.hairStyle = FLUX_BUDDY_DEFAULT.hairStyle;
  if (!['normal', 'happy'].includes(out.eyes)) out.eyes = FLUX_BUDDY_DEFAULT.eyes;
  if (!['smile', 'neutral'].includes(out.mouth)) out.mouth = FLUX_BUDDY_DEFAULT.mouth;
  if (!['none', 'glasses', 'cap'].includes(out.accessory)) out.accessory = FLUX_BUDDY_DEFAULT.accessory;
  return out;
}

export function buildFluxBuddySvg(opts) {
  const o = normalizeFluxBuddy(opts);

  const hairTop = o.hairStyle === 'short'
    ? `<path d="M34 62c2-20 18-34 38-34s36 14 38 34c-8-10-20-16-38-16S42 52 34 62z" fill="${o.hair}"/>`
    : o.hairStyle === 'long'
      ? `<path d="M30 64c2-24 18-40 42-40s40 16 42 40c0 0-6-12-16-18v54c0 10-8 18-18 18H64c-10 0-18-8-18-18V46c-10 6-16 18-16 18z" fill="${o.hair}"/>`
      : o.hairStyle === 'spiky'
        ? `<path d="M34 64c4-20 18-38 38-38s34 18 38 38c-6-6-12-10-20-12l8-14c2-4-2-10-8-10H64c-6 0-10 6-8 10l8 14c-8 2-14 6-20 12z" fill="${o.hair}"/>`
        : `<path d="M34 66c2-24 18-42 38-42s36 18 38 42c-8-10-16-16-26-18l8-10c3-4-1-10-7-10H67c-6 0-10 6-7 10l8 10c-10 2-18 8-26 18z" fill="${o.hair}"/>`;

  const eyeMarks = o.eyes === 'happy'
    ? `<path d="M54 66c4 4 8 4 12 0" stroke="#0b1220" stroke-width="4" stroke-linecap="round" fill="none"/>
       <path d="M74 66c4 4 8 4 12 0" stroke="#0b1220" stroke-width="4" stroke-linecap="round" fill="none"/>`
    : `<circle cx="60" cy="66" r="4.2" fill="#0b1220"/><circle cx="84" cy="66" r="4.2" fill="#0b1220"/>`;

  const mouthMark = o.mouth === 'neutral'
    ? `<path d="M64 84h20" stroke="#0b1220" stroke-width="4" stroke-linecap="round" fill="none"/>`
    : `<path d="M62 82c4 6 18 6 22 0" stroke="#0b1220" stroke-width="4" stroke-linecap="round" fill="none"/>`;

  const glassesMark = o.accessory === 'glasses'
    ? `<g opacity="0.95">
         <rect x="50" y="58" width="22" height="16" rx="7" fill="none" stroke="#0b1220" stroke-width="3"/>
         <rect x="76" y="58" width="22" height="16" rx="7" fill="none" stroke="#0b1220" stroke-width="3"/>
         <path d="M72 66h4" stroke="#0b1220" stroke-width="3" stroke-linecap="round"/>
       </g>`
    : '';

  const capMark = o.accessory === 'cap'
    ? `<path d="M40 58c10-16 24-24 44-24s34 8 44 24c-8-6-16-8-22-8H62c-6 0-14 2-22 8z" fill="${o.hair}"/>
       <path d="M44 56c8-6 16-8 18-8h46c2 0 10 2 18 8v6H44z" fill="${o.hair}"/>`
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.14"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <!-- Legs -->
        <path d="M64 156c-6 18-8 28-8 44" stroke="${o.pants}" stroke-width="16" stroke-linecap="round"/>
        <path d="M96 156c6 18 8 28 8 44" stroke="${o.pants}" stroke-width="16" stroke-linecap="round"/>

        <!-- Shoes -->
        <path d="M44 206c10 2 24 2 30 0 6-2 10 2 10 8H46c-6 0-10-4-10-8 0-4 4-10 8-8z" fill="${o.shoes}"/>
        <path d="M86 214c0-6 4-10 10-8 6 2 20 2 30 0 4-2 8 4 8 8 0 4-4 8-10 8H86z" fill="${o.shoes}"/>

        <!-- Body -->
        <path d="M54 108c-10 10-16 22-16 36v18c0 8 6 14 14 14h56c8 0 14-6 14-14v-18c0-14-6-26-16-36-10-10-18-14-26-14H80c-8 0-16 4-26 14z" fill="${o.shirt}"/>

        <!-- Arms -->
        <path d="M40 130c-10 14-14 28-10 40" stroke="${o.shirt}" stroke-width="18" stroke-linecap="round"/>
        <path d="M120 130c10 14 14 28 10 40" stroke="${o.shirt}" stroke-width="18" stroke-linecap="round"/>
        <circle cx="28" cy="172" r="10" fill="${o.skin}"/>
        <circle cx="132" cy="172" r="10" fill="${o.skin}"/>

        <!-- Head -->
        <circle cx="80" cy="72" r="40" fill="${o.skin}"/>
        ${hairTop}
        ${capMark}
        ${glassesMark}
        ${eyeMarks}
        ${mouthMark}
        <path d="M76 74c0 6 8 10 12 4" stroke="rgba(11,18,32,0.25)" stroke-width="3" stroke-linecap="round" fill="none"/>
      </g>
    </svg>
  `.trim();
}

export function buildFluxBuddyDataUrl(opts) {
  const svg = buildFluxBuddySvg(opts);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

