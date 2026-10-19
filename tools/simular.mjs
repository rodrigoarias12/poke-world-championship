// Corre peleas IA contra IA sin pantalla (Node) para detectar errores y
// comparar el comportamiento antes y después de un cambio ("golden master").
//
//   node tools/simular.mjs              -> imprime un resumen por pelea
//   node tools/simular.mjs > antes.txt  -> guarda la referencia
//
// Usa números al azar con semilla y un paso de tiempo fijo, así el resultado
// es idéntico mientras la lógica del juego no cambie.

const N = Number(process.argv[2] || 60);
const noop = () => {};
const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 2.5 });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
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

// Azar con semilla (mulberry32)
let seed = 1;
Math.random = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const root = new URL('../src/', import.meta.url).href;
const { Battle } = await import(root + 'battle.js');
const { AI } = await import(root + 'ai.js');
const { ROSTER, ARENAS } = await import(root + 'data.js');

const anyAudio = new Proxy({}, { get: () => noop });
const game = {
  audio: anyAudio,
  input: { moveVector: () => [0, 0], isDown: () => false, wasPressed: () => false, touchMode: false },
};

const lines = [];
for (let i = 0; i < N; i++) {
  seed = 1000 + i;
  const order = [...ROSTER].sort((a, b) => a.localeCompare(b));
  // Paso 9: recorre todo el plantel (9 no comparte divisores con 16 ni con 28)
  const pick = (k) => order[(i * 9 + k * 5) % order.length];
  const cfg = {
    teamA: [pick(0), pick(1), pick(2)],
    teamB: [pick(3), pick(4), pick(5)],
    bossLast: i % 3 === 0,
    difficulty: ['facil', 'normal', 'dificil', 'jefe'][i % 4],
    arena: ARENAS[i % 3],
    round: 'PRUEBA',
    seed: i + 1,
    // GMAX=0 apaga el Gigamax (para comparar con la base de antes)
    gmax: process.env.GMAX !== '0',
  };
  const b = new Battle(game, cfg);
  // Las dos IA pelean entre sí
  const aiP = new AI(b, 0, 'dificil');
  if (b.setController) b.setController(0, { side: 0, isAI: false, update: () => aiP.update(1 / 60) });
  else b.playerIntent = () => aiP.update(1 / 60);
  let k = 0;
  for (; k < 60 * 300 && b.state !== 'end'; k++) {
    b.update(1 / 60);
    if (k % 4 === 0) b.render(fakeCtx);
  }
  const hp = b.fighters.map((f) => `${f.key}:${Math.round(f.hp)}`).join(',');
  lines.push(`${i} ${cfg.teamA.join('+')} vs ${cfg.teamB.join('+')} -> ${b.state} ganador=${b.winner?.side ?? '-'} ticks=${k} hp=${hp} ko=${b.teams.map((t) => t.fainted.length).join('/')}${b.gmaxOn ? ` gmax=${b.gx.map((g) => (g.used ? 1 : 0)).join('/')}` : ''}`);
}
console.log(lines.join('\n'));
