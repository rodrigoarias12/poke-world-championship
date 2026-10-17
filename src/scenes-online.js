// Pantallas del modo EN LÍNEA: sala de espera (crear / unirse) y la pelea.
import { VW, VH } from './config.js';
import { Battle } from './battle.js';
import { AI } from './ai.js';
import { RemoteController } from './controllers.js';
import { Menu } from './menu.js';
import { Arena } from './arena.js';
import { touchLayout, renderTouchControls, PAUSE_RECT } from './hud.js';
import { text, roundRect, panel, button, inRect, backOut, ease, drawCreature } from './ui.js';
import { hostRoom, joinRoom } from './net/transport.js';
import { Session } from './net/session.js';
import { snapshot } from './net/protocol.js';
import { startRecording } from './net/recorder.js';
import { GuestBattle } from './net/guest.js';
import { TitleScene, TeamScene } from './scenes.js';

const params = new URLSearchParams(location.search);
const isBot = params.has('bot');
// Para pruebas: ?lag=80&jitter=40 simula una red lenta
const sim = { lag: Number(params.get('lag')) || 0, jitter: Number(params.get('jitter')) || 0 };

function dim(ctx, a) {
  ctx.fillStyle = `rgba(12,8,22,${a})`;
  ctx.fillRect(0, 0, VW, VH);
}

function header(ctx, str) {
  text(ctx, str, VW / 2, 18, { size: 11, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2.5 });
}

function connectError(e) {
  if (e?.type === 'peer-unavailable') return 'Esa sala no existe. Revisa el número.';
  if (e?.message === 'timeout') return 'El otro celular no respondió.';
  if (e?.type === 'network' || e?.type === 'server-error') return 'No hay conexión a internet.';
  if (e?.type === 'browser-incompatible') return 'Este navegador no permite jugar en línea.';
  return 'No se pudo conectar.';
}

// ------------------------------------------------------------ Sala de espera

export class OnlineScene {
  constructor(game, { join = null, create = null } = {}) {
    this.game = game;
    this.t = 0;
    this.mode = 'menu';
    this.digits = '';
    this.message = '';
    this.code = null;
    this.rects = {};
    this.arena = new Arena('lago', 17);
    this.onKey = (e) => this.key(e);
    if (join) {
      this.digits = join;
      this.join();
    } else if (create) {
      this.create(create);
    }
  }

  onEnter() {
    addEventListener('keydown', this.onKey);
    this.game.audio.music('menu');
  }

  onExit() {
    removeEventListener('keydown', this.onKey);
    // Si se va sin que nadie se una, se libera la sala
    if (this.room && !this.connected) this.room.peer.destroy();
  }

  key(e) {
    if (this.mode !== 'keypad') return;
    if (/^Digit\d$|^Numpad\d$/.test(e.code)) this.typeDigit(e.code.slice(-1));
    else if (e.code === 'Backspace') this.digits = this.digits.slice(0, -1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.join();
  }

  typeDigit(d) {
    if (this.digits.length < 4) this.digits += d;
    this.game.audio.play('select');
  }

  async create(code = null) {
    this.mode = 'creating';
    try {
      this.room = await hostRoom({ code, sim });
      this.code = this.room.code;
      this.mode = 'waiting';
      const link = await this.room.waitGuest();
      this.connected = true;
      this.startSession(link, 'host');
    } catch (e) {
      this.fail(e?.type === 'unavailable-id' ? 'Ese número de sala está ocupado.' : connectError(e));
    }
  }

  async join() {
    if (!/^\d{4}$/.test(this.digits)) {
      this.mode = 'keypad';
      return;
    }
    this.mode = 'connecting';
    try {
      const link = await joinRoom(this.digits, { sim });
      this.connected = true;
      this.startSession(link, 'guest');
    } catch (e) {
      this.fail(connectError(e));
    }
  }

  startSession(link, role) {
    const s = new Session(this.game, link, role);
    this.game.session = s;
    this.game.audio.play('confirm');
    this.game.setScene(new TeamScene(this.game, { mode: 'online' }));
  }

  fail(msg) {
    this.mode = 'error';
    this.message = msg;
    this.game.audio.play('back');
  }

  share() {
    const url = `${location.origin}${location.pathname}?sala=${this.code}`;
    if (navigator.share) navigator.share({ title: 'Poké World Championship', text: `¡Pelea conmigo! Sala ${this.code}`, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => (this.message = 'Link copiado'), () => {});
  }

  back() {
    this.game.audio.play('back');
    if (this.mode === 'keypad' || this.mode === 'error') {
      this.mode = 'menu';
      this.message = '';
      return;
    }
    this.game.setScene(new TitleScene(this.game));
  }

  update(dt) {
    this.t += dt;
    this.arena.update(dt);
    const inp = this.game.input;
    if (inp.wasPressed('back')) this.back();
    if (this.mode === 'menu') {
      if (inp.wasPressed('up') || inp.wasPressed('down')) this.sel = this.sel ? 0 : 1;
      if (inp.wasPressed('confirm')) this.sel ? (this.mode = 'keypad') : this.create();
    }
  }

  onPointerDown(x, y) {
    const r = this.rects;
    if (inRect(x, y, r.back)) return this.back();
    if (this.mode === 'menu') {
      if (inRect(x, y, r.create)) this.create();
      else if (inRect(x, y, r.join)) this.mode = 'keypad';
    } else if (this.mode === 'waiting') {
      if (inRect(x, y, r.share)) this.share();
    } else if (this.mode === 'keypad') {
      for (const k of r.keys || []) {
        if (!inRect(x, y, k)) continue;
        if (k.d === '<') this.digits = this.digits.slice(0, -1);
        else this.typeDigit(k.d);
        return;
      }
      if (inRect(x, y, r.go)) this.join();
    } else if (this.mode === 'error') {
      if (inRect(x, y, r.retry)) this.back();
    }
  }

  render(ctx) {
    this.arena.drawWater(ctx, this.t);
    dim(ctx, 0.72);
    header(ctx, 'EN LÍNEA');
    const r = (this.rects = {});
    if (this.mode === 'menu') {
      text(ctx, 'Pelea contra otra persona, cada una en su celular.', VW / 2, 34, { size: 4.6, weight: 700, align: 'center', color: '#f4f1ea' });
      text(ctx, 'Uno crea la sala y el otro se une con el número.', VW / 2, 42, { size: 4.6, weight: 700, align: 'center', color: '#f4f1ea' });
      r.create = button(ctx, 'CREAR SALA', 90, 56, 140, 30, { color: '#ff7a2f', size: 9, sub: 'te da un número para compartir', selected: !this.sel });
      r.join = button(ctx, 'UNIRSE', 90, 96, 140, 30, { color: '#3a8fe0', size: 9, sub: 'escribe el número de tu rival', selected: !!this.sel });
      text(ctx, 'Mejor si los dos celulares están en el mismo Wi-Fi', VW / 2, 146, { size: 4, weight: 700, align: 'center', color: '#b9c6e4' });
    } else if (this.mode === 'creating' || this.mode === 'connecting') {
      text(ctx, this.mode === 'creating' ? 'Creando sala…' : `Conectando a la sala ${this.digits}…`, VW / 2, 90, { size: 9, weight: 900, align: 'center', color: '#fff' });
      this.spinner(ctx, VW / 2, 112);
    } else if (this.mode === 'waiting') {
      text(ctx, 'Número de sala', VW / 2, 40, { size: 6, weight: 800, align: 'center', color: '#b9c6e4' });
      [...this.code].forEach((d, i) => {
        const x = VW / 2 - 52 + i * 27;
        roundRect(ctx, x, 46, 23, 32, 4);
        ctx.fillStyle = '#f4f1ea';
        ctx.fill();
        text(ctx, d, x + 11.5, 72, { size: 24, weight: 900, align: 'center', color: '#1b1224' });
      });
      text(ctx, 'Escríbelo en el otro celular (EN LÍNEA → UNIRSE)', VW / 2, 92, { size: 4.6, weight: 700, align: 'center', color: '#f4f1ea' });
      r.share = button(ctx, 'COMPARTIR LINK', 100, 100, 120, 20, { color: '#4cc44a', size: 6.5 });
      text(ctx, this.message || 'Esperando a tu rival…', VW / 2, 140, { size: 6, weight: 900, align: 'center', color: '#ffe66b', alpha: 0.6 + Math.sin(this.t * 4) * 0.4 });
      this.spinner(ctx, VW / 2, 154);
    } else if (this.mode === 'keypad') {
      text(ctx, 'Número de sala', 80, 46, { size: 6, weight: 800, align: 'center', color: '#b9c6e4' });
      for (let i = 0; i < 4; i++) {
        const x = 80 - 52 + i * 27;
        roundRect(ctx, x, 52, 23, 32, 4);
        ctx.fillStyle = i < this.digits.length ? '#f4f1ea' : 'rgba(255,255,255,0.12)';
        ctx.fill();
        if (this.digits[i]) text(ctx, this.digits[i], x + 11.5, 78, { size: 24, weight: 900, align: 'center', color: '#1b1224' });
      }
      const ready = this.digits.length === 4;
      r.go = button(ctx, 'UNIRSE', 30, 100, 100, 24, { color: ready ? '#3a8fe0' : '#4a4458', size: 9, selected: ready, disabled: !ready });
      // Teclado numérico grande
      r.keys = [];
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0'];
      keys.forEach((d, i) => {
        const col = i === 10 ? 1 : i % 3;
        const row = Math.floor(i / 3);
        const x = 176 + col * 40;
        const y = 34 + row * 34;
        roundRect(ctx, x, y + 1.5, 36, 30, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fill();
        roundRect(ctx, x, y, 36, 30, 5);
        ctx.fillStyle = d === '<' ? '#7c4fd0' : '#f4f1ea';
        ctx.fill();
        text(ctx, d === '<' ? '⌫' : d, x + 18, y + 21, { size: 15, weight: 900, align: 'center', color: d === '<' ? '#fff' : '#1b1224' });
        r.keys.push({ x, y, w: 36, h: 30, d });
      });
    } else if (this.mode === 'error') {
      text(ctx, this.message, VW / 2, 84, { size: 7, weight: 900, align: 'center', color: '#ff7a8a' });
      r.retry = button(ctx, 'VOLVER', 110, 100, 100, 22, { color: '#7c4fd0', size: 8, selected: true });
    }
    // Volver
    roundRect(ctx, 4, 4, 34, 11, 3);
    ctx.fillStyle = 'rgba(14,10,24,0.8)';
    ctx.fill();
    text(ctx, '‹ VOLVER', 21, 11.6, { size: 4.6, weight: 800, align: 'center' });
    r.back = { x: 0, y: 0, w: 44, h: 20 };
  }

  spinner(ctx, x, y) {
    for (let i = 0; i < 8; i++) {
      const a = this.t * 6 + (i / 8) * Math.PI * 2;
      ctx.globalAlpha = (i + 1) / 8;
      ctx.fillStyle = '#ffe66b';
      ctx.fillRect(x + Math.cos(a) * 7 - 1.2, y + Math.sin(a) * 7 - 1.2, 2.4, 2.4);
    }
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------- Pelea en línea

export class OnlineBattleScene {
  constructor(game, start) {
    this.game = game;
    this.session = game.session;
    this.start = start;
    this.lost = null;
    this.menuOpen = false;
    this.result = null;
    this.resultT = 0;
    const cfg = { teamA: start.teams[0], teamB: start.teams[1], bossLast: false, difficulty: 'normal', arena: start.arena, round: 'EN LÍNEA', seed: start.seed };
    const s = this.session;
    this.offs = [];
    if (s.isHost) {
      // El anfitrión simula la pelea y le manda fotos al invitado
      const b = (this.battle = new Battle(game, cfg));
      b.online = true;
      this.remote = new RemoteController(b, 1);
      b.setController(1, this.remote);
      if (isBot) {
        const ai = new AI(b, 0, 'dificil');
        b.setController(0, { side: 0, isAI: false, update: (dt) => ai.update(dt) });
      }
      this.sink = startRecording(b);
      this.sendAcc = 0;
      this.offs.push(s.on('in', (m) => this.remote.receive(m)));
    } else {
      // El invitado muestra la pelea y manda sus botones
      this.battle = new GuestBattle(game, cfg);
      this.counts = [0, 0, 0, 0, 0];
      this.lastSent = '';
      this.inputAcc = 0;
      this.botUse = -1;
      if (isBot) this.botAI = new AI(this.battle, 1, 'dificil');
      this.offs.push(s.on('s', (snap) => this.battle.receive(snap)));
    }
    this.offs.push(s.on('lost', (reason) => (this.lost = reason)));
    if (s.closed) this.lost = s.lostReason || 'cerrado';
    const audio = game.audio;
    const musicItem = { label: '', color: '#2e9e8f', action: () => { audio.toggleMusic(); this.syncLabels(); } };
    const sfxItem = { label: '', color: '#2e9e8f', action: () => { audio.toggleSfx(); this.syncLabels(); } };
    this.labels = { musicItem, sfxItem };
    this.menu = new Menu(game, [
      { label: 'SEGUIR JUGANDO', color: '#4cc44a', action: () => this.closeMenu() },
      musicItem,
      sfxItem,
      { label: 'ABANDONAR', color: '#c43b4f', action: () => this.leave() },
    ], { x: 110, y: 60, w: 100, h: 16, gap: 4, size: 6 });
    this.syncLabels();
    this.lostMenu = new Menu(game, [{ label: 'VOLVER AL MENÚ', color: '#7c4fd0', action: () => this.exit() }], { x: 110, y: 104, w: 100, h: 18, size: 7 });
  }

  syncLabels() {
    const a = this.game.audio;
    this.labels.musicItem.label = `MÚSICA: ${a.musicOn ? 'SÍ' : 'NO'}`;
    this.labels.sfxItem.label = `SONIDOS: ${a.sfxOn ? 'SÍ' : 'NO'}`;
  }

  onEnter() {
    const g = this.game;
    g.input.setControls(touchLayout());
    g.audio.music('battle');
    g.announcer.onLine = (line) => this.battle.showRelator(line);
    navigator.wakeLock?.request('screen').then((l) => (this.wake = l), () => {});
  }

  onExit() {
    for (const off of this.offs) off();
    this.game.input.setControls(null);
    this.game.announcer.onLine = null;
    this.game.announcer.stop();
    this.wake?.release?.().catch(() => {});
  }

  // En línea la pelea nunca se pausa (el otro sigue jugando)
  onBlur() {}

  touchControlsActive() {
    return !this.menuOpen && !this.result && !this.lost && ['intro', 'fight', 'switch'].includes(this.battle.state);
  }

  openMenu() {
    this.menuOpen = true;
    this.menu.index = 0;
    this.game.input.releaseAll();
    this.battle.inputBlocked = true;
    this.game.audio.play('select');
  }

  closeMenu() {
    this.menuOpen = false;
    this.battle.inputBlocked = false;
  }

  leave() {
    this.session?.leave();
    this.exit();
  }

  exit() {
    if (this.session && !this.session.closed) this.session.leave();
    this.game.setScene(new TitleScene(this.game));
  }

  rematch() {
    this.session.resetTeams();
    const mine = this.start.teams[this.session.localSide];
    this.game.setScene(new TeamScene(this.game, { mode: 'online', team: mine }));
  }

  buildResult() {
    const b = this.battle;
    const won = b.winner?.side === this.session.localSide;
    this.result = {
      won,
      menu: new Menu(this.game, [
        { label: 'REVANCHA', color: '#ff7a2f', action: () => this.rematch() },
        { label: 'SALIR', color: '#7c4fd0', action: () => this.exit() },
      ], { x: 110, y: 124, w: 100, h: 16, gap: 4, size: 6 }),
    };
    this.resultT = 0;
    this.game.audio.music(won ? 'victory' : null);
  }

  // Invitado: manda joystick y botones (cuando cambian y 10 veces por segundo)
  sendInput(dt) {
    const inp = this.game.input;
    const f = this.battle.fighters[1];
    let mx = 0;
    let my = 0;
    let h = 0;
    if (this.botAI) {
      this.botAI.update(dt);
      mx = f.intent.mx;
      my = f.intent.my;
      const u = f.intent.use;
      if (u >= 0 && u !== this.botUse) this.counts[u]++;
      this.botUse = u;
    } else if (!this.menuOpen && !this.result) {
      [mx, my] = inp.moveVector();
      for (let i = 0; i < 5; i++) {
        if (inp.isDown(`m${i}`)) h |= 1 << i;
        if (inp.wasPressed(`m${i}`)) this.counts[i]++;
      }
    }
    mx = Math.round(mx * 100) / 100;
    my = Math.round(my * 100) / 100;
    const key = `${mx},${my},${h},${this.counts.join(',')}`;
    this.inputAcc += dt;
    if (key !== this.lastSent || this.inputAcc > 0.1) {
      this.session.send({ t: 'in', mx, my, h, p: this.counts.slice() });
      this.lastSent = key;
      this.inputAcc = 0;
    }
  }

  update(dt) {
    const b = this.battle;
    if (this.lost) {
      this.lostMenu.update();
      return;
    }
    const inp = this.game.input;
    if (this.session.isHost) {
      b.update(dt);
      this.sendAcc += dt;
      if (this.sendAcc >= 1 / 30) {
        this.sendAcc = Math.min(this.sendAcc - 1 / 30, 1 / 30);
        this.session.send(snapshot(b, this.sink.splice(0)));
      }
    } else {
      this.sendInput(dt);
      b.update(dt);
    }
    if (b.state === 'end' && !this.result) this.buildResult();
    if (this.result) {
      this.resultT += dt;
      if (this.resultT > 0.5) this.result.menu.update();
      return;
    }
    if (this.menuOpen) {
      this.menu.update();
      if (inp.wasPressed('pause')) this.closeMenu();
    } else if (inp.wasPressed('pause')) this.openMenu();
  }

  onPointerMove(x, y) {
    if (this.lost) this.lostMenu.pointerMove(x, y);
    else if (this.result) this.result.menu.pointerMove(x, y);
    else if (this.menuOpen) this.menu.pointerMove(x, y);
  }

  onPointerDown(x, y) {
    if (this.lost) return this.lostMenu.pointerDown(x, y);
    if (this.result) {
      if (this.resultT > 0.5) this.result.menu.pointerDown(x, y);
      return;
    }
    if (this.menuOpen) return this.menu.pointerDown(x, y);
    if (inRect(x, y, PAUSE_RECT)) this.openMenu();
  }

  render(ctx) {
    const b = this.battle;
    b.render(ctx);
    if (this.touchControlsActive()) renderTouchControls(ctx, b, this.game.input);
    // Demora de la conexión (abajo a la derecha, chiquito)
    const rtt = Math.round(this.session.rtt || 0);
    text(ctx, `${rtt} ms`, VW - 4, VH - 2.5, { size: 3.2, weight: 700, align: 'right', color: rtt < 80 ? 'rgba(160,255,170,0.8)' : 'rgba(255,190,90,0.9)' });

    if (this.menuOpen && !this.result && !this.lost) {
      dim(ctx, 0.7);
      text(ctx, 'MENÚ', VW / 2, 48, { size: 12, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2.5 });
      text(ctx, 'La pelea sigue mientras tanto', VW / 2, 56, { size: 3.8, weight: 700, align: 'center', color: '#b9c6e4' });
      this.menu.render(ctx);
    }
    if (this.result && !this.lost) {
      const k = ease(this.resultT / 0.4);
      ctx.fillStyle = `rgba(10,6,20,${0.72 * k})`;
      ctx.fillRect(0, 0, VW, VH);
      ctx.save();
      ctx.globalAlpha = k;
      const r = this.result;
      text(ctx, r.won ? '¡VICTORIA!' : 'DERROTA', VW / 2, 44, { size: 20 * backOut(Math.min(1, this.resultT / 0.35)), weight: 900, align: 'center', color: r.won ? '#ffe66b' : '#ff5d73', stroke: '#1b1224', strokeW: 3.5 });
      const side = r.won ? this.session.localSide : 1 - this.session.localSide;
      b.teams[side].keys.forEach((key, i) => {
        drawCreature(ctx, key, VW / 2 - 40 + i * 40, 72 + Math.sin(this.resultT * 5 + i) * 1.5, 30, { t: this.resultT + i, faceLeft: side === 1 });
      });
      const st = b.sideStats[this.session.localSide];
      panel(ctx, 70, 92, 180, 24, { fill: 'rgba(30,24,50,0.92)', r: 4 });
      [['GOLPES', st.hits], ['COMBO MÁX', st.maxCombo], ['DAÑO', st.dealt], ['K.O.', st.ko]].forEach(([label, v], i) => {
        const cx = 70 + 180 * ((i + 0.5) / 4);
        text(ctx, String(v), cx, 105, { size: 7.5, weight: 900, align: 'center' });
        text(ctx, label, cx, 112, { size: 3, weight: 800, align: 'center', color: 'rgba(255,255,255,0.65)' });
      });
      ctx.restore();
      if (this.resultT > 0.5) r.menu.render(ctx);
    }
    if (this.lost) {
      dim(ctx, 0.8);
      text(ctx, 'Se cortó la conexión', VW / 2, 74, { size: 12, weight: 900, align: 'center', color: '#ff7a8a', stroke: '#1b1224', strokeW: 2.5 });
      text(ctx, this.lost === 'se fue' ? 'Tu rival salió de la partida.' : 'Revisen que los dos celulares tengan internet.', VW / 2, 90, { size: 5, weight: 700, align: 'center', color: '#f4f1ea' });
      this.lostMenu.render(ctx);
    }
  }
}
