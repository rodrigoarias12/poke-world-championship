// En el invitado: no simula la pelea. Recibe las fotos del anfitrión, las
// muestra con un pequeño retraso para mover todo suave entre una y otra,
// y reproduce los efectos y sonidos que grabó el anfitrión.
import { Battle } from '../battle.js';
import { Fighter } from '../fighter.js';
import { CREATURES, MOVES } from '../data.js';
import { unpack } from './protocol.js';

const lerp = (a, b, k) => a + (b - a) * k;

// Frases que dependen de quién mira: se dan vuelta para el invitado
const POV = { next: 'nextEnemy', nextEnemy: 'next', win: 'lose', lose: 'win' };

export class GuestBattle extends Battle {
  constructor(game, cfg) {
    super(game, cfg);
    this.localSide = 1;
    this.online = true;
    this.controllers = [];
    this.caption = { text: CREATURES[this.teams[1].keys[0]].cry, t: 0 };
    this.buf = [];
    this.prev = null;
    this.renderT = null;
    this.rate = 1;
    this.delay = 0.1;
    this.jitter = 0;
    this.lastArrival = 0;
    this.lastHt = -1;
  }

  // Llega una foto del anfitrión
  receive(s) {
    if (s.ht <= this.lastHt) return;
    this.lastHt = s.ht;
    const now = performance.now() / 1000;
    if (this.lastArrival) {
      const gap = now - this.lastArrival;
      this.jitter = this.jitter * 0.9 + Math.abs(gap - 1 / 30) * 0.1;
    }
    this.lastArrival = now;
    // Retraso adaptable: más colchón si la red está irregular
    this.delay = Math.max(0.06, Math.min(0.16, 2 / 30 + this.jitter * 3));
    this.buf.push(s);
    const target = s.ht - this.delay;
    if (this.renderT === null || Math.abs(target - this.renderT) > 0.35) {
      this.renderT = target;
      this.rate = 1;
    } else {
      this.rate = 1 + Math.max(-0.06, Math.min(0.06, (target - this.renderT) * 0.6));
    }
  }

  update(dt) {
    this.t += dt;
    for (const c of this.callouts) if (c) c.t += dt;
    if (this.caption) this.caption.t += dt;
    if (this.relator) this.relator.t += dt;
    if (this.flashFx) this.flashFx.a = Math.max(0, this.flashFx.a - dt * 3);
    if (this.renderT === null) return;
    this.renderT += dt * this.rate;
    while (this.buf.length && this.buf[0].ht <= this.renderT) {
      const s = this.buf.shift();
      this.apply(s);
      this.prev = s;
    }
    if (this.prev && this.buf.length) this.interpolate(this.prev, this.buf[0]);
    // Lo cosmético corre local, frenado igual que en el anfitrión
    if (!this.hitstop && !this.cutin) this.effects.update(dt * this.timeScale);
    this.arena.update(dt);
  }

  apply(s) {
    this.state = s.st;
    this.stateT = s.stT;
    this.hitstop = s.hs ? 0.01 : 0;
    this.timeScale = s.ts;
    this.darken = s.dk;
    this.zoom = s.zm;
    this.shakeAmt = s.sh;
    if (s.fl) this.flashFx = { ...s.fl };
    s.tm.forEach(([idx, fainted], side) => {
      this.teams[side].idx = idx;
      this.teams[side].fainted = fainted;
    });
    // Pokémon: si cambió (entró el siguiente), se crea de nuevo
    s.f.forEach((pf, side) => {
      let f = this.fighters[side];
      if (!f || f.key !== pf.key || f.boss !== pf.boss) {
        f = new Fighter(this, pf.key, side, { boss: pf.boss });
        this.fighters[side] = f;
        this.onSentOut(f);
      }
    });
    s.f.forEach((pf, side) => {
      const f = this.fighters[side];
      Object.assign(f, unpack(pf, this));
      // Se dibuja con el tamaño del sprite de este celular (y si es gigante, agrandado)
      f.applyGiant();
    });
    this.projectiles = s.p.map((p) => unpack(p, this));
    this.hazards = s.h.map((h) => unpack(h, this));
    this.cutin = s.ci ? { f: this.fighters[s.ci.s], m: MOVES[s.ci.m], t: s.ci.t, dur: s.ci.d, gname: s.ci.g, gform: s.ci.gf } : null;
    if (s.gx) this.gx = s.gx;
    this.gmaxFx = s.gf ? { f: this.fighters[s.gf.s], t: s.gf.t, dur: s.gf.d, boom: s.gf.t >= 1.1 } : null;
    this.switching = s.sw;
    this.winner = s.w === null ? null : this.fighters[s.w];
    if (s.ss) this.sideStats = s.ss;
    for (const e of s.ev) this.replay(e);
  }

  // Posiciones intermedias entre dos fotos
  interpolate(a, b) {
    const k = Math.max(0, Math.min(1, (this.renderT - a.ht) / Math.max(0.001, b.ht - a.ht)));
    this.fighters.forEach((f, side) => {
      const fa = a.f[side];
      const fb = b.f[side];
      if (!fa || !fb || fa.key !== fb.key || fb.key !== f.key) return;
      // Teletransportes y cambios bruscos: sin suavizar
      if (Math.hypot(fb.x - fa.x, fb.y - fa.y) > 40) return;
      f.x = lerp(fa.x, fb.x, k);
      f.y = lerp(fa.y, fb.y, k);
      f.lift = lerp(fa.lift, fb.lift, k);
    });
    const byId = (list) => new Map(list.map((o) => [o.id, o]));
    const pb = byId(b.p);
    for (const p of this.projectiles) {
      const q = pb.get(p.id);
      if (!q) continue;
      const pa = a.p.find((o) => o.id === p.id);
      if (!pa) continue;
      p.x = lerp(pa.x, q.x, k);
      p.y = lerp(pa.y, q.y, k);
    }
    const hb = byId(b.h);
    for (const h of this.hazards) {
      const q = hb.get(h.id);
      const ha = a.h.find((o) => o.id === h.id);
      if (!q || !ha) continue;
      if (typeof h.r === 'number') h.r = lerp(ha.r, q.r, k);
      if (h.kind === 'wave') {
        h.x = lerp(ha.x, q.x, k);
        h.y = lerp(ha.y, q.y, k);
      }
    }
  }

  // El invitado no simula: su botón GIGAMAX se cuenta y viaja al anfitrión
  requestGmax() {
    this.gmaxPress = (this.gmaxPress || 0) + 1;
    return false;
  }

  // Entró un Pokémon nuevo: el cartel se arma desde el punto de vista del invitado
  onSentOut(f) {
    if (!this.prev) return;
    const name = `${f.def.name[0]}${f.def.name.slice(1).toLowerCase()}`;
    if (f.side === this.localSide) this.caption = { text: `¡Adelante, ${name}! ${f.def.cry}`, t: 0 };
    else this.caption = { text: f.boss ? `¡Cuidado! ¡${f.name}!` : f.def.cry, t: 0 };
  }

  // Reproduce un efecto o sonido grabado por el anfitrión
  replay([tag, method, args]) {
    const a = args.map((x) => unpack(x, this));
    try {
      if (tag === 'fx') this.effects[method]?.(...a);
      else if (tag === 'au') this.audio[method]?.(...a);
      else if (tag === 'ar') this.arena[method]?.(...a);
      else if (tag === 'b' && method === 'callout') this.callout(...a);
      else if (tag === 'b' && method === 'say') {
        let [kind, vars = {}, priority] = a;
        if (kind === 'start') vars = { a: vars.b, b: vars.a };
        kind = POV[kind] || kind;
        this.say(kind, vars, priority);
      }
    } catch { /* un efecto que no aplica en este celular */ }
  }
}
