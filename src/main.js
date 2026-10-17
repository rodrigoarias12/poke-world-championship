import { VW, VH } from './config.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { LoadingScene } from './scenes.js';
import { Announcer } from './announcer.js';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = new Sfx();
    this.announcer = new Announcer(this.audio);
    this.audio.announcer = this.announcer;
    this.input = new Input(this, canvas);
    this.scene = null;
    this.fade = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.scene?.onBlur?.();
      this.audio.setHidden(document.hidden);
    });
    this.setScene(new LoadingScene(this));
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let h = innerHeight;
    let w = (h * VW) / VH;
    if (w > innerWidth) {
      w = innerWidth;
      h = (w * VH) / VW;
    }
    this.canvas.style.width = `${Math.floor(w)}px`;
    this.canvas.style.height = `${Math.floor(h)}px`;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = this.canvas.height / VH;
  }

  setScene(scene) {
    this.scene?.onExit?.();
    this.scene = scene;
    this.fade = 1;
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.tick(dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  // Avanza el juego a mano (útil para pruebas automáticas)
  advance(seconds, step = 1 / 60) {
    for (let t = 0; t < seconds; t += step) this.tick(step);
  }

  tick(dt) {
    if (this.input.wasPressed('mute')) this.audio.toggleMusic();
    if (this.input.wasPressed('sfx')) this.audio.toggleSfx();
    if (this.input.wasPressed('voice')) this.announcer.cycle();
    this.scene.update(dt);
    this.input.endFrame();
    this.audio.update();
    this.fade = Math.max(0, this.fade - dt * 4);

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120d1c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.scene.render(ctx);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(18,13,28,${this.fade})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }
}

const canvas = document.getElementById('game');
const start = () => {
  window.game = new Game(canvas);
};
// Espera la fuente para que los textos salgan bien desde el primer cuadro
if (document.fonts?.load) {
  Promise.race([document.fonts.load('900 10px Rubik'), new Promise((r) => setTimeout(r, 1500))]).then(start, start);
} else {
  start();
}
