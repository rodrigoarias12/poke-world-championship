// Bots de la batalla campal. Cada tanto deciden qué hacer:
//   ZONA     volver al círculo seguro antes de que llegue la niebla
//   HUIR     con poca vida, alejarse del que lo persigue
//   PELEAR   hay un rival en su pantalla (la pelea la maneja la IA de siempre)
//   JUNTAR   un premio cerca y nadie alrededor
//   EXPLORAR caminar buscando rivales
// Para caminar usan un mapa de distancias (esquivan árboles y casas).
import { AI } from '../ai.js';
import { TILE } from '../adventure/tiles.js';

const THINK = { facil: 0.6, normal: 0.35, dificil: 0.25 };

export class BotController {
  constructor(b, side, diff) {
    this.b = b;
    this.side = side;
    this.diff = diff;
    this.isAI = true;
    this.ai = new AI(b, side, diff);
    this.mode = 'explorar';
    this.planT = 0.2 + Math.random() * 0.4;
    this.goal = null;
    this.field = null;
    this.wanderT = 0;
    this.foe = null;
    this.stuckT = 0;
    this.lastPos = null;
  }

  get f() {
    return this.b.fighters[this.side];
  }

  update(dt) {
    const { b, f } = this;
    const it = f.intent;
    if (b.state !== 'fight' || !f.alive) {
      it.mx = it.my = 0;
      it.use = -1;
      return;
    }
    this.planT -= dt;
    this.wanderT -= dt;
    if (this.planT <= 0) {
      this.planT = (THINK[this.diff] || 0.35) * (0.8 + Math.random() * 0.4);
      this.plan();
    }
    const fighting = this.mode === 'pelear' && this.foe?.alive;
    if (fighting) {
      this.ai.update(dt);
      // Si un árbol tapa el tiro, rodea en vez de disparar contra el tronco
      const o = this.foe;
      if (!b.world.clearLine(f.x, f.y - 4, o.x, o.y - 4)) {
        const [dx, dy] = this.walkTo(o.x, o.y);
        it.mx = dx;
        it.my = dy;
        it.use = -1;
      }
      // Peleando adentro de la niebla: se va corriendo de a poco hacia el círculo
      if (b.zone.outside(f.x, f.y)) {
        const [dx, dy] = this.walkTo(b.zone.x, b.zone.y);
        it.mx = it.mx * 0.4 + dx * 0.8;
        it.my = it.my * 0.4 + dy * 0.8;
      }
      return;
    }
    // Caminando: hacia la meta, y si alguien lo persigue le tira de vez en cuando
    const [dx, dy] = this.goal ? this.walkTo(this.goal.x, this.goal.y) : [0, 0];
    if (this.mode === 'huir' && this.foe?.alive && (!this.foe.human || b.mayAttack(f, this.foe))) {
      this.ai.update(dt);
    } else {
      it.use = -1;
    }
    it.mx = dx;
    it.my = dy;
    if (this.mode !== 'huir') {
      it.aimX = dx || f.facing;
      it.aimY = dy;
    }
    // Si quedó trabado contra algo, cambia de meta
    const p = this.lastPos;
    if (p && Math.hypot(f.x - p.x, f.y - p.y) < 0.2 && Math.hypot(dx, dy) > 0.5) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastPos = { x: f.x, y: f.y };
    if (this.stuckT > 0.8) {
      this.stuckT = 0;
      this.wanderT = 0;
      this.goal = b.world.randomSpot(f.x, f.y, 5 * TILE, Math.random);
    }
  }

  // Dirección de caminata usando el mapa de distancias (se rehace si cambia la meta)
  walkTo(x, y) {
    const w = this.b.world;
    const f = this.f;
    const key = `${Math.floor(x / TILE)},${Math.floor(y / TILE)}`;
    if (!this.field || this.fieldKey !== key) {
      this.field = w.flowField(x, y);
      this.fieldKey = key;
    }
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < 6) return [0, 0];
    // Cerca y sin nada en el medio: derecho
    if (d < 40 && w.clearLine(f.x, f.y, x, y)) return [(x - f.x) / d, (y - f.y) / d];
    return w.flowDir(this.field, f.x, f.y);
  }

  plan() {
    const { b, f } = this;
    const z = b.zone;
    const hp = f.hp / f.maxHp;
    // Rivales que ve en su pantalla (20x11 baldosas, como un celular)
    const seen = b.fighters.filter((o) => o !== f && o.alive && b.canSee(f, o) && b.inView(f, o));
    const foe = this.chooseFoe(seen);
    const closest = seen.reduce((best, o) => (!best || dist(f, o) < dist(f, best) ? o : best), null);

    // Fuera del próximo círculo (o del actual) cuando se viene la niebla
    const urgent = z.outside(f.x, f.y) || (z.outsideNext(f.x, f.y, 10) && (z.shrinking || z.countdown < 10));
    if (urgent && !(foe && dist(f, foe) < 40)) {
      this.setMode('zona', null, { x: z.next.x, y: z.next.y });
      return;
    }
    if (hp < 0.3 && closest && dist(f, closest) < 110) {
      // Escapa hacia el centro del círculo, del lado contrario al rival
      const ax = f.x - closest.x;
      const ay = f.y - closest.y;
      const d = Math.hypot(ax, ay) || 1;
      const gx = f.x + (ax / d) * 90 + (z.next.x - f.x) * 0.3;
      const gy = f.y + (ay / d) * 70 + (z.next.y - f.y) * 0.3;
      const spot = b.world.randomSpot(gx, gy, 24, Math.random);
      this.setMode('huir', closest, spot);
      return;
    }
    if (foe) {
      this.setMode('pelear', foe, null);
      return;
    }
    // Un premio cerca y nadie alrededor
    const item = b.items
      .filter((it) => dist(f, it) < 7 * TILE && !z.outside(it.x, it.y))
      .sort((p, q) => dist(f, p) - dist(f, q))[0];
    if (item && !seen.some((o) => dist(f, o) < 5 * TILE)) {
      this.setMode('juntar', null, item);
      return;
    }
    // Explorar: hacia alguien (se los "oye") o a un lugar del próximo círculo
    if (this.mode !== 'explorar' || this.wanderT <= 0 || !this.goal || dist(f, this.goal) < 12) {
      this.wanderT = 4 + Math.random() * 4;
      const others = b.fighters.filter((o) => o !== f && o.alive);
      const near = others.sort((p, q) => dist(f, p) - dist(f, q))[0];
      if (near && Math.random() < 0.35 && !z.outsideNext(near.x, near.y)) this.goal = b.world.randomSpot(near.x, near.y, 3 * TILE, Math.random);
      else this.goal = b.world.randomSpot(z.next.x, z.next.y, Math.max(TILE, z.next.r - TILE), Math.random);
    }
    this.setMode('explorar', null, this.goal);
  }

  setMode(mode, foe, goal) {
    this.mode = mode;
    this.foe = foe;
    if (goal) this.goal = goal;
    this.f.forced = mode === 'pelear' || mode === 'huir' ? foe : null;
  }

  // A quién atacar: cerca, que le pegó, con poca vida o con ventaja de tipo.
  // A las personas solo si tiene la "ficha" (nunca dos bots a la vez sobre ella)
  chooseFoe(seen) {
    const { b, f } = this;
    const scored = [];
    for (const o of seen) {
      if (o.human && this.diff !== 'dificil' && (o.sleep > 0 || o.stun > 0.3)) continue;
      let s = -dist(f, o) / 40;
      if (f.lastHitBy === o && b.t - f.lastHitT < 4) s += 2;
      s += (1 - o.hp / o.maxHp) * 1.5;
      if (o === this.foe) s += 1;
      if (o.human) s -= 0.6;
      scored.push({ o, s });
    }
    scored.sort((p, q) => q.s - p.s);
    // El mejor al que se le permite atacar (así solo agarra la ficha del elegido)
    let best = scored.find(({ o }) => b.mayAttack(f, o))?.o || null;
    // Con poca vida, a veces cambia de blanco
    if (best?.human && f.hp / f.maxHp < 0.2 && Math.random() < 0.4) {
      const other = seen.find((o) => !o.human && o !== best);
      if (other) best = other;
    }
    return best;
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
