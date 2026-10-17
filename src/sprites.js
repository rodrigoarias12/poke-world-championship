// Sprites de Pokémon desde el proyecto libre PokeAPI/sprites (GitHub).
// Primero intenta los GIF animados de Showdown (se decodifican cuadro a cuadro);
// si el navegador no puede, usa la imagen fija de Pokémon Negro/Blanco;
// sin internet, usa los dibujos procedurales de art.js.
import { creatureSprite } from './art.js';
import { CREATURES } from './data.js';

const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
const MAX_FRAMES = 40;

const store = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function silhouette(src, color) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function bbox(ctx, w, h, box) {
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < box.x0) box.x0 = x;
        if (x > box.x1) box.x1 = x;
        if (y < box.y0) box.y0 = y;
        if (y > box.y1) box.y1 = y;
      }
    }
  }
  return box;
}

// Recorta todos los cuadros al mismo rectángulo (el que abarca toda la animación)
function finish(frames, durations) {
  const box = { x0: 1e9, y0: 1e9, x1: -1, y1: -1 };
  for (const f of frames) bbox(f.getContext('2d'), f.width, f.height, box);
  if (box.x1 < 0) return null;
  const w = box.x1 - box.x0 + 3;
  const h = box.y1 - box.y0 + 3;
  const cropped = frames.map((f) => {
    const c = makeCanvas(w, h);
    c.getContext('2d').drawImage(f, box.x0, box.y0, w - 2, h - 2, 1, 1, w - 2, h - 2);
    return c;
  });
  const total = durations.reduce((a, b) => a + b, 0);
  return {
    frames: cropped,
    durations,
    total,
    white: silhouette(cropped[0], '#ffffff'),
    black: silhouette(cropped[0], '#1b1224'),
    ice: silhouette(cropped[0], '#9fe6ff'),
    facesLeft: true,
    w,
    h,
    scale: 1,
  };
}

async function loadAnimated(id) {
  if (typeof ImageDecoder === 'undefined') return null;
  const res = await fetch(`${BASE}other/showdown/${id}.gif`);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
  await dec.tracks.ready;
  const count = dec.tracks.selectedTrack.frameCount;
  const step = Math.max(1, Math.ceil(count / MAX_FRAMES));
  const frames = [];
  const durations = [];
  for (let i = 0; i < count; i += step) {
    const { image } = await dec.decode({ frameIndex: i });
    const c = makeCanvas(image.displayWidth, image.displayHeight);
    c.getContext('2d').drawImage(image, 0, 0);
    durations.push(((image.duration || 40000) / 1e6) * step);
    image.close();
    frames.push(c);
  }
  dec.close();
  return finish(frames, durations);
}

function loadStatic(id) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = makeCanvas(img.width, img.height);
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(finish([c], [1]));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = `${BASE}versions/generation-v/black-white/${id}.png`;
  });
}

async function loadOne(id) {
  let spr = null;
  try {
    spr = await loadAnimated(id);
  } catch {
    spr = null;
  }
  if (!spr) spr = await loadStatic(id);
  if (spr) store.set(id, spr);
}

export async function loadSprites(ids, onProgress) {
  let n = 0;
  // De a 4 para no saturar la conexión
  const queue = [...ids];
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift();
      await loadOne(id);
      onProgress?.(++n, ids.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

const FALLBACK = {
  fuego: 'brasko', agua: 'marejo', electrico: 'voltadillo', planta: 'nopalin', roca: 'petron',
  fantasma: 'sombrix', psiquico: 'sombrix', normal: 'petron', hada: 'marejo', lucha: 'brasko',
};
const fallbackCache = new Map();

function fallbackFor(type) {
  const key = FALLBACK[type] || 'brasko';
  if (!fallbackCache.has(key)) {
    const s = creatureSprite(key);
    fallbackCache.set(key, {
      frames: [s.normal], durations: [1], total: 1,
      white: s.white, black: silhouette(s.normal, '#1b1224'), ice: silhouette(s.normal, '#9fe6ff'),
      facesLeft: false, w: s.normal.width, h: s.normal.height,
      // Los dibujos de respaldo son de 18 px: se agrandan para igualar a los de Showdown
      scale: 3,
    });
  }
  return fallbackCache.get(key);
}

export function spriteOf(key, boss = false) {
  const c = CREATURES[key];
  const id = boss ? c.boss.id : c.id;
  return store.get(id) || fallbackFor(c.type);
}

// Cuadro de la animación para el tiempo t (en segundos)
export function frameAt(spr, t) {
  if (spr.frames.length === 1) return spr.frames[0];
  let k = ((t % spr.total) + spr.total) % spr.total;
  for (let i = 0; i < spr.frames.length; i++) {
    k -= spr.durations[i];
    if (k <= 0) return spr.frames[i];
  }
  return spr.frames[0];
}
