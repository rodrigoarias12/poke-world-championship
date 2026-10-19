// Arena acuática: piscina con plataformas de madera y Poké Balls flotantes
import { VW, VH } from './config.js';
import { fxRandom } from './rng.js';
import { rng } from './crowd.js';
import { GYMS } from './data.js';
import { GYM_THEMES, badgeImage } from './gyms.js';

const RES = 2; // píxeles del fondo por unidad lógica

const THEMES = {
  piscina: {
    name: 'PISCINA POKÉMON',
    water: ['#1f63b8', '#1a56a3', '#2a74cc', '#1b5aa8'],
    dark: '#164a8f',
    light: '#4a90dc',
    edge: '#d8e4ec',
    edgeDark: '#9fb3c2',
    rim: '#5d7a90',
    caustic: 0.2,
  },
  lago: {
    name: 'LAGO ESMERALDA',
    water: ['#1c6f86', '#18637a', '#23809a', '#196a80'],
    dark: '#145566',
    light: '#3d9db5',
    edge: '#c9b48a',
    edgeDark: '#9c8660',
    rim: '#6b5a3c',
    caustic: 0.16,
  },
  noche: {
    name: 'MAR NOCTURNO',
    water: ['#142a5c', '#11244f', '#1b3570', '#132857'],
    dark: '#0d1d40',
    light: '#3456a0',
    edge: '#3a3a5c',
    edgeDark: '#26263f',
    rim: '#deb248',
    caustic: 0.07,
  },
};

for (const [key, t] of Object.entries(GYM_THEMES)) THEMES[key] = { ...t, gym: key, badge: GYMS[key].badge };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function drawPlatform(ctx, x, y, r, rand) {
  const ry = r * 0.55;
  const side = 4;
  ctx.save();
  ctx.scale(RES, RES);
  // sombra en el agua
  ctx.fillStyle = 'rgba(5,20,50,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + side + 2, r + 2, ry + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // costado
  ctx.fillStyle = '#6b4424';
  ctx.beginPath();
  ctx.ellipse(x, y + side, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r, y, r * 2, side);
  ctx.fillStyle = '#4e2f17';
  for (let i = -r + 3; i < r; i += 5) ctx.fillRect(x + i, y + 1, 0.6, side + ry * 0.4);
  // tapa
  ctx.fillStyle = '#b07a45';
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r - 1.2, ry - 0.8, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#c28a52';
  ctx.fillRect(x - r, y - ry, r * 2, ry * 2);
  // tablas
  ctx.fillStyle = '#9a6837';
  for (let j = -ry; j < ry; j += 3.2) ctx.fillRect(x - r, y + j, r * 2, 0.5);
  ctx.fillStyle = 'rgba(80,45,15,0.35)';
  for (let k = 0; k < 10; k++) ctx.fillRect(x - r + rand() * r * 2, y - ry + rand() * ry * 2, 2 + rand() * 4, 0.5);
  ctx.restore();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#3d2410';
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Flotador blanco y celeste (pileta de Misty)
function drawFloat(ctx, x, y, r) {
  const ry = r * 0.55;
  ctx.save();
  ctx.scale(RES, RES);
  ctx.fillStyle = 'rgba(5,30,60,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 5, r + 2, ry + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9dbe6';
  ctx.beginPath();
  ctx.ellipse(x, y + 3, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r, y, r * 2, 3);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#f6fafc';
  ctx.fillRect(x - r, y - ry, r * 2, ry * 2);
  ctx.fillStyle = '#3fa7ff';
  for (let i = -r; i < r; i += 8) ctx.fillRect(x + i, y - ry, 4, ry * 2);
  ctx.restore();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#1f5f8f';
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Roca volcánica con grietas encendidas (Blaine)
function drawBasalt(ctx, x, y, r, rand) {
  const ry = r * 0.55;
  ctx.save();
  ctx.scale(RES, RES);
  ctx.fillStyle = 'rgba(255,120,40,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, r + 3, ry + 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e2626';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r, y, r * 2, 4);
  ctx.fillStyle = '#4a4040';
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff8a30';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * ry * 0.7);
    ctx.stroke();
  }
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#1a1414';
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBallPlatform(ctx, x, y, r) {
  const ry = r * 0.55;
  const side = 5;
  ctx.save();
  ctx.scale(RES, RES);
  ctx.fillStyle = 'rgba(5,20,50,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + side + 2, r + 2, ry + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9aa3ad';
  ctx.beginPath();
  ctx.ellipse(x, y + side, r, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - r, y, r * 2, side);
  ctx.fillStyle = '#4a4f57';
  for (let i = -r + 4; i < r; i += 9) ctx.fillRect(x + i, y + 1, 2.5, side + 1);
  // tapa: mitad roja, mitad blanca
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(x - r, y - ry, r * 2, ry * 2);
  ctx.fillStyle = '#e04a3a';
  ctx.fillRect(x - r, y - ry, r * 2, ry - 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x - r, y - ry, r * 2, ry * 0.4);
  ctx.fillStyle = '#1b1224';
  ctx.fillRect(x - r, y - 1.5, r * 2, 3);
  ctx.restore();
  ctx.fillStyle = '#1b1224';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.28, ry * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.17, ry * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#1b1224';
  ctx.beginPath();
  ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderBackground(theme, seed, platforms, balls) {
  const T = THEMES[theme];
  const rand = rng(seed);
  const c = makeCanvas(VW * RES, VH * RES);
  const ctx = c.getContext('2d');
  if (T.paint) {
    ctx.save();
    ctx.scale(RES, RES);
    T.paint(ctx, rand);
    ctx.restore();
    const fg = makeCanvas(VW * RES, VH * RES);
    const fctx = fg.getContext('2d');
    fctx.save();
    fctx.scale(RES, RES);
    T.decor?.(fctx, rand);
    fctx.restore();
    return { bg: c, fg };
  }
  ctx.fillStyle = T.water[0];
  ctx.fillRect(0, 0, c.width, c.height);
  // Manchas de profundidad
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = T.water[1 + (i % 3)];
    const x = rand() * c.width;
    const y = rand() * c.height;
    const r = (8 + rand() * 30) * RES;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Ondas pixeladas fijas
  for (let i = 0; i < 260; i++) {
    const x = Math.round(rand() * VW) * RES;
    const y = Math.round(rand() * VH) * RES;
    const w = (3 + Math.floor(rand() * 5)) * RES;
    ctx.fillStyle = rand() < 0.5 ? T.dark : T.light;
    ctx.fillRect(x, y, w, RES);
    ctx.fillRect(x + RES, y - RES, w - RES * 2, RES);
  }
  if (theme === 'noche') {
    // reflejo de luna
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(255,240,200,${0.08 + rand() * 0.12})`;
      ctx.fillRect((250 + (rand() - 0.5) * 30) * RES, (40 + i * 4) * RES, (6 + rand() * 14) * RES, RES);
    }
  }
  // Borde de la piscina (arriba y abajo)
  const tile = 8;
  for (let x = 0; x < VW; x += tile) {
    ctx.fillStyle = (x / tile) % 2 ? T.edge : T.edgeDark;
    ctx.fillRect(x * RES, 0, tile * RES, 6 * RES);
    ctx.fillRect(x * RES, (VH - 4) * RES, tile * RES, 4 * RES);
  }
  ctx.fillStyle = T.rim;
  ctx.fillRect(0, 6 * RES, c.width, RES);
  ctx.fillRect(0, (VH - 5) * RES, c.width, RES);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 7 * RES, c.width, 2 * RES);

  // Luz suave arriba y más profundidad abajo
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, T.floor === 'lava' ? 'rgba(255,200,80,0.08)' : 'rgba(255,255,255,0.07)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, T.floor === 'lava' ? 'rgba(40,0,0,0.25)' : 'rgba(0,10,40,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 9 * RES, c.width, c.height - 14 * RES);
  if (T.overlay) {
    ctx.save();
    ctx.scale(RES, RES);
    T.overlay(ctx, rand);
    ctx.restore();
  }

  const fg = makeCanvas(VW * RES, VH * RES);
  const fctx = fg.getContext('2d');
  for (const b of balls) {
    if (T.platform === 'basalt') drawBasalt(fctx, b.x, b.y, b.r, rand);
    else drawBallPlatform(fctx, b.x, b.y, b.r);
  }
  for (const p of platforms) {
    if (T.platform === 'float') drawFloat(fctx, p.x, p.y, p.r);
    else if (T.platform === 'basalt') drawBasalt(fctx, p.x, p.y, p.r, rand);
    else drawPlatform(fctx, p.x, p.y, p.r, rand);
  }
  return { bg: c, fg };
}

// Red de luz que se mueve en el fondo del agua (se arma una sola vez).
// Son los bordes de celdas de Voronoi en una baldosa que se repite sin cortes.
const TILE = 96;
let causticTile = null;

function makeCaustics() {
  const n = TILE * RES;
  const c = makeCanvas(n, n);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(n, n);
  const rand = rng(4242);
  const pts = [];
  for (let i = 0; i < 9; i++) pts.push([rand() * n, rand() * n]);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      for (const [px, py] of pts) {
        let dx = Math.abs(x - px);
        let dy = Math.abs(y - py);
        if (dx > n / 2) dx = n - dx;
        if (dy > n / 2) dy = n - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      // Bordes anchos y suaves (luz difusa, no líneas finas)
      const k = Math.max(0, 1 - edge / (5 * RES));
      const o = (y * n + x) * 4;
      img.data[o] = 230;
      img.data[o + 1] = 248;
      img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(Math.pow(k, 2.6) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class Arena {
  constructor(theme, seed = 7) {
    this.theme = theme;
    this.name = THEMES[theme].name;
    this.T = THEMES[theme];
    const rand = rng(seed * 31 + 1);
    // Plataformas sin pisarse entre sí
    this.platforms = [];
    const fixed = [{ x: 80, y: 110, r: 22 }, { x: 240, y: 70, r: 22 }];
    for (const f of fixed) this.platforms.push({ x: f.x + (rand() - 0.5) * 20, y: f.y + (rand() - 0.5) * 16, r: f.r });
    for (let tries = 0; tries < 200 && this.platforms.length < 6; tries++) {
      const p = { x: 30 + rand() * 260, y: 45 + rand() * 110, r: 13 + rand() * 9 };
      if (this.platforms.every((q) => Math.hypot(q.x - p.x, (q.y - p.y) * 1.6) > q.r + p.r + 10)) this.platforms.push(p);
    }
    this.balls = [
      { x: -4, y: 60 + rand() * 30, r: 28 },
      { x: VW + 4, y: 110 + rand() * 30, r: 28 },
    ];
    this.platforms.sort((a, b) => a.y - b.y);
    // Piso firme: todo se pisa, no hay agua ni plataformas
    this.ground = this.T.floor === 'ground';
    if (this.ground) {
      this.platforms = [];
      this.balls = [];
    }
    const layers = renderBackground(theme, seed, this.platforms, this.balls);
    this.bg = layers.bg;
    this.fg = layers.fg;
    this.ice = [];
    this.glints = [];
    for (let i = 0; i < 70; i++) {
      this.glints.push({ x: rand() * VW, y: 10 + rand() * (VH - 16), w: 2 + rand() * 4, phase: rand() * 6.28, speed: 0.6 + rand() * 1.4 });
    }
    this.spawns = [{ x: 70, y: 110 }, { x: 250, y: 92 }];
  }

  // Dos capas de luz que se cruzan despacio
  drawCaustics(ctx, t) {
    if (!causticTile) causticTile = makeCaustics();
    if (!this.pattern) this.pattern = ctx.createPattern(causticTile, 'repeat');
    if (!this.pattern) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 9, VW, VH - 14);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = this.pattern;
    const layers = [[4.2, 2.2, 1, 1], [-3.1, 3, 1.45, 0.75]];
    for (const [vx, vy, scale, a] of layers) {
      const span = TILE * scale;
      const ox = (((t * vx) % span) + span) % span;
      const oy = (((t * vy) % span) + span) % span;
      ctx.save();
      ctx.globalAlpha = this.T.caustic * a;
      ctx.translate(ox - span, oy - span);
      ctx.scale(scale / RES, scale / RES);
      ctx.fillRect(0, 0, ((VW + span * 2) * RES) / scale, ((VH + span * 2) * RES) / scale);
      ctx.restore();
    }
    ctx.restore();
  }

  // ¿Está este punto sobre una plataforma (o en piso firme)?
  onPlatform(x, y) {
    if (this.ground) return true;
    for (const p of [...this.platforms, ...this.balls]) {
      const dx = (x - p.x) / p.r;
      const dy = (y - p.y) / (p.r * 0.55);
      if (dx * dx + dy * dy <= 1) return true;
    }
    return false;
  }

  freeze(x, y) {
    if (this.ice.length > 80) this.ice.shift();
    const pts = [];
    const n = 6 + Math.floor(fxRandom() * 3);
    const r = 5 + fxRandom() * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.6 + fxRandom() * 0.5);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.6]);
    }
    this.ice.push({ x, y, pts, life: 7 + fxRandom() * 2 });
  }

  update(dt) {
    for (const i of this.ice) i.life -= dt;
    this.ice = this.ice.filter((i) => i.life > 0);
  }

  drawWater(ctx, t) {
    ctx.drawImage(this.bg, 0, 0, VW, VH);
    if (this.ground) {
      this.drawBadge(ctx);
      this.T.animate?.(ctx, t, this);
      ctx.drawImage(this.fg, 0, 0, VW, VH);
      this.drawIce(ctx);
      return;
    }
    this.drawCaustics(ctx, t);
    // Espuma donde las plataformas tocan el agua
    ctx.lineWidth = 0.8;
    [...this.platforms, ...this.balls].forEach((p, i) => {
      const side = this.balls.includes(p) ? 5 : 4;
      const w = Math.sin(t * 2.2 + i * 1.7) * 0.7;
      ctx.strokeStyle = this.T.floor === 'lava' ? 'rgba(255,190,90,0.5)' : 'rgba(235,248,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + side + 0.6, p.r + 1.6 + w, p.r * 0.55 + 1.1 + w * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = this.T.floor === 'lava' ? 'rgba(255,190,90,0.2)' : 'rgba(235,248,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + side + 0.8, p.r + 4 - w, p.r * 0.55 + 2.8 - w * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Destellos que se mueven
    for (const g of this.glints) {
      const a = Math.sin(t * g.speed + g.phase);
      if (a < 0.3) continue;
      const x = (g.x + t * 3 * g.speed) % VW;
      if (this.onPlatform(x, g.y)) continue;
      ctx.globalAlpha = (a - 0.3) * 0.8;
      ctx.fillStyle = this.T.glint || '#e8f6ff';
      ctx.fillRect(Math.round(x), Math.round(g.y), g.w, 0.7);
    }
    ctx.globalAlpha = 1;
    this.drawBadge(ctx);
    this.T.animate?.(ctx, t, this);
    ctx.drawImage(this.fg, 0, 0, VW, VH);
    this.drawIce(ctx);
  }

  // Medalla del gimnasio pintada en el centro de la cancha
  drawBadge(ctx) {
    if (!this.T.badge) return;
    const img = badgeImage(this.T.badge);
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = this.ground ? 0.3 : 0.22;
    ctx.translate(VW / 2, 92);
    ctx.scale(1, 0.58);
    const s = 34 / Math.max(img.width, img.height);
    ctx.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  }

  drawIce(ctx) {
    // Hielo de Rayo Hielo
    for (const i of this.ice) {
      ctx.globalAlpha = Math.min(1, i.life);
      ctx.fillStyle = '#e8fbff';
      ctx.strokeStyle = '#7ad8f0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      i.pts.forEach(([px, py], k) => (k ? ctx.lineTo(i.x + px, i.y + py) : ctx.moveTo(i.x + px, i.y + py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(i.x - 1.5, i.y - 1, 2, 0.6);
    }
    ctx.globalAlpha = 1;
  }
}

let vignetteCanvas = null;

export function vignette(ctx) {
  if (!vignetteCanvas) {
    vignetteCanvas = makeCanvas(VW, VH);
    const v = vignetteCanvas.getContext('2d');
    const g = v.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VW * 0.62);
    g.addColorStop(0, 'rgba(6,4,24,0)');
    g.addColorStop(1, 'rgba(6,4,24,0.42)');
    v.fillStyle = g;
    v.fillRect(0, 0, VW, VH);
  }
  ctx.drawImage(vignetteCanvas, 0, 0, VW, VH);
}

export function arenaName(key) {
  return THEMES[key]?.name || '';
}
