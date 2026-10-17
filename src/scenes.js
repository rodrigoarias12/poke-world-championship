import { VW, VH } from './config.js';
import { CREATURES, ROSTER, TYPES, MOVES, DIFFICULTY, ARENAS, TOURNAMENT_DIFFICULTY, GAME_NAME, LEAGUE_NAME, KEY_LABELS, allSpriteIds, strongAgainst } from './data.js';
import { loadSprites } from './sprites.js';
import { Arena } from './arena.js';
import { Battle } from './battle.js';
import { Menu } from './menu.js';
import { touchLayout, renderTouchControls, PAUSE_RECT } from './hud.js';
import { OnlineScene } from './scenes-online.js';
import { saveTeam } from './team.js';

const urlParams = new URLSearchParams(location.search);

import { text, textWidth, roundRect, panel, typeBadge, drawCreature, button, inRect, backOut, ease } from './ui.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pick3 = (exclude = []) => shuffle(ROSTER.filter((k) => !exclude.includes(k))).slice(0, 3);

function loadChampions() {
  try {
    return JSON.parse(localStorage.getItem('arena-brava-champs') || '[]');
  } catch {
    return [];
  }
}

function saveChampions(keys) {
  try {
    const list = loadChampions();
    for (const k of keys) if (!list.includes(k)) list.push(k);
    localStorage.setItem('arena-brava-champs', JSON.stringify(list));
  } catch { /* almacenamiento no disponible */ }
}

function backButton(ctx, label = 'VOLVER') {
  const w = textWidth(ctx, label, 4) + 11;
  roundRect(ctx, 4, 4, w, 9, 2.5);
  ctx.fillStyle = 'rgba(14,10,24,0.8)';
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.stroke();
  text(ctx, `‹ ${label}`, 4 + w / 2, 10, { size: 4, weight: 800, align: 'center' });
  return { x: 0, y: 0, w: w + 8, h: 16 };
}

// Botones de música (♪) y efectos (parlante) arriba a la derecha
function soundButtons(ctx, audio) {
  const draw = (x, on, icon) => {
    roundRect(ctx, x, 4, 11, 9, 2.5);
    ctx.fillStyle = 'rgba(14,10,24,0.8)';
    ctx.fill();
    ctx.fillStyle = '#fff';
    if (icon === 'music') {
      text(ctx, '♪', x + 5.5, 11.2, { size: 8, weight: 900, align: 'center', color: '#fff' });
    } else {
      ctx.fillRect(x + 2.4, 7.4, 1.8, 2.2);
      ctx.beginPath();
      ctx.moveTo(x + 4, 7.4);
      ctx.lineTo(x + 6.2, 5.8);
      ctx.lineTo(x + 6.2, 11.2);
      ctx.lineTo(x + 4, 9.6);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(x + 6.6, 8.5, 1.8, -0.9, 0.9);
      ctx.stroke();
    }
    if (!on) {
      ctx.strokeStyle = '#ff5d73';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x + 1.8, 5.6);
      ctx.lineTo(x + 9.2, 11.4);
      ctx.stroke();
    }
  };
  draw(VW - 27, audio.musicOn, 'music');
  draw(VW - 14, audio.sfxOn, 'sfx');
  // Relator: micrófono con el idioma
  const ann = audio.announcer;
  if (ann) {
    const x = VW - 46;
    roundRect(ctx, x, 4, 17, 9, 2.5);
    ctx.fillStyle = 'rgba(14,10,24,0.8)';
    ctx.fill();
    roundRect(ctx, x + 2.4, 5.4, 2.8, 4.2, 1.4);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x + 3.8, 8.2, 2.3, 0, Math.PI);
    ctx.moveTo(x + 3.8, 10.5);
    ctx.lineTo(x + 3.8, 11.8);
    ctx.stroke();
    text(ctx, ann.short, x + 11.5, 10.6, { size: 3.6, weight: 900, align: 'center', color: ann.mode === 'off' ? '#ff5d73' : '#ffe66b' });
  }
  return { music: { x: VW - 29, y: 0, w: 13, h: 16 }, sfx: { x: VW - 16, y: 0, w: 16, h: 16 }, voice: { x: VW - 48, y: 0, w: 19, h: 16 } };
}

function handleSoundTap(x, y, rects, audio) {
  if (!rects) return false;
  if (inRect(x, y, rects.music)) {
    audio.toggleMusic();
    return true;
  }
  if (inRect(x, y, rects.sfx)) {
    audio.toggleSfx();
    return true;
  }
  if (inRect(x, y, rects.voice) && audio.announcer) {
    audio.unlock();
    audio.announcer.cycle();
    return true;
  }
  return false;
}

function dim(ctx, a = 0.7) {
  ctx.fillStyle = `rgba(12,8,22,${a})`;
  ctx.fillRect(0, 0, VW, VH);
}

function title(ctx, str, y = 17) {
  text(ctx, str, VW / 2, y, { size: 10, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2.5 });
}

export function drawLogo(ctx, cx, cy, t, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.save();
  ctx.rotate(t * 0.15);
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.fillStyle = i % 2 ? 'rgba(255,180,59,0.22)' : 'rgba(255,122,47,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(90, -11);
    ctx.lineTo(90, 11);
    ctx.fill();
  }
  ctx.restore();
  ctx.rotate(-0.04);
  // POKÉ WORLD
  const g1 = ctx.createLinearGradient(0, -30, 0, -6);
  g1.addColorStop(0, '#fff3a0');
  g1.addColorStop(0.5, '#ffd23f');
  g1.addColorStop(1, '#ff8a1f');
  text(ctx, 'POKÉ WORLD', 0, -6, { size: 25, weight: 900, align: 'center', color: '#1b1224', stroke: '#1b1224', strokeW: 7 });
  text(ctx, 'POKÉ WORLD', 0, -6, { size: 25, weight: 900, align: 'center', color: g1, stroke: '#3a7bd5', strokeW: 1.6 });
  // Cinta roja con CHAMPIONSHIP
  const w = 74;
  ctx.fillStyle = '#1b1224';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * (w - 6), 6);
    ctx.lineTo(s * (w + 14), 6);
    ctx.lineTo(s * (w + 8), 14);
    ctx.lineTo(s * (w + 14), 22);
    ctx.lineTo(s * (w - 6), 22);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(0, 0);
    ctx.fillStyle = '#a82a22';
    ctx.beginPath();
    ctx.moveTo(s * (w - 6), 7.2);
    ctx.lineTo(s * (w + 11.5), 7.2);
    ctx.lineTo(s * (w + 6), 14);
    ctx.lineTo(s * (w + 11.5), 20.8);
    ctx.lineTo(s * (w - 6), 20.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  roundRect(ctx, -w, 2, w * 2, 17, 2);
  ctx.fillStyle = '#1b1224';
  ctx.fill();
  roundRect(ctx, -w + 1.2, 3.2, w * 2 - 2.4, 14.6, 1.5);
  ctx.fillStyle = '#e8413b';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(-w + 2, 4, w * 2 - 4, 4);
  text(ctx, 'CHAMPIONSHIP', 0, 15.5, { size: 12.5, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
  // Estrellas a los costados
  for (const s of [-1, 1]) {
    const sx = s * 58;
    const tw = 1 + Math.sin(t * 4 + s) * 0.15;
    ctx.save();
    ctx.translate(sx, -30);
    ctx.scale(tw, tw);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 ? 2.2 : 5;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe66b';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1b1224';
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// --------------------------------------------------------------- Cargando

export class LoadingScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    const ids = allSpriteIds();
    this.total = ids.length;
    this.done = 0;
    this.finished = false;
    loadSprites(ids, (n) => (this.done = n)).then(() => (this.finished = true));
    game.audio.loadCries(ids);
  }

  update(dt) {
    this.t += dt;
    // Sin internet seguimos a los 15 s con los dibujos de respaldo
    if ((this.finished && this.t > 0.3) || this.t > 15) {
      const g = this.game;
      // Links directos: ?sala=1234 (invitación), ?crear (invitar), ?buscar (buscar rival)
      if (/^\d{4}$/.test(urlParams.get('sala') || '')) g.setScene(new OnlineScene(g, { join: urlParams.get('sala') }));
      else if (urlParams.has('crear')) g.setScene(new OnlineScene(g, { create: /^\d{4}$/.test(urlParams.get('crear')) ? urlParams.get('crear') : true }));
      else if (urlParams.has('buscar')) g.setScene(new OnlineScene(g));
      else g.setScene(new TitleScene(g));
    }
  }

  render(ctx) {
    ctx.fillStyle = '#16294f';
    ctx.fillRect(0, 0, VW, VH);
    const cx = VW / 2;
    const cy = 72;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(this.t * 6) * 0.5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1b1224';
    ctx.fillStyle = '#e8413b';
    ctx.beginPath();
    ctx.arc(0, 0, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#1b1224';
    ctx.fillRect(-16, -1.3, 32, 2.6);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text(ctx, 'CARGANDO POKÉMON…', cx, 108, { size: 7, weight: 900, align: 'center', color: '#ffe66b' });
    const k = this.done / this.total;
    roundRect(ctx, cx - 60, 116, 120, 6, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    roundRect(ctx, cx - 60, 116, Math.max(6, 120 * k), 6, 3);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    text(ctx, `${this.done} / ${this.total}`, cx, 131, { size: 4, weight: 700, align: 'center', color: 'rgba(255,255,255,0.6)' });
  }
}

// ----------------------------------------------------------------- Título

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.arena = new Arena('piscina', 3);
    this.parade = ['pikachu', 'charizard', 'lapras', 'gyarados', 'eevee', 'snorlax'];
    const items = [
      { label: 'JUGAR EN LÍNEA', sub: '¡contra otra persona, ya!', color: '#2e9e8f', action: () => game.setScene(new OnlineScene(game)) },
      { label: 'TORNEO', sub: '4 combates y un jefe mega', color: '#ff7a2f', action: () => game.setScene(new TeamScene(game, { mode: 'torneo' })) },
      { label: 'COMBATE', sub: 'tu equipo contra la IA', color: '#3a8fe0', action: () => game.setScene(new TeamScene(game, { mode: 'libre' })) },
      { label: 'CÓMO JUGAR', sub: 'teclas y tipos', color: '#7c4fd0', action: () => game.setScene(new HowToScene(game)) },
    ];
    this.menu = new Menu(game, items, { x: 110, y: 94, w: 100, h: 15, gap: 4, size: 6.5 });
    game.audio.music('menu');
  }

  update(dt) {
    this.t += dt;
    this.arena.update(dt);
    this.menu.update();
  }

  onPointerMove(x, y) {
    this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    if (handleSoundTap(x, y, this.soundRects, this.game.audio)) return;
    this.menu.pointerDown(x, y);
  }

  render(ctx) {
    const t = this.t;
    this.arena.drawWater(ctx, t);
    // Pokémon flotando a los costados
    const spots = [[40, 80], [62, 150], [28, 126], [280, 82], [258, 152], [292, 128]];
    this.parade.forEach((key, i) => {
      const [x, y] = spots[i];
      const bob = Math.sin(t * 2 + i) * 1.5;
      ctx.fillStyle = 'rgba(5,20,50,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCreature(ctx, key, x, y - 13 + bob, 30, { faceLeft: i >= 3, t: t + i });
    });
    dim(ctx, 0.25);
    drawLogo(ctx, VW / 2, 52 + Math.sin(t * 2) * 1.5, t, 1);
    text(ctx, '¡EL CAMPEONATO MUNDIAL DE COMBATES POKÉMON!', VW / 2, 88, { size: 4.6, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.5 });
    this.menu.render(ctx);
    this.soundRects = soundButtons(ctx, this.game.audio);
    const audio = this.game.audio;
    if (!audio.ready && !audio.silent) {
      // El navegador no deja sonar nada hasta el primer toque
      const a = 0.65 + Math.sin(this.t * 5) * 0.35;
      roundRect(ctx, VW / 2 - 80, 167, 160, 10, 3);
      ctx.fillStyle = 'rgba(14,10,24,0.85)';
      ctx.fill();
      text(ctx, '♪ Toca o aprieta una tecla para activar el sonido', VW / 2, 174, { size: 4.4, weight: 900, align: 'center', color: '#ffe66b', alpha: a });
    } else {
      const hint = this.game.input.touchMode ? 'Toca una opción' : '↑ ↓ elegir  ·  ENTER confirmar  ·  M música  ·  N sonidos  ·  V relator';
      text(ctx, hint, VW / 2, 175, { size: 3.6, weight: 700, align: 'center', color: 'rgba(255,255,255,0.8)', stroke: '#1b1224', strokeW: 1 });
    }
  }
}

// ----------------------------------------------------------- Armar equipo

const STAT_RANGE = { hp: [90, 175], speed: [80, 130], pow: [0.95, 1.2], def: [0.9, 1.18] };

export class TeamScene {
  constructor(game, { mode, team = [] }) {
    this.game = game;
    this.mode = mode;
    this.team = [...team];
    this.index = 0;
    this.t = 0;
    this.cards = [];
    this.champs = loadChampions();
    this.arena = new Arena('noche', 11);
    game.audio.music('menu');
    this.original = [...team];
  }

  get selected() {
    return ROSTER[this.index];
  }

  toggle(key) {
    const i = this.team.indexOf(key);
    if (i >= 0) {
      this.team.splice(i, 1);
      this.game.audio.play('back');
    } else if (this.team.length < 3) {
      this.team.push(key);
      this.game.audio.cry(CREATURES[key].id);
    } else {
      this.game.audio.play('back');
    }
  }

  random() {
    this.team = pick3();
    this.game.audio.play('confirm');
    this.game.audio.cry(CREATURES[this.team[0]].id, { vol: 0.35 });
  }

  done() {
    if (this.team.length < 3) return;
    const g = this.game;
    g.audio.play('confirm');
    saveTeam(this.team);
    if (this.mode === 'online') {
      g.setScene(new OnlineScene(g, { team: this.team }));
      return;
    }
    if (this.mode === 'torneo') {
      const used = [];
      const rivals = [];
      for (let r = 0; r < 4; r++) {
        const team = pick3([...used]);
        used.push(...team);
        if (used.length > 10) used.splice(0, 6);
        rivals.push(team);
      }
      g.setScene(new BracketScene(g, { team: this.team, rivals, round: 0, arenas: shuffle([...ARENAS, 'piscina']) }));
    } else {
      g.setScene(new DifficultyScene(g, { team: this.team }));
    }
  }

  back() {
    this.game.audio.play('back');
    if (this.mode === 'online') return this.game.setScene(new OnlineScene(this.game, { team: this.original.length === 3 ? this.original : null }));
    this.game.setScene(new TitleScene(this.game));
  }

  update(dt) {
    this.t += dt;
    const inp = this.game.input;
    const n = ROSTER.length;
    if (inp.wasPressed('right')) this.index = (this.index + 1) % n;
    if (inp.wasPressed('left')) this.index = (this.index - 1 + n) % n;
    if (inp.wasPressed('down') || inp.wasPressed('up')) this.index = (this.index + 8) % n;
    if (['right', 'left', 'up', 'down'].some((k) => inp.wasPressed(k))) this.game.audio.play('select');
    if (inp.wasPressed('confirm')) {
      // Con el equipo completo, ENTER sobre otro Pokémon empieza
      if (this.team.length === 3 && !this.team.includes(this.selected)) this.done();
      else this.toggle(this.selected);
    }
    if (inp.wasPressed('m4')) this.done();
    if (inp.wasPressed('back')) this.back();
  }

  onPointerDown(x, y) {
    if (inRect(x, y, this.backRect)) return this.back();
    if (inRect(x, y, this.okRect)) return this.done();
    if (inRect(x, y, this.randRect)) return this.random();
    const slot = (this.slotRects || []).findIndex((r) => inRect(x, y, r));
    if (slot >= 0 && this.team[slot]) return this.toggle(this.team[slot]);
    const i = this.cards.findIndex((r) => inRect(x, y, r));
    if (i >= 0) {
      if (i === this.index || this.game.input.touchMode) this.toggle(ROSTER[i]);
      this.index = i;
      this.game.audio.play('select');
    }
  }

  render(ctx) {
    const t = this.t;
    this.arena.drawWater(ctx, t);
    dim(ctx, 0.72);
    title(ctx, this.mode === 'torneo' ? 'ARMA TU EQUIPO · TORNEO' : this.mode === 'online' ? 'TU EQUIPO PARA JUGAR EN LÍNEA' : 'ARMA TU EQUIPO');

    // Grilla de 16
    this.cards = ROSTER.map((key, i) => {
      const c = CREATURES[key];
      const col = i % 8;
      const row = Math.floor(i / 8);
      const x = 10 + col * 37.6;
      const y = 22 + row * 36;
      const sel = i === this.index;
      const inTeam = this.team.indexOf(key);
      roundRect(ctx, x, y, 35, 33, 3);
      ctx.fillStyle = sel ? '#2d2350' : 'rgba(40,32,64,0.88)';
      ctx.fill();
      ctx.save();
      roundRect(ctx, x, y, 35, 33, 3);
      ctx.clip();
      ctx.fillStyle = TYPES[c.type].color;
      ctx.globalAlpha = sel ? 0.55 : 0.28;
      ctx.fillRect(x, y, 35, 24);
      ctx.restore();
      if (sel || inTeam >= 0) {
        ctx.lineWidth = sel ? 1.3 : 0.9;
        ctx.strokeStyle = sel ? '#ffffff' : '#ffe66b';
        roundRect(ctx, x, y, 35, 33, 3);
        ctx.stroke();
      }
      drawCreature(ctx, key, x + 17.5, y + 12, 22, { t: sel ? t : 0 });
      text(ctx, c.name, x + 17.5, y + 30, { size: c.name.length > 8 ? 3 : 3.6, weight: 900, align: 'center' });
      if (inTeam >= 0) {
        ctx.beginPath();
        ctx.arc(x + 31, y + 4, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffe66b';
        ctx.fill();
        text(ctx, String(inTeam + 1), x + 31, y + 5.5, { size: 4, weight: 900, align: 'center', color: '#1b1224' });
      }
      if (this.champs.includes(key)) text(ctx, '★', x + 4, y + 6, { size: 4.5, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1 });
      return { x, y, w: 35, h: 33 };
    });

    // Detalle
    const key = this.selected;
    const c = CREATURES[key];
    const py = 98;
    panel(ctx, 10, py, 196, 77, { fill: 'rgba(30,24,50,0.94)', r: 4 });
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(36, py + 62, 20, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCreature(ctx, key, 36, py + 36, 50, { t });
    text(ctx, c.name, 64, py + 11, { size: 8, weight: 900 });
    typeBadge(ctx, c.type, 64, py + 14, { size: 3.4 });
    const strong = strongAgainst(c.type).map((x) => TYPES[x].name).join(', ') || '—';
    text(ctx, `Fuerte contra: ${strong}`, 64, py + 25.5, { size: 3.2, weight: 700, color: '#ffb43b' });
    const stats = [['VIDA', c.hp, 'hp', '#4fd65a'], ['VEL.', c.speed, 'speed', '#3fa7ff'], ['PODER', c.pow, 'pow', '#ff7a2f'], ['DEF.', c.def, 'def', '#a8907a']];
    stats.forEach(([label, v, k2, color], i) => {
      const [lo, hi] = STAT_RANGE[k2];
      const k = Math.min(1, 0.15 + ((v - lo) / (hi - lo)) * 0.85);
      const x = 14 + i * 24;
      text(ctx, label, x, py + 73, { size: 2.6, weight: 800, color: 'rgba(255,255,255,0.7)' });
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x, py + 67.5, 20, 2.4);
      ctx.fillStyle = color;
      ctx.fillRect(x, py + 67.5, 20 * k * ease(Math.min(1, t * 3)), 2.4);
    });
    c.moves.forEach((mk, i) => {
      const m = MOVES[mk];
      const y = py + 31 + i * 8.6;
      const label = KEY_LABELS[i];
      const kw = textWidth(ctx, label, 3) + 2.6;
      roundRect(ctx, 112, y, kw, 5.4, 1.2);
      ctx.fillStyle = i === 4 ? '#ffd23f' : '#f4f1ea';
      ctx.fill();
      text(ctx, label, 112 + kw / 2, y + 4, { size: 3, weight: 900, align: 'center', color: '#1b1224' });
      text(ctx, m.name, 114 + kw, y + 4.3, { size: 4, weight: 800 });
    });

    // Equipo
    panel(ctx, 212, py, 98, 77, { fill: 'rgba(30,24,50,0.94)', r: 4 });
    text(ctx, 'TU EQUIPO', 261, py + 9, { size: 4.6, weight: 900, align: 'center', color: '#ffe66b' });
    this.slotRects = [0, 1, 2].map((i) => {
      const sx = 228 + i * 33;
      const sy = py + 26;
      ctx.beginPath();
      ctx.arc(sx, sy, 13, 0, Math.PI * 2);
      ctx.fillStyle = this.team[i] ? '#f4f1ea' : 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = this.team[i] ? TYPES[CREATURES[this.team[i]].type].color : 'rgba(255,255,255,0.3)';
      ctx.stroke();
      if (this.team[i]) drawCreature(ctx, this.team[i], sx, sy + 1, 22, { t: t + i });
      else text(ctx, String(i + 1), sx, sy + 2.5, { size: 7, weight: 900, align: 'center', color: 'rgba(255,255,255,0.25)' });
      return { x: sx - 13, y: sy - 13, w: 26, h: 26 };
    });
    this.randRect = button(ctx, 'AL AZAR', 218, py + 44, 86, 12, { color: '#7c4fd0', size: 4.6 });
    const ready = this.team.length === 3;
    this.okRect = button(ctx, ready ? '¡LISTO!' : `ELIGE ${3 - this.team.length} MÁS`, 218, py + 60, 86, 13, { color: ready ? '#ff7a2f' : '#4a4458', size: 5, selected: ready, disabled: !ready });
    if (!ready) this.okRect = null;
    const hint = this.game.input.touchMode ? 'Toca dos veces para sumar al equipo' : 'Flechas: elegir · ENTER: sumar/quitar · E: ¡listo!';
    text(ctx, hint, VW / 2, 95.5, { size: 3.2, weight: 700, align: 'center', color: 'rgba(255,255,255,0.65)' });
    this.backRect = backButton(ctx);
  }
}

// --------------------------------------------------------------- Dificultad

export class DifficultyScene {
  constructor(game, { team }) {
    this.game = game;
    this.team = team;
    this.rivals = pick3();
    this.boss = false;
    this.t = 0;
    this.arena = new Arena('lago', 5);
    game.audio.music('menu');
    const start = (d) => () => {
      game.setScene(new BattleScene(game, {
        mode: 'libre',
        teamA: team,
        teamB: this.rivals,
        bossLast: this.boss,
        difficulty: d,
        arena: ARENAS[Math.floor(Math.random() * ARENAS.length)],
        round: 'COMBATE',
      }));
    };
    this.menu = new Menu(game, [
      { label: 'FÁCIL', sub: 'para aprender', color: DIFFICULTY.facil.color, action: start('facil') },
      { label: 'NORMAL', sub: 'un buen desafío', color: DIFFICULTY.normal.color, action: start('normal') },
      { label: 'DIFÍCIL', sub: 'esquiva casi todo', color: DIFFICULTY.dificil.color, action: start('dificil') },
      { label: 'JEFE', sub: 'reflejos de campeón', color: DIFFICULTY.jefe.color, action: start('jefe') },
    ], { x: 110, y: 74, w: 100, h: 17, gap: 4, size: 6.5 });
  }

  update(dt) {
    this.t += dt;
    this.menu.update();
    const inp = this.game.input;
    if (inp.wasPressed('left') || inp.wasPressed('right')) {
      this.boss = !this.boss;
      this.game.audio.play('select');
    }
    if (inp.wasPressed('m3')) this.reroll();
    if (inp.wasPressed('back')) this.back();
  }

  reroll() {
    this.rivals = pick3();
    this.game.audio.play('select');
  }

  back() {
    this.game.audio.play('back');
    this.game.setScene(new TeamScene(this.game, { mode: 'libre', team: this.team }));
  }

  onPointerMove(x, y) {
    this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    if (inRect(x, y, this.backRect)) return this.back();
    if (inRect(x, y, this.bossRect)) {
      this.boss = !this.boss;
      this.game.audio.play('select');
      return;
    }
    if (inRect(x, y, this.rerollRect)) return this.reroll();
    this.menu.pointerDown(x, y);
  }

  teamBox(ctx, keys, x, label, color, faceLeft, boss) {
    const t = this.t;
    panel(ctx, x, 30, 90, 116, { fill: 'rgba(30,24,50,0.92)', r: 4 });
    text(ctx, label, x + 45, 40, { size: 5, weight: 900, align: 'center', color });
    keys.forEach((k, i) => {
      const y = 62 + i * 30;
      const isBoss = boss && i === keys.length - 1;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x + 24, y + 11, 13, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCreature(ctx, k, x + 24, y, isBoss ? 30 : 26, { faceLeft, boss: isBoss, t: t + i });
      const name = isBoss ? CREATURES[k].boss.name : CREATURES[k].name;
      text(ctx, name, x + 42, y + 1, { size: name.length > 11 ? 3.2 : 4.2, weight: 900 });
      typeBadge(ctx, CREATURES[k].type, x + 42, y + 3.5, { size: 2.6 });
    });
  }

  render(ctx) {
    this.arena.drawWater(ctx, this.t);
    dim(ctx, 0.72);
    title(ctx, 'ELIGE LA DIFICULTAD');
    this.teamBox(ctx, this.team, 8, 'TU EQUIPO', '#ffe66b', false, false);
    this.teamBox(ctx, this.rivals, VW - 98, 'RIVALES', '#ff7a8a', true, this.boss);
    this.menu.render(ctx);
    // Interruptor de jefe
    const bx = 110;
    const by = 160;
    roundRect(ctx, bx, by, 100, 14, 4);
    ctx.fillStyle = this.boss ? '#7a1f55' : 'rgba(40,32,64,0.9)';
    ctx.fill();
    text(ctx, 'ÚLTIMO RIVAL MEGA', bx + 5, by + 6.5, { size: 4, weight: 900 });
    text(ctx, '← → para cambiar', bx + 5, by + 11.5, { size: 2.8, weight: 600, color: 'rgba(255,255,255,0.7)' });
    roundRect(ctx, bx + 82, by + 3.5, 14, 7, 3.5);
    ctx.fillStyle = this.boss ? '#e0399a' : '#4a4458';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.boss ? bx + 92.5 : bx + 85.5, by + 7, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    this.bossRect = { x: bx, y: by, w: 100, h: 14 };
    this.rerollRect = button(ctx, 'OTROS RIVALES (Q)', VW - 98, 150, 90, 12, { color: '#7c4fd0', size: 3.8 });
    this.backRect = backButton(ctx);
  }
}

// ------------------------------------------------------------------ Torneo

export class BracketScene {
  constructor(game, tour) {
    this.game = game;
    this.tour = tour;
    this.t = 0;
    this.arena = new Arena('noche', 21 + tour.round);
    game.audio.music('menu');
    const final = tour.round === 3;
    this.menu = new Menu(game, [{ label: final ? '¡GRAN FINAL!' : '¡A PELEAR!', color: final ? '#e0399a' : '#ff7a2f', action: () => this.fight() }], { x: 110, y: 160, w: 100, h: 16, size: 7 });
  }

  fight() {
    const { tour, game } = this;
    const r = tour.round;
    game.setScene(new BattleScene(game, {
      mode: 'torneo',
      tour,
      teamA: tour.team,
      teamB: tour.rivals[r],
      bossLast: r === 3,
      difficulty: TOURNAMENT_DIFFICULTY[r],
      arena: r === 3 ? 'noche' : tour.arenas[r],
      round: r === 3 ? 'GRAN FINAL' : `RONDA ${r + 1}`,
    }));
  }

  goMenu() {
    this.game.audio.play('back');
    this.game.setScene(new TitleScene(this.game));
  }

  update(dt) {
    this.t += dt;
    this.menu.update();
    if (this.game.input.wasPressed('back')) this.goMenu();
  }

  onPointerMove(x, y) {
    this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    if (inRect(x, y, this.backRect)) return this.goMenu();
    this.menu.pointerDown(x, y);
  }

  render(ctx) {
    const { t, tour } = this;
    this.arena.drawWater(ctx, t);
    dim(ctx, 0.72);
    title(ctx, LEAGUE_NAME);
    // Tu equipo
    panel(ctx, 8, 26, 70, 128, { fill: 'rgba(30,24,50,0.92)', r: 4 });
    text(ctx, 'TU EQUIPO', 43, 36, { size: 4.4, weight: 900, align: 'center', color: '#ffe66b' });
    tour.team.forEach((k, i) => {
      drawCreature(ctx, k, 43, 58 + i * 32, 26, { t: t + i });
      text(ctx, CREATURES[k].name, 43, 74 + i * 32, { size: 3.4, weight: 900, align: 'center' });
    });
    // Rondas
    for (let r = 0; r < 4; r++) {
      const y = 26 + r * 32;
      const done = r < tour.round;
      const current = r === tour.round;
      const final = r === 3;
      roundRect(ctx, 84, y, 228, 29, 4);
      ctx.fillStyle = current ? (final ? '#5a1d45' : '#3a2a5e') : 'rgba(30,24,50,0.88)';
      ctx.fill();
      if (current) {
        ctx.lineWidth = 1 + Math.sin(t * 6) * 0.3;
        ctx.strokeStyle = final ? '#ff7ac4' : '#ffe66b';
        ctx.stroke();
      }
      text(ctx, final ? 'FINAL' : `R${r + 1}`, 99, y + 17, { size: final ? 5 : 7, weight: 900, align: 'center', color: final ? '#ff7ac4' : '#ffe66b' });
      const reveal = done || current;
      tour.rivals[r].forEach((k, i) => {
        const isBoss = final && i === 2;
        drawCreature(ctx, k, 128 + i * 30, y + 14, isBoss ? 26 : 22, { faceLeft: true, white: !reveal, alpha: reveal ? 1 : 0.22, boss: isBoss && reveal, t: t + i });
      });
      const d = DIFFICULTY[TOURNAMENT_DIFFICULTY[r]];
      text(ctx, reveal ? tour.rivals[r].map((k, i) => (final && i === 2 ? CREATURES[k].boss.name : CREATURES[k].name)).join(' · ') : '¿ ? ?', 214, y + 12, { size: 3.4, weight: 800, color: done ? 'rgba(255,255,255,0.5)' : '#fff' });
      text(ctx, d.label, 214, y + 20, { size: 3.4, weight: 900, color: d.color });
      if (done) text(ctx, '✓', 302, y + 19, { size: 10, weight: 900, align: 'center', color: '#4fd65a', stroke: '#1b1224', strokeW: 1.5 });
    }
    this.menu.render(ctx);
    this.backRect = backButton(ctx, 'MENÚ');
  }
}

// ----------------------------------------------------------------- Batalla

export class BattleScene {
  constructor(game, cfg) {
    this.game = game;
    this.cfg = cfg;
    this.battle = new Battle(game, { ...cfg, seed: 1 + Math.floor(Math.random() * 9999) });
    this.paused = false;
    this.result = null;
    this.resultT = 0;
    const audio = game.audio;
    const musicItem = { label: '', color: '#2e9e8f', action: () => { audio.toggleMusic(); this.syncPauseLabels(); } };
    const sfxItem = { label: '', color: '#2e9e8f', action: () => { audio.toggleSfx(); this.syncPauseLabels(); } };
    const voiceItem = { label: '', color: '#2e9e8f', action: () => { game.announcer.cycle(); this.syncPauseLabels(); } };
    const langItem = { label: '', color: '#2e9e8f', action: () => { game.announcer.toggleLang(); this.syncPauseLabels(); } };
    this.pauseItems = { musicItem, sfxItem, voiceItem, langItem };
    this.pauseMenu = new Menu(game, [
      { label: 'CONTINUAR', color: '#4cc44a', action: () => (this.paused = false) },
      musicItem,
      sfxItem,
      voiceItem,
      langItem,
      { label: 'REINICIAR', color: '#3a8fe0', action: () => this.restart() },
      { label: 'SALIR AL MENÚ', color: '#7c4fd0', action: () => this.exit() },
    ], { x: 110, y: 40, w: 100, h: 12, gap: 2, size: 5 });
    this.syncPauseLabels();
  }

  syncPauseLabels() {
    const a = this.game.audio;
    this.pauseItems.musicItem.label = `MÚSICA: ${a.musicOn ? 'SÍ' : 'NO'}`;
    this.pauseItems.sfxItem.label = `SONIDOS: ${a.sfxOn ? 'SÍ' : 'NO'}`;
    this.pauseItems.voiceItem.label = `RELATOR: ${this.game.announcer.label}`;
    this.pauseItems.langItem.label = `IDIOMA RELATOR: ${this.game.announcer.langLabel}`;
  }

  // Se llama después del onExit de la escena anterior (así REVANCHA no borra los controles)
  onEnter() {
    const g = this.game;
    g.input.setControls(touchLayout());
    g.audio.music(this.cfg.bossLast || this.cfg.difficulty === 'jefe' ? 'boss' : 'battle');
    g.announcer.onLine = (line) => this.battle.showRelator(line);
  }

  touchControlsActive() {
    return !this.paused && !this.result && ['intro', 'fight', 'switch'].includes(this.battle.state);
  }

  pause() {
    this.paused = true;
    this.pauseMenu.index = 0;
    this.game.input.releaseAll();
    this.game.audio.play('select');
  }

  restart() {
    this.game.setScene(new BattleScene(this.game, this.cfg));
  }

  exit() {
    this.game.setScene(new TitleScene(this.game));
  }

  onExit() {
    this.game.input.setControls(null);
    this.game.announcer.onLine = null;
    this.game.announcer.stop();
  }

  onBlur() {
    if (this.battle.state === 'fight' && !this.paused) this.pause();
  }

  buildResult() {
    const b = this.battle;
    const g = this.game;
    const won = b.winner === b.player;
    const cfg = this.cfg;
    const items = [];
    if (cfg.mode === 'torneo') {
      const tour = cfg.tour;
      if (won) {
        if (tour.round >= 3) {
          saveChampions(tour.team);
          items.push({ label: '¡CORONACIÓN!', color: '#e0399a', action: () => g.setScene(new ChampionScene(g, tour)) });
        } else {
          items.push({ label: 'SIGUIENTE RONDA', color: '#ff7a2f', action: () => g.setScene(new BracketScene(g, { ...tour, round: tour.round + 1 })) });
        }
      } else {
        items.push({ label: 'REINTENTAR', color: '#ff7a2f', action: () => this.restart() });
      }
      items.push({ label: 'MENÚ', color: '#7c4fd0', action: () => this.exit() });
    } else {
      items.push({ label: 'REVANCHA', color: '#ff7a2f', action: () => this.restart() });
      items.push({ label: 'CAMBIAR EQUIPO', color: '#3a8fe0', action: () => g.setScene(new TeamScene(g, { mode: 'libre', team: cfg.teamA })) });
      items.push({ label: 'MENÚ', color: '#7c4fd0', action: () => this.exit() });
    }
    this.result = { won, menu: new Menu(g, items, { x: 110, y: 118, w: 100, h: 14, gap: 3, size: 5.5 }) };
    this.resultT = 0;
    g.audio.music(won ? 'victory' : null);
  }

  update(dt) {
    const inp = this.game.input;
    const b = this.battle;
    if (this.result) {
      this.resultT += dt;
      b.update(dt);
      if (this.resultT > 0.5) this.result.menu.update();
      return;
    }
    if (this.paused) {
      this.pauseMenu.update();
      if (inp.wasPressed('pause')) this.paused = false;
      return;
    }
    if (inp.wasPressed('pause') && b.state !== 'ko' && b.state !== 'end') {
      this.pause();
      return;
    }
    b.update(dt);
    if (b.state === 'end') this.buildResult();
  }

  onPointerMove(x, y) {
    if (this.result) this.result.menu.pointerMove(x, y);
    else if (this.paused) this.pauseMenu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    const b = this.battle;
    if (this.result) {
      if (this.resultT > 0.5) this.result.menu.pointerDown(x, y);
      return;
    }
    if (this.paused) {
      this.pauseMenu.pointerDown(x, y);
      return;
    }
    if (inRect(x, y, PAUSE_RECT) && b.state !== 'ko' && b.state !== 'end') this.pause();
  }

  render(ctx) {
    const b = this.battle;
    b.render(ctx);
    if (this.touchControlsActive()) renderTouchControls(ctx, b, this.game.input);

    if (this.paused) {
      dim(ctx, 0.78);
      this.syncPauseLabels();
      text(ctx, 'PAUSA', VW / 2, 32, { size: 13, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
      if (this.game.announcer.mode === 'voz' && !this.game.announcer.goodVoice) {
        text(ctx, 'La voz del relator suena mejor en Chrome o Edge', VW / 2, 158, { size: 3.6, weight: 700, align: 'center', color: '#ffb43b' });
      }
      this.pauseMenu.render(ctx);
      if (!this.game.input.touchMode) text(ctx, 'WASD mover · 1, 2, ESPACIO, Q, E ataques · M música · N sonidos · V relator', VW / 2, 150, { size: 4, weight: 700, align: 'center', color: 'rgba(255,255,255,0.75)' });
    }

    if (this.result) {
      const k = ease(this.resultT / 0.4);
      const r = this.result;
      ctx.fillStyle = `rgba(10,6,20,${0.72 * k})`;
      ctx.fillRect(0, 0, VW, VH);
      ctx.save();
      ctx.globalAlpha = k;
      text(ctx, r.won ? '¡VICTORIA!' : 'DERROTA', VW / 2, 40, { size: 20 * backOut(Math.min(1, this.resultT / 0.35)), weight: 900, align: 'center', color: r.won ? '#ffe66b' : '#ff5d73', stroke: '#1b1224', strokeW: 3.5 });
      const keys = r.won ? b.teams[0].keys : b.teams[1].keys;
      keys.forEach((key, i) => {
        const boss = !r.won && b.bossLast && i === keys.length - 1;
        drawCreature(ctx, key, VW / 2 - 40 + i * 40, 66 + Math.sin(this.resultT * 5 + i) * 1.5, 30, { boss, faceLeft: !r.won, t: this.resultT + i });
      });
      const s = b.stats;
      panel(ctx, 70, 86, 180, 26, { fill: 'rgba(30,24,50,0.92)', r: 4 });
      [['GOLPES', s.hits], ['COMBO MÁX', s.maxCombo], ['DAÑO', s.dealt], ['K.O.', s.ko]].forEach(([label, v], i) => {
        const cx = 70 + 180 * ((i + 0.5) / 4);
        text(ctx, String(v), cx, 100, { size: 8, weight: 900, align: 'center' });
        text(ctx, label, cx, 107.5, { size: 3, weight: 800, align: 'center', color: 'rgba(255,255,255,0.65)' });
      });
      ctx.restore();
      if (this.resultT > 0.5) r.menu.render(ctx);
    }
  }
}

// --------------------------------------------------------------- Campeón

export class ChampionScene {
  constructor(game, tour) {
    this.game = game;
    this.tour = tour;
    this.t = 0;
    this.arena = new Arena('piscina', 99);
    this.confetti = [];
    this.menu = new Menu(game, [{ label: 'MENÚ PRINCIPAL', color: '#ff7a2f', action: () => game.setScene(new TitleScene(game)) }], { x: 110, y: 158, w: 100, h: 15 });
    game.audio.music('victory');
    game.announcer?.say('champion', {}, 4);
    this.tour.team.forEach((k, i) => setTimeout(() => game.audio.cry(CREATURES[k].id, { vol: 0.4 }), 400 + i * 700));
  }

  update(dt) {
    this.t += dt;
    const colors = ['#ffe66b', '#ff7a2f', '#3fa7ff', '#4cc44a', '#e0399a', '#ffffff'];
    for (let i = 0; i < 4; i++) {
      this.confetti.push({ x: Math.random() * VW, y: -4, vx: (Math.random() - 0.5) * 20, vy: 25 + Math.random() * 30, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, c: colors[Math.floor(Math.random() * colors.length)] });
    }
    for (const p of this.confetti) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.confetti = this.confetti.filter((p) => p.y < VH + 5);
    this.menu.update();
  }

  onPointerMove(x, y) {
    this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    this.menu.pointerDown(x, y);
  }

  render(ctx) {
    const t = this.t;
    this.arena.drawWater(ctx, t);
    dim(ctx, 0.45);
    ctx.save();
    ctx.translate(VW / 2, 110);
    ctx.rotate(t * 0.3);
    for (let i = 0; i < 12; i++) {
      ctx.rotate((Math.PI * 2) / 12);
      ctx.fillStyle = 'rgba(255,230,107,0.16)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(200, -24);
      ctx.lineTo(200, 24);
      ctx.fill();
    }
    ctx.restore();
    text(ctx, '¡CAMPEONES DEL MUNDO!', VW / 2, 30, { size: 20 * backOut(Math.min(1, t / 0.5)), weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3.5 });
    text(ctx, GAME_NAME, VW / 2, 42, { size: 6, weight: 800, align: 'center', color: '#fff', stroke: '#1b1224', strokeW: 1.5 });
    this.tour.team.forEach((key, i) => {
      const x = VW / 2 - 70 + i * 70;
      const hop = Math.abs(Math.sin(t * 5 + i)) * 6;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(x, 136, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCreature(ctx, key, x, 108 - hop, 56, { t: t + i });
      text(ctx, CREATURES[key].name, x, 148, { size: 6, weight: 900, align: 'center', stroke: '#1b1224', strokeW: 1.5 });
    });
    for (const p of this.confetti) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-1.4, -0.7, 2.8, 1.4);
      ctx.restore();
    }
    this.menu.render(ctx);
  }
}

// ------------------------------------------------------------ Cómo jugar

export class HowToScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.menu = new Menu(game, [{ label: 'VOLVER', color: '#7c4fd0', action: () => game.setScene(new TitleScene(game)) }], { x: 120, y: 162, w: 80, h: 13 });
    game.audio.music('menu');
  }

  update(dt) {
    this.t += dt;
    this.menu.update();
    if (this.game.input.wasPressed('back')) this.game.setScene(new TitleScene(this.game));
  }

  onPointerMove(x, y) {
    this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    this.menu.pointerDown(x, y);
  }

  render(ctx) {
    ctx.fillStyle = '#16294f';
    ctx.fillRect(0, 0, VW, VH);
    title(ctx, 'CÓMO JUGAR', 15);

    panel(ctx, 8, 22, 148, 70, { fill: 'rgba(40,32,64,0.92)', r: 4 });
    text(ctx, 'TECLADO', 14, 31, { size: 4.4, weight: 900, color: '#ffe66b' });
    const rows = [
      ['W A S D', 'mover (o flechas)'],
      ['1', 'ataque rápido'],
      ['2', 'ataque fuerte'],
      ['ESPACIO', 'esquivar / volar'],
      ['Q', 'ataque especial'],
      ['E', '¡ataque definitivo!'],
      ['M  N  V', 'música, sonidos, relator'],
    ];
    rows.forEach(([k, d], i) => {
      const y = 38 + i * 7.6;
      const kw = textWidth(ctx, k, 3.4) + 4;
      roundRect(ctx, 14, y - 4.5, kw, 6, 1.4);
      ctx.fillStyle = '#f4f1ea';
      ctx.fill();
      text(ctx, k, 14 + kw / 2, y, { size: 3.4, weight: 900, align: 'center', color: '#1b1224' });
      text(ctx, d, 52, y, { size: 4, weight: 700 });
    });

    panel(ctx, 164, 22, 148, 70, { fill: 'rgba(40,32,64,0.92)', r: 4 });
    text(ctx, 'CONSEJOS', 170, 31, { size: 4.4, weight: 900, color: '#ffe66b' });
    const tips = [
      'Los ataques apuntan solos al rival.',
      'Esquivar te hace invulnerable un instante.',
      'Cada Pokémon tiene 5 ataques distintos.',
      'Si se debilita uno, entra el siguiente.',
      'En la tableta: joystick y botones.',
    ];
    tips.forEach((tip, i) => {
      text(ctx, '•', 170, 40 + i * 9.6, { size: 4, color: '#ffb43b' });
      text(ctx, tip, 175, 40 + i * 9.6, { size: 3.8, weight: 600, color: 'rgba(255,255,255,0.88)' });
    });

    panel(ctx, 8, 96, 304, 62, { fill: 'rgba(40,32,64,0.92)', r: 4 });
    text(ctx, 'TIPOS · el ataque hace el doble de daño a…', 14, 105, { size: 4.4, weight: 900, color: '#ffe66b' });
    Object.keys(TYPES).forEach((type, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 14 + col * 152;
      const y = 110 + row * 9.4;
      typeBadge(ctx, type, x, y, { size: 3 });
      let xx = x + 40;
      text(ctx, '›', x + 35, y + 4, { size: 4, weight: 900, color: 'rgba(255,255,255,0.6)' });
      for (const s of strongAgainst(type)) xx += typeBadge(ctx, s, xx, y, { size: 3 }) + 2;
    });
    this.menu.render(ctx);
  }
}

