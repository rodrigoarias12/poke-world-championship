import { text } from './ui.js';

export const TYPE_COLORS = {
  fuego: ['#fff3a0', '#ffe45c', '#ff9520', '#f0603a', '#b83a22'],
  agua: ['#ffffff', '#e6faff', '#8fd3ff', '#4aa8e8', '#2b6fb8'],
  electrico: ['#ffffff', '#fff6a0', '#7df9ff', '#ffcf33', '#d39a10'],
  planta: ['#eaffc9', '#c9f59a', '#9be37a', '#5cc45a', '#3b8f45'],
  roca: ['#efe6d6', '#d2c5b1', '#a09381', '#6c6156', '#4e463e'],
  fantasma: ['#f0e6ff', '#c9b0ff', '#9a78d6', '#5b3f8c', '#2a1a48'],
  psiquico: ['#ffffff', '#ffd0e4', '#ff8fbf', '#f95587', '#b02a68'],
  lucha: ['#fff0e0', '#ffb59a', '#e8634c', '#d24a3a', '#8a2a20'],
  hada: ['#ffffff', '#ffe0f4', '#ffb3e6', '#f08fd0', '#c45aa8'],
  normal: ['#ffffff', '#f2f0e0', '#d8d5b8', '#a8a77a', '#77765a'],
  estrella: ['#ffffff', '#fff6b0', '#ffe45c', '#ffcf33', '#e0a020'],
  aura: ['#ffffff', '#c8ecff', '#7cc8ff', '#3a8fe0', '#1d4f9a'],
  hielo: ['#ffffff', '#e8fbff', '#b8f0ff', '#7ad8f0', '#3aa0c8'],
  hiper: ['#ffffff', '#fff8c8', '#ffe066', '#ffb020', '#e06010'],
  solar: ['#ffffff', '#fffbd0', '#fff07a', '#c8e84a', '#6fb02a'],
  neutral: ['#ffffff', '#fff4d6', '#e8dcc0', '#b8a58c', '#7a6a55'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Effects {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.ghosts = [];
    this.impacts = [];
    this.circles = [];
  }

  // Estrella de impacto estilo cómic
  impact(x, y, size, color) {
    this.impacts.push({ x, y, size, color, rot: Math.random() * Math.PI, life: 0.18, max: 0.18 });
  }

  // Círculo mágico bajo el Pokémon al lanzar un ataque fuerte
  circle(x, y, r, color, life = 0.7) {
    this.circles.push({ x, y, r, color, life, max: life, rot: Math.random() * 6 });
  }

  burst(x, y, colors, { count = 10, speed = 60, size = 1.5, life = 0.45, grav = 0, drag = 3, spread = Math.PI * 2, angle = 0, up = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.75);
      const l = life * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - up,
        life: l, max: l,
        size: size * (0.6 + Math.random() * 0.8),
        color: pick(colors),
        grav, drag,
      });
    }
  }

  trail(x, y, colors, { size = 1.4, life = 0.3, jitter = 1.5, vy = -8 } = {}) {
    const l = life * (0.6 + Math.random() * 0.6);
    this.particles.push({
      x: x + (Math.random() - 0.5) * jitter * 2,
      y: y + (Math.random() - 0.5) * jitter * 2,
      vx: (Math.random() - 0.5) * 8,
      vy: vy + (Math.random() - 0.5) * 6,
      life: l, max: l,
      size: size * (0.6 + Math.random() * 0.8),
      color: pick(colors),
      grav: 0, drag: 2,
    });
  }

  dust(x, y, n = 6) {
    this.burst(x, y, ['#e8dcc0', '#cbbd9f', '#a8987c'], { count: n, speed: 25, size: 1.6, life: 0.5, drag: 4, up: 6 });
  }

  ring(x, y, color, { r = 2, maxR = 14, life = 0.3, width = 1.2 } = {}) {
    this.rings.push({ x, y, r, r0: r, maxR, life, max: life, color, width });
  }

  float(str, x, y, { color = '#fff', size = 5, life = 0.9, vy = -18, stroke = '#1b1224', weight = 900 } = {}) {
    this.texts.push({ str, x, y, color, size, life, max: life, vy, stroke, weight });
  }

  ghost(id, x, y, flip, scale) {
    this.ghosts.push({ id, x, y, flip, scale, life: 0.22, max: 0.22 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    for (const r of this.rings) {
      r.life -= dt;
      const t = 1 - r.life / r.max;
      r.r = r.r0 + (r.maxR - r.r0) * (1 - Math.pow(1 - t, 2));
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= Math.exp(-3 * dt);
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const g of this.ghosts) g.life -= dt;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    for (const i of this.impacts) i.life -= dt;
    this.impacts = this.impacts.filter((i) => i.life > 0);
    for (const c of this.circles) {
      c.life -= dt;
      c.rot += dt * 3;
    }
    this.circles = this.circles.filter((c) => c.life > 0);
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      const a = Math.min(1, (p.life / p.max) * 1.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * (0.5 + 0.5 * (p.life / p.max));
      ctx.fillRect(Math.round((p.x - s / 2) * 2) / 2, Math.round((p.y - s / 2) * 2) / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  renderImpacts(ctx) {
    for (const i of this.impacts) {
      const k = 1 - i.life / i.max;
      const R = i.size * (0.55 + k * 0.6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (i.life / i.max) * 2);
      ctx.translate(i.x, i.y);
      ctx.rotate(i.rot);
      ctx.beginPath();
      for (let n = 0; n < 16; n++) {
        const a = (n / 16) * Math.PI * 2;
        const rr = n % 2 ? R * 0.42 : R * (n % 4 ? 0.8 : 1);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = Math.max(0.8, i.size * 0.08);
      ctx.strokeStyle = i.color;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Anillos (ondas en el agua, impactos): van debajo de los Pokémon
  renderRings(ctx) {
    for (const c of this.circles) {
      const k = 1 - c.life / c.max;
      const s = 0.5 + Math.min(1, k * 4) * 0.5;
      const alpha = Math.min(1, (c.life / c.max) * 2.5);
      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.translate(c.x, c.y);
      ctx.scale(1, 0.55);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, c.r * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, c.r * s * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      // runas girando
      ctx.fillStyle = c.color;
      for (let n = 0; n < 8; n++) {
        const a = c.rot + (n / 8) * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * c.r * s * 0.86, Math.sin(a) * c.r * s * 0.86);
        ctx.rotate(a);
        ctx.fillRect(-1.6, -0.6, 3.2, 1.2);
        ctx.restore();
      }
      ctx.restore();
    }
    for (const r of this.rings) {
      ctx.globalAlpha = Math.min(1, (r.life / r.max) * 1.5);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  renderTexts(ctx) {
    for (const t of this.texts) {
      const k = 1 - t.life / t.max;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : k < 0.2 ? 1.15 - ((k - 0.12) / 0.08) * 0.15 : 1;
      const alpha = t.life < 0.25 ? t.life / 0.25 : 1;
      text(ctx, t.str, t.x, t.y, { size: t.size * pop, weight: t.weight, color: t.color, align: 'center', stroke: t.stroke, strokeW: t.size * 0.32, alpha });
    }
  }
}
