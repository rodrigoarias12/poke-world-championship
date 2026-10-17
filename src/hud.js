import { VW, VH } from './config.js';
import { TYPES, DIFFICULTY, KEY_LABELS } from './data.js';
import { text, textWidth, roundRect, drawCreature, backOut } from './ui.js';

// Colores de la barra de vida: [brillo, color, sombra]
function hpColors(f) {
  const k = f.hp / f.maxHp;
  if (k > 0.5) return ['#a6f7a0', '#4fd65a', '#2a9440'];
  if (k > 0.25) return ['#fff0a0', '#f2c318', '#b88400'];
  return ['#ffb0b0', '#ff4b4b', '#b01f30'];
}

// Barra de vida redondeada, con degradé, brillo, marcas y el daño reciente en blanco
function hpBar(ctx, x, y, w, h, f, rtl, t) {
  const frac = Math.max(0, Math.min(1, f.hp / f.maxHp));
  const ghost = Math.max(0, Math.min(1, f.ghostHp / f.maxHp));
  roundRect(ctx, x - 1, y - 1, w + 2, h + 2, (h + 2) / 2);
  ctx.fillStyle = '#1b1224';
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.clip();
  ctx.fillStyle = '#3a2f52';
  ctx.fillRect(x, y, w, h);
  const seg = (k, fill) => {
    const fw = k * w;
    ctx.fillStyle = fill;
    ctx.fillRect(rtl ? x + w - fw : x, y, fw, h);
  };
  if (ghost > frac) seg(ghost, '#fff4d6');
  const [hi, mid, lo] = hpColors(f);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, hi);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  seg(frac, g);
  // Con poca vida, la barra late
  if (frac <= 0.25 && frac > 0) {
    ctx.globalAlpha = 0.25 + Math.sin(t * 10) * 0.25;
    seg(frac, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y + 0.5, w, h * 0.28);
  ctx.fillStyle = 'rgba(20,10,30,0.3)';
  for (let i = 1; i < 10; i++) ctx.fillRect(x + (w * i) / 10 - 0.25, y + h * 0.5, 0.5, h * 0.5);
  ctx.restore();
}

function miniBall(ctx, x, y, alive) {
  ctx.fillStyle = '#1b1224';
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alive ? '#e8413b' : '#5a5466';
  ctx.beginPath();
  ctx.arc(x, y, 2, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = alive ? '#f4f1ea' : '#8a8494';
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#1b1224';
  ctx.fillRect(x - 2, y - 0.3, 4, 0.6);
}

function sidePanel(ctx, b, side, t) {
  const f = b.fighters[side];
  const left = side === 0;
  const pcx = left ? 15 : VW - 15;
  const pcy = 15;
  // Retrato redondo
  ctx.save();
  ctx.beginPath();
  ctx.arc(pcx, pcy, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#1b1224';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pcx, pcy, 11, 0, Math.PI * 2);
  ctx.fillStyle = TYPES[f.type].color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pcx, pcy, 9.6, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f1ea';
  ctx.fill();
  ctx.clip();
  drawCreature(ctx, f.key, pcx, pcy + 2, 20, { faceLeft: !left, boss: f.boss, t: f.animT });
  ctx.restore();

  // En línea: marca cuál es el Pokémon de este celular
  if (b.online && side === b.localSide) {
    roundRect(ctx, pcx - 8, pcy + 9.5, 16, 7, 3);
    ctx.fillStyle = '#ffe66b';
    ctx.fill();
    text(ctx, 'TÚ', pcx, pcy + 15, { size: 5, weight: 900, align: 'center', color: '#1b1224' });
  }

  // Equipo (Poké Balls)
  const team = b.teams[side];
  team.keys.forEach((_, i) => {
    const bx = left ? 6 + i * 6.5 : VW - 6 - i * 6.5;
    miniBall(ctx, bx, b.online ? 37 : 32, !team.fainted.includes(i));
  });

  // Nombre, vida y barra (sobre una placa inclinada)
  const x0 = left ? 30 : VW - 30;
  const barW = 116;
  const bx = left ? x0 : x0 - barW;
  ctx.save();
  if (!left) {
    ctx.translate(VW, 0);
    ctx.scale(-1, 1);
  }
  const plate = ctx.createLinearGradient(26, 0, 152, 0);
  plate.addColorStop(0, 'rgba(14,10,26,0.72)');
  plate.addColorStop(1, 'rgba(14,10,26,0.25)');
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.moveTo(24, 1.5);
  ctx.lineTo(152, 1.5);
  ctx.lineTo(147, 19.5);
  ctx.lineTo(24, 19.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const nameSize = f.name.length > 12 ? 5 : 6.2;
  text(ctx, f.name, x0, 9, { size: nameSize, weight: 900, align: left ? 'left' : 'right', color: '#fff', stroke: '#1b1224', strokeW: 1.6 });
  const hpStr = `♥ ${Math.ceil(f.hp)}`;
  text(ctx, hpStr, left ? bx + barW : bx, 9, { size: 6, weight: 900, align: left ? 'right' : 'left', color: '#ff7a8a', stroke: '#1b1224', strokeW: 1.6 });
  hpBar(ctx, bx, 11.6, barW, 4.6, f, !left, t);
  if (f.boss) {
    text(ctx, 'JEFE', left ? bx : bx + barW, 22, { size: 3.6, weight: 900, align: left ? 'left' : 'right', color: '#ff7ac4', stroke: '#1b1224', strokeW: 1 });
  }

  // Etiqueta del último ataque (como en el video)
  const c = b.callouts[side];
  if (c && c.t < 1.6) {
    const k = backOut(c.t / 0.18);
    const alpha = c.t > 1.3 ? 1 - (c.t - 1.3) / 0.3 : 1;
    const size = 4;
    const w = textWidth(ctx, c.text.toUpperCase(), size, 900) + 6;
    const tx = left ? bx + (f.boss ? 14 : 0) : bx + barW - (f.boss ? 14 : 0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(tx, 22);
    ctx.scale(k, k);
    roundRect(ctx, left ? 0 : -w, -4.5, w, 7, 1.5);
    ctx.fillStyle = c.super ? '#ffe66b' : '#f4f1ea';
    ctx.fill();
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = '#1b1224';
    ctx.stroke();
    text(ctx, c.text.toUpperCase(), left ? w / 2 : -w / 2, 1, { size, weight: 900, align: 'center', color: '#1b1224' });
    ctx.restore();
  }
}

export const PAUSE_RECT = { x: VW / 2 - 13, y: 10, w: 26, h: 20 };

export function renderHUD(ctx, b, t) {
  sidePanel(ctx, b, 0, t);
  sidePanel(ctx, b, 1, t);

  // Centro: dificultad y pausa
  const d = b.online ? { label: 'EN LÍNEA', color: '#2e9e8f' } : DIFFICULTY[b.difficulty];
  const dw = textWidth(ctx, d.label, 3) + 5;
  roundRect(ctx, VW / 2 - dw / 2, 4, dw, 6, 3);
  ctx.fillStyle = d.color;
  ctx.fill();
  text(ctx, d.label, VW / 2, 8.2, { size: 3, weight: 900, align: 'center' });
  roundRect(ctx, VW / 2 - 4.5, 13, 9, 8, 2);
  ctx.fillStyle = 'rgba(14,10,24,0.75)';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(VW / 2 - 2, 15, 1.4, 4);
  ctx.fillRect(VW / 2 + 0.6, 15, 1.4, 4);

  if (!b.game.input.touchMode) renderHotbar(ctx, b, t);
}

// Barra de ataques del jugador (abajo a la izquierda)
function renderHotbar(ctx, b, t) {
  const f = b.player;
  if (!f) return;
  const w = 36;
  const h = 15;
  const y = VH - h - 3;
  roundRect(ctx, 2, y - 2, w * 5 + 6, h + 4, 2.5);
  ctx.fillStyle = 'rgba(14,10,24,0.72)';
  ctx.fill();
  f.moves.forEach((m, i) => {
    const x = 4 + i * (w + 0.5);
    const cd = f.cds[i];
    const total = m.cd * (f.boss ? 0.85 : 1);
    const ready = cd <= 0;
    roundRect(ctx, x, y, w - 1, h, 1.5);
    ctx.fillStyle = ready ? (i === 4 ? '#5a4410' : '#2c2547') : '#1e1930';
    ctx.fill();
    if (!ready) {
      const k = cd / total;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y + h * (1 - k), w - 1, h * k);
    }
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = ready ? (i === 4 ? `rgba(255,230,107,${0.7 + Math.sin(t * 8) * 0.3})` : 'rgba(255,255,255,0.45)') : 'rgba(255,255,255,0.12)';
    roundRect(ctx, x, y, w - 1, h, 1.5);
    ctx.stroke();
    // tecla
    const label = KEY_LABELS[i];
    const kw = textWidth(ctx, label, 3) + 2.4;
    roundRect(ctx, x + 1.2, y + 1.2, kw, 4.6, 1);
    ctx.fillStyle = ready ? '#f4f1ea' : '#6a6478';
    ctx.fill();
    text(ctx, label, x + 1.2 + kw / 2, y + 4.7, { size: 3, weight: 900, align: 'center', color: '#1b1224' });
    if (!ready) text(ctx, cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1), x + w - 2.5, y + 5, { size: 3.4, weight: 900, align: 'right', color: '#ffb43b' });
    const name = m.name.toUpperCase();
    const size = name.length > 13 ? 2.4 : name.length > 10 ? 2.8 : 3.2;
    text(ctx, name, x + 1.5, y + h - 2.5, { size, weight: 900, color: ready ? '#ffffff' : 'rgba(255,255,255,0.5)' });
  });
}

// Joystick y botones para pantallas táctiles
export function touchLayout() {
  return {
    joyTop: 50,
    // ESQUIVAR (m2) es el más usado: grande y cerca del pulgar
    buttons: [
      { id: 'm0', x: 291, y: 145, r: 14 },
      { id: 'm1', x: 301, y: 112, r: 10 },
      { id: 'm2', x: 257, y: 156, r: 12 },
      { id: 'm3', x: 270, y: 121, r: 10 },
      { id: 'm4', x: 244, y: 130, r: 10 },
    ],
  };
}

export function renderTouchControls(ctx, b, input) {
  const layout = input.controls;
  if (!layout || !input.touchMode) return;
  const f = b.player;
  layout.buttons.forEach((btn, i) => {
    const m = f.moves[i];
    const down = input.isDown(btn.id);
    const cd = f.cds[i];
    const total = m.cd * (f.boss ? 0.85 : 1);
    const ready = 1 - cd / total;
    ctx.save();
    ctx.globalAlpha = down ? 0.95 : 0.8;
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,6,20,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, btn.r * (down ? 0.86 : 0.92), 0, Math.PI * 2);
    ctx.fillStyle = i === 4 ? '#c9952a' : i === 2 ? 'rgba(200,240,255,0.5)' : TYPES[f.type].color;
    ctx.fill();
    if (ready < 1) {
      ctx.beginPath();
      ctx.moveTo(btn.x, btn.y);
      ctx.arc(btn.x, btn.y, btn.r * 0.92, -Math.PI / 2 + ready * Math.PI * 2, Math.PI * 1.5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
    }
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
    ctx.stroke();
    const words = m.name.toUpperCase().split(' ');
    const size = btn.r > 11 ? 3.2 : 2.5;
    words.slice(0, 2).forEach((wd, k, arr) => {
      text(ctx, wd, btn.x, btn.y + 1 + (k - (arr.length - 1) / 2) * size * 1.1, { size, weight: 900, align: 'center', color: '#fff', stroke: 'rgba(0,0,0,0.6)', strokeW: 0.8 });
    });
    ctx.restore();
  });
  // Joystick
  const j = input.joy;
  const ox = j ? j.ox : 34;
  const oy = j ? j.oy : 140;
  ctx.save();
  ctx.globalAlpha = j ? 0.8 : 0.35;
  ctx.beginPath();
  ctx.arc(ox, oy, 15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,6,20,0.45)';
  ctx.fill();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  let kx = ox;
  let ky = oy;
  if (j) {
    const dx = j.x - j.ox;
    const dy = j.y - j.oy;
    const d = Math.hypot(dx, dy);
    const m = Math.min(d, 13) / (d || 1);
    kx = ox + dx * m;
    ky = oy + dy * m;
  }
  ctx.beginPath();
  ctx.arc(kx, ky, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.restore();
}
