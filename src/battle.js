import { VW, VH, FIELD } from './config.js';
import { typeMultiplier, CREATURES, DIFFICULTY, GMAX_FULL, GMAX_TIME, GMAX_SIZE } from './data.js';
import { Arena, vignette } from './arena.js';
import { Effects, TYPE_COLORS } from './effects.js';
import { Fighter } from './fighter.js';
import { LocalController, AIController, applyButtons } from './controllers.js';
import { updateProjectiles, updateHazards, renderProjectiles, renderHazards, renderGroundHazards, glow } from './moves.js';
import { renderHUD } from './hud.js';
import { text, textWidth, roundRect, backOut, drawCreature } from './ui.js';
import { speakName } from './announcer.js';
import { hasGmaxSprite } from './sprites.js';

// Combate por equipos: cuando un Pokémon se debilita entra el siguiente
export class Battle {
  constructor(game, { teamA, teamB, bossLast = false, difficulty = 'normal', arena = 'piscina', round = null, seed = 1, gmax = true }) {
    this.game = game;
    this.audio = game.audio;
    this.arena = new Arena(arena, seed);
    this.effects = new Effects();
    this.difficulty = difficulty;
    this.round = round;
    this.teams = [
      { keys: teamA, idx: 0, fainted: [] },
      { keys: teamB, idx: 0, fainted: [] },
    ];
    this.bossLast = bossLast;
    this.fighters = [this.makeFighter(0), this.makeFighter(1)];
    // Lado de la pantalla que juega este celular (0 = izquierda)
    this.localSide = 0;
    this.controllers = [new LocalController(this, 0), new AIController(this, 1, difficulty)];
    this.projectiles = [];
    this.hazards = [];
    this.state = 'intro';
    this.stateT = 0;
    this.hitstop = 0;
    this.shakeAmt = 0;
    this.timeScale = 1;
    this.darken = 0;
    this.winner = null;
    this.callouts = [null, null];
    this.t = 0;
    this.lastCount = 4;
    this.switching = null;
    this.sideStats = [0, 1].map(() => ({ hits: 0, maxCombo: 0, dealt: 0, ko: 0 }));
    this.caption = { text: CREATURES[teamA[0]].cry, t: 0 };
    // Gigamax: una vez por pelea por lado, cuando se llena la carga
    this.gmaxOn = gmax;
    this.gx = [{ m: 0, used: false }, { m: 0, used: false }];
    this.gmaxFx = null;
  }

  chargeGmax(side, v) {
    const g = this.gx[side];
    if (!this.gmaxOn || g.used) return;
    g.m = Math.min(GMAX_FULL, g.m + v);
  }

  gmaxReady(side) {
    const g = this.gx[side];
    return this.gmaxOn && !g.used && g.m >= GMAX_FULL;
  }

  // Botón GIGAMAX (jugador, IA o el otro celular)
  requestGmax(side) {
    if (this.tryGmax(side)) return true;
    // Si justo no se puede (volando, otro ataque definitivo), se reintenta un instante
    if (this.gmaxReady(side)) this.gx[side].q = 1.2;
    return false;
  }

  tryGmax(side) {
    if (!this.gmaxReady(side) || this.state !== 'fight' || this.cutin || this.gmaxFx) return false;
    const f = this.fighters[side];
    if (!f.alive || f.gmax > 0 || f.lift > 5) return false;
    this.startGmax(f);
    return true;
  }

  startGmax(f) {
    const g = this.gx[f.side];
    g.used = true;
    g.m = 0;
    f.gmax = GMAX_TIME;
    f.gform = !f.boss && hasGmaxSprite(f.key);
    f.cds[4] = 0;
    f.action = null;
    f.dashT = 0;
    f.stun = 0;
    f.sleep = 0;
    f.frozenT = 0;
    f.vx = f.vy = f.kx = f.ky = 0;
    this.gmaxFx = { f, t: 0, dur: 1.8, boom: false };
    this.flashScreen('#ff2d55', 0.4);
    this.audio.play('charge');
    this.audio.cry(f.cryId, { rate: 0.7, vol: 0.55 });
    this.callout(f, f.gform ? '¡GIGAMAX!' : '¡DINAMAX!', true);
    this.say('gmax', { a: speakName(f.def.name) }, 3);
  }

  // Escena de la transformación: la pelea se detiene y el Pokémon crece
  updateGmaxFx(dt) {
    const fx = this.gmaxFx;
    const f = fx.f;
    fx.t += dt;
    const k = Math.max(0, Math.min(1, (fx.t - 0.35) / 0.8));
    f.gs = 1 + (GMAX_SIZE - 1) * k * k * (3 - 2 * k);
    f.applyGiant();
    // Si está muy arriba, baja mientras crece (para que la cabeza entre en la pantalla)
    const minY = Math.min(FIELD.y1 - 10, f.tall + 14);
    if (f.y < minY) f.y += (minY - f.y) * Math.min(1, dt * 8);
    this.zoom = 0.09 * Math.sin(Math.PI * Math.min(1, fx.t / fx.dur));
    if (Math.random() < 0.8) {
      this.effects.trail(f.x + (Math.random() - 0.5) * (f.wide + 10), f.y - Math.random() * 6, ['#ffffff', '#ffb3c6', '#ff4d6d'], { size: 2, vy: -70, life: 0.7 });
    }
    if (!fx.boom && fx.t >= 1.1) {
      fx.boom = true;
      this.shake(9);
      this.flashScreen('#ffffff', 0.85);
      this.audio.play('thunder');
      this.audio.play('explode');
      this.effects.burst(f.x, f.y - f.tall / 2, ['#ffffff', '#ffb3c6', '#ff4d6d', '#d6204f'], { count: 60, speed: 150, size: 2.6, life: 0.8 });
      this.effects.ring(f.x, f.y, '#ff6b8a', { r: 4, maxR: 70, life: 0.7, width: 2 });
      this.splash(f.x, f.y, 22);
    }
    this.effects.update(dt);
    if (fx.t >= fx.dur) {
      this.gmaxFx = null;
      f.gs = GMAX_SIZE;
      f.applyGiant();
    }
  }

  // Presentación del ataque definitivo: pausa breve con el Pokémon en grande
  startCutin(f, m) {
    if (this.state !== 'fight') return;
    this.cutin = { f, m, t: 0, dur: 0.85, gname: f.gmax > 0 ? f.moveLabel(4) : null, gform: f.gform && f.gmax > 0 };
    this.flashFx = { color: '#ffffff', a: 0.5 };
    this.zoom = 0.05;
    this.audio.ult();
  }

  flashScreen(color, a) {
    this.flashFx = { color, a: Math.max(a, this.flashFx?.a || 0) };
  }

  say(kind, vars, priority) {
    this.game.announcer?.say(kind, vars, priority);
  }

  makeFighter(side) {
    const team = this.teams[side];
    const key = team.keys[team.idx];
    const boss = side === 1 && this.bossLast && team.idx === team.keys.length - 1;
    return new Fighter(this, key, side, { boss });
  }

  // "player" es siempre el Pokémon de este celular; "enemy", el del otro lado
  get player() {
    return this.fighters[this.localSide];
  }

  get enemy() {
    return this.fighters[1 - this.localSide];
  }

  get stats() {
    return this.sideStats[this.localSide];
  }

  setController(side, controller) {
    this.controllers[side] = controller;
  }

  shake(v) {
    this.shakeAmt = Math.min(9, this.shakeAmt + v);
  }

  crowdExcite() {}

  callout(f, str, big) {
    this.callouts[f.side] = { text: str, t: 0, super: big };
  }

  // Salpicadura en el agua (o polvo sobre una plataforma)
  splash(x, y, r) {
    if (this.arena.onPlatform(x, y)) {
      this.effects.dust(x, y, Math.round(r * 0.8));
      return;
    }
    const n = Math.round(4 + r * 0.8);
    this.effects.burst(x, y, ['#ffffff', '#e6faff', '#8fd3ff'], { count: n, speed: 30 + r * 3, size: 1.8, life: 0.55, up: 30 + r * 2, grav: 140 });
    this.effects.ring(x, y, 'rgba(230,248,255,0.85)', { r: 2, maxR: r * 1.6, life: 0.6, width: 1 });
  }

  // Aplica daño; devuelve false si el golpe fue esquivado
  damage(att, def, base, o = {}) {
    if (!def.alive || this.state !== 'fight') return false;
    if (def.iframes > 0) {
      if (def.dodgeTextT <= 0 && !o.tick) {
        def.dodgeTextT = 0.6;
        this.say('dodge', {}, 0.5);
        this.effects.float('¡ESQUIVA!', def.x, def.y - def.tall - 6, { color: '#bff7ff', size: 5 });
      }
      return false;
    }
    const moveType = o.m?.type || att.type;
    const mult = typeMultiplier(moveType, def.type);
    const stab = moveType === att.type ? 1.15 : 1;
    const crit = !o.noCrit && Math.random() < 0.07;
    const roll = o.tick ? 1 : 0.92 + Math.random() * 0.16;
    // La IA pega más suave en las dificultades bajas
    const aiMult = this.controllers[att.side]?.isAI ? DIFFICULTY[this.difficulty].dmgMult : 1;
    // Gigante: pega más fuerte, recibe menos, y su ataque Gigamax es devastador
    const giant = (att.gmax > 0 ? 1.3 : 1) * (def.gmax > 0 ? 0.6 : 1) * (att.gmax > 0 && o.m === att.moves[4] ? 1.5 : 1);
    const dmg = Math.max(1, Math.round(((base * att.pow) / def.defn) * mult * stab * aiMult * (crit ? 1.5 : 1) * roll * giant));
    def.hp = Math.max(0, def.hp - dmg);
    def.ghostDelay = 0.45;
    if (!o.tick) {
      def.flash = 0.09;
      def.squash = 0.8;
    }
    if (o.kb) {
      const k = o.kb * (def.boss ? 0.45 : 1) * (def.gmax > 0 ? 0.35 : 1);
      def.kx += (o.dirX || 0) * k;
      def.ky += (o.dirY || 0) * k;
    }
    if (o.stun) {
      def.stun = Math.max(def.stun, o.stun * (def.gmax > 0 ? 0.4 : 1));
      if (def.action && def.action.kind !== 'fly') def.action = null;
      def.dashT = 0;
    }
    if (o.sleep) {
      def.sleep = Math.max(def.sleep, o.stun || 0);
      this.effects.float('¡SE DURMIÓ!', def.x, def.y - def.tall - 12, { color: '#bfe9ff', size: 5, life: 1.1 });
      this.say('sleep', { b: speakName(def.name) }, 1.5);
    } else if (def.sleep > 0 && !o.tick) {
      def.sleep = 0;
      def.stun = Math.min(def.stun, 0.2);
    }
    if (o.root) def.root = Math.max(def.root, o.root);
    if (o.slow) def.slow = Math.max(def.slow, o.slow);
    // Un golpe fuerte interrumpe los chorros y rayos
    if (def.action && (def.action.kind === 'beam' || def.action.kind === 'stream') && !o.tick && dmg >= 12) def.action = null;

    this.chargeGmax(att.side, dmg * 0.35);
    this.chargeGmax(def.side, dmg * 0.25);
    att.stats.dealt += dmg;
    if (!o.tick || att.comboT > 0) {
      att.combo = att.comboT > 0 ? att.combo + 1 : 1;
      att.comboT = 1.2;
      att.stats.hits++;
      att.stats.maxCombo = Math.max(att.stats.maxCombo, att.combo);
      if (att.combo === 5 && !o.tick) this.say('combo', { n: 5 }, 1);
      if (att.combo >= 3 && !o.tick) {
        this.effects.float(`${att.combo} GOLPES`, att.x, att.y - att.tall - 10, { color: '#ffe66b', size: 5, life: 0.7 });
      }
    }
    const st = this.sideStats[att.side];
    st.dealt += dmg;
    if (!o.tick) st.hits++;
    st.maxCombo = Math.max(st.maxCombo, att.combo);

    const hy = def.y - def.tall - 4;
    this.effects.float(String(dmg), def.x + (Math.random() - 0.5) * 8, hy, {
      color: crit ? '#ffe45c' : '#ffffff',
      size: crit ? 8 : o.tick ? 4.5 : 6.5,
      life: 0.7,
    });
    if (def.effTextT <= 0 && !o.tick) {
      if (mult > 1) {
        def.effTextT = 0.8;
        this.effects.float('¡SÚPER EFICAZ!', def.x, hy - 8, { color: '#ffb43b', size: 5.5, life: 1 });
        this.say('super', {}, 1);
      } else if (mult < 1) {
        def.effTextT = 0.8;
        this.effects.float('poco eficaz…', def.x, hy - 8, { color: '#c9c3d6', size: 4.5, life: 0.9, weight: 700 });
      }
    }
    if (crit) {
      this.effects.float('¡CRÍTICO!', def.x, hy - 15, { color: '#ff5d73', size: 5.5, life: 0.9 });
      this.say('crit', {}, 1);
    }
    if (def.hp > 0 && def.hp / def.maxHp < 0.25 && !def.lowSaid) {
      def.lowSaid = true;
      this.say('low', { a: speakName(def.name) }, 1.2);
    }

    const hs = o.hitstop ?? (o.tick ? 0 : 0.035 + dmg * 0.004);
    this.hitstop = Math.max(this.hitstop, hs);
    if (!o.tick) this.shake(Math.min(5, dmg * 0.18));
    if (dmg >= 14) this.audio.play('bighit');
    else if (!o.tick) this.audio.play('hit');
    const fx = o.m?.fx || att.type;
    const hitColors = TYPE_COLORS[fx] || TYPE_COLORS[att.type];
    if (!o.tick) {
      this.audio.hitFx(fx, dmg >= 14);
      this.effects.impact(def.x + (Math.random() - 0.5) * 4, def.y - def.tall * 0.5, 7 + Math.min(14, dmg * 0.6), hitColors[2]);
    }
    if (dmg >= 18 && !o.tick) {
      this.flashScreen(hitColors[1], 0.3);
      this.zoom = Math.max(this.zoom || 0, 0.025);
    }
    // Estados que se ven: quemado, electrizado, congelado
    if (fx === 'fuego') def.burnT = Math.max(def.burnT, 1.2);
    if (fx === 'electrico') def.shockT = Math.max(def.shockT, 0.7);
    if (fx === 'hielo') def.frozenT = Math.max(def.frozenT, 1.0);
    if (!o.tick) {
      this.effects.burst(def.x, def.y - def.tall / 2, ['#ffffff', ...(TYPE_COLORS[o.m?.fx] || TYPE_COLORS[att.type]).slice(0, 3)], { count: 6 + Math.round(dmg / 2), speed: 60, size: 1.8 });
    }
    if (def.hp <= 0) this.faint(def);
    return true;
  }

  faint(f) {
    f.alive = false;
    f.gmax = 0;
    f.action = null;
    f.faintT = 0;
    f.lift = 0;
    this.timeScale = 0.35;
    this.hitstop = 0.2;
    this.shake(7);
    this.effects.burst(f.x, f.y - f.tall / 2, ['#ffffff', ...TYPE_COLORS[f.type]], { count: 40, speed: 120, size: 2.4, life: 0.8 });
    this.splash(f.x, f.y, 14);
    this.audio.play('ko');
    this.audio.cry(f.cryId, { rate: 0.72, vol: 0.45 });
    this.say('faint', { a: speakName(f.name) }, 3);
    this.effects.float(`¡${f.name} se debilitó!`, f.x, f.y - f.tall - 14, { color: '#ffffff', size: 6, life: 1.6, vy: -8 });
    const team = this.teams[f.side];
    team.fainted.push(team.idx);
    this.sideStats[1 - f.side].ko++;
    const left = team.keys.length - team.fainted.length;
    if (left > 0) {
      this.state = 'switch';
      this.stateT = 0;
      this.switching = { side: f.side, thrown: false };
    } else {
      this.state = 'ko';
      this.stateT = 0;
      this.winner = this.fighters[1 - f.side];
      this.audio.play('cheer');
    }
  }

  // Lanza la Poké Ball con el siguiente Pokémon
  sendNext(side) {
    const team = this.teams[side];
    team.idx++;
    const old = this.fighters[side];
    const f = this.makeFighter(side);
    const sp = this.arena.spawns[side];
    f.x = sp.x;
    f.y = sp.y;
    f.enterT = 0;
    this.fighters[side] = f;
    this.projectiles = this.projectiles.filter((p) => p.owner !== old);
    this.hazards = this.hazards.filter((h) => h.owner !== old);
    this.effects.burst(f.x, f.y - f.tall / 2, ['#ffffff', '#ff5d5d', '#fff4c0'], { count: 30, speed: 90, size: 2, life: 0.6 });
    this.effects.ring(f.x, f.y - f.tall / 2, '#ffffff', { maxR: 30, life: 0.4, width: 2 });
    this.splash(f.x, f.y, 12);
    this.audio.play('ball');
    this.audio.cry(f.cryId);
    if (side === this.localSide) this.caption = { text: `¡Adelante, ${f.def.name[0]}${f.def.name.slice(1).toLowerCase()}! ${f.def.cry}`, t: 0 };
    else this.caption = { text: f.boss ? `¡Cuidado! ¡${f.name}!` : f.def.cry, t: 0 };
    const who = { a: speakName(f.name) };
    if (side === this.localSide) this.say('next', who, 2);
    else if (f.boss) this.say('boss', who, 3.5);
    else this.say('nextEnemy', who, 2);
  }

  // Teclado o pantalla táctil de este celular -> Pokémon del lado `side`
  localIntent(side) {
    const inp = this.game.input;
    const [mx, my] = inp.moveVector();
    applyButtons(this.fighters[side], mx, my, (i) => inp.wasPressed(`m${i}`), (i) => inp.isDown(`m${i}`));
    if (inp.wasPressed('gx')) this.requestGmax(side);
  }

  update(dt) {
    this.t += dt;
    for (const c of this.callouts) if (c) c.t += dt;
    if (this.caption) this.caption.t += dt;
    if (this.relator) this.relator.t += dt;
    this.darken = Math.max(0, this.darken - dt * 1.6);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 18);
    if (this.flashFx) this.flashFx.a = Math.max(0, this.flashFx.a - dt * 3);
    this.zoom = Math.max(0, (this.zoom || 0) - dt * 0.12);
    if (this.cutin) {
      this.cutin.t += dt;
      if (this.cutin.t >= this.cutin.dur) this.cutin = null;
      return;
    }
    if (this.gmaxFx) return this.updateGmaxFx(dt);
    this.arena.update(dt);

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    this.stateT += dt;
    for (const f of this.fighters) if (!f.alive) f.faintT += dt;

    if (this.state === 'intro') {
      if (!this.announced && this.stateT > 0.1) {
        this.announced = true;
        this.say('start', { a: speakName(this.player.name), b: speakName(this.enemy.name) }, 2);
      }
      // Cada Pokémon grita al aparecer
      if (!this.criedA && this.stateT > 0.25) {
        this.criedA = true;
        this.audio.cry(this.player.cryId);
      }
      if (!this.criedB && this.stateT > 0.95) {
        this.criedB = true;
        this.audio.cry(this.enemy.cryId);
      }
      const count = Math.ceil(3.0 - this.stateT);
      if (this.stateT > 1.2 && count < this.lastCount && count > 0) {
        this.lastCount = count;
        this.audio.play('beep');
      }
      if (this.stateT >= 3.0) {
        this.state = 'fight';
        this.stateT = 0;
        this.audio.play('go');
      }
    } else if (this.state === 'switch') {
      if (this.stateT > 0.8) this.timeScale = Math.min(1, this.timeScale + dt * 2);
      if (!this.switching.thrown && this.stateT >= 1.4) {
        this.switching.thrown = true;
        this.sendNext(this.switching.side);
      }
      if (this.stateT >= 2.0) {
        this.state = 'fight';
        this.stateT = 0;
        this.timeScale = 1;
      }
    } else if (this.state === 'ko') {
      if (this.stateT > 0.8) this.timeScale = Math.min(1, this.timeScale + dt * 2);
      if (this.stateT > 2.4) {
        this.state = 'end';
        this.audio.play(this.winner === this.player ? 'win' : 'lose');
        this.say(this.winner === this.player ? 'win' : 'lose', {}, 4);
      }
    }

    const sdt = dt * this.timeScale;
    if (this.state === 'fight') {
      for (const c of this.controllers) c.update(sdt);
      this.chargeGmax(0, sdt);
      this.chargeGmax(1, sdt);
      for (const side of [0, 1]) {
        const g = this.gx[side];
        if (!g.q) continue;
        g.q = Math.max(0, g.q - sdt);
        if (this.tryGmax(side)) g.q = 0;
      }
    } else {
      for (const f of this.fighters) Object.assign(f.intent, { mx: 0, my: 0, use: -1 });
    }
    for (const f of this.fighters) f.update(sdt);

    // Que no se superpongan
    const [a, c] = this.fighters;
    if (a.alive && c.alive && a.lift < 20 && c.lift < 20) {
      const dx = c.x - a.x;
      const dy = (c.y - a.y) * 1.6;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = (a.r + c.r) * 0.75;
      if (d < min) {
        const push = (min - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= ((dy / d) * push) / 1.6;
        c.x += (dx / d) * push;
        c.y += ((dy / d) * push) / 1.6;
      }
    }

    updateProjectiles(this, sdt);
    updateHazards(this, sdt);
    this.effects.update(sdt);
  }

  render(ctx) {
    const t = this.t;
    const sx = (Math.random() - 0.5) * this.shakeAmt;
    const sy = (Math.random() - 0.5) * this.shakeAmt;
    ctx.save();
    const z = 1 + (this.zoom || 0);
    const focus = this.cutin ? this.cutin.f : this.gmaxFx ? this.gmaxFx.f : null;
    const cx = focus ? focus.x : VW / 2;
    const cy = focus ? focus.y - focus.tall / 2 : VH / 2;
    ctx.translate(cx, cy);
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);
    ctx.translate(Math.round(sx * 2) / 2, Math.round(sy * 2) / 2);
    this.arena.drawWater(ctx, t);
    this.renderGiantSky(ctx);
    renderGroundHazards(ctx, this, t);
    this.effects.renderRings(ctx);
    this.renderGhosts(ctx);

    const items = this.fighters.map((f) => ({ y: f.y, draw: () => f.render(ctx, t) })).sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();
    this.renderPokeball(ctx);

    renderProjectiles(ctx, this, t);
    renderHazards(ctx, this, t);
    this.effects.renderParticles(ctx);
    this.effects.renderImpacts(ctx);
    this.effects.renderTexts(ctx);
    if (this.darken > 0) {
      ctx.fillStyle = `rgba(10,5,20,${this.darken * 0.6})`;
      ctx.fillRect(-10, -10, VW + 20, VH + 20);
    }
    if (this.gmaxFx) this.renderGmaxFx(ctx);
    ctx.restore();
    vignette(ctx);

    if (this.flashFx && this.flashFx.a > 0) {
      ctx.save();
      ctx.globalAlpha = this.flashFx.a;
      ctx.fillStyle = this.flashFx.color;
      ctx.fillRect(0, 0, VW, VH);
      ctx.restore();
    }
    renderHUD(ctx, this, t);
    this.renderCaption(ctx);
    this.renderRelator(ctx);
    this.renderCutin(ctx);
    this.renderGmaxTitle(ctx);
    this.renderOverlay(ctx);
  }

  // Mientras hay un gigante, la arena se tiñe de rojo
  renderGiantSky(ctx) {
    const g = this.fighters.find((f) => f.alive && f.gs > 1.02);
    if (!g) return;
    const k = (g.gs - 1) / (GMAX_SIZE - 1);
    ctx.fillStyle = `rgba(110,0,40,${0.18 * k})`;
    ctx.fillRect(-10, -10, VW + 20, VH + 20);
    glow(ctx, g.x, g.y - g.tall * 0.3, g.tall * 1.3 + 20, '#ff2d55', 0.22 * k);
  }

  // Columna de energía roja y el Pokémon creciendo por encima de la oscuridad
  renderGmaxFx(ctx) {
    const fx = this.gmaxFx;
    const f = fx.f;
    const a = Math.min(1, fx.t / 0.25) * (fx.t > fx.dur - 0.3 ? Math.max(0, (fx.dur - fx.t) / 0.3) : 1);
    ctx.fillStyle = `rgba(24,0,12,${0.6 * a})`;
    ctx.fillRect(-10, -10, VW + 20, VH + 20);
    const w = 8 + f.wide * 0.45 + Math.sin(fx.t * 40) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(f.x - w, 0, f.x + w, 0);
    g.addColorStop(0, 'rgba(255,45,85,0)');
    g.addColorStop(0.5, `rgba(255,110,140,${0.7 * a})`);
    g.addColorStop(1, 'rgba(255,45,85,0)');
    ctx.fillStyle = g;
    ctx.fillRect(f.x - w, -20, w * 2, f.y + 24);
    glow(ctx, f.x, f.y - f.tall * 0.5, f.tall + 16, '#ff2d55', 0.7 * a);
    ctx.restore();
    // Rayos alrededor
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#ffe0ea';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      if ((Math.floor(fx.t * 14) + i) % 3) continue;
      let x = f.x + (i - 1) * (w + 6);
      let y = f.y - f.tall - 30;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) {
        x += ((j + i) % 2 ? 4 : -4);
        y += 7;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    f.render(ctx, this.t);
    this.effects.renderParticles(ctx);
  }

  renderGmaxTitle(ctx) {
    const fx = this.gmaxFx;
    if (!fx || fx.t < 1.0) return;
    const f = fx.f;
    const k = backOut(Math.min(1, (fx.t - 1.0) / 0.3));
    const out = fx.t > fx.dur - 0.2 ? Math.max(0, (fx.dur - fx.t) / 0.2) : 1;
    const word = f.gform ? '¡GIGAMAX!' : '¡DINAMAX!';
    text(ctx, word, VW / 2, 62, { size: 26 * k, weight: 900, align: 'center', color: '#ff4d6d', stroke: '#1b1224', strokeW: 4, alpha: out });
    text(ctx, word, VW / 2, 60.6, { size: 26 * k, weight: 900, align: 'center', color: '#ffd0dc', alpha: out * 0.35 });
    text(ctx, `${f.def.name} ${f.gform ? 'GIGAMAX' : 'DINAMAX'}`, VW / 2, 74, { size: 7 * k, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2, alpha: out });
  }

  renderCutin(ctx) {
    const c = this.cutin;
    if (!c) return;
    const left = c.f.side === 0;
    const colors = c.gname ? ['#ffffff', '#ffd0dc', '#ff6b8a', '#d6204f', '#7a0f2e'] : TYPE_COLORS[c.m.fx] || TYPE_COLORS[c.f.type];
    const enter = Math.min(1, c.t / 0.14);
    const out = c.t > c.dur - 0.15 ? Math.max(0, (c.dur - c.t) / 0.15) : 1;
    const ease = 1 - Math.pow(1 - enter, 3);
    ctx.save();
    ctx.fillStyle = `rgba(5,3,12,${0.5 * out})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = out;
    ctx.translate((1 - ease) * (left ? -VW : VW), 0);
    const y0 = VH / 2 - 28;
    const h = 56;
    ctx.beginPath();
    ctx.moveTo(0, y0 + 8);
    ctx.lineTo(VW, y0 - 8);
    ctx.lineTo(VW, y0 + h - 8);
    ctx.lineTo(0, y0 + h + 8);
    ctx.closePath();
    ctx.fillStyle = colors[3];
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = colors[4];
    for (let i = -2; i < 12; i++) {
      const x = ((i * 34 + c.t * (left ? 260 : -260)) % (VW + 68)) - 34;
      ctx.beginPath();
      ctx.moveTo(x, y0 - 10);
      ctx.lineTo(x + 14, y0 - 10);
      ctx.lineTo(x - 6, y0 + h + 10);
      ctx.lineTo(x - 20, y0 + h + 10);
      ctx.fill();
    }
    // líneas de velocidad
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 16; i++) {
      const ly = y0 - 6 + ((i * 37) % (h + 12));
      const lx = ((c.t * (left ? 700 : -700) + i * 83) % (VW + 80) + VW + 80) % (VW + 80) - 40;
      ctx.fillRect(lx, ly, 26 + (i % 3) * 10, 0.8);
    }
    ctx.restore();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, y0 + 8);
    ctx.lineTo(VW, y0 - 8);
    ctx.moveTo(VW, y0 + h - 8);
    ctx.lineTo(0, y0 + h + 8);
    ctx.stroke();
    const px = left ? 70 : VW - 70;
    drawCreature(ctx, c.f.key, px, VH / 2 + 2, c.gname ? 92 : 78, { faceLeft: !left, boss: c.f.boss, gmax: c.gform, t: c.f.animT });
    const tx = left ? 205 : 115;
    const label = c.gname ? (c.gform ? '¡ATAQUE GIGAMAX!' : '¡ATAQUE DINAMAX!') : '¡ATAQUE DEFINITIVO!';
    const name = (c.gname || c.m.name).toUpperCase();
    text(ctx, label, tx, VH / 2 - 10, { size: 6, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 1.8 });
    text(ctx, name, tx, VH / 2 + 10, { size: name.length > 13 ? 13 : 16, weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 3.5 });
    ctx.restore();
  }

  renderGhosts(ctx) {
    for (const g of this.effects.ghosts) {
      const img = g.id.sprite.white;
      ctx.save();
      ctx.globalAlpha = (g.life / g.max) * 0.4;
      ctx.translate(Math.round(g.x), Math.round(g.y));
      ctx.scale((g.flip ? -1 : 1) * g.scale, g.scale);
      ctx.drawImage(img, -img.width / 2, -img.height + 2);
      ctx.restore();
    }
  }

  // Poké Ball volando durante el cambio
  renderPokeball(ctx) {
    if (this.state !== 'switch' || this.switching.thrown || this.stateT < 0.9) return;
    const side = this.switching.side;
    const k = Math.min(1, (this.stateT - 0.9) / 0.5);
    const sp = this.arena.spawns[side];
    const x0 = side === 0 ? -10 : VW + 10;
    const x = x0 + (sp.x - x0) * k;
    const y = sp.y - 10 + -Math.sin(k * Math.PI) * 50 + (1 - k) * 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(k * 12);
    ctx.fillStyle = '#1b1224';
    ctx.beginPath();
    ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8413b';
    ctx.beginPath();
    ctx.arc(0, 0, 3.8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f4f1ea';
    ctx.beginPath();
    ctx.arc(0, 0, 3.8, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#1b1224';
    ctx.fillRect(-3.8, -0.5, 7.6, 1);
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(-0.9, -0.9, 1.8, 1.8);
    ctx.restore();
  }

  // Comentario del relator: barra arriba al centro, estilo transmisión
  showRelator(line) {
    this.relator = { text: line, t: 0 };
  }

  renderRelator(ctx) {
    const r = this.relator;
    if (!r || r.t > 2.6) return;
    const k = Math.min(1, r.t / 0.15);
    const alpha = r.t > 2.2 ? 1 - (r.t - 2.2) / 0.4 : 1;
    const size = r.text.length > 44 ? 5.2 : 6.2;
    const w = Math.min(VW - 70, textWidth(ctx, r.text, size, 900) + 22);
    const x = VW / 2 - w / 2;
    const y = 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, (1 - k) * -8);
    roundRect(ctx, x, y, w, 12, 3);
    ctx.fillStyle = 'rgba(14,10,24,0.88)';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#ffb43b';
    ctx.stroke();
    // micrófono
    roundRect(ctx, x + 4.5, y + 2.6, 3, 4.6, 1.5);
    ctx.fillStyle = '#ffb43b';
    ctx.fill();
    ctx.strokeStyle = '#ffb43b';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x + 6, y + 5.8, 2.4, 0, Math.PI);
    ctx.moveTo(x + 6, y + 8.2);
    ctx.lineTo(x + 6, y + 9.6);
    ctx.stroke();
    text(ctx, r.text, x + w / 2 + 4, y + 8.3, { size, weight: 900, align: 'center', color: '#fff4c0' });
    ctx.restore();
  }

  renderCaption(ctx) {
    const c = this.caption;
    if (!c || c.t > 2.4) return;
    const alpha = c.t > 2 ? 1 - (c.t - 2) / 0.4 : Math.min(1, c.t * 6);
    text(ctx, c.text, VW / 2, VH - 26, { size: 8, weight: 800, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2.4, alpha });
  }

  renderOverlay(ctx) {
    const cy = VH / 2;
    if (this.state === 'intro') {
      const st = this.stateT;
      const k = backOut(st / 0.45);
      const out = st > 1.05 ? Math.min(1, (st - 1.05) / 0.2) : 0;
      ctx.save();
      ctx.globalAlpha = 1 - out;
      ctx.fillStyle = 'rgba(10,6,20,0.75)';
      ctx.fillRect(0, cy - 22, VW, 44);
      ctx.fillStyle = '#ffb43b';
      ctx.fillRect(0, cy - 22, VW, 1.2);
      ctx.fillRect(0, cy + 21, VW, 1.2);
      text(ctx, this.round || 'COMBATE', VW / 2 + (1 - k) * -160, cy - 5, { size: 14, weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 3 });
      text(ctx, `${this.player.name}  vs  ${this.enemy.name}`, VW / 2 + (1 - k) * 160, cy + 12, { size: 8, weight: 800, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 2 });
      ctx.restore();
      if (st > 1.2) {
        const n = Math.ceil(3.0 - st);
        const local = 1 - ((3.0 - st) % 0.6) / 0.6;
        if (n > 0) text(ctx, String(n), VW / 2, cy + 14, { size: 40 * backOut(local * 2), weight: 900, align: 'center', color: '#ffffff', stroke: '#1b1224', strokeW: 4, alpha: 1 - local * 0.4 });
      }
    }
    if (this.state === 'fight' && this.stateT < 0.7 && !this.cutin && this.teams[0].fainted.length === 0 && this.teams[1].fainted.length === 0) {
      const k = this.stateT / 0.7;
      text(ctx, '¡YA!', VW / 2, cy + 12, { size: 36 * backOut(k * 3), weight: 900, align: 'center', color: '#ffe66b', stroke: '#1b1224', strokeW: 4, alpha: 1 - Math.max(0, k - 0.6) / 0.4 });
    }
    if (this.state === 'ko') {
      const k = Math.min(1, this.stateT / 0.4);
      const won = this.winner === this.player;
      text(ctx, won ? '¡GANASTE!' : '¡K.O.!', VW / 2, cy + 10, { size: 30 * backOut(k), weight: 900, align: 'center', color: won ? '#ffe66b' : '#ff5d73', stroke: '#1b1224', strokeW: 4 });
    }
  }
}

