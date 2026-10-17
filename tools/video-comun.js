// Funciones comunes de los grabadores de video (cuadro a cuadro, audio aparte)
import { drawLogo } from '../src/scenes.js';
import { Sfx } from '../src/audio.js';
import { text } from '../src/ui.js';

// JPEG del cuadro. toDataURL es sincrónico: toBlob a veces queda frenado (hasta 1 s)
// cuando el navegador considera que la página está en segundo plano.
export function toBlob(canvas, quality) {
  const url = canvas.toDataURL('image/jpeg', quality);
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return Promise.resolve(new Blob([bytes], { type: 'image/jpeg' }));
}

export function wavBlob(buf) {
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

export async function renderAudio(cryData, events, secs) {
  const sr = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
  const a = new Sfx();
  a.silent = false;
  a.sfxOn = true;
  a.musicOn = false;
  a.init(off);
  for (const [id, data] of cryData) {
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

// Toma el control de un celular: sin bucle propio, reloj manejado desde acá,
// pantalla grande para que el video salga nítido
export function takeOver(frame, clock) {
  const w = frame.contentWindow;
  const g = w.game;
  g.next = () => {};
  const t0 = w.performance.now();
  w.performance.now = () => t0 + clock() * 1000;
  const G = w.document.createElement('canvas');
  G.width = 1920;
  G.height = 1080;
  g.canvas = G;
  g.ctx = G.getContext('2d');
  g.scale = 6;
  g.resize = () => {};
  g.input.touchMode = true;
  g.fade = 0;
  return { w, g, G };
}

export function ribbon(v, str, x, y, size, { fill = '#ffe66b', ink = '#1b1224' } = {}) {
  const w = str.length * size * 0.62 + size * 2;
  v.save();
  v.translate(x, y);
  v.rotate(-0.04);
  v.fillStyle = fill;
  v.beginPath();
  v.moveTo(-w / 2 - size * 0.5, -size * 0.9);
  v.lineTo(w / 2 + size * 0.5, -size * 0.9);
  v.lineTo(w / 2, size * 0.75);
  v.lineTo(-w / 2, size * 0.75);
  v.closePath();
  v.fill();
  v.lineWidth = 1.4;
  v.strokeStyle = '#1b1224';
  v.stroke();
  text(v, str, 0, size * 0.36, { size, weight: 900, align: 'center', color: ink });
  v.restore();
}

export function endCard(v, t, k, W, H, title = '¡JUGÁ EN LÍNEA GRATIS!') {
  if (k <= 0) return;
  v.fillStyle = `rgba(10,8,24,${0.78 * k})`;
  v.fillRect(0, 0, W, H);
  v.save();
  v.globalAlpha = k;
  drawLogo(v, W / 2, H / 2 - 30, t, 1);
  text(v, title, W / 2, H / 2 + 22, { size: 12, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
  text(v, 'pokechampions.vercel.app', W / 2, H / 2 + 40, { size: 9, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2.4 });
  v.restore();
}

