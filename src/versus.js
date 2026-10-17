// Pantalla "VS" antes de una pelea: dos mitades que entran en diagonal,
// los dos equipos y un VS grande en el medio.
import { VW, VH } from './config.js';
import { CREATURES } from './data.js';
import { text, drawCreature, ease, backOut } from './ui.js';

export const VS_DUR = 2.8;

// La línea diagonal que separa las dos mitades
const TOP = 178;
const BOTTOM = 142;

function half(ctx, left, off, colors) {
  ctx.save();
  ctx.translate(off, 0);
  ctx.beginPath();
  if (left) {
    ctx.moveTo(-40, 0);
    ctx.lineTo(TOP, 0);
    ctx.lineTo(BOTTOM, VH);
    ctx.lineTo(-40, VH);
  } else {
    ctx.moveTo(TOP, 0);
    ctx.lineTo(VW + 40, 0);
    ctx.lineTo(VW + 40, VH);
    ctx.lineTo(BOTTOM, VH);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

// Rayas de velocidad que cruzan cada mitad
function speedLines(ctx, t, left, off) {
  ctx.save();
  ctx.translate(off, 0);
  ctx.beginPath();
  if (left) {
    ctx.moveTo(-40, 0);
    ctx.lineTo(TOP, 0);
    ctx.lineTo(BOTTOM, VH);
    ctx.lineTo(-40, VH);
  } else {
    ctx.moveTo(TOP, 0);
    ctx.lineTo(VW + 40, 0);
    ctx.lineTo(VW + 40, VH);
    ctx.lineTo(BOTTOM, VH);
  }
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    const y = (i * 37.3) % VH;
    const len = 30 + ((i * 53) % 50);
    const speed = 260 + ((i * 71) % 180);
    const span = VW + len + 40;
    let x = ((t * speed + i * 97) % span) - len;
    if (!left) x = VW - x - len;
    ctx.fillStyle = `rgba(255,255,255,${0.08 + (i % 4) * 0.04})`;
    ctx.fillRect(x, y, len, i % 3 === 0 ? 1.2 : 0.6);
  }
  ctx.restore();
}

// El primero del equipo va adelante y más grande; los otros dos atrás
const SPOTS = [{ x: 84, y: 114, size: 54 }, { x: 34, y: 100, size: 38 }, { x: 130, y: 100, size: 38 }];

function teamRow(ctx, t, keys, left, off, delay) {
  [1, 2, 0].forEach((i) => {
    const key = keys[i];
    if (!key) return;
    const k = ease((t - delay - i * 0.09) / 0.35);
    if (k <= 0) return;
    const spot = SPOTS[i];
    const x = (left ? spot.x : VW - spot.x) + off + (left ? -1 : 1) * (1 - k) * 60;
    const y = spot.y + Math.sin(t * 4 + i) * 1.2;
    const size = spot.size;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(10,6,20,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.42, size * 0.38, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCreature(ctx, key, x, y, size, { faceLeft: !left, t: t + i });
    const name = CREATURES[key].name;
    const ns = i === 0 ? 5 : 3.8;
    text(ctx, name, x, y + size * 0.42 + ns + 3, { size: name.length > 9 ? ns * 0.85 : ns, weight: 900, align: 'center', color: '#fff', stroke: '#1b1224', strokeW: 1.4 });
    ctx.restore();
  });
}

// t = segundos desde que empezó la pantalla
export function drawVersus(ctx, t, { left, right, leftLabel = 'TÚ', rightLabel = 'RIVAL', arenaName = '', footer = '¡A PELEAR!' }) {
  ctx.fillStyle = '#120c20';
  ctx.fillRect(0, 0, VW, VH);
  const k = ease(t / 0.3);
  const offL = -220 * (1 - k);
  const offR = 220 * (1 - k);
  half(ctx, true, offL, ['#ff8a3d', '#c8283e']);
  half(ctx, false, offR, ['#3fa7ff', '#2a3fb0']);
  speedLines(ctx, t, true, offL);
  speedLines(ctx, t, false, offR);

  // Línea brillante en el corte
  if (k > 0.9) {
    ctx.save();
    ctx.strokeStyle = '#fff6c8';
    ctx.lineWidth = 2.2 + Math.sin(t * 30) * 0.6;
    ctx.shadowColor = '#ffe66b';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(TOP, 0);
    ctx.lineTo(BOTTOM, VH);
    ctx.stroke();
    ctx.restore();
  }

  // Etiquetas grandes
  const lk = backOut((t - 0.2) / 0.3);
  if (lk > 0) {
    text(ctx, leftLabel, 14 - (1 - lk) * 40, 40, { size: 20, weight: 900, color: '#fff', stroke: '#1b1224', strokeW: 3.5 });
    text(ctx, rightLabel, VW - 14 + (1 - lk) * 40, 40, { size: 20, weight: 900, align: 'right', color: '#fff', stroke: '#1b1224', strokeW: 3.5 });
  }

  teamRow(ctx, t, left, true, offL, 0.3);
  teamRow(ctx, t, right, false, offR, 0.38);

  // VS en el medio, con un temblor al caer
  const vk = (t - 0.32) / 0.35;
  if (vk > 0) {
    const s = 0.4 + 0.6 * backOut(vk);
    const shake = vk < 1.4 ? (1.4 - vk) * 2 : 0;
    ctx.save();
    ctx.translate(160 + (Math.random() - 0.5) * shake, 82 + (Math.random() - 0.5) * shake);
    ctx.scale(s, s);
    ctx.rotate(-0.12);
    text(ctx, 'VS', 2, 14, { size: 38, weight: 900, align: 'center', color: '#1b1224' });
    text(ctx, 'VS', 0, 12, { size: 38, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 4 });
    ctx.restore();
  }

  // Abajo: la arena y el grito final
  if (t > 0.6) {
    const a = Math.min(1, (t - 0.6) / 0.3);
    ctx.fillStyle = `rgba(10,6,20,${0.75 * a})`;
    ctx.fillRect(0, VH - 22, VW, 22);
    if (arenaName) text(ctx, `ARENA: ${arenaName}`, VW / 2, VH - 13, { size: 5, weight: 900, align: 'center', color: '#b9c6e4', alpha: a });
  }
  if (t > VS_DUR - 0.9 && footer) {
    const fk = backOut((t - (VS_DUR - 0.9)) / 0.3);
    text(ctx, footer, VW / 2, VH - 4, { size: 7 * fk, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.8 });
  }

  // Destello blanco al chocar las dos mitades
  const flash = t > 0.28 ? Math.max(0, 1 - (t - 0.28) / 0.25) : 0;
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.85})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  // Fundido final a blanco para pasar a la pelea
  const out = Math.max(0, (t - (VS_DUR - 0.2)) / 0.2);
  if (out > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, out)})`;
    ctx.fillRect(0, 0, VW, VH);
  }
}
