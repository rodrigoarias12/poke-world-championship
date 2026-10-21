// Corre batallas campales sin pantalla (Node), con azar con semilla, para
// encontrar errores y medir cómo salen las partidas.
//
//   node tools/royale-sim.mjs            -> 40 partidas y un resumen
//   node tools/royale-sim.mjs 100 -v     -> 100 partidas, una línea por partida
//
// El jugador 0 es "la persona" (lo maneja un bot, pero cuenta como humano para
// la regla de la ficha y el daño suave de los bots).

const N = Number(process.argv[2] || 40);
const VERBOSE = process.argv.includes('-v');
const noop = () => {};
const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 2.5 });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (k === 'createPattern') return () => null;
    if (k in t) return t[k];
    return noop;
  },
  set(t, k, v) {
    t[k] = v;
    return true;
  },
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx }) };
globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = { getItem: () => null, setItem: noop };
globalThis.location = { search: '' };
globalThis.Image = class { set src(v) { this._s = v; } };

let seed = 1;
Math.random = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const root = new URL('../src/', import.meta.url).href;
const { RoyaleBattle, FEET } = await import(root + 'royale/battle.js');
const { BotController } = await import(root + 'royale/bot.js');
const { ROSTER, CREATURES } = await import(root + 'data.js');

const anyAudio = new Proxy({}, { get: () => noop });
const game = {
  audio: anyAudio,
  announcer: { say: noop },
  input: { moveVector: () => [0, 0], isDown: () => false, wasPressed: () => false, touchMode: false },
};

function players(i) {
  const order = [...ROSTER].filter((k) => k !== 'mewtwo').sort((a, b) => a.localeCompare(b));
  const keys = [0, 1, 2, 3, 4].map((k) => order[(i * 7 + k * 5) % order.length]);
  const diff = ['facil', 'normal', 'dificil'][i % 3];
  return keys.map((key, k) => ({ key, human: k === 0, local: k === 0, diff, label: CREATURES[key].name }));
}

const lines = [];
const stats = { wins: {}, plays: {}, fogKO: 0, ko: 0, times: [], problems: [], gang: 0, humanPlace: [] };
for (let i = 0; i < N; i++) {
  seed = 5000 + i;
  const ps = players(i);
  const b = new RoyaleBattle(game, { players: ps, difficulty: ps[1].diff, seed: i + 1 });
  // "La persona" la maneja un bot
  b.controllers[0] = new BotController(b, 0, 'normal');
  let k = 0;
  let bad = '';
  for (; k < 60 * 300 && b.state !== 'end'; k++) {
    b.update(1 / 60);
    if (k % 6 === 0) b.render(fakeCtx);
    for (const f of b.fighters) {
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.hp)) bad ||= `NaN ${f.key}`;
      if (f.alive && f.lift <= 20 && b.world.feetBlocked(f.x, f.y, FEET) && !b.world.isWater(f.x, f.y)) bad ||= `adentro ${f.key} ${Math.round(f.x)},${Math.round(f.y)}`;
    }
    // Regla de la ficha: nunca dos bots a la vez sobre la persona (salvo con 3 o menos)
    const h = b.fighters[0];
    if (h.alive && b.state === 'fight') {
      const on = b.fighters.filter((f, s) => s > 0 && f.alive && b.controllers[s].mode === 'pelear' && b.controllers[s].foe === h).length;
      const max = b.alive().length <= 3 ? 2 : 1;
      if (on > max) stats.gang++;
    }
  }
  if (b.state !== 'end') bad ||= 'no terminó';
  const winners = b.fighters.filter((f) => f.place === 1);
  if (winners.length !== 1) bad ||= `ganadores=${winners.length}`;
  const secs = b.fightT;
  stats.times.push(secs);
  for (const f of b.fighters) {
    stats.plays[f.key] = (stats.plays[f.key] || 0) + 1;
    if (f.place === 1) stats.wins[f.key] = (stats.wins[f.key] || 0) + 1;
  }
  for (const e of b.feed) {
    stats.ko++;
    if (!e.killer) stats.fogKO++;
  }
  stats.humanPlace.push(b.fighters[0].place);
  if (bad) stats.problems.push(`${i}: ${bad}`);
  const order = [...b.fighters].sort((p, q) => p.place - q.place).map((f) => `${f.place}.${f.key}(${f.kos})`).join(' ');
  lines.push(`${i} ${ps[1].diff} t=${secs.toFixed(1)} ${order}${bad ? ` !! ${bad}` : ''}`);
}

if (VERBOSE) console.log(lines.join('\n'));
const times = [...stats.times].sort((a, b) => a - b);
const med = times[Math.floor(times.length / 2)];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const rate = Object.keys(stats.plays).map((k) => [k, (stats.wins[k] || 0) / stats.plays[k]]).sort((a, b) => b[1] - a[1]);
const avg = 1 / 5;
console.log(`partidas=${N} problemas=${stats.problems.length} duración: mín ${fmt(times[0])} mediana ${fmt(med)} máx ${fmt(times[times.length - 1])}`);
console.log(`KO=${stats.ko} por niebla=${stats.fogKO} (${Math.round((100 * stats.fogKO) / Math.max(1, stats.ko))}%)  pandilla sobre la persona=${stats.gang} ticks`);
console.log(`la persona (bot normal) quedó en promedio ${(stats.humanPlace.reduce((a, b) => a + b, 0) / N).toFixed(2)}º  ganó ${stats.humanPlace.filter((p) => p === 1).length}/${N}`);
console.log(`más ganadores: ${rate.slice(0, 5).map(([k, r]) => `${k} ${Math.round(r * 100)}%`).join(', ')}  (promedio ${Math.round(avg * 100)}%)`);
if (stats.problems.length) console.log(stats.problems.slice(0, 10).join('\n'));
