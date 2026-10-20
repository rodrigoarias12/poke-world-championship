// La partida de la aventura: equipo, caja, Poké Balls, banderas de historia,
// niveles y experiencia, y el guardado en el navegador (con copia de respaldo).
import { CREATURES } from '../data.js';
import { MAPS } from './maps.js';

const KEY = 'arena-brava-aventura-1';
const VERSION = 1;
export const MAX_PARTY = 6;
export const MIN_BALLS = 5;

// Niveles: vida = base·(0.4+0.04·Nv), poder = base·(0.75+0.03·Nv)
// (5 niveles de diferencia ≈ 1.6 veces más fuerte)
export function levelHp(key, level) {
  return Math.max(8, Math.round(CREATURES[key].hp * (0.4 + 0.04 * level)));
}

export function levelPow(key, level) {
  return CREATURES[key].pow * (0.75 + 0.03 * level);
}

// Experiencia lineal: subir del nivel N cuesta 5·N
export const xpToNext = (level) => 5 * level;
export const xpFor = (level, mult = 1) => Math.round(3.5 * level * mult);

let nextUid = 1;

export function newMon(key, level) {
  return { uid: nextUid++, key, level, xp: 0, hp: 1 };
}

export class AdventureState {
  constructor(data = null) {
    this.data = data || AdventureState.fresh();
    nextUid = Math.max(nextUid, ...this.all().map((m) => m.uid + 1), 1);
  }

  static fresh(look = 'chico') {
    return {
      v: VERSION,
      look,
      name: look === 'chica' ? 'HOJA' : 'ROJO',
      rival: 'AZUL',
      map: 'casa',
      x: 2,
      y: 2,
      dir: 'down',
      lastHeal: { map: 'casa', x: 3, y: 5 },
      party: [],
      box: [],
      balls: 0,
      flags: {},
      trainers: {},
      penalty: {},
      caught: [],
      playTime: 0,
      savedAt: 0,
    };
  }

  get party() {
    return this.data.party;
  }

  all() {
    return [...this.data.party, ...this.data.box];
  }

  flag(k) {
    return !!this.data.flags[k];
  }

  setFlag(k, v = true) {
    this.data.flags[k] = v;
  }

  // Suma un Pokémon: al equipo si hay lugar, si no a la caja
  add(key, level, hp = 1) {
    const mon = { ...newMon(key, level), hp };
    if (this.data.party.length < MAX_PARTY) this.data.party.push(mon);
    else this.data.box.push(mon);
    if (!this.data.caught.includes(key)) this.data.caught.push(key);
    return mon;
  }

  healAll() {
    for (const m of this.data.party) m.hp = 1;
    this.data.balls = Math.max(this.data.balls, MIN_BALLS);
  }

  // Los que pueden pelear (hasta 3, en el orden del equipo)
  fighters() {
    return this.data.party.filter((m) => m.hp > 0).slice(0, 3);
  }

  alive() {
    return this.data.party.some((m) => m.hp > 0);
  }

  moveFirst(i) {
    const p = this.data.party;
    if (i <= 0 || i >= p.length) return;
    const [m] = p.splice(i, 1);
    p.unshift(m);
  }

  // Aplica el resultado de una pelea; devuelve los renglones del resumen
  applyBattle(res, { mult = 1 } = {}) {
    const lines = [];
    for (const r of res.party) {
      const m = this.data.party.find((p) => p.uid === r.uid);
      if (m) m.hp = Math.max(0, Math.min(1, r.hp));
    }
    this.data.balls = Math.max(0, this.data.balls - (res.ballsUsed || 0));
    if (res.caught) {
      const mon = this.add(res.caught.key, res.caught.level, Math.max(0.2, res.caught.hp || 0.5));
      const where = this.data.party.includes(mon) ? 'se sumó a tu equipo' : 'fue a la caja';
      lines.push(`¡Atrapaste a ${CREATURES[mon.key].name}! (${where})`);
    }
    // Experiencia para todo el equipo que sigue en pie
    let xp = 0;
    for (const d of res.defeated || []) xp += xpFor(d.level, mult);
    if (res.caught) xp += xpFor(res.caught.level, mult);
    if (xp > 0) {
      lines.push(`¡Tu equipo ganó ${xp} de experiencia!`);
      for (const m of this.data.party) {
        if (m.hp <= 0) continue;
        m.xp += xp;
        while (m.xp >= xpToNext(m.level) && m.level < 50) {
          m.xp -= xpToNext(m.level);
          m.level++;
          lines.push(`¡${CREATURES[m.key].name} subió al nivel ${m.level}!`);
        }
      }
    }
    return lines;
  }

  // ---------------------------------------------------------------- Guardado
  save() {
    this.data.savedAt = Date.now();
    try {
      const prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(`${KEY}-bak`, prev);
      localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  static load() {
    for (const k of [KEY, `${KEY}-bak`]) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const data = validate(JSON.parse(raw));
        if (data) return new AdventureState(data);
      } catch { /* partida rota: se prueba con la copia */ }
    }
    return null;
  }

  static hasSave() {
    try {
      return !!localStorage.getItem(KEY) || !!localStorage.getItem(`${KEY}-bak`);
    } catch {
      return false;
    }
  }

  static erase() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(`${KEY}-bak`);
    } catch { /* sin almacenamiento */ }
  }
}

// Revisa y arregla una partida guardada (o devuelve null si no sirve)
export function validate(d) {
  if (!d || typeof d !== 'object' || d.v !== VERSION) return null;
  const base = AdventureState.fresh(d.look);
  const data = { ...base, ...d };
  const okMon = (m) => m && CREATURES[m.key] && Number.isFinite(m.level) && m.level >= 1;
  data.party = (Array.isArray(d.party) ? d.party : []).filter(okMon).slice(0, MAX_PARTY);
  data.box = (Array.isArray(d.box) ? d.box : []).filter(okMon);
  for (const m of [...data.party, ...data.box]) {
    m.hp = Math.max(0, Math.min(1, Number(m.hp) || 0));
    m.xp = Math.max(0, Number(m.xp) || 0);
    m.uid = Number(m.uid) || 0;
  }
  // Uids únicos
  const seen = new Set();
  let n = 1;
  for (const m of [...data.party, ...data.box]) {
    while (seen.has(n)) n++;
    if (!m.uid || seen.has(m.uid)) m.uid = n;
    seen.add(m.uid);
  }
  if (!MAPS[data.map]) Object.assign(data, { map: 'casa', x: 2, y: 2 });
  if (!MAPS[data.lastHeal?.map]) data.lastHeal = base.lastHeal;
  // Si ya tenía inicial y se quedó sin equipo, se lo devolvemos
  if (data.flags?.starter && data.party.length === 0) data.party.push({ ...newMon(data.flags.starter, 5) });
  // Equipo todo debilitado: se cura (no hay castigo)
  if (data.party.length && !data.party.some((m) => m.hp > 0)) for (const m of data.party) m.hp = 1;
  data.balls = Math.max(0, Number(data.balls) || 0);
  for (const k of ['flags', 'trainers', 'penalty']) if (!data[k] || typeof data[k] !== 'object') data[k] = {};
  if (!Array.isArray(data.caught)) data.caught = [];
  return data;
}
