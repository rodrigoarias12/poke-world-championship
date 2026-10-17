// Quién maneja cada lado de la pelea: el jugador de este celular, la IA
// o (en línea) el jugador del otro celular.
import { AI } from './ai.js';

// Convierte joystick + botones en la intención del Pokémon. La usan el jugador
// local y el del otro celular, así los dos siguen exactamente las mismas reglas.
// Teclas 1, 2, ESPACIO, Q, E: se pueden mantener apretadas (salvo esquivar).
export function applyButtons(f, mx, my, pressed, held) {
  const it = f.intent;
  const opp = f.opponent;
  it.mx = mx;
  it.my = my;
  it.use = -1;
  for (let i = 0; i < 5; i++) {
    if (pressed(i) || (held(i) && i !== 2)) {
      if (f.cds[i] <= 0) {
        it.use = i;
        break;
      }
    }
  }
  it.aimX = opp.x - f.x;
  it.aimY = opp.y - f.y;
}

export class LocalController {
  constructor(battle, side) {
    this.battle = battle;
    this.side = side;
    this.isAI = false;
  }

  update() {
    const b = this.battle;
    // Con el menú abierto (en línea) el Pokémon se queda quieto
    if (b.inputBlocked) applyButtons(b.fighters[this.side], 0, 0, () => false, () => false);
    else b.localIntent(this.side);
  }
}

export class AIController {
  constructor(battle, side, difficulty) {
    this.side = side;
    this.isAI = true;
    this.ai = new AI(battle, side, difficulty);
  }

  update(dt) {
    this.ai.update(dt);
  }
}

// El Pokémon del otro celular: recibe joystick y botones por la red.
// Cada toque viaja como un contador, así ninguno se pierde aunque llegue tarde.
export class RemoteController {
  constructor(battle, side) {
    this.battle = battle;
    this.side = side;
    this.isAI = false;
    this.mx = 0;
    this.my = 0;
    this.held = 0;
    this.counts = [0, 0, 0, 0, 0];
    this.pending = [0, 0, 0, 0, 0];
    this.expire = [0, 0, 0, 0, 0];
    this.lastInput = performance.now();
  }

  receive(m) {
    const now = performance.now();
    this.mx = m.mx || 0;
    this.my = m.my || 0;
    this.held = m.h || 0;
    for (let i = 0; i < 5; i++) {
      const d = (m.p?.[i] || 0) - this.counts[i];
      if (d > 0) {
        this.pending[i] = Math.min(2, this.pending[i] + d);
        this.expire[i] = now + 350;
      }
      this.counts[i] = Math.max(this.counts[i], m.p?.[i] || 0);
    }
    this.lastInput = now;
  }

  update() {
    const now = performance.now();
    // Si deja de llegar información, el Pokémon se queda quieto
    if (now - this.lastInput > 600) {
      this.mx = 0;
      this.my = 0;
      this.held = 0;
    }
    for (let i = 0; i < 5; i++) if (this.pending[i] && now > this.expire[i]) this.pending[i] = 0;
    const f = this.battle.fighters[this.side];
    applyButtons(f, this.mx, this.my, (i) => this.pending[i] > 0, (i) => ((this.held >> i) & 1) === 1);
    const used = f.intent.use;
    if (used >= 0 && this.pending[used] > 0) this.pending[used]--;
  }
}
