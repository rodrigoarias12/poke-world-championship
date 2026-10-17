import { VW, VH } from './config.js';

const KEYMAP = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  // Ataques: 1, 2, ESPACIO, Q, E (o J, K, SHIFT, U, I)
  Digit1: ['m0'], Numpad1: ['m0'], KeyJ: ['m0'],
  Digit2: ['m1'], Numpad2: ['m1'], KeyK: ['m1'],
  Space: ['m2', 'confirm'], ShiftLeft: ['m2'], ShiftRight: ['m2'],
  KeyQ: ['m3'], KeyU: ['m3'],
  KeyE: ['m4'], KeyI: ['m4'],
  Enter: ['confirm'], NumpadEnter: ['confirm'],
  Escape: ['back', 'pause'], Backspace: ['back'], KeyP: ['pause'],
  KeyM: ['mute'], KeyN: ['sfx'], KeyV: ['voice'],
};

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace']);

export class Input {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    // Controles táctiles de batalla (los define la escena)
    this.controls = null;
    this.joy = null;
    this.buttonPointers = new Map();

    addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      game.audio.unlock();
      const actions = KEYMAP[e.code];
      if (!actions || e.repeat) return;
      this.touchMode = false;
      for (const a of actions) {
        this.down.add(a);
        this.pressed.add(a);
      }
    });
    addEventListener('keyup', (e) => {
      const actions = KEYMAP[e.code];
      if (actions) for (const a of actions) this.down.delete(a);
    });
    addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    canvas.addEventListener('pointerdown', (e) => this.onPointer('down', e));
    canvas.addEventListener('pointermove', (e) => this.onPointer('move', e));
    addEventListener('pointerup', (e) => this.onPointer('up', e));
    addEventListener('pointercancel', (e) => this.onPointer('up', e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // En iPhone el sonido solo se puede activar al soltar el dedo (touchend/pointerup)
    const unlock = () => game.audio.unlock();
    addEventListener('touchend', unlock, { capture: true, passive: true });
    addEventListener('pointerup', unlock, { capture: true, passive: true });
    // Evita el menú de "mantener presionado" y el zoom en iOS
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  // Suelta joystick y botones (al pausar, ocultar la app, etc.)
  releaseAll() {
    this.down.clear();
    this.joy = null;
    this.buttonPointers.clear();
  }

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * VW, ((e.clientY - r.top) / r.height) * VH];
  }

  onPointer(kind, e) {
    const [x, y] = this.toLogical(e);
    if (kind === 'down') {
      this.game.audio.unlock();
      if (e.pointerType === 'touch') this.touchMode = true;
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
    }

    const scene = this.game.scene;
    // Los controles de pelea solo toman los toques mientras se está peleando
    const active = this.controls && this.touchMode && scene?.touchControlsActive?.() !== false;
    if (active) {
      if (this.handleControls(kind, e.pointerId, x, y)) return;
    } else if (kind !== 'down' && (this.joy?.id === e.pointerId || this.buttonPointers.has(e.pointerId))) {
      this.handleControls(kind, e.pointerId, x, y);
    }
    if (kind === 'down') scene?.onPointerDown?.(x, y);
    else if (kind === 'move') scene?.onPointerMove?.(x, y);
    else scene?.onPointerUp?.(x, y);
  }

  handleControls(kind, id, x, y) {
    if (kind === 'down') {
      for (const b of this.controls.buttons) {
        if (Math.hypot(x - b.x, y - b.y) <= b.r + 4) {
          this.buttonPointers.set(id, b.id);
          this.down.add(b.id);
          this.pressed.add(b.id);
          return true;
        }
      }
      if (!this.joy && x < VW * 0.6 && y > this.controls.joyTop) {
        this.joy = { id, ox: x, oy: y, x, y };
        return true;
      }
      return false;
    }
    if (this.joy && this.joy.id === id) {
      if (kind === 'move') {
        this.joy.x = x;
        this.joy.y = y;
      } else {
        this.joy = null;
      }
      return true;
    }
    if (this.buttonPointers.has(id)) {
      if (kind === 'up') {
        this.down.delete(this.buttonPointers.get(id));
        this.buttonPointers.delete(id);
      }
      return true;
    }
    return false;
  }

  setControls(controls) {
    this.controls = controls;
    this.joy = null;
    for (const b of this.buttonPointers.values()) this.down.delete(b);
    this.buttonPointers.clear();
  }

  isDown(a) {
    return this.down.has(a);
  }

  wasPressed(a) {
    return this.pressed.has(a);
  }

  moveVector() {
    let x = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
    let y = (this.down.has('down') ? 1 : 0) - (this.down.has('up') ? 1 : 0);
    if (this.joy) {
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > 2) {
        const m = Math.min(1, d / 13);
        x = (dx / d) * m;
        y = (dy / d) * m;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return [x, y];
  }

  endFrame() {
    this.pressed.clear();
  }
}
