import { CREATURES, MOVES } from './data.js';
import { FIELD, SPRITE_SCALE, BOSS_SCALE } from './config.js';
import { spriteOf, frameAt } from './sprites.js';
import { TYPE_COLORS } from './effects.js';
import { startMove, updateAction } from './moves.js';
import { speakName, moveNameFor } from './announcer.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Fighter {
  constructor(battle, key, side, { boss = false, x, y } = {}) {
    const def = CREATURES[key];
    this.battle = battle;
    this.def = def;
    this.key = key;
    this.id = key;
    this.type = def.type;
    this.side = side;
    this.boss = boss;
    this.titan = boss;
    this.name = boss ? def.boss.name : def.name;
    const spr = spriteOf(key, boss);
    this.ds = SPRITE_SCALE * spr.scale * (boss ? BOSS_SCALE : 1);
    this.tall = spr.h * this.ds;
    this.wide = spr.w * this.ds;
    this.r = clamp(this.wide * 0.3, 6, 24);
    this.scale = Math.max(0.8, this.tall / 16);
    this.maxHp = Math.round(def.hp * (boss ? 1.7 : 1));
    this.hp = this.maxHp;
    this.ghostHp = this.hp;
    this.ghostDelay = 0;
    this.speed = def.speed * (boss ? 0.92 : 1);
    this.pow = def.pow * (boss ? 1.12 : 1);
    this.defn = def.def;
    this.moves = def.moves.map((k) => MOVES[k]);
    this.cds = [0, 0, 0, 0, 0];
    const sp = battle.arena.spawns[side];
    this.x = x ?? sp.x;
    this.y = y ?? sp.y;
    this.vx = 0;
    this.vy = 0;
    this.kx = 0;
    this.ky = 0;
    this.facing = side === 0 ? 1 : -1;
    this.dashT = 0;
    this.dashDir = [0, 0];
    this.dashSpeed = 0;
    this.iframes = 0;
    this.stun = 0;
    this.sleep = 0;
    this.root = 0;
    this.slow = 0;
    this.action = null;
    this.pending = [];
    this.flash = 0;
    this.squash = 0;
    this.lift = 0;
    this.animT = Math.random() * 5;
    this.walkT = 0;
    this.rippleT = 0;
    this.moving = false;
    this.onWater = true;
    this.invisible = 0;
    this.burnT = 0;
    this.shockT = 0;
    this.frozenT = 0;
    this.alive = true;
    this.enterT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.dodgeTextT = 0;
    this.effTextT = 0;
    this.stats = { hits: 0, maxCombo: 0, dealt: 0 };
    this.intent = { mx: 0, my: 0, use: -1, aimX: 1, aimY: 0 };
  }

  get opponent() {
    return this.battle.fighters[1 - this.side];
  }

  // ¿Lo maneja la IA? (apunta y embiste distinto que un jugador)
  get isAI() {
    return !!this.battle.controllers?.[this.side]?.isAI;
  }

  get cryId() {
    return this.boss ? this.def.boss.id : this.def.id;
  }

  get sprite() {
    return spriteOf(this.key, this.boss);
  }

  // ¿Hay que espejar el sprite para mirar hacia donde mira el luchador?
  get flipX() {
    return this.sprite.facesLeft ? this.facing > 0 : this.facing < 0;
  }

  // Altura (desde los pies) de donde salen los ataques
  mouthH() {
    return this.tall * 0.55 + this.lift;
  }

  get canAct() {
    return this.alive && this.stun <= 0 && !this.action && this.dashT <= 0;
  }

  useMove(i) {
    const m = this.moves[i];
    if (!m || this.cds[i] > 0) return false;
    if (m.kind === 'dodge') {
      if (this.stun > 0 || (this.action && this.action.kind !== 'melee') || this.dashT > 0) return false;
      this.action = null;
      this.startDodge(m);
    } else {
      if (!this.canAct) return false;
      startMove(this, this.battle, m);
    }
    this.cds[i] = m.cd * (this.boss ? 0.85 : 1);
    if (m.kind !== 'dodge' && i > 0) {
      this.battle.callout(this, `¡${m.name}!`, i >= 3);
      if (m.fx) this.battle.audio.cast(m.fx);
    }
    if (i >= 3 && m.kind !== 'dodge' && m.fx) {
      const colors = TYPE_COLORS[m.fx] || TYPE_COLORS.normal;
      this.battle.effects.circle(this.x, this.y, this.r * 2.4, colors[1], i === 4 ? 1 : 0.6);
      this.battle.effects.burst(this.x, this.y - this.tall / 2, colors, { count: i === 4 ? 24 : 12, speed: 70, size: 1.8, life: 0.5 });
    }
    if (i === 4 && m.kind !== 'dodge') this.battle.startCutin(this, m);
    if (i === 4) {
      this.battle.audio.cry(this.cryId, { vol: 0.35 });
      const ann = this.battle.game.announcer;
      const kind = m.kind === 'wave' ? 'surf' : m.freeze ? 'ice' : 'ult';
      this.battle.say(kind, { a: speakName(this.name), move: moveNameFor(ann?.lang, m.name) }, 1.5);
    } else if (m.kind === 'wave') {
      this.battle.say('surf', { a: speakName(this.name) }, 1.4);
    }
    return true;
  }

  startDodge(m) {
    const it = this.intent;
    let dx = it.mx;
    let dy = it.my;
    let len = Math.hypot(dx, dy);
    if (len < 0.2) {
      const opp = this.opponent;
      dx = this.x - opp.x;
      dy = this.y - opp.y;
      len = Math.hypot(dx, dy) || 1;
    }
    this.dashDir = [dx / len, dy / len];
    this.dashT = m.time || 0.18;
    this.dashSpeed = m.speed ?? 230;
    this.iframes = this.dashT + 0.06;
    this.battle.audio.play('dash');
    this.battle.splash(this.x, this.y, 4);
  }

  update(dt) {
    const b = this.battle;
    const it = this.intent;
    const fighting = b.state === 'fight';
    this.animT += dt * (this.frozenT > 0 ? 0 : this.sleep > 0 ? 0.3 : 1);
    this.burnT = Math.max(0, this.burnT - dt);
    this.shockT = Math.max(0, this.shockT - dt);
    this.frozenT = Math.max(0, this.frozenT - dt);
    if (this.alive && this.burnT > 0 && Math.random() < 0.6) {
      b.effects.trail(this.x + (Math.random() - 0.5) * this.wide * 0.6, this.y - Math.random() * this.tall * 0.8, TYPE_COLORS.fuego, { size: 2, vy: -26, life: 0.4 });
    }
    if (this.alive && this.frozenT > 0 && Math.random() < 0.25) {
      b.effects.trail(this.x + (Math.random() - 0.5) * this.wide * 0.6, this.y - Math.random() * this.tall, TYPE_COLORS.hielo, { size: 1.4, vy: 6, life: 0.5 });
    }
    this.enterT += dt;

    for (let i = 0; i < 5; i++) this.cds[i] = Math.max(0, this.cds[i] - dt);
    this.iframes = Math.max(0, this.iframes - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.sleep = Math.max(0, this.sleep - dt);
    this.root = Math.max(0, this.root - dt);
    this.slow = Math.max(0, this.slow - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.squash = Math.max(0, this.squash - dt * 5);
    this.invisible = Math.max(0, this.invisible - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    this.dodgeTextT = Math.max(0, this.dodgeTextT - dt);
    this.effTextT = Math.max(0, this.effTextT - dt);
    if (this.comboT <= 0) this.combo = 0;

    if (this.ghostHp > this.hp) {
      this.ghostDelay -= dt;
      if (this.ghostDelay <= 0) this.ghostHp = Math.max(this.hp, this.ghostHp - this.maxHp * 0.6 * dt);
    } else {
      this.ghostHp = this.hp;
    }

    // Ataques programados (por ejemplo los rayos de Trueno)
    for (const p of this.pending) p.t -= dt;
    const ready = this.pending.filter((p) => p.t <= 0);
    this.pending = this.pending.filter((p) => p.t > 0);
    for (const p of ready) if (this.alive && b.state === 'fight') p.fn();

    if (this.alive && fighting && it.use >= 0) this.useMove(it.use);

    // Movimiento
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir[0] * this.dashSpeed;
      this.vy = this.dashDir[1] * this.dashSpeed;
      if (this.dashSpeed > 0 && Math.random() < 0.9) b.effects.ghost(this, this.x, this.y, this.flipX, this.ds);
    } else if (this.action) {
      updateAction(this, b, dt);
    } else {
      const canMove = this.alive && fighting && this.stun <= 0 && this.root <= 0;
      const sp = this.speed * (this.slow > 0 ? 0.5 : 1);
      const k = 1 - Math.exp(-14 * dt);
      this.vx += ((canMove ? it.mx : 0) * sp - this.vx) * k;
      this.vy += ((canMove ? it.my : 0) * sp - this.vy) * k;
    }

    const kd = Math.exp(-6 * dt);
    this.kx *= kd;
    this.ky *= kd;
    const ox = this.x;
    const oy = this.y;
    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
    this.x = clamp(this.x, FIELD.x0 + this.r * 0.6, FIELD.x1 - this.r * 0.6);
    this.y = clamp(this.y, FIELD.y0, FIELD.y1);

    const moved = Math.hypot(this.x - ox, this.y - oy) / Math.max(dt, 1e-4);
    this.moving = moved > 10;
    if (this.moving) this.walkT += dt * (moved / 40);

    // Ondas en el agua al moverse
    this.onWater = !b.arena.onPlatform(this.x, this.y);
    this.rippleT -= dt;
    if (this.alive && this.lift < 5 && this.onWater && this.rippleT <= 0) {
      this.rippleT = this.moving ? 0.12 : 0.6;
      b.effects.ring(this.x, this.y, 'rgba(220,240,255,0.7)', { r: this.r * 0.6, maxR: this.r * (this.moving ? 1.4 : 1.2), life: this.moving ? 0.5 : 0.9, width: 0.8 });
      if (this.moving && Math.random() < 0.6) {
        b.effects.burst(this.x - this.vx * 0.05, this.y, ['#ffffff', '#cdeeff'], { count: 2, speed: 25, size: 1.4, life: 0.35, up: 15, grav: 60 });
      }
    }

    if (this.alive && !(this.action && this.action.lockFacing)) {
      const dx = this.opponent.x - this.x;
      if (Math.abs(dx) > 3) this.facing = dx > 0 ? 1 : -1;
    }

    if (this.boss && this.alive && Math.random() < 0.4) {
      b.effects.trail(this.x + (Math.random() - 0.5) * this.wide, this.y - Math.random() * this.tall, TYPE_COLORS[this.type], { size: 1.8, vy: -16 });
    }
  }

  render(ctx, t) {
    const b = this.battle;
    if (!this.alive && this.faintT > 1.0) return;
    const spr = this.sprite;
    const ds = this.ds;
    let alpha = 1;
    if (this.invisible > 0) alpha = 0.12;
    if (this.iframes > 0 && this.dashT <= 0 && !this.action && Math.floor(t * 30) % 2 === 0) alpha *= 0.6;
    if (!this.alive) alpha *= Math.max(0, 1 - this.faintT);
    if (this.enterT < 0.35) alpha *= this.enterT / 0.35;
    const dig = this.action?.kind === 'fly' && this.action.m.dig && this.lift > 5;

    // Sombra (en el aire se achica)
    const sh = 1 - Math.min(0.6, this.lift / 260);
    ctx.fillStyle = this.onWater ? 'rgba(5,20,50,0.35)' : 'rgba(40,20,5,0.35)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 1, this.r * 1.05 * sh, this.r * 0.4 * sh, 0, 0, Math.PI * 2);
    ctx.fill();
    // Aro de color en los pies: naranja el tuyo, azul el rival (como en la pantalla VS)
    if (this.alive && this.invisible <= 0) {
      const mine = this.side === b.localSide;
      const rx = this.r * 1.25 * sh;
      const ry = this.r * 0.5 * sh;
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = 1;
      ctx.strokeStyle = mine ? '#ffb43b' : '#5ab4ff';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Flechita delante del aro, hacia donde mira
      const fx = this.x + this.facing * rx;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(fx + this.facing * 2.2, this.y + 1);
      ctx.lineTo(fx, this.y - 0.6);
      ctx.lineTo(fx, this.y + 2.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (dig) {
      // Bajo tierra: solo se ve el montículo que avanza
      ctx.fillStyle = '#8a6a44';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.r * 0.8, this.r * 0.35, 0, Math.PI, 0);
      ctx.fill();
      return;
    }

    const asleep = this.sleep > 0;
    const bob = asleep ? 0 : this.moving ? Math.abs(Math.sin(this.walkT * 8)) * 1.5 : 0;
    const breathe = asleep ? Math.sin(t * 3) * 0.04 : 0;
    const sq = this.squash;
    const sx = 1 + sq * 0.15 + breathe;
    const sy = 1 - sq * 0.12 - breathe;
    const img = this.flash > 0 ? spr.white : frameAt(spr, this.animT);
    const half = (img.height * ds) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(this.x * 2) / 2, Math.round((this.y - bob - this.lift) * 2) / 2);
    if (this.action?.kind === 'dash' && this.action.m.spin && this.action.phase === 'go') {
      ctx.translate(0, -half);
      ctx.rotate(this.action.spin);
      ctx.translate(0, half);
    }
    if (!this.alive) {
      ctx.translate(0, -half);
      ctx.rotate(this.facing * Math.min(1.4, this.faintT * 3));
      ctx.translate(0, half);
    }
    ctx.scale((this.flipX ? -1 : 1) * sx * ds, sy * ds);
    ctx.drawImage(img, -img.width / 2, -img.height + 2);
    // Congelado: capa de hielo encima (la animación se detiene)
    if (this.frozenT > 0 && spr.ice && this.flash <= 0) {
      ctx.globalAlpha = alpha * 0.55;
      ctx.drawImage(spr.ice, -img.width / 2, -img.height + 2);
    }
    ctx.restore();

    if (!this.alive) return;
    // Electrizado: chispas alrededor del cuerpo
    if (this.shockT > 0) {
      ctx.save();
      ctx.strokeStyle = Math.random() < 0.5 ? '#fff6a0' : '#ffe14d';
      ctx.lineWidth = 0.9;
      for (let n = 0; n < 2; n++) {
        let px = this.x + (Math.random() - 0.5) * this.wide;
        let py = this.y - Math.random() * this.tall;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let k = 0; k < 4; k++) {
          px += (Math.random() - 0.5) * 7;
          py += (Math.random() - 0.5) * 7;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    const top = this.y - this.tall - this.lift - 2;
    if (asleep) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.8 + i / 3) % 1;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.font = `900 ${4 + k * 4}px Rubik, sans-serif`;
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1b1224';
        ctx.strokeText('Z', this.x + 6 + k * 8, top - k * 12);
        ctx.fillStyle = '#bfe9ff';
        ctx.fillText('Z', this.x + 6 + k * 8, top - k * 12);
        ctx.restore();
      }
    } else if (this.stun > 0 && !this.action) {
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i * Math.PI * 2) / 3;
        drawStar(ctx, this.x + Math.cos(a) * 8, top + Math.sin(a) * 2, '#ffe45c');
      }
    }
  }
}

export function drawStar(ctx, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = '#1b1224';
  ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillRect(x - 1, y - 2, 3, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y, 3, 1);
  ctx.fillRect(x, y - 1, 1, 3);
}
