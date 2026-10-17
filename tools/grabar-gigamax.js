// Graba un duelo Gigamax de unos 30 s (vertical 1080x1920 y horizontal 1920x1080).
// Los dos Pokémon los maneja la IA; el guion fuerza los momentos clave: cada uno
// se vuelve gigante, usa su ataque Gigamax y al final uno cae.
//
// Uso: tools/grabar-gigamax.html?duelo=0 con el receptor escuchando en el 5174.
import { drawLogo } from '../src/scenes.js';
import { CREATURES } from '../src/data.js';
import { text, roundRect } from '../src/ui.js';
import { toBlob, renderAudio, takeOver, ribbon, endCard } from './video-comun.js';

// El que gana va a la izquierda (lado del jugador): así al final dice ¡VICTORIA!
const DUELOS = [
  { a: 'blastoise', b: 'charizard', arena: 'lago', first: 1, winner: 0 },
  { a: 'pikachu', b: 'gengar', arena: 'noche', first: 1, winner: 0 },
  { a: 'snorlax', b: 'lapras', arena: 'piscina', first: 0, winner: 0 },
  { a: 'eevee', b: 'venusaur', arena: 'lago', first: 1, winner: 0 },
];

const FPS = 30;
const MAX_SECS = 34;
const RECV = 'http://127.0.0.1:5174/';
const pad = (n) => String(n).padStart(5, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const estado = document.getElementById('estado');
const status = (s) => (estado.textContent = s);
const params = new URLSearchParams(location.search);
const duelo = DUELOS[Number(params.get('duelo')) || 0];
const frame = document.getElementById('juego');

async function waitFor(fn, ms = 60000) {
  const t0 = performance.now();
  while (!fn()) {
    if (performance.now() - t0 > ms) throw new Error('tardó demasiado');
    await sleep(100);
  }
}

// Momentos forzados, en segundos desde que empieza la pelea
function makeScript(b, d) {
  const loser = 1 - d.winner;
  const second = 1 - d.first;
  const gmax = (side) => () => {
    b.gx[side].m = 100;
    return b.tryGmax(side) || b.fighters[side].gmax > 0;
  };
  const ult = (side) => () => {
    const f = b.fighters[side];
    if (!f.alive) return true;
    if (b.state !== 'fight' || b.cutin || b.gmaxFx || f.action) return false;
    f.cds[4] = 0;
    f.intent.aimX = f.opponent.x - f.x;
    f.intent.aimY = f.opponent.y - f.y;
    return f.useMove(4) !== false;
  };
  const hp = (side, k) => () => {
    const f = b.fighters[side];
    f.hp = Math.min(f.hp, Math.round(f.maxHp * k));
    return true;
  };
  // Hasta el golpe final nadie se debilita (queda con un poquito de vida)
  const faint = b.faint.bind(b);
  let allowKO = false;
  b.faint = (f) => {
    if (allowKO) return faint(f);
    f.hp = Math.max(1, Math.round(f.maxHp * 0.08));
  };
  const kill = (side) => () => {
    const f = b.fighters[side];
    if (!f.alive) return true;
    if (b.state !== 'fight' || b.cutin || b.gmaxFx) return false;
    allowKO = true;
    f.iframes = 0;
    f.hp = 1;
    b.damage(f.opponent, f, 30, { m: f.opponent.moves[4] });
    return true;
  };
  return [
    { t: 2.6, fn: gmax(d.first) },
    { t: 5.4, fn: ult(d.first) },
    { t: 8.0, fn: gmax(second) },
    { t: 10.8, fn: ult(second) },
    { t: 11.6, fn: hp(d.first, 0.6) },
    { t: 12.4, fn: hp(second, 0.62) },
    { t: 14.2, fn: ult(d.winner) },
    { t: 16.2, fn: hp(d.winner, 0.42) },
    { t: 16.6, fn: ult(loser) },
    { t: 18.2, fn: hp(loser, 0.2) },
    { t: 18.6, fn: ult(d.winner) },
    { t: 19.8, fn: kill(loser) },
  ];
}

// ------------------------------------------------------------ Composición

function background(v, G) {
  const W = v.canvas.width;
  const H = v.canvas.height;
  v.setTransform(1, 0, 0, 1, 0, 0);
  const g = v.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a0a1e');
  g.addColorStop(1, '#0a0716');
  v.fillStyle = g;
  v.fillRect(0, 0, W, H);
  v.save();
  v.filter = 'blur(30px) brightness(0.42) saturate(1.3)';
  const cw = H * (16 / 9);
  v.drawImage(G, (W - cw) / 2, 0, cw, H);
  v.restore();
}

function relatorLines(b, maxLen) {
  const line = b.relator && b.relator.t < 2.6 ? b.relator.text : null;
  if (!line) return null;
  const lines = [];
  let cur = '';
  for (const w of line.split(' ')) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  lines.push(cur);
  return lines;
}

function composeV(v, G, b, t, d, endK) {
  background(v, G);
  const s = v.canvas.width / 320;
  const H = v.canvas.height / s;
  v.setTransform(s, 0, 0, s, 0, 0);
  v.imageSmoothingEnabled = true;
  drawLogo(v, 160, 46, t, 0.86);
  ribbon(v, '¡BATALLA GIGAMAX!', 160, 98, 10.5, { fill: '#ff2d55', ink: '#ffffff' });
  const vs = `${CREATURES[d.a].name}  vs  ${CREATURES[d.b].name}`;
  text(v, vs, 160, 128, { size: vs.length > 24 ? 10 : 12, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 3 });
  const gy = 146;
  roundRect(v, -2, gy - 2, 324, 184, 3);
  v.fillStyle = '#ff6b8a';
  v.fill();
  v.imageSmoothingEnabled = false;
  v.drawImage(G, 0, gy, 320, 180);
  v.imageSmoothingEnabled = true;
  const lines = relatorLines(b, 24);
  if (lines) {
    const pop = Math.min(1, b.relator.t / 0.15);
    lines.forEach((l, i) => {
      text(v, l, 160, 372 + i * 20 - (lines.length - 1) * 10, { size: 15 * (0.85 + pop * 0.15), weight: 900, align: 'center', color: '#fff4c0', stroke: '#1b1224', strokeW: 3.5 });
    });
  }
  text(v, '¿Quién ganaría? ¡Comentá!', 160, H - 46, { size: 11, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2.5 });
  text(v, 'pokechampions.vercel.app', 160, H - 26, { size: 7, weight: 800, align: 'center', color: 'rgba(255,255,255,0.75)' });
  endCard(v, t, endK, 320, H, '¡AHORA CON GIGAMAX!');
}

function composeH(h, G, t, endK) {
  h.setTransform(1, 0, 0, 1, 0, 0);
  h.imageSmoothingEnabled = false;
  h.drawImage(G, 0, 0, h.canvas.width, h.canvas.height);
  h.setTransform(h.canvas.width / 320, 0, 0, h.canvas.width / 320, 0, 0);
  h.imageSmoothingEnabled = true;
  endCard(h, t, endK, 320, 180, '¡AHORA CON GIGAMAX!');
}

// ------------------------------------------------------------ Grabación

async function grabar() {
  status('Esperando el juego y las formas Gigamax…');
  await waitFor(() => frame.contentWindow.game?.scene?.constructor.name === 'TitleScene');
  const spr = await frame.contentWindow.eval("import('/src/sprites.js')");
  await waitFor(() => spr.hasGmaxSprite(duelo.a) && spr.hasGmaxSprite(duelo.b));
  await sleep(300);
  let recT = 0;
  const J = takeOver(frame, () => recT);
  J.g.input.touchMode = false;
  await sleep(100);
  const scenes = await J.w.eval("import('/src/scenes.js')");
  const { AI } = await J.w.eval("import('/src/ai.js')");
  J.g.audio.rec = { events: [], clock: () => recT };
  J.g.announcer.mode = 'texto';

  J.g.setScene(new scenes.BattleScene(J.g, {
    mode: 'libre', teamA: [duelo.a], teamB: [duelo.b], bossLast: false,
    difficulty: 'normal', arena: duelo.arena, round: 'BATALLA GIGAMAX',
  }));
  J.g.fade = 0;
  const scene = J.g.scene;
  scene.onBlur = () => {};
  const b = scene.battle;
  // Los dos los maneja la IA; el Gigamax y los ataques Gigamax los dispara el guion
  const aiA = new AI(b, 0, 'dificil');
  aiA.p = { ...aiA.p, ultDelay: 999, noGmax: true };
  b.setController(0, { side: 0, isAI: false, update: (dt) => aiA.update(dt) });
  const aiB = b.controllers[1].ai;
  aiB.p = { ...aiB.p, ultDelay: 999, noGmax: true, dodge: 0.2 };

  const V = document.createElement('canvas');
  V.width = 1080;
  V.height = 1920;
  const H = document.createElement('canvas');
  H.width = 1920;
  H.height = 1080;
  document.body.append(V, H);
  const vctx = V.getContext('2d');
  const hctx = H.getContext('2d');

  let F = null;
  let script = null;
  let endAt = null;
  let total = MAX_SECS * FPS;
  let n = 0;
  for (; n < total; n++) {
    for (let sub = 0; sub < 2; sub++) {
      recT = n / FPS + sub / 60;
      if (F === null && b.state === 'fight') {
        F = recT;
        script = makeScript(b, duelo);
      }
      if (script) for (const beat of script) if (!beat.done && recT >= F + beat.t) beat.done = beat.fn();
      scene.paused = false;
      J.g.tick(1 / 60);
    }
    if (endAt === null && b.state === 'end') {
      endAt = recT + 1.4;
      total = Math.min(total, Math.ceil((endAt + 2.4) * FPS));
    }
    const endK = endAt === null ? 0 : Math.max(0, Math.min(1, (recT - endAt) / 0.4));
    composeV(vctx, J.G, b, recT, duelo, endK);
    composeH(hctx, J.G, recT, endK);
    await fetch(`${RECV}v${pad(n)}.jpg`, { method: 'POST', body: await toBlob(V, 0.9) });
    await fetch(`${RECV}h${pad(n)}.jpg`, { method: 'POST', body: await toBlob(H, 0.9) });
    status(`Cuadro ${n + 1} · ${b.state} · ${recT.toFixed(1)} s`);
  }
  const secs = n / FPS;
  status('Armando el audio…');
  const wav = await renderAudio(J.g.audio.cryData, J.g.audio.rec.events, secs);
  await fetch(`${RECV}audio.wav`, { method: 'POST', body: wav });
  const res = { frames: n, secs, winner: b.winner?.side, fightStart: F, end: endAt, gmax: b.gx.map((g) => g.used) };
  status(`Listo: ${JSON.stringify(res)}`);
  window.resultado = res;
}

grabar().catch((e) => {
  status(`Error: ${e.message}`);
  window.resultado = { error: e.message };
});
