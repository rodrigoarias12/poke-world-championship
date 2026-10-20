// Canchas de la aventura: se registran recién cuando se abre el modo.
import { VW, VH } from '../config.js';
import { registerArenaTheme } from '../arena.js';

function tree(ctx, x, y, s = 1) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 2, 11 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4424';
  ctx.fillRect(x - 2 * s, y - 8 * s, 4 * s, 10 * s);
  for (const [dx, dy, r, c] of [[0, -16, 10, '#2f7a2a'], [-6, -12, 7, '#3a8f33'], [6, -13, 7, '#3a8f33'], [-2, -19, 5, '#5cc45a']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tuft(ctx, x, y) {
  ctx.fillStyle = '#3c7c30';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * 2.4 - 1.2, y);
    ctx.lineTo(x + i * 2.4 + Math.sin(i) * 1.2, y - 6 - (i % 2 ? 0 : 2));
    ctx.lineTo(x + i * 2.4 + 1.2, y);
    ctx.fill();
  }
}

registerArenaTheme('ruta', {
  name: 'RUTA 1',
  floor: 'ground',
  paint(ctx, rand) {
    // Pasto con franjas y un sendero de tierra que cruza
    for (let y = 0; y < VH; y += 12) {
      ctx.fillStyle = (y / 12) % 2 ? '#7cc462' : '#74bb5a';
      ctx.fillRect(0, y, VW, 12);
    }
    ctx.fillStyle = '#5ea548';
    for (let i = 0; i < 220; i++) ctx.fillRect(Math.round(rand() * VW), Math.round(rand() * VH), 1, 2);
    ctx.fillStyle = '#e2c88e';
    ctx.beginPath();
    ctx.moveTo(0, 120);
    for (let x = 0; x <= VW; x += 10) ctx.lineTo(x, 118 + Math.sin(x * 0.03) * 10);
    for (let x = VW; x >= 0; x -= 10) ctx.lineTo(x, 136 + Math.sin(x * 0.03) * 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cdb078';
    for (let i = 0; i < 40; i++) {
      const x = rand() * VW;
      ctx.fillRect(Math.round(x), Math.round(124 + Math.sin(x * 0.03) * 10 + rand() * 8), 1.5, 1);
    }
    // Flores sueltas
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = ['#ff5d7a', '#ffd23f', '#ffffff'][i % 3];
      ctx.fillRect(Math.round(20 + rand() * (VW - 40)), Math.round(20 + rand() * 90), 1.5, 1.5);
    }
    for (let i = 0; i < 14; i++) tuft(ctx, 20 + rand() * (VW - 40), 30 + rand() * 130);
  },
  decor(ctx) {
    for (const [x, y, s] of [[18, 26, 1.1], [44, 18, 0.8], [300, 28, 1.1], [276, 18, 0.8], [16, 168, 1], [304, 170, 1]]) tree(ctx, x, y, s);
  },
  animate(ctx, t) {
    // Mariposas
    for (let i = 0; i < 3; i++) {
      const x = (60 + i * 90 + Math.sin(t * 0.7 + i) * 30) % VW;
      const y = 50 + i * 30 + Math.sin(t * 2.3 + i * 2) * 8;
      const flap = Math.abs(Math.sin(t * 14 + i));
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ffd23f';
      ctx.fillRect(x - 1.5 * flap - 0.5, y, 1.5 * flap, 1.4);
      ctx.fillRect(x + 0.5, y, 1.5 * flap, 1.4);
    }
  },
});
