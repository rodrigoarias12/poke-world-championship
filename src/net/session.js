// Una partida en línea entre dos celulares: saludo, elección de equipos,
// inicio de la pelea, medición de demora y desconexiones.
import { PROTO } from './protocol.js';
import { ARENAS } from '../data.js';

export class Session {
  constructor(game, link, role) {
    this.game = game;
    this.link = link;
    this.role = role;
    this.isHost = role === 'host';
    // El anfitrión juega a la izquierda; el invitado, a la derecha
    this.localSide = this.isHost ? 0 : 1;
    this.myTeam = null;
    this.theirTeam = null;
    this.rtt = 0;
    this.closed = false;
    this.lostReason = null;
    this.versionMismatch = false;
    this.lastRecv = performance.now();
    this.handlers = new Map();
    link.on((m) => this.onMessage(m));
    link.onClose = (reason) => this.lost(reason);
    this.pinger = setInterval(() => {
      this.send({ t: 'ping', ts: performance.now() });
      if (performance.now() - this.lastRecv > 4000) this.lost('sin respuesta');
    }, 1000);
    this.send({ t: 'hello', proto: PROTO });
  }

  send(m) {
    if (!this.closed) this.link.send(m);
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  emit(type, data) {
    for (const fn of this.handlers.get(type) || []) fn(data);
  }

  onMessage(m) {
    this.lastRecv = performance.now();
    switch (m.t) {
      case 'ping':
        this.send({ t: 'pong', ts: m.ts });
        return;
      case 'pong':
        this.rtt = this.rtt ? this.rtt * 0.8 + (performance.now() - m.ts) * 0.2 : performance.now() - m.ts;
        return;
      case 'hello':
        if (m.proto !== PROTO) {
          this.versionMismatch = true;
          this.emit('version', m);
        }
        return;
      case 'team':
        this.theirTeam = m.keys;
        this.emit('team', m);
        this.maybeStart();
        return;
      case 'bye':
        this.lost('se fue');
        return;
      default:
        this.emit(m.t, m);
    }
  }

  // Cada uno elige su equipo; cuando están los dos, el anfitrión arranca la pelea
  sendTeam(keys) {
    this.myTeam = keys;
    this.send({ t: 'team', keys });
    this.maybeStart();
  }

  maybeStart() {
    if (!this.isHost || !this.myTeam || !this.theirTeam) return;
    const start = {
      t: 'start',
      teams: [this.myTeam, this.theirTeam],
      arena: ARENAS[Math.floor(Math.random() * ARENAS.length)],
      seed: 1 + Math.floor(Math.random() * 9999),
    };
    this.myTeam = null;
    this.theirTeam = null;
    this.send(start);
    this.emit('start', start);
  }

  resetTeams() {
    this.myTeam = null;
    this.theirTeam = null;
  }

  lost(reason) {
    if (this.closed) return;
    this.closed = true;
    this.lostReason = reason;
    clearInterval(this.pinger);
    this.link.close(reason);
    this.emit('lost', reason);
    if (this.game.session === this) this.game.session = null;
  }

  leave() {
    if (this.closed) return;
    this.send({ t: 'bye' });
    // Se cierra un instante después para que el aviso llegue
    setTimeout(() => this.lost('saliste'), 150);
  }
}
