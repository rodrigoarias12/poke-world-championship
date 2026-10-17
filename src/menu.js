import { button, inRect } from './ui.js';

// Lista vertical de botones con teclado, mouse y toque
export class Menu {
  constructor(game, items, { x, y, w, h, gap = 4, size = 6 }) {
    this.game = game;
    this.items = items;
    this.layout = { x, y, w, h, gap, size };
    this.index = 0;
    this.rects = [];
  }

  update() {
    const inp = this.game.input;
    const n = this.items.length;
    if (inp.wasPressed('down')) {
      this.index = (this.index + 1) % n;
      this.game.audio.play('select');
    }
    if (inp.wasPressed('up')) {
      this.index = (this.index - 1 + n) % n;
      this.game.audio.play('select');
    }
    if (inp.wasPressed('confirm')) this.activate(this.index);
  }

  activate(i) {
    const item = this.items[i];
    if (!item || item.disabled) return;
    this.game.audio.play('confirm');
    item.action();
  }

  pointerMove(x, y) {
    const i = this.rects.findIndex((r) => inRect(x, y, r));
    if (i >= 0 && i !== this.index) this.index = i;
  }

  pointerDown(x, y) {
    const i = this.rects.findIndex((r) => inRect(x, y, r));
    if (i >= 0) {
      this.index = i;
      this.activate(i);
      return true;
    }
    return false;
  }

  render(ctx) {
    const { x, y, w, h, gap, size } = this.layout;
    this.rects = this.items.map((it, i) =>
      button(ctx, it.label, x, y + i * (h + gap), w, h, {
        selected: i === this.index,
        color: it.color,
        sub: it.sub,
        size: it.size || size,
        disabled: it.disabled,
      }),
    );
  }
}
