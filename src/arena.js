// Arena acuática: piscina con plataformas de madera y Poké Balls flotantes
import { VW, VH } from './config.js';
import { rng } from './crowd.js';

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
  },
  lago: {
    name: 'LAGO ESMERALDA',
    water: ['#1c6f86', '#18637a', '#23809a', '#196a80'],
    dark: '#145566',
    light: '#3d9db5',
    edge: '#c9b48a',
    edgeDark: '#9c8660',
    rim: '#6b5a3c',
  },
  noche: {
    name: 'MAR NOCTURNO',
    water: ['#142a5c', '#11244f', '#1b3570', '#132857'],
    dark: '#0d1d40',
    light: '#3456a0',
    edge: '#3a3a5c',
    edgeDark: '#26263f',
    rim: '#deb248',
  },
};

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

  for (const b of balls) drawBallPlatform(ctx, b.x, b.y, b.r);
  for (const p of platforms) drawPlatform(ctx, p.x, p.y, p.r, rand);
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
    this.bg = renderBackground(theme, seed, this.platforms, this.balls);
    this.ice = [];
    this.glints = [];
    for (let i = 0; i < 70; i++) {
      this.glints.push({ x: rand() * VW, y: 10 + rand() * (VH - 16), w: 2 + rand() * 4, phase: rand() * 6.28, speed: 0.6 + rand() * 1.4 });
    }
    this.spawns = [{ x: 70, y: 110 }, { x: 250, y: 92 }];
  }

  // ¿Está este punto sobre una plataforma?
  onPlatform(x, y) {
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
    const n = 6 + Math.floor(Math.random() * 3);
    const r = 5 + Math.random() * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.6 + Math.random() * 0.5);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.6]);
    }
    this.ice.push({ x, y, pts, life: 7 + Math.random() * 2 });
  }

  update(dt) {
    for (const i of this.ice) i.life -= dt;
    this.ice = this.ice.filter((i) => i.life > 0);
  }

  drawWater(ctx, t) {
    ctx.drawImage(this.bg, 0, 0, VW, VH);
    // Destellos que se mueven
    for (const g of this.glints) {
      const a = Math.sin(t * g.speed + g.phase);
      if (a < 0.3) continue;
      const x = (g.x + t * 3 * g.speed) % VW;
      if (this.onPlatform(x, g.y)) continue;
      ctx.globalAlpha = (a - 0.3) * 0.8;
      ctx.fillStyle = '#e8f6ff';
      ctx.fillRect(Math.round(x), Math.round(g.y), g.w, 0.7);
    }
    ctx.globalAlpha = 1;
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
