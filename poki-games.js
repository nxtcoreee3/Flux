// Curated public Poki catalog snapshot. Source: https://poki.com/en/all-games
// Titles are intentionally distinct from the Flux and ZapGames catalogs.
const POKI_THUMB = 'https://poki.com/favicon.ico';
const entries = [
  ['temple-run-2', 'Temple Run 2'],
  ['pop-it-master', 'Pop It Master'],
  ['blumgi-bloom', 'Blumgi Bloom'],
  ['blumgi-slime', 'Blumgi Slime'],
  ['stick-merge', 'Stick Merge'],
  [' rodeo-stampede', 'Rodeo Stampede'],
  ['fireboy-and-watergirl-forest-temple', 'Fireboy and Watergirl: Forest Temple'],
  ['bad-ice-cream', 'Bad Ice Cream'],
  ['dadish', 'Dadish'],
  ['the-final-earth-2', 'The Final Earth 2'],
  ['tiny-fishing', 'Tiny Fishing'],
  ['brain-test-tricky-puzzles', 'Brain Test: Tricky Puzzles'],
  ['who-is', 'Who Is?'],
  ['color-pixel-art-classic', 'Color Pixel Art Classic'],
  ['bomb-it-7', 'Bomb It 7'],
  ['viking-escape', 'Viking Escape'],
  ['super-star-car', 'Super Star Car'],
  ['highway-racer', 'Highway Racer'],
  ['ninja-must-die', 'Ninja Must Die'],
];

export const POKI_GAMES = Object.freeze(entries.map(([slug, title]) => ({
  id: `poki-${slug.trim()}`,
  title,
  thumb: POKI_THUMB,
  url: `https://poki.com/en/g/${slug.trim()}`,
  desc: 'Play instantly on Poki.',
  provider: 'poki',
})));
