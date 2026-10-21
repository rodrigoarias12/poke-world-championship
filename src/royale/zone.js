// La NIEBLA MORADA de Gengar: un círculo seguro que se achica por fases.
// Afuera del círculo se pierde vida (un porcentaje de la vida máxima por
// segundo). En las primeras fases la niebla no elimina a nadie.
import { TILE } from '../adventure/tiles.js';

// espera (s), achique (s), radio final (baldosas), daño (% vida/s), ¿elimina?
export const ZONE_PHASES = [
  { wait: 20, shrink: 15, r: 14, dps: 0.02, lethal: false },
  { wait: 15, shrink: 15, r: 9, dps: 0.03, lethal: false },
  { wait: 12, shrink: 12, r: 5, dps: 0.05, lethal: true },
  { wait: 10, shrink: 12, r: 3, dps: 0.08, lethal: true },
  // Muerte súbita
  { wait: 10, shrink: 15, r: 0, dps: 0.15, lethal: true },
];
export const ZONE_START_R = 25;
// En las fases que no eliminan, la niebla te deja con este pedacito de vida
export const FOG_FLOOR = 0.1;

export class Zone {
  constructor(world, rand = Math.random) {
    this.world = world;
    this.rand = rand;
    this.phase = 0;
    this.t = 0;
    this.shrinking = false;
    this.x = world.W / 2;
    this.y = world.H / 2;
    this.r = ZONE_START_R * TILE;
    this.from = { x: this.x, y: this.y, r: this.r };
    this.next = this.pickNext();
  }

  get def() {
    return ZONE_PHASES[Math.min(this.phase, ZONE_PHASES.length - 1)];
  }

  get done() {
    return this.phase >= ZONE_PHASES.length;
  }

  // El próximo círculo queda adentro del actual, centrado en algo que se pisa
  pickNext() {
    const def = ZONE_PHASES[this.phase];
    if (!def) return { x: this.x, y: this.y, r: this.r };
    const r = def.r * TILE;
    const room = Math.max(0, this.r - r - TILE);
    const spot = this.world.randomSpot(this.x, this.y, room * 0.8, this.rand, true);
    return { x: spot.x, y: spot.y, r };
  }

  // Segundos hasta que empieza a achicarse (o termina de achicarse)
  get countdown() {
    const def = this.def;
    if (this.done) return 0;
    return this.shrinking ? def.shrink - this.t : def.wait - this.t;
  }

  update(dt) {
    if (this.done) return;
    const def = this.def;
    this.t += dt;
    if (!this.shrinking) {
      if (this.t >= def.wait) {
        this.shrinking = true;
        this.t = 0;
        this.from = { x: this.x, y: this.y, r: this.r };
        return 'shrink';
      }
    } else {
      const k = Math.min(1, this.t / def.shrink);
      this.x = this.from.x + (this.next.x - this.from.x) * k;
      this.y = this.from.y + (this.next.y - this.from.y) * k;
      this.r = this.from.r + (this.next.r - this.from.r) * k;
      if (k >= 1) {
        this.phase++;
        this.t = 0;
        this.shrinking = false;
        this.next = this.pickNext();
        return 'phase';
      }
    }
    return null;
  }

  // Cuánto daño hace ahora la niebla (la de la fase que corre)
  get dps() {
    return this.def.dps;
  }

  get lethal() {
    return this.def.lethal;
  }

  outside(x, y) {
    return Math.hypot(x - this.x, y - this.y) > this.r;
  }

  outsideNext(x, y, margin = 0) {
    return Math.hypot(x - this.next.x, y - this.next.y) > this.next.r - margin;
  }
}
