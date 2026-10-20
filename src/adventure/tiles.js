// Baldosas de 16x16 dibujadas con el mismo sistema que el resto del juego
// (buildSprite de art.js). El suelo va plano (sin contorno) para que empalme;
// los objetos (árboles, carteles, cercas) llevan sombreado y contorno.
import { buildSprite } from '../art.js';

const T = 16;

function canvas(w = T, h = T) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Suelo plano: se recorta el borde de contorno que agrega buildSprite
function tile(pal, draw) {
  const spr = buildSprite(T, T, pal, Object.keys(pal).join(''), draw);
  const c = canvas();
  c.getContext('2d').drawImage(spr, 1, 1, T, T, 0, 0, T, T);
  return c;
}

// Objeto con contorno sobre una baldosa base
function over(base, w, h, pal, flat, draw, ox, oy) {
  const c = canvas();
  const ctx = c.getContext('2d');
  ctx.drawImage(base, 0, 0);
  ctx.drawImage(buildSprite(w, h, pal, flat, draw), ox - 1, oy - 1);
  return c;
}

// ------------------------------------------------------------- Exteriores
const TUFTS = [[2, 3], [10, 2], [6, 8], [13, 9], [2, 12], [9, 13]];
const GP = { g: '#88d070', G: '#68b050', l: '#b0e890' };
const grassDraw = (p) => {
  p.rect(0, 0, 16, 16, 'g');
  for (const [x, y] of TUFTS) p.px([[x, y], [x + 2, y], [x + 1, y + 1]], 'G');
  p.px([[5, 4], [12, 12]], 'l');
};

function tallGrass(f) {
  return tile({ g: '#58a040', a: '#3c7c30', b: '#88d060' }, (p) => {
    p.rect(0, 0, 16, 16, 'g');
    for (const oy of [0, 8]) {
      for (const ox of [0, 8]) {
        const lean = f && oy === 0;
        p.stamp(ox, oy, ['........', lean ? '.b...b..' : 'b...b...', lean ? 'ab.ab...' : 'a.a.a.a.', 'aaa.aaa.', 'aaaaaaaa', '.a.a.a.a', '........', '........']);
      }
    }
  });
}

function water(f) {
  return tile({ w: '#5098e8', d: '#3878d0', c: '#a8d8ff' }, (p) => {
    p.rect(0, 0, 16, 16, 'w');
    p.rect(0, 15, 16, 1, 'd');
    for (const [y, o] of [[4, 0], [11, 8]]) {
      const x = (o + f * 4) % 16;
      p.px([[x, y], [x + 1, y - 1], [x + 2, y - 1], [x + 3, y]].map(([a, b]) => [a % 16, b]), 'c');
    }
  });
}

function flowers(f) {
  return tile({ ...GP, r: '#f05858', w: '#ffffff', y: '#f8d838' }, (p) => {
    grassDraw(p);
    for (const [cx, cy, c] of [[4, 4, 'r'], [11, 6, 'w'], [6, 12, 'w'], [13, 13, 'r']]) {
      p.px(f ? [[cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1]] : [[cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy]], c);
      p.px([[cx, cy]], 'y');
    }
  });
}

const roof = (a, d, l) => tile({ a, d, l }, (p) => {
  p.rect(0, 0, 16, 16, 'a');
  for (const y of [3, 7, 11, 15]) {
    p.rect(0, y, 16, 1, 'd');
    for (let x = y % 8 === 3 ? 0 : 4; x < 16; x += 8) p.px([[x, y - 1], [x, y - 2]], 'd');
  }
  p.rect(0, 0, 16, 1, 'l');
});

const WH = { h: '#f0e0b0', p: '#c8b080', k: '#a08860' };
const wallDraw = (p) => {
  p.rect(0, 0, 16, 16, 'h');
  for (const x of [3, 7, 11, 15]) p.rect(x, 0, 1, 14, 'p');
  p.rect(0, 14, 16, 2, 'k');
};
const WO = { h: '#f4f2ec', b: '#7898c8', k: '#b8b8c0' };
const wallODraw = (p) => {
  p.rect(0, 0, 16, 16, 'h');
  p.rect(0, 3, 16, 2, 'b');
  p.rect(0, 14, 16, 2, 'k');
};
const WG = { a: '#a8a8b0', m: '#7c7c88', l: '#c8c8d2' };
const wallGDraw = (p) => {
  p.rect(0, 0, 16, 16, 'a');
  for (let y = 0; y < 16; y += 4) {
    p.rect(0, y + 3, 16, 1, 'm');
    p.rect(0, y, 16, 1, 'l');
    for (let x = (y / 4) % 2 ? 4 : 0; x < 16; x += 8) p.rect(x, y, 1, 3, 'm');
  }
};

// Ventana y puerta sobre cada tipo de pared
const windowOn = (pal, draw) => tile({ ...pal, f: '#5a4a3a', q: '#88c8f0', z: '#e0f8ff' }, (p) => {
  draw(p);
  p.rect(3, 3, 10, 8, 'f');
  p.rect(4, 4, 8, 6, 'q');
  p.rect(7, 4, 2, 6, 'f');
  p.px([[5, 5], [6, 5], [5, 6], [10, 5]], 'z');
});
const doorOn = (pal, draw) => tile({ ...pal, f: '#6a4020', d: '#2a1810', s: '#c0a070' }, (p) => {
  draw(p);
  p.rect(3, 2, 10, 14, 'f');
  p.rect(4, 3, 8, 12, 'd');
  p.rect(3, 15, 10, 1, 's');
});

let EXT = null;

function exteriorTiles() {
  if (EXT) return EXT;
  const grass = tile(GP, grassDraw);
  const path = tile({ p: '#e8d098', d: '#d0b078', l: '#f4e4b8' }, (p) => {
    p.rect(0, 0, 16, 16, 'p');
    p.px([[3, 2], [11, 5], [6, 10], [13, 13], [1, 14]], 'd');
    p.px([[4, 2], [12, 5], [7, 10]], 'l');
  });
  const forest = tile({ f: '#4f8a3e', d: '#3e7232', l: '#66a050' }, (p) => {
    p.rect(0, 0, 16, 16, 'f');
    p.px([[2, 2], [9, 4], [13, 1], [5, 9], [12, 11], [3, 14]], 'd');
    p.px([[6, 3], [14, 8], [8, 13]], 'l');
  });
  EXT = {
    '.': grass,
    '=': path,
    ';': forest,
    T: over(grass, 14, 14, { t: '#8a5a30', a: '#3a9048', c: '#68c060', d: '#2a6a38' }, '', (p) => {
      p.rect(5, 10, 4, 4, 't');
      p.ell(7, 6, 7, 6, 'a');
      p.ell(5, 4, 3, 2, 'c');
      p.px([[9, 8], [11, 6], [4, 8], [8, 3]], 'd');
    }, 1, 1),
    Y: over(forest, 14, 14, { t: '#6a4424', a: '#2a7040', c: '#45935a', d: '#1c5030' }, '', (p) => {
      p.rect(6, 11, 2, 3, 't');
      p.rect(5, 0, 4, 3, 'a');
      p.rect(3, 3, 8, 4, 'a');
      p.rect(1, 7, 12, 4, 'a');
      p.px([[6, 1], [4, 4], [5, 4], [2, 8], [3, 8]], 'c');
      p.px([[9, 5], [11, 9], [7, 9]], 'd');
    }, 1, 1),
    F: over(grass, 14, 9, { w: '#f0ece0' }, '', (p) => {
      p.rect(1, 0, 3, 9, 'w');
      p.rect(10, 0, 3, 9, 'w');
      p.rect(0, 2, 14, 2, 'w');
      p.rect(0, 6, 14, 2, 'w');
    }, 1, 6),
    L: tile({ ...GP, a: '#58a040', k: '#2f6028', s: '#6aa850' }, (p) => {
      grassDraw(p);
      p.rect(0, 9, 16, 3, 'a');
      p.rect(0, 12, 16, 1, 'k');
      p.rect(0, 13, 16, 3, 's');
    }),
    S: over(grass, 12, 11, { t: '#7a4a28', b: '#d8a868', l: '#8a5a30' }, 'l', (p) => {
      p.rect(5, 7, 2, 4, 't');
      p.rect(0, 0, 12, 7, 'b');
      p.rect(2, 2, 8, 1, 'l');
      p.rect(2, 4, 6, 1, 'l');
    }, 2, 3),
    R: roof('#e05840', '#b03828', '#f08870'),
    U: roof('#5080d8', '#3058b0', '#88b0f0'),
    K: roof('#8890a0', '#606878', '#b0b8c8'),
    H: tile(WH, wallDraw),
    O: tile(WO, wallODraw),
    g: tile(WG, wallGDraw),
    W: windowOn(WH, wallDraw),
    WO: windowOn(WO, wallODraw),
    WG: windowOn(WG, wallGDraw),
    D: doorOn(WH, wallDraw),
    DO: doorOn(WO, wallODraw),
    DG: doorOn(WG, wallGDraw),
    C: tile({ r: '#e04048', w: '#ffffff', k: '#1b1224', h: '#f0e0b0', p: '#a08860' }, (p) => {
      p.rect(0, 0, 16, 16, 'h');
      p.rect(0, 2, 16, 10, 'r');
      p.ell(8, 7, 5, 5, 'k');
      p.ell(8, 7, 4, 4, 'w');
      for (let y = 3; y < 7; y++) for (let x = 4; x < 12; x++) if (p.get(x, y) === 'w') p.set(x, y, 'r');
      p.rect(3, 7, 10, 1, 'k');
      p.ell(8, 7.5, 1.6, 1.6, 'k');
      p.px([[8, 7]], 'w');
      p.rect(0, 14, 16, 2, 'p');
    }),
    M: tile({ b: '#3a68c8', w: '#ffffff', h: '#f0e0b0', p: '#a08860' }, (p) => {
      p.rect(0, 0, 16, 16, 'h');
      p.rect(0, 2, 16, 10, 'b');
      p.stamp(4, 4, ['w...w', 'ww.ww', 'w.w.w', 'w...w', 'w...w']);
      p.rect(0, 14, 16, 2, 'p');
    }),
    G: tile({ ...WG, y: '#e8c040', k: '#6a5010' }, (p) => {
      p.rect(0, 0, 16, 16, 'a');
      p.rect(2, 2, 12, 11, 'k');
      p.rect(3, 3, 10, 9, 'y');
      p.stamp(5, 4, ['.kkk.', 'k....', 'k.kkk', 'k...k', '.kkk.']);
      p.rect(0, 15, 16, 1, 'm');
    }),
    frames: [0, 1, 2, 3].map((f) => ({ ',': tallGrass(f % 2), '~': water(f), f: flowers(f % 2) })),
  };
  return EXT;
}

// -------------------------------------------------------------- Interiores
let INT = null;

function interiorTiles() {
  if (INT) return INT;
  const wood = tile({ a: '#d8a868', d: '#b8884c', l: '#e8c088' }, (p) => {
    p.rect(0, 0, 16, 16, 'a');
    for (const y of [3, 7, 11, 15]) p.rect(0, y, 16, 1, 'd');
    p.rect(5, 0, 1, 3, 'd');
    p.rect(12, 4, 1, 3, 'd');
    p.rect(3, 8, 1, 3, 'd');
    p.rect(10, 12, 1, 3, 'd');
    p.rect(0, 0, 16, 1, 'l');
  });
  const tiles = tile({ a: '#f0f0f0', b: '#d8e0e8', m: '#c0c8d4' }, (p) => {
    p.rect(0, 0, 8, 8, 'a');
    p.rect(8, 8, 8, 8, 'a');
    p.rect(8, 0, 8, 8, 'b');
    p.rect(0, 8, 8, 8, 'b');
    p.rect(0, 15, 16, 1, 'm');
    p.rect(15, 0, 1, 16, 'm');
  });
  const wall = tile({ a: '#e8d8b0', s: '#d8c498', w: '#a07850', d: '#7a5a3a' }, (p) => {
    p.rect(0, 0, 16, 16, 'a');
    for (const x of [2, 6, 10, 14]) p.rect(x, 0, 1, 10, 's');
    p.rect(0, 10, 16, 6, 'w');
    p.rect(0, 10, 16, 1, 'd');
  });
  const mk = (base, w, h, pal, draw, ox, oy) => over(base, w, h, pal, '', draw, ox, oy);
  const obj = (w, h, pal, draw, ox, oy) => ({ wood: mk(wood, w, h, pal, draw, ox, oy), tiles: mk(tiles, w, h, pal, draw, ox, oy) });
  INT = {
    floor: { wood, tiles },
    '#': { wood: wall, tiles: wall },
    '=': obj(16, 12, { a: '#c84848', t: '#f0d8b0', d: '#8a3030' }, (p) => {
      p.rect(0, 0, 16, 5, 't');
      p.rect(0, 5, 16, 7, 'a');
      p.rect(0, 11, 16, 1, 'd');
    }, 0, 3),
    B: obj(14, 14, { a: '#8a5a30', b: '#5a3a1a', r: '#e05840', g: '#4cc44a', u: '#3a8fe0' }, (p) => {
      p.rect(0, 0, 14, 14, 'a');
      for (const y of [1, 7]) {
        p.rect(1, y, 12, 5, 'b');
        p.rect(2, y + 1, 2, 4, 'r');
        p.rect(5, y + 1, 2, 4, 'g');
        p.rect(8, y + 1, 2, 4, 'u');
        p.rect(11, y + 2, 1, 3, 'r');
      }
    }, 1, 1),
    P: obj(12, 12, { a: '#9aa2ae', s: '#3a6ad8', k: '#5f6670' }, (p) => {
      p.rect(0, 0, 12, 9, 'a');
      p.rect(1, 1, 10, 6, 's');
      p.rect(3, 9, 6, 3, 'k');
    }, 2, 3),
    V: obj(12, 10, { a: '#4a4a5a', s: '#88c8f0', k: '#2a2a30' }, (p) => {
      p.rect(0, 0, 12, 8, 'a');
      p.rect(1, 1, 10, 6, 's');
      p.rect(4, 8, 4, 2, 'k');
    }, 2, 4),
    b: obj(12, 15, { a: '#e05858', w: '#f4f4f4', k: '#8a5a30' }, (p) => {
      p.rect(0, 0, 12, 15, 'k');
      p.rect(1, 1, 10, 4, 'w');
      p.rect(1, 5, 10, 9, 'a');
    }, 2, 0),
    t: obj(16, 12, { a: '#b8884c', d: '#8a5a30' }, (p) => {
      p.rect(0, 0, 16, 9, 'a');
      p.rect(1, 9, 2, 3, 'd');
      p.rect(13, 9, 2, 3, 'd');
    }, 0, 2),
    o: obj(16, 12, { a: '#b8884c', d: '#8a5a30', r: '#e8413b', w: '#f4f1ea', k: '#1b1224' }, (p) => {
      p.rect(0, 3, 16, 7, 'a');
      p.rect(1, 10, 2, 2, 'd');
      p.rect(13, 10, 2, 2, 'd');
      p.ell(8, 4, 3.5, 3.5, 'w');
      p.rect(5, 1, 7, 3, 'r');
      p.rect(4, 4, 8, 1, 'k');
    }, 0, 2),
    p: obj(12, 14, { g: '#3a9048', l: '#68c060', k: '#b86a3a' }, (p) => {
      p.ell(6, 5, 6, 5, 'g');
      p.ell(4, 3, 2.5, 2, 'l');
      p.rect(3, 9, 6, 5, 'k');
    }, 2, 1),
    h: obj(14, 12, { a: '#e8e8f0', r: '#e8413b', k: '#5f6670' }, (p) => {
      p.rect(0, 0, 14, 12, 'a');
      for (let i = 0; i < 3; i++) p.ell(3 + i * 4, 4, 1.6, 1.6, 'r');
      p.rect(1, 8, 12, 3, 'k');
    }, 1, 2),
    m: { wood: tile({ a: '#c84848', d: '#8a3030' }, (p) => { p.rect(0, 2, 16, 12, 'a'); p.rect(0, 13, 16, 1, 'd'); }) },
  };
  INT.m.tiles = INT.m.wood;
  return INT;
}

export const TILE = T;

// Qué se puede pisar
const WALK_EXT = new Set([...'.,=;f:D']);
const WALK_INT = new Set([...'.m']);

export function walkable(map, ch) {
  return (map.interior ? WALK_INT : WALK_EXT).has(ch);
}

// Arma el mapa entero en 4 cuadros (el agua y las flores se mueven)
export function prerenderMap(map) {
  const W = map.w * T;
  const H = map.h * T;
  const frames = [];
  const animated = !map.interior && map.rows.some((r) => /[,~f]/.test(r));
  const n = animated ? 4 : 1;
  for (let f = 0; f < n; f++) {
    const c = canvas(W, H);
    const ctx = c.getContext('2d');
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const img = tileImage(map, x, y, f);
        if (img) ctx.drawImage(img, x * T, y * T);
      }
    }
    if (!map.interior) edgeTouches(ctx, map);
    frames.push(c);
  }
  return frames;
}

function tileImage(map, x, y, f) {
  const ch = map.rows[y][x];
  if (map.interior) {
    const I = interiorTiles();
    const kind = map.floor || 'wood';
    if (ch === '.') return I.floor[kind];
    return I[ch]?.[kind] || I.floor[kind];
  }
  const E = exteriorTiles();
  if (E.frames[f % 4][ch]) return E.frames[f % 4][ch];
  if (ch === 'D' || ch === 'W') {
    const left = map.rows[y][x - 1];
    const suffix = left === 'O' ? 'O' : left === 'g' ? 'G' : '';
    return E[ch + suffix];
  }
  return E[ch] || E['.'];
}

// Detalles al juntar baldosas: espuma en la orilla y sombra bajo los techos
function edgeTouches(ctx, map) {
  const at = (x, y) => map.rows[y]?.[x];
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const ch = at(x, y);
      if (ch === '~') {
        ctx.fillStyle = '#e8f8ff';
        if (at(x, y - 1) && at(x, y - 1) !== '~') ctx.fillRect(x * T, y * T, T, 1);
        if (at(x - 1, y) && at(x - 1, y) !== '~') ctx.fillRect(x * T, y * T, 1, T);
        if (at(x + 1, y) && at(x + 1, y) !== '~') ctx.fillRect(x * T + T - 1, y * T, 1, T);
      }
      if ('RUK'.includes(ch) && !'RUK'.includes(at(x, y + 1) || '')) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x * T, (y + 1) * T, T, 2);
      }
    }
  }
}

// Franja de pasto alto que tapa los pies de quien está parado ahí
let tallTop = null;

export function tallGrassOverlay() {
  if (!tallTop) {
    tallTop = canvas(T, 7);
    tallTop.getContext('2d').drawImage(tallGrass(0), 0, 9, T, 7, 0, 0, T, 7);
  }
  return tallTop;
}
