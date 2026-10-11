// 16x16 pixel sprites. '.' = transparent, other chars index PALETTE.
export const PALETTE = {
  g: '#2d6a4f', G: '#40916c', l: '#74c69d',
  b: '#7f5539', B: '#5e3b22',
  r: '#e63946', R: '#9d0208',
  w: '#f8f9fa', s: '#ced4da', S: '#868e96', k: '#343a40',
  y: '#ffd166', o: '#f77f00', t: '#e9c46a', c: '#a5d8ff',
  p: '#ffc2d9', P: '#f472b6',
};

const SPRITES = {
  oak: [
    '................',
    '.....gggggg.....',
    '...ggGGGGGGgg...',
    '..gGGGlGGGGGGg..',
    '.gGGlllGGGGGGGg.',
    '.gGGGlGGGGGlGGg.',
    '.gGGGGGGGGllGGg.',
    '.gGGGGGGGGGGGGg.',
    '..gGGGGGlGGGGg..',
    '...ggGGGGGGgg...',
    '.....ggbbgg.....',
    '.......bb.......',
    '.......bb.......',
    '......bbbb......',
    '.....bB..Bb.....',
    '................',
  ],
  pine: [
    '.......g........',
    '......gGg.......',
    '.....gGGGg......',
    '....gGlGGGg.....',
    '......gGg.......',
    '.....gGGGg......',
    '....gGGlGGg.....',
    '...gGGGGGGGg....',
    '.....gGGGg......',
    '....gGGGGGg.....',
    '...gGGlGGGGg....',
    '..gGGGGGGGGGg...',
    '.......b........',
    '.......b........',
    '......bBb.......',
    '................',
  ],
  cherry: [
    '................',
    '.....PPPPPP.....',
    '...PPppppppPP...',
    '..PpppwppppppP..',
    '.PppwwwpppppppP.',
    '.PpppwppppPpppP.',
    '.PppppppppPPppP.',
    '.PppppppppppppP.',
    '..PppppPpppppP..',
    '...PPppppppPP...',
    '.....PPbbPP.....',
    '.......bb.......',
    '.......bb.......',
    '......bbbb......',
    '.....bB..Bb.....',
    '................',
  ],
  house: [
    '................',
    '................',
    '.......rr.......',
    '......rRRr......',
    '.....rRRRRr.....',
    '....rRRRRRRr....',
    '...rRRRRRRRRr...',
    '..rrrrrrrrrrrr..',
    '...tttttttttt...',
    '...tccttttcct...',
    '...tccttttcct...',
    '...ttttbbtttt...',
    '...ttttbbtttt...',
    '...ttttbbtttt...',
    '..GGGGGGGGGGGG..',
    '................',
  ],
  windmill: [
    '..w.........w...',
    '...w.......w....',
    '....w.....w.....',
    '.....w...w......',
    '......wkw.......',
    '......kRk.......',
    '......wkw.......',
    '.....wtttw......',
    '....w.ttt.w.....',
    '...w.ttttt.w....',
    '..w..ttttt..w...',
    '.....ttttt......',
    '....ttttttt.....',
    '....tttbttt.....',
    '....tttbttt.....',
    '................',
  ],
  lighthouse: [
    '.......k........',
    '......RRR.......',
    '.....ycyc y.....',
    '.....kkkkk......',
    '......rrr.......',
    '......www.......',
    '......rrr.......',
    '.....rrrrr......',
    '.....wwwww......',
    '.....wwwww......',
    '.....rrrrr......',
    '....rrrrrrr.....',
    '....wwwkwww.....',
    '....wwwkwww.....',
    '...SSSSSSSSS....',
    '................',
  ],
  castle: [
    '...r........r...',
    '...rr.......rr..',
    '...S........S...',
    '.S.S.S....S.S.S.',
    '.sssss....sssss.',
    '.sskss....sskss.',
    '.sssssS.S.sssss.',
    '.ssssssssssssss.',
    '.sskssssssssks s',
    '.ssssssssssssss.',
    '.ssssssssssssss.',
    '.ssssssksssssss.',
    '.sssssskkssssss.',
    '.ssssskkkksssss.',
    '.SSSSSkkkkSSSSS.',
    '................',
  ],
  library: [
    '................',
    '................',
    '................',
    '.......RR.......',
    '.....RRRRRR.....',
    '...RRRRRRRRRR...',
    '.RRRRRRRRRRRRRR.',
    '.ssssssssssssss.',
    '.twttwtkktwttwt.',
    '.twttwtkktwttwt.',
    '.twttwtkktwttwt.',
    '.twttwtkktwttwt.',
    '.ssssssssssssss.',
    'SSSSSSSSSSSSSSSS',
    '................',
    '................',
  ],
  dead: [
    '................',
    '................',
    '....B.....B.....',
    '.....B...B......',
    '..B...B.B...B...',
    '...B...BB..B....',
    '....B..B..B.....',
    '.....B.B.B......',
    '......BBB.......',
    '.......B........',
    '.......B........',
    '.......B........',
    '......BBB.......',
    '.....B.B.B......',
    '................',
    '................',
  ],
  mound: [
    ...Array(13).fill('................'),
    '......bbbb......',
    '.....bBBBBb.....',
    '................',
  ],
  sprout: [
    ...Array(10).fill('................'),
    '.......G........',
    '......lGl.......',
    '.....l.G.l......',
    '......bbbb......',
    '.....bBBBBb.....',
    '................',
  ],
};

export const SPECIES = [
  { id: 'library', name: 'Library', cost: 0 },
  { id: 'house', name: 'Cottage', cost: 0 },
  { id: 'windmill', name: 'Windmill', cost: 0 },
  { id: 'cherry', name: 'Cherry', cost: 0 },
  { id: 'oak', name: 'Oak', cost: 0 },
  { id: 'pine', name: 'Pine', cost: 100 },
  { id: 'lighthouse', name: 'Lighthouse', cost: 600 },
  { id: 'castle', name: 'Castle', cost: 1200 },
];

// Normalise rows to exactly 16 chars so hand-drawn typos can't break rendering.
for (const k in SPRITES) SPRITES[k] = SPRITES[k].map(r => (r + '.'.repeat(16)).slice(0, 16).replace(/ /g, '.'));

// Draw sprite at (x,y) in logical pixels. `reveal` (0..1) shows rows bottom-up, like it's being built.
export function drawSprite(ctx, id, x, y, reveal = 1) {
  const rows = SPRITES[id] || SPRITES.oak;
  const shown = Math.ceil(16 * reveal);
  for (let r = 16 - shown; r < 16; r++) {
    const row = rows[r];
    for (let c = 0; c < 16; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      ctx.fillStyle = PALETTE[ch];
      ctx.fillRect(x + c, y + r, 1, 1);
    }
  }
}

// Growth stages for a session in progress.
export function drawGrowing(ctx, id, x, y, p) {
  if (p < 0.12) return drawSprite(ctx, 'mound', x, y);
  if (p < 0.3) return drawSprite(ctx, 'sprout', x, y);
  drawSprite(ctx, 'mound', x, y);
  drawSprite(ctx, id, x, y, 0.25 + 0.75 * ((p - 0.3) / 0.7));
}

export function spriteCanvas(id, scale = 4) {
  const c = document.createElement('canvas');
  c.width = c.height = 16 * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  drawSprite(ctx, id, 0, 0);
  return c;
}

export { SPRITES };

// 10x10 one-colour UI icons for the dock.
const ICONS = {
  focus: ['.########.', '..#....#..', '..#....#..', '...#..#...', '....##....', '....##....', '...#..#...', '..#.##.#..', '..######..', '.########.'],
  island: ['....#.....', '...###....', '..#####...', '....#.....', '....#.....', '..######..', '.########.', '..........', '#.##.##.##', '.#..#..#..'],
  stats: ['..........', '.......##.', '.......##.', '....##.##.', '....##.##.', '.##.##.##.', '.##.##.##.', '.##.##.##.', '.##.##.##.', '##########'],
  shop: ['...####...', '..#....#..', '.#..##..#.', '.#.#....#.', '.#..##..#.', '.#....#.#.', '.#..##..#.', '..#....#..', '...####...', '..........'],
  settings: ['....##....', '.#.####.#.', '..######..', '.###..###.', '####..####', '####..####', '.###..###.', '..######..', '.#.####.#.', '....##....'],
};

export function iconCanvas(id, color, scale = 2) {
  const c = document.createElement('canvas');
  c.width = c.height = 10 * scale;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ICONS[id].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x * scale, y * scale, scale, scale); }));
  return c;
}
