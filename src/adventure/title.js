// Entrada al Modo Aventura: seguir la partida o empezar una nueva (chico o chica).
import { VW, VH } from '../config.js';
import { CREATURES } from '../data.js';
import { text, roundRect, panel, button, inRect, drawCreature, backOut } from '../ui.js';
import { Menu } from '../menu.js';
import { AdventureState } from './state.js';
import { OverworldScene } from './overworld.js';
import { playerSprites } from './people.js';
import { parseMap } from './maps.js';
import { prerenderMap } from './tiles.js';

export class AdventureTitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.mode = 'menu';
    this.saved = AdventureState.load();
    this.confirmErase = false;
    this.bg = prerenderMap(parseMap('pueblo'));
    this.buildMenu();
    // Pide al navegador que no borre la partida (Safari limpia el almacenamiento)
    navigator.storage?.persist?.().catch?.(() => {});
  }

  buildMenu() {
    const items = [];
    if (this.saved) items.push({ label: 'CONTINUAR', sub: this.summary(), color: '#4cc44a', action: () => this.continueGame() });
    items.push({ label: 'NUEVA PARTIDA', sub: this.saved ? 'empezar de cero' : 'elegí tu personaje', color: '#e8413b', action: () => this.newGame() });
    items.push({ label: 'VOLVER', color: '#7c4fd0', action: () => this.back() });
    this.menu = new Menu(this.game, items, { x: 100, y: 92, w: 120, h: 17, gap: 4, size: 6.5 });
  }

  summary() {
    const d = this.saved.data;
    const mins = Math.floor(d.playTime / 60);
    return `${d.name} · ${d.party.length} Pokémon · ${mins} min`;
  }

  continueGame() {
    this.game.setScene(new OverworldScene(this.game, this.saved));
  }

  newGame() {
    if (this.saved && !this.confirmErase) {
      this.confirmErase = true;
      this.game.audio.play('back');
      return;
    }
    this.mode = 'look';
    this.look = 0;
  }

  start(look) {
    AdventureState.erase();
    const st = new AdventureState(AdventureState.fresh(look));
    st.save();
    this.game.audio.play('confirm');
    this.game.setScene(new OverworldScene(this.game, st));
  }

  async back() {
    const { TitleScene } = await import('../scenes.js');
    this.game.setScene(new TitleScene(this.game));
  }

  onEnter() {
    this.game.audio.music('menu');
  }

  update(dt) {
    this.t += dt;
    const inp = this.game.input;
    if (this.mode === 'look') {
      if (inp.wasPressed('left') || inp.wasPressed('right')) {
        this.look = 1 - this.look;
        this.game.audio.play('select');
      }
      if (inp.wasPressed('confirm')) this.start(this.look ? 'chica' : 'chico');
      if (inp.wasPressed('back')) this.mode = 'menu';
      return;
    }
    this.menu.update();
    if (inp.wasPressed('back')) this.back();
  }

  onPointerMove(x, y) {
    if (this.mode === 'menu') this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    if (this.mode === 'look') {
      if (inRect(x, y, this.lookRects?.[0])) return this.start('chico');
      if (inRect(x, y, this.lookRects?.[1])) return this.start('chica');
      if (inRect(x, y, this.backRect)) this.mode = 'menu';
      return;
    }
    this.menu.pointerDown(x, y);
  }

  render(ctx) {
    // Fondo: Pueblo Paleta moviéndose despacio
    const bg = this.bg[Math.floor(this.t * 4) % this.bg.length];
    const ox = Math.sin(this.t * 0.2) * 8;
    ctx.drawImage(bg, (bg.width - VW) / 2 + ox, 0, VW, VH, 0, 0, VW, VH);
    ctx.fillStyle = 'rgba(12,8,22,0.55)';
    ctx.fillRect(0, 0, VW, VH);
    const k = backOut(Math.min(1, this.t / 0.5));
    text(ctx, 'MODO AVENTURA', VW / 2, 38, { size: 22 * k, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 4 });
    text(ctx, 'De PUEBLO PALETA a CIUDAD VERDE · ¡con peleas de verdad!', VW / 2, 52, { size: 5, weight: 800, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 1.4 });
    ['pikachu', 'charmander', 'squirtle', 'bulbasaur'].forEach((key, i) => {
      const x = i < 2 ? 34 + i * 30 : VW - 64 + (i - 2) * 30;
      drawCreature(ctx, key, x, 76 + Math.sin(this.t * 3 + i) * 2, 26, { faceLeft: i >= 2, t: this.t + i });
    });
    if (this.mode === 'look') return this.renderLook(ctx);
    this.menu.render(ctx);
    if (this.confirmErase) {
      roundRect(ctx, VW / 2 - 90, 160, 180, 12, 4);
      ctx.fillStyle = 'rgba(196,59,79,0.92)';
      ctx.fill();
      text(ctx, 'Se va a borrar la partida guardada. Tocá otra vez para confirmar.', VW / 2, 168, { size: 4.2, weight: 900, align: 'center' });
    } else {
      const hint = this.game.input.touchMode ? 'Joystick para caminar · A hablar · B menú' : 'Flechas caminar · ESPACIO hablar · ESC menú · en peleas R tira la Poké Ball';
      text(ctx, hint, VW / 2, 172, { size: 4, weight: 700, align: 'center', color: 'rgba(255,255,255,0.8)', stroke: '#1b1224', strokeW: 1 });
    }
  }

  renderLook(ctx) {
    text(ctx, '¿Con quién vas a jugar?', VW / 2, 98, { size: 8, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
    this.lookRects = ['chico', 'chica'].map((look, i) => {
      const x = VW / 2 - 70 + i * 80;
      const sel = this.look === i;
      panel(ctx, x, 106, 60, 54, { fill: sel ? '#3a2a5e' : 'rgba(30,24,50,0.92)', r: 5, border: sel ? '#ffe66b' : 'rgba(255,255,255,0.2)' });
      const img = playerSprites(look).down[Math.floor(this.t * 4) % 4];
      ctx.drawImage(img, x + 30 - 12, 112, 24, 32);
      text(ctx, look === 'chico' ? 'ROJO' : 'HOJA', x + 30, 154, { size: 6.5, weight: 900, align: 'center', color: sel ? '#ffe66b' : '#ffffff' });
      return { x, y: 106, w: 60, h: 54 };
    });
    this.backRect = button(ctx, '‹', 8, 8, 16, 12, { color: '#7c4fd0', size: 7 });
  }
}

// Para que el nombre se pueda usar desde afuera sin cargar todo
export const ADVENTURE_STARTERS = ['bulbasaur', 'charmander', 'squirtle'].filter((k) => CREATURES[k]);
