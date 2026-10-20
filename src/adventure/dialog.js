// Caja de diálogo como en los juegos de Game Boy: el texto aparece letra por
// letra, ▼ para seguir, y preguntas con opciones (SÍ / NO).
import { VW, VH } from '../config.js';
import { text, textWidth, roundRect, inRect } from '../ui.js';

const SIZE = 6.6;
const WIDTH = 286;
const SPEED = 45; // letras por segundo
const GUARD = 0.4; // segundos sin aceptar respuesta (que apretar repetido no elija solo)

function wrap(ctx, str) {
  const out = [];
  let cur = '';
  for (const word of str.split(' ')) {
    const test = cur ? `${cur} ${word}` : word;
    if (textWidth(ctx, test, SIZE, 800) > WIDTH && cur) {
      out.push(cur);
      cur = word;
    } else cur = test;
  }
  if (cur) out.push(cur);
  return out;
}

export class DialogBox {
  constructor(lines, { name = null, choices = null, onDone }) {
    this.raw = lines;
    this.name = name;
    this.choices = choices;
    this.onDone = onDone;
    this.pages = null;
    this.page = 0;
    this.chars = 0;
    this.sel = 0;
    this.t = 0;
    this.guard = 0;
    this.closed = false;
  }

  // Se arma al primer dibujo (hace falta el contexto para medir el texto)
  layout(ctx) {
    this.pages = [];
    for (const l of this.raw) {
      const wrapped = wrap(ctx, l);
      for (let i = 0; i < wrapped.length; i += 2) this.pages.push(wrapped.slice(i, i + 2));
    }
    if (!this.pages.length) this.pages.push(['']);
  }

  get current() {
    return this.pages?.[this.page] || [''];
  }

  get pageLength() {
    return this.current.join(' ').length;
  }

  get lastPage() {
    return this.pages && this.page >= this.pages.length - 1;
  }

  get asking() {
    return this.choices && this.lastPage && this.chars >= this.pageLength;
  }

  update(dt, input) {
    if (!this.pages || this.closed) return;
    this.t += dt;
    this.chars = Math.min(this.pageLength, this.chars + dt * SPEED);
    if (this.asking) {
      this.guard += dt;
      if (input.wasPressed('up') || input.wasPressed('left')) this.sel = (this.sel - 1 + this.choices.length) % this.choices.length;
      if (input.wasPressed('down') || input.wasPressed('right')) this.sel = (this.sel + 1) % this.choices.length;
      if (input.wasPressed('confirm') && this.guard > GUARD) this.finish(this.sel);
      if (input.wasPressed('back') && this.guard > GUARD) this.finish(this.choices.length - 1);
      return;
    }
    if (input.wasPressed('confirm') || input.wasPressed('back')) this.next();
  }

  next() {
    if (this.chars < this.pageLength) {
      this.chars = this.pageLength;
      return;
    }
    if (this.lastPage) {
      if (!this.choices) this.finish();
      return;
    }
    this.page++;
    this.chars = 0;
  }

  finish(value) {
    if (this.closed) return;
    this.closed = true;
    this.onDone?.(value);
  }

  pointerDown(x, y) {
    if (this.asking) {
      if (this.guard <= GUARD) return;
      const i = (this.choiceRects || []).findIndex((r) => inRect(x, y, r));
      if (i >= 0) this.finish(i);
      return;
    }
    this.next();
  }

  render(ctx) {
    if (!this.pages) this.layout(ctx);
    const x = 6;
    const y = VH - 50;
    const w = VW - 12;
    const h = 44;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fillStyle = '#1b1224';
    ctx.fill();
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 3);
    ctx.fillStyle = '#5a78c8';
    ctx.fill();
    roundRect(ctx, x + 2.5, y + 2.5, w - 5, h - 5, 2.5);
    ctx.fillStyle = '#f8f8f8';
    ctx.fill();
    if (this.name) {
      const nw = textWidth(ctx, this.name, 5, 900) + 10;
      roundRect(ctx, x + 6, y - 8, nw, 10, 3);
      ctx.fillStyle = '#5a78c8';
      ctx.fill();
      text(ctx, this.name, x + 6 + nw / 2, y - 1, { size: 5, weight: 900, align: 'center', color: '#ffffff' });
    }
    let left = Math.floor(this.chars);
    this.current.forEach((line, i) => {
      const shown = line.slice(0, Math.max(0, left));
      left -= line.length + 1;
      text(ctx, shown, x + 12, y + 17 + i * 13, { size: SIZE, weight: 800, color: '#2a2230' });
    });
    if (this.chars >= this.pageLength && !this.asking && Math.floor(this.t * 2.5) % 2 === 0) {
      text(ctx, '▼', x + w - 12, y + h - 7, { size: 6, weight: 900, align: 'center', color: '#e8413b' });
    }
    if (this.asking) this.renderChoices(ctx);
  }

  renderChoices(ctx) {
    const w = 52;
    const h = 8 + this.choices.length * 13;
    const x = VW - w - 10;
    const y = VH - 56 - h;
    roundRect(ctx, x, y, w, h, 4);
    ctx.fillStyle = '#1b1224';
    ctx.fill();
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 3);
    ctx.fillStyle = '#f8f8f8';
    ctx.fill();
    this.choiceRects = this.choices.map((c, i) => {
      const cy = y + 5 + i * 13;
      if (i === this.sel) text(ctx, '▶', x + 8, cy + 8.5, { size: 6, weight: 900, align: 'center', color: '#e8413b' });
      text(ctx, c, x + 15, cy + 9, { size: 7, weight: 900, color: '#2a2230' });
      return { x, y: cy, w, h: 13 };
    });
  }
}
