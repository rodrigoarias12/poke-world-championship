// Pelea de la aventura: la misma pelea en tiempo real, con niveles, la vida
// que sigue entre peleas, el Pokémon salvaje MAREADO y la Poké Ball.
import { VW, VH } from '../config.js';
import { Battle } from '../battle.js';
import { BattleScene } from '../scenes.js';
import { DIFFICULTY, CREATURES } from '../data.js';
import { Menu } from '../menu.js';
import { text, roundRect, panel, drawCreature, ease, backOut } from '../ui.js';
import { renderTouchControls } from '../hud.js';
import { levelHp, levelPow } from './state.js';
import './arenas.js';

// Perfiles de la IA de la aventura (más suaves que los de la arena)
DIFFICULTY.salvaje ||= { ...DIFFICULTY.facil, label: 'SALVAJE', color: '#5cc45a', dmgMult: 0.45, aggression: 0.25, dodge: 0.03 };
DIFFICULTY.entrenador ||= { ...DIFFICULTY.facil, label: 'ENTRENADOR', color: '#3fa7ff', dmgMult: 0.55, reaction: 0.5, dodge: 0.08 };
DIFFICULTY.rival ||= { ...DIFFICULTY.facil, label: 'RIVAL', color: '#ff7a2f', dmgMult: 0.65, reaction: 0.5 };

const DIZZY_TIME = 6;
const BALL_CD = 1.2;

export function drawBall(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#1b1224';
  ctx.beginPath();
  ctx.arc(0, 0, r + 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8413b';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#1b1224';
  ctx.fillRect(-r, -r * 0.12, r * 2, r * 0.24);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f1ea';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export class AdventureBattle extends Battle {
  constructor(game, cfg) {
    super(game, { ...cfg, gmax: false });
    this.adv = cfg.adv;
    this.balls = cfg.adv.balls || 0;
    this.ballsUsed = 0;
    this.ballCd = 0;
    this.defeated = [];
    this.caught = null;
    this.catchFx = null;
    // Los primeros Pokémon se armaron antes de saber los niveles: se ajustan ahora
    this.fighters.forEach((f, side) => this.applyLevel(f, this.member(side, 0)));
  }

  get wild() {
    return this.adv.kind === 'wild';
  }

  member(side, idx) {
    return this.adv?.members[side][idx];
  }

  makeFighter(side) {
    const f = super.makeFighter(side);
    if (this.adv) this.applyLevel(f, this.member(side, this.teams[side].idx));
    return f;
  }

  applyLevel(f, m) {
    if (!m) return;
    f.level = m.level;
    f.maxHp = levelHp(f.key, m.level);
    f.hp = f.ghostHp = Math.max(1, Math.round(f.maxHp * (m.hp ?? 1)));
    f.pow = levelPow(f.key, m.level);
  }

  // El salvaje mareado no recibe más golpes
  damage(att, def, base, o = {}) {
    if (def.dizzy > 0 || this.catchFx) return false;
    return super.damage(att, def, base, o);
  }

  faint(f) {
    if (this.wild && f.side === 1 && !f.dizzyDone && !this.caught) {
      // En vez de debilitarse queda MAREADO: ahí la Poké Ball atrapa seguro
      f.hp = 0;
      f.dizzy = DIZZY_TIME;
      f.stun = DIZZY_TIME;
      f.action = null;
      f.dashT = 0;
      f.vx = f.vy = f.kx = f.ky = 0;
      f.lift = 0;
      this.effects.float('¡MAREADO!', f.x, f.y - f.tall - 10, { color: '#ffe66b', size: 6.5, life: 1.6 });
      this.audio.play('ready');
      return;
    }
    if (f.side === 1) this.defeated.push({ key: f.key, level: f.level });
    super.faint(f);
  }

  localIntent(side) {
    super.localIntent(side);
    if (this.game.input.wasPressed('gx')) this.throwBall();
  }

  ballsLeft() {
    return this.balls - this.ballsUsed;
  }

  catchChance(w) {
    if (w.dizzy > 0) return 1;
    const hp = w.hp / w.maxHp;
    return Math.max(0.05, Math.min(0.95, 0.6 * (1 - 0.75 * hp)));
  }

  throwBall() {
    const f = this.fighters[0];
    const w = this.fighters[1];
    if (this.state !== 'fight' || this.catchFx || this.cutin || !f.alive) return;
    const say = (str) => {
      this.effects.float(str, f.x, f.y - f.tall - 8, { color: '#ff8a96', size: 5, life: 1.2 });
      this.audio.play('back');
    };
    if (!this.wild) return say('¡No se pueden atrapar Pokémon de entrenadores!');
    if (this.ballsLeft() <= 0) return say('¡No te quedan Poké Balls!');
    if (this.ballCd > 0 || !w.alive) return;
    this.ballsUsed++;
    const p = this.catchChance(w);
    const r = Math.random();
    const ok = r < p;
    const shakes = ok ? 3 : r < p + (1 - p) * 0.4 ? 2 : 1;
    this.catchFx = { t: 0, phase: 'fly', ok, shakes, last: -1, x0: f.x, y0: f.y - f.tall * 0.6, x1: w.x, y1: w.y - Math.min(10, w.tall * 0.4) };
    this.audio.play('ball');
  }

  update(dt) {
    if (this.catchFx) return this.updateCatch(dt);
    super.update(dt);
    this.ballCd = Math.max(0, this.ballCd - dt);
    const w = this.fighters[1];
    if (w.dizzy > 0 && this.state === 'fight' && !this.cutin && this.hitstop <= 0) {
      w.dizzy -= dt;
      w.stun = Math.max(w.stun, 0.2);
      if (w.dizzy <= 0) {
        // No le tiraron la Poké Ball: se debilita y ganás igual
        w.dizzy = 0;
        w.dizzyDone = true;
        w.stun = 0;
        this.faint(w);
      }
    }
  }

  // Mientras la Poké Ball vuela y se sacude, la pelea se congela
  updateCatch(dt) {
    const c = this.catchFx;
    const w = this.fighters[1];
    c.t += dt;
    this.t += dt;
    if (this.flashFx) this.flashFx.a = Math.max(0, this.flashFx.a - dt * 3);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 18);
    this.effects.update(dt);
    if (c.phase === 'fly' && c.t >= 0.45) {
      c.phase = 'shake';
      c.t = 0;
      w.enterT = 0;
      this.effects.burst(c.x1, c.y1, ['#ffffff', '#ff5d5d', '#fff4c0'], { count: 26, speed: 70, size: 2, life: 0.5 });
      this.effects.ring(c.x1, c.y1, '#ffffff', { maxR: 18, life: 0.35, width: 1.5 });
      this.audio.play('orb');
    } else if (c.phase === 'shake') {
      const n = Math.floor(c.t / 0.55);
      if (n !== c.last && n < c.shakes) {
        c.last = n;
        this.audio.play('beep');
      }
      if (c.t >= c.shakes * 0.55 + 0.3) {
        if (c.ok) {
          c.phase = 'caught';
          c.t = 0;
          this.caught = { key: w.key, level: w.level, hp: Math.max(0.15, w.hp / w.maxHp) };
          this.effects.burst(c.x1, c.y1 - 4, ['#ffe66b', '#ffffff', '#fff4c0'], { count: 34, speed: 90, size: 2.2, life: 0.8, up: 30 });
          this.effects.float('¡ATRAPADO!', c.x1, c.y1 - 16, { color: '#ffe66b', size: 8, life: 1.6, vy: -10 });
          this.audio.play('win');
        } else {
          this.effects.float('¡Casi!', c.x1, c.y1 - 12, { color: '#ffffff', size: 7, life: 1.1 });
          this.effects.burst(c.x1, c.y1, ['#ffffff', '#ff5d5d'], { count: 20, speed: 80, size: 2, life: 0.5 });
          this.audio.play('back');
          w.stun = Math.max(w.stun, 1.5);
          this.catchFx = null;
          this.ballCd = BALL_CD;
        }
      }
    } else if (c.phase === 'caught' && c.t >= 1.5) {
      this.catchFx = null;
      this.winner = this.fighters[0];
      this.state = 'end';
    }
  }

  result() {
    const won = this.winner?.side === 0;
    const team = this.teams[0];
    const party = this.adv.members[0].map((m, i) => {
      let hp = m.hp ?? 1;
      if (team.fainted.includes(i)) hp = 0;
      else if (i === team.idx) {
        const f = this.fighters[0];
        hp = f.alive ? f.hp / f.maxHp : 0;
      }
      return { uid: m.uid, hp };
    });
    return { outcome: this.caught ? 'caught' : won ? 'win' : 'lose', party, defeated: this.defeated, caught: this.caught, ballsUsed: this.ballsUsed };
  }

  render(ctx) {
    super.render(ctx);
    const w = this.fighters[1];
    // Poké Ball volando o sacudiéndose
    const c = this.catchFx;
    if (c) {
      if (c.phase === 'fly') {
        const k = c.t / 0.45;
        const x = c.x0 + (c.x1 - c.x0) * k;
        const y = c.y0 + (c.y1 - c.y0) * k - Math.sin(k * Math.PI) * 26;
        drawBall(ctx, x, y, 3.2, k * 12);
      } else {
        const n = Math.floor(c.t / 0.55);
        const local = (c.t % 0.55) / 0.55;
        const shaking = c.phase === 'shake' && n < c.shakes && local < 0.5;
        const rot = shaking ? Math.sin(local * Math.PI * 4) * 0.45 : 0;
        drawBall(ctx, c.x1, c.y1 + 6, 3.6, rot);
        if (c.phase === 'caught') {
          for (let i = 0; i < 3; i++) text(ctx, '★', c.x1 - 8 + i * 8, c.y1 - 4 - Math.sin(c.t * 6 + i) * 2, { size: 5, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1 });
        }
      }
    }
    // Indicador de captura sobre el salvaje
    if (this.wild && w.alive && !c && this.state === 'fight') {
      const p = this.catchChance(w);
      const top = w.y - w.lift - w.tall - 10;
      const color = p >= 1 ? '#4cc44a' : p >= 0.55 ? '#4cc44a' : p >= 0.3 ? '#f2c318' : '#e8413b';
      const pulse = w.dizzy > 0 ? 1 + Math.sin(this.t * 10) * 0.15 : 1;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(w.x, top, 4.6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawBall(ctx, w.x, top, 2.8 * pulse);
      if (w.dizzy > 0) {
        text(ctx, '¡TIRÁ LA POKÉ BALL!', w.x, top - 7, { size: 4.6, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.4 });
      }
    }
    // Nivel de cada uno
    this.fighters.forEach((f, side) => {
      if (!f.level) return;
      const label = `Nv ${f.level}`;
      const x = side === 0 ? 4 : VW - 26;
      roundRect(ctx, x, 37, 22, 7, 3);
      ctx.fillStyle = 'rgba(14,10,24,0.8)';
      ctx.fill();
      text(ctx, label, x + 11, 42.3, { size: 4.4, weight: 900, align: 'center', color: '#ffe66b' });
    });
    // Ranura de la Poké Ball (teclado, donde va el GIGAMAX)
    if (this.wild && !this.game.input.touchMode && this.player) {
      const gx = 4 + 5 * (36 + 0.5) + 4;
      const y = VH - 18;
      roundRect(ctx, gx - 2, y - 2, 36, 19, 2.5);
      ctx.fillStyle = 'rgba(14,10,24,0.72)';
      ctx.fill();
      roundRect(ctx, gx, y, 32, 15, 1.5);
      ctx.fillStyle = this.ballsLeft() > 0 ? '#5a1a22' : '#2a1020';
      ctx.fill();
      roundRect(ctx, gx + 1.2, y + 1.2, 5.2, 4.6, 1);
      ctx.fillStyle = '#f4f1ea';
      ctx.fill();
      text(ctx, 'R', gx + 3.8, y + 4.7, { size: 3, weight: 900, align: 'center', color: '#1b1224' });
      drawBall(ctx, gx + 26, y + 5, 2.6);
      text(ctx, `×${this.ballsLeft()}`, gx + 16, y + 6, { size: 3.6, weight: 900, color: '#ffffff' });
      text(ctx, 'POKÉ BALL', gx + 1.5, y + 12.5, { size: 3.2, weight: 900, color: '#ffffff' });
    }
  }
}

// ---------------------------------------------------------------- Escena

export class AdventureBattleScene extends BattleScene {
  constructor(game, cfg) {
    super(game, cfg);
    const audio = game.audio;
    const musicItem = { label: '', color: '#2e9e8f', action: () => { audio.toggleMusic(); this.syncPauseLabels(); } };
    const sfxItem = { label: '', color: '#2e9e8f', action: () => { audio.toggleSfx(); this.syncPauseLabels(); } };
    this.pauseItems = { musicItem, sfxItem, voiceItem: {}, langItem: {} };
    const items = [{ label: 'SEGUIR', color: '#4cc44a', action: () => (this.paused = false) }, musicItem, sfxItem];
    if (cfg.adv.kind === 'wild') items.push({ label: 'ESCAPAR', color: '#c43b4f', action: () => this.flee() });
    this.pauseMenu = new Menu(game, items, { x: 110, y: 56, w: 100, h: 14, gap: 3, size: 5.5 });
    this.syncPauseLabels();
  }

  createBattle(game, cfg) {
    return new AdventureBattle(game, cfg);
  }

  onEnter() {
    super.onEnter();
    this.game.audio.music(this.cfg.adv.kind === 'wild' ? 'battle' : 'boss');
  }

  restart() {}

  exit() {
    this.flee();
  }

  flee() {
    if (this.cfg.adv.kind !== 'wild' || this.result) return;
    const res = this.battle.result();
    Object.assign(res, { outcome: 'fled', defeated: [], caught: null });
    this.game.audio.play('dash');
    this.cfg.onDone(res, ['¡Escapaste sin problemas!']);
  }

  buildResult() {
    const res = this.battle.result();
    const lines = this.cfg.onResult(res);
    const won = res.outcome !== 'lose';
    this.result = {
      res,
      won,
      lines,
      menu: new Menu(this.game, [{ label: 'CONTINUAR', color: '#4cc44a', action: () => this.cfg.onDone(res) }], { x: 120, y: 150, w: 80, h: 15, size: 6.5 }),
    };
    this.resultT = 0;
    this.game.audio.music(won ? 'victory' : null);
  }

  render(ctx) {
    const b = this.battle;
    b.render(ctx);
    if (this.touchControlsActive()) {
      renderTouchControls(ctx, b, this.game.input);
      // Botón de la Poké Ball (en el lugar del GIGA)
      if (b.wild && this.game.input.touchMode) {
        const x = 303;
        const y = 82;
        ctx.save();
        ctx.globalAlpha = b.ballsLeft() > 0 ? 0.95 : 0.5;
        ctx.fillStyle = 'rgba(10,6,20,0.6)';
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        drawBall(ctx, x, y - 1, 6.5);
        text(ctx, `×${b.ballsLeft()}`, x, y + 9, { size: 3.6, weight: 900, align: 'center', color: '#fff', stroke: '#1b1224', strokeW: 1 });
        ctx.restore();
      }
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(12,8,22,0.78)';
      ctx.fillRect(0, 0, VW, VH);
      this.syncPauseLabels();
      text(ctx, 'PAUSA', VW / 2, 44, { size: 13, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
      this.pauseMenu.render(ctx);
    }
    if (this.result) this.renderSummary(ctx);
  }

  renderSummary(ctx) {
    const r = this.result;
    const b = this.battle;
    const k = ease(this.resultT / 0.4);
    ctx.fillStyle = `rgba(10,6,20,${0.78 * k})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.globalAlpha = k;
    const title = r.res.outcome === 'caught' ? '¡ATRAPADO!' : r.won ? '¡GANASTE!' : 'Tus Pokémon están cansados…';
    const big = r.won;
    text(ctx, title, VW / 2, 36, { size: (big ? 17 : 10) * backOut(Math.min(1, this.resultT / 0.35)), weight: 900, align: 'center', color: big ? '#ffe66b' : '#ffb0b8', stroke: '#1b1224', strokeW: 3 });
    if (r.res.outcome === 'caught') {
      const c = r.res.caught;
      drawCreature(ctx, c.key, VW / 2, 66 + Math.sin(this.resultT * 4) * 1.5, 34, { t: this.resultT });
      text(ctx, `${CREATURES[c.key].name}  ·  Nv ${c.level}`, VW / 2, 92, { size: 6, weight: 900, align: 'center' });
    } else {
      b.teams[0].keys.forEach((key, i) => drawCreature(ctx, key, VW / 2 - 32 + i * 32, 66 + Math.sin(this.resultT * 4 + i) * 1.5, 26, { t: this.resultT + i }));
    }
    const lines = r.lines.length ? r.lines : [r.won ? '¡Bien hecho!' : '¡Vamos a descansar y volver a intentarlo!'];
    panel(ctx, 40, 98, 240, 10 + lines.length * 8, { fill: 'rgba(30,24,50,0.92)', r: 4 });
    lines.slice(0, 6).forEach((l, i) => text(ctx, l, VW / 2, 106 + i * 8, { size: 4.8, weight: 800, align: 'center', color: '#ffffff' }));
    ctx.restore();
    if (this.resultT > 0.5) r.menu.render(ctx);
  }
}
