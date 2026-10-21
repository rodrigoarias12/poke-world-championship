// BATALLA CAMPAL: hasta 5 Pokémon en un Pueblo Paleta grande, todos contra
// todos, con la NIEBLA MORADA que achica el mapa. Gana el último en pie.
// Usa la misma pelea en tiempo real; acá se cambian los ganchos de Battle
// (a quién se apunta, a quiénes se les pega, choques con el mapa) y el bucle
// principal, que nunca se pausa para nadie.
import { VW, VH } from '../config.js';
import { Battle } from '../battle.js';
import { Fighter } from '../fighter.js';
import { CREATURES, DIFFICULTY } from '../data.js';
import { TYPE_COLORS } from '../effects.js';
import { LocalController } from '../controllers.js';
import { updateProjectiles, updateHazards, renderProjectiles, renderHazards, renderGroundHazards, killProjectile } from '../moves.js';
import { text, backOut } from '../ui.js';
import { speakName } from '../announcer.js';
import { fxRandom } from '../rng.js';
import { TILE } from '../adventure/tiles.js';
import { World } from './world.js';
import { Zone, FOG_FLOOR } from './zone.js';
import { BotController } from './bot.js';
import { renderRoyaleHUD } from './hud.js';
import { ITEM_KINDS, rollItem, drawItem } from './items.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Radio fijo de los pies para chocar con el mapa (así los grandes pasan por los pasillos)
export const FEET = 5;
// Lo que "se ve en pantalla" alrededor de cada uno (para apuntar)
export const VIEW_X = 150;
export const VIEW_Y = 82;
// Rayos y olas no cruzan todo el mapa
const BEAM_MAX = 144;
const WAVE_MAX = 150;
const RING_MAX = 80;
const FIGHT_LIMIT = 240;
const HP_MULT = 2.5;
export const PLAYER_COLORS = ['#ffb43b', '#5ab4ff', '#5fd068', '#ff6fb5', '#b48cff'];

// Lo mínimo que necesita un "blanco" cuando no hay nadie cerca: un punto adelante
function makeDummy() {
  return { x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, r: 8, tall: 12, wide: 12, lift: 0, facing: 1, action: null, alive: false, isDummy: true, name: '', side: -1, stun: 0, sleep: 0 };
}

// Adaptador: el resto del motor le pregunta cosas a "la cancha"
class RoyaleArena {
  constructor(world) {
    this.world = world;
    this.name = world.name;
    this.theme = 'campal';
    this.T = { floor: 'ground', name: world.name };
    this.ground = true;
    this.spawns = world.spawns;
    this.ice = [];
  }

  onPlatform(x, y) {
    return !this.world.isWater(x, y);
  }

  freeze(x, y) {
    if (this.ice.length > 80) this.ice.shift();
    const pts = [];
    const n = 6 + Math.floor(fxRandom() * 3);
    const r = 5 + fxRandom() * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (0.6 + fxRandom() * 0.5);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.6]);
    }
    this.ice.push({ x, y, pts, life: 7 + fxRandom() * 2 });
  }

  update(dt) {
    for (const i of this.ice) i.life -= dt;
    this.ice = this.ice.filter((i) => i.life > 0);
  }

  drawWater() {}

  drawIce(ctx) {
    for (const i of this.ice) {
      ctx.globalAlpha = Math.min(1, i.life);
      ctx.fillStyle = '#e8fbff';
      ctx.strokeStyle = '#7ad8f0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      i.pts.forEach(([px, py], k) => (k ? ctx.lineTo(i.x + px, i.y + py) : ctx.moveTo(i.x + px, i.y + py)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// Efectos: lo que pasa lejos de la cámara no se dibuja (ni se calcula)
const SPAWNS = new Set(['typeHit', 'add', 'impact', 'circle', 'burst', 'trail', 'dust', 'ring', 'float', 'ghost']);
function gateEffects(fx, battle) {
  return new Proxy(fx, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v !== 'function') return v;
      if (!SPAWNS.has(prop)) return v.bind(target);
      return (...args) => {
        let x;
        let y;
        if (prop === 'add') ({ x, y } = args[0]);
        else if (prop === 'float' || prop === 'ghost') [x, y] = [args[1], args[2]];
        else [x, y] = args;
        if (!battle.onCamera(x, y, 50)) return undefined;
        return v.apply(target, args);
      };
    },
  });
}

export class RoyaleBattle extends Battle {
  constructor(game, cfg) {
    const players = cfg.players;
    super(game, { teamA: [players[0].key], teamB: [players[1].key], difficulty: cfg.difficulty || 'normal', arena: 'campal', seed: cfg.seed || 1, gmax: false, round: 'BATALLA CAMPAL' });
    this.royale = true;
    this.players = players;
    this.cam = { x: 0, y: 0 };
    this.cur = null;
    this.realAudio = game.audio;
    this.audio = this.makeAudio(game.audio);
    this.effects = gateEffects(this.effects, this);
    this.fighters = players.map((p, i) => this.makeRoyaleFighter(p, i));
    this.controllers = players.map((p, i) => (p.human ? new LocalController(this, i) : new BotController(this, i, p.diff || this.difficulty)));
    this.teams = players.map((p) => ({ keys: [p.key], idx: 0, fainted: [] }));
    this.sideStats = players.map(() => ({ hits: 0, maxCombo: 0, dealt: 0, ko: 0 }));
    this.callouts = players.map(() => null);
    this.localSide = Math.max(0, players.findIndex((p) => p.local));
    this.zone = new Zone(this.world);
    this.items = [];
    this.itemT = 12;
    this.feed = [];
    this.tokens = new Map();
    this.fightT = 0;
    this.fogT = 1;
    this.splitK = 1;
    this.banner = null;
    this.viewSide = this.localSide;
    this.caption = null;
    this.spawnItems(6);
    this.snapCamera();
  }

  // ------------------------------------------------------------- Armado
  createArena() {
    this.world = new World('paleta');
    return new RoyaleArena(this.world);
  }

  makeRoyaleFighter(p, side) {
    const f = new Fighter(this, p.key, side);
    const def = CREATURES[p.key];
    // Todos más parejos: en un todos contra todos los tanques ganarían siempre
    // y con más vida, así las peleas duran (varios pueden pegarte a la vez)
    f.maxHp = Math.round(((def.hp + 130) / 2) * HP_MULT);
    f.hp = f.ghostHp = f.maxHp;
    f.pow = (def.pow + 1.08) / 2;
    f.defn = (def.def + 1.02) / 2;
    f.baseSpeed = f.speed;
    f.human = !!p.human;
    f.label = p.label || def.name;
    f.color = PLAYER_COLORS[side % PLAYER_COLORS.length];
    f.kos = 0;
    f.place = 0;
    f.lastHitBy = null;
    f.lastHitT = -99;
    f.buffDmg = 0;
    f.buffSpeed = 0;
    f.revealT = 0;
    f.sleepImmune = 0;
    f.lastCd = 0;
    f.dummy = makeDummy();
    f.target = null;
    f.forced = null;
    f.facing = f.x < this.world.W / 2 ? 1 : -1;
    return f;
  }

  get player() {
    return this.fighters[this.localSide];
  }

  get enemy() {
    return this.player?.target || this.fighters.find((f) => f !== this.player && f.alive) || this.fighters[1];
  }

  // Lo que sigue la cámara: tu Pokémon o, si quedaste afuera, al que estás mirando
  get viewed() {
    return this.fighters[this.viewSide] || this.player;
  }

  alive() {
    return this.fighters.filter((f) => f.alive);
  }

  // --------------------------------------------------------------- Ganchos
  targetFor(f) {
    if (f.target && f.target.alive) return f.target;
    const d = f.dummy;
    const it = f.intent;
    const moving = Math.hypot(it.mx, it.my) > 0.2;
    d.x = f.x + (moving ? it.mx : f.facing) * 80;
    d.y = f.y + (moving ? it.my : 0) * 80;
    d.facing = f.facing;
    return d;
  }

  enemiesOf(f) {
    return this.fighters.filter((o) => o !== f && o.alive);
  }

  hitBefore(obj, target, flag = 'hit') {
    return !!obj[`_${flag}`]?.has(target);
  }

  markHit(obj, target, flag = 'hit') {
    const set = (obj[`_${flag}`] ||= new Set());
    // Anillos, terremotos y olas: del segundo golpeado en adelante pegan menos
    this.splitK = set.size >= 1 && (obj.kind === 'ring' || obj.kind === 'quake' || obj.kind === 'wave') ? 0.7 : 1;
    set.add(target);
  }

  clearHits(obj) {
    obj.hit = false;
    obj._hit?.clear();
  }

  dmgScale(att, def) {
    let k = att.buffDmg > 0 ? 1.25 : 1;
    // Los bots le pegan más suave a las personas (entre bots pegan normal)
    if (this.controllers[att.side]?.isAI && def.human) k *= DIFFICULTY[this.difficulty].dmgMult;
    return k;
  }

  confine(f, ox, oy) {
    const w = this.world;
    f.x = clamp(f.x, 8, w.W - 8);
    f.y = clamp(f.y, 10, w.H - 4);
    // Volando o bajo tierra no choca; al bajar, si quedó sobre algo, se corre
    if (f.lift > 20) return;
    if (w.feetBlocked(ox, oy, FEET)) {
      [f.x, f.y] = w.unstick(f.x, f.y, FEET);
      return;
    }
    const r = w.slide(ox, oy, f.x, f.y, FEET);
    f.x = r.x;
    f.y = r.y;
    if (r.hitX) f.kx = 0;
    if (r.hitY) f.ky = 0;
  }

  clampSpot(f, x, y) {
    const w = this.world;
    x = clamp(x, 8, w.W - 8);
    y = clamp(y, 10, w.H - 4);
    if (!w.feetBlocked(x, y, FEET)) return [x, y];
    // Lo más lejos que llega en línea recta sin quedar adentro de algo
    const dx = x - f.x;
    const dy = y - f.y;
    const d = Math.hypot(dx, dy);
    for (let k = d; k > 0; k -= 4) {
      const px = f.x + (dx / d) * k;
      const py = f.y + (dy / d) * k;
      if (!w.feetBlocked(px, py, FEET)) return [px, py];
    }
    return w.unstick(f.x, f.y, FEET);
  }

  spotFree(f, x, y) {
    return x > 8 && x < this.world.W - 8 && !this.world.feetBlocked(x, y, FEET);
  }

  // Contra una pared, la embestida termina
  dashBounce(f, a, nx, ny) {
    if (this.world.feetBlocked(nx, ny, FEET)) a.pt = 0;
  }

  projectileOut(p) {
    const w = this.world;
    if (p.x < 0 || p.y < 0 || p.x > w.W || p.y > w.H) return true;
    // Se revisa el tramo recorrido de a 6 para no atravesar un árbol
    const dt = this.stepDt || 1 / 60;
    const px = p.x - p.vx * dt;
    const py = p.y - p.vy * dt;
    const n = Math.max(1, Math.ceil(Math.hypot(p.x - px, p.y - py) / 6));
    for (let i = 1; i <= n; i++) {
      const x = px + ((p.x - px) * i) / n;
      const y = py + ((p.y - py) * i) / n;
      if (!w.blocksShot(x, y)) continue;
      if (p.bounces > 0) {
        if (w.blocksShot(x, py)) p.vx *= -1;
        else p.vy *= -1;
        p.x = px;
        p.y = py;
        p.bounces--;
        return false;
      }
      p.x = x;
      p.y = y;
      killProjectile(this, p);
      return true;
    }
    return false;
  }

  rayLength(x, y, ang, max) {
    return this.world.raycast(x, y, ang, Math.min(max, BEAM_MAX));
  }

  waveOut(h) {
    const w = this.world;
    return h.t > 3 || h.t * h.m.speed > WAVE_MAX || h.x < -20 || h.y < -20 || h.x > w.W + 20 || h.y > w.H + 20;
  }

  avoidEdges(f, mx, my) {
    const w = this.world;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (w.feetBlocked(f.x + dx * 14, f.y + dy * 10, FEET)) {
        mx -= dx * 0.9;
        my -= dy * 0.9;
      }
    }
    return [mx, my];
  }

  centerFor() {
    return [this.zone.x, this.zone.y];
  }

  ringColor(f) {
    return f.color || '#5ab4ff';
  }

  focus(obj) {
    this.cur = obj;
  }

  // ------------------------------------------------------- Ver y escuchar
  onCamera(x, y, margin = 0) {
    const c = this.cam;
    return x > c.x - margin && x < c.x + VW + margin && y > c.y - margin - 20 && y < c.y + VH + margin + 30;
  }

  near(src = this.cur) {
    if (!src || src.x === undefined) return true;
    return this.onCamera(src.x, src.y, 30);
  }

  // Los sonidos de lo que pasa lejos no se escuchan
  makeAudio(real) {
    const b = this;
    return new Proxy(real, {
      get(target, prop) {
        const v = target[prop];
        if (typeof v !== 'function') return v;
        if (['play', 'cry', 'cast', 'sustain', 'hitFx', 'ult'].includes(prop)) {
          return (...args) => (b.near() ? v.apply(target, args) : undefined);
        }
        return v.bind(target);
      },
    });
  }

  shake(v) {
    if (this.near()) super.shake(v * 0.7);
  }

  flashScreen(color, a) {
    if (this.near()) super.flashScreen(color, a * 0.5);
  }

  say(kind, vars, priority) {
    if (this.near()) super.say(kind, vars, priority);
  }

  // ¿Puede a ver a b? El pasto alto esconde a más de 3 baldosas
  canSee(a, o) {
    if (!o.alive) return false;
    if (o.revealT > 0 || o.lift > 4 || !this.world.inGrass(o.x, o.y)) return true;
    return Math.hypot(o.x - a.x, o.y - a.y) <= 3 * TILE;
  }

  inView(a, o) {
    return Math.abs(o.x - a.x) <= VIEW_X && Math.abs(o.y - a.y) <= VIEW_Y;
  }

  // El rival al que apunta cada uno: el más cercano que tiene en pantalla
  pickTarget(f) {
    if (!f.alive) return null;
    if (f.forced && f.forced.alive && this.canSee(f, f.forced) && this.inView(f, f.forced)) return f.forced;
    let best = null;
    let bestD = Infinity;
    for (const o of this.fighters) {
      if (o === f || !o.alive || !this.canSee(f, o) || !this.inView(f, o)) continue;
      let d = Math.hypot(o.x - f.x, (o.y - f.y) * 1.3);
      if (!this.world.clearLine(f.x, f.y - 4, o.x, o.y - 4)) d *= 1.6;
      if (o === f.target) d /= 1.25;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- Daño
  damage(att, def, base, o = {}) {
    if (!def.alive || this.state !== 'fight') return false;
    const k = this.splitK;
    this.splitK = 1;
    this.cur = def;
    // Dormir: 1 segundo como mucho, y después 4 segundos sin volver a dormirse
    if (o.sleep) {
      if (def.sleepImmune > 0) o = { ...o, sleep: false, stun: Math.min(o.stun || 0, 0.3) };
      else {
        o = { ...o, stun: Math.min(o.stun || 0, 1) };
        if (def.iframes <= 0) def.sleepImmune = 5;
      }
    }
    if (def.iframes <= 0 && att !== def) {
      def.lastHitBy = att;
      def.lastHitT = this.t;
    }
    const hit = super.damage(att, def, base * k, o);
    this.hitstop = 0;
    return hit;
  }

  faint(f) {
    f.alive = false;
    f.gmax = 0;
    f.action = null;
    f.faintT = 0;
    f.lift = 0;
    this.cur = f;
    this.shake(7);
    this.effects.burst(f.x, f.y - f.tall / 2, ['#ffffff', ...TYPE_COLORS[f.type]], { count: 40, speed: 120, size: 2.4, life: 0.8 });
    this.splash(f.x, f.y, 14);
    this.audio.play('ko');
    this.audio.cry(f.cryId, { rate: 0.72, vol: 0.45 });
    this.effects.float(`¡${f.name} quedó afuera!`, f.x, f.y - f.tall - 14, { color: '#ffffff', size: 6, life: 1.6, vy: -8 });
    const killer = f.lastHitBy && f.lastHitBy !== f && this.t - f.lastHitT < 8 ? f.lastHitBy : null;
    if (killer) {
      killer.kos++;
      this.sideStats[killer.side].ko++;
    }
    const left = this.alive();
    f.place = left.length + 1;
    this.feed.unshift({ killer, victim: f, t: this.t });
    this.feed.length = Math.min(this.feed.length, 4);
    this.teams[f.side].fainted.push(0);
    // Quien queda afuera deja una baya
    this.items.push({ kind: 'baya', x: f.x, y: f.y, t: 0 });
    this.projectiles = this.projectiles.filter((p) => p.owner !== f);
    this.hazards = this.hazards.filter((h) => h.owner !== f);
    if (f === this.player) {
      this.eliminated = { t: 0, place: f.place, by: killer };
      // Sigue mirando al que lo sacó (o al que va ganando)
      const watch = killer?.alive ? killer : this.leader();
      if (watch) this.viewSide = watch.side;
      this.say('faint', { a: speakName(f.name) }, 3);
    }
    if (this.viewed === f && f !== this.player) {
      const watch = killer?.alive ? killer : this.leader();
      if (watch) this.viewSide = watch.side;
    }
    if (left.length <= 1) this.finish(left[0] || f);
  }

  leader() {
    return this.alive().sort((a, b) => b.kos - a.kos || b.hp / b.maxHp - a.hp / a.maxHp)[0] || null;
  }

  finish(winner) {
    if (this.state !== 'fight') return;
    this.winner = winner;
    winner.place = 1;
    // Si se terminó por tiempo, los que quedan se ordenan por vida
    const rest = this.alive().filter((f) => f !== winner).sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp);
    rest.forEach((f, i) => (f.place = i + 2));
    this.state = 'ko';
    this.stateT = 0;
    this.timeScale = 0.35;
    this.viewSide = winner.side;
    this.cur = null;
    this.realAudio.play('cheer');
  }

  // Ataque definitivo: no se para el juego; cartel abajo si es el tuyo
  startCutin(f, m) {
    if (this.state !== 'fight') return;
    this.cur = f;
    if (f === this.player) {
      this.banner = { f, m, t: 0 };
      this.audio.ult();
    } else if (this.near(f)) {
      this.audio.ult();
    }
  }

  // ---------------------------------------------------------------- Premios
  spawnItems(n) {
    const spots = [...this.world.itemSpots];
    for (let i = 0; i < n && spots.length; i++) {
      const k = Math.floor(Math.random() * spots.length);
      const s = spots.splice(k, 1)[0];
      this.items.push({ kind: rollItem(Math.random), x: s.x, y: s.y, t: fxRandom() * 3 });
    }
  }

  trickleItem() {
    const cap = this.alive().length + 2;
    if (this.items.length >= cap) return;
    const z = this.zone.next;
    const s = this.world.randomSpot(z.x, z.y, Math.max(TILE, z.r - TILE), Math.random);
    this.items.push({ kind: rollItem(Math.random), x: s.x, y: s.y, t: 0, fresh: 1 });
  }

  pickup(f, it) {
    const def = ITEM_KINDS[it.kind];
    this.cur = f;
    if (it.kind === 'baya') {
      const heal = Math.round(f.maxHp * 0.3);
      f.hp = Math.min(f.maxHp, f.hp + heal);
      this.effects.float(`+${heal}`, f.x, f.y - f.tall - 6, { color: '#7dff8a', size: 7 });
    } else if (it.kind === 'caramelo') {
      f.buffDmg = 15;
    } else if (it.kind === 'deportivas') {
      f.buffSpeed = 12;
    }
    this.effects.float(def.say, f.x, f.y - f.tall - 14, { color: def.color, size: 5.5, life: 1.2 });
    this.effects.burst(it.x, it.y - 4, ['#ffffff', def.color, '#fff4c0'], { count: 18, speed: 60, size: 1.8, life: 0.5, up: 20 });
    this.audio.play(it.kind === 'baya' ? 'ready' : 'orb');
  }

  // ---------------------------------------------------- Bots: la "ficha"
  // A cada persona la puede atacar un solo bot por vez (dos si quedan 3 o menos).
  // El bot suelta la ficha a los 6 s y la persona respira 3 s.
  mayAttack(bot, o) {
    if (!o.human) {
      // Entre bots: como mucho dos contra el mismo
      const n = this.fighters.filter((f) => f !== bot && f.alive && !f.human && f.forced === o).length;
      return n < 2;
    }
    const tok = this.tokens.get(o) || { holders: [], rest: 0 };
    this.tokens.set(o, tok);
    const held = tok.holders.find((h) => h.bot === bot);
    if (held) return held.t < 6;
    const max = this.alive().length <= 3 ? 2 : 1;
    if (tok.rest > 0 || tok.holders.length >= max) return false;
    tok.holders.push({ bot, t: 0 });
    return true;
  }

  updateTokens(dt) {
    for (const [human, tok] of this.tokens) {
      tok.rest = Math.max(0, tok.rest - dt);
      for (const h of tok.holders) h.t += dt;
      const before = tok.holders.length;
      tok.holders = tok.holders.filter((h) => h.bot.alive && h.bot.forced === human && h.t < 6 && human.alive);
      if (tok.holders.length < before && tok.holders.length === 0) tok.rest = 3;
    }
  }

  // ------------------------------------------------------------------ Bucle
  update(dt) {
    this.t += dt;
    for (const c of this.callouts) if (c) c.t += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 1.4) this.banner = null;
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 18);
    if (this.flashFx) this.flashFx.a = Math.max(0, this.flashFx.a - dt * 3);
    if (this.eliminated) this.eliminated.t += dt;
    this.hitstop = 0;
    this.cutin = null;
    this.arena.update(dt);
    this.stateT += dt;
    for (const f of this.fighters) if (!f.alive) f.faintT += dt;

    if (this.state === 'intro') {
      const count = Math.ceil(3.0 - this.stateT);
      if (this.stateT > 0.6 && count < this.lastCount && count > 0) {
        this.lastCount = count;
        this.realAudio.play('beep');
      }
      if (!this.criedA && this.stateT > 0.4) {
        this.criedA = true;
        this.realAudio.cry(this.player.cryId);
      }
      if (this.stateT >= 3.0) {
        this.state = 'fight';
        this.stateT = 0;
        this.realAudio.play('go');
        // Burbuja de 3 segundos al aparecer
        for (const f of this.fighters) f.iframes = 3;
      }
    } else if (this.state === 'ko') {
      if (this.stateT > 0.8) this.timeScale = Math.min(1, this.timeScale + dt * 2);
      if (this.stateT > 2.6) {
        this.state = 'end';
        this.realAudio.play(this.winner === this.player ? 'win' : 'cheer');
      }
    }

    const sdt = dt * this.timeScale;
    this.stepDt = sdt;
    if (this.state === 'fight') {
      this.fightT += sdt;
      this.updateZone(sdt);
      this.updateTokens(sdt);
      for (const f of this.fighters) {
        f.target = this.pickTarget(f);
      }
      this.fighters.forEach((f, i) => {
        this.cur = f;
        this.controllers[i].update(sdt);
      });
      if (this.fightT >= FIGHT_LIMIT) {
        const best = this.alive().sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp)[0];
        if (best) this.finish(best);
      }
    } else {
      for (const f of this.fighters) Object.assign(f.intent, { mx: 0, my: 0, use: -1 });
    }
    for (const f of this.fighters) {
      this.cur = f;
      this.updateBuffs(f, sdt);
      f.update(sdt);
      // Atacar te saca del escondite un ratito
      const cd = f.cds[0] + f.cds[1] + f.cds[2] + f.cds[3] + f.cds[4];
      if (cd > f.lastCd + 0.05) f.revealT = 1.5;
      f.lastCd = cd;
    }
    this.pushApart();
    for (const h of this.hazards) if ((h.kind === 'ring' || h.kind === 'quake') && h.maxR > RING_MAX) h.maxR = RING_MAX;
    updateProjectiles(this, sdt);
    updateHazards(this, sdt);
    this.cur = null;
    this.updateItems(sdt);
    this.effects.update(sdt);
    this.updateCamera(dt);
  }

  updateBuffs(f, dt) {
    f.revealT = Math.max(0, f.revealT - dt);
    f.sleepImmune = Math.max(0, f.sleepImmune - dt);
    f.buffDmg = Math.max(0, f.buffDmg - dt);
    f.buffSpeed = Math.max(0, f.buffSpeed - dt);
    f.speed = f.baseSpeed * (f.buffSpeed > 0 ? 1.3 : 1);
    if (f.alive && f.buffSpeed > 0 && f.moving && fxRandom() < 0.3) this.effects.trail(f.x, f.y - 2, ['#ffffff', '#ffe66b'], { size: 1.2, vy: -4, life: 0.3 });
    if (f.alive && f.buffDmg > 0 && fxRandom() < 0.25) this.effects.trail(f.x + (fxRandom() - 0.5) * f.wide, f.y - fxRandom() * f.tall, ['#ff8a5a', '#ffd23f'], { size: 1.4, vy: -18, life: 0.4 });
  }

  // Que no se encimen (todos contra todos)
  pushApart() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (!a.alive || a.lift >= 20) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const c = fs[j];
        if (!c.alive || c.lift >= 20) continue;
        const dx = c.x - a.x;
        const dy = (c.y - a.y) * 1.6;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = (a.r + c.r) * 0.75;
        if (d >= min) continue;
        const push = (min - d) / 2;
        for (const [f, s] of [[a, -1], [c, 1]]) {
          const nx = f.x + s * (dx / d) * push;
          const ny = f.y + s * ((dy / d) * push) / 1.6;
          const r = this.world.slide(f.x, f.y, nx, ny, FEET);
          f.x = r.x;
          f.y = r.y;
        }
      }
    }
  }

  updateZone(dt) {
    const z = this.zone;
    const ev = z.update(dt);
    if (ev === 'shrink') {
      this.toast('¡LA NIEBLA SE ACERCA!', '#d58cff');
      this.realAudio.play('charge');
    }
    // Aparecen premios de a poco adentro del próximo círculo
    this.itemT -= dt;
    if (this.itemT <= 0) {
      this.itemT = 12;
      this.trickleItem();
    }
    this.fogT -= dt;
    if (this.fogT > 0) return;
    this.fogT = 1;
    // La niebla: se pierde vida afuera del círculo (los más débiles primero)
    const out = this.alive().filter((f) => z.outside(f.x, f.y)).sort((a, b) => a.hp - b.hp);
    for (const f of out) {
      if (this.state !== 'fight' || !f.alive) break;
      const floor = z.lethal ? 0 : f.maxHp * FOG_FLOOR;
      if (f.hp <= floor) continue;
      const dmg = Math.max(1, Math.round(f.maxHp * z.dps));
      f.hp = Math.max(floor, f.hp - dmg);
      f.ghostDelay = 0.45;
      f.flash = 0.06;
      this.cur = f;
      this.effects.float(String(dmg), f.x, f.y - f.tall - 4, { color: '#e2a8ff', size: 5.5, life: 0.7 });
      this.effects.burst(f.x, f.y - f.tall / 2, ['#c27bff', '#7a3fb8', '#e2a8ff'], { count: 8, speed: 30, size: 1.6, life: 0.5 });
      if (f === this.player) this.realAudio.play('hit');
      if (f.hp <= 0) this.faint(f);
    }
    this.cur = null;
  }

  updateItems(dt) {
    for (const it of this.items) {
      it.t += dt;
      if (it.fresh) it.fresh = Math.max(0, it.fresh - dt);
    }
    if (this.state !== 'fight') return;
    for (const f of this.fighters) {
      if (!f.alive || f.lift > 4) continue;
      const i = this.items.findIndex((it) => Math.hypot(it.x - f.x, (it.y - f.y) * 1.4) < 11);
      if (i < 0) continue;
      const [it] = this.items.splice(i, 1);
      this.pickup(f, it);
    }
  }

  toast(str, color = '#ffe66b') {
    this.toastMsg = { text: str, color, t: 0 };
  }

  // ---------------------------------------------------------------- Cámara
  // La cámara puede asomarse un poco fuera del mapa (arriba está el HUD)
  camBounds() {
    return [-6, this.world.W - VW + 6, -26, this.world.H - VH + 6];
  }

  snapCamera() {
    const f = this.viewed;
    const [x0, x1, y0, y1] = this.camBounds();
    this.cam.x = clamp(f.x - VW / 2, x0, x1);
    this.cam.y = clamp(f.y - VH / 2 - 6, y0, y1);
  }

  updateCamera(dt) {
    const f = this.viewed;
    if (!f) return;
    const k = 1 - Math.exp(-dt * 6);
    const lx = f.alive ? clamp(f.vx * 0.25, -30, 30) : 0;
    const ly = f.alive ? clamp(f.vy * 0.2, -16, 16) : 0;
    const [x0, x1, y0, y1] = this.camBounds();
    const tx = clamp(f.x + lx - VW / 2, x0, x1);
    const ty = clamp(f.y + ly - VH / 2 - 6, y0, y1);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    if (this.toastMsg) this.toastMsg.t += dt;
  }

  // ---------------------------------------------------------------- Dibujo
  render(ctx) {
    const t = this.t;
    const cx = Math.round(this.cam.x);
    const cy = Math.round(this.cam.y);
    const sx = Math.round((fxRandom() - 0.5) * this.shakeAmt);
    const sy = Math.round((fxRandom() - 0.5) * this.shakeAmt);
    ctx.save();
    ctx.fillStyle = '#2f5f30';
    ctx.fillRect(0, 0, VW, VH);
    ctx.translate(-cx + sx, -cy + sy);
    this.world.draw(ctx, t, cx, cy, VW, VH);
    this.arena.drawIce(ctx);
    this.effects.renderDecals(ctx);
    renderGroundHazards(ctx, this, t);
    this.renderItems(ctx, t);
    this.effects.renderRings(ctx);
    this.renderGhosts(ctx);
    const viewer = this.player;
    const shown = this.fighters.filter((f) => this.onCamera(f.x, f.y, 40) && (f === viewer || !viewer.alive || this.canSee(viewer, f) || !f.alive));
    shown.sort((p, q) => p.y - q.y);
    for (const f of shown) {
      if (this.state === 'fight' && this.stateT < 3 && f.alive && f.iframes > 0) this.renderBubble(ctx, f, t);
      f.render(ctx, t);
      if (f.alive) this.world.drawGrassOver(ctx, f);
    }
    // Proyectiles y peligros: solo los que entran en la cámara
    const allP = this.projectiles;
    const allH = this.hazards;
    this.projectiles = allP.filter((p) => this.onCamera(p.x, p.y, 30));
    this.hazards = allH.filter((h) => h.kind === 'wave' || h.kind === 'ring' || h.kind === 'quake' || this.onCamera(h.x, h.y, 60));
    renderProjectiles(ctx, this, t);
    renderHazards(ctx, this, t);
    this.projectiles = allP;
    this.hazards = allH;
    this.effects.renderParticles(ctx);
    this.effects.renderImpacts(ctx);
    this.renderFog(ctx, t, cx, cy);
    for (const f of shown) if (f.alive) this.renderTag(ctx, f, t);
    this.effects.renderTexts(ctx);
    ctx.restore();

    if (this.flashFx && this.flashFx.a > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashFx.a;
      ctx.fillStyle = this.flashFx.color;
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
    renderRoyaleHUD(ctx, this, t);
    this.renderBanner(ctx);
    this.renderToast(ctx);
    this.renderOverlay(ctx);
  }

  // Burbuja de protección al aparecer
  renderBubble(ctx, f, t) {
    const a = Math.min(1, f.iframes) * (0.5 + Math.sin(t * 10) * 0.15);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#bff7ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y - f.tall * 0.45, f.wide * 0.6 + 4, f.tall * 0.6 + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.25;
    ctx.fillStyle = '#bff7ff';
    ctx.fill();
    ctx.restore();
  }

  renderItems(ctx, t) {
    for (const it of this.items) {
      if (!this.onCamera(it.x, it.y, 20)) continue;
      drawItem(ctx, it, t);
    }
  }

  // Nombre y vida sobre cada Pokémon (y el último ataque que tiró)
  renderTag(ctx, f, t) {
    const top = f.y - f.lift - f.tall - 4;
    const mine = f === this.player;
    const w = 22;
    const x = Math.round(f.x - w / 2);
    const y = Math.round(top - 2);
    if (!mine) {
      ctx.fillStyle = '#1b1224';
      ctx.fillRect(x - 0.5, y - 0.5, w + 1, 3);
      ctx.fillStyle = '#3a2f52';
      ctx.fillRect(x, y, w, 2);
      const k = Math.max(0, f.hp / f.maxHp);
      ctx.fillStyle = k > 0.5 ? '#4fd65a' : k > 0.25 ? '#f2c318' : '#ff4b4b';
      ctx.fillRect(x, y, w * k, 2);
      text(ctx, f.label, f.x, y - 1.6, { size: 3.6, weight: 900, align: 'center', color: f.color, stroke: '#1b1224', strokeW: 1.2 });
      // Aro en el que apuntás
      if (this.player?.target === f && this.player.alive) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.6 + Math.sin(t * 8) * 0.3;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 1.5]);
        ctx.beginPath();
        ctx.ellipse(f.x, f.y + 1, f.r * 1.6, f.r * 0.65, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      text(ctx, 'TÚ', f.x, y + 1, { size: 4.2, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.4 });
      if (this.world.inGrass(f.x, f.y) && f.revealT <= 0) text(ctx, 'escondido', f.x, f.y + 8, { size: 3.4, weight: 800, align: 'center', color: '#c8ffd0', stroke: '#1b1224', strokeW: 1 });
    }
    const c = this.callouts[f.side];
    if (c && c.t < 1.1) {
      const k = backOut(Math.min(1, c.t / 0.15));
      text(ctx, c.text.toUpperCase(), f.x, y - (mine ? 5 : 7), { size: (c.super ? 5 : 4) * k, weight: 900, align: 'center', color: c.super ? '#ffe66b' : '#ffffff', stroke: '#1b1224', strokeW: 1.4, alpha: c.t > 0.85 ? (1.1 - c.t) / 0.25 : 1 });
    }
  }

  // La niebla morada: todo menos el círculo seguro
  renderFog(ctx, t, cx, cy) {
    const z = this.zone;
    const x0 = cx - 4;
    const y0 = cy - 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, VW + 8, VH + 8);
    ctx.arc(z.x, z.y, Math.max(0.5, z.r), 0, Math.PI * 2, true);
    ctx.fillStyle = `rgba(96,32,150,${0.42 + Math.sin(t * 2) * 0.04})`;
    ctx.fill('evenodd');
    // Borde rosado que late
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,122,217,${0.7 + Math.sin(t * 6) * 0.2})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, Math.max(0.5, z.r), 0, Math.PI * 2);
    ctx.stroke();
    // El próximo círculo, punteado
    if (!z.done && z.next.r > 0) {
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(z.next.x, z.next.y, z.next.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Remolinos de niebla cerca del borde (solo los que se ven)
    ctx.fillStyle = 'rgba(200,140,255,0.18)';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + t * 0.15;
      const rr = z.r + 6 + ((i * 7) % 5) * 3 + Math.sin(t * 1.5 + i) * 3;
      const px = z.x + Math.cos(a) * rr;
      const py = z.y + Math.sin(a) * rr;
      if (!this.onCamera(px, py, 10)) continue;
      ctx.beginPath();
      ctx.arc(px, py, 5 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderBanner(ctx) {
    const c = this.banner;
    if (!c) return;
    const k = Math.min(1, c.t / 0.15);
    const out = c.t > 1.1 ? Math.max(0, (1.4 - c.t) / 0.3) : 1;
    const colors = TYPE_COLORS[c.m.fx] || TYPE_COLORS[c.f.type];
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate((1 - k) * -120, 0);
    const y = VH - 44;
    ctx.fillStyle = colors[3];
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(150, y - 4);
    ctx.lineTo(142, y + 16);
    ctx.lineTo(0, y + 18);
    ctx.closePath();
    ctx.fill();
    text(ctx, '¡ATAQUE DEFINITIVO!', 8, y + 5.5, { size: 4.2, weight: 900, color: '#ffe66b', stroke: '#1b1224', strokeW: 1.2 });
    text(ctx, c.m.name.toUpperCase(), 8, y + 14, { size: 7.5, weight: 900, color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
    ctx.restore();
  }

  renderToast(ctx) {
    const m = this.toastMsg;
    if (!m || m.t > 2.4) return;
    const alpha = m.t > 2 ? (2.4 - m.t) / 0.4 : Math.min(1, m.t * 6);
    text(ctx, m.text, VW / 2, 46, { size: 7, weight: 900, align: 'center', color: m.color, stroke: '#1b1224', strokeW: 2.2, alpha });
  }

  renderOverlay(ctx) {
    const cy = VH / 2;
    if (this.state === 'intro') {
      const st = this.stateT;
      const k = backOut(Math.min(1, st / 0.45));
      const out = st > 1.6 ? Math.min(1, (st - 1.6) / 0.3) : 0;
      ctx.save();
      ctx.globalAlpha = 1 - out;
      ctx.fillStyle = 'rgba(10,6,20,0.72)';
      ctx.fillRect(0, cy - 24, VW, 46);
      ctx.fillStyle = '#d58cff';
      ctx.fillRect(0, cy - 24, VW, 1.2);
      ctx.fillRect(0, cy + 21, VW, 1.2);
      text(ctx, 'BATALLA CAMPAL', VW / 2 + (1 - k) * -160, cy - 5, { size: 15, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
      text(ctx, '¡El último Pokémon en pie gana!', VW / 2 + (1 - k) * 160, cy + 12, { size: 7, weight: 800, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
      ctx.restore();
      if (st > 1.2) {
        const n = Math.ceil(3.0 - st);
        const local = 1 - ((3.0 - st) % 0.6) / 0.6;
        if (n > 0) text(ctx, String(n), VW / 2, cy + 14, { size: 40 * backOut(local * 2), weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 4, alpha: 1 - local * 0.4 });
      }
    }
    if (this.state === 'fight' && this.stateT < 0.7 && this.fightT < 1) {
      const k = this.stateT / 0.7;
      text(ctx, '¡YA!', VW / 2, cy + 12, { size: 36 * backOut(k * 3), weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 4, alpha: 1 - Math.max(0, k - 0.6) / 0.4 });
    }
    // Afuera del círculo: aviso y flecha
    const p = this.player;
    if (this.state === 'fight' && p.alive && this.zone.outside(p.x, p.y)) {
      const pulse = 0.75 + Math.sin(this.t * 8) * 0.25;
      text(ctx, '¡SAL DE LA NIEBLA!', VW / 2, VH - 38, { size: 7.5, weight: 900, align: 'center', color: '#ffb3f0', stroke: '#1b1224', strokeW: 2.2, alpha: pulse });
    }
    if (this.state === 'ko') {
      const k = Math.min(1, this.stateT / 0.4);
      const won = this.winner === this.player;
      text(ctx, won ? '¡GANASTE!' : `¡GANÓ ${this.winner.name}!`, VW / 2, cy + 10, { size: (won ? 28 : 18) * backOut(k), weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 4 });
    }
  }
}
