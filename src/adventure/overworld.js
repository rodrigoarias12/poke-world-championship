// El mundo de la aventura: caminar en grilla, hablar, Pokémon salvajes que
// caminan por el pasto alto y entrenadores que te ven. Cada encuentro abre la
// pelea en tiempo real del juego.
import { VW, VH } from '../config.js';
import { CREATURES, TYPES } from '../data.js';
import { text, roundRect, panel, button, inRect, drawCreature, typeBadge, backOut } from '../ui.js';
import { Menu } from '../menu.js';
import { parseMap } from './maps.js';
import { prerenderMap, walkable, tallGrassOverlay, TILE } from './tiles.js';
import { playerSprites, npcSprite } from './people.js';
import { DialogBox } from './dialog.js';
import { AdventureBattleScene, drawBall } from './battle.js';
import { MIN_BALLS, xpToNext } from './state.js';
import './arenas.js';

const STEP = 0.2;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const EDGE = { up: 'n', down: 's', left: 'w', right: 'e' };
// El rival elige el Pokémon que le gana al tuyo
const COUNTER = { charmander: 'squirtle', squirtle: 'bulbasaur', bulbasaur: 'charmander' };

const frameCache = new Map();

export function overworldTouchLayout() {
  return {
    joyTop: 40,
    buttons: [
      { id: 'confirm', x: 292, y: 140, r: 14 },
      { id: 'back', x: 262, y: 158, r: 11 },
      { id: 'pause', x: 302, y: 16, r: 9 },
    ],
  };
}

class Walker {
  constructor(x, y, dir = 'down') {
    this.x = x;
    this.y = y;
    this.px = x * TILE;
    this.py = y * TILE;
    this.dir = dir;
    this.move = null;
    this.walkT = 0;
    this.hopY = 0;
  }

  get moving() {
    return !!this.move;
  }

  place(x, y, dir = this.dir) {
    this.x = x;
    this.y = y;
    this.px = x * TILE;
    this.py = y * TILE;
    this.dir = dir;
    this.move = null;
  }

  // Avanza n casillas (2 = salto de cornisa); la casilla destino queda reservada
  step(dx, dy, dur = STEP, n = 1) {
    this.move = { fx: this.x, fy: this.y, tx: this.x + dx * n, ty: this.y + dy * n, t: 0, dur, hop: n > 1 };
    this.x = this.move.tx;
    this.y = this.move.ty;
  }

  update(dt) {
    const m = this.move;
    if (!m) return false;
    m.t += dt;
    this.walkT += dt;
    const k = Math.min(1, m.t / m.dur);
    this.px = (m.fx + (m.tx - m.fx) * k) * TILE;
    this.py = (m.fy + (m.ty - m.fy) * k) * TILE;
    this.hopY = m.hop ? Math.sin(k * Math.PI) * 7 : 0;
    if (k >= 1) {
      this.move = null;
      this.hopY = 0;
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- Guiones
// Cada guion es un generador que devuelve órdenes; el mundo las ejecuta en orden.
const say = (lines, name) => ({ type: 'say', lines: Array.isArray(lines) ? lines : [lines], name });
const ask = (q, options = ['SÍ', 'NO'], name) => ({ type: 'ask', lines: [q], options, name });
const wait = (t) => ({ type: 'wait', t });
const fade = (fn) => ({ type: 'fade', fn });
const exclaim = (npc) => ({ type: 'exclaim', npc });
const walkTo = (npc, x, y) => ({ type: 'walk', npc, x, y });
const battle = (kind, team, opts = {}) => ({ type: 'battle', kind, team, opts });
const show = (key) => ({ type: 'show', key });

function* scriptIntro(s) {
  s.state.setFlag('intro');
  yield say([`¡Buenos días, ${s.state.data.name}!`, 'El PROF. OAK pasó a buscarte: te quiere regalar algo muy especial.', '¡Andá a verlo a su laboratorio! Es el edificio grande, abajo a la derecha del pueblo.'], 'MAMÁ');
  s.save();
}

function* scriptMama(s) {
  const st = s.state;
  if (!st.flag('starter')) {
    yield say(['El PROF. OAK te espera en su laboratorio. ¡Que te vaya bien!'], 'MAMÁ');
    return;
  }
  yield say(['¡Qué lindos Pokémon! Vengan, descansen un ratito.'], 'MAMÁ');
  yield fade(() => {
    st.healAll();
    st.data.lastHeal = { map: 'casa', x: 3, y: 5 };
    s.game.audio.play('ready');
  });
  yield say(['¡Listo! Están como nuevos.', `Tenés ${st.data.balls} POKÉ BALLS en la mochila. ¡Cuidate mucho!`], 'MAMÁ');
  s.save();
}

function* scriptOakIntro(s) {
  s.state.setFlag('oakMet');
  yield say(['¡Hola! Soy el PROF. OAK. Estudio a los Pokémon.', 'En esa mesa hay tres POKÉ BALLS con Pokémon adentro.', '¡Elegí el que más te guste! Acercate a la mesa y tocalo.'], 'PROF. OAK');
}

function* scriptOakStop(s) {
  yield say(['¡ESPERÁ!', '¡No vayas al pasto alto sin un Pokémon! Ahí viven los Pokémon salvajes.', 'Vení conmigo a mi laboratorio.'], 'PROF. OAK');
  yield fade(() => s.placeAt('lab', 4, 3, 'up'));
  yield* scriptOakIntro(s);
}

function* scriptOak(s) {
  const st = s.state;
  if (!st.flag('starter')) return yield* scriptOakIntro(s);
  if (!st.flag('rivalDone')) {
    yield say(['¡AZUL te está esperando! Mostrale lo que puede hacer tu Pokémon.'], 'PROF. OAK');
    return;
  }
  const more = st.data.balls < MIN_BALLS;
  yield say(['Los Pokémon salvajes caminan por el pasto alto de la RUTA 1.', 'Peleá con ellos y, cuando queden MAREADOS, ¡tirales una POKÉ BALL!', more ? 'Tomá, unas POKÉ BALLS más.' : '¡Suerte en tu aventura!'], 'PROF. OAK');
  if (more) st.data.balls = MIN_BALLS;
}

function* scriptRival() {
  yield say(['¡Ja! El abuelo dice que podemos elegir un Pokémon.', 'Elegí vos primero… ¡igual yo voy a elegir mejor!'], 'AZUL');
}

function* scriptStarter(s, key) {
  const st = s.state;
  if (st.flag('starter')) {
    yield say(['Esta POKÉ BALL está vacía.']);
    return;
  }
  if (!st.flag('oakMet')) yield* scriptOakIntro(s);
  const c = CREATURES[key];
  yield show(key);
  const i = yield ask(`¿Elegís a ${c.name}, el Pokémon de tipo ${TYPES[c.type].name}?`);
  yield show(null);
  if (i !== 0) return;
  st.add(key, 5);
  st.setFlag('starter', key);
  s.game.audio.play('win');
  yield say([`¡${c.name} se unió a tu equipo!`]);
  const theirs = COUNTER[key];
  yield say([`¡Entonces yo me quedo con ${CREATURES[theirs].name}!`, `¡Vamos, ${st.data.name}! ¡Probemos nuestros Pokémon!`], 'AZUL');
  const res = yield battle('rival', [[theirs, 4]], { round: 'RIVAL AZUL', canLose: true });
  if (res.outcome === 'win') yield say(['¡¿QUÉ?! ¡No puede ser! ¡Elegí mal!'], 'AZUL');
  else yield say(['¡Ja! ¡Gané! ¡Soy el mejor entrenador del mundo!'], 'AZUL');
  yield fade(() => st.healAll());
  const how = s.game.input.touchMode ? 'tocá el botón de la POKÉ BALL' : 'apretá R para tirar una POKÉ BALL';
  yield say(['¡Qué buena pelea! Ya curé a tu Pokémon.', 'Tomá estas 10 POKÉ BALLS.', `Cuando un Pokémon salvaje quede MAREADO, ${how}.`, '¡Andá a la RUTA 1, al norte del pueblo!'], 'PROF. OAK');
  st.data.balls += 10;
  s.game.audio.play('ready');
  yield say([`¡Nos vemos, ${st.data.name}! ¡La próxima te gano!`], 'AZUL');
  st.setFlag('rivalDone');
  s.refreshNpcs();
  s.save();
}

function* scriptRegalo(s) {
  const st = s.state;
  if (st.flag('regalo1')) {
    yield say(['¡Visitá la TIENDA POKÉMON de CIUDAD VERDE cuando abramos!'], 'VENDEDOR');
    return;
  }
  yield say(['¡Hola! Trabajo en la TIENDA POKÉMON.', '¡Tomá, una muestra gratis!'], 'VENDEDOR');
  st.data.balls += 3;
  st.setFlag('regalo1');
  s.game.audio.play('ready');
  yield say(['Recibiste 3 POKÉ BALLS.']);
  s.save();
}

function* scriptJoy(s) {
  const st = s.state;
  const i = yield ask('¡Bienvenido al CENTRO POKÉMON! ¿Curo a tus Pokémon?', ['SÍ', 'NO'], 'ENFERMERA JOY');
  if (i !== 0) {
    yield say(['¡Volvé cuando quieras!'], 'ENFERMERA JOY');
    return;
  }
  yield fade(() => {
    st.healAll();
    st.data.lastHeal = { map: 'centro', x: 5, y: 5 };
    s.game.audio.play('win');
  });
  yield say(['¡Listo! Tus Pokémon están sanos y llenos de energía.', '¡Volvé cuando quieras!'], 'ENFERMERA JOY');
  s.save();
  if (!st.flag('cap1')) {
    st.setFlag('cap1');
    s.banner = { text: '¡CAPÍTULO 1 COMPLETO!', t: 0, big: true };
    yield wait(1.2);
    yield say(['¡Felicitaciones! Llegaste a CIUDAD VERDE.', 'El camino a CIUDAD PLATEADA y a BROCK se abre en el capítulo 2.', 'Mientras tanto… ¡a atrapar más Pokémon en la RUTA 1!']);
    s.save();
  }
}

function* scriptTrainer(s, npc, talked = false) {
  const tr = npc.trainer;
  const st = s.state;
  if (!talked) {
    yield exclaim(npc);
    const [dx, dy] = DIRS[npc.dir || 'down'];
    yield walkTo(npc, s.player.x - dx, s.player.y - dy);
  }
  yield say(tr.before, tr.name);
  const lv = (l) => Math.max(2, l - (st.data.penalty[tr.id] || 0));
  const res = yield battle('trainer', tr.team.map(([k, l]) => [k, lv(l)]), { round: tr.name, trainer: tr });
  if (res.outcome === 'win') yield say(tr.after, tr.name);
}

const SCRIPTS = { mama: scriptMama, oak: scriptOak, rival: scriptRival, regalo: scriptRegalo, joy: scriptJoy };

// ---------------------------------------------------------------- Escena

export class OverworldScene {
  constructor(game, state) {
    this.game = game;
    this.state = state;
    this.t = 0;
    this.dialog = null;
    this.script = null;
    this.waitT = 0;
    this.bubble = null;
    this.walking = null;
    this.banner = null;
    this.showcase = null;
    this.fade = 1;
    this.fading = null;
    this.transition = null;
    this.menu = null;
    this.party = null;
    this.toast = null;
    this.safeSteps = 0;
    this.turnT = 0;
    this.bumpT = 0;
    this.respawnT = 0;
    const d = state.data;
    this.player = new Walker(d.x, d.y, d.dir);
    this.loadMap(d.map);
  }

  // ------------------------------------------------------------ Mapa
  loadMap(id) {
    const map = (this.map = parseMap(id));
    if (!frameCache.has(id)) frameCache.set(id, prerenderMap(map));
    this.frames = frameCache.get(id);
    this.refreshNpcs();
    this.grassTiles = [];
    map.rows.forEach((row, y) => [...row].forEach((ch, x) => ch === ',' && this.grassTiles.push([x, y])));
    this.wilds = [];
    this.banner = { text: map.name, t: 0 };
    this.state.data.map = id;
    if (id === 'casa' && !this.state.flag('intro')) this.queued = scriptIntro(this);
  }

  refreshNpcs() {
    this.npcs = this.map.people
      .filter((p) => !(p.hideIf && this.state.flag(p.hideIf)))
      .map((p) => ({ ...p, walker: new Walker(p.x, p.y, p.dir || 'down') }));
  }

  placeAt(id, x, y, dir) {
    this.loadMap(id);
    this.player.place(x, y, dir);
  }

  warp(id, x, y, dir) {
    this.fadeOut(() => {
      this.placeAt(id, x, y, dir);
      this.save();
    });
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h;
  }

  npcAt(x, y) {
    return this.npcs.find((n) => n.walker.x === x && n.walker.y === y);
  }

  wildAt(x, y) {
    return this.wilds.find((w) => w.walker.x === x && w.walker.y === y);
  }

  occupied(x, y) {
    return (this.player.x === x && this.player.y === y) || !!this.npcAt(x, y) || !!this.wildAt(x, y);
  }

  doorAt(x, y) {
    return this.map.doors?.find((d) => d.x === x && d.y === y);
  }

  save() {
    const d = this.state.data;
    Object.assign(d, { map: this.map.id, x: this.player.x, y: this.player.y, dir: this.player.dir });
    this.state.save();
  }

  // ------------------------------------------------------------ Ciclo de la escena
  onEnter() {
    const g = this.game;
    g.input.setControls(overworldTouchLayout());
    g.input.releaseAll();
    g.audio.music('menu');
    g.announcer.onLine = null;
  }

  onExit() {
    this.game.input.setControls(null);
  }

  onBlur() {
    this.save();
  }

  touchControlsActive() {
    return !this.dialog && !this.menu && !this.party && !this.script && !this.transition;
  }

  fadeOut(fn, after) {
    this.fading = { fn, after, out: true };
  }

  // ------------------------------------------------------------ Guiones
  run(gen) {
    if (this.script) return;
    this.script = gen;
    this.advance();
  }

  advance(v) {
    if (!this.script) return;
    const r = this.script.next(v);
    if (r.done) {
      this.script = null;
      return;
    }
    this.exec(r.value);
  }

  exec(c) {
    switch (c.type) {
      case 'say':
      case 'ask':
        this.dialog = new DialogBox(c.lines, {
          name: c.name,
          choices: c.type === 'ask' ? c.options : null,
          onDone: (v) => {
            this.dialog = null;
            this.advance(v);
          },
        });
        break;
      case 'wait':
        this.waitT = c.t;
        break;
      case 'fade':
        this.fadeOut(c.fn, () => this.advance());
        break;
      case 'exclaim':
        this.bubble = { npc: c.npc, t: 0 };
        this.game.audio.play('beep');
        break;
      case 'walk':
        this.walking = c;
        break;
      case 'battle':
        this.launchBattle(c.kind, c.team, c.opts, (res) => this.advance(res));
        break;
      case 'show':
        this.showcase = c.key ? { key: c.key, t: 0 } : null;
        if (c.key) this.game.audio.cry(CREATURES[c.key].id);
        this.advance();
        break;
    }
  }

  say(lines, cb, name) {
    this.dialog = new DialogBox(lines, {
      name,
      onDone: () => {
        this.dialog = null;
        cb?.();
      },
    });
  }

  // ------------------------------------------------------------ Pokémon salvajes
  spawnWild() {
    const W = this.map.wild;
    if (!W || !this.grassTiles.length) return;
    const total = W.table.reduce((a, r) => a + r[1], 0);
    for (let tries = 0; tries < 40; tries++) {
      const [x, y] = this.grassTiles[Math.floor(Math.random() * this.grassTiles.length)];
      if (this.occupied(x, y) || Math.abs(x - this.player.x) + Math.abs(y - this.player.y) < 4) continue;
      let r = Math.random() * total;
      let row = W.table[0];
      for (const e of W.table) {
        r -= e[1];
        if (r <= 0) {
          row = e;
          break;
        }
      }
      const [key, , lo, hi] = row;
      const level = lo + Math.floor(Math.random() * (hi - lo + 1));
      this.wilds.push({ key, level, walker: new Walker(x, y, Math.random() < 0.5 ? 'left' : 'right'), timer: Math.random() * 1.5, bob: Math.random() * 6 });
      return;
    }
  }

  updateWilds(dt) {
    const W = this.map.wild;
    if (!W) return;
    if (this.wilds.length < W.count) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.spawnWild();
        this.respawnT = this.wilds.length < 2 ? 0.2 : 2.5;
      }
    }
    if (this.script || this.dialog || this.transition) return;
    for (const w of this.wilds) {
      if (w.walker.moving) continue;
      w.timer -= dt;
      if (w.timer > 0) continue;
      w.timer = 0.8 + Math.random() * 1.8;
      const dirs = ['up', 'down', 'left', 'right'].sort(() => Math.random() - 0.5);
      for (const d of dirs) {
        const [dx, dy] = DIRS[d];
        const nx = w.walker.x + dx;
        const ny = w.walker.y + dy;
        if (this.inside(nx, ny) && this.map.rows[ny][nx] === ',' && !this.occupied(nx, ny)) {
          if (dx) w.walker.dir = d;
          w.walker.step(dx, dy, 0.32);
          break;
        }
      }
    }
  }

  startWild(w) {
    if (!this.state.fighters().length) {
      this.say(['¡Tus Pokémon están muy cansados para pelear!', 'Curalos en tu casa o en un CENTRO POKÉMON.']);
      return;
    }
    this.launchBattle('wild', [[w.key, w.level]], { round: '¡POKÉMON SALVAJE!', wild: w }, null);
  }

  // ------------------------------------------------------------ Peleas
  launchBattle(kind, team, opts, onEnd) {
    const st = this.state;
    const mine = st.fighters();
    if (!mine.length) return onEnd?.({ outcome: 'lose', party: [], defeated: [] });
    const members0 = mine.map((m) => ({ uid: m.uid, key: m.key, level: m.level, hp: m.hp }));
    const members1 = team.map(([key, level]) => ({ key, level, hp: 1 }));
    const cfg = {
      mode: 'aventura',
      teamA: members0.map((m) => m.key),
      teamB: members1.map((m) => m.key),
      bossLast: false,
      difficulty: kind === 'wild' ? 'salvaje' : kind === 'rival' ? 'rival' : 'entrenador',
      arena: opts.arena || this.map.arena || 'ruta',
      round: opts.round || 'COMBATE',
      adv: { kind, members: [members0, members1], balls: st.data.balls },
      onResult: (res) => this.applyResult(res, kind, opts),
      onDone: (res, extra) => this.returnFromBattle(res, kind, opts, onEnd, extra),
    };
    this.save();
    this.game.audio.play('go');
    this.transition = { t: 0, kind, fired: false, cb: () => this.game.setScene(new AdventureBattleScene(this.game, cfg)) };
  }

  applyResult(res, kind, opts) {
    const lines = this.state.applyBattle(res, { mult: kind === 'wild' ? 1 : 1.5 });
    if (res.outcome === 'win' && opts.trainer) this.state.data.trainers[opts.trainer.id] = true;
    if (res.outcome === 'lose' && opts.trainer) this.state.data.penalty[opts.trainer.id] = (this.state.data.penalty[opts.trainer.id] || 0) + 1;
    this.save();
    return lines.slice(0, 5);
  }

  returnFromBattle(res, kind, opts, onEnd, extra) {
    this.transition = null;
    this.game.setScene(this);
    if (opts.wild) this.wilds = this.wilds.filter((w) => w !== opts.wild);
    this.safeSteps = 4;
    this.fade = 1;
    if (res.outcome === 'fled') {
      this.state.applyBattle({ party: res.party, ballsUsed: res.ballsUsed });
      this.save();
    }
    const after = () => onEnd?.(res);
    if (res.outcome === 'lose' && !opts.canLose) return this.whiteout(after);
    if (extra) this.say(extra, after);
    else after();
  }

  // Perdiste todo: despertás donde te curaste la última vez, sin castigo
  whiteout(after) {
    const st = this.state;
    const h = st.data.lastHeal;
    const where = h.map === 'centro' ? 'el CENTRO POKÉMON' : 'tu casa';
    this.script = null;
    this.say(['¡Tus Pokémon se cansaron!', `Volviste corriendo a ${where} para que descansen.`], () => {
      this.fadeOut(() => {
        this.placeAt(h.map, h.x, h.y, 'down');
        st.healAll();
        this.save();
      }, () => this.say(['¡Tus Pokémon ya se recuperaron! ¡A intentarlo de nuevo!'], after));
    });
  }

  // ------------------------------------------------------------ Moverse
  update(dt) {
    this.t += dt;
    this.state.data.playTime += dt;
    const inp = this.game.input;
    if (this.toast) {
      this.toast.t += dt;
      if (this.toast.t > 2) this.toast = null;
    }
    if (this.banner) this.banner.t += dt;
    // Fundidos: se oscurece, se hace el cambio, se aclara
    if (this.fading) {
      this.fade = Math.min(1, this.fade + dt * 4);
      if (this.fade >= 1) {
        const f = this.fading;
        this.fading = null;
        f.fn?.();
        this.afterFade = f.after;
      }
      return;
    }
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt * 4);
      if (this.fade === 0 && this.afterFade) {
        const a = this.afterFade;
        this.afterFade = null;
        a();
      }
      if (this.fade > 0.4) return;
    }
    if (this.transition) {
      this.transition.t += dt;
      if (this.transition.t >= 0.95 && !this.transition.fired) {
        this.transition.fired = true;
        this.transition.cb();
      }
      return;
    }
    if (this.queued && !this.script) {
      const q = this.queued;
      this.queued = null;
      this.run(q);
    }
    this.bumpT = Math.max(0, this.bumpT - dt);
    const pDone = this.player.update(dt);
    for (const n of this.npcs) n.walker.update(dt);
    for (const w of this.wilds) w.walker.update(dt);
    this.updateWilds(dt);
    if (this.showcase) this.showcase.t += dt;
    if (pDone) this.onStepDone();
    if (this.party) return this.updateParty(inp);
    if (this.menu) {
      this.menu.update();
      if (inp.wasPressed('back') || inp.wasPressed('pause')) this.menu = null;
      return;
    }
    if (this.dialog) return this.dialog.update(dt, inp);
    if (this.bubble) {
      this.bubble.t += dt;
      if (this.bubble.t >= 0.7) {
        this.bubble = null;
        this.advance();
      }
      return;
    }
    if (this.walking) return this.updateWalking();
    if (this.waitT > 0) {
      this.waitT -= dt;
      if (this.waitT <= 0) this.advance();
      return;
    }
    if (this.script) return;
    this.updatePlayer(dt, inp);
  }

  updateWalking() {
    const { npc, x, y } = this.walking;
    const w = npc.walker;
    if (w.moving) return;
    if (w.x === x && w.y === y) {
      this.walking = null;
      this.advance();
      return;
    }
    const dx = Math.sign(x - w.x);
    const dy = dx ? 0 : Math.sign(y - w.y);
    if (this.occupied(w.x + dx, w.y + dy)) {
      this.walking = null;
      this.advance();
      return;
    }
    w.step(dx, dy, STEP);
  }

  readDir(inp) {
    const [mx, my] = inp.moveVector();
    const ax = Math.abs(mx);
    const ay = Math.abs(my);
    if (Math.max(ax, ay) < 0.35) return null;
    const cur = this.player.dir;
    const wasHoriz = cur === 'left' || cur === 'right';
    // Un poco de "memoria" en las diagonales para que no titile
    const horiz = wasHoriz ? ax > ay * 0.75 : ax > ay * 1.33;
    return horiz ? (mx > 0 ? 'right' : 'left') : my > 0 ? 'down' : 'up';
  }

  updatePlayer(dt, inp) {
    if (inp.wasPressed('back') || inp.wasPressed('pause')) return this.openMenu();
    if (this.player.moving) return;
    if (inp.wasPressed('confirm')) return this.interact();
    const dir = this.readDir(inp);
    if (!dir) {
      this.turnT = 0;
      return;
    }
    if (dir !== this.player.dir) {
      this.player.dir = dir;
      this.turnT = 0.09;
      return;
    }
    if (this.turnT > 0) {
      this.turnT -= dt;
      return;
    }
    this.tryStep(dir);
  }

  bump() {
    if (this.bumpT > 0) return;
    this.bumpT = 0.3;
    this.game.audio.play('select');
  }

  tryStep(dir) {
    const [dx, dy] = DIRS[dir];
    const p = this.player;
    const nx = p.x + dx;
    const ny = p.y + dy;
    const map = this.map;
    if (!this.inside(nx, ny)) return this.leaveEdge(dir);
    if (map.id === 'pueblo' && ny <= 1 && !this.state.flag('starter')) return this.run(scriptOakStop(this));
    const wild = this.wildAt(nx, ny);
    if (wild) return this.startWild(wild);
    const ch = map.rows[ny][nx];
    if (ch === 'L' && dir === 'down') {
      const ty = ny + 1;
      if (ty < map.h && walkable(map, map.rows[ty][nx]) && !this.occupied(nx, ty)) {
        p.step(0, 1, 0.34, 2);
        this.game.audio.play('dash');
      }
      return;
    }
    if (ch === 'D') {
      const door = this.doorAt(nx, ny);
      if (door?.closed) return this.say(door.closed);
    }
    if (!walkable(map, ch) || this.occupied(nx, ny)) return this.bump();
    p.step(dx, dy);
  }

  leaveEdge(dir) {
    const e = this.map.edges?.[EDGE[dir]];
    if (!e) return this.bump();
    if (e.blocked) return this.say(e.blocked);
    const dest = parseMap(e.to);
    const x = this.player.x + (e.dx || 0);
    let y = this.player.y;
    if (dir === 'up') y = dest.h - 2;
    if (dir === 'down') y = 1;
    this.warp(e.to, x, y, dir);
  }

  onStepDone() {
    const p = this.player;
    const ch = this.map.rows[p.y]?.[p.x];
    if (this.map.interior && ch === 'm') {
      const e = this.map.exit;
      return this.warp(e.to, e.x, e.y, 'down');
    }
    if (ch === 'D') {
      const door = this.doorAt(p.x, p.y);
      if (door && !door.closed) {
        this.game.audio.play('confirm');
        return this.warp(door.to, door.tx, door.ty, 'up');
      }
    }
    if (this.safeSteps > 0) this.safeSteps--;
    this.checkTrainers();
  }

  // Entrenadores que te ven en línea recta
  checkTrainers() {
    if (this.script) return;
    for (const n of this.npcs) {
      const tr = n.trainer;
      if (!tr || this.state.data.trainers[tr.id]) continue;
      const [dx, dy] = DIRS[n.dir || 'down'];
      for (let i = 1; i <= tr.sight; i++) {
        const x = n.walker.x + dx * i;
        const y = n.walker.y + dy * i;
        if (this.player.x === x && this.player.y === y) {
          this.run(scriptTrainer(this, n));
          return;
        }
        if (!this.inside(x, y) || !walkable(this.map, this.map.rows[y][x]) || this.npcAt(x, y)) break;
      }
    }
  }

  interact() {
    const [dx, dy] = DIRS[this.player.dir];
    const x = this.player.x + dx;
    const y = this.player.y + dy;
    if (!this.inside(x, y)) return;
    const wild = this.wildAt(x, y);
    if (wild) return this.startWild(wild);
    let npc = this.npcAt(x, y);
    // En los mostradores se habla con quien está del otro lado
    if (!npc && this.map.interior && this.map.rows[y][x] === '=') npc = this.npcAt(x + dx, y + dy);
    if (npc) return this.talk(npc);
    const ch = this.map.rows[y][x];
    if (ch === 'S') {
      const sign = this.map.signs?.find((s) => s.x === x && s.y === y);
      if (sign) return this.say(sign.text);
    }
    const ball = this.map.balls?.find((b) => b.x === x && b.y === y);
    if (ball) return this.run(scriptStarter(this, ball.key));
    if (ch === 'D') {
      const door = this.doorAt(x, y);
      if (door?.closed) return this.say(door.closed);
    }
  }

  talk(npc) {
    const tr = npc.trainer;
    if (tr) {
      if (!this.state.data.trainers[tr.id]) return this.run(scriptTrainer(this, npc, true));
      return this.say(tr.after, null, tr.name);
    }
    if (npc.script) return this.run(SCRIPTS[npc.script](this, npc));
    return this.say(npc.text);
  }

  // ------------------------------------------------------------ Menús
  openMenu() {
    this.game.audio.play('select');
    const items = [];
    if (this.state.party.length) items.push({ label: 'POKÉMON', color: '#e8413b', action: () => this.openParty() });
    items.push({ label: 'GUARDAR', color: '#3a8fe0', action: () => this.doSave() });
    items.push({ label: 'SALIR', color: '#7c4fd0', action: () => this.quit() });
    items.push({ label: 'SEGUIR', color: '#4cc44a', action: () => (this.menu = null) });
    this.menu = new Menu(this.game, items, { x: 222, y: 26, w: 88, h: 14, gap: 3, size: 6 });
  }

  doSave() {
    this.save();
    this.menu = null;
    this.toast = { text: '¡Partida guardada!', t: 0 };
    this.game.audio.play('confirm');
  }

  async quit() {
    this.save();
    const { TitleScene } = await import('../scenes.js');
    this.game.setScene(new TitleScene(this.game));
  }

  openParty() {
    this.menu = null;
    this.party = { sel: 0 };
  }

  updateParty(inp) {
    const p = this.party;
    const n = this.state.party.length;
    if (inp.wasPressed('down')) p.sel = (p.sel + 1) % n;
    if (inp.wasPressed('up')) p.sel = (p.sel - 1 + n) % n;
    if (inp.wasPressed('confirm')) this.makeFirst(p.sel);
    if (inp.wasPressed('back') || inp.wasPressed('pause')) this.party = null;
  }

  makeFirst(i) {
    if (i > 0) {
      this.state.moveFirst(i);
      this.party.sel = 0;
      this.toast = { text: `¡${CREATURES[this.state.party[0].key].name} va primero!`, t: 0 };
      this.game.audio.play('confirm');
      this.save();
    }
  }

  onPointerDown(x, y) {
    if (this.party) {
      if (inRect(x, y, this.partyBack)) return (this.party = null);
      const i = (this.partyRects || []).findIndex((r) => inRect(x, y, r));
      if (i >= 0) {
        if (i === this.party.sel) this.makeFirst(i);
        else this.party.sel = i;
      }
      return;
    }
    if (this.menu) {
      if (!this.menu.pointerDown(x, y)) this.menu = null;
      return;
    }
    if (this.dialog) return this.dialog.pointerDown(x, y);
  }

  onPointerMove(x, y) {
    this.menu?.pointerMove(x, y);
  }

  // ------------------------------------------------------------ Dibujo
  camera() {
    const mw = this.map.w * TILE;
    const mh = this.map.h * TILE;
    const cx = mw <= VW ? (mw - VW) / 2 : Math.max(0, Math.min(mw - VW, this.player.px + 8 - VW / 2));
    const cy = mh <= VH ? (mh - VH) / 2 : Math.max(0, Math.min(mh - VH, this.player.py + 8 - VH / 2));
    return [Math.round(cx), Math.round(cy)];
  }

  render(ctx) {
    ctx.fillStyle = '#120d1c';
    ctx.fillRect(0, 0, VW, VH);
    const [cx, cy] = this.camera();
    const frame = this.frames[Math.floor(this.t * 4) % this.frames.length];
    // Solo el pedazo visible (Safari no dibuja si el recorte se sale del mapa)
    const sx = Math.max(0, cx);
    const sy = Math.max(0, cy);
    const sw = Math.min(frame.width - sx, VW - (sx - cx));
    const sh = Math.min(frame.height - sy, VH - (sy - cy));
    if (sw > 0 && sh > 0) ctx.drawImage(frame, sx, sy, sw, sh, sx - cx, sy - cy, sw, sh);

    // Personajes de arriba hacia abajo
    const ents = [
      ...this.npcs.map((n) => ({ y: n.walker.py, draw: () => this.drawPerson(ctx, n.walker, npcSprite(n.look), cx, cy) })),
      ...this.wilds.map((w) => ({ y: w.walker.py, draw: () => this.drawWild(ctx, w, cx, cy) })),
      { y: this.player.py, draw: () => this.drawPlayer(ctx, cx, cy) },
    ].sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    if (this.bubble) this.drawBubble(ctx, this.bubble.npc.walker, cx, cy);
    if (this.touchControlsActive() && this.game.input.touchMode) this.drawTouch(ctx);
    if (this.banner) this.drawBanner(ctx);
    this.drawHud(ctx);
    if (this.showcase) this.drawShowcase(ctx);
    if (this.dialog) this.dialog.render(ctx);
    if (this.menu) {
      panel(ctx, 216, 18, 100, 16 + this.menu.items.length * 17, { fill: 'rgba(20,14,34,0.92)', r: 4 });
      this.menu.render(ctx);
    }
    if (this.party) this.drawParty(ctx);
    if (this.toast) {
      const a = Math.min(1, (2 - this.toast.t) * 3);
      roundRect(ctx, VW / 2 - 60, 20, 120, 12, 4);
      ctx.fillStyle = `rgba(20,14,34,${0.9 * a})`;
      ctx.fill();
      text(ctx, this.toast.text, VW / 2, 28.5, { size: 5.5, weight: 900, align: 'center', color: '#ffe66b', alpha: a });
    }
    if (this.transition) this.drawTransition(ctx);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  // Si está parado en pasto alto, el pasto le tapa los pies
  grassOver(ctx, walker, cx, cy) {
    const tx = Math.round(walker.px / TILE);
    const ty = Math.round(walker.py / TILE);
    if (this.map.rows[ty]?.[tx] === ',') ctx.drawImage(tallGrassOverlay(), tx * TILE - cx, ty * TILE + 9 - cy);
  }

  drawPerson(ctx, w, img, cx, cy) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(w.px + 8 - cx, w.py + 14 - cy, 5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, Math.round(w.px + 2 - cx), Math.round(w.py - 2 - cy - w.hopY));
    this.grassOver(ctx, w, cx, cy);
  }

  drawPlayer(ctx, cx, cy) {
    const p = this.player;
    const set = playerSprites(this.state.data.look)[p.dir];
    const i = p.moving ? Math.floor(p.walkT / 0.1) % 4 : 0;
    this.drawPerson(ctx, p, set[i], cx, cy);
  }

  drawWild(ctx, w, cx, cy) {
    const x = w.walker.px + 8 - cx;
    const y = w.walker.py - cy;
    const bob = Math.abs(Math.sin(this.t * 5 + w.bob)) * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCreature(ctx, w.key, x, y + 6 - bob, 16, { faceLeft: w.walker.dir === 'left', t: this.t + w.bob });
    this.grassOver(ctx, w.walker, cx, cy);
  }

  drawBubble(ctx, w, cx, cy) {
    const k = backOut(Math.min(1, this.bubble.t / 0.15));
    const x = w.px + 8 - cx;
    const y = w.py - 10 - cy;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    roundRect(ctx, -5, -6, 10, 11, 2);
    ctx.fillStyle = '#1b1224';
    ctx.fill();
    roundRect(ctx, -4, -5, 8, 9, 1.5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    text(ctx, '!', 0, 2.6, { size: 8, weight: 900, align: 'center', color: '#e8413b' });
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    const dur = b.big ? 3.2 : 2.2;
    if (b.t > dur + 0.3) return (this.banner = null);
    const k = b.t < 0.3 ? b.t / 0.3 : b.t > dur ? 1 - (b.t - dur) / 0.3 : 1;
    if (b.big) {
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(10,6,20,0.8)';
      ctx.fillRect(0, 62, VW, 36);
      text(ctx, b.text, VW / 2, 86, { size: 13 * backOut(Math.min(1, b.t / 0.4)), weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
      ctx.restore();
      return;
    }
    const w = 112;
    const x = -w + (w + 6) * k;
    roundRect(ctx, x, 6, w, 16, 3);
    ctx.fillStyle = '#7a4a28';
    ctx.fill();
    roundRect(ctx, x + 1.5, 7.5, w - 3, 13, 2);
    ctx.fillStyle = '#f4e4b8';
    ctx.fill();
    text(ctx, b.text, x + w / 2, 16.6, { size: 6.4, weight: 900, align: 'center', color: '#4a2f1b' });
  }

  // Poké Balls y equipo (arriba a la derecha)
  drawHud(ctx) {
    const st = this.state;
    if (!st.party.length || this.dialog || this.menu || this.party) return;
    const x = VW - (this.game.input.touchMode ? 108 : 84);
    roundRect(ctx, x, 4, 80, 12, 4);
    ctx.fillStyle = 'rgba(20,14,34,0.75)';
    ctx.fill();
    drawBall(ctx, x + 7, 10, 3);
    text(ctx, `×${st.data.balls}`, x + 12, 12.2, { size: 5, weight: 900, color: '#ffffff' });
    st.party.forEach((m, i) => {
      ctx.fillStyle = m.hp > 0.5 ? '#4fd65a' : m.hp > 0.2 ? '#f2c318' : m.hp > 0 ? '#ff4b4b' : '#5a5466';
      ctx.beginPath();
      ctx.arc(x + 34 + i * 7.5, 10, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawShowcase(ctx) {
    const s = this.showcase;
    const c = CREATURES[s.key];
    const k = backOut(Math.min(1, s.t / 0.3));
    panel(ctx, VW / 2 - 58, 14, 116, 106, { fill: 'rgba(30,24,50,0.94)', r: 6 });
    ctx.fillStyle = TYPES[c.type].color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(VW / 2, 62, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    drawCreature(ctx, s.key, VW / 2, 62 + Math.sin(s.t * 3) * 1.5, 64 * k, { t: s.t });
    text(ctx, c.name, VW / 2, 108, { size: 8, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
    typeBadge(ctx, c.type, VW / 2, 111, { size: 3.6, align: 'right' });
    text(ctx, c.cry, VW / 2 + 4, 115.5, { size: 4, weight: 800, color: '#ffe66b' });
  }

  drawParty(ctx) {
    const st = this.state;
    ctx.fillStyle = 'rgba(12,8,22,0.85)';
    ctx.fillRect(0, 0, VW, VH);
    text(ctx, 'TU EQUIPO', VW / 2, 16, { size: 10, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 2.5 });
    this.partyRects = st.party.map((m, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 14 + col * 150;
      const y = 24 + row * 40;
      const sel = i === this.party.sel;
      panel(ctx, x, y, 142, 36, { fill: sel ? '#3a2a5e' : 'rgba(30,24,50,0.92)', r: 4, border: sel ? '#ffe66b' : 'rgba(255,255,255,0.14)' });
      const c = CREATURES[m.key];
      drawCreature(ctx, m.key, x + 18, y + 18, 28, { t: this.t + i });
      text(ctx, c.name, x + 36, y + 11, { size: 6, weight: 900 });
      text(ctx, `Nv ${m.level}`, x + 136, y + 11, { size: 5.5, weight: 900, align: 'right', color: '#ffe66b' });
      if (i === 0) text(ctx, 'PRIMERO', x + 36, y + 31, { size: 3.6, weight: 900, color: '#7dff8a' });
      const bw = 96;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + 36, y + 15, bw, 4);
      ctx.fillStyle = m.hp > 0.5 ? '#4fd65a' : m.hp > 0.2 ? '#f2c318' : '#ff4b4b';
      ctx.fillRect(x + 36, y + 15, bw * m.hp, 4);
      text(ctx, m.hp > 0 ? 'VIDA' : 'DEBILITADO', x + 36, y + 25, { size: 3.4, weight: 800, color: m.hp > 0 ? 'rgba(255,255,255,0.7)' : '#ff8a96' });
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + 66, y + 22, 66, 2.4);
      ctx.fillStyle = '#3fa7ff';
      ctx.fillRect(x + 66, y + 22, 66 * Math.min(1, m.xp / xpToNext(m.level)), 2.4);
      text(ctx, 'EXP', x + 60, y + 24.5, { size: 3, weight: 800, align: 'right', color: 'rgba(255,255,255,0.6)' });
      return { x, y, w: 142, h: 36 };
    });
    const tip = this.game.input.touchMode ? 'Tocá dos veces un Pokémon para ponerlo primero' : '↑ ↓ elegir · ENTER ponerlo primero · ESC volver';
    text(ctx, tip, VW / 2, 150, { size: 4.2, weight: 700, align: 'center', color: 'rgba(255,255,255,0.75)' });
    if (st.data.box.length) text(ctx, `En la caja: ${st.data.box.length} Pokémon`, VW / 2, 158, { size: 4, weight: 800, align: 'center', color: '#b9c6e4' });
    this.partyBack = button(ctx, 'VOLVER', 125, 162, 70, 13, { color: '#7c4fd0', size: 5.5 });
  }

  drawTouch(ctx) {
    const inp = this.game.input;
    const j = inp.joy;
    const ox = j ? j.ox : 36;
    const oy = j ? j.oy : 142;
    ctx.save();
    ctx.globalAlpha = j ? 0.8 : 0.35;
    ctx.fillStyle = 'rgba(10,6,20,0.45)';
    ctx.beginPath();
    ctx.arc(ox, oy, 15, 0, Math.PI * 2);
    ctx.fill();
    let kx = ox;
    let ky = oy;
    if (j) {
      const dx = j.x - j.ox;
      const dy = j.y - j.oy;
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(d, 13) / d;
      kx = ox + dx * m;
      ky = oy + dy * m;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(kx, ky, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const b of overworldTouchLayout().buttons) {
      ctx.save();
      ctx.globalAlpha = inp.isDown(b.id) ? 0.95 : 0.7;
      ctx.fillStyle = 'rgba(10,6,20,0.55)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.id === 'confirm' ? '#e8413b' : b.id === 'back' ? '#3a8fe0' : '#7c4fd0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.86, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, b.id === 'confirm' ? 'A' : b.id === 'back' ? 'B' : '☰', b.x, b.y + b.r * 0.32, { size: b.r * 0.9, weight: 900, align: 'center', color: '#fff' });
      ctx.restore();
    }
  }

  // Entrada a la pelea: tres destellos y barras que cierran la pantalla
  drawTransition(ctx) {
    const t = this.transition.t;
    if (t < 0.36) {
      if (Math.floor(t / 0.06) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(0, 0, VW, VH);
      }
      return;
    }
    const k = Math.min(1, (t - 0.36) / 0.5);
    const n = 8;
    const h = VH / n;
    ctx.fillStyle = '#000';
    for (let i = 0; i < n; i++) {
      const w = VW * k;
      ctx.fillRect(i % 2 ? VW - w : 0, i * h, w, h + 0.5);
    }
  }
}
