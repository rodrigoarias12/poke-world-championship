// Canchas de los 8 gimnasios de Kanto. Cada una pinta su piso (una sola vez,
// en unidades lógicas), sus decorados y una animación liviana por cuadro.
// Las de piso firme no tienen agua: los Pokémon pisan tierra, metal o pasto.
import { VW, VH } from './config.js';
import { boulderSprite } from './art.js';

// Líneas de cancha (como en los estadios)
function fieldLines(ctx, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(18.5, 16.5, VW - 37, VH - 30);
  ctx.beginPath();
  ctx.moveTo(VW / 2, 16.5);
  ctx.lineTo(VW / 2, VH - 13.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(VW / 2, 92, 28, 16, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Pared arriba y abajo de la cancha
function walls(ctx, a, b, line) {
  for (let x = 0; x < VW; x += 10) {
    ctx.fillStyle = (x / 10) % 2 ? a : b;
    ctx.fillRect(x, 0, 10, 8);
    ctx.fillRect(x, VH - 5, 10, 5);
  }
  ctx.fillStyle = line;
  ctx.fillRect(0, 8, VW, 1);
  ctx.fillRect(0, VH - 6, VW, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 9, VW, 2);
}

function blotches(ctx, rand, colors, n, size) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const r = size * (0.4 + rand());
    ctx.beginPath();
    ctx.ellipse(rand() * VW, rand() * VH, r, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function boulder(ctx, x, y, s) {
  const img = boulderSprite();
  ctx.drawImage(img, x - (img.width * s) / 2, y - img.height * s, img.width * s, img.height * s);
}

// Lugares fijos para decorados que no estorban (bordes y esquinas)
const CORNERS = [[24, 30], [296, 30], [22, 162], [298, 162]];

export const GYM_THEMES = {
  // ---------------------------------------------------------------- Brock
  plateado: {
    name: 'GIMNASIO CIUDAD PLATEADA',
    floor: 'ground',
    paint(ctx, rand) {
      ctx.fillStyle = '#a88c62';
      ctx.fillRect(0, 0, VW, VH);
      blotches(ctx, rand, ['#9a7f56', '#b89c70'], 50, 14);
      // Losas de piedra
      for (let y = 14, row = 0; y < VH - 8; y += 12, row++) {
        for (let x = 12 + (row % 2) * 8; x < VW - 10; x += 16) {
          ctx.fillStyle = rand() < 0.5 ? '#b9ab92' : '#ad9f86';
          ctx.fillRect(x + 0.6, y + 0.6, 14.8, 10.8);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(x + 0.6, y + 0.6, 14.8, 1);
        }
      }
      ctx.fillStyle = '#6e5a3e';
      for (let i = 0; i < 90; i++) ctx.fillRect(Math.round(rand() * VW), Math.round(rand() * VH), 1, 1);
      fieldLines(ctx, 'rgba(255,255,255,0.45)');
      walls(ctx, '#7d7466', '#958b7b', '#5a5248');
    },
    decor(ctx) {
      for (const [x, y] of CORNERS) boulder(ctx, x, y + 6, 1.7);
      boulder(ctx, 70, 26, 1.1);
      boulder(ctx, 250, 26, 1.2);
    },
  },

  // ---------------------------------------------------------------- Misty
  celeste: {
    name: 'GIMNASIO CIUDAD CELESTE',
    floor: 'water',
    water: ['#2a9ad6', '#2590cc', '#35a8e0', '#2896d0'],
    dark: '#1f80bb',
    light: '#6cc8f0',
    edge: '#f4f8fb',
    edgeDark: '#cfe3ee',
    rim: '#7fb2cc',
    caustic: 0.22,
    platform: 'float',
    overlay(ctx) {
      // Andariveles de la pileta
      for (const y of [40, 150]) {
        for (let x = 4; x < VW; x += 5) {
          ctx.fillStyle = (x / 5) % 4 < 2 ? '#e8413b' : '#f4f4f4';
          ctx.beginPath();
          ctx.arc(x, y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },

  // ------------------------------------------------------------- Lt. Surge
  carmin: {
    name: 'GIMNASIO CIUDAD CARMÍN',
    floor: 'ground',
    paint(ctx, rand) {
      ctx.fillStyle = '#343840';
      ctx.fillRect(0, 0, VW, VH);
      for (let y = 10; y < VH; y += 20) {
        for (let x = 0; x < VW; x += 20) {
          ctx.fillStyle = (x + y) % 40 ? '#4b515d' : '#535a67';
          ctx.fillRect(x + 0.8, y + 0.8, 18.4, 18.4);
          ctx.fillStyle = '#8a919c';
          for (const [rx, ry] of [[2.5, 2.5], [17.5, 2.5], [2.5, 17.5], [17.5, 17.5]]) ctx.fillRect(x + rx - 0.5, y + ry - 0.5, 1, 1);
        }
      }
      // Franja de peligro amarilla y negra alrededor de la cancha
      ctx.save();
      ctx.beginPath();
      ctx.rect(14, 12, VW - 28, VH - 22);
      ctx.rect(20, 18, VW - 40, VH - 34);
      ctx.clip('evenodd');
      for (let x = -VH; x < VW + VH; x += 6) {
        ctx.fillStyle = '#f2c318';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 3, 0);
        ctx.lineTo(x + 3 + VH, VH);
        ctx.lineTo(x + VH, VH);
        ctx.fill();
      }
      ctx.restore();
      blotches(ctx, rand, ['rgba(0,0,0,0.25)'], 12, 10);
      fieldLines(ctx, 'rgba(255,220,60,0.5)');
      walls(ctx, '#2a2d34', '#3a3e47', '#f2c318');
    },
    decor(ctx) {
      // Tachos de basura (en uno estaba el interruptor del gimnasio)
      for (const [x, y] of [[30, 30], [52, 30], [268, 30], [290, 30], [26, 164], [294, 164]]) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(x + 1, y + 1, 7, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f8794';
        ctx.fillRect(x - 6, y - 11, 12, 11);
        ctx.fillStyle = '#9aa2ae';
        ctx.fillRect(x - 6, y - 11, 3, 11);
        ctx.fillStyle = '#5f6670';
        for (let i = 0; i < 3; i++) ctx.fillRect(x - 6, y - 9 + i * 3.4, 12, 0.7);
        ctx.fillStyle = '#b5bcc6';
        ctx.beginPath();
        ctx.ellipse(x, y - 11, 6.8, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Postes de la cerca eléctrica
      for (let x = 90; x <= 230; x += 35) {
        ctx.fillStyle = '#2a2d34';
        ctx.fillRect(x - 1.5, 10, 3, 14);
        ctx.fillStyle = '#f2c318';
        ctx.fillRect(x - 2, 9, 4, 2);
      }
    },
    animate(ctx, t) {
      // Chispas entre los postes
      ctx.save();
      ctx.strokeStyle = '#fff6a0';
      ctx.lineWidth = 0.9;
      for (let i = 0, x = 90; x < 230; x += 35, i++) {
        if (Math.floor(t * 9 + i * 3) % 4) continue;
        ctx.beginPath();
        ctx.moveTo(x, 12);
        for (let k = 1; k <= 5; k++) ctx.lineTo(x + k * 7, 12 + Math.sin(t * 50 + k * 2 + i) * 2.5);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // ---------------------------------------------------------------- Erika
  azulona: {
    name: 'GIMNASIO CIUDAD AZULONA',
    floor: 'ground',
    paint(ctx, rand) {
      for (let x = 0; x < VW; x += 20) {
        ctx.fillStyle = (x / 20) % 2 ? '#62ad52' : '#579f47';
        ctx.fillRect(x, 0, 20, VH);
      }
      ctx.fillStyle = '#4a8f3c';
      for (let i = 0; i < 160; i++) ctx.fillRect(Math.round(rand() * VW), Math.round(rand() * VH), 1, 2);
      // Canteros de flores (lejos del centro)
      const beds = [[46, 54], [272, 58], [52, 138], [268, 132], [118, 150], [204, 40]];
      for (const [bx, by] of beds) {
        ctx.fillStyle = '#3f7d33';
        ctx.beginPath();
        ctx.ellipse(bx, by, 13, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 14; i++) {
          const a = rand() * Math.PI * 2;
          const d = rand();
          ctx.fillStyle = ['#ff5d7a', '#ffd23f', '#ffffff', '#ff9ad0', '#c86bff'][i % 5];
          ctx.fillRect(Math.round(bx + Math.cos(a) * d * 11), Math.round(by + Math.sin(a) * d * 4.5), 1.5, 1.5);
        }
      }
      fieldLines(ctx, 'rgba(255,255,255,0.5)');
      // Cercos de arbustos
      for (let x = 0; x < VW; x += 8) {
        ctx.fillStyle = (x / 8) % 2 ? '#2f6b2a' : '#367a30';
        ctx.beginPath();
        ctx.arc(x + 4, 5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 4, VH - 1, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    decor(ctx) {
      for (const [x, y] of CORNERS) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 2, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b4424';
        ctx.fillRect(x - 2, y - 8, 4, 10);
        for (const [dx, dy, r, c] of [[0, -16, 10, '#2f7a2a'], [-6, -12, 7, '#3a8f33'], [6, -13, 7, '#3a8f33'], [-2, -19, 5, '#5cc45a']]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    animate(ctx, t) {
      // Pétalos que caen
      ctx.save();
      for (let i = 0; i < 14; i++) {
        const x = (i * 53 + t * (8 + (i % 3) * 3)) % VW;
        const y = (i * 37 + t * (14 + (i % 4) * 2)) % VH;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = i % 3 ? '#ffb3d0' : '#ffffff';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 2 + i);
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.6, 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
  },

  // ----------------------------------------------------------------- Koga
  fucsia: {
    name: 'GIMNASIO CIUDAD FUCSIA',
    floor: 'ground',
    puddles: [[60, 64], [258, 70], [100, 140], [226, 146], [40, 110], [284, 118]],
    paint(ctx, rand) {
      for (let y = 0, row = 0; y < VH; y += 8, row++) {
        ctx.fillStyle = row % 2 ? '#8a5a3a' : '#7d5032';
        ctx.fillRect(0, y, VW, 8);
        ctx.fillStyle = '#5a3620';
        ctx.fillRect(0, y + 7.4, VW, 0.6);
        for (let x = (row * 37) % 60; x < VW; x += 60) ctx.fillRect(x, y, 0.6, 8);
        ctx.fillStyle = 'rgba(60,30,15,0.5)';
        ctx.beginPath();
        ctx.ellipse(rand() * VW, y + 4, 2, 1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(80,20,110,0.16)';
      ctx.fillRect(0, 0, VW, VH);
      for (const [x, y] of this.puddles) {
        ctx.fillStyle = 'rgba(122,58,160,0.8)';
        ctx.beginPath();
        ctx.ellipse(x, y, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(190,120,230,0.6)';
        ctx.beginPath();
        ctx.ellipse(x - 3, y - 1.5, 4, 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      fieldLines(ctx, 'rgba(230,200,255,0.4)');
      // Paredes de papel (shoji)
      for (let x = 0; x < VW; x += 16) {
        ctx.fillStyle = '#efe6d0';
        ctx.fillRect(x, 0, 16, 8);
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(x, 0, 1, 8);
        ctx.fillRect(x, 4, 16, 0.6);
        ctx.fillStyle = '#efe6d0';
        ctx.fillRect(x, VH - 5, 16, 5);
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(x, VH - 5, 1, 5);
      }
      ctx.fillStyle = '#4a2a1a';
      ctx.fillRect(0, 8, VW, 1);
    },
    decor(ctx) {
      // Faroles de papel
      for (const [x, y] of CORNERS) {
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(x - 0.5, y - 20, 1, 6);
        ctx.fillStyle = y < 90 ? '#c43b4f' : '#7a3aa0';
        ctx.beginPath();
        ctx.ellipse(x, y - 9, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,220,160,0.5)';
        ctx.fillRect(x - 4, y - 10, 8, 1);
        ctx.fillRect(x - 4, y - 7, 8, 1);
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(x - 2, y - 15.5, 4, 1.5);
        ctx.fillRect(x - 2, y - 3.5, 4, 1.5);
      }
    },
    animate(ctx, t) {
      // Burbujas de veneno
      ctx.save();
      this.puddles.forEach(([x, y], i) => {
        const k = (t * 0.8 + i * 0.37) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#d9a8ff';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(x + Math.sin(i * 3) * 5, y - k * 6, 1 + k * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    },
  },

  // -------------------------------------------------------------- Sabrina
  azafran: {
    name: 'GIMNASIO CIUDAD AZAFRÁN',
    floor: 'ground',
    pads: [[48, 52], [272, 50], [44, 140], [276, 136], [160, 36], [160, 156]],
    paint(ctx) {
      for (let y = 0; y < VH; y += 16) {
        for (let x = 0; x < VW; x += 16) {
          ctx.fillStyle = ((x + y) / 16) % 2 ? '#3b2552' : '#2c1b40';
          ctx.fillRect(x, y, 16, 16);
        }
      }
      for (const [x, y] of this.pads) {
        ctx.fillStyle = '#1a0f28';
        ctx.beginPath();
        ctx.ellipse(x, y, 10, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ff8fbf';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x, y, 6, 3.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      fieldLines(ctx, 'rgba(255,143,191,0.45)');
      walls(ctx, '#1e1230', '#2a1a40', '#ff8fbf');
    },
    decor(ctx) {
      // Bolas de cristal en pedestales
      for (const [x, y] of [[24, 32], [296, 32]]) {
        ctx.fillStyle = '#4a3a5a';
        ctx.fillRect(x - 3, y - 6, 6, 7);
        ctx.fillStyle = '#ffb3d6';
        ctx.beginPath();
        ctx.arc(x, y - 10, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(x - 2, y - 13, 1.5, 1.5);
      }
    },
    animate(ctx, t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.pads.forEach(([x, y], i) => {
        ctx.globalAlpha = 0.18 + Math.sin(t * 4 + i) * 0.12;
        ctx.fillStyle = '#ff5fa8';
        ctx.beginPath();
        ctx.ellipse(x, y, 9, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Marcas girando
        ctx.globalAlpha = 0.7;
        for (let k = 0; k < 4; k++) {
          const a = t * 3 + (k * Math.PI) / 2 + i;
          ctx.fillRect(x + Math.cos(a) * 8 - 0.6, y + Math.sin(a) * 4.4 - 0.6, 1.2, 1.2);
        }
      });
      ctx.restore();
    },
  },

  // --------------------------------------------------------------- Blaine
  canela: {
    name: 'GIMNASIO ISLA CANELA',
    floor: 'lava',
    water: ['#a8280c', '#9a220a', '#c23a12', '#8e1e08'],
    dark: '#6e1404',
    light: '#ff7a20',
    edge: '#3a2a28',
    edgeDark: '#2a1e1c',
    rim: '#ff9a30',
    caustic: 0.1,
    platform: 'basalt',
    glint: '#ffd080',
    animate(ctx, t) {
      // Chispas que suben de la lava
      ctx.save();
      for (let i = 0; i < 22; i++) {
        const x = (i * 61 + Math.sin(t + i) * 6) % VW;
        const y = VH - ((t * (10 + (i % 5) * 3) + i * 29) % (VH - 14));
        ctx.globalAlpha = 0.5 + ((i * 7) % 5) / 10;
        ctx.fillStyle = i % 3 ? '#ffb040' : '#fff3a0';
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      ctx.restore();
    },
  },

  // ------------------------------------------------------------- Giovanni
  verde: {
    name: 'GIMNASIO CIUDAD VERDE',
    floor: 'ground',
    paint(ctx, rand) {
      ctx.fillStyle = '#cfae72';
      ctx.fillRect(0, 0, VW, VH);
      blotches(ctx, rand, ['#c4a266', '#d9ba80'], 40, 16);
      // Ondas en la arena
      ctx.strokeStyle = 'rgba(150,115,60,0.45)';
      ctx.lineWidth = 0.7;
      for (let y = 14; y < VH; y += 9) {
        ctx.beginPath();
        for (let x = 0; x <= VW; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.08 + y) * 1.5);
        ctx.stroke();
      }
      // Baldosas giratorias (flechas)
      const tiles = [[44, 50, 0], [276, 54, Math.PI], [60, 146, -Math.PI / 2], [262, 140, Math.PI / 2], [160, 30, 0]];
      for (const [x, y, a] of tiles) {
        ctx.fillStyle = '#8a8f99';
        ctx.fillRect(x - 6, y - 4, 12, 8);
        ctx.fillStyle = '#6a6f78';
        ctx.fillRect(x - 6, y + 3, 12, 1);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.65);
        ctx.rotate(a);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(-1, -4);
        ctx.lineTo(-1, -1.5);
        ctx.lineTo(-4, -1.5);
        ctx.lineTo(-4, 1.5);
        ctx.lineTo(-1, 1.5);
        ctx.lineTo(-1, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      fieldLines(ctx, 'rgba(255,255,255,0.4)');
      walls(ctx, '#7a5a3a', '#8e6a44', '#4a3420');
    },
    decor(ctx) {
      boulder(ctx, 22, 36, 1.6);
      boulder(ctx, 298, 168, 1.6);
      boulder(ctx, 300, 36, 1.2);
    },
    animate(ctx, t) {
      // Remolino de arena que cruza despacio
      const cx = 40 + ((t * 9) % (VW - 80));
      const cy = 110 + Math.sin(t * 0.7) * 30;
      ctx.save();
      ctx.fillStyle = 'rgba(240,215,160,0.7)';
      for (let i = 0; i < 14; i++) {
        const a = t * 6 + i * 0.9;
        const r = 2 + i * 0.5;
        ctx.fillRect(cx + Math.cos(a) * r, cy - i * 1.2 + Math.sin(a) * r * 0.4, 1, 1);
      }
      ctx.restore();
    },
  },
};

// Medallas (PokeAPI): se cargan una vez y se dibujan en el centro de la cancha
const badges = new Map();

export function badgeImage(n) {
  if (typeof Image === 'undefined') return null;
  if (!badges.has(n)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/badges/${n}.png`;
    badges.set(n, img);
  }
  const img = badges.get(n);
  return img.complete && img.naturalWidth ? img : null;
}
