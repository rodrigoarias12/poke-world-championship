// El mundo de la batalla campal: qué baldosas se pisan, cuáles frenan los
// ataques, choques de los pies contra árboles y casas, rayos que se cortan,
// caminos para los bots y el dibujo del mapa (solo la parte que se ve).
import { TILE, prerenderMap, tallGrassOverlay } from '../adventure/tiles.js';
import { parseRoyaleMap } from './maps.js';

// No se pisan: árboles, techos, paredes, puertas, carteles, cercas y agua
const WALK_SOLID = new Set([...'TRUKHOWDGSF~CM']);
// Frenan los ataques: lo mismo menos el agua y las cercas (se tira por encima)
const SHOT_SOLID = new Set([...'TRUKHOWDGSCM']);

export class World {
  constructor(id = 'paleta') {
    const map = parseRoyaleMap(id);
    this.map = map;
    this.name = map.name;
    this.w = map.w;
    this.h = map.h;
    this.W = map.w * TILE;
    this.H = map.h * TILE;
    const n = map.w * map.h;
    this.walkSolid = new Uint8Array(n);
    this.shotSolid = new Uint8Array(n);
    this.water = new Uint8Array(n);
    this.grass = new Uint8Array(n);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const ch = map.rows[y][x];
        const i = y * map.w + x;
        this.walkSolid[i] = WALK_SOLID.has(ch) ? 1 : 0;
        this.shotSolid[i] = SHOT_SOLID.has(ch) ? 1 : 0;
        this.water[i] = ch === '~' ? 1 : 0;
        this.grass[i] = ch === ',' ? 1 : 0;
      }
    }
    // Salidas y premios en píxeles (centro de la baldosa, a la altura de los pies)
    this.spawns = map.spawns.map((s) => ({ x: (s.x + 0.5) * TILE, y: (s.y + 0.75) * TILE }));
    this.itemSpots = map.items.map((s) => ({ x: (s.x + 0.5) * TILE, y: (s.y + 0.6) * TILE }));
    this.frames = null;
  }

  idx(tx, ty) {
    return ty * this.w + tx;
  }

  inside(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  // ¿Se puede pisar esta baldosa? (los de tipo agua nadan)
  canWalkTile(tx, ty, swim = false) {
    if (!this.inside(tx, ty)) return false;
    const i = this.idx(tx, ty);
    if (swim && this.water[i]) return true;
    return !this.walkSolid[i];
  }

  canWalk(x, y, swim = false) {
    return this.canWalkTile(Math.floor(x / TILE), Math.floor(y / TILE), swim);
  }

  blocksShot(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!this.inside(tx, ty)) return true;
    return this.shotSolid[this.idx(tx, ty)] === 1;
  }

  isWater(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return this.inside(tx, ty) && this.water[this.idx(tx, ty)] === 1;
  }

  inGrass(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    return this.inside(tx, ty) && this.grass[this.idx(tx, ty)] === 1;
  }

  // Círculo de los pies (radio r) contra las baldosas sólidas
  feetBlocked(x, y, r, swim) {
    for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r * 0.5], [0, r * 0.5], [-r * 0.7, -r * 0.35], [r * 0.7, -r * 0.35], [-r * 0.7, r * 0.35], [r * 0.7, r * 0.35]]) {
      if (!this.canWalk(x + ox, y + oy, swim)) return true;
    }
    return false;
  }

  // Mueve los pies de (ox, oy) a (nx, ny) resbalando contra las paredes.
  // Devuelve { x, y, hitX, hitY }
  slide(ox, oy, nx, ny, r, swim = false) {
    let x = ox;
    let y = oy;
    let hitX = false;
    let hitY = false;
    // De a pasos chicos, así nada atraviesa un árbol aunque vaya rápido
    const steps = Math.max(1, Math.ceil(Math.hypot(nx - ox, ny - oy) / 4));
    const sx = (nx - ox) / steps;
    const sy = (ny - oy) / steps;
    for (let i = 0; i < steps; i++) {
      if (!hitX) {
        if (this.feetBlocked(x + sx, y, r, swim)) hitX = true;
        else x += sx;
      }
      if (!hitY) {
        if (this.feetBlocked(x, y + sy, r, swim)) hitY = true;
        else y += sy;
      }
    }
    return { x, y, hitX, hitY };
  }

  // Si quedó adentro de algo sólido (por un empujón o un salto), lo saca
  unstick(x, y, r, swim = false) {
    if (!this.feetBlocked(x, y, r, swim)) return [x, y];
    for (let d = 4; d <= 64; d += 4) {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * d;
        const py = y + Math.sin(a) * d;
        if (!this.feetBlocked(px, py, r, swim)) return [px, py];
      }
    }
    return [x, y];
  }

  // Hasta dónde llega un rayo antes de chocar con algo
  raycast(x, y, ang, max) {
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    for (let d = 0; d < max; d += 4) {
      if (this.blocksShot(x + cx * d, y + cy * d)) return Math.max(0, d - 2);
    }
    return max;
  }

  // ¿Se ve de un punto al otro? (nada sólido en el medio)
  clearLine(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) {
      const k = i / n;
      if (this.blocksShot(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k)) return false;
    }
    return true;
  }

  // Distancias (en baldosas) desde cada baldosa hasta la meta, para que los
  // bots esquiven árboles y casas
  flowField(gx, gy) {
    const { w, h } = this;
    const dist = new Int16Array(w * h).fill(-1);
    let tx = Math.floor(gx / TILE);
    let ty = Math.floor(gy / TILE);
    if (!this.canWalkTile(tx, ty)) [tx, ty] = this.nearestWalkTile(tx, ty);
    const q = new Int16Array(w * h * 2);
    let head = 0;
    let tail = 0;
    dist[this.idx(tx, ty)] = 0;
    q[tail++] = tx;
    q[tail++] = ty;
    while (head < tail) {
      const x = q[head++];
      const y = q[head++];
      const d = dist[this.idx(x, y)];
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.canWalkTile(nx, ny)) continue;
        const i = this.idx(nx, ny);
        if (dist[i] >= 0) continue;
        dist[i] = d + 1;
        q[tail++] = nx;
        q[tail++] = ny;
      }
    }
    return { dist, gx, gy };
  }

  // Hacia dónde caminar para acercarse a la meta del campo de distancias
  flowDir(field, x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!this.inside(tx, ty)) return [0, 0];
    const here = field.dist[this.idx(tx, ty)];
    if (here === 0) {
      const dx = field.gx - x;
      const dy = field.gy - y;
      const d = Math.hypot(dx, dy);
      return d < 3 ? [0, 0] : [dx / d, dy / d];
    }
    let best = null;
    let bestD = here < 0 ? 1e9 : here;
    for (const [dx, dy] of DIRS8) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!this.inside(nx, ny)) continue;
      const d = field.dist[this.idx(nx, ny)];
      if (d < 0) continue;
      // En diagonal solo si las dos de al lado también se pisan (no corta esquinas)
      if (dx && dy && (!this.canWalkTile(tx + dx, ty) || !this.canWalkTile(tx, ty + dy))) continue;
      if (d < bestD) {
        bestD = d;
        best = [nx, ny];
      }
    }
    if (!best) return [0, 0];
    const px = (best[0] + 0.5) * TILE - x;
    const py = (best[1] + 0.6) * TILE - y;
    const d = Math.hypot(px, py) || 1;
    return [px / d, py / d];
  }

  nearestWalkTile(tx, ty) {
    for (let r = 1; r < 40; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.canWalkTile(tx + dx, ty + dy)) return [tx + dx, ty + dy];
        }
      }
    }
    return [tx, ty];
  }

  // Una baldosa al azar que se pisa, cerca de (x, y) a menos de maxD píxeles
  randomSpot(x, y, maxD, rand = Math.random, avoidGrass = false) {
    for (let tries = 0; tries < 60; tries++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * maxD;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      if (!this.canWalk(px, py) || this.feetBlocked(px, py, 6)) continue;
      if (avoidGrass && this.inGrass(px, py) && tries < 40) continue;
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      return { x: (tx + 0.5) * TILE, y: (ty + 0.6) * TILE };
    }
    return { x, y };
  }

  // ---------------------------------------------------------------- Dibujo
  ensureFrames() {
    if (!this.frames) this.frames = prerenderMap(this.map);
    return this.frames;
  }

  // Dibuja solo el pedazo que entra en la cámara (vista de vw x vh)
  draw(ctx, t, camX, camY, vw, vh) {
    const frames = this.ensureFrames();
    const img = frames[Math.floor(t * 2.5) % frames.length];
    const sx = Math.max(0, Math.floor(camX));
    const sy = Math.max(0, Math.floor(camY));
    const sw = Math.min(this.W - sx, Math.ceil(vw) + 2);
    const sh = Math.min(this.H - sy, Math.ceil(vh) + 2);
    if (sw > 0 && sh > 0) ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
  }

  // Pasto alto por delante de los pies de quien está parado en él
  drawGrassOver(ctx, f) {
    if (f.lift > 4 || !this.inGrass(f.x, f.y)) return;
    const img = tallGrassOverlay();
    const y = Math.round(f.y) - 5;
    const w = Math.max(16, f.wide * 0.9);
    ctx.drawImage(img, Math.round(f.x - w / 2), y, w, 7);
  }
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
