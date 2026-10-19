// Formato de los mensajes entre los dos celulares.
// El anfitrión manda "fotos" (snapshots) de la pelea; el invitado manda sus botones.
import { MOVES } from '../data.js';
import { Fighter } from '../fighter.js';

// Si cambia el formato, se sube este número y los celulares avisan que hay que actualizar
export const PROTO = 1;

const MOVE_KEY = new Map(Object.entries(MOVES).map(([k, m]) => [m, k]));

// Campos que no viajan: referencias internas, datos fijos o cosas que el invitado recalcula
const SKIP = new Set(['battle', 'def', 'pending', 'intent', 'stats', 'moves', 'baseDs', 'baseTall', 'baseR']);

// Convierte cualquier valor del juego en algo que se puede mandar como JSON
export function pack(v) {
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'function') return undefined;
  if (Array.isArray(v)) return v.map(pack);
  if (v instanceof Fighter) return { $f: v.side };
  if (MOVE_KEY.has(v)) return { $m: MOVE_KEY.get(v) };
  if (t === 'object') {
    const o = {};
    for (const k of Object.keys(v)) {
      if (SKIP.has(k)) continue;
      const pv = pack(v[k]);
      if (pv !== undefined) o[k] = pv;
    }
    return o;
  }
  return undefined;
}

// Los campos de un objeto (para mandar un Pokémon completo y no solo su referencia)
export function packFields(o) {
  const out = {};
  for (const k of Object.keys(o)) {
    if (SKIP.has(k)) continue;
    const pv = pack(o[k]);
    if (pv !== undefined) out[k] = pv;
  }
  return out;
}

// Lo inverso: vuelve a armar referencias a los Pokémon y ataques del invitado
export function unpack(v, battle) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => unpack(x, battle));
  if ('$f' in v) return battle.fighters[v.$f];
  if ('$m' in v) return MOVES[v.$m];
  const o = {};
  for (const k of Object.keys(v)) o[k] = unpack(v[k], battle);
  return o;
}

// Foto completa de la pelea (la arma el anfitrión unas 30 veces por segundo)
export function snapshot(b, events) {
  // Cada proyectil y peligro lleva un número, así el invitado los mueve suave
  for (const list of [b.projectiles, b.hazards]) {
    for (const o of list) if (!o.id) o.id = b.netId = (b.netId || 0) + 1;
  }
  return {
    t: 's',
    ht: Math.round(b.t * 1000) / 1000,
    st: b.state,
    stT: pack(b.stateT),
    hs: b.hitstop > 0 ? 1 : 0,
    ts: pack(b.timeScale),
    dk: pack(b.darken),
    zm: pack(b.zoom || 0),
    sh: pack(b.shakeAmt),
    fl: b.flashFx && b.flashFx.a > 0 ? pack(b.flashFx) : null,
    ut: b.ultTint ? pack(b.ultTint) : null,
    ci: b.cutin ? { s: b.cutin.f.side, m: MOVE_KEY.get(b.cutin.m), t: pack(b.cutin.t), d: b.cutin.dur, g: b.cutin.gname, gf: b.cutin.gform } : null,
    gx: pack(b.gx),
    gf: b.gmaxFx ? { s: b.gmaxFx.f.side, t: pack(b.gmaxFx.t), d: b.gmaxFx.dur } : null,
    sw: b.switching ? pack(b.switching) : null,
    tm: b.teams.map((t) => [t.idx, t.fainted.slice()]),
    w: b.winner ? b.winner.side : null,
    f: b.fighters.map((f) => packFields(f)),
    p: b.projectiles.map((p) => pack(p)),
    h: b.hazards.map((h) => pack(h)),
    ss: pack(b.sideStats),
    ev: events,
  };
}
