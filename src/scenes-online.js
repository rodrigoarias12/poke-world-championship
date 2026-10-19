// Pantallas del modo EN LÍNEA: buscar rival (automático), invitar a un
// amigo con un código, la presentación VS y la pelea.
import { VW, VH } from './config.js';
import { ROSTER, CREATURES, TYPES } from './data.js';
import { Battle } from './battle.js';
import { AI } from './ai.js';
import { RemoteController } from './controllers.js';
import { Menu } from './menu.js';
import { Arena, arenaName } from './arena.js';
import { touchLayout, renderTouchControls, PAUSE_RECT } from './hud.js';
import { text, roundRect, panel, button, inRect, backOut, ease, drawCreature } from './ui.js';
import { quickMatch, hostRoom, joinRoom } from './net/transport.js';
import { Session } from './net/session.js';
import { snapshot } from './net/protocol.js';
import { startRecording } from './net/recorder.js';
import { GuestBattle } from './net/guest.js';
import { TitleScene, TeamScene, DifficultyScene } from './scenes.js';
import { loadTeam } from './team.js';
import { drawVersus, VS_DUR } from './versus.js';

const params = new URLSearchParams(location.search);
const isBot = params.has('bot');
// Para pruebas: ?lag=80&jitter=40 simula una red lenta
const sim = { lag: Number(params.get('lag')) || 0, jitter: Number(params.get('jitter')) || 0 };
// Para pruebas: ?cola=xyz busca rival solo entre quienes usan esa misma cola
const queueName = (params.get('cola') || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
// Para pruebas y videos: ?equipo=pikachu,charizard,lucario
const forcedTeam = (() => {
  const keys = (params.get('equipo') || '').split(',');
  return keys.length === 3 && keys.every((k) => ROSTER.includes(k)) ? keys : null;
})();



function dim(ctx, a) {
  ctx.fillStyle = `rgba(12,8,22,${a})`;
  ctx.fillRect(0, 0, VW, VH);
}

function header(ctx, str) {
  text(ctx, str, VW / 2, 18, { size: 11, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2.5 });
}

function connectError(e) {
  if (e?.type === 'peer-unavailable') return 'Ese código no existe. Revisa el número.';
  if (e?.message === 'timeout') return 'El otro celular no respondió.';
  if (e?.type === 'network' || e?.type === 'server-error' || e?.type === 'socket-error') return 'No hay conexión a internet.';
  if (e?.type === 'browser-incompatible') return 'Este navegador no permite jugar en línea.';
  return 'No se pudo conectar.';
}

// --------------------------------------------------------------- Buscar rival
// Al entrar ya está buscando: tu último equipo y un rival cualquiera que
// también esté buscando. Invitar a un amigo con código queda como opción.

export class OnlineScene {
  constructor(game, { join = null, create = null, team = null, rematch = false, rival = null, notice = '' } = {}) {
    this.game = game;
    this.t = 0;
    this.team = team || forcedTeam || loadTeam();
    this.opts = { join, create, rematch };
    this.rivalTeam = rival;
    this.notice = notice;
    this.noticeT = 0;
    this.mode = 'search';
    this.searchT = 0;
    this.digits = '';
    this.message = '';
    this.code = null;
    this.session = null;
    this.match = null;
    this.room = null;
    this.offs = [];
    this.buttons = [];
    this.sel = -1;
    this.arena = new Arena('lago', 17);
    this.onKey = (e) => this.key(e);
    // Siluetas que van pasando mientras se busca
    this.roulette = [...ROSTER].sort(() => Math.random() - 0.5);
  }

  onEnter() {
    addEventListener('keydown', this.onKey);
    this.game.audio.music('menu');
    const { join, create, rematch } = this.opts;
    const s = this.game.session;
    if (rematch && s && !s.closed) this.waitRematch(s);
    else if (join) {
      this.digits = join;
      this.join();
    } else if (create) this.invite(create === true ? null : create);
    else this.search();
  }

  onExit() {
    removeEventListener('keydown', this.onKey);
    this.stopSearch();
    this.closeRoom();
    for (const off of this.offs) off();
    this.offs = [];
    // Si se va antes de pelear, la partida armada se corta
    if (this.session && !this.toBattle) this.session.leave();
  }

  // ---- búsqueda automática
  search() {
    this.stopSearch();
    this.closeRoom();
    this.mode = 'search';
    this.searchT = 0;
    this.sel = -1;
    const m = (this.match = quickMatch({ sim, queue: queueName }));
    m.promise.then(
      ({ link, role }) => {
        if (this.match !== m) return link.close('cancelado');
        this.match = null;
        this.attach(link, role);
      },
      (e) => {
        if (this.match !== m) return;
        this.match = null;
        if (e?.message !== 'cancelado') this.fail(connectError(e));
      },
    );
  }

  stopSearch() {
    const m = this.match;
    this.match = null;
    m?.cancel();
  }

  closeRoom() {
    if (this.room && !this.session) this.room.peer.destroy();
    this.room = null;
  }

  // ---- invitar a un amigo (código de 4 números)
  async invite(code = null) {
    this.stopSearch();
    this.mode = 'creating';
    try {
      const room = (this.room = await hostRoom({ code, sim }));
      if (this.mode !== 'creating') return room.peer.destroy();
      this.code = room.code;
      this.mode = 'waiting';
      this.message = '';
      const link = await room.waitGuest();
      if (this.room !== room) return link.close('cancelado');
      this.attach(link, 'host');
    } catch (e) {
      this.fail(e?.type === 'unavailable-id' ? 'Ese código está ocupado.' : connectError(e));
    }
  }

  async join() {
    if (!/^\d{4}$/.test(this.digits)) {
      this.stopSearch();
      this.mode = 'keypad';
      return;
    }
    this.stopSearch();
    this.mode = 'connecting';
    try {
      const link = await joinRoom(this.digits, { sim });
      if (this.mode !== 'connecting') return link.close('cancelado');
      this.attach(link, 'guest');
    } catch (e) {
      if (this.mode === 'connecting') this.fail(connectError(e));
    }
  }

  // ---- ya hay rival: se mandan los equipos y arranca
  attach(link, role) {
    const s = (this.session = new Session(this.game, link, role));
    this.game.session = s;
    this.listen(s);
    this.mode = 'found';
    this.foundT = 0;
    this.start = null;
    this.game.audio.play('ready');
    s.sendTeam(this.team);
  }

  waitRematch(s) {
    this.session = s;
    this.listen(s);
    this.mode = 'rematch';
    this.foundT = 0;
    s.sendTeam(this.team);
  }

  listen(s) {
    this.offs.push(s.on('team', (m) => (this.rivalTeam = m.keys)));
    this.offs.push(s.on('start', (start) => {
      this.start = start;
      this.rivalTeam = start.teams[1 - s.localSide];
    }));
    this.offs.push(s.on('lost', (reason) => this.onLost(reason)));
    this.offs.push(s.on('version', () => {
      this.dropSession();
      this.fail('Tu rival tiene otra versión del juego. Recarguen la página.');
    }));
  }

  dropSession() {
    for (const off of this.offs) off();
    this.offs = [];
    if (this.session && !this.session.closed) this.session.leave();
    this.session = null;
    this.start = null;
  }

  // Si el rival se va antes de pelear, se busca otro solo
  onLost(reason) {
    const wasPairing = ['found', 'vs', 'rematch'].includes(this.mode);
    this.dropSession();
    this.rivalTeam = null;
    if (!wasPairing) return;
    this.notice = reason === 'se fue' ? 'Tu rival se fue. Buscando otro…' : 'Se cortó la conexión. Buscando otro rival…';
    this.noticeT = 0;
    this.search();
  }

  fail(msg) {
    this.stopSearch();
    this.mode = 'error';
    this.message = msg;
    this.sel = 0;
    this.game.audio.play('back');
  }

  share() {
    const url = `${location.origin}${location.pathname}?sala=${this.code}`;
    if (navigator.share) navigator.share({ title: 'Poké World Championship', text: `¡Pelea conmigo! Código ${this.code}`, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => (this.message = '¡Link copiado! Pégalo en un mensaje.'), () => {});
  }

  changeTeam() {
    this.game.audio.play('confirm');
    this.game.setScene(new TeamScene(this.game, { mode: 'online', team: this.team }));
  }

  practice() {
    this.game.audio.play('confirm');
    this.game.setScene(new DifficultyScene(this.game, { team: this.team }));
  }

  back() {
    this.game.audio.play('back');
    if (['keypad', 'waiting', 'creating', 'connecting', 'error'].includes(this.mode)) return this.search();
    this.game.setScene(new TitleScene(this.game));
  }

  // ---- teclado
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

  update(dt) {
    this.t += dt;
    this.noticeT += dt;
    this.arena.update(dt);
    const inp = this.game.input;
    if (this.mode === 'search') this.searchT += dt;
    if (this.mode === 'found' || this.mode === 'rematch') {
      this.foundT += dt;
      // Un instante para ver "¡Rival encontrado!" y después la presentación
      if (this.start && (this.foundT > 0.8 || this.mode === 'rematch')) {
        this.mode = 'vs';
        this.vsT = 0;
        this.game.audio.play('clash');
      } else if (this.mode === 'found' && this.foundT > 10) {
        this.onLost('sin respuesta');
      }
    }
    if (this.mode === 'vs') {
      this.vsT += dt;
      if (this.vsT >= VS_DUR) {
        this.toBattle = true;
        this.game.setScene(new OnlineBattleScene(this.game, this.start));
        return;
      }
    }
    if (inp.wasPressed('back')) return this.back();
    // Botones con flechas y ENTER
    const n = this.buttons.length;
    if (n && this.mode !== 'keypad') {
      if (inp.wasPressed('right') || inp.wasPressed('down')) {
        this.sel = (this.sel + 1) % n;
        this.game.audio.play('select');
      }
      if (inp.wasPressed('left') || inp.wasPressed('up')) {
        this.sel = (this.sel - 1 + n) % n;
        this.game.audio.play('select');
      }
      if (inp.wasPressed('confirm') && this.buttons[this.sel]) this.buttons[this.sel].action();
    }
  }

  onPointerDown(x, y) {
    const r = this.rects || {};
    if (inRect(x, y, r.back)) return this.back();
    const b = this.buttons.find((bt) => inRect(x, y, bt.rect));
    if (b) return b.action();
    if (this.mode === 'keypad') {
      for (const k of r.keys || []) {
        if (!inRect(x, y, k)) continue;
        if (k.d === '<') this.digits = this.digits.slice(0, -1);
        else this.typeDigit(k.d);
        return;
      }
    }
  }

  // Botones de la pantalla actual (se arman al dibujar)
  btn(ctx, label, x, y, w, h, color, action, opts = {}) {
    const i = this.buttons.length;
    const rect = button(ctx, label, x, y, w, h, { color, size: opts.size || 6, sub: opts.sub, selected: i === this.sel, disabled: opts.disabled });
    this.buttons.push({ rect, action: opts.disabled ? () => {} : action });
    return rect;
  }

  render(ctx) {
    this.buttons = [];
    this.rects = {};
    if (this.mode === 'vs') {
      const side = this.session?.localSide ?? 0;
      drawVersus(ctx, this.vsT, { left: this.start.teams[side], right: this.start.teams[1 - side], arenaName: arenaName(this.start.arena) });
      return;
    }
    this.arena.drawWater(ctx, this.t);
    dim(ctx, 0.62);
    if (['search', 'found', 'rematch'].includes(this.mode)) this.renderSearch(ctx);
    else if (this.mode === 'waiting') this.renderInvite(ctx);
    else if (this.mode === 'keypad') this.renderKeypad(ctx);
    else if (this.mode === 'creating' || this.mode === 'connecting') {
      header(ctx, 'EN LÍNEA');
      text(ctx, this.mode === 'creating' ? 'Preparando la invitación…' : `Conectando con el código ${this.digits}…`, VW / 2, 86, { size: 8, weight: 900, align: 'center', color: '#fff' });
      this.spinner(ctx, VW / 2, 106);
    } else if (this.mode === 'error') {
      header(ctx, 'EN LÍNEA');
      text(ctx, this.message, VW / 2, 80, { size: 6.5, weight: 900, align: 'center', color: '#ff8a96' });
      this.btn(ctx, 'REINTENTAR', 60, 96, 96, 20, '#ff7a2f', () => this.search(), { size: 7 });
      this.btn(ctx, 'MENÚ', 164, 96, 96, 20, '#7c4fd0', () => this.game.setScene(new TitleScene(this.game)), { size: 7 });
    }
    // Volver
    roundRect(ctx, 4, 4, 34, 11, 3);
    ctx.fillStyle = 'rgba(14,10,24,0.8)';
    ctx.fill();
    text(ctx, '‹ VOLVER', 21, 11.6, { size: 4.6, weight: 800, align: 'center' });
    this.rects.back = { x: 0, y: 0, w: 44, h: 20 };
  }

  // Tu equipo a la izquierda, el rival (o su silueta) a la derecha
  renderSearch(ctx) {
    const t = this.t;
    const found = this.mode !== 'search';
    header(ctx, 'EN LÍNEA');
    // Mitades con color de cada lado
    this.sidePanel(ctx, 12, '#ff7a2f', 'TU EQUIPO');
    this.sidePanel(ctx, 172, '#3a8fe0', 'RIVAL');
    this.team.forEach((key, i) => this.podium(ctx, key, 46 + i * 34, 82, t + i, false));
    if (this.rivalTeam) {
      this.rivalTeam.forEach((key, i) => this.podium(ctx, key, 206 + i * 34, 82, t + i, true));
    } else {
      // Radar y siluetas que van pasando
      const cx = 240;
      const cy = 84;
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.7 + i / 3) % 1;
        ctx.strokeStyle = `rgba(120,200,255,${0.5 * (1 - k)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 8, 10 + k * 46, (10 + k * 46) * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const key = this.roulette[Math.floor(t * 5) % this.roulette.length];
      drawCreature(ctx, key, cx, cy - 4, 44, { black: true, faceLeft: true, alpha: 0.85 });
      text(ctx, '?', cx, cy + 4, { size: 24, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3, alpha: 0.75 + Math.sin(t * 6) * 0.25 });
    }
    // VS del medio
    const pulse = 1 + Math.sin(t * 5) * 0.06;
    ctx.save();
    ctx.translate(160, 76);
    ctx.scale(pulse, pulse);
    text(ctx, 'VS', 0, 6, { size: 18, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
    ctx.restore();

    this.btn(ctx, 'CAMBIAR EQUIPO', 34, 110, 92, 12, '#7c4fd0', () => this.changeTeam(), { size: 4.6, disabled: found });

    // Estado
    let status;
    let color = '#ffe66b';
    if (this.mode === 'rematch') status = this.rivalTeam && this.session?.rivalReady ? '¡Revancha!' : 'Esperando a que tu rival acepte la revancha';
    else if (found) status = '¡RIVAL ENCONTRADO!';
    else status = 'Buscando rival';
    const dots = found ? '' : '.'.repeat(1 + (Math.floor(t * 3) % 3));
    if (this.mode === 'found') {
      const k = backOut(Math.min(1, this.foundT / 0.3));
      text(ctx, status, VW / 2, 142, { size: 11 * k, weight: 900, align: 'center', color, stroke: '#1b1224', strokeW: 2.5 });
    } else {
      text(ctx, status + dots, VW / 2, 140, { size: 7.5, weight: 900, align: 'center', color, stroke: '#1b1224', strokeW: 2 });
    }
    if (this.mode === 'search') {
      const s = Math.floor(this.searchT);
      const clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      const lonely = this.searchT > 15;
      text(ctx, lonely ? `${clock} · No hay nadie buscando ahora. ¡Invita a alguien!` : `${clock} · Te junta con otra persona que esté buscando`, VW / 2, 148, { size: 4.2, weight: 700, align: 'center', color: lonely ? '#ffd0a0' : '#b9c6e4' });
      // Opciones de abajo
      const items = [
        ['INVITAR A UN AMIGO', '#4cc44a', () => this.invite()],
        ['TENGO UN CÓDIGO', '#3a8fe0', () => this.join()],
      ];
      if (lonely) items.push(['PRACTICAR VS LA IA', '#ff7a2f', () => this.practice()]);
      const w = 92;
      const gap = 6;
      const x0 = VW / 2 - (items.length * w + (items.length - 1) * gap) / 2;
      items.forEach(([label, c, action], i) => this.btn(ctx, label, x0 + i * (w + gap), 156, w, 15, c, action, { size: 5 }));
    } else if (this.mode === 'found') {
      this.spinner(ctx, VW / 2, 158);
    }
    // Aviso (por ejemplo, "tu rival se fue")
    if (this.notice && this.noticeT < 4) {
      const a = Math.min(1, (4 - this.noticeT) / 0.5);
      roundRect(ctx, VW / 2 - 85, 23, 170, 10, 3);
      ctx.fillStyle = `rgba(196,59,79,${0.9 * a})`;
      ctx.fill();
      text(ctx, this.notice, VW / 2, 30, { size: 4.6, weight: 900, align: 'center', alpha: a });
    }
  }

  sidePanel(ctx, x, color, label) {
    panel(ctx, x, 36, 136, 92, { fill: 'rgba(24,18,40,0.82)', r: 5 });
    ctx.save();
    roundRect(ctx, x, 36, 136, 92, 5);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 36, 0, 128);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(x, 36, 136, 92);
    ctx.restore();
    text(ctx, label, x + 68, 46, { size: 5.5, weight: 900, align: 'center', color: '#fff', stroke: '#1b1224', strokeW: 1.5 });
  }

  podium(ctx, key, x, y, t, faceLeft) {
    const c = CREATURES[key];
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 13, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = TYPES[c.type].color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 13, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    drawCreature(ctx, key, x, y + Math.sin(t * 3) * 1, 28, { t, faceLeft });
    text(ctx, c.name, x, y + 22, { size: c.name.length > 9 ? 3.2 : 3.8, weight: 900, align: 'center', color: '#fff', stroke: '#1b1224', strokeW: 1.2 });
  }

  renderInvite(ctx) {
    header(ctx, 'INVITAR A UN AMIGO');
    text(ctx, 'Comparte el link o dile este código:', VW / 2, 38, { size: 5.5, weight: 800, align: 'center', color: '#b9c6e4' });
    [...this.code].forEach((d, i) => {
      const x = VW / 2 - 52 + i * 27;
      roundRect(ctx, x, 44, 23, 32, 4);
      ctx.fillStyle = '#f4f1ea';
      ctx.fill();
      text(ctx, d, x + 11.5, 70, { size: 24, weight: 900, align: 'center', color: '#1b1224' });
    });
    this.sel = this.sel < 0 ? 0 : this.sel;
    this.btn(ctx, 'COMPARTIR LINK', 100, 84, 120, 20, '#4cc44a', () => this.share(), { size: 7 });
    text(ctx, 'Tu amigo abre el link (o EN LÍNEA → TENGO UN CÓDIGO)', VW / 2, 116, { size: 4.4, weight: 700, align: 'center', color: '#f4f1ea' });
    text(ctx, this.message || 'Esperando a tu amigo…', VW / 2, 138, { size: 6, weight: 900, align: 'center', color: '#ffe66b', alpha: 0.6 + Math.sin(this.t * 4) * 0.4 });
    this.spinner(ctx, VW / 2, 152);
  }

  renderKeypad(ctx) {
    header(ctx, 'TENGO UN CÓDIGO');
    text(ctx, 'Código de tu amigo', 80, 46, { size: 6, weight: 800, align: 'center', color: '#b9c6e4' });
    for (let i = 0; i < 4; i++) {
      const x = 80 - 52 + i * 27;
      roundRect(ctx, x, 52, 23, 32, 4);
      ctx.fillStyle = i < this.digits.length ? '#f4f1ea' : 'rgba(255,255,255,0.12)';
      ctx.fill();
      if (this.digits[i]) text(ctx, this.digits[i], x + 11.5, 78, { size: 24, weight: 900, align: 'center', color: '#1b1224' });
    }
    const ready = this.digits.length === 4;
    this.sel = ready ? 0 : -1;
    this.btn(ctx, 'ENTRAR', 30, 100, 100, 24, '#3a8fe0', () => this.join(), { size: 9, disabled: !ready });
    // Teclado numérico grande
    this.rects.keys = [];
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
      this.rects.keys.push({ x, y, w: 36, h: 30, d });
    });
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
      // 5 ataques + GIGAMAX
      this.counts = [0, 0, 0, 0, 0, 0];
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
    this.lostMenu = new Menu(game, [
      { label: 'BUSCAR OTRO RIVAL', color: '#ff7a2f', action: () => this.otherRival() },
      { label: 'MENÚ', color: '#7c4fd0', action: () => this.exit() },
    ], { x: 110, y: 102, w: 100, h: 16, gap: 4, size: 6.5 });
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

  // Revancha: mismos equipos, sin volver a elegir
  rematch() {
    const side = this.session.localSide;
    this.game.setScene(new OnlineScene(this.game, { rematch: true, team: this.start.teams[side], rival: this.start.teams[1 - side] }));
  }

  otherRival() {
    if (this.session && !this.session.closed) this.session.leave();
    this.game.setScene(new OnlineScene(this.game, { team: this.start.teams[this.session.localSide] }));
  }

  buildResult() {
    const b = this.battle;
    const won = b.winner?.side === this.session.localSide;
    this.result = {
      won,
      menu: new Menu(this.game, [
        { label: 'REVANCHA', color: '#ff7a2f', action: () => this.rematch() },
        { label: 'OTRO RIVAL', color: '#3a8fe0', action: () => this.otherRival() },
        { label: 'SALIR', color: '#7c4fd0', action: () => this.exit() },
      ], { x: 110, y: 122, w: 100, h: 14, gap: 3, size: 5.5 }),
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
      this.counts[5] = this.battle.gmaxPress || 0;
    } else if (!this.menuOpen && !this.result) {
      [mx, my] = inp.moveVector();
      for (let i = 0; i < 5; i++) {
        if (inp.isDown(`m${i}`)) h |= 1 << i;
        if (inp.wasPressed(`m${i}`)) this.counts[i]++;
      }
      if (inp.wasPressed('gx')) this.counts[5]++;
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
      if (this.session.rivalReady && !this.session.closed) {
        const a = 0.7 + Math.sin(this.resultT * 6) * 0.3;
        text(ctx, '¡Tu rival quiere la revancha!', VW / 2, 176, { size: 5, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.4, alpha: a });
      }
    }
    if (this.lost) {
      dim(ctx, 0.8);
      text(ctx, 'Se cortó la conexión', VW / 2, 74, { size: 12, weight: 900, align: 'center', color: '#ff7a8a', stroke: '#1b1224', strokeW: 2.5 });
      text(ctx, this.lost === 'se fue' ? 'Tu rival salió de la partida.' : 'Revisen que los dos celulares tengan internet.', VW / 2, 90, { size: 5, weight: 700, align: 'center', color: '#f4f1ea' });
      this.lostMenu.render(ctx);
    }
  }
}
