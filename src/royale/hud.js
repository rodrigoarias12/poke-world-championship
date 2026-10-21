// HUD de la batalla campal: tu vida (arriba a la izquierda), cuántos quedan y
// el reloj de la niebla (arriba al centro), el minimapa y quién sacó a quién
// (arriba a la derecha), flechas hacia los rivales y hacia el círculo.
import { VW, VH } from '../config.js';
import { TYPES } from '../data.js';
import { text, roundRect, drawCreature } from '../ui.js';
import { hpBar, renderHotbar } from '../hud.js';
import { ZONE_PHASES } from './zone.js';

const MM = { w: 60, h: 42 };

function portrait(ctx, f, x, y) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#1b1224';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 11, 0, Math.PI * 2);
  ctx.fillStyle = f.color || TYPES[f.type].color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 9.6, 0, Math.PI * 2);
  ctx.fillStyle = '#f4f1ea';
  ctx.fill();
  ctx.clip();
  drawCreature(ctx, f.key, x, y + 2, 20, { t: f.animT, black: !f.alive });
  ctx.restore();
}

function topLeft(ctx, b, t) {
  const f = b.player.alive ? b.player : b.viewed;
  portrait(ctx, f, 15, 15);
  const plate = ctx.createLinearGradient(26, 0, 112, 0);
  plate.addColorStop(0, 'rgba(14,10,26,0.72)');
  plate.addColorStop(1, 'rgba(14,10,26,0.2)');
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.moveTo(24, 1.5);
  ctx.lineTo(112, 1.5);
  ctx.lineTo(107, 19.5);
  ctx.lineTo(24, 19.5);
  ctx.closePath();
  ctx.fill();
  const watching = f !== b.player;
  text(ctx, watching ? `MIRANDO A ${f.name}` : f.name, 30, 9, { size: watching ? 4.4 : 6, weight: 900, color: watching ? f.color : '#fff', stroke: '#1b1224', strokeW: 1.6 });
  if (!watching) text(ctx, `♥ ${Math.ceil(f.hp)}`, 104, 9, { size: 5.4, weight: 900, align: 'right', color: '#ff7a8a', stroke: '#1b1224', strokeW: 1.6 });
  hpBar(ctx, 30, 11.6, 74, 4.6, f, false, t);
  // Premios que tiene puestos
  let bx = 30;
  for (const [on, label, color] of [[f.buffDmg, 'FUERZA', '#ff9a5a'], [f.buffSpeed, 'RAPIDEZ', '#ffe66b']]) {
    if (on <= 0) continue;
    const w = 26;
    roundRect(ctx, bx, 21, w, 6, 2);
    ctx.fillStyle = 'rgba(14,10,24,0.8)';
    ctx.fill();
    text(ctx, `${label} ${Math.ceil(on)}`, bx + w / 2, 25.4, { size: 3.4, weight: 900, align: 'center', color });
    bx += w + 2;
  }
  if (f.kos > 0) text(ctx, `${f.kos} ✕`, 15, 34, { size: 4.6, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.2 });
}

function topCenter(ctx, b, t) {
  const n = b.alive().length;
  const label = `QUEDAN ${n}`;
  roundRect(ctx, VW / 2 - 15, 2.5, 30, 8, 3);
  ctx.fillStyle = 'rgba(14,10,24,0.85)';
  ctx.fill();
  text(ctx, label, VW / 2, 8.4, { size: 4.6, weight: 900, align: 'center', color: '#ffe66b' });
  // Pausa
  roundRect(ctx, VW / 2 - 4.5, 13, 9, 8, 2);
  ctx.fillStyle = 'rgba(14,10,24,0.75)';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(VW / 2 - 2, 15, 1.4, 4);
  ctx.fillRect(VW / 2 + 0.6, 15, 1.4, 4);
  // Niebla: cuenta regresiva y fases
  const z = b.zone;
  const x = VW / 2 + 22;
  roundRect(ctx, x, 2.5, 44, 8, 3);
  ctx.fillStyle = z.shrinking ? `rgba(120,40,170,${0.85 + Math.sin(t * 8) * 0.1})` : 'rgba(14,10,24,0.85)';
  ctx.fill();
  const secs = Math.max(0, Math.ceil(z.countdown));
  const str = z.done ? 'NIEBLA FINAL' : `${z.shrinking ? 'SE ACHICA' : 'NIEBLA'} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  text(ctx, str, x + 22, 8.2, { size: 3.8, weight: 900, align: 'center', color: '#e2a8ff' });
  for (let i = 0; i < ZONE_PHASES.length; i++) {
    ctx.fillStyle = i < z.phase ? '#c27bff' : i === z.phase ? '#ffffff' : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x + 6 + i * 8, 14, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Minimapa: el pueblo chiquito, la niebla y los que se ven
let mini = null;
function miniMap(b) {
  if (mini && mini.world === b.world) return mini.canvas;
  const frames = b.world.ensureFrames();
  const c = document.createElement('canvas');
  c.width = MM.w * 2;
  c.height = MM.h * 2;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(frames[0], 0, 0, c.width, c.height);
  mini = { world: b.world, canvas: c };
  return c;
}

function topRight(ctx, b, t) {
  const x0 = VW - MM.w - 3;
  const y0 = 3;
  const sx = MM.w / b.world.W;
  const sy = MM.h / b.world.H;
  roundRect(ctx, x0 - 1.5, y0 - 1.5, MM.w + 3, MM.h + 3, 2);
  ctx.fillStyle = '#1b1224';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MM.w, MM.h);
  ctx.clip();
  ctx.globalAlpha = 0.9;
  ctx.drawImage(miniMap(b), x0, y0, MM.w, MM.h);
  ctx.globalAlpha = 1;
  const z = b.zone;
  ctx.beginPath();
  ctx.rect(x0, y0, MM.w, MM.h);
  ctx.ellipse(x0 + z.x * sx, y0 + z.y * sy, Math.max(0.3, z.r * sx), Math.max(0.3, z.r * sy), 0, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(96,32,150,0.55)';
  ctx.fill('evenodd');
  if (!z.done && z.next.r > 0) {
    ctx.setLineDash([1.5, 1.2]);
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x0 + z.next.x * sx, y0 + z.next.y * sy, z.next.r * sx, z.next.r * sy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Lo que ve la cámara
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x0 + b.cam.x * sx, y0 + b.cam.y * sy, (VW * sx), (VH * sy));
  const me = b.player;
  for (const f of b.fighters) {
    if (!f.alive) continue;
    const mine = f === me;
    if (!mine && me.alive && !b.canSee(me, f)) continue;
    const r = mine ? 2 : 1.5;
    ctx.fillStyle = '#1b1224';
    ctx.beginPath();
    ctx.arc(x0 + f.x * sx, y0 + f.y * sy, r + 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(x0 + f.x * sx, y0 + f.y * sy, mine ? r + Math.sin(t * 6) * 0.3 : r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Quién sacó a quién (los últimos 3)
function killFeed(ctx, b) {
  let y = 54;
  for (const e of b.feed.slice(0, 3)) {
    const age = b.t - e.t;
    if (age > 7) continue;
    const alpha = age > 6 ? 7 - age : 1;
    const who = e.killer ? (e.killer === b.player ? 'TÚ' : e.killer.name) : 'LA NIEBLA';
    const victim = e.victim === b.player ? 'TÚ' : e.victim.name;
    const str = `${who} ✕ ${victim}`;
    const w = Math.min(120, str.length * 2.6 + 8);
    ctx.save();
    ctx.globalAlpha = alpha;
    roundRect(ctx, VW - 3 - w, y - 5, w, 7, 2);
    ctx.fillStyle = 'rgba(14,10,24,0.78)';
    ctx.fill();
    const vx = VW - 6;
    text(ctx, victim, vx, y, { size: 3.8, weight: 900, align: 'right', color: e.victim.color });
    const vw = victim.length * 2.4 + 2;
    text(ctx, '✕', vx - vw - 1, y, { size: 3.8, weight: 900, align: 'right', color: '#ff8a96' });
    text(ctx, who, vx - vw - 6, y, { size: 3.8, weight: 900, align: 'right', color: e.killer ? e.killer.color : '#d58cff' });
    ctx.restore();
    y += 8;
  }
}

// Flechas al borde de la pantalla hacia los rivales que se ven pero no entran
function edgeArrows(ctx, b, t) {
  const me = b.player;
  if (!me.alive || b.state !== 'fight') return;
  for (const f of b.fighters) {
    if (f === me || !f.alive || b.onCamera(f.x, f.y, -6) || !b.canSee(me, f)) continue;
    const dx = f.x - me.x;
    const dy = f.y - me.y;
    if (Math.hypot(dx, dy) > 300) continue;
    arrowAt(ctx, me.x - b.cam.x, me.y - 10 - b.cam.y, dx, dy, f.color, 0.85, b.game.input.touchMode ? VH - 8 : VH - 26);
  }
  // Afuera del círculo: flecha grande hacia lo seguro
  const z = b.zone;
  if (z.outside(me.x, me.y)) {
    const px = me.x - b.cam.x;
    const py = me.y - b.cam.y - me.tall * 0.45;
    const a = Math.atan2(z.y - me.y, z.x - me.x);
    const rr = Math.max(me.wide, me.tall) * 0.55 + 9 + Math.sin(t * 8) * 2;
    ctx.save();
    ctx.translate(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.8);
    ctx.rotate(a);
    ctx.fillStyle = '#1b1224';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-4, -6.5);
    ctx.lineTo(-4, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffb3f0';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-3, -5);
    ctx.lineTo(-3, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function arrowAt(ctx, ox, oy, dx, dy, color, alpha, bottom) {
  const a = Math.atan2(dy, dx);
  const cx = Math.cos(a);
  const cy = Math.sin(a);
  // Hasta el borde (dejando lugar arriba para el HUD)
  const m = 8;
  const tx = cx > 0 ? (VW - m - ox) / cx : cx < 0 ? (m - ox) / cx : Infinity;
  const ty = cy > 0 ? (bottom - oy) / cy : cy < 0 ? (34 - oy) / cy : Infinity;
  const k = Math.max(0, Math.min(tx, ty));
  const x = ox + cx * k;
  const y = oy + cy * k;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = '#1b1224';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-3, -4.5);
  ctx.lineTo(-3, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(4.6, 0);
  ctx.lineTo(-2, -3.3);
  ctx.lineTo(-2, 3.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderRoyaleHUD(ctx, b, t) {
  edgeArrows(ctx, b, t);
  topLeft(ctx, b, t);
  topCenter(ctx, b, t);
  topRight(ctx, b, t);
  killFeed(ctx, b);
  if (!b.game.input.touchMode && b.player.alive) renderHotbar(ctx, b, t);
}
