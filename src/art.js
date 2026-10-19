// Pixel art procedural: cada criatura se dibuja con primitivas en una grilla
// de 16x16 y luego se le agrega sombreado y contorno automáticos.

const OUTLINE = '#1b1224';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade([r, g, b], k) {
  // k > 0 aclara, k < 0 oscurece
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return [f(r), f(g), f(b)];
}

class Painter {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.grid = new Array(w * h).fill(null);
  }
  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.grid[y * this.w + x] = c;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.grid[y * this.w + x];
  }
  ell(cx, cy, rx, ry, c) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  px(points, c) {
    for (const [x, y] of points) this.set(x, y, c);
  }
  // Estampa un patrón de texto; '.' no pinta, ' ' borra
  stamp(x, y, rows) {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        this.set(x + i, y + j, ch === ' ' ? null : ch);
      });
    });
  }
}

// Construye un canvas con sombreado y contorno a partir de una función de dibujo
export function buildSprite(w, h, palette, flat, draw) {
  const p = new Painter(w, h);
  draw(p);
  const W = w + 2;
  const H = h + 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const put = (x, y, rgb) => {
    const i = (y * W + x) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const key = p.get(x, y);
      if (!key) continue;
      let rgb = hexToRgb(palette[key] || '#ff00ff');
      if (!flat.includes(key)) {
        if (!p.get(x, y + 1)) rgb = shade(rgb, -0.28);
        else if (!p.get(x, y - 1) || !p.get(x - 1, y)) rgb = shade(rgb, 0.18);
      }
      put(x + 1, y + 1, rgb);
    }
  }
  const ol = hexToRgb(OUTLINE);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (p.get(x - 1, y - 1)) continue;
      const n = p.get(x - 2, y - 1) || p.get(x, y - 1) || p.get(x - 1, y - 2) || p.get(x - 1, y);
      if (n) put(x, y, ol);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Silueta blanca para el parpadeo al recibir golpe
export function whiteVersion(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

const BASE = { w: '#ffffff', e: '#1a1020', k: OUTLINE };

export const CREATURE_ART = {
  brasko: {
    palette: { ...BASE, a: '#f0603a', b: '#b83a22', c: '#ffd36b', d: '#ffe45c', f: '#ff9520', p: '#ff9aa8' },
    flat: 'wekdp',
    draw(p) {
      p.rect(3, 11, 2, 4, 'b');
      p.rect(9, 11, 2, 4, 'b');
      p.ell(2.4, 8.6, 2.2, 1.5, 'a');
      p.px([[1, 7], [0, 6], [0, 5]], 'a');
      p.px([[0, 4], [1, 4], [0, 3], [1, 3]], 'f');
      p.px([[0, 2], [1, 2], [1, 1]], 'd');
      p.ell(6.6, 10, 4.6, 2.7, 'a');
      p.ell(7.2, 11.6, 3.4, 1.3, 'c');
      p.ell(11, 6.4, 4.6, 3.8, 'a');
      // penacho de llamas
      p.px([[7, 3], [8, 2], [10, 2], [12, 2], [6, 4]], 'f');
      p.px([[7, 2], [8, 1], [10, 1], [10, 0], [12, 1], [5, 3]], 'd');
      p.stamp(11, 4, ['ww', 'we', '..']);
      p.px([[11, 7]], 'p');
      p.px([[13, 8], [14, 8]], 'b');
    },
  },
  marejo: {
    palette: { ...BASE, a: '#4aa8e8', b: '#2b6fb8', c: '#bfe9ff', d: '#e6faff', m: '#1f4f8a' },
    flat: 'wekdm',
    draw(p) {
      p.rect(3, 10, 2, 4, 'b');
      p.px([[2, 13], [2, 14]], 'b');
      p.rect(8, 10, 2, 5, 'b');
      p.rect(5, 10, 2, 5, 'a');
      p.px([[4, 14]], 'a');
      p.rect(11, 10, 2, 4, 'a');
      p.px([[13, 13], [13, 14]], 'a');
      p.ell(8, 6.2, 5.6, 5.1, 'a');
      p.px([[4, 4], [5, 3], [4, 7], [6, 2]], 'c');
      p.stamp(8, 5, ['ww.ww', 'we.we']);
      p.px([[11, 9], [10, 9]], 'm');
      // burbujas
      p.px([[14, 2], [15, 0]], 'd');
    },
  },
  voltadillo: {
    palette: { ...BASE, a: '#ffcf33', b: '#d39a10', g: '#4b4f6b', c: '#9aa0c4', d: '#7df9ff' },
    flat: 'wekd',
    draw(p) {
      p.rect(3, 11, 2, 4, 'g');
      p.rect(9, 11, 2, 4, 'g');
      p.px([[1, 10], [0, 11], [1, 11]], 'g');
      p.px([[1, 12], [2, 13], [1, 13], [1, 14]], 'd');
      p.ell(7, 7.4, 6.1, 4.9, 'a');
      for (const bx of [4, 7, 10]) {
        for (let y = 2; y < 13; y++) if (p.get(bx, y) === 'a') p.set(bx, y, 'b');
      }
      p.ell(12.8, 9.4, 2.8, 2.3, 'g');
      p.px([[11, 7], [11, 6], [12, 6]], 'g');
      p.px([[15, 10]], 'g');
      p.px([[12, 9]], 'w');
      p.px([[13, 9]], 'd');
      p.px([[13, 11], [14, 11]], 'c');
      p.px([[3, 1], [2, 0], [11, 1], [12, 0]], 'd');
    },
  },
  nopalin: {
    palette: { ...BASE, a: '#5cc45a', b: '#3b8f45', c: '#9be37a', f: '#ff6fa8', d: '#ffe96b', s: '#f6f2d4', r: '#e8413b' },
    flat: 'wekds',
    draw(p) {
      p.rect(5, 13, 2, 2, 'b');
      p.rect(9, 13, 2, 2, 'b');
      p.ell(8, 8.2, 4.4, 5.8, 'a');
      p.rect(2, 9, 2, 2, 'a');
      p.rect(12, 7, 2, 2, 'a');
      p.ell(2.4, 7.6, 1.6, 1.6, 'r');
      p.ell(14.2, 6.2, 1.7, 1.7, 'r');
      p.px([[8, 0], [7, 1], [9, 1], [8, 2]], 'f');
      p.px([[8, 1]], 'd');
      p.px([[5, 5], [5, 10], [7, 12], [10, 12], [6, 3]], 's');
      p.stamp(8, 6, ['w.w', 'e.e']);
      p.px([[9, 9], [10, 9]], 'b');
    },
  },
  petron: {
    palette: { ...BASE, a: '#a09381', b: '#6c6156', m: '#6fbf4a', r: '#e27c4a', c: '#d2c5b1' },
    flat: 'wek',
    draw(p) {
      p.px([[3, 13], [2, 14], [6, 13], [6, 14], [10, 13], [10, 14], [13, 13], [14, 14]], 'r');
      p.ell(1.9, 9, 1.7, 1.9, 'r');
      p.px([[9, 3], [9, 4], [12, 3], [12, 4]], 'b');
      p.ell(8, 9.3, 6.1, 4.2, 'a');
      p.ell(7, 5.9, 3.8, 1.3, 'm');
      p.px([[11, 6]], 'm');
      p.px([[5, 9], [6, 10], [10, 8], [11, 11], [4, 11]], 'b');
      p.px([[6, 7], [9, 7]], 'c');
      p.ell(14.2, 8.6, 1.9, 2.3, 'r');
      p.set(15, 8, null);
      p.set(15, 7, null);
      p.stamp(9, 2, ['we.we']);
    },
  },
  sombrix: {
    palette: { ...BASE, a: '#5b3f8c', b: '#3a2660', c: '#9a78d6', y: '#ffe66b', g: '#ffb43b' },
    flat: 'weky',
    draw(p) {
      p.px([[2, 10], [1, 9], [1, 8], [1, 7]], 'a');
      p.rect(0, 4, 3, 3, 'y');
      p.px([[1, 3], [0, 7], [2, 7]], 'g');
      p.ell(8.5, 7.2, 5, 4.9, 'a');
      p.rect(4, 9, 10, 3, 'a');
      p.px([[4, 12], [6, 13], [7, 12], [9, 13], [10, 12], [12, 13], [13, 12]], 'a');
      p.px([[6, 1], [6, 2], [7, 2], [12, 1], [12, 2], [11, 2]], 'a');
      p.px([[6, 2], [12, 2]], 'c');
      p.px([[9, 6], [9, 7], [12, 6], [12, 7]], 'y');
      p.px([[10, 9], [11, 10], [12, 9]], 'c');
    },
  },
};

const cache = new Map();

export function creatureSprite(id) {
  if (!cache.has(id)) {
    const art = CREATURE_ART[id];
    const normal = buildSprite(16, 16, art.palette, art.flat, art.draw);
    cache.set(id, { normal, white: whiteVersion(normal) });
  }
  return cache.get(id);
}

// Roca de la arena (obstáculo)
let boulder = null;
export function boulderSprite() {
  if (!boulder) {
    boulder = buildSprite(14, 12, { a: '#b9b0a2', b: '#857c70', m: '#7cc04f', n: '#5d9a3a', c: '#dcd4c6' }, '', (p) => {
      p.ell(7, 6.6, 6.6, 5.2, 'a');
      p.ell(5.2, 3.2, 3.6, 1.6, 'm');
      p.ell(10.2, 4.2, 1.8, 1, 'n');
      p.px([[3, 7], [4, 8], [9, 8], [10, 9], [8, 6]], 'b');
      p.px([[6, 6], [11, 6]], 'c');
    });
  }
  return boulder;
}

// Persona del público (dos poses: normal y brazos arriba)
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a86b3c'];
const HAIRS = ['#2b1d14', '#4a2f1b', '#1a1a1a', '#d9a441', '#8b3a1a', '#5a3a8a', '#e8e0d0', '#c0392b'];
const SHIRTS = ['#e84545', '#3a7bd5', '#f2c318', '#4cc44a', '#ff7a2f', '#8f5fe0', '#f4f4f4', '#2ec4b6', '#e0399a', '#2d2d4a'];

export function personSprites(rand) {
  const pal = {
    s: SKINS[Math.floor(rand() * SKINS.length)],
    h: HAIRS[Math.floor(rand() * HAIRS.length)],
    t: SHIRTS[Math.floor(rand() * SHIRTS.length)],
    e: '#1a1020',
  };
  const cap = rand() < 0.25;
  if (cap) pal.h = SHIRTS[Math.floor(rand() * SHIRTS.length)];
  const head = (p) => {
    p.rect(2, 1, 3, 1, 'h');
    p.rect(1, 2, 5, 1, 'h');
    if (cap) p.rect(4, 2, 3, 1, 'h');
    p.rect(1, 3, 5, 2, 's');
    p.rect(2, 5, 3, 1, 's');
    p.px([[2, 3], [4, 3]], 'e');
  };
  const normal = buildSprite(7, 10, pal, 'e', (p) => {
    head(p);
    p.rect(1, 6, 5, 4, 't');
    p.rect(0, 7, 7, 2, 't');
    p.px([[0, 9], [6, 9]], 's');
  });
  const cheer = buildSprite(7, 10, pal, 'e', (p) => {
    head(p);
    p.rect(1, 6, 5, 4, 't');
    p.px([[0, 1], [6, 1]], 's');
    p.rect(0, 2, 1, 4, 't');
    p.rect(6, 2, 1, 4, 't');
  });
  return { normal, cheer };
}

// Líderes de gimnasio de Kanto (pixel art de 10x15 con sombreado y contorno)
const LEADERS = {
  brock: {
    pal: { s: '#d9a066', h: '#4a2f1b', e: '#1a1020', t: '#f08030', v: '#4c8a3a', p: '#6b4a2a', b: '#3a2a1a' },
    rows: ['..h.hh.h..', '.hhhhhhhh.', '.hhsssshh.', '..sesses..', '..ssssss..', '...ssss...', '.vvttttvv.', 'vvvttttvvv', 'svvttttvvs', 'svvttttvvs', 's.vvvvvv.s', '..pppppp..', '..ppp.ppp.', '..pp...pp.', '..bb...bb.'],
  },
  misty: {
    pal: { s: '#ffdbac', h: '#f07828', e: '#1a1020', t: '#f2d230', k: '#e03030', p: '#3a70d0', b: '#e03030' },
    rows: ['...hhhh...', '..hhhhhhh.', '.hhsssshhh', '..sesses.h', '..ssssss.h', '...ssss...', '..kttttk..', '.skttttks.', '.s.ssss.s.', '...pppp...', '...pppp...', '...ss.ss..', '...ss.ss..', '...ss.ss..', '...bb.bb..'],
  },
  surge: {
    pal: { s: '#f1c27d', h: '#f2d230', g: '#1a1a1a', t: '#5a7a3a', k: '#3a5a2a', p: '#4a4a3a', b: '#2a2a2a' },
    rows: ['.h.hhhh.h.', '.hhhhhhhh.', '..ssssss..', '..gggggg..', '..ssssss..', '...ssss...', 'tttttttttt', 'tkttktktkt', 'sttkttttts', 'stttkttkts', 's.tttttt.s', '..pppppp..', '..pp..pp..', '..pp..pp..', '..bb..bb..'],
  },
  erika: {
    pal: { s: '#ffdbac', h: '#1a1a2a', k: '#e03040', e: '#1a1020', t: '#4cae5a', o: '#f2c318', b: '#d04060' },
    rows: ['..hhhhhh..', '.hkkkkkkh.', '.hssssssh.', '.hsessesh.', '.hssssssh.', '..hssssh..', '..tttttt..', '.tttttttt.', '.oooooooo.', 'stttttttts', 's.tttttt.s', '..tttttt..', '..tttttt..', '..tt..tt..', '..bb..bb..'],
  },
  koga: {
    pal: { s: '#e0ac69', h: '#1a1a1a', e: '#1a1020', k: '#4a2a6a', t: '#7a4ab0', o: '#2a1a3a', b: '#2a1a2a' },
    rows: ['..hhhhhh..', '.hhhhhhhh.', '..ssssss..', '..sesses..', '..kkkkkk..', '...kkkk...', '.tttttttt.', 'tttttttttt', 'st.tttt.ts', 'st.oooo.ts', 's.tttttt.s', '..tttttt..', '..tt..tt..', '..tt..tt..', '..bb..bb..'],
  },
  sabrina: {
    pal: { s: '#ffdbac', h: '#203a30', e: '#c03050', t: '#d03040', w: '#f0f0f0', b: '#2a2a2a' },
    rows: ['..hhhhhh..', '.hhhhhhhh.', '.hssssssh.', '.hsessesh.', '.hssssssh.', '.hhsssshh.', '.htttttth.', 'htttttttth', 'hsttttttsh', 'hs.tttt.sh', 'h..wwww..h', '...wwww...', '...ww.ww..', '...ww.ww..', '...bb.bb..'],
  },
  blaine: {
    pal: { s: '#f1c27d', g: '#1a1a1a', w: '#f4f4f4', t: '#e86a20', p: '#5a4a3a', b: '#2a2a2a' },
    rows: ['...ssss...', '..ssssss..', '..ssssss..', '..gggggg..', '..ssssss..', '..swwwws..', '...ssss...', '.wwwttwww.', 'wwwwttwwww', 'swwwttwwws', 'swwwwwwwws', 's.wwwwww.s', '..wwwwww..', '..pp..pp..', '..bb..bb..'],
  },
  giovanni: {
    pal: { s: '#e0ac69', h: '#1a1a1a', e: '#1a1020', t: '#b06a2a', w: '#f0f0f0', k: '#c03030', p: '#7a4a1a', b: '#2a1a1a' },
    rows: ['..hhhhhh..', '.hhhhhhhh.', '..ssssss..', '..sesses..', '..ssssss..', '...ssss...', '.tttwwttt.', 'tttttktttt', 'sttttkttts', 'stttttttts', 's.tttttt.s', '..pppppp..', '..pp..pp..', '..pp..pp..', '..bb..bb..'],
  },
};
const LEADER_KEY = { BROCK: 'brock', MISTY: 'misty', 'LT. SURGE': 'surge', ERIKA: 'erika', KOGA: 'koga', SABRINA: 'sabrina', BLAINE: 'blaine', GIOVANNI: 'giovanni' };
const leaderCache = new Map();

export function leaderSprite(name) {
  const key = LEADER_KEY[name] || name;
  if (!leaderCache.has(key)) {
    const L = LEADERS[key];
    if (!L) return null;
    leaderCache.set(key, buildSprite(10, 15, L.pal, 'eg', (p) => p.stamp(0, 0, L.rows)));
  }
  return leaderCache.get(key);
}
