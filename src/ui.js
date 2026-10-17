import { FONT } from './config.js';
import { TYPES } from './data.js';
import { spriteOf, frameAt } from './sprites.js';

export function font(size, weight = 800) {
  return `${weight} ${size}px ${FONT}`;
}

export function text(ctx, str, x, y, { size = 6, weight = 800, color = '#fff', align = 'left', baseline = 'alphabetic', stroke = null, strokeW = 1.2, alpha = 1, shadow = false } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(str, x + size * 0.08, y + size * 0.12);
  }
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function textWidth(ctx, str, size, weight = 800) {
  ctx.save();
  ctx.font = font(size, weight);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, { fill = 'rgba(18,13,28,0.82)', border = 'rgba(255,255,255,0.14)', r = 3, lw = 0.6 } = {}) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (border) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = border;
    ctx.stroke();
  }
}

export function typeBadge(ctx, type, x, y, { size = 3.6, align = 'left' } = {}) {
  const t = TYPES[type];
  const w = textWidth(ctx, t.name, size, 800) + size * 1.6;
  const h = size * 1.6;
  const bx = align === 'right' ? x - w : x;
  roundRect(ctx, bx, y, w, h, h / 2);
  ctx.fillStyle = t.color;
  ctx.fill();
  text(ctx, t.name, bx + w / 2, y + h * 0.74, { size, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.35)', strokeW: 0.6 });
  return w;
}

export function bar(ctx, x, y, w, h, frac, color, { back = 'rgba(0,0,0,0.55)', ghost = null, rtl = false } = {}) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  const draw = (f, c) => {
    const fw = Math.max(0, Math.min(1, f)) * w;
    ctx.fillStyle = c;
    ctx.fillRect(rtl ? x + w - fw : x, y, fw, h);
  };
  if (ghost !== null) draw(ghost, '#fff4d6');
  draw(frac, color);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, w, h * 0.3);
}

// Dibuja un Pokémon (animado) centrado en (x, y) ajustado a `size` unidades
export function drawCreature(ctx, id, x, y, size, { faceLeft = false, white = false, black = false, alpha = 1, boss = false, t = performance.now() / 1000 } = {}) {
  const spr = spriteOf(id, boss);
  const img = white ? spr.white : black ? spr.black : frameAt(spr, t);
  const scale = size / Math.max(img.width, img.height);
  const flip = spr.facesLeft !== faceLeft;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

// Botón de menú; devuelve su rectángulo para detección de toques
export function button(ctx, label, x, y, w, h, { selected = false, color = '#ff7a2f', size = 6, sub = null, disabled = false } = {}) {
  ctx.save();
  if (selected) {
    roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 4);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  roundRect(ctx, x, y + 1.2, w, h, 3.5);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  roundRect(ctx, x, y, w, h, 3.5);
  ctx.fillStyle = disabled ? '#4a4458' : color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, x + 1, y + 0.8, w - 2, h * 0.4, 2.5);
  ctx.fill();
  const ty = sub ? y + h * 0.5 : y + h * 0.5 + size * 0.36;
  text(ctx, label, x + w / 2, ty, { size, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.4)', strokeW: 1 });
  if (sub) text(ctx, sub, x + w / 2, y + h * 0.5 + size * 0.95, { size: size * 0.55, weight: 600, align: 'center', color: 'rgba(255,255,255,0.85)' });
  ctx.restore();
  return { x, y, w, h };
}

export function inRect(px, py, r) {
  return r && px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function ease(t) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

export function backOut(t) {
  t = Math.max(0, Math.min(1, t));
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}
