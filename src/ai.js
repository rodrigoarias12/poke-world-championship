import { DIFFICULTY } from './data.js';
import { FIELD } from './config.js';
import { moveRange } from './moves.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Controla al rival: se mueve, apunta, elige ataques y esquiva según la dificultad
export class AI {
  constructor(b, side, diff) {
    this.b = b;
    this.side = side;
    this.p = DIFFICULTY[diff];
    this.thinkT = 0.5;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 1;
    this.mode = 'kite';
    this.modeT = 2;
    this.move = [0, 0];
    this.queued = -1;
    this.queuedT = 0;
    this.aimErr = 0;
    this.seen = new WeakSet();
    this.dodgeLock = 0;
    this.ultReadyT = 0;
  }

  get f() {
    return this.b.fighters[this.side];
  }

  update(dt) {
    const { f, b, p } = this;
    const opp = f.opponent;
    const it = f.intent;
    it.use = -1;
    if (b.state !== 'fight' || !f.alive) {
      it.mx = it.my = 0;
      return;
    }
    const dx = opp.x - f.x;
    const dy = opp.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Gigamax: cuando se carga, espera un ratito y se vuelve gigante
    if (b.gmaxReady?.(this.side) && !p.noGmax) {
      if (this.gmaxWait === undefined) this.gmaxWait = 0.6 + Math.random() * 2.4;
      this.gmaxWait -= dt;
      if (this.gmaxWait <= 0) {
        this.gmaxWait = undefined;
        b.requestGmax(this.side);
      }
    }

    this.thinkT -= dt;
    this.strafeT -= dt;
    this.modeT -= dt;
    this.queuedT -= dt;
    this.dodgeLock -= dt;
    this.ultReadyT = f.cds[4] <= 0 ? this.ultReadyT + dt : 0;
    if (this.strafeT <= 0) {
      this.strafe *= -1;
      this.strafeT = 0.8 + Math.random() * 1.6;
    }
    if (this.modeT <= 0) {
      this.mode = Math.random() < p.aggression * 0.75 ? 'rush' : 'kite';
      this.modeT = 1.5 + Math.random() * 2.5;
    }
    if (this.thinkT <= 0) {
      this.thinkT = p.reaction * (0.7 + Math.random() * 0.6);
      this.think(dist, dx / dist, dy / dist);
    }

    it.mx = this.move[0];
    it.my = this.move[1];
    if (this.queued >= 0 && this.queuedT > 0) it.use = this.queued;
    if (this.queued >= 0 && f.cds[this.queued] > 0) this.queued = -1;

    // Apuntar con anticipación
    const lead = p.lead * Math.min(1, dist / 200);
    const tx = opp.x + opp.vx * lead * 0.6;
    const ty = opp.y + opp.vy * lead * 0.6;
    const a = Math.atan2(ty - f.y, tx - f.x) + this.aimErr;
    it.aimX = Math.cos(a);
    it.aimY = Math.sin(a);

    this.checkThreats(dist);
  }

  // Rango cómodo según sus ataques
  preferredRange() {
    const f = this.f;
    const opp = f.opponent;
    const first = f.moves[0];
    if (this.mode === 'rush' || first.kind === 'melee' || first.kind === 'dash') return f.r + opp.r + 8;
    return 80;
  }

  think(dist, ux, uy) {
    const { f, b, p } = this;
    const range = this.preferredRange();
    const radial = clamp((dist - range) / 25, -1, 1);
    const px = -uy;
    const py = ux;
    let mx = ux * radial + px * this.strafe * 0.7;
    let my = uy * radial + py * this.strafe * 0.7;

    // Alejarse de los bordes
    const m = 26;
    if (f.x < FIELD.x0 + m) mx += ((FIELD.x0 + m - f.x) / m) * 1.5;
    if (f.x > FIELD.x1 - m) mx -= ((f.x - (FIELD.x1 - m)) / m) * 1.5;
    if (f.y < FIELD.y0 + m * 0.6) my += 1.2;
    if (f.y > FIELD.y1 - m * 0.6) my -= 1.2;
    // Salir de zonas peligrosas
    for (const h of b.hazards) {
      if (h.owner === f || h.kind !== 'zone') continue;
      const d = Math.hypot(f.x - h.x, f.y - h.y) || 1;
      if (d < h.r + f.r + 6) {
        mx += ((f.x - h.x) / d) * 2.5;
        my += ((f.y - h.y) / d) * 2.5;
      }
    }
    const oa = f.opponent.action;
    if (oa && (oa.kind === 'beam' || oa.kind === 'stream')) {
      mx += px * this.strafe * 1.5;
      my += py * this.strafe * 1.5;
    }
    mx += (Math.random() - 0.5) * p.aimError * 1.5;
    my += (Math.random() - 0.5) * p.aimError * 1.5;
    const len = Math.hypot(mx, my);
    this.move = len > 1 ? [mx / len, my / len] : [mx, my];
    this.aimErr = (Math.random() - 0.5) * 2 * p.aimError;

    // Elegir ataque: del más fuerte al más débil
    this.queued = -1;
    if (!f.canAct) return;
    const order = [4, 3, 1, 0];
    const chance = [0.55 + p.aggression * 0.45, 0.4 + p.aggression * 0.5, 0.35 + p.aggression * 0.45, 0.5 + p.aggression * 0.5];
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const mv = f.moves[i];
      if (f.cds[i] > 0) continue;
      if (i === 4 && this.ultReadyT < p.ultDelay) continue;
      if (mv.kind === 'rest') {
        if (f.hp / f.maxHp < 0.4 && dist > 70) return this.queue(i);
        continue;
      }
      if (dist > moveRange(f, mv)) continue;
      if (mv.kind === 'shot' && dist < 16) continue;
      if (Math.random() < chance[k]) return this.queue(i);
    }
    // Descanso como habilidad de espacio
    const sp = f.moves[2];
    if (sp.kind === 'rest' && f.cds[2] <= 0 && f.hp / f.maxHp < 0.35 && dist > 80) this.queue(2);
  }

  queue(i) {
    this.queued = i;
    this.queuedT = 0.25;
  }

  // Esquiva lateral (o vuela) alejándose de los bordes
  dodge(vx, vy) {
    const { f } = this;
    const sp = f.moves[2];
    if (f.cds[2] > 0 || this.dodgeLock > 0 || sp.kind === 'rest') return;
    const len = Math.hypot(vx, vy) || 1;
    let px = -vy / len;
    let py = vx / len;
    const cx = (FIELD.x0 + FIELD.x1) / 2 - f.x;
    const cy = (FIELD.y0 + FIELD.y1) / 2 - f.y;
    if (px * cx + py * cy < 0) {
      px = -px;
      py = -py;
    }
    f.intent.mx = px;
    f.intent.my = py;
    f.intent.use = 2;
    this.dodgeLock = 0.3;
  }

  checkThreats(dist) {
    const { f, b, p } = this;
    const opp = f.opponent;
    for (const pr of b.projectiles) {
      if (pr.owner === f || this.seen.has(pr) || pr.age < p.reaction * 0.6) continue;
      const rx = f.x - pr.x;
      const ry = f.y - pr.y;
      const v2 = pr.vx * pr.vx + pr.vy * pr.vy || 1;
      const tca = (rx * pr.vx + ry * pr.vy) / v2;
      if (tca < 0) {
        this.seen.add(pr);
        continue;
      }
      if (tca > 0.5) continue;
      this.seen.add(pr);
      const miss = Math.hypot(pr.x + pr.vx * tca - f.x, pr.y + pr.vy * tca - f.y);
      if (miss < f.r + pr.r + 3 && Math.random() < p.dodge) this.dodge(pr.vx, pr.vy);
    }
    for (const h of b.hazards) {
      if (h.owner === f || this.seen.has(h)) continue;
      if (h.kind === 'ring' || h.kind === 'quake') {
        const gap = Math.hypot(f.x - h.x, (f.y - h.y) / 0.6) - h.r;
        if (gap > 0 && gap < 10) {
          this.seen.add(h);
          if (Math.random() < p.dodge + 0.1) this.dodge(f.y - h.y, -(f.x - h.x));
        }
      } else if ((h.kind === 'zone' && !h.burst) || (h.kind === 'strike' && !h.hit)) {
        const d = Math.hypot(f.x - h.x, f.y - h.y);
        if (d < h.r + f.r && h.t > p.reaction * 0.7) {
          this.seen.add(h);
          if (Math.random() < p.dodge + 0.15) this.dodge(f.y - h.y || 1, -(f.x - h.x));
        }
      } else if (h.kind === 'wave') {
        const rx = f.x - h.x;
        const ry = f.y - h.y;
        const along = rx * h.dx + ry * h.dy;
        if (along > 0 && along < 40) {
          this.seen.add(h);
          if (Math.random() < p.dodge) this.dodge(h.dy, -h.dx);
        }
      }
    }
    const a = opp.action;
    if (a && a.kind === 'dash' && a.phase === 'go' && dist < 70 && !this.seen.has(a.dir)) {
      this.seen.add(a.dir);
      if (Math.random() < p.dodge * 0.8) this.dodge(a.dir[0], a.dir[1]);
    }
  }
}
