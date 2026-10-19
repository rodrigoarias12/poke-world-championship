import { text } from './ui.js';
import { fxRandom } from './rng.js';

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
  petalo: ['#ffffff', '#ffe0ec', '#ffa8c8', '#f2679a', '#b8336a'],
  lunar: ['#ffffff', '#fff0fa', '#ffc8ec', '#e888d0', '#9a4a9a'],
  siniestro: ['#e8e0f0', '#a89cc0', '#6a5a8a', '#3a2c52', '#1a1028'],
};

// Forma de las partículas según el tipo del golpe
const HIT_STYLE = {
  fuego: 'fire', agua: 'water', hielo: 'ice', electrico: 'electric', planta: 'leaf', solar: 'leaf',
  roca: 'rock', fantasma: 'ghost', siniestro: 'ghost', psiquico: 'psychic', lucha: 'fight', aura: 'fight',
  hada: 'fairy', lunar: 'fairy', estrella: 'star', normal: 'star', hiper: 'fight', petalo: 'petal',
};

const pick = (arr) => arr[Math.floor(fxRandom() * arr.length)];

export class Effects {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.ghosts = [];
    this.impacts = [];
    this.circles = [];
    this.decals = [];
  }

  // Partículas con forma propia según el tipo del golpe (hojas, gotas, chispas…)
  typeHit(x, y, fx, power = 10) {
    const colors = TYPE_COLORS[fx] || TYPE_COLORS.normal;
    const n = Math.round(4 + Math.min(16, power * 0.5));
    const style = HIT_STYLE[fx] || 'star';
    const shaped = (shape, k, o = {}) => {
      for (let i = 0; i < k; i++) {
        const a = fxRandom() * Math.PI * 2;
        const sp = (o.speed || 60) * (0.4 + fxRandom() * 0.8);
        const l = (o.life || 0.6) * (0.7 + fxRandom() * 0.6);
        this.particles.push({
          x: x + (fxRandom() - 0.5) * (o.jitter || 4), y: y + (fxRandom() - 0.5) * (o.jitter || 4),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (o.flat || 1) - (o.up || 0),
          life: l, max: l, size: (o.size || 2) * (0.7 + fxRandom() * 0.6),
          color: o.colors ? pick(o.colors) : pick(colors), grav: o.grav || 0, drag: o.drag ?? 3,
          shape, rot: fxRandom() * 6.3, spin: (fxRandom() - 0.5) * (o.spin || 10),
        });
      }
    };
    switch (style) {
      case 'fire':
        shaped('spark', n, { speed: 70, up: 40, life: 0.5, size: 2.4 });
        shaped('smoke', 3, { speed: 14, up: 18, life: 0.9, size: 5, colors: ['rgba(60,40,40,0.55)', 'rgba(90,70,60,0.5)'], drag: 1 });
        break;
      case 'water':
        shaped('drop', n, { speed: 80, up: 50, grav: 260, life: 0.6, size: 1.9 });
        this.ring(x, y + 4, 'rgba(230,248,255,0.9)', { maxR: 10 + power * 0.4, life: 0.35, width: 1 });
        break;
      case 'ice':
        shaped('shard', n, { speed: 75, up: 25, grav: 160, life: 0.6, size: 2.6, spin: 14 });
        break;
      case 'electric':
        shaped('spark', n + 4, { speed: 130, life: 0.25, size: 3, drag: 6 });
        shaped('bolt', 3, { speed: 10, life: 0.18, size: 9, drag: 1 });
        break;
      case 'leaf':
        shaped('leaf', n, { speed: 55, up: 20, grav: 40, life: 0.9, size: 2.6, spin: 9, drag: 2 });
        break;
      case 'petal':
        shaped('petal', n + 4, { speed: 60, up: 18, grav: 30, life: 1.1, size: 2.6, spin: 7, drag: 2 });
        break;
      case 'rock':
        shaped('shard', n, { speed: 90, up: 45, grav: 300, life: 0.7, size: 2.8, spin: 12, colors: ['#a09381', '#6c6156', '#d2c5b1'] });
        shaped('smoke', 3, { speed: 18, up: 6, life: 0.7, size: 5, colors: ['rgba(200,185,160,0.5)'], drag: 2 });
        break;
      case 'ghost':
        shaped('wisp', Math.ceil(n * 0.7), { speed: 25, up: 30, life: 0.9, size: 3, drag: 1.5 });
        break;
      case 'psychic':
        this.ring(x, y, colors[2], { maxR: 12 + power * 0.5, life: 0.4, width: 1.4 });
        this.ring(x, y, colors[1], { r: 4, maxR: 20 + power * 0.6, life: 0.55, width: 0.8 });
        shaped('sparkle', Math.ceil(n * 0.6), { speed: 45, life: 0.55, size: 3 });
        break;
      case 'fight':
        this.ring(x, y, '#ffffff', { maxR: 14 + power * 0.5, life: 0.22, width: 2 });
        shaped('spark', n, { speed: 140, life: 0.2, size: 3.2, drag: 7 });
        break;
      case 'fairy':
        shaped('heart', Math.ceil(n * 0.6), { speed: 40, up: 22, life: 0.9, size: 3, drag: 2 });
        shaped('sparkle', Math.ceil(n * 0.5), { speed: 55, life: 0.6, size: 3 });
        break;
      default:
        shaped('sparkle', n, { speed: 60, life: 0.5, size: 3 });
    }
  }

  // Marca en el piso que se borra de a poco (quemadura, charco, grieta…)
  decal(x, y, fx, size = 10) {
    if (this.decals.length > 40) this.decals.shift();
    const cracks = [];
    for (let i = 0; i < 6; i++) cracks.push([fxRandom() * Math.PI * 2, 0.5 + fxRandom() * 0.6]);
    this.decals.push({ x, y, fx, size, life: 5, max: 5, rot: fxRandom() * 6.3, cracks });
  }

  renderDecals(ctx) {
    for (const d of this.decals) {
      const a = Math.min(1, d.life / 1.5);
      const r = d.size;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(d.x, d.y);
      const style = HIT_STYLE[d.fx] || 'star';
      if (style === 'fire' || style === 'electric') {
        ctx.fillStyle = 'rgba(30,18,14,0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.life > 3) {
          ctx.fillStyle = style === 'fire' ? 'rgba(255,140,40,0.7)' : 'rgba(255,230,90,0.7)';
          for (const [ang, k] of d.cracks) ctx.fillRect(Math.cos(ang) * r * k * 0.7 - 0.5, Math.sin(ang) * r * k * 0.38 - 0.5, 1, 1);
        }
      } else if (style === 'water' || style === 'ice') {
        ctx.fillStyle = style === 'ice' ? 'rgba(200,240,255,0.55)' : 'rgba(110,170,230,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(235,250,255,0.6)';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      } else if (style === 'leaf' || style === 'petal') {
        for (const [ang, k] of d.cracks) {
          ctx.save();
          ctx.translate(Math.cos(ang) * r * k, Math.sin(ang) * r * k * 0.5);
          ctx.rotate(ang);
          ctx.fillStyle = style === 'petal' ? '#f2679a' : '#4c9a3e';
          ctx.beginPath();
          ctx.ellipse(0, 0, 1.6, 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (style === 'ghost' || style === 'psychic' || style === 'fairy') {
        const c = (TYPE_COLORS[d.fx] || TYPE_COLORS.normal)[3];
        ctx.strokeStyle = c;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = a * 0.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.8, r * 0.42, d.rot * 0.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.45, r * 0.24, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Grietas
        ctx.strokeStyle = 'rgba(40,28,20,0.6)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (const [ang, k] of d.cracks) {
          const ex = Math.cos(ang) * r * k;
          const ey = Math.sin(ang) * r * k * 0.5;
          ctx.moveTo(0, 0);
          ctx.lineTo(ex * 0.5 + Math.sin(ang * 3) * 1.5, ey * 0.5);
          ctx.lineTo(ex, ey);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Partícula armada a mano (estela de rayos, cortes, carga)
  add(p) {
    this.particles.push(p);
  }

  // Estrella de impacto estilo cómic
  impact(x, y, size, color) {
    this.impacts.push({ x, y, size, color, rot: fxRandom() * Math.PI, life: 0.18, max: 0.18 });
  }

  // Círculo mágico bajo el Pokémon al lanzar un ataque fuerte
  circle(x, y, r, color, life = 0.7) {
    this.circles.push({ x, y, r, color, life, max: life, rot: fxRandom() * 6 });
  }

  burst(x, y, colors, { count = 10, speed = 60, size = 1.5, life = 0.45, grav = 0, drag = 3, spread = Math.PI * 2, angle = 0, up = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (fxRandom() - 0.5) * spread;
      const s = speed * (0.35 + fxRandom() * 0.75);
      const l = life * (0.6 + fxRandom() * 0.6);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - up,
        life: l, max: l,
        size: size * (0.6 + fxRandom() * 0.8),
        color: pick(colors),
        grav, drag,
      });
    }
  }

  trail(x, y, colors, { size = 1.4, life = 0.3, jitter = 1.5, vy = -8 } = {}) {
    const l = life * (0.6 + fxRandom() * 0.6);
    this.particles.push({
      x: x + (fxRandom() - 0.5) * jitter * 2,
      y: y + (fxRandom() - 0.5) * jitter * 2,
      vx: (fxRandom() - 0.5) * 8,
      vy: vy + (fxRandom() - 0.5) * 6,
      life: l, max: l,
      size: size * (0.6 + fxRandom() * 0.8),
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
      if (p.spin) p.rot += p.spin * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const d of this.decals) d.life -= dt;
    this.decals = this.decals.filter((d) => d.life > 0);
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
      if (!p.shape) {
        ctx.fillRect(Math.round((p.x - s / 2) * 2) / 2, Math.round((p.y - s / 2) * 2) / 2, s, s);
        continue;
      }
      drawShape(ctx, p, s);
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

// Partículas con forma: hoja, pétalo, gota, chispa, rayito, esquirla, humo, fantasmita, corazón, destello
function drawShape(ctx, p, s) {
  switch (p.shape) {
    case 'leaf':
    case 'petal':
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * (p.shape === 'leaf' ? 0.45 : 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
      if (p.shape === 'leaf') {
        ctx.fillStyle = 'rgba(30,70,30,0.5)';
        ctx.fillRect(-s * 0.8, -0.15, s * 1.6, 0.3);
      }
      ctx.restore();
      break;
    case 'drop':
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'spark': {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const len = Math.min(5, s * 0.6 + sp * 0.02);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.5, s * 0.3);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
      ctx.stroke();
      break;
    }
    case 'bolt': {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      let x = p.x;
      let y = p.y;
      ctx.moveTo(x, y);
      for (let i = 0; i < 4; i++) {
        x += Math.cos(p.rot + i) * s * 0.3;
        y += Math.sin(p.rot) * s * 0.3 + (i % 2 ? 1.5 : -1.5);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 'shard':
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.7);
      ctx.lineTo(s * 0.5, s * 0.4);
      ctx.lineTo(-s * 0.5, s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    case 'smoke': {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha *= 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + k * 1.2), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wisp':
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.4;
      ctx.beginPath();
      ctx.arc(p.x - p.vx * 0.04, p.y - p.vy * 0.04 + s * 0.6, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'heart': {
      const r = s * 0.35;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.arc(-r, 0, r, Math.PI, 0);
      ctx.arc(r, 0, r, Math.PI, 0);
      ctx.lineTo(0, r * 2.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'sparkle':
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * 0.3);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.18 : s * 0.6;
        const a = (i * Math.PI) / 4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    case 'jaw': {
      // Fila de colmillos (arriba o abajo) de una mordida
      const w = p.size;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1b1224';
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) {
        const x0 = p.x - w / 2 + (i * w) / 3;
        ctx.beginPath();
        ctx.moveTo(x0, p.y);
        ctx.lineTo(x0 + w / 3, p.y);
        ctx.lineTo(x0 + w / 6, p.y + (p.top ? 4 : -4));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    default:
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
}
