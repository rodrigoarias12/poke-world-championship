// Pruebas de la batalla campal (Node): ataques con varios rivales, choques con
// el mapa, niebla, sueño, créditos de K.O. y que nada pause el juego.
//
//   node tools/royale-unit.mjs

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

let seed = 7;
Math.random = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const root = new URL('../src/', import.meta.url).href;
const { RoyaleBattle, FEET } = await import(root + 'royale/battle.js');
const { MOVES } = await import(root + 'data.js');
const { spawnProjectile, startMove } = await import(root + 'moves.js');
const { ZONE_PHASES } = await import(root + 'royale/zone.js');
const { TILE } = await import(root + 'adventure/tiles.js');

const anyAudio = new Proxy({}, { get: () => noop });
const game = { audio: anyAudio, announcer: { say: noop }, input: { moveVector: () => [0, 0], isDown: () => false, wasPressed: () => false } };

let fails = 0;
let passes = 0;
function check(name, ok, info = '') {
  if (ok) passes++;
  else fails++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok ? '' : `  ${info}`}`);
}

// Una pelea lista: 5 Pokémon quietos (sin cerebro) en lugares elegidos
function arena(keys = ['pikachu', 'eevee', 'eevee', 'eevee', 'eevee'], spots = null) {
  seed = 7;
  const players = keys.map((key, i) => ({ key, human: i === 0, local: i === 0, diff: 'normal' }));
  const b = new RoyaleBattle(game, { players, difficulty: 'normal', seed: 1 });
  b.controllers = b.controllers.map(() => ({ isAI: false, update: noop }));
  b.state = 'fight';
  b.stateT = 5;
  b.zone.update = () => null;
  b.items = [];
  b.itemT = 1e9;
  for (const f of b.fighters) {
    f.iframes = 0;
    f.forced = null;
  }
  // Plaza abierta en el medio del mapa (baldosas 6..33 x 9..12 se pisan)
  const base = spots || [[200, 150], [240, 150], [280, 150], [320, 150], [360, 150]];
  b.fighters.forEach((f, i) => {
    [f.x, f.y] = base[i];
    f.vx = f.vy = f.kx = f.ky = 0;
  });
  return b;
}

function step(b, secs) {
  for (let t = 0; t < secs; t += 1 / 60) {
    b.update(1 / 60);
    b.render(fakeCtx);
  }
}

function freeze(b) {
  // Que nadie se mueva por empujones para medir golpes
  for (const f of b.fighters) f.speed = f.baseSpeed = 0;
}

console.log('Ataques con varios rivales');
{
  const b = arena();
  freeze(b);
  const [p] = b.fighters;
  const hp0 = b.fighters.map((f) => f.hp);
  spawnProjectile(b, p, MOVES.impactrueno, 1, 0);
  step(b, 1.2);
  const hit = b.fighters.slice(1).filter((f, i) => f.hp < hp0[i + 1]);
  check('un proyectil le pega solo al primero que toca', hit.length === 1 && hit[0] === b.fighters[1], hit.map((f) => f.side).join(','));
}
{
  const b = arena(undefined, [[260, 150], [230, 150], [290, 150], [260, 180], [500, 150]]);
  freeze(b);
  const p = b.fighters[0];
  const hp0 = b.fighters.map((f) => f.hp);
  p.intent.aimX = 1;
  p.intent.aimY = 0;
  startMove(p, b, MOVES.ultimoRecurso);
  const dmg = [];
  const orig = b.damage.bind(b);
  b.damage = (att, def, base, o) => {
    const before = def.hp;
    const r = orig(att, def, base, o);
    dmg.push({ side: def.side, d: before - def.hp });
    return r;
  };
  step(b, 1.5);
  const sides = dmg.map((d) => d.side);
  const near = [1, 2, 3].every((s) => b.fighters[s].hp < hp0[s]);
  check('el anillo le pega a todos los de alrededor', near, sides.join(','));
  check('el anillo no le pega al que está lejos', b.fighters[4].hp === hp0[4]);
  const perRing = new Set();
  let dup = false;
  // Cada onda (son varias) pega una sola vez a cada uno: como mucho 3 golpes por rival
  for (const s of [1, 2, 3]) if (sides.filter((x) => x === s).length > (MOVES.ultimoRecurso.count || 3)) dup = true;
  check('cada onda pega una sola vez a cada uno', !dup, sides.join(','));
  void perRing;
}
{
  // Segundo golpeado de la misma onda pega ×0.7
  const b = arena(['snorlax', 'eevee', 'eevee', 'eevee', 'eevee'], [[260, 150], [235, 150], [285, 150], [500, 300], [520, 300]]);
  freeze(b);
  const p = b.fighters[0];
  b.fighters[1].defn = b.fighters[2].defn = 1;
  const seen = [];
  const orig = b.damage.bind(b);
  b.damage = (att, def, base, o) => {
    seen.push({ side: def.side, k: b.splitK, base });
    return orig(att, def, base, o);
  };
  b.hazards.push({ kind: 'quake', m: MOVES.terremoto, owner: p, x: p.x, y: p.y, r: 4, speed: 150, maxR: 80, width: 8, dmg: 20, kb: 90, stun: 0, hit: false, colors: ['#fff', '#fff', '#fff', '#fff', '#fff'] });
  step(b, 0.8);
  check('terremoto: el segundo golpeado recibe ×0.7', seen.length === 2 && seen[0].k === 1 && Math.abs(seen[1].k - 0.7) < 1e-9, JSON.stringify(seen));
}
{
  // Rayo: les pega a todos los que están en la línea
  const b = arena(['starmie', 'eevee', 'eevee', 'eevee', 'eevee'], [[150, 150], [190, 150], [230, 150], [270, 150], [150, 300]]);
  freeze(b);
  const p = b.fighters[0];
  const hp0 = b.fighters.map((f) => f.hp);
  p.intent.aimX = 1;
  p.intent.aimY = 0;
  p.target = b.fighters[1];
  startMove(p, b, MOVES.hidrobomba);
  step(b, 0.6);
  const hit = [1, 2, 3].filter((s) => b.fighters[s].hp < hp0[s]);
  check('el rayo les pega a todos los que están en la línea', hit.length === 3, hit.join(','));
  check('el rayo no le pega al que está fuera de la línea', b.fighters[4].hp === hp0[4]);
}
{
  // Rayo contra un árbol: la línea se corta (árbol en la baldosa 10,16)
  const b = arena();
  const len = b.rayLength(9 * TILE + 8, 16 * TILE + 8, 0, 400);
  check('el rayo se corta en el árbol', len < 2 * TILE, String(len));
  const open = b.rayLength(20 * TILE, 9.5 * TILE, 0, 400);
  check('el rayo llega como mucho a 9 baldosas', open <= 144 && open > 100, String(open));
}
{
  // Golpe cuerpo a cuerpo: a todos los que están al alcance, una vez
  const b = arena(['machamp', 'eevee', 'eevee', 'eevee', 'eevee'], [[260, 150], [278, 150], [276, 160], [400, 150], [420, 150]]);
  freeze(b);
  const p = b.fighters[0];
  const hits = [];
  const orig = b.damage.bind(b);
  b.damage = (att, def, base, o) => {
    hits.push(def.side);
    return orig(att, def, base, o);
  };
  p.intent.aimX = 1;
  p.intent.aimY = 0;
  startMove(p, b, MOVES.golpeKarate);
  step(b, 0.5);
  check('el golpe le pega a los dos que están cerca, una vez cada uno', hits.length === 2 && hits.includes(1) && hits.includes(2), hits.join(','));
}
{
  // Explosión: al que le pegó de lleno no le vuelve a pegar
  const b = arena(['charmander', 'eevee', 'eevee', 'eevee', 'eevee'], [[200, 150], [250, 150], [262, 156], [400, 150], [420, 150]]);
  freeze(b);
  const p = b.fighters[0];
  const hits = [];
  const orig = b.damage.bind(b);
  b.damage = (att, def, base, o) => {
    hits.push(def.side);
    return orig(att, def, base, o);
  };
  spawnProjectile(b, p, MOVES.llamarada, 1, 0);
  step(b, 1);
  check('la explosión no le pega dos veces al golpeado de lleno', hits.filter((s) => s === 1).length === 1 && hits.includes(2), hits.join(','));
}

console.log('Mapa');
{
  // Disparo por encima de una cerca (F) y del agua (~); el árbol lo frena
  const b = arena();
  const w = b.world;
  check('las cercas y el agua no frenan los disparos', !w.blocksShot(15 * TILE + 8, 10 * TILE + 8) && !w.blocksShot(5 * TILE + 8, 20 * TILE + 8));
  check('las cercas y el agua no se pisan', !w.canWalk(15 * TILE + 8, 10 * TILE + 8) && !w.canWalk(5 * TILE + 8, 20 * TILE + 8));
  check('los árboles frenan los disparos', w.blocksShot(10 * TILE + 8, 16 * TILE + 8));
  const b2 = arena(['pikachu', 'eevee', 'eevee', 'eevee', 'eevee'], [[9 * TILE + 8, 16 * TILE + 8], [12 * TILE + 8, 16 * TILE + 8], [400, 300], [420, 300], [440, 300]]);
  freeze(b2);
  const hp = b2.fighters[1].hp;
  spawnProjectile(b2, b2.fighters[0], MOVES.impactrueno, 1, 0);
  step(b2, 1);
  check('un proyectil no atraviesa un árbol', b2.fighters[1].hp === hp && b2.projectiles.length === 0);
}
{
  // Movimientos al azar: nunca terminan adentro de algo sólido
  const b = arena();
  let bad = 0;
  const rnd = (() => {
    let s = 99;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  for (let i = 0; i < 10000; i++) {
    const f = b.fighters[i % 5];
    const ox = f.x;
    const oy = f.y;
    f.x += (rnd() - 0.5) * 2 * 30;
    f.y += (rnd() - 0.5) * 2 * 30;
    f.lift = 0;
    b.confine(f, ox, oy);
    if (b.world.feetBlocked(f.x, f.y, FEET)) bad++;
  }
  check('10.000 movimientos al azar nunca quedan adentro de algo', bad === 0, `${bad} adentro`);
  let tele = 0;
  for (let i = 0; i < 2000; i++) {
    const f = b.fighters[0];
    const [x, y] = b.clampSpot(f, rnd() * b.world.W, rnd() * b.world.H);
    if (b.world.feetBlocked(x, y, FEET)) tele++;
  }
  check('teletransporte y saltos caen siempre en lugar pisable', tele === 0, `${tele} adentro`);
}
{
  // Vuelo: aterriza sobre un árbol -> se corre a un lugar libre
  const b = arena();
  const f = b.fighters[0];
  f.x = 20 * TILE;
  f.y = 9.5 * TILE;
  f.lift = 0;
  b.confine(f, f.x, f.y);
  f.lift = 160;
  const ox = f.x;
  const oy = f.y;
  f.x = 10 * TILE + 8;
  f.y = 16 * TILE + 8;
  b.confine(f, ox, oy);
  f.lift = 0;
  b.confine(f, f.x, f.y);
  check('al bajar de un vuelo sobre un árbol, se corre', !b.world.feetBlocked(f.x, f.y, FEET));
}

console.log('Reglas');
{
  // Sueño: 1 segundo como mucho y después 4 segundos sin dormirse
  const b = arena();
  const [att, def] = b.fighters;
  b.damage(att, def, 5, { m: MOVES.canto, sleep: true, stun: 3 });
  check('dormir dura 1 segundo como mucho', def.sleep <= 1 + 1e-9, String(def.sleep));
  def.sleep = 0;
  def.stun = 0;
  def.iframes = 0;
  b.damage(att, def, 5, { m: MOVES.canto, sleep: true, stun: 3 });
  check('no se vuelve a dormir enseguida', def.sleep === 0, String(def.sleep));
}
{
  // Niebla en las primeras fases: no elimina (deja en 10%)
  const b = arena();
  const f = b.fighters[1];
  b.zone.r = 10;
  b.zone.x = 10;
  b.zone.y = 10;
  f.hp = f.maxHp * 0.15;
  step(b, 12);
  check('la niebla de las primeras fases deja en 10%', f.alive && Math.abs(f.hp - f.maxHp * 0.1) < 1, `${f.hp.toFixed(1)} / ${f.maxHp}`);
  check('la niebla es más suave al principio', ZONE_PHASES[0].dps < ZONE_PHASES[4].dps && !ZONE_PHASES[0].lethal && !ZONE_PHASES[1].lethal && ZONE_PHASES[2].lethal);
}
{
  // Crédito del K.O.: al último que le pegó
  const b = arena();
  const [p, v] = b.fighters;
  v.hp = 1;
  b.damage(p, v, 50, { m: MOVES.impactrueno, noCrit: true });
  check('el K.O. cuenta para el que le pegó', !v.alive && p.kos === 1 && b.feed[0].killer === p);
  check('queda en el puesto correcto', v.place === 5);
  // Niebla sin golpes recientes: el K.O. es de la niebla
  const w = b.fighters[2];
  w.lastHitBy = null;
  w.hp = 1;
  b.zone.r = 10;
  b.zone.x = 10;
  b.zone.y = 10;
  b.zone.phase = 3;
  step(b, 1.5);
  check('si nadie le pegó, el K.O. es de la niebla', !w.alive && b.feed[0].killer === null && b.feed[0].victim === w);
}
{
  // Ataque definitivo y golpes: el juego nunca se detiene
  const b = arena();
  const p = b.fighters[0];
  const v = b.fighters[4];
  v.speed = v.baseSpeed = 100;
  b.controllers[4] = { isAI: true, update: () => Object.assign(v.intent, { mx: -1, my: 0, use: -1 }) };
  const x0 = v.x;
  p.intent.aimX = 1;
  p.intent.aimY = 0;
  p.useMove(4);
  b.damage(p, b.fighters[1], 30, { m: MOVES.impactrueno });
  step(b, 0.3);
  check('el definitivo y los golpes no pausan a los demás', v.x < x0 - 10 && !b.cutin && b.hitstop === 0, `${x0} -> ${v.x}`);
}
{
  // Ficha: dos bots no atacan a la persona a la vez
  const b = arena();
  const human = b.fighters[0];
  const ok1 = b.mayAttack(b.fighters[1], human);
  b.fighters[1].forced = human;
  const ok2 = b.mayAttack(b.fighters[2], human);
  check('un solo bot por vez sobre la persona', ok1 && !ok2);
  // Con tres o menos, hasta dos
  b.fighters[3].alive = false;
  b.fighters[4].alive = false;
  const ok3 = b.mayAttack(b.fighters[2], human);
  check('con 3 vivos, pueden ser dos', ok3);
}

console.log(`\n${fails ? `✗ ${fails} fallaron, ` : ''}${passes} bien`);
process.exit(fails ? 1 : 0);
