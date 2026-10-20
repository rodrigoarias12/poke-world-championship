// Pruebas del Modo Aventura sin pantalla (Node):
//   node tools/aventura.mjs
// a) mapas: filas, caracteres, puertas, salidas, alcance y cornisas sin trampa
// b) peleas: 200 salvajes a igual nivel (ella gana casi siempre), mareado + Poké Ball = captura,
//    entrenadores rechazan la Poké Ball, equipo debilitado pierde
// c) experiencia de una pasada por la Ruta 1
// d) guardado: ida y vuelta, copia de respaldo, basura, almacenamiento que falla

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
const store = new Map();
let storageBroken = false;
globalThis.localStorage = {
  getItem: (k) => {
    if (storageBroken) throw new Error('sin almacenamiento');
    return store.has(k) ? store.get(k) : null;
  },
  setItem: (k, v) => {
    if (storageBroken) throw new Error('sin almacenamiento');
    store.set(k, String(v));
  },
  removeItem: (k) => store.delete(k),
};
globalThis.location = { search: '' };
globalThis.alert = noop;

const root = new URL('../src/', import.meta.url).href;
const { MAPS, parseMap } = await import(root + 'adventure/maps.js');
const { walkable, prerenderMap } = await import(root + 'adventure/tiles.js');
const { AdventureState, validate, levelHp } = await import(root + 'adventure/state.js');
const { AdventureBattle } = await import(root + 'adventure/battle.js');
const { AI } = await import(root + 'ai.js');

let fails = 0;
const fail = (msg) => {
  fails++;
  console.log('  ✗', msg);
};
const ok = (msg) => console.log('  ✓', msg);

// ---------------------------------------------------------------- a) Mapas
console.log('a) Mapas');
const KNOWN_EXT = new Set([...'.,=;~fTYFLSRUKHOgWDCMG']);
const KNOWN_INT = new Set([...'#.=BPVbtophm']);
for (const id of Object.keys(MAPS)) {
  let map;
  try {
    map = parseMap(id);
    prerenderMap(map);
  } catch (e) {
    fail(`${id}: ${e.message}`);
    continue;
  }
  const known = map.interior ? KNOWN_INT : KNOWN_EXT;
  map.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!known.has(ch)) fail(`${id}: carácter desconocido "${ch}" en ${x},${y}`);
  }));
  const at = (x, y) => map.rows[y]?.[x];
  const solidNpc = new Set(map.people.map((p) => `${p.x},${p.y}`));
  const free = (x, y) => at(x, y) && walkable(map, at(x, y)) && !solidNpc.has(`${x},${y}`);
  // Puertas y salidas: destino válido y pisable
  for (const d of map.doors || []) {
    if (at(d.x, d.y) !== 'D') fail(`${id}: puerta en ${d.x},${d.y} no está sobre una D`);
    if (d.closed) continue;
    const dest = parseMap(d.to);
    if (!walkable(dest, dest.rows[d.ty]?.[d.tx])) fail(`${id}: la puerta lleva a ${d.to} ${d.tx},${d.ty} que no se puede pisar`);
  }
  if (map.exit) {
    const dest = parseMap(map.exit.to);
    if (!walkable(dest, dest.rows[map.exit.y]?.[map.exit.x])) fail(`${id}: la salida cae en ${map.exit.to} ${map.exit.x},${map.exit.y} que no se puede pisar`);
    if (!map.rows.some((r) => r.includes('m'))) fail(`${id}: no tiene alfombra de salida`);
  }
  for (const [k, e] of Object.entries(map.edges || {})) {
    if (e.blocked) continue;
    const dest = parseMap(e.to);
    const row = k === 'n' ? 0 : map.h - 1;
    const cols = [...map.rows[row]].map((c, x) => (walkable(map, c) ? x : -1)).filter((x) => x >= 0);
    for (const x of cols) {
      const dy = k === 'n' ? dest.h - 2 : 1;
      if (!walkable(dest, dest.rows[dy]?.[x + (e.dx || 0)])) fail(`${id}: salida ${k} en x=${x} cae en ${e.to} ${x + (e.dx || 0)},${dy} que no se puede pisar`);
    }
  }
  // Alcance desde un punto de entrada (con cornisas que solo se bajan)
  let start = null;
  if (map.exit) start = [map.rows.findIndex((r) => r.includes('m')) - 1, 0];
  const startPos = (() => {
    if (map.interior) {
      const y = map.rows.findIndex((r) => r.includes('m'));
      return [map.rows[y].indexOf('m'), y];
    }
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (free(x, y) && (y === 0 || y === map.h - 1)) return [x, y];
    return null;
  })();
  start = startPos;
  const nbrs = (x, y) => {
    const out = [];
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const c = at(nx, ny);
      if (c === 'L' && dy === 1 && free(nx, ny + 1)) out.push([nx, ny + 1]);
      else if (c !== 'D' && free(nx, ny)) out.push([nx, ny]);
    }
    return out;
  };
  const bfs = (sx, sy) => {
    const seen = new Set([`${sx},${sy}`]);
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [nx, ny] of nbrs(x, y)) {
        const k = `${nx},${ny}`;
        if (!seen.has(k)) {
          seen.add(k);
          q.push([nx, ny]);
        }
      }
    }
    return seen;
  };
  const R = bfs(...start);
  const near = (x, y) => [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => R.has(`${x + dx},${y + dy}`));
  for (const d of map.doors || []) if (!near(d.x, d.y)) fail(`${id}: no se llega a la puerta ${d.x},${d.y}`);
  for (const s of map.signs || []) if (!near(s.x, s.y)) fail(`${id}: no se llega al cartel ${s.x},${s.y}`);
  for (const p of map.people) {
    const across = map.interior && [[0, 2], [0, -2]].some(([dx, dy]) => R.has(`${p.x + dx},${p.y + dy}`));
    if (!near(p.x, p.y) && !across) fail(`${id}: no se llega a la persona ${p.n} en ${p.x},${p.y}`);
  }
  for (const b of map.balls || []) if (!near(b.x, b.y)) fail(`${id}: no se llega a la Poké Ball ${b.x},${b.y}`);
  // Sin trampas: desde todo lo alcanzable se puede volver al inicio
  let traps = 0;
  for (const k of R) {
    const [x, y] = k.split(',').map(Number);
    if (!bfs(x, y).has(`${start[0]},${start[1]}`)) traps++;
  }
  if (traps) fail(`${id}: ${traps} casillas donde las cornisas te dejan atrapado`);
  // Visión de entrenadores libre al menos 1 casilla
  for (const p of map.people.filter((q) => q.trainer)) if (!free(p.x, p.y + 1)) fail(`${id}: el entrenador ${p.trainer.id} no ve nada`);
  ok(`${id} (${map.w}x${map.h}) · alcanzables ${R.size}`);
}

// ---------------------------------------------------------------- b) Peleas
console.log('b) Peleas');
const game = {
  audio: new Proxy({}, { get: () => noop }),
  input: { moveVector: () => [0, 0], isDown: () => false, wasPressed: () => false, touchMode: false },
};

// La IA "normal" hace de jugadora: en el juego los ataques apuntan solos, así que apunta parecido a una persona
function fight({ mine, foe, kind = 'wild', ai = 'normal', onDizzy = null, seed = 1, balls = 10 }) {
  const members0 = mine.map(([key, level, hp = 1], i) => ({ uid: i + 1, key, level, hp }));
  const members1 = foe.map(([key, level]) => ({ key, level, hp: 1 }));
  const b = new AdventureBattle(game, {
    teamA: members0.map((m) => m.key), teamB: members1.map((m) => m.key), bossLast: false,
    difficulty: kind === 'wild' ? 'salvaje' : 'entrenador', arena: 'ruta', round: 'PRUEBA', seed,
    adv: { kind, members: [members0, members1], balls },
  });
  const her = new AI(b, 0, ai);
  b.setController(0, { side: 0, isAI: false, update: (dt) => her.update(dt) });
  let k = 0;
  for (; k < 60 * 120 && b.state !== 'end'; k++) {
    if (onDizzy && b.fighters[1].dizzy > 0 && !b.catchFx) onDizzy(b);
    b.update(1 / 60);
  }
  return { b, res: b.result(), secs: k / 60 };
}

const POOL = ['eevee', 'jigglypuff', 'pikachu', 'psyduck'];
const STARTERS = ['charmander', 'squirtle', 'bulbasaur'];
let wins = 0;
let errors = 0;
const times = [];
for (let i = 0; i < 200; i++) {
  try {
    const lv = 3 + (i % 5);
    const { res, secs } = fight({ mine: [[STARTERS[i % 3], lv]], foe: [[POOL[i % 4], lv]], seed: i + 1 });
    if (res.outcome === 'win') wins++;
    times.push(secs);
  } catch (e) {
    errors++;
    if (errors < 3) console.log(e.stack.split('\n').slice(0, 3).join(' | '));
  }
}
times.sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];
console.log(`  salvajes a igual nivel: ganó ${wins}/200 · mediana ${median.toFixed(1)} s · máx ${times.at(-1).toFixed(1)} s · errores ${errors}`);
if (errors) fail('hubo errores en peleas');
if (wins < 170) fail('ella debería ganar al menos 85% a igual nivel');
if (times.at(-1) >= 120) fail('alguna pelea no terminó');

// Mareado + Poké Ball = captura segura
let caught = 0;
for (let i = 0; i < 30; i++) {
  const { res } = fight({ mine: [['charmander', 8]], foe: [['eevee', 3]], seed: 100 + i, onDizzy: (b) => b.throwBall() });
  if (res.outcome === 'caught' && res.caught?.key === 'eevee') caught++;
}
if (caught === 30) ok('mareado + Poké Ball atrapa 30/30');
else fail(`mareado + Poké Ball atrapó ${caught}/30`);

// Sin tirar la Poké Ball: se debilita y ganás igual
{
  const { res } = fight({ mine: [['charmander', 8]], foe: [['eevee', 3]], seed: 7 });
  if (res.outcome === 'win' && res.defeated.length === 1) ok('sin Poké Ball el mareado se debilita y ganás');
  else fail(`sin Poké Ball: ${res.outcome}`);
}

// Entrenadores: la Poké Ball no sirve
{
  const { b, res } = fight({ mine: [['charmander', 8]], foe: [['eevee', 3]], kind: 'trainer', seed: 9, onDizzy: (bb) => bb.throwBall() });
  if (!res.caught && b.ballsUsed === 0) ok('a los Pokémon de entrenadores no se los puede atrapar');
  else fail(`entrenador: ${res.outcome} caught=${!!res.caught} balls=${b.ballsUsed}`);
}

// Equipo debilitado pierde y la vida queda en 0
{
  const { res } = fight({ mine: [['pikachu', 2, 0.2]], foe: [['onix', 12]], kind: 'trainer', seed: 11 });
  if (res.outcome === 'lose' && res.party.every((p) => p.hp === 0)) ok('con todo el equipo debilitado se pierde');
  else fail(`derrota: ${res.outcome} ${JSON.stringify(res.party)}`);
}

// La vida sigue entre peleas
{
  const { b } = fight({ mine: [['squirtle', 6, 0.5]], foe: [['eevee', 2]], seed: 13 });
  const f = b.fighters[0];
  if (b.teams[0].fainted.length === 0 && f.maxHp === levelHp('squirtle', 6)) ok(`la vida empieza donde quedó (máx ${f.maxHp})`);
  else fail('la vida no se aplicó');
}

// ---------------------------------------------------------------- c) Experiencia
console.log('c) Experiencia');
{
  store.clear();
  const st = new AdventureState(AdventureState.fresh('chico'));
  st.add('charmander', 5);
  st.data.balls = 10;
  for (let i = 0; i < 9; i++) {
    const foe = [POOL[i % 4], 3 + (i % 3)];
    const mon = st.party[0];
    const { res } = fight({ mine: [[mon.key, mon.level, mon.hp]], foe: [foe], seed: 300 + i });
    res.party = res.party.map((p) => ({ ...p, uid: mon.uid }));
    st.applyBattle(res);
    st.healAll();
  }
  const lv = st.party[0].level;
  console.log(`  después de 9 salvajes en la Ruta 1: Nv ${lv}`);
  if (lv < 7 || lv > 10) fail('la experiencia de la Ruta 1 debería dejar cerca del Nv 8');
}

// ---------------------------------------------------------------- d) Guardado
console.log('d) Guardado');
{
  store.clear();
  const st = new AdventureState(AdventureState.fresh('chica'));
  st.add('bulbasaur', 6);
  st.setFlag('starter', 'bulbasaur');
  st.data.balls = 7;
  st.save();
  const back = AdventureState.load();
  if (back && back.data.party[0].key === 'bulbasaur' && back.data.balls === 7 && back.data.look === 'chica') ok('guardar y cargar devuelve lo mismo');
  else fail('guardar y cargar');
  // Partida principal rota: se usa la copia
  st.data.balls = 9;
  st.save();
  store.set('arena-brava-aventura-1', '{esto no es json');
  const fromBak = AdventureState.load();
  if (fromBak && fromBak.data.balls === 7) ok('si la partida se rompe, se usa la copia de respaldo');
  else fail('copia de respaldo');
  // Basura total
  store.set('arena-brava-aventura-1', 'basura');
  store.set('arena-brava-aventura-1-bak', '[]');
  if (AdventureState.load() === null) ok('con basura se empieza de cero');
  else fail('basura');
  // Almacenamiento que falla
  storageBroken = true;
  let crashed = false;
  try {
    st.save();
    AdventureState.load();
    AdventureState.hasSave();
  } catch {
    crashed = true;
  }
  storageBroken = false;
  if (!crashed) ok('si el navegador no deja guardar, el juego sigue');
  else fail('el almacenamiento roto tiró error');
  // Validación: especie desconocida, mapa desconocido, equipo todo debilitado
  const fixed = validate({ ...AdventureState.fresh(), party: [{ key: 'missingno', level: 3, hp: 1 }, { key: 'pikachu', level: 4, hp: 0 }], map: 'nada', flags: { starter: 'pikachu' } });
  if (fixed.party.length === 1 && fixed.party[0].hp === 1 && fixed.map === 'casa') ok('la partida se arregla al cargar');
  else fail(`validación: ${JSON.stringify(fixed.party)} ${fixed.map}`);
}

console.log(fails ? `\n${fails} problema(s)` : '\nTodo bien');
process.exit(fails ? 1 : 0);
