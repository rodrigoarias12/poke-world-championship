import { personSprites } from './art.js';
import { font } from './ui.js';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const ROW_H = 9;
const STEP_COLORS = ['#2a2340', '#332b4d'];
const SEAT_COLORS = ['#3d5a9e', '#c2513a'];

// Gradas con público animado
export class Crowd {
  constructor(x, y, w, h, { seed = 1, sign = null, density = 0.92 } = {}) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.excitement = 0;
    this.rows = [];
    const rand = rng(seed);
    const pool = [];
    for (let i = 0; i < 28; i++) pool.push(personSprites(rand));
    const nRows = Math.ceil(h / ROW_H) + 1;
    const signRow = sign ? Math.min(nRows - 2, 2) : -1;
    for (let r = 0; r < nRows; r++) {
      const people = [];
      const offset = (r % 2) * 3.5 - 2;
      for (let px = offset; px < w; px += 7) {
        if (rand() > density) continue;
        people.push({
          x: px + (rand() - 0.5) * 0.8,
          spr: pool[Math.floor(rand() * pool.length)],
          phase: rand() * Math.PI * 2,
          speed: 8 + rand() * 6,
          fan: rand(),
          letter: null,
        });
      }
      if (r === signRow) {
        const letters = [...sign];
        const start = Math.max(0, Math.floor((people.length - letters.length) / 2));
        letters.forEach((ch, i) => {
          const person = people[start + i];
          if (person && ch !== ' ') person.letter = ch;
        });
      }
      this.rows.push({ y: r * ROW_H - 2, people, seat: SEAT_COLORS[r % 2], step: STEP_COLORS[r % 2] });
    }
  }

  excite(v) {
    this.excitement = Math.min(1.5, Math.max(this.excitement, v));
  }

  update(dt) {
    this.excitement = Math.max(0, this.excitement - dt * 0.45);
  }

  render(ctx, t) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.w, this.h);
    ctx.clip();
    ctx.fillStyle = '#1d1730';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    const ex = this.excitement;
    for (const row of this.rows) {
      const ry = this.y + row.y;
      ctx.fillStyle = row.step;
      ctx.fillRect(this.x, ry + 4, this.w, ROW_H);
      ctx.fillStyle = row.seat;
      ctx.fillRect(this.x, ry + 9, this.w, 2);
      for (const p of row.people) {
        const wave = p.fan < 0.08 + ex * 0.6;
        const jump = wave ? Math.abs(Math.sin(t * p.speed * 0.5 + p.phase)) * (1 + ex * 1.2) : 0;
        const img = wave && (ex > 0.35 || p.fan < 0.05) ? p.spr.cheer : p.spr.normal;
        const px = Math.round(this.x + p.x);
        const py = Math.round(ry - jump);
        ctx.drawImage(img, px, py);
        if (p.letter) {
          const sy = py - 6 + Math.round(Math.sin(t * 3 + p.phase) * 0.6);
          ctx.fillStyle = '#1b1224';
          ctx.fillRect(px - 0.5, sy - 0.5, 8, 7);
          ctx.fillStyle = '#fbf6e9';
          ctx.fillRect(px, sy, 7, 6);
          ctx.fillStyle = '#1b1224';
          ctx.font = font(5.2, 900);
          ctx.textAlign = 'center';
          ctx.fillText(p.letter, px + 3.5, sy + 5);
        }
      }
    }
    ctx.restore();
  }
}
