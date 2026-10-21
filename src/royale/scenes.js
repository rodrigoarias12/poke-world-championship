// Pantallas de la batalla campal: preparar (dificultad y cuántos rivales),
// la pelea, "¡Quedaste 3º!" con MIRAR / ¡OTRA! / MENÚ, y el podio.
import { VW, VH } from '../config.js';
import { CREATURES, ROSTER, DIFFICULTY } from '../data.js';
import { Arena } from '../arena.js';
import { Menu } from '../menu.js';
import { BattleScene, TitleScene, TeamScene } from '../scenes.js';
import { touchLayout, renderTouchControls, PAUSE_RECT } from '../hud.js';
import { text, roundRect, panel, drawCreature, button, inRect, backOut, ease } from '../ui.js';
import { RoyaleBattle } from './battle.js';

const BOT_DIFFS = ['facil', 'normal', 'dificil'];
const SETUP_KEY = 'pokechamp-campal';

function loadSetup() {
  try {
    return JSON.parse(localStorage.getItem(SETUP_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveSetup(v) {
  try {
    localStorage.setItem(SETUP_KEY, JSON.stringify(v));
  } catch { /* sin almacenamiento */ }
}

// Arma la lista de jugadores: vos + bots con Pokémon distintos (sin Mewtwo)
export function makePlayers(key, rivals, diff, rand = Math.random) {
  const pool = ROSTER.filter((k) => k !== key && k !== 'mewtwo');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const players = [{ key, human: true, local: true, label: CREATURES[key].name }];
  for (let i = 0; i < rivals; i++) players.push({ key: pool[i], human: false, diff, label: CREATURES[pool[i]].name });
  return players;
}

function dim(ctx, a = 0.7) {
  ctx.fillStyle = `rgba(12,8,22,${a})`;
  ctx.fillRect(0, 0, VW, VH);
}

// ------------------------------------------------------------ Preparar

export class RoyaleSetupScene {
  constructor(game, { key }) {
    this.game = game;
    this.key = key;
    this.t = 0;
    const saved = loadSetup();
    this.rivals = [2, 3, 4].includes(saved.rivals) ? saved.rivals : 4;
    this.arena = new Arena('noche', 4);
    game.audio.music('menu');
    const start = (diff) => () => {
      saveSetup({ rivals: this.rivals, diff });
      game.setScene(new RoyaleScene(game, { key, rivals: this.rivals, difficulty: diff, players: makePlayers(key, this.rivals, diff) }));
    };
    this.menu = new Menu(game, [
      { label: 'FÁCIL', sub: 'los bots pegan suave', color: DIFFICULTY.facil.color, action: start('facil') },
      { label: 'NORMAL', sub: 'un buen desafío', color: DIFFICULTY.normal.color, action: start('normal') },
      { label: 'DIFÍCIL', sub: 'bots que esquivan y apuntan bien', color: DIFFICULTY.dificil.color, action: start('dificil') },
    ], { x: 170, y: 64, w: 110, h: 17, gap: 4, size: 6.5 });
    this.menu.index = Math.max(0, BOT_DIFFS.indexOf(saved.diff));
  }

  changeRivals(d) {
    this.rivals = Math.max(2, Math.min(4, this.rivals + d));
    this.game.audio.play('select');
  }

  back() {
    this.game.audio.play('back');
    this.game.setScene(new TeamScene(this.game, { mode: 'campal', team: [this.key] }));
  }

  update(dt) {
    this.t += dt;
    this.menu.update();
    const inp = this.game.input;
    if (inp.wasPressed('left')) this.changeRivals(-1);
    if (inp.wasPressed('right')) this.changeRivals(1);
    if (inp.wasPressed('back')) this.back();
  }

  onPointerMove(x, y) {
    this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    if (inRect(x, y, this.backRect)) return this.back();
    if (inRect(x, y, this.minusRect)) return this.changeRivals(-1);
    if (inRect(x, y, this.plusRect)) return this.changeRivals(1);
    this.menu.pointerDown(x, y);
  }

  render(ctx) {
    const t = this.t;
    this.arena.drawWater(ctx, t);
    dim(ctx, 0.72);
    text(ctx, 'BATALLA CAMPAL', VW / 2, 19, { size: 12, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2.8 });
    text(ctx, '¡El último Pokémon en pie gana!', VW / 2, 29, { size: 5, weight: 800, align: 'center', color: '#e2a8ff' });
    // Tu Pokémon
    panel(ctx, 28, 40, 124, 112, { fill: 'rgba(30,24,50,0.92)', r: 4 });
    text(ctx, 'TU POKÉMON', 90, 50, { size: 4.6, weight: 900, align: 'center', color: '#ffb43b' });
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(90, 100, 22, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCreature(ctx, this.key, 90, 78, 46, { t });
    text(ctx, CREATURES[this.key].name, 90, 113, { size: 7, weight: 900, align: 'center' });
    // Rivales
    text(ctx, 'RIVALES (BOTS)', 90, 126, { size: 4, weight: 900, align: 'center', color: 'rgba(255,255,255,0.75)' });
    this.minusRect = button(ctx, '‹', 46, 130, 14, 14, { color: '#7c4fd0', size: 8, disabled: this.rivals <= 2 });
    this.plusRect = button(ctx, '›', 120, 130, 14, 14, { color: '#7c4fd0', size: 8, disabled: this.rivals >= 4 });
    text(ctx, String(this.rivals), 90, 141.5, { size: 11, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2 });
    text(ctx, '¿QUÉ TAN FUERTES?', 225, 56, { size: 5, weight: 900, align: 'center', color: '#ffffff' });
    this.menu.render(ctx);
    const hint = this.game.input.touchMode ? 'La niebla morada achica el pueblo · ¡escondete en el pasto alto!' : '← → cuántos rivales · ↑ ↓ elegir · ENTER ¡a jugar!';
    text(ctx, hint, VW / 2, 166, { size: 3.8, weight: 700, align: 'center', color: 'rgba(255,255,255,0.75)' });
    this.backRect = backBtn(ctx);
  }
}

function backBtn(ctx) {
  const w = 30;
  roundRect(ctx, 4, 4, w, 9, 2.5);
  ctx.fillStyle = 'rgba(14,10,24,0.8)';
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.stroke();
  text(ctx, '‹ VOLVER', 4 + w / 2, 10, { size: 4, weight: 800, align: 'center' });
  return { x: 4, y: 4, w, h: 9 };
}

// --------------------------------------------------------------- Pelea

export class RoyaleScene extends BattleScene {
  constructor(game, cfg) {
    super(game, cfg);
    this.elim = null;
    this.watching = false;
  }

  createBattle(game, cfg) {
    return new RoyaleBattle(game, cfg);
  }

  onEnter() {
    const g = this.game;
    g.input.setControls(touchLayout());
    g.audio.music('battle');
    g.announcer.onLine = null;
  }

  touchControlsActive() {
    return super.touchControlsActive() && this.battle.player.alive;
  }

  // ¡OTRA!: mismos rivales, mismo Pokémon
  restart() {
    const c = this.cfg;
    this.game.setScene(new RoyaleScene(this.game, { ...c, players: makePlayers(c.key, c.rivals, c.difficulty) }));
  }

  exit() {
    this.game.setScene(new TitleScene(this.game));
  }

  changePokemon() {
    this.game.setScene(new TeamScene(this.game, { mode: 'campal', team: [this.cfg.key] }));
  }

  // Quedaste afuera (la pelea sigue entre los demás)
  buildElim() {
    const b = this.battle;
    const items = [
      { label: 'MIRAR', color: '#3a8fe0', action: () => (this.watching = true) },
      { label: '¡OTRA!', color: '#ff7a2f', action: () => this.restart() },
      { label: 'MENÚ', color: '#7c4fd0', action: () => this.exit() },
    ];
    this.elim = { t: 0, place: b.player.place, menu: new Menu(this.game, items, { x: 120, y: 104, w: 80, h: 13, gap: 3, size: 5.5 }) };
  }

  buildResult() {
    const b = this.battle;
    const g = this.game;
    const won = b.winner === b.player;
    const items = [
      { label: '¡OTRA!', color: '#ff7a2f', action: () => this.restart() },
      { label: 'OTRO POKÉMON', color: '#3a8fe0', action: () => this.changePokemon() },
      { label: 'MENÚ', color: '#7c4fd0', action: () => this.exit() },
    ];
    this.result = { won, menu: new Menu(g, items, { x: 18, y: 120, w: 78, h: 13, gap: 3, size: 5.2 }) };
    this.resultT = 0;
    g.audio.music(won ? 'victory' : null);
  }

  // Mirando: cambia a quién sigue la cámara
  nextWatch(d = 1) {
    const b = this.battle;
    const alive = b.fighters.filter((f) => f.alive);
    if (!alive.length) return;
    const i = alive.indexOf(b.viewed);
    b.viewSide = alive[(i + d + alive.length) % alive.length].side;
    this.game.audio.play('select');
  }

  update(dt) {
    const inp = this.game.input;
    const b = this.battle;
    if (this.result) {
      this.resultT += dt;
      b.update(dt);
      if (this.resultT > 0.6) this.result.menu.update();
      return;
    }
    if (this.paused) {
      this.pauseMenu.update();
      if (inp.wasPressed('pause')) this.paused = false;
      return;
    }
    if (this.elim) this.elim.t += dt;
    if (this.elim && !this.watching) {
      if (this.elim.t > 0.6) this.elim.menu.update();
      if (inp.wasPressed('back')) this.watching = true;
    } else if (inp.wasPressed('pause') && b.state === 'fight') {
      this.pause();
      return;
    }
    if (this.watching) {
      if (inp.wasPressed('right')) this.nextWatch(1);
      if (inp.wasPressed('left')) this.nextWatch(-1);
    }
    b.update(dt);
    if (b.eliminated && !this.elim && b.state === 'fight' && b.eliminated.t > 1.4) this.buildElim();
    if (b.state === 'end') this.buildResult();
  }

  onPointerMove(x, y) {
    if (this.result) this.result.menu.pointerMove(x, y);
    else if (this.paused) this.pauseMenu.pointerMove(x, y);
    else if (this.elim && !this.watching) this.elim.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    const b = this.battle;
    if (this.result) {
      if (this.resultT > 0.6) this.result.menu.pointerDown(x, y);
      return;
    }
    if (this.paused) {
      this.pauseMenu.pointerDown(x, y);
      return;
    }
    if (inRect(x, y, PAUSE_RECT) && b.state === 'fight') return this.pause();
    if (this.elim && !this.watching) {
      if (this.elim.t > 0.6) this.elim.menu.pointerDown(x, y);
      return;
    }
    if (this.watching) {
      if (inRect(x, y, this.watchMenuRect)) {
        this.watching = false;
        return;
      }
      this.nextWatch(1);
    }
  }

  render(ctx) {
    const b = this.battle;
    b.render(ctx);
    if (this.touchControlsActive()) renderTouchControls(ctx, b, this.game.input);
    if (this.elim && !this.watching && !this.result) this.renderElim(ctx);
    if (this.watching && !this.result) {
      text(ctx, this.game.input.touchMode ? 'Tocá para mirar a otro' : '← → mirar a otro', VW / 2, VH - 6, { size: 4.2, weight: 800, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 1.2 });
      this.watchMenuRect = button(ctx, 'OPCIONES', VW - 46, VH - 16, 42, 11, { color: '#7c4fd0', size: 4.6 });
    }
    if (this.paused) {
      dim(ctx, 0.78);
      this.syncPauseLabels();
      text(ctx, 'PAUSA', VW / 2, 32, { size: 13, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
      this.pauseMenu.render(ctx);
    }
    if (this.result) this.renderResult(ctx);
  }

  renderElim(ctx) {
    const e = this.elim;
    const k = ease(Math.min(1, e.t / 0.4));
    ctx.save();
    ctx.globalAlpha = k;
    dim(ctx, 0.55);
    const p = this.battle.player;
    text(ctx, `¡Quedaste ${e.place}º!`, VW / 2, 52, { size: 18 * backOut(Math.min(1, e.t / 0.35)), weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3.5 });
    const line = p.kos > 0 ? `¡Sacaste a ${p.kos} ${p.kos === 1 ? 'rival' : 'rivales'}! ¡Muy bien!` : '¡Buen intento! La próxima te escondés en el pasto alto.';
    text(ctx, line, VW / 2, 66, { size: 5.2, weight: 800, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 1.4 });
    drawCreature(ctx, p.key, VW / 2, 86, 22, { t: this.battle.t });
    ctx.restore();
    if (e.t > 0.6) e.menu.render(ctx);
  }

  // Podio: 1º en el medio, 2º a la izquierda, 3º a la derecha
  renderResult(ctx) {
    const b = this.battle;
    const r = this.result;
    const k = ease(Math.min(1, this.resultT / 0.4));
    ctx.fillStyle = `rgba(10,6,20,${0.76 * k})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.globalAlpha = k;
    const me = b.player;
    const head = r.won ? '¡GANASTE LA BATALLA CAMPAL!' : `¡Quedaste ${me.place}º!`;
    text(ctx, head, VW / 2, 22, { size: (r.won ? 12 : 15) * backOut(Math.min(1, this.resultT / 0.35)), weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
    const ranked = [...b.fighters].sort((p, q) => p.place - q.place);
    const podium = [[ranked[1], 132, 92, 2], [ranked[0], 196, 78, 1], [ranked[2], 260, 104, 3]];
    for (const [f, x, top, place] of podium) {
      if (!f) continue;
      const h = 150 - top;
      roundRect(ctx, x - 24, top, 48, h, 2.5);
      ctx.fillStyle = place === 1 ? '#c9952a' : place === 2 ? '#8f98a8' : '#a5683a';
      ctx.fill();
      text(ctx, `${place}º`, x, top + 12, { size: 9, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
      text(ctx, f === me ? 'TÚ' : f.name, x, top + 21, { size: f === me ? 5.2 : 3.8, weight: 900, align: 'center', color: f === me ? '#ffe66b' : '#ffffff' });
      text(ctx, `${f.kos} ✕`, x, top + 29, { size: 4.2, weight: 900, align: 'center', color: '#1b1224' });
      const bob = place === 1 ? Math.sin(this.resultT * 5) * 1.5 : 0;
      drawCreature(ctx, f.key, x, top - 14 + bob, place === 1 ? 32 : 26, { t: this.resultT + place });
    }
    // Los demás puestos
    ranked.slice(3).forEach((f, i) => {
      text(ctx, `${f.place}º  ${f === me ? 'TÚ' : f.name}  ${f.kos} ✕`, 196, 160 + i * 7, { size: 4.2, weight: 800, align: 'center', color: f === me ? '#ffe66b' : 'rgba(255,255,255,0.75)' });
    });
    panel(ctx, 14, 40, 86, 74, { fill: 'rgba(30,24,50,0.92)', r: 4 });
    text(ctx, 'TU PARTIDA', 57, 49, { size: 4.6, weight: 900, align: 'center', color: '#ffb43b' });
    drawCreature(ctx, me.key, 57, 72, 26, { t: this.resultT });
    const s = b.sideStats[me.side];
    [['RIVALES SACADOS', me.kos], ['DAÑO', s.dealt], ['GOLPES', s.hits]].forEach(([label, v], i) => {
      text(ctx, label, 20, 92 + i * 7.5, { size: 3.6, weight: 800, color: 'rgba(255,255,255,0.7)' });
      text(ctx, String(v), 94, 92 + i * 7.5, { size: 4.4, weight: 900, align: 'right', color: '#ffffff' });
    });
    ctx.restore();
    if (this.resultT > 0.6) r.menu.render(ctx);
  }
}

