// Graba el video del modo EN LÍNEA: dos celulares conectados de verdad
// (PeerJS), cada uno con su pantalla. Se avanza cuadro a cuadro: el reloj de
// los dos juegos se maneja desde acá, así el video sale perfecto aunque grabar
// cada cuadro tarde más que en tiempo real.
//
// Uso: abrir tools/grabar-online.html con el receptor escuchando en el 5174.
import { drawLogo } from '../src/scenes.js';
import { text, roundRect } from '../src/ui.js';
import { toBlob, renderAudio, takeOver, ribbon, endCard } from './video-comun.js';

const FPS = 30;
const MAX_SECS = 34;
const RECV = 'http://127.0.0.1:5174/';
const pad = (n) => String(n).padStart(5, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const estado = document.getElementById('estado');
const status = (s) => (estado.textContent = s);

// Cola propia: así el video no se cruza con gente que esté jugando de verdad
const queue = `video${Math.random().toString(36).slice(2, 7)}`;
const base = `../index.html?mute&timerloop&bot&cola=${queue}`;
const fa = document.getElementById('a');
const fb = document.getElementById('b');
fa.src = `${base}&equipo=pikachu,charizard,lucario`;
fb.src = `${base}&equipo=gengar,gyarados,mewtwo`;

async function waitFor(fn, ms = 60000) {
  const t0 = performance.now();
  while (!fn()) {
    if (performance.now() - t0 > ms) throw new Error('tardó demasiado');
    await sleep(100);
  }
}

// Momentos forzados (desde que empieza la pelea) para que pase de todo en poco tiempo
function makeScript(b) {
  const kill = (side, key) => () => {
    const f = b.fighters[side];
    if (f.key !== key || !f.alive) return true;
    if (b.state !== 'fight') return false;
    f.iframes = 0;
    f.hp = 1;
    b.damage(b.fighters[1 - side], f, 30, { m: b.fighters[1 - side].moves[4] });
    return true;
  };
  const ult = (side, key) => () => {
    const f = b.fighters[side];
    if (f.key !== key) return true;
    if (b.state !== 'fight' || f.action) return false;
    f.cds[4] = 0;
    f.intent.aimX = f.opponent.x - f.x;
    f.intent.aimY = f.opponent.y - f.y;
    return f.useMove(4) !== false;
  };
  const lowHp = (side, key, k) => () => {
    const f = b.fighters[side];
    if (f.key !== key) return false;
    f.hp = Math.min(f.hp, Math.round(f.maxHp * k));
    return true;
  };
  return [
    { t: 1.4, fn: ult(0, 'pikachu') },
    { t: 3.6, fn: lowHp(1, 'gengar', 0.3) },
    { t: 4.2, fn: kill(1, 'gengar') },
    { t: 6.4, fn: ult(1, 'gyarados') },
    { t: 8.4, fn: kill(0, 'pikachu') },
    { t: 10.4, fn: lowHp(1, 'gyarados', 0.3) },
    { t: 10.6, fn: ult(0, 'charizard') },
    { t: 12.2, fn: kill(1, 'gyarados') },
    { t: 13.6, fn: lowHp(1, 'mewtwo', 0.25) },
    { t: 14.0, fn: kill(1, 'mewtwo') },
  ];
}

// ------------------------------------------------------------ Composición

function phone(v, G, x, y, w, label, color, t) {
  const h = w * (9 / 16) + 12;
  const vw = w - 12;
  const vh = vw * (9 / 16);
  v.save();
  v.shadowColor = 'rgba(0,0,0,0.55)';
  v.shadowBlur = 18;
  v.shadowOffsetY = 4;
  roundRect(v, x, y, w, h, 14);
  v.fillStyle = '#0c0b12';
  v.fill();
  v.restore();
  roundRect(v, x, y, w, h, 14);
  v.lineWidth = 1.2;
  v.strokeStyle = '#3a3850';
  v.stroke();
  // cámara
  v.fillStyle = '#23212f';
  v.beginPath();
  v.arc(x + 3.2, y + h / 2, 1.3, 0, Math.PI * 2);
  v.fill();
  v.save();
  roundRect(v, x + 6, y + 6, vw, vh, 6);
  v.clip();
  v.drawImage(G, x + 6, y + 6, vw, vh);
  v.restore();
  // etiqueta
  const lw = label.length * 4.6 + 12;
  roundRect(v, x + 10, y - 7, lw, 12, 6);
  v.fillStyle = color;
  v.fill();
  v.lineWidth = 1;
  v.strokeStyle = '#1b1224';
  v.stroke();
  text(v, label, x + 10 + lw / 2, y + 1.6, { size: 6.4, weight: 900, align: 'center', color: '#fff', stroke: '#1b1224', strokeW: 1.4 });
  return { vx: x + 6, vy: y + 6, vw, vh, h };
}

// Toque del dedo sobre el botón JUGAR EN LÍNEA
function tap(v, ph, at, t) {
  const k = (t - at + 0.25) / 0.6;
  if (k < 0 || k > 1) return;
  const x = ph.vx + (160 / 320) * ph.vw;
  const y = ph.vy + (101 / 180) * ph.vh;
  v.save();
  v.globalAlpha = 1 - k;
  v.strokeStyle = '#ffffff';
  v.lineWidth = 2;
  v.beginPath();
  v.arc(x, y, 4 + k * 16, 0, Math.PI * 2);
  v.stroke();
  v.fillStyle = 'rgba(255,255,255,0.85)';
  v.beginPath();
  v.arc(x, y, 5, 0, Math.PI * 2);
  v.fill();
  v.restore();
}

function caption(info) {
  if (info.phase === 'title') return 'Tocás JUGAR EN LÍNEA…';
  if (info.phase === 'search') return '…y el juego te busca un rival';
  if (info.phase === 'found' || info.phase === 'vs') return '¡Sin códigos ni salas!';
  if (info.phase === 'end') return '¿Revancha?';
  return info.kos > 0 ? '¿Quién ganaría? ¡Comentá!' : 'Cada uno en su celular';
}

// Paquetes que van y vienen entre los dos celulares
function link(v, x1, y1, x2, y2, t, on) {
  v.save();
  v.setLineDash([2, 3]);
  v.lineWidth = 1;
  v.strokeStyle = on ? 'rgba(120,230,255,0.7)' : 'rgba(255,255,255,0.18)';
  v.beginPath();
  v.moveTo(x1, y1);
  v.lineTo(x2, y2);
  v.stroke();
  v.setLineDash([]);
  if (on) {
    for (let i = 0; i < 4; i++) {
      const k = (t * 1.6 + i / 4) % 1;
      const kk = i % 2 ? 1 - k : k;
      v.fillStyle = i % 2 ? '#ffb43b' : '#7df9ff';
      v.beginPath();
      v.arc(x1 + (x2 - x1) * kk, y1 + (y2 - y1) * kk, 1.6, 0, Math.PI * 2);
      v.fill();
    }
  }
  v.restore();
}

function background(v, GA, GB, vertical) {
  const W = v.canvas.width;
  const Hc = v.canvas.height;
  v.setTransform(1, 0, 0, 1, 0, 0);
  const g = v.createLinearGradient(0, 0, 0, Hc);
  g.addColorStop(0, '#1d2c63');
  g.addColorStop(1, '#0a0f26');
  v.fillStyle = g;
  v.fillRect(0, 0, W, Hc);
  v.save();
  v.filter = 'blur(30px) brightness(0.38) saturate(1.25)';
  if (vertical) {
    const cw = (Hc / 2) * (16 / 9);
    v.drawImage(GA, (W - cw) / 2, 0, cw, Hc / 2);
    v.drawImage(GB, (W - cw) / 2, Hc / 2, cw, Hc / 2);
  } else {
    v.drawImage(GA, -W * 0.25, 0, W, Hc);
    v.drawImage(GB, W * 0.25, 0, W, Hc);
  }
  v.restore();
}

function composeV(v, GA, GB, t, info) {
  background(v, GA, GB, true);
  const s = v.canvas.width / 320;
  const H = v.canvas.height / s;
  v.setTransform(s, 0, 0, s, 0, 0);
  v.imageSmoothingEnabled = true;
  drawLogo(v, 160, 48, t, 0.9);
  ribbon(v, '¡AHORA EN LÍNEA!', 160, 100, 10);
  const cap = caption(info);
  text(v, cap, 160, 132, { size: cap.length > 24 ? 10 : 11.5, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 3 });
  const p1 = phone(v, GA, 12, 150, 296, 'JUGADOR 1', '#ff8a3d', t);
  const y2 = 150 + p1.h + 28;
  link(v, 160, 150 + p1.h + 2, 160, y2 - 8, t, info.connected);
  if (info.connected) {
    roundRect(v, 132, 150 + p1.h + 8, 56, 11, 5.5);
    v.fillStyle = '#2e9e8f';
    v.fill();
    text(v, 'EN LÍNEA', 160, 150 + p1.h + 15.8, { size: 5.6, weight: 900, align: 'center' });
  }
  const p2 = phone(v, GB, 12, y2, 296, 'JUGADOR 2', '#3fa7ff', t);
  tap(v, p1, info.tapA, t);
  tap(v, p2, info.tapB, t);
  text(v, 'pokechampions.vercel.app', 160, H - 12, { size: 7, weight: 800, align: 'center', color: 'rgba(255,255,255,0.75)' });
  endCard(v, t, info.endK, 320, H);
}

function composeH(v, GA, GB, t, info) {
  background(v, GA, GB, false);
  const s = v.canvas.width / 320;
  v.setTransform(s, 0, 0, s, 0, 0);
  v.imageSmoothingEnabled = true;
  drawLogo(v, 160, 21, t, 0.4);
  const cap = caption(info);
  text(v, cap, 160, 46, { size: 7.5, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
  const p1 = phone(v, GA, 6, 60, 150, 'JUGADOR 1', '#ff8a3d', t);
  const p2 = phone(v, GB, 164, 60, 150, 'JUGADOR 2', '#3fa7ff', t);
  link(v, 157, 60 + p1.h / 2, 163, 60 + p1.h / 2, t, info.connected);
  tap(v, p1, info.tapA, t);
  tap(v, p2, info.tapB, t);
  ribbon(v, '¡AHORA EN LÍNEA!', 160, 162, 6);
  text(v, 'pokechampions.vercel.app', 160, 176, { size: 4.4, weight: 800, align: 'center', color: 'rgba(255,255,255,0.75)' });
  endCard(v, t, info.endK, 320, 180);
}

// ------------------------------------------------------------ Grabación

async function grabar() {
  status('Esperando que carguen los dos celulares…');
  await waitFor(() => [fa, fb].every((f) => f.contentWindow.game?.scene?.constructor.name === 'TitleScene'));
  await sleep(500);
  let recT = 0;
  const clock = () => recT;
  const A = takeOver(fa, clock);
  const B = takeOver(fb, clock);
  await sleep(100);
  const { AI } = await A.w.eval("import('/src/ai.js')");
  A.g.audio.rec = { events: [], clock };
  B.g.audio.rec = { events: [], clock };

  const V = document.createElement('canvas');
  V.width = 1080;
  V.height = 1920;
  const H = document.createElement('canvas');
  H.width = 1920;
  H.height = 1080;
  document.body.append(V, H);
  const vctx = V.getContext('2d');
  const hctx = H.getContext('2d');

  const info = { phase: 'title', tapA: 0.6, tapB: 1.4, connected: false, kos: 0, endK: 0 };
  let tappedA = false;
  let tappedB = false;
  let host = null;
  let F = null;
  let script = null;
  let endAt = null;
  let total = MAX_SECS * FPS;
  let frame = 0;
  for (; frame < total; frame++) {
    for (let sub = 0; sub < 2; sub++) {
      recT = frame / FPS + sub / 60;
      if (!tappedA && recT >= info.tapA) {
        tappedA = true;
        A.g.scene.menu.activate(0);
      }
      if (!tappedB && recT >= info.tapB) {
        tappedB = true;
        B.g.scene.menu.activate(0);
      }
      const sa = A.g.scene;
      const sb = B.g.scene;
      if (!host && sa.constructor.name === 'OnlineBattleScene') {
        if (!sa.session.isHost) throw new Error('El celular 1 no quedó de anfitrión');
        host = sa.battle;
        const ai = new AI(host, 0, 'dificil');
        ai.p = { ...ai.p, ultDelay: 999 };
        host.setController(0, { side: 0, isAI: false, update: (dt) => ai.update(dt) });
      }
      if (sb.botAI && !sb.botAI.tuned) {
        sb.botAI.tuned = true;
        sb.botAI.p = { ...sb.botAI.p, ultDelay: 999, dodge: 0.15 };
      }
      if (host && F === null && host.state === 'fight') {
        F = recT;
        script = makeScript(host);
      }
      if (script) for (const beat of script) if (!beat.done && recT >= F + beat.t) beat.done = beat.fn();
      A.g.tick(1 / 60);
      B.g.tick(1 / 60);
    }
    // En qué parte va (para los carteles del video)
    const sa = A.g.scene;
    info.connected = !!A.g.session && !A.g.session.closed;
    if (sa.constructor.name === 'OnlineScene') info.phase = sa.mode === 'search' ? (tappedA ? 'search' : 'title') : sa.mode;
    else if (sa.constructor.name === 'OnlineBattleScene') {
      info.phase = sa.result ? 'end' : 'fight';
      info.kos = host ? host.teams[0].fainted.length + host.teams[1].fainted.length : 0;
      if (sa.result && endAt === null) {
        endAt = recT + 1.6;
        total = Math.min(total, Math.ceil((endAt + 2.2) * FPS));
      }
    }
    info.endK = endAt === null ? 0 : Math.max(0, Math.min(1, (recT - endAt) / 0.4));
    composeV(vctx, A.G, B.G, recT, info);
    composeH(hctx, A.G, B.G, recT, info);
    await fetch(`${RECV}v${pad(frame)}.jpg`, { method: 'POST', body: await toBlob(V, 0.9) });
    await fetch(`${RECV}h${pad(frame)}.jpg`, { method: 'POST', body: await toBlob(H, 0.9) });
    status(`Cuadro ${frame + 1} · ${info.phase} · ${recT.toFixed(1)} s`);
  }
  const secs = frame / FPS;
  status('Armando el audio…');
  // Sonidos del anfitrión (toda la pelea) + el toque del celular 2
  const events = [...A.g.audio.rec.events, ...B.g.audio.rec.events.filter((e) => e.m === 'play' && e.a[0] === 'confirm' && e.t < 4)];
  events.sort((x, y) => x.t - y.t);
  const wav = await renderAudio(A.g.audio.cryData, events, secs);
  await fetch(`${RECV}audio.wav`, { method: 'POST', body: wav });
  const res = { frames: frame, secs, winner: host?.winner?.side, fightStart: F, end: endAt };
  status(`Listo: ${JSON.stringify(res)}`);
  window.resultado = res;
  return res;
}

window.grabacion = grabar().catch((e) => {
  status(`Error: ${e.message}`);
  window.resultado = { error: e.message };
});
