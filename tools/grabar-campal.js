// Graba una Batalla Campal de unos 45 s (vertical 1080x1920 y horizontal 1920x1080).
// Pikachu ("TÚ") contra Charizard, Gengar, Snorlax y Blastoise, todos manejados por
// bots. Antes de grabar se prueban varias semillas sin dibujar y se elige una
// partida linda (gana Pikachu, saca a varios, dura lo justo); después se graba
// esa misma partida cuadro a cuadro.
//
// Uso: tools/grabar-campal.html con el receptor escuchando en el 5174.
import { drawLogo } from '../src/scenes.js';
import { text, roundRect } from '../src/ui.js';
import { toBlob, renderAudio, takeOver, ribbon, endCard } from './video-comun.js';

const FPS = 30;
const RECV = 'http://127.0.0.1:5174/';
const ME = 'pikachu';
const BOTS = ['charizard', 'gengar', 'snorlax', 'blastoise'];
// Partida más corta para el video: menos vida y la niebla más rápida
const HPK = 0.45;
const pad = (n) => String(n).padStart(5, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const estado = document.getElementById('estado');
const status = (s) => (estado.textContent = s);
const frame = document.getElementById('juego');
const params = new URLSearchParams(location.search);

async function waitFor(fn, ms = 60000) {
  const t0 = performance.now();
  while (!fn()) {
    if (performance.now() - t0 > ms) throw new Error('tardó demasiado');
    await sleep(100);
  }
}

function mulberry(seed) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// El sonido y el relator usan su propio azar, así no cambian cómo sale la partida
function isolate(obj, w, rng) {
  const seen = new Set();
  for (let p = Object.getPrototypeOf(obj); p && p !== w.Object.prototype; p = Object.getPrototypeOf(p)) {
    for (const n of Object.getOwnPropertyNames(p)) {
      if (n === 'constructor' || seen.has(n)) continue;
      seen.add(n);
      const d = Object.getOwnPropertyDescriptor(p, n);
      if (typeof d.value !== 'function') continue;
      const orig = d.value;
      obj[n] = function (...a) {
        const saved = w.Math.random;
        w.Math.random = rng;
        try {
          return orig.apply(this, a);
        } finally {
          w.Math.random = saved;
        }
      };
    }
  }
}

// ------------------------------------------------------------ Composición

function background(v, G) {
  const W = v.canvas.width;
  const H = v.canvas.height;
  v.setTransform(1, 0, 0, 1, 0, 0);
  const g = v.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a0b3a');
  g.addColorStop(1, '#0a0716');
  v.fillStyle = g;
  v.fillRect(0, 0, W, H);
  v.save();
  v.filter = 'blur(30px) brightness(0.4) saturate(1.3)';
  const cw = H * (16 / 9);
  v.drawImage(G, (W - cw) / 2, 0, cw, H);
  v.restore();
}

// Lo que pasa, en grande debajo del juego
function caption(b) {
  const e = b.feed[0];
  const name = (f) => f.name;
  if (e && b.t - e.t < 2.4) {
    return { str: e.killer ? `¡${name(e.killer)} SACÓ A ${name(e.victim)}!` : `¡LA NIEBLA SACÓ A ${name(e.victim)}!`, color: e.killer === b.player ? '#ffe66b' : '#ffffff', t: b.t - e.t };
  }
  const m = b.toastMsg;
  if (m && m.t < 2.4) return { str: m.text, color: '#e2a8ff', t: m.t };
  if (b.state === 'intro') return { str: '¡5 POKÉMON, 1 PUEBLO!', color: '#ffffff', t: 1 };
  if (b.state === 'ko' || b.state === 'end') return { str: b.winner === b.player ? '¡GANÓ PIKACHU!' : `¡GANÓ ${b.winner?.name}!`, color: '#ffe66b', t: b.stateT };
  const n = b.alive().length;
  return { str: `QUEDAN ${n}`, color: '#ffffff', t: 1 };
}

// Mapa grande del pueblo con la niebla y todos los Pokémon
function bigMap(v, b, UI, x0, y0, w, t) {
  const W = b.world.W;
  const H = b.world.H;
  const h = (w * H) / W;
  const s = w / W;
  roundRect(v, x0 - 3, y0 - 3, w + 6, h + 6, 4);
  v.fillStyle = '#d58cff';
  v.fill();
  v.save();
  v.beginPath();
  v.rect(x0, y0, w, h);
  v.clip();
  v.imageSmoothingEnabled = true;
  v.drawImage(b.world.ensureFrames()[0], x0, y0, w, h);
  const z = b.zone;
  v.beginPath();
  v.rect(x0, y0, w, h);
  v.arc(x0 + z.x * s, y0 + z.y * s, Math.max(0.5, z.r * s), 0, Math.PI * 2, true);
  v.fillStyle = 'rgba(96,32,150,0.55)';
  v.fill('evenodd');
  v.lineWidth = 1.4;
  v.strokeStyle = '#ff7ad9';
  v.beginPath();
  v.arc(x0 + z.x * s, y0 + z.y * s, Math.max(0.5, z.r * s), 0, Math.PI * 2);
  v.stroke();
  if (!z.done && z.next.r > 0) {
    v.setLineDash([3, 2]);
    v.lineWidth = 0.7;
    v.strokeStyle = '#ffffff';
    v.beginPath();
    v.arc(x0 + z.next.x * s, y0 + z.next.y * s, z.next.r * s, 0, Math.PI * 2);
    v.stroke();
    v.setLineDash([]);
  }
  // Lo que se ve en el juego de arriba
  v.lineWidth = 0.8;
  v.strokeStyle = 'rgba(255,255,255,0.8)';
  v.strokeRect(x0 + b.cam.x * s, y0 + b.cam.y * s, 320 * s, 180 * s);
  const order = [...b.fighters].filter((f) => f.alive).sort((p, q) => p.y - q.y);
  for (const f of order) {
    const px = x0 + f.x * s;
    const py = y0 + f.y * s;
    v.fillStyle = 'rgba(0,0,0,0.35)';
    v.beginPath();
    v.ellipse(px, py + 1, 7, 2.6, 0, 0, Math.PI * 2);
    v.fill();
    v.lineWidth = 1.2;
    v.strokeStyle = f.color;
    v.beginPath();
    v.ellipse(px, py + 1, 8, 3, 0, 0, Math.PI * 2);
    v.stroke();
    UI.drawCreature(v, f.key, px, py - 8, 20, { t: t + f.side, faceLeft: f.facing < 0 });
    if (f === b.player) text(v, 'TÚ', px, py - 20, { size: 6, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.6 });
  }
  v.restore();
  return h;
}

function composeV(v, G, b, UI, t, endK) {
  background(v, G);
  const s = v.canvas.width / 320;
  const H = v.canvas.height / s;
  v.setTransform(s, 0, 0, s, 0, 0);
  v.imageSmoothingEnabled = true;
  drawLogo(v, 160, 34, t, 0.62);
  ribbon(v, '¡BATALLA CAMPAL!', 160, 78, 10.5, { fill: '#c2408f', ink: '#ffffff' });
  text(v, '5 Pokémon · 1 pueblo · ¡gana el último!', 160, 98, { size: 7, weight: 900, align: 'center', color: '#e2a8ff', stroke: '#1b1224', strokeW: 2 });
  const gy = 108;
  roundRect(v, -2, gy - 2, 324, 184, 3);
  v.fillStyle = '#d58cff';
  v.fill();
  v.imageSmoothingEnabled = false;
  v.drawImage(G, 0, gy, 320, 180);
  v.imageSmoothingEnabled = true;
  const c = caption(b);
  const pop = Math.min(1, c.t / 0.15);
  // El cartel final tapa este texto: se apaga para que no se transparente
  if (endK < 1) text(v, c.str, 160, 313, { size: (c.str.length > 22 ? 12 : 15) * (0.85 + pop * 0.15), weight: 900, align: 'center', color: c.color, stroke: '#1b1224', strokeW: 3.5, alpha: 1 - endK });
  const mh = bigMap(v, b, UI, 30, 330, 260, t);
  text(v, '¡Gratis en el navegador!', 160, 330 + mh + 24, { size: 10, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2.5 });
  text(v, 'pokechampions.vercel.app', 160, 330 + mh + 40, { size: 7.5, weight: 800, align: 'center', color: 'rgba(255,255,255,0.8)' });
  endCard(v, t, endK, 320, H, '¡NUEVO: BATALLA CAMPAL!');
}

function composeH(h, G, t, endK) {
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.imageSmoothingEnabled = false;
  h.drawImage(G, 0, 0, h.canvas.width, h.canvas.height);
  h.setTransform(h.canvas.width / 320, 0, 0, h.canvas.width / 320, 0, 0);
  h.imageSmoothingEnabled = true;
  endCard(h, t, endK, 320, 180, '¡NUEVO: BATALLA CAMPAL!');
}

// ------------------------------------------------------------ Partida

async function grabar() {
  status('Esperando el juego…');
  await waitFor(() => frame.contentWindow.game?.scene?.constructor.name === 'TitleScene');
  await sleep(300);
  let recT = 0;
  const J = takeOver(frame, () => recT);
  const { w, g } = J;
  const RS = await w.eval("import('/src/royale/scenes.js')");
  const Bot = await w.eval("import('/src/royale/bot.js')");
  const Z = await w.eval("import('/src/royale/zone.js')");
  const UI = await w.eval("import('/src/ui.js')");
  const { CREATURES } = await w.eval("import('/src/data.js')");
  g.announcer.mode = 'texto';
  isolate(g.audio, w, mulberry(4242));
  isolate(g.announcer, w, mulberry(777));
  for (const p of Z.ZONE_PHASES) {
    p.wait = Math.round(p.wait * 0.55);
    p.shrink = Math.round(p.shrink * 0.6);
  }

  // Arma la partida (igual para la prueba y para la grabación)
  const setup = (seed) => {
    w.Math.random = mulberry(seed);
    const players = [{ key: ME, human: true, local: true, label: CREATURES[ME].name }, ...BOTS.map((k) => ({ key: k, human: false, diff: 'normal', label: CREATURES[k].name }))];
    g.setScene(new RS.RoyaleScene(g, { key: ME, rivals: 4, difficulty: 'normal', players }));
    g.fade = 0;
    const scene = g.scene;
    scene.onBlur = () => {};
    scene.touchControlsActive = () => false;
    const b = scene.battle;
    for (const f of b.fighters) {
      f.maxHp = Math.round(f.maxHp * HPK);
      f.hp = f.ghostHp = f.maxHp;
    }
    // Pikachu sale a buscar pelea
    const c = new Bot.BotController(b, 0, 'dificil');
    const plan = c.plan.bind(c);
    c.plan = () => {
      plan();
      if (c.mode !== 'explorar') return;
      const others = b.fighters.filter((o) => o !== c.f && o.alive);
      const near = others.sort((p, q) => Math.hypot(p.x - c.f.x, p.y - c.f.y) - Math.hypot(q.x - c.f.x, q.y - c.f.y))[0];
      if (near) c.goal = { x: near.x, y: near.y };
    };
    b.controllers[0] = c;
    let picks = 0;
    const pickup = b.pickup.bind(b);
    b.pickup = (f, it) => {
      if (f === b.fighters[0]) picks++;
      return pickup(f, it);
    };
    return { scene, b, picks: () => picks };
  };

  // Prueba varias semillas sin dibujar
  const fixed = params.get('semilla');
  let best = null;
  const seeds = fixed ? [Number(fixed)] : [...Array(60).keys()].map((i) => 100 + i);
  for (const seed of seeds) {
    const { scene, b, picks } = setup(seed);
    for (let k = 0; k < 60 * 120 && b.state !== 'end'; k++) scene.update(1 / 60);
    const me = b.fighters[0];
    const r = { seed, win: b.winner === me, kos: me.kos, t: b.fightT, picks: picks() };
    const ok = r.win && r.kos >= 2 && r.t >= 26 && r.t <= 46;
    const score = (ok ? 100 : 0) + r.kos * 10 + Math.min(1, r.picks) * 6 - Math.abs(r.t - 36) * 0.5;
    if (!best || score > best.score) best = { ...r, score, ok };
    status(`Probando semillas… ${seed}: ${JSON.stringify(r)} · mejor ${best.seed}`);
    await sleep(0);
    if (best.ok && best.kos >= 3 && best.picks >= 1) break;
  }
  status(`Grabando la semilla ${best.seed}…`);

  g.audio.rec = { events: [], clock: () => recT };
  const { scene, b } = setup(best.seed);
  g.audio.rec.events.length = 0;

  const V = document.createElement('canvas');
  V.width = 1080;
  V.height = 1920;
  const Hc = document.createElement('canvas');
  Hc.width = 1920;
  Hc.height = 1080;
  document.body.append(V, Hc);
  const vctx = V.getContext('2d');
  const hctx = Hc.getContext('2d');

  let endAt = null;
  let total = 120 * FPS;
  let n = 0;
  for (; n < total; n++) {
    for (let sub = 0; sub < 2; sub++) {
      recT = n / FPS + sub / 60;
      g.tick(1 / 60);
    }
    if (endAt === null && b.state === 'end') {
      endAt = recT + 3.0;
      total = Math.min(total, Math.ceil((endAt + 2.6) * FPS));
    }
    const endK = endAt === null ? 0 : Math.max(0, Math.min(1, (recT - endAt) / 0.4));
    composeV(vctx, J.G, b, UI, recT, endK);
    composeH(hctx, J.G, recT, endK);
    await fetch(`${RECV}v${pad(n)}.jpg`, { method: 'POST', body: await toBlob(V, 0.9) });
    await fetch(`${RECV}h${pad(n)}.jpg`, { method: 'POST', body: await toBlob(Hc, 0.9) });
    status(`Cuadro ${n + 1} · ${b.state} · ${recT.toFixed(1)} s · quedan ${b.alive().length}`);
  }
  const secs = n / FPS;
  status('Armando el audio…');
  const wav = await renderAudio(g.audio.cryData, g.audio.rec.events, secs);
  await fetch(`${RECV}audio.wav`, { method: 'POST', body: wav });
  const me = b.fighters[0];
  const res = { frames: n, secs, seed: best.seed, previsto: best, salio: { win: b.winner === me, kos: me.kos, t: b.fightT }, places: b.fighters.map((f) => `${f.place}.${f.key}(${f.kos})`) };
  status(`Listo: ${JSON.stringify(res)}`);
  window.resultado = res;
  void scene;
}

grabar().catch((e) => {
  status(`Error: ${e.message}`);
  window.resultado = { error: e.message, stack: e.stack };
});
