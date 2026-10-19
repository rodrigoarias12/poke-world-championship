import { TYPE_COLORS } from './effects.js';
import { fxRandom } from './rng.js';
import { FIELD, VW } from './config.js';
import { boulderSprite } from './art.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function wrapAngle(a) {
  if (!Number.isFinite(a)) return 0;
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function rotate([x, y], a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

function aimDir(f) {
  const { aimX, aimY } = f.intent;
  const len = Math.hypot(aimX, aimY) || 1;
  return [aimX / len, aimY / len];
}

function pal(m) {
  return TYPE_COLORS[m.fx] || TYPE_COLORS.normal;
}

// Alcance aproximado de cada ataque (lo usa la IA)
export function moveRange(f, m) {
  const reach = f.r + 12;
  switch (m.kind) {
    case 'shot': return m.homing ? 240 : 210;
    case 'melee': return reach + m.range;
    case 'dash': return m.speed * m.time * (m.hits || 1) * 0.7 + 30;
    case 'stream': return m.len + 6;
    case 'beam': return 260;
    case 'ring': return m.maxR * 0.75;
    case 'quake': return m.maxR * 0.8;
    default: return 400;
  }
}

// ------------------------------------------------------------ Proyectiles

export function spawnProjectile(b, f, m, dx, dy) {
  const s = f.boss ? 1.3 : 1;
  b.projectiles.push({
    owner: f,
    move: m,
    proj: m.proj,
    fx: m.fx,
    type: m.type,
    x: f.x + dx * (f.r + 3),
    y: f.y + dy * (f.r + 3),
    h: f.mouthH(),
    vx: dx * m.speed,
    vy: dy * m.speed,
    r: m.r * s,
    dmg: m.dmg,
    weight: m.weight || 1,
    kb: m.kb ?? 70,
    life: m.life || 2.2,
    bounces: m.bounces || 0,
    homing: m.homing || 0,
    explode: (m.explode || 0) * s,
    stun: m.stun || 0,
    age: 0,
    spin: 0,
    dead: false,
    passed: false,
  });
}

const SOUND = { spark: 'zap', fireball: 'fire', bigfire: 'fire', water: 'water', bubble: 'water', needle: 'needle', seed: 'needle', orb: 'orb', star: 'needle', note: 'orb', psy: 'orb', shuriken: 'needle', moon: 'orb', boulder: 'rock' };

// ------------------------------------------------------------- Iniciar

export function startMove(f, b, m) {
  const [dx, dy] = aimDir(f);
  const opp = f.opponent;
  const colors = pal(m);
  f.squash = 0.5;
  switch (m.kind) {
    case 'shot': {
      const n = m.count || 1;
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? 0 : -m.spread + (2 * m.spread * i) / (n - 1);
        const [ax, ay] = rotate([dx, dy], a);
        spawnProjectile(b, f, m, ax, ay);
      }
      const mx = f.x + dx * (f.r + 3);
      const my = f.y + dy * (f.r + 3) - f.mouthH();
      b.effects.burst(mx, my, colors, { count: 7, speed: 55, size: 1.5, life: 0.25, angle: Math.atan2(dy, dx), spread: 1.4 });
      b.effects.ring(mx, my + f.mouthH(), colors[1], { r: 1, maxR: 7, life: 0.2, width: 1 });
      b.audio.play(SOUND[m.proj] || 'swing');
      f.kx -= dx * 25;
      f.ky -= dy * 25;
      break;
    }
    case 'melee':
      f.action = { kind: 'melee', m, t: 0, dir: [dx, dy], hit: false };
      b.audio.play('swing');
      break;
    case 'dash':
      f.action = { kind: 'dash', m, t: 0, n: 0, phase: 'aim', pt: 0.08, dir: [dx, dy], hit: false, spin: 0 };
      break;
    case 'stream':
      f.action = { kind: 'stream', m, t: 0, angle: Math.atan2(dy, dx), tick: 0, len: m.len, lockFacing: true, charge: 0 };
      b.audio.sustain(m.fx, m.dur);
      break;
    case 'beam':
      f.action = { kind: 'beam', m, t: 0, angle: Math.atan2(dy, dx), tick: 0, len: 0, lockFacing: true, charge: m.charge || 0 };
      if (m.charge) b.audio.play('charge');
      else {
        b.audio.play(m.freeze ? 'ice' : 'super');
        b.audio.sustain(m.fx, m.dur);
      }
      break;
    case 'ring':
      f.action = { kind: 'ring', m, t: 0, spawned: 0 };
      if (!m.sleep) f.iframes = 0.5;
      break;
    case 'quake':
      f.action = { kind: 'quake', m, t: 0, fired: false };
      break;
    case 'zone':
      f.action = { kind: 'cast', m, t: 0, dur: 0.3 };
      b.hazards.push({ kind: 'zone', m, owner: f, x: opp.x, y: opp.y, r: m.r * (f.boss ? 1.25 : 1), t: 0, burst: false, tick: 0 });
      b.audio.play('orb');
      break;
    case 'thunder':
      f.action = { kind: 'cast', m, t: 0, dur: 0.35 };
      for (let i = 0; i < m.strikes; i++) {
        f.pending.push({
          t: i * m.interval,
          fn: () => {
            const o = f.opponent;
            b.hazards.push({ kind: 'strike', m, owner: f, x: o.x + o.vx * 0.2, y: o.y + o.vy * 0.2, r: m.r, t: 0, hit: false });
          },
        });
      }
      b.audio.play('zap');
      break;
    case 'wave':
      f.action = { kind: 'cast', m, t: 0, dur: 0.4 };
      b.hazards.push({ kind: 'wave', m, owner: f, x: f.x - dx * 10, y: f.y - dy * 10, dx, dy, t: 0, hit: false });
      b.audio.play('surf');
      b.shake(3);
      break;
    case 'fly':
      f.action = { kind: 'fly', m, t: 0, phase: 'up' };
      f.iframes = 0.3;
      b.audio.play('dash');
      if (m.dig) b.effects.dust(f.x, f.y, 14);
      else b.effects.burst(f.x, f.y, colors, { count: 14, speed: 60, size: 1.6, life: 0.5 });
      break;
    case 'teleport':
      f.action = { kind: 'teleport', m, t: 0, phase: m.vanish ? 'vanish' : 'rush', st: 0, slashes: 0 };
      if (m.vanish) {
        f.invisible = 0.4;
        f.iframes = 0.45;
        b.effects.burst(f.x, f.y - f.tall / 2, colors, { count: 22, speed: 50, size: 2, life: 0.6 });
      }
      break;
    case 'blink': {
      let mx = f.intent.mx;
      let my = f.intent.my;
      if (Math.hypot(mx, my) < 0.2) {
        mx = f.x - opp.x;
        my = f.y - opp.y;
      }
      const len = Math.hypot(mx, my) || 1;
      b.effects.burst(f.x, f.y - f.tall / 2, TYPE_COLORS.psiquico, { count: 16, speed: 50, size: 1.8, life: 0.4 });
      f.x = clamp(f.x + (mx / len) * m.dist, FIELD.x0 + f.r, FIELD.x1 - f.r);
      f.y = clamp(f.y + (my / len) * m.dist, FIELD.y0, FIELD.y1);
      f.iframes = 0.2;
      b.effects.burst(f.x, f.y - f.tall / 2, TYPE_COLORS.psiquico, { count: 16, speed: 50, size: 1.8, life: 0.4 });
      b.audio.play('orb');
      break;
    }
    case 'rest':
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * m.heal);
      f.sleep = m.sleep;
      f.stun = m.sleep;
      b.effects.float(`+${Math.round(f.maxHp * m.heal)}`, f.x, f.y - f.tall - 4, { color: '#7dff8a', size: 7 });
      b.effects.burst(f.x, f.y - f.tall / 2, ['#7dff8a', '#c8ffd0', '#ffffff'], { count: 16, speed: 40, size: 1.6, life: 0.7, up: 20 });
      b.audio.play('ready');
      break;
  }
}

function damp(f, k) {
  f.vx *= k;
  f.vy *= k;
}

function turnToward(a, target, rate, dt) {
  return a + clamp(wrapAngle(target - a), -rate * dt, rate * dt);
}

function rayLength(x, ang, max) {
  const cx = Math.cos(ang);
  let d = max;
  if (cx > 0.01) d = Math.min(d, (VW + 10 - x) / cx);
  if (cx < -0.01) d = Math.min(d, (-10 - x) / cx);
  return Math.max(0, d);
}

function recharge(f, b, m) {
  if (!m.recharge) return;
  f.stun = m.recharge;
  b.effects.float('recargando…', f.x, f.y - f.tall - 4, { color: '#c9c3d6', size: 4.5 });
}

// ------------------------------------------------------- Ataques en curso

export function updateAction(f, b, dt) {
  const a = f.action;
  const m = a.m;
  const opp = f.opponent;
  const colors = m ? pal(m) : TYPE_COLORS.normal;
  a.t += dt;
  switch (a.kind) {
    case 'cast':
      damp(f, 0.8);
      if (a.t >= a.dur) f.action = null;
      break;

    case 'melee': {
      const go = a.t < 0.1;
      f.vx = go ? a.dir[0] * 120 : f.vx * 0.7;
      f.vy = go ? a.dir[1] * 120 : f.vy * 0.7;
      if (!a.hit && a.t >= 0.06) {
        a.hit = true;
        const hx = f.x + a.dir[0] * (f.r + m.range * 0.5);
        const hy = f.y + a.dir[1] * (f.r + m.range * 0.5);
        if (m.bite) biteFx(b, hx, hy - f.tall * 0.4, colors);
        else slashFx(b, hx, hy - f.tall * 0.4, colors, a.dir);
        const d = Math.hypot(opp.x - f.x, opp.y - f.y);
        if (opp.alive && d < f.r + opp.r + m.range) {
          b.damage(f, opp, m.dmg, { m, kb: m.kb, dirX: a.dir[0], dirY: a.dir[1], stun: m.stun });
        }
      }
      if (a.t >= 0.22) f.action = null;
      break;
    }

    case 'dash': {
      a.spin += dt * 26 * f.facing;
      if (a.phase === 'aim') {
        damp(f, 0.6);
        a.pt -= dt;
        if (a.pt <= 0) {
          if (a.n > 0 || f.isAI) {
            const dx = opp.x - f.x;
            const dy = opp.y - f.y;
            const d = Math.hypot(dx, dy) || 1;
            a.dir = [dx / d, dy / d];
          } else {
            a.dir = aimDir(f);
          }
          a.phase = 'go';
          a.pt = m.time;
          a.hit = false;
          b.audio.play(m.fx === 'electrico' ? 'zap' : 'dash');
        }
      } else {
        f.vx = a.dir[0] * m.speed;
        f.vy = a.dir[1] * m.speed;
        const nx = f.x + f.vx * dt;
        const ny = f.y + f.vy * dt;
        if (nx < FIELD.x0 + f.r || nx > FIELD.x1 - f.r) a.dir[0] *= -1;
        if (ny < FIELD.y0 || ny > FIELD.y1) a.dir[1] *= -1;
        a.pt -= dt;
        b.effects.trail(f.x, f.y - f.tall * 0.4, colors, { size: 2, jitter: f.r * 0.6, vy: 0 });
        if (!a.hit && opp.alive && opp.lift < 20 && Math.hypot(opp.x - f.x, opp.y - f.y) < f.r + opp.r + 2) {
          a.hit = true;
          if (b.damage(f, opp, m.dmg, { m, kb: m.kb, dirX: a.dir[0], dirY: a.dir[1], stun: m.stun })) {
            b.effects.ring(opp.x, opp.y - opp.tall / 2, colors[1], { maxR: 16, life: 0.25, width: 1.6 });
          }
          if ((m.hits || 1) === 1) a.pt = Math.min(a.pt, 0.04);
        }
        if (a.pt <= 0) {
          a.n++;
          if (a.n >= (m.hits || 1)) {
            f.action = null;
            recharge(f, b, m);
          } else {
            a.phase = 'aim';
            a.pt = 0.1;
          }
        }
      }
      break;
    }

    case 'stream':
    case 'beam': {
      const isBeam = a.kind === 'beam';
      if (a.charge > 0) {
        // Cargando: brilla y no se mueve
        a.charge -= dt;
        damp(f, 0.5);
        a.angle = turnToward(a.angle, Math.atan2(opp.y - f.y, opp.x - f.x), 4, dt);
        f.facing = Math.cos(a.angle) >= 0 ? 1 : -1;
        const mx = f.x + Math.cos(a.angle) * f.r;
        const my = f.y - f.mouthH() + Math.sin(a.angle) * f.r;
        const ang = fxRandom() * Math.PI * 2;
        b.effects.add({ x: mx + Math.cos(ang) * 14, y: my + Math.sin(ang) * 10, vx: -Math.cos(ang) * 50, vy: -Math.sin(ang) * 40, life: 0.25, max: 0.25, size: 1.8, color: colors[1], grav: 0, drag: 0 });
        if (a.charge <= 0) {
          a.t = 0;
          b.audio.play('super');
          b.audio.sustain(m.fx, m.dur);
          b.shake(3);
          b.flashScreen(colors[1], 0.3);
        }
        break;
      }
      const target = Math.atan2(opp.y - f.y, opp.x - f.x);
      a.angle = turnToward(a.angle, target, isBeam ? m.track : 3, dt);
      const sp = f.speed * (isBeam ? 0.2 : 0.4);
      f.vx += (f.intent.mx * sp - f.vx) * 0.2;
      f.vy += (f.intent.my * sp - f.vy) * 0.2;
      f.facing = Math.cos(a.angle) >= 0 ? 1 : -1;
      const cx = Math.cos(a.angle);
      const cy = Math.sin(a.angle);
      const sx = f.x + cx * f.r;
      const sy = f.y + cy * f.r * 0.6;
      a.len = isBeam ? rayLength(sx, a.angle, 400) : m.len;
      const ex = sx + cx * a.len;
      const ey = sy + cy * a.len;
      a.tick -= dt;
      if (a.tick <= 0) {
        a.tick = 0.1;
        const w = (m.width * (f.boss ? 1.3 : 1)) / 2;
        if (opp.alive && opp.lift < 20 && distToSegment(opp.x, opp.y, sx, sy, ex, ey) < w + opp.r) {
          b.damage(f, opp, m.tick, { m, kb: isBeam ? 40 : 20, dirX: cx, dirY: cy, noCrit: true, hitstop: 0, tick: true, slow: m.slow });
        }
        if (m.freeze) {
          for (let d = 10; d < a.len; d += 18) {
            const px = sx + cx * d + (fxRandom() - 0.5) * 6;
            const py = sy + cy * d + (fxRandom() - 0.5) * 4;
            if (!b.arena.onPlatform(px, py) && fxRandom() < 0.35) b.arena.freeze(px, py);
          }
        }
      }
      // Rompe proyectiles livianos
      for (const p of b.projectiles) {
        if (p.owner !== f && !p.dead && p.weight <= 2 && distToSegment(p.x, p.y, sx, sy, ex, ey) < m.width / 2 + p.r) killProjectile(b, p);
      }
      const hy = f.mouthH();
      if (isBeam) {
        for (let i = 0; i < 2; i++) b.effects.trail(ex, ey - hy, colors, { size: 2.2, jitter: 4, vy: -24 });
      } else {
        for (let i = 0; i < 3; i++) {
          const d = fxRandom() * a.len;
          const spread = (d / a.len) * m.width * 0.8;
          b.effects.add({
            x: sx + cx * d + (fxRandom() - 0.5) * spread,
            y: sy + cy * d - hy + (fxRandom() - 0.5) * spread,
            vx: cx * 90, vy: cy * 90 - 10, life: 0.25, max: 0.25, size: 2 + fxRandom() * 2,
            color: colors[Math.floor(fxRandom() * 4)], grav: 0, drag: 3,
          });
        }
      }
      if (a.t >= m.dur) {
        f.action = null;
        recharge(f, b, m);
      }
      break;
    }

    case 'ring': {
      damp(f, 0.8);
      const n = m.count || 3;
      while (a.spawned < n && a.t >= a.spawned * 0.22) {
        b.hazards.push({
          kind: 'ring', m, owner: f, x: f.x, y: f.y, r: 4, speed: m.speed || 120, maxR: m.maxR * (f.boss ? 1.25 : 1),
          width: 7, dmg: m.dmg, kb: m.kb ?? (m.sleep ? 20 : 120), stun: m.stun || 0, sleep: !!m.sleep, hit: false, colors, notes: !!m.notes,
        });
        a.spawned++;
        b.audio.play(m.sleep ? 'ready' : 'explode');
        if (!m.sleep) b.shake(2.5);
        b.effects.burst(f.x, f.y - f.tall / 2, colors, { count: 16, speed: 90, size: 2, life: 0.5 });
      }
      if (a.t > n * 0.22 + 0.15) f.action = null;
      break;
    }

    case 'quake': {
      damp(f, 0.7);
      f.squash = a.t < 0.25 ? a.t / 0.25 : 0;
      f.lift = a.t < 0.25 ? Math.sin((a.t / 0.25) * Math.PI) * 10 : 0;
      if (!a.fired && a.t >= 0.25) {
        a.fired = true;
        f.lift = 0;
        b.hazards.push({ kind: 'quake', m, owner: f, x: f.x, y: f.y, r: 4, speed: 150, maxR: m.maxR * (f.boss ? 1.25 : 1), width: 8, dmg: m.dmg, kb: 90, stun: m.stun, hit: false, colors });
        b.shake(m.maxR > 80 ? 7 : 4);
        b.audio.play('quake');
        b.splash(f.x, f.y, 16);
        b.mark(f.x, f.y, 'roca', m.maxR > 80 ? 22 : 14);
        b.crowdExcite(0.8);
      }
      if (a.t >= 0.55) f.action = null;
      break;
    }

    case 'fly': {
      const up = 0.25;
      if (a.phase === 'up') {
        f.lift = (a.t / up) * 160;
        f.iframes = Math.max(f.iframes, 0.2);
        damp(f, 0.8);
        if (a.t >= up) {
          a.phase = 'air';
          a.t = 0;
        }
      } else if (a.phase === 'air') {
        f.lift = 160;
        f.iframes = Math.max(f.iframes, 0.2);
        // Se dirige hacia el rival (o donde lo mande el jugador)
        let mx = f.intent.mx;
        let my = f.intent.my;
        if (f.isAI || Math.hypot(mx, my) < 0.2) {
          const dx = opp.x - f.x;
          const dy = opp.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          mx = d > 4 ? dx / d : 0;
          my = d > 4 ? dy / d : 0;
        }
        f.vx = mx * f.speed * 1.4;
        f.vy = my * f.speed * 1.4;
        if (m.dig && fxRandom() < 0.6) b.effects.dust(f.x, f.y, 1);
        if (a.t >= m.up) {
          a.phase = 'down';
          a.t = 0;
        }
      } else {
        const down = 0.18;
        f.lift = Math.max(0, 160 * (1 - a.t / down));
        damp(f, 0.5);
        if (a.t >= down) {
          f.lift = 0;
          f.action = null;
          f.iframes = 0;
          b.shake(5);
          b.splash(f.x, f.y, 14);
          b.effects.ring(f.x, f.y, colors[1], { maxR: m.r, life: 0.3, width: 2 });
          b.audio.play('bighit');
          const d = Math.hypot(opp.x - f.x, opp.y - f.y) || 1;
          if (opp.alive && d < m.r + opp.r) {
            b.damage(f, opp, m.dmg, { m, kb: 200, dirX: (opp.x - f.x) / d, dirY: (opp.y - f.y) / d, stun: 0.3 });
          }
        }
      }
      break;
    }

    case 'teleport': {
      if (a.phase === 'vanish' || a.phase === 'rush') {
        damp(f, 0.5);
        if (a.phase === 'vanish') b.darken = Math.max(b.darken, 0.45);
        else b.effects.trail(f.x, f.y - f.tall / 2, colors, { size: 2, jitter: 4 });
        const wait = a.phase === 'vanish' ? 0.38 : 0.12;
        if (a.t >= wait) {
          let tx = opp.x - opp.facing * (14 + opp.r + f.r);
          if (tx < FIELD.x0 + f.r || tx > FIELD.x1 - f.r) tx = opp.x + opp.facing * (14 + opp.r + f.r);
          b.effects.burst(f.x, f.y - f.tall / 2, colors, { count: 14, speed: 50, size: 1.8, life: 0.4 });
          f.x = clamp(tx, FIELD.x0 + f.r, FIELD.x1 - f.r);
          f.y = clamp(opp.y, FIELD.y0, FIELD.y1);
          f.invisible = 0;
          f.iframes = 0.2;
          a.phase = 'strike';
          b.effects.burst(f.x, f.y - f.tall / 2, colors, { count: 20, speed: 60, size: 2, life: 0.5 });
          b.audio.play('orb');
        }
      } else {
        damp(f, 0.6);
        a.st += dt;
        const n = m.slashes;
        const gap = 0.45 / n;
        while (a.slashes < n && a.st >= 0.08 + a.slashes * gap) {
          const last = a.slashes === n - 1;
          const dx = opp.x - f.x;
          const dy = opp.y - f.y;
          const d = Math.hypot(dx, dy) || 1;
          b.audio.play('swing');
          slashFx(b, f.x + (dx / d) * 10, f.y - f.tall * 0.4 + (dy / d) * 4, colors, [dx / d, dy / d], a.slashes);
          if (opp.alive && d < f.r + opp.r + 16) {
            b.damage(f, opp, last ? m.last : m.dmg, { m, kb: last ? 170 : 30, dirX: dx / d, dirY: dy / d, stun: last ? 0.25 : 0 });
          }
          a.slashes++;
        }
        if (a.st >= 0.6) f.action = null;
      }
      break;
    }

    default:
      f.action = null;
  }
}

function slashFx(b, x, y, colors, dir, i = 0) {
  const base = Math.atan2(dir[1], dir[0]);
  const flip = i % 2 ? -1 : 1;
  for (let k = 0; k < 12; k++) {
    const t = k / 11;
    const ang = base + flip * (-1.1 + t * 2.2);
    b.effects.add({
      x: x + Math.cos(ang) * 10,
      y: y + Math.sin(ang) * 7,
      vx: Math.cos(ang) * 20, vy: Math.sin(ang) * 20, life: 0.22, max: 0.22, size: 2.4,
      color: k % 3 === 0 ? '#ffffff' : colors[1], grav: 0, drag: 2,
    });
  }
}

// Mordida: dos filas de colmillos que se cierran
function biteFx(b, x, y, colors) {
  for (const top of [true, false]) {
    b.effects.add({ x, y: y + (top ? -7 : 7), vx: 0, vy: top ? 45 : -45, life: 0.16, max: 0.16, size: 9, color: '#ffffff', grav: 0, drag: 0, shape: 'jaw', top });
  }
  b.effects.burst(x, y, colors, { count: 8, speed: 50, size: 1.6, life: 0.3 });
}

// ---------------------------------------------------------- Proyectiles

export function killProjectile(b, p) {
  if (p.dead) return;
  p.dead = true;
  const colors = TYPE_COLORS[p.fx] || TYPE_COLORS.normal;
  b.effects.burst(p.x, p.y - p.h, colors, { count: 8, speed: 45, size: 1.5, life: 0.35 });
  if (p.explode) explodeProjectile(b, p);
}

function explodeProjectile(b, p) {
  const opp = p.owner.opponent;
  const colors = TYPE_COLORS[p.fx] || TYPE_COLORS.fuego;
  const big = p.explode > 20;
  b.effects.burst(p.x, p.y - p.h, colors, { count: big ? 40 : 20, speed: big ? 130 : 80, size: big ? 3 : 2.2, life: 0.6 });
  b.effects.ring(p.x, p.y, colors[1], { maxR: p.explode, life: 0.35, width: big ? 3 : 2 });
  b.splash(p.x, p.y, p.explode * 0.5);
  b.mark(p.x, p.y, p.fx, p.explode * 0.6);
  b.audio.play('explode');
  b.shake(big ? 6 : 2);
  if (!p.directHit && opp.alive && opp.lift < 20 && Math.hypot(opp.x - p.x, opp.y - p.y) < p.explode + opp.r * 0.5) {
    const d = Math.hypot(opp.x - p.x, opp.y - p.y) || 1;
    b.damage(p.owner, opp, Math.round(p.dmg * 0.5), { m: p.move, kb: 80, dirX: (opp.x - p.x) / d, dirY: (opp.y - p.y) / d, noCrit: true });
  }
}

export function updateProjectiles(b, dt) {
  for (const p of b.projectiles) {
    if (p.dead) continue;
    p.age += dt;
    p.life -= dt;
    p.spin += dt * 10;
    const opp = p.owner.opponent;
    if (p.homing && opp.alive && opp.lift < 20) {
      const cur = Math.atan2(p.vy, p.vx);
      const want = Math.atan2(opp.y - p.y, opp.x - p.x);
      const na = turnToward(cur, want, p.homing, dt);
      const sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(na) * sp;
      p.vy = Math.sin(na) * sp;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    trailFx(b, p);
    if (p.life <= 0) {
      killProjectile(b, p);
      continue;
    }
    // Bordes: rebota (burbuja) o desaparece
    if (p.bounces > 0 && (p.x < FIELD.x0 || p.x > FIELD.x1 || p.y < FIELD.y0 - 6 || p.y > FIELD.y1)) {
      if (p.x < FIELD.x0 || p.x > FIELD.x1) p.vx *= -1;
      if (p.y < FIELD.y0 - 6 || p.y > FIELD.y1) p.vy *= -1;
      p.x = clamp(p.x, FIELD.x0, FIELD.x1);
      p.y = clamp(p.y, FIELD.y0 - 6, FIELD.y1);
      p.bounces--;
    } else if (p.x < -10 || p.x > VW + 10 || p.y < FIELD.y0 - 24 || p.y > FIELD.y1 + 8) {
      p.dead = true;
      continue;
    }
    // Rival
    if (opp.alive && !p.passed && opp.lift < 20 && Math.hypot(opp.x - p.x, opp.y - p.y) < p.r + opp.r) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const hit = b.damage(p.owner, opp, p.dmg, { m: p.move, kb: p.kb, dirX: p.vx / sp, dirY: p.vy / sp, stun: p.stun });
      if (hit) {
        p.directHit = true;
        killProjectile(b, p);
        b.effects.ring(opp.x, opp.y - opp.tall / 2, '#ffffff', { maxR: 10, life: 0.2 });
      } else {
        p.passed = true;
      }
    }
  }
  // Choques entre proyectiles
  const ps = b.projectiles;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i];
    if (a.dead) continue;
    for (let j = i + 1; j < ps.length; j++) {
      const c = ps[j];
      if (c.dead || c.owner === a.owner) continue;
      if (Math.hypot(a.x - c.x, a.y - c.y) < a.r + c.r) {
        const mx = (a.x + c.x) / 2;
        const my = (a.y + c.y) / 2 - 6;
        if (a.weight > c.weight) killProjectile(b, c);
        else if (c.weight > a.weight) killProjectile(b, a);
        else {
          killProjectile(b, a);
          killProjectile(b, c);
        }
        b.effects.ring(mx, my, '#ffffff', { maxR: 12, life: 0.25, width: 1.5 });
        b.effects.float('¡CHOQUE!', mx, my - 4, { color: '#fff4c0', size: 5 });
        b.audio.play('clash');
        if (a.dead) break;
      }
    }
  }
  b.projectiles = b.projectiles.filter((p) => !p.dead);
}

function trailFx(b, p) {
  const y = p.y - p.h;
  const e = b.effects;
  const colors = TYPE_COLORS[p.fx] || TYPE_COLORS.normal;
  switch (p.proj) {
    case 'fireball':
    case 'bigfire':
      for (let i = 0; i < (p.proj === 'bigfire' ? 3 : 1); i++) e.trail(p.x, y, TYPE_COLORS.fuego, { size: p.r * 0.7, jitter: p.r * 0.4, vy: -10 });
      break;
    case 'water':
      e.trail(p.x, y, TYPE_COLORS.agua, { size: 1.6, jitter: 1, vy: 6, life: 0.25 });
      break;
    case 'bubble':
      if (fxRandom() < 0.3) e.trail(p.x, y, ['#e6faff', '#8fd3ff'], { size: 1, jitter: 3, vy: -6 });
      break;
    case 'spark':
      e.trail(p.x, y, ['#ffffff', '#7df9ff', '#fff6a0'], { size: 1.2, jitter: 1.5, vy: 0, life: 0.15 });
      break;
    case 'star':
      if (fxRandom() < 0.6) e.trail(p.x, y, TYPE_COLORS.estrella, { size: 1.2, jitter: 1, vy: 0, life: 0.25 });
      break;
    case 'shuriken':
      e.trail(p.x, y, TYPE_COLORS.agua, { size: 1.6, jitter: p.r * 0.6, vy: 4, life: 0.3 });
      break;
    case 'moon':
      e.trail(p.x, y, TYPE_COLORS.lunar, { size: 2, jitter: p.r * 0.5, vy: -4, life: 0.45 });
      if (fxRandom() < 0.4) e.add({ x: p.x + (fxRandom() - 0.5) * p.r * 2, y: y + (fxRandom() - 0.5) * p.r * 2, vx: 0, vy: -8, life: 0.5, max: 0.5, size: 3, color: '#ffffff', grav: 0, drag: 1, shape: 'sparkle', rot: 0, spin: 4 });
      break;
    case 'boulder':
      if (fxRandom() < 0.4) e.dust(p.x, p.y, 1);
      break;
    default:
      if (fxRandom() < 0.5) e.trail(p.x, y, colors, { size: 1.4, jitter: 2, vy: -4, life: 0.35 });
  }
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fill();
}

function starPath(ctx, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r : R;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function zigzag(ctx, t, len = 7) {
  const j = Math.sin(t * 60) * 0.8;
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(-len * 0.6, -1.5 + j);
  ctx.lineTo(-len * 0.25, 1.2 - j);
  ctx.lineTo(len * 0.1, -1.2 + j);
  ctx.lineTo(len * 0.45, 0);
  ctx.stroke();
}

// Halo de luz suave (se suma a lo que hay atrás, como una luz de verdad)
const glowCache = new Map();
function glowSprite(color) {
  let c = glowCache.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, color);
    gr.addColorStop(0.35, color + '88');
    gr.addColorStop(1, color + '00');
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    glowCache.set(color, c);
  }
  return c;
}

export function glow(ctx, x, y, r, color, alpha = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function renderProjectiles(ctx, b, t) {
  for (const p of b.projectiles) {
    ctx.fillStyle = 'rgba(5,20,50,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1, p.r, p.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const x = p.x;
    const y = p.y - p.h;
    const ang = Math.atan2(p.vy, p.vx);
    const colors = TYPE_COLORS[p.fx] || TYPE_COLORS.normal;
    glow(ctx, x, y, p.r * 4.5, colors[2], 0.55);
    switch (p.proj) {
      case 'fireball':
      case 'bigfire': {
        const pul = 1 + Math.sin(t * 30) * 0.12;
        if (p.proj === 'bigfire') {
          // Llamarada: estrella de fuego girando
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.spin * 0.5);
          starPath(ctx, p.r * 1.9, p.r * 0.8);
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#ff5a1a';
          ctx.fill();
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = 0.35;
        circle(ctx, x, y, p.r * 1.6 * pul, '#ff7a1a');
        ctx.restore();
        circle(ctx, x, y, p.r * pul, '#ff9520');
        circle(ctx, x + Math.cos(ang) * 0.8, y + Math.sin(ang) * 0.8, p.r * 0.65, '#ffe45c');
        circle(ctx, x + Math.cos(ang) * 1.2, y + Math.sin(ang) * 1.2, p.r * 0.3, '#ffffff');
        break;
      }
      case 'water': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = '#1d4f9a';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 2 + 0.6, p.r + 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4aa8e8';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * 2, p.r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e6faff';
        ctx.fillRect(0, -p.r * 0.4, p.r, p.r * 0.5);
        ctx.restore();
        break;
      }
      case 'bubble': {
        const w = 1 + Math.sin(t * 12 + p.age * 5) * 0.08;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(w, 2 - w);
        ctx.globalAlpha = 0.4;
        circle(ctx, 0, 0, p.r, '#78c8ff');
        ctx.globalAlpha = 1;
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = '#bfe9ff';
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-p.r * 0.55, -p.r * 0.6, 1.6, 1.6);
        ctx.restore();
        break;
      }
      case 'spark': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 2.4;
        zigzag(ctx, t, 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        zigzag(ctx, t, 8);
        ctx.restore();
        break;
      }
      case 'needle': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang + (p.fx === 'planta' ? Math.sin(t * 25) * 0.4 : 0));
        ctx.fillStyle = '#1b1224';
        ctx.beginPath();
        ctx.moveTo(-5.5, 0);
        ctx.lineTo(0, -2.5);
        ctx.lineTo(5.5, 0);
        ctx.lineTo(0, 2.5);
        ctx.fill();
        ctx.fillStyle = colors[3];
        ctx.beginPath();
        ctx.moveTo(-4.4, 0);
        ctx.lineTo(0, -1.6);
        ctx.lineTo(4.4, 0);
        ctx.lineTo(0, 1.6);
        ctx.fill();
        ctx.fillStyle = colors[1];
        ctx.fillRect(-3, -0.3, 6, 0.6);
        ctx.restore();
        break;
      }
      case 'seed':
        circle(ctx, x, y, p.r + 0.7, '#1b1224');
        circle(ctx, x, y, p.r, '#8a5a2a');
        circle(ctx, x - 0.8, y - 0.8, p.r * 0.4, '#c8e84a');
        break;
      case 'star': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.spin);
        starPath(ctx, p.r + 1, (p.r + 1) * 0.45);
        ctx.fillStyle = '#1b1224';
        ctx.fill();
        starPath(ctx, p.r, p.r * 0.45);
        ctx.fillStyle = '#ffe45c';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-0.6, -0.6, 1.2, 1.2);
        ctx.restore();
        break;
      }
      case 'note':
        ctx.save();
        ctx.globalAlpha = 0.35;
        circle(ctx, x, y, p.r + 1.5, '#f08fd0');
        ctx.restore();
        ctx.font = `900 ${p.r * 2.6}px Rubik, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1b1224';
        ctx.strokeText('♪', x, y + p.r);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('♪', x, y + p.r);
        break;
      case 'psy': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = colors[3];
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 1 - i * 0.3;
          ctx.beginPath();
          ctx.arc(-i * 3, 0, p.r + i * 0.8, -1, 1);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'shuriken': {
        // Shuriken de agua girando
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 18);
        const R = p.r * 1.5;
        for (const [rr, c] of [[R + 0.8, '#1d4f9a'], [R, '#4aa8e8'], [R * 0.55, '#e6faff']]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            const r = i % 2 ? rr * 0.32 : rr;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'moon': {
        // Fuerza Lunar: luna rosada con brillo
        const pul = 1 + Math.sin(t * 10) * 0.08;
        ctx.save();
        ctx.globalAlpha = 0.35;
        circle(ctx, x, y, p.r * 1.9 * pul, '#ffc8ec');
        ctx.restore();
        circle(ctx, x, y, p.r * pul, '#fff0fa');
        circle(ctx, x + p.r * 0.35, y - p.r * 0.2, p.r * 0.8 * pul, '#ffc8ec');
        circle(ctx, x - p.r * 0.35, y + p.r * 0.25, p.r * 0.18, '#e888d0');
        circle(ctx, x - p.r * 0.1, y - p.r * 0.45, p.r * 0.12, '#e888d0');
        break;
      }
      case 'boulder': {
        const img = boulderSprite();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.spin);
        const s = (p.r * 2.2) / img.width;
        ctx.scale(s, s);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        break;
      }
      default: {
        // orbe con los colores del ataque
        const pul = 1 + Math.sin(t * 14) * 0.15;
        ctx.save();
        ctx.globalAlpha = 0.35;
        circle(ctx, x, y, p.r * 1.7 * pul, colors[2]);
        ctx.restore();
        circle(ctx, x, y, p.r, p.fx === 'fantasma' ? colors[4] : colors[3]);
        ctx.strokeStyle = colors[1];
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(x, y, p.r * pul, 0, Math.PI * 2);
        ctx.stroke();
        circle(ctx, x - 1, y - 1, 1.1, p.fx === 'fantasma' ? '#ffe66b' : colors[0]);
      }
    }
  }
}

// ------------------------------------------------------------- Peligros

export function updateHazards(b, dt) {
  for (const h of b.hazards) {
    const target = h.owner.opponent;
    const m = h.m;
    if (h.kind === 'ring' || h.kind === 'quake') {
      h.r += h.speed * dt;
      for (let i = 0; i < 4; i++) {
        const a = fxRandom() * Math.PI * 2;
        const px = h.x + Math.cos(a) * h.r;
        const py = h.y + Math.sin(a) * h.r * 0.6;
        if (h.kind === 'quake') {
          if (fxRandom() < 0.4) b.effects.burst(px, py, ['#e6faff', '#8fd3ff', '#ffffff'], { count: 1, speed: 20, size: 1.6, life: 0.4, up: 25, grav: 80 });
        } else if (m.fx === 'petalo') {
          b.effects.add({ x: px, y: py - 2, vx: (fxRandom() - 0.5) * 20, vy: -18, life: 0.7, max: 0.7, size: 2.4, color: h.colors[1 + (i % 3)], grav: 20, drag: 2, shape: 'petal', rot: fxRandom() * 6, spin: 8 });
        } else b.effects.trail(px, py - 2, h.colors, { size: 2, jitter: 1, vy: -14 });
      }
      if (!h.hit && target.alive && target.lift < 20) {
        const dx = target.x - h.x;
        const dy = (target.y - h.y) / 0.6;
        const d = Math.hypot(dx, dy);
        if (Math.abs(d - h.r) < h.width / 2 + target.r * 0.6) {
          h.hit = true;
          const nd = d || 1;
          b.damage(h.owner, target, h.dmg, { m, kb: h.kb, dirX: dx / nd, dirY: (target.y - h.y) / nd, stun: h.stun, sleep: h.sleep });
        }
      }
      if (h.r >= h.maxR) h.done = true;
    } else if (h.kind === 'zone') {
      h.t += dt;
      const inside = target.alive && target.lift < 20 && Math.hypot(target.x - h.x, (target.y - h.y) / 0.6) < h.r + target.r * 0.3;
      if (!h.burst && h.t >= m.warn) {
        h.burst = true;
        b.shake(m.visual === 'psy' ? 6 : 3);
        b.audio.play(m.visual === 'fire' ? 'fire' : m.visual === 'psy' ? 'explode' : 'needle');
        const colors = pal(m);
        b.effects.burst(h.x, h.y - 3, colors, { count: 30, speed: 80, size: 2.2, life: 0.6, up: 20 });
        if (m.visual === 'psy') b.effects.ring(h.x, h.y, colors[1], { maxR: h.r * 1.4, life: 0.4, width: 3 });
        if (m.visual === 'spikes') b.effects.typeHit(h.x, h.y - 4, 'roca', 20);
        b.mark(h.x, h.y, m.visual === 'spikes' ? 'roca' : m.fx, h.r * 0.8);
        if (inside) b.damage(h.owner, target, m.burst, { m, kb: m.visual === 'psy' ? 120 : 0, dirX: 0, dirY: -1, root: m.root, stun: m.stun });
      }
      if (h.burst) {
        if (m.pull && target.alive && target.lift < 20) {
          const dx = h.x - target.x;
          const dy = h.y - target.y;
          const d = Math.hypot(dx, dy);
          if (d < h.r * 2 && d > 2) {
            target.kx += (dx / d) * m.pull * dt * 4;
            target.ky += (dy / d) * m.pull * dt * 4;
          }
        }
        h.tick -= dt;
        if (h.tick <= 0) {
          h.tick = 0.25;
          if (inside && m.tick) b.damage(h.owner, target, m.tick, { m, kb: 0, noCrit: true, hitstop: 0, tick: true, slow: m.slow ? 0.35 : 0 });
        }
        if (fxRandom() < 0.5) {
          const colors = pal(m);
          const a = fxRandom() * Math.PI * 2;
          const d = fxRandom() * h.r;
          b.effects.trail(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * 0.6, colors, { size: 1.8, vy: m.visual === 'fire' ? -22 : -10 });
        }
      }
      if (h.t >= m.warn + m.dur) h.done = true;
    } else if (h.kind === 'strike') {
      h.t += dt;
      if (!h.hit && h.t >= m.warn) {
        h.hit = true;
        b.shake(4);
        const psy = m.visual === 'psy';
        b.audio.play(psy ? 'explode' : 'thunder');
        b.effects.burst(h.x, h.y, psy ? pal(m) : ['#ffffff', '#fff6a0', '#ffe14d'], { count: 24, speed: 90, size: 2, life: 0.4, up: 20 });
        if (psy) b.effects.ring(h.x, h.y, '#ff8fbf', { maxR: h.r * 1.6, life: 0.4, width: 2.5 });
        b.mark(h.x, h.y, m.fx, h.r * 0.9);
        b.splash(h.x, h.y, 10);
        if (target.alive && target.lift < 20 && Math.hypot(target.x - h.x, (target.y - h.y) / 0.6) < h.r + target.r * 0.5) {
          b.damage(h.owner, target, m.dmg, { m, kb: 60, dirX: 0, dirY: 1, stun: m.stun });
        }
      }
      if (h.t >= m.warn + 0.25) h.done = true;
    } else if (h.kind === 'wave') {
      h.t += dt;
      h.x += h.dx * m.speed * dt;
      h.y += h.dy * m.speed * dt;
      const half = m.width / 2;
      const rx = target.x - h.x;
      const ry = target.y - h.y;
      const along = rx * h.dx + ry * h.dy;
      const across = -rx * h.dy + ry * h.dx;
      if (!h.hit && target.alive && target.lift < 20 && Math.abs(along) < 10 + target.r && Math.abs(across) < half) {
        h.hit = true;
        b.damage(h.owner, target, m.dmg, { m, kb: m.kb, dirX: h.dx, dirY: h.dy, stun: 0.2 });
      }
      for (const p of b.projectiles) {
        if (p.owner !== h.owner && !p.dead) {
          const px = p.x - h.x;
          const py = p.y - h.y;
          if (Math.abs(px * h.dx + py * h.dy) < 8 && Math.abs(-px * h.dy + py * h.dx) < half) killProjectile(b, p);
        }
      }
      if (fxRandom() < 0.9) {
        const k = (fxRandom() - 0.5) * m.width;
        b.effects.burst(h.x - h.dy * k, h.y + h.dx * k - 6, ['#ffffff', '#e6faff', '#8fd3ff'], { count: 1, speed: 30, size: 2, life: 0.5, up: 30, grav: 120 });
      }
      if (h.t > 3 || h.x < -80 || h.x > VW + 80 || h.y < -80 || h.y > 260) h.done = true;
    }
  }
  b.hazards = b.hazards.filter((h) => !h.done);
}

// Lo que va en el piso (debajo de los Pokémon)
export function renderGroundHazards(ctx, b, t) {
  for (const h of b.hazards) {
    const m = h.m;
    if (h.kind === 'zone') {
      const colors = pal(m);
      if (!h.burst) {
        const k = h.t / m.warn;
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(t * 30) * 0.12;
        ctx.fillStyle = '#e8413b';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r * k, h.r * 0.6 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = '#ffd0c0';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (m.visual === 'whirl') {
        const life = Math.min(1, (m.warn + m.dur - h.t) * 2);
        ctx.save();
        ctx.globalAlpha = life;
        ctx.translate(h.x, h.y);
        ctx.scale(1, 0.6);
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = i % 2 ? '#e6faff' : '#2b6fb8';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 3; a += 0.2) {
            const rr = (a / (Math.PI * 3)) * h.r;
            const ang = a + t * 5 + (i * Math.PI) / 2;
            ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
          }
          ctx.stroke();
        }
        ctx.restore();
      } else {
        const life = Math.min(1, (m.warn + m.dur - h.t) * 3);
        ctx.save();
        ctx.globalAlpha = life * 0.45;
        ctx.fillStyle = colors[4];
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (h.kind === 'strike' && !h.hit) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t * 40) * 0.2;
      ctx.fillStyle = m.visual === 'psy' ? '#f95587' : '#ffe14d';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Anillos, olas, rayos y enredaderas (por encima de los Pokémon)
export function renderHazards(ctx, b, t) {
  for (const h of b.hazards) {
    const m = h.m;
    if (h.kind === 'ring' || h.kind === 'quake') {
      const fade = 1 - h.r / h.maxR;
      ctx.save();
      ctx.globalAlpha = Math.min(1, fade * 2.5);
      ctx.lineWidth = h.width;
      ctx.strokeStyle = h.kind === 'quake' ? 'rgba(230,250,255,0.6)' : h.colors[2];
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = h.width * 0.35;
      ctx.strokeStyle = h.kind === 'quake' ? '#ffffff' : h.colors[1];
      ctx.stroke();
      if (h.notes) {
        ctx.font = '900 7px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + h.r * 0.03;
          const nx = h.x + Math.cos(a) * h.r;
          const ny = h.y + Math.sin(a) * h.r * 0.6 + Math.sin(t * 10 + i) * 1.5;
          ctx.strokeStyle = '#1b1224';
          ctx.strokeText(i % 2 ? '♪' : '♫', nx, ny);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(i % 2 ? '♪' : '♫', nx, ny);
        }
      }
      ctx.restore();
    } else if (h.kind === 'zone' && h.burst && (m.visual === 'vines' || m.visual === 'fire')) {
      const age = h.t - m.warn;
      const life = 1 - age / m.dur;
      const grow = Math.min(1, age * 8);
      const fire = m.visual === 'fire';
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, life * 4));
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + i;
        const d = ((((i * 37) % 10) / 10) * 0.6 + 0.4) * h.r * 0.9;
        const vx = h.x + Math.cos(a) * d;
        const vy = h.y + Math.sin(a) * d * 0.6;
        const hh = (7 + ((i * 13) % 6)) * grow * (0.8 + Math.sin(t * (fire ? 18 : 8) + i) * 0.2);
        const sway = Math.sin(t * 5 + i) * 1.5;
        ctx.fillStyle = '#1b1224';
        ctx.beginPath();
        ctx.moveTo(vx - 2.6, vy + 0.5);
        ctx.lineTo(vx + sway, vy - hh - 1);
        ctx.lineTo(vx + 2.6, vy + 0.5);
        ctx.fill();
        ctx.fillStyle = fire ? (i % 2 ? '#ff9520' : '#ffe45c') : i % 2 ? '#5cc45a' : '#3b8f45';
        ctx.beginPath();
        ctx.moveTo(vx - 1.7, vy);
        ctx.lineTo(vx + sway, vy - hh);
        ctx.lineTo(vx + 1.7, vy);
        ctx.fill();
        if (!fire && i % 3 === 0) {
          ctx.fillStyle = '#ff6fa8';
          ctx.fillRect(vx + sway - 0.9, vy - hh - 0.9, 1.8, 1.8);
        }
      }
      ctx.restore();
    } else if (h.kind === 'zone' && h.burst && m.visual === 'spikes') {
      const age = h.t - m.warn;
      const life = Math.max(0, 1 - age / m.dur);
      const grow = Math.min(1, age * 10);
      ctx.save();
      ctx.globalAlpha = Math.min(1, life * 3);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + i * 0.7;
        const d = ((((i * 53) % 10) / 10) * 0.7 + 0.15) * h.r;
        const vx = h.x + Math.cos(a) * d;
        const vy = h.y + Math.sin(a) * d * 0.6;
        const hh = (14 + ((i * 17) % 9)) * grow;
        const w = 4 + ((i * 7) % 3);
        ctx.fillStyle = '#1b1224';
        ctx.beginPath();
        ctx.moveTo(vx - w - 0.8, vy + 1);
        ctx.lineTo(vx + 1, vy - hh - 1);
        ctx.lineTo(vx + w + 0.8, vy + 1);
        ctx.fill();
        ctx.fillStyle = i % 2 ? '#a09381' : '#c9bca6';
        ctx.beginPath();
        ctx.moveTo(vx - w, vy);
        ctx.lineTo(vx + 1, vy - hh);
        ctx.lineTo(vx + w, vy);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.moveTo(vx - w * 0.3, vy - 1);
        ctx.lineTo(vx + 1, vy - hh + 1);
        ctx.lineTo(vx + 0.6, vy - 1);
        ctx.fill();
      }
      ctx.restore();
    } else if (h.kind === 'zone' && h.burst && m.visual === 'psy') {
      const age = h.t - m.warn;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / m.dur) * 0.6;
      ctx.fillStyle = '#f95587';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y - 6, h.r, h.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (h.kind === 'strike' && h.hit && m.visual === 'psy') {
      // Premonición: columna de energía psíquica
      const k = Math.max(0, 1 - (h.t - m.warn) / 0.25);
      ctx.save();
      ctx.globalAlpha = k;
      const w = h.r * 0.9;
      const g = ctx.createLinearGradient(h.x - w, 0, h.x + w, 0);
      g.addColorStop(0, 'rgba(249,85,135,0)');
      g.addColorStop(0.5, 'rgba(255,208,228,0.95)');
      g.addColorStop(1, 'rgba(249,85,135,0)');
      ctx.fillStyle = g;
      ctx.fillRect(h.x - w, h.y - 200, w * 2, 200);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, h.r * (1.4 - k * 0.6), h.r * 0.6 * (1.4 - k * 0.6), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (h.kind === 'strike' && h.hit) {
      // Rayo cayendo del cielo
      const k = 1 - (h.t - m.warn) / 0.25;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.lineCap = 'round';
      const pts = [];
      let x = h.x + (fxRandom() - 0.5) * 6;
      for (let y = h.y - 200; y < h.y; y += 14) {
        pts.push([x, y]);
        x += (fxRandom() - 0.5) * 10;
      }
      pts.push([h.x, h.y]);
      for (const [w, c] of [[6, '#ffe14d'], [2.5, '#ffffff']]) {
        ctx.lineWidth = w;
        ctx.strokeStyle = c;
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
      ctx.restore();
    } else if (h.kind === 'wave') {
      const half = m.width / 2;
      const ang = Math.atan2(h.dy, h.dx);
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(ang);
      ctx.globalAlpha = Math.min(1, h.t * 4);
      ctx.fillStyle = '#2b6fb8';
      ctx.beginPath();
      ctx.moveTo(-26, -half);
      for (let k = -half; k <= half; k += 6) ctx.lineTo(4 + Math.sin(k * 0.3 + t * 12) * 2, k);
      ctx.lineTo(-26, half);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4aa8e8';
      ctx.fillRect(-16, -half, 14, half * 2);
      ctx.fillStyle = '#ffffff';
      for (let k = -half; k <= half; k += 3) {
        const w = 3 + Math.sin(k * 0.5 + t * 15) * 1.5;
        ctx.fillRect(2 + Math.sin(k * 0.3 + t * 12) * 2, k, w, 2.5);
      }
      ctx.restore();
    }
  }
  // Chorros y rayos
  for (const f of b.fighters) {
    const a = f.action;
    if (!a || (a.kind !== 'beam' && a.kind !== 'stream') || a.charge > 0) continue;
    const m = a.m;
    const colors = pal(m);
    const cx = Math.cos(a.angle);
    const cy = Math.sin(a.angle);
    const sx = f.x + cx * f.r;
    const sy = f.y + cy * f.r * 0.6 - f.mouthH();
    const ex = sx + cx * a.len;
    const ey = sy + cy * a.len;
    const grow = Math.max(0, Math.min(1, a.t * 6) * Math.min(1, (m.dur - a.t) * 6));
    const W = m.width * (f.boss ? 1.3 : 1);
    if (a.kind === 'stream') {
      ctx.save();
      ctx.globalAlpha = 0.5 * grow;
      ctx.fillStyle = colors[2];
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex - cy * W, ey + cx * W);
      ctx.lineTo(ex + cy * W, ey - cx * W);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      continue;
    }
    const w = 1 + Math.sin(t * 40) * 0.12;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = colors[4];
    ctx.lineWidth = Math.max(0.1, W * w * grow);
    line(ctx, sx, sy, ex, ey);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors[3];
    ctx.lineWidth = Math.max(0.1, W * 0.7 * w * grow);
    line(ctx, sx, sy, ex, ey);
    ctx.strokeStyle = colors[1];
    ctx.lineWidth = Math.max(0.1, W * 0.3 * grow);
    line(ctx, sx, sy, ex, ey);
    ctx.fillStyle = '#ffffff';
    for (let d = (t * 160) % 12; d < a.len; d += 12) {
      ctx.fillRect(sx + cx * d - 0.7 - cy * Math.sin(d + t * 20) * W * 0.3, sy + cy * d - 0.7 + cx * Math.sin(d + t * 20) * W * 0.3, 1.4, 1.4);
    }
    circle(ctx, sx, sy, W * 0.6 * grow, colors[1]);
    ctx.restore();
  }
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
