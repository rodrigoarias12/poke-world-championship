// Premios que aparecen por el mapa de la batalla campal
export const ITEM_KINDS = {
  baya: { name: 'BAYA ARANJA', say: '¡BAYA ARANJA!', color: '#7dc8ff', weight: 50 },
  caramelo: { name: 'CARAMELO RARO', say: '¡MÁS FUERZA!', color: '#ff9a5a', weight: 25 },
  deportivas: { name: 'DEPORTIVAS', say: '¡MÁS RÁPIDO!', color: '#ffe66b', weight: 25 },
};

export function rollItem(rand = Math.random) {
  const total = Object.values(ITEM_KINDS).reduce((s, k) => s + k.weight, 0);
  let r = rand() * total;
  for (const [key, k] of Object.entries(ITEM_KINDS)) {
    r -= k.weight;
    if (r < 0) return key;
  }
  return 'baya';
}

function px(ctx, color, rects) {
  ctx.fillStyle = color;
  for (const [x, y, w, h] of rects) ctx.fillRect(x, y, w, h);
}

// Dibujo chiquito de cada premio (en coordenadas del mundo, centrado en x, y)
export function drawItem(ctx, it, t) {
  const bob = Math.sin(t * 3 + it.x) * 1.2;
  const pop = it.fresh ? 1 + it.fresh * 0.8 : 1;
  ctx.save();
  ctx.fillStyle = 'rgba(30,20,10,0.3)';
  ctx.beginPath();
  ctx.ellipse(it.x, it.y + 1, 4.5, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Destello que lo hace fácil de ver
  ctx.globalAlpha = 0.35 + Math.sin(t * 5 + it.y) * 0.2;
  ctx.fillStyle = ITEM_KINDS[it.kind].color;
  ctx.beginPath();
  ctx.arc(it.x, it.y - 6 + bob, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.translate(Math.round(it.x), Math.round(it.y - 6 + bob));
  ctx.scale(pop, pop);
  if (it.kind === 'baya') {
    // Baya Aranja: redonda y azul, con hojita
    px(ctx, '#1b1224', [[-4, -3, 8, 7], [-3, -4, 6, 9]]);
    px(ctx, '#3a8fe0', [[-3, -3, 6, 6], [-2, -3.5, 4, 7]]);
    px(ctx, '#8fd3ff', [[-2, -2, 2, 2]]);
    px(ctx, '#3fa34d', [[0, -6, 3, 2], [-1, -5, 2, 1]]);
  } else if (it.kind === 'caramelo') {
    // Caramelo Raro: envoltorio con dos puntas
    px(ctx, '#1b1224', [[-6, -2, 12, 5], [-3, -3, 6, 7]]);
    px(ctx, '#7aa8ff', [[-5, -1, 2, 3], [3, -1, 2, 3]]);
    px(ctx, '#ffffff', [[-2, -2, 4, 5]]);
    px(ctx, '#4a78d8', [[-2, 0, 4, 1]]);
  } else {
    // Deportivas: una zapatilla roja con suela blanca
    px(ctx, '#1b1224', [[-5, -3, 7, 6], [-5, 0, 11, 4]]);
    px(ctx, '#e8413b', [[-4, -2, 5, 4], [-4, 1, 9, 1]]);
    px(ctx, '#f4f1ea', [[-4, 2, 9, 1], [-3, -2, 1, 1]]);
  }
  ctx.restore();
}
