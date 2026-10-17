// Graba un video de 30 s de una pelea, cuadro a cuadro, en vertical (1080x1920,
// para TikTok/Reels/Shorts) y en horizontal (1920x1080). El audio se genera aparte
// con los mismos sonidos del juego. Los cuadros se mandan a un receptor local.
import { BattleScene, drawLogo } from '../src/scenes.js';
import { AI } from '../src/ai.js';
import { Sfx } from '../src/audio.js';
import { MOVES } from '../src/data.js';
import { text, roundRect } from '../src/ui.js';

const FPS = 30;
const RECV = 'http://127.0.0.1:5174/';
const pad = (n) => String(n).padStart(5, '0');

function toBlob(canvas, quality) {
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
}

function wavBlob(buf) {
  const ch = buf.numberOfChannels;
  const len = buf.length * ch * 2;
  const view = new DataView(new ArrayBuffer(44 + len));
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + len, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, ch, true);
  view.setUint32(24, buf.sampleRate, true);
  view.setUint32(28, buf.sampleRate * ch * 2, true);
  view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, len, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      view.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

async function renderAudio(audio, events, secs) {
  const sr = 44100;
  const off = new OfflineAudioContext(2, sr * secs, sr);
  const a = new Sfx();
  a.silent = false;
  a.sfxOn = true;
  a.musicOn = false;
  a.init(off);
  for (const [id, data] of audio.cryData) {
    try {
      a.cryBuf.set(id, await off.decodeAudioData(data.slice(0)));
    } catch { /* grito que no se pudo decodificar */ }
  }
  for (const e of events) {
    if (e.t >= secs) continue;
    a.offset = e.t;
    try {
      a[e.m](...e.a);
    } catch { /* sonido que no aplica sin pantalla */ }
  }
  return wavBlob(await off.startRendering());
}

// Momentos forzados para que en 30 s pase de todo
function makeScript(b) {
  const kill = (side, key) => () => {
    const f = b.fighters[side];
    if (f.key !== key || !f.alive) return true;
    if (b.state !== 'fight') return false;
    f.iframes = 0;
    f.hp = 1;
    b.damage(b.fighters[1 - side], f, 30, { m: side === 1 ? MOVES.llamarada : MOVES.hiperrayo });
    return true;
  };
  const ult = (side, key) => () => {
    const f = b.fighters[side];
    if (f.key !== key || b.state !== 'fight') return false;
    f.cds[4] = 0;
    f.intent.aimX = f.opponent.x - f.x;
    f.intent.aimY = f.opponent.y - f.y;
    return f.useMove(4);
  };
  const lowHp = (side, key, k) => () => {
    const f = b.fighters[side];
    if (f.key !== key) return false;
    f.hp = Math.min(f.hp, Math.round(f.maxHp * k));
    return true;
  };
  return [
    { t: 4.6, fn: lowHp(1, 'gengar', 0.35) },
    { t: 4.9, fn: ult(0, 'charizard') },
    { t: 7.6, fn: kill(1, 'gengar') },
    { t: 10.8, fn: lowHp(1, 'snorlax', 0.3) },
    { t: 12.2, fn: kill(1, 'snorlax') },
    { t: 16.3, fn: lowHp(0, 'charizard', 0.3) },
    { t: 16.6, fn: ult(1, 'gyarados') },
    { t: 19.4, fn: kill(0, 'charizard') },
    { t: 22.2, fn: lowHp(1, 'gyarados', 0.2) },
    { t: 22.4, fn: ult(0, 'lapras') },
    { t: 25.2, fn: kill(1, 'gyarados') },
  ];
}

function compose(v, G, b, t, logoT) {
  const s = v.canvas.width / 320;
  const H = v.canvas.height / s;
  v.setTransform(1, 0, 0, 1, 0, 0);
  v.fillStyle = '#0b1530';
  v.fillRect(0, 0, v.canvas.width, v.canvas.height);
  // Fondo: la misma pelea, agrandada y borrosa
  v.save();
  v.filter = 'blur(28px) brightness(0.42) saturate(1.2)';
  const cw = v.canvas.height * (16 / 9);
  v.drawImage(G, (v.canvas.width - cw) / 2, 0, cw, v.canvas.height);
  v.restore();
  v.setTransform(s, 0, 0, s, 0, 0);
  v.imageSmoothingEnabled = true;
  drawLogo(v, 160, 64, logoT, 1.12);
  const vs = `${b.player.name}  vs  ${b.enemy.name}`;
  text(v, b.round || 'COMBATE', 160, 124, { size: 11, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2.5 });
  text(v, vs, 160, 142, { size: vs.length > 26 ? 8.5 : 10, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2.4 });
  // La pelea
  const gy = 168;
  roundRect(v, -2, gy - 2, 324, 184, 3);
  v.fillStyle = '#ffffff';
  v.fill();
  v.drawImage(G, 0, gy, 320, 180);
  // Comentario del relator en grande
  const line = b.relator && b.relator.t < 2.6 ? b.relator.text : null;
  if (line) {
    const words = line.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (test.length > 24 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    lines.push(cur);
    const pop = Math.min(1, b.relator.t / 0.15);
    lines.forEach((l, i) => {
      text(v, l, 160, 392 + i * 20 - (lines.length - 1) * 10, { size: 15 * (0.85 + pop * 0.15), weight: 900, align: 'center', color: '#fff4c0', stroke: '#1b1224', strokeW: 3.5 });
    });
  }
  text(v, '¿Quién ganaría? ¡Comentá!', 160, H - 46, { size: 11, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2.5 });
  text(v, 'POKÉ WORLD CHAMPIONSHIP', 160, H - 28, { size: 6, weight: 800, align: 'center', color: 'rgba(255,255,255,0.7)' });
}

export async function grabar(game, { seconds = 30, frames = null, onProgress } = {}) {
  const total = frames ?? seconds * FPS;
  const G = document.createElement('canvas');
  G.width = 1920;
  G.height = 1080;
  const V = document.createElement('canvas');
  V.width = 1080;
  V.height = 1920;
  const vctx = V.getContext('2d');
  const saved = { canvas: game.canvas, ctx: game.ctx, scale: game.scale, resize: game.resize };
  game.canvas = G;
  game.ctx = G.getContext('2d');
  game.scale = 6;
  game.resize = () => {};
  let recT = 0;
  game.audio.rec = { events: [], clock: () => recT };
  const prevMode = game.announcer.mode;
  game.announcer.mode = 'texto';
  game.input.touchMode = false;

  game.setScene(new BattleScene(game, {
    mode: 'libre', teamA: ['charizard', 'lapras', 'pikachu'], teamB: ['gengar', 'snorlax', 'gyarados'],
    bossLast: true, difficulty: 'normal', arena: 'piscina', round: 'GRAN FINAL',
  }));
  game.fade = 0;
  const scene = game.scene;
  scene.onBlur = () => {};
  const b = scene.battle;
  // El jugador también lo maneja la IA; los definitivos los dispara el guion
  const aiP = new AI(b, 0, 'dificil');
  aiP.p = { ...aiP.p, ultDelay: 999 };
  b.ai.p = { ...b.ai.p, ultDelay: 999, dodge: 0.15 };
  b.playerIntent = () => aiP.update(1 / 60);
  const script = makeScript(b);

  try {
    for (let frame = 0; frame < total; frame++) {
      for (let sub = 0; sub < 2; sub++) {
        recT = frame / FPS + sub / 60;
        for (const beat of script) if (!beat.done && recT >= beat.t) beat.done = beat.fn();
        scene.paused = false;
        game.tick(1 / 60);
      }
      compose(vctx, G, b, recT, recT);
      await fetch(`${RECV}v${pad(frame)}.jpg`, { method: 'POST', body: await toBlob(V, 0.9) });
      await fetch(`${RECV}h${pad(frame)}.jpg`, { method: 'POST', body: await toBlob(G, 0.9) });
      onProgress?.(frame + 1, total);
    }
    const wav = await renderAudio(game.audio, game.audio.rec.events, total / FPS);
    await fetch(`${RECV}audio.wav`, { method: 'POST', body: wav });
  } finally {
    game.audio.rec = null;
    game.announcer.mode = prevMode;
    Object.assign(game, saved);
    game.resize();
  }
  return { frames: total, state: b.state, winner: b.winner?.side };
}
