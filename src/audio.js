// Sonido del juego: efectos sintetizados, gritos reales de los Pokémon
// (PokeAPI/cries en GitHub) y la música de batalla de los juegos
// (la que usa Pokémon Showdown).

const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/';
const BGM_URL = 'https://play.pokemonshowdown.com/audio/';
const PLAYLIST = {
  // Los temas de Kanto (Rojo/Azul) son los más reconocibles
  menu: ['hgss-kanto-trainer', 'bw2-kanto-gym-leader'],
  battle: ['bw-trainer', 'xy-trainer', 'oras-trainer', 'sm-trainer', 'hgss-johto-trainer', 'dpp-trainer', 'bw-subway-trainer', 'xd-miror-b'],
  boss: ['bw-rival', 'xy-rival', 'bw2-kanto-gym-leader', 'sm-rival', 'oras-rival', 'spl-elite4', 'bw2-rival', 'dpp-rival'],
};
const MUSIC_VOL = 0.35;

// Música propia opcional: si existen estos archivos en la carpeta musica/, se usan
const CUSTOM = { menu: 'musica/menu.mp3', battle: 'musica/batalla.mp3', boss: 'musica/jefe.mp3' };

function loadFlag(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
}

function saveFlag(key, v) {
  try {
    localStorage.setItem(key, v ? '1' : '0');
  } catch { /* almacenamiento no disponible */ }
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.musicOn = loadFlag('arena-brava-music', true);
    this.sfxOn = loadFlag('arena-brava-sfx', true);
    // ?mute en la dirección: todo en silencio (para probar sin molestar)
    this.silent = /[?&]mute/.test(location.search);
    this.lastPlay = {};
    this.cryData = new Map();
    this.cryBuf = new Map();
    this.track = null;
    this.bgm = null;
    this.unlocked = false;
    this.ducked = false;
    this.offset = 0;
    this.rec = null;
    this.custom = {};
    this.findCustomMusic();
  }

  async findCustomMusic() {
    for (const [track, file] of Object.entries(CUSTOM)) {
      try {
        const res = await fetch(file, { method: 'HEAD' });
        const type = res.headers.get('content-type') || '';
        if (res.ok && type.startsWith('audio')) this.custom[track] = file;
      } catch { /* sin archivo propio */ }
    }
  }

  // Hora del audio (en las grabaciones se corre con `offset`)
  now() {
    return this.ctx.currentTime + this.offset;
  }

  // Para grabar el video: anota cada sonido con su momento
  log(m, a) {
    if (this.rec) this.rec.events.push({ t: this.rec.clock(), m, a });
  }

  get muted() {
    return !this.sfxOn;
  }

  unlock() {
    if (this.silent) return;
    if (!this.unlocked) {
      this.unlocked = true;
      // Un solo reproductor de música, activado dentro del toque (Safari lo exige)
      this.bgm = new Audio();
      this.bgm.loop = true;
      this.bgm.preload = 'auto';
      this.bgm.volume = 0;
      this.playBgm();
    } else if (this.bgm && this.bgm.paused && this.bgmFile) {
      this.playBgm();
    }
    if (this.ctx) {
      // En iOS puede quedar "suspended" o "interrupted" (al volver de otra app)
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // Que suene aunque el iPhone tenga el botón de silencio activado
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch { /* no disponible */ }
    this.init(new AC());
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  // ¿El sonido está realmente funcionando?
  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // Arma los canales de audio sobre un contexto (real o de prueba)
  init(ctx) {
    this.ctx = ctx;
    // Compresor: mantiene los golpes fuertes sin saturar
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.ratio.value = 4;
    this.comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxOn ? 0.55 : 0;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.5 : 0;
    this.musicBus.connect(this.master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    for (const [id, data] of this.cryData) this.decodeCry(id, data);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    saveFlag('arena-brava-music', this.musicOn);
    if (this.musicOn) {
      this.unlock();
      this.playBgm();
    } else {
      this.fadeOutBgm();
    }
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    saveFlag('arena-brava-sfx', this.sfxOn);
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxOn ? 0.55 : 0;
    this.unlock();
  }

  // Compatibilidad: la tecla M apaga/prende la música
  toggleMute() {
    this.toggleMusic();
  }

  // Baja la música mientras habla el relator
  duck(on) {
    this.ducked = on;
    if (this.bgm && !this.bgm.paused) this.fadeTo(this.bgm, on ? MUSIC_VOL * 0.35 : MUSIC_VOL, 0.25);
  }

  // Música de fondo: 'menu', 'battle', 'boss', 'victory' o null
  music(name) {
    if (name === this.track) return;
    this.track = name;
    clearTimeout(this.afterWin);
    if (name === 'victory') {
      this.bgmFile = null;
      this.fadeOutBgm();
      this.play('win');
      this.afterWin = setTimeout(() => {
        if (this.track === 'victory') this.music('menu');
      }, 3500);
      return;
    }
    const list = PLAYLIST[name];
    if (this.custom[name]) this.bgmFile = new URL(this.custom[name], location.href).href;
    else this.bgmFile = list ? `${BGM_URL}${list[Math.floor(Math.random() * list.length)]}.mp3` : null;
    if (!this.bgm) return;
    if (this.bgm.paused) this.playBgm();
    else this.fadeOutBgm(() => this.playBgm());
  }

  playBgm() {
    const el = this.bgm;
    if (!el || this.silent || !this.musicOn || !this.bgmFile) return;
    if (el.src !== this.bgmFile) el.src = this.bgmFile;
    el.volume = 0;
    const p = el.play();
    const fadeIn = () => this.fadeTo(el, this.ducked ? MUSIC_VOL * 0.35 : MUSIC_VOL, 0.8);
    if (p && p.then) p.then(fadeIn, () => {});
    else fadeIn();
  }

  startBgm() {
    if (this.bgm && this.bgm.paused) this.playBgm();
  }

  fadeOutBgm(done) {
    const el = this.bgm;
    if (!el || el.paused) {
      done?.();
      return;
    }
    this.fadeTo(el, 0, 0.45, () => {
      el.pause();
      done?.();
    });
  }

  fadeTo(el, target, secs, done) {
    const start = el.volume;
    const t0 = performance.now();
    clearInterval(el.fadeTimer);
    el.fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      el.volume = Math.max(0, Math.min(1, start + (target - start) * k));
      if (k >= 1) {
        clearInterval(el.fadeTimer);
        done?.();
      }
    }, 40);
  }

  // Pestaña oculta: pausa la música
  setHidden(hidden) {
    if (this.ctx) {
      if (hidden) this.ctx.suspend?.().catch(() => {});
      else this.ctx.resume?.().catch(() => {});
    }
    if (!this.bgm) return;
    if (hidden) this.bgm.pause();
    else if (this.bgmFile) this.playBgm();
  }

  update() {}

  // Gritos de los Pokémon
  async loadCries(ids) {
    await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetch(`${CRIES}${id}.ogg`);
        if (!res.ok) return;
        const data = await res.arrayBuffer();
        this.cryData.set(id, data);
        if (this.ctx) this.decodeCry(id, data);
      } catch { /* sin internet: sin gritos */ }
    }));
  }

  decodeCry(id, data) {
    if (this.cryBuf.has(id)) return;
    this.cryBuf.set(id, null);
    this.ctx.decodeAudioData(data.slice(0)).then(
      (buf) => this.cryBuf.set(id, buf),
      () => {},
    );
  }

  cry(id, { rate = 1, vol = 0.5 } = {}) {
    this.log('cry', [id, { rate, vol }]);
    if (!this.ctx || !this.sfxOn) return;
    const buf = this.cryBuf.get(id);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start(this.now());
  }

  // Evita que el mismo sonido se apile muchas veces en el mismo instante
  throttle(name, gap = 0.03) {
    if (!this.ctx) return false;
    const now = this.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < gap) return false;
    this.lastPlay[name] = now;
    return true;
  }

  tone(freq, dur, { type = 'square', vol = 0.3, slide = null, delay = 0, bus = null } = {}) {
    if (!this.ctx) return;
    const t = this.now() + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 0.8, kind = 'lowpass', delay = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t = this.now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = kind;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  play(name) {
    this.log('play', [name]);
    if (!this.ctx || !this.sfxOn) return;
    if (!this.throttle(name)) return;
    switch (name) {
      case 'select': this.tone(660, 0.06, { vol: 0.15 }); break;
      case 'confirm':
        this.tone(660, 0.07, { vol: 0.18 });
        this.tone(990, 0.12, { vol: 0.18, delay: 0.07 });
        break;
      case 'back': this.tone(440, 0.08, { vol: 0.15, slide: 300 }); break;
      case 'hit':
        this.noise(0.09, { vol: 0.35, freq: 2200 });
        this.tone(220, 0.1, { vol: 0.2, slide: 70 });
        break;
      case 'bighit':
        this.noise(0.25, { vol: 0.5, freq: 900 });
        this.tone(160, 0.25, { vol: 0.3, slide: 40, type: 'sawtooth' });
        break;
      case 'swing': this.noise(0.07, { vol: 0.15, freq: 3500, kind: 'highpass' }); break;
      case 'dash': this.noise(0.14, { vol: 0.18, freq: 2500, kind: 'bandpass', q: 2 }); break;
      case 'fire':
        this.noise(0.25, { vol: 0.25, freq: 700 });
        this.tone(300, 0.15, { vol: 0.1, slide: 120, type: 'sawtooth' });
        break;
      case 'water': this.tone(500, 0.16, { vol: 0.2, slide: 900, type: 'sine' }); break;
      case 'zap':
        this.tone(1400, 0.08, { vol: 0.12, slide: 300, type: 'sawtooth' });
        this.noise(0.06, { vol: 0.15, freq: 5000, kind: 'highpass' });
        break;
      case 'needle': this.tone(1200, 0.07, { vol: 0.12, slide: 600, type: 'triangle' }); break;
      case 'rock': this.tone(110, 0.2, { vol: 0.3, slide: 60, type: 'triangle' }); break;
      case 'orb': this.tone(300, 0.3, { vol: 0.15, slide: 500, type: 'sine' }); break;
      case 'explode': this.noise(0.4, { vol: 0.45, freq: 500 }); break;
      case 'clash':
        this.tone(1800, 0.12, { vol: 0.15, slide: 900, type: 'square' });
        this.noise(0.1, { vol: 0.25, freq: 4000, kind: 'bandpass' });
        break;
      case 'super':
        this.tone(200, 0.45, { vol: 0.2, slide: 900, type: 'sawtooth' });
        this.noise(0.5, { vol: 0.2, freq: 1500, kind: 'bandpass', attack: 0.2 });
        break;
      case 'quake':
        this.noise(0.9, { vol: 0.6, freq: 180 });
        this.tone(60, 0.8, { vol: 0.35, slide: 30, type: 'sawtooth' });
        break;
      case 'ko':
        this.noise(0.6, { vol: 0.5, freq: 600 });
        this.tone(400, 0.7, { vol: 0.3, slide: 50, type: 'square' });
        break;
      case 'cheer':
        this.noise(1.6, { vol: 0.22, freq: 1100, kind: 'bandpass', q: 0.6, attack: 0.25 });
        break;
      case 'beep': this.tone(520, 0.12, { vol: 0.2 }); break;
      case 'go':
        this.tone(1040, 0.35, { vol: 0.22 });
        this.tone(780, 0.35, { vol: 0.12, type: 'triangle' });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { vol: 0.2, delay: i * 0.12 }));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, { vol: 0.2, delay: i * 0.18, type: 'triangle' }));
        break;
      case 'ready': this.tone(880, 0.1, { vol: 0.15, type: 'triangle', slide: 1320 }); break;
      case 'surf':
        this.noise(1.1, { vol: 0.35, freq: 900, kind: 'lowpass', attack: 0.35 });
        this.noise(0.8, { vol: 0.15, freq: 3000, kind: 'bandpass', attack: 0.3 });
        break;
      case 'thunder':
        this.noise(0.08, { vol: 0.5, freq: 6000, kind: 'highpass' });
        this.noise(0.7, { vol: 0.45, freq: 220, delay: 0.03 });
        break;
      case 'ice':
        [1800, 2400, 3000].forEach((f, i) => this.tone(f, 0.15, { vol: 0.06, type: 'triangle', delay: i * 0.04 }));
        break;
      case 'charge': this.tone(150, 0.8, { vol: 0.15, slide: 900, type: 'sawtooth' }); break;
      case 'ball':
        this.tone(1200, 0.05, { vol: 0.12 });
        this.noise(0.25, { vol: 0.25, freq: 2500, kind: 'bandpass', delay: 0.05 });
        break;
    }
  }
  // Sonido al lanzar un ataque, según su tipo
  cast(fx) {
    this.log('cast', [fx]);
    if (!this.ctx || !this.sfxOn || !this.throttle(`cast-${fx}`, 0.08)) return;
    switch (fx) {
      case 'fuego':
        this.noise(0.35, { vol: 0.3, freq: 900, attack: 0.04 });
        this.tone(220, 0.25, { type: 'sawtooth', vol: 0.08, slide: 90 });
        break;
      case 'agua':
        this.tone(280, 0.16, { type: 'sine', vol: 0.25, slide: 950 });
        this.noise(0.18, { vol: 0.18, freq: 2200, kind: 'bandpass', q: 1.5, delay: 0.03 });
        break;
      case 'electrico':
        for (let i = 0; i < 4; i++) this.tone(700 + Math.random() * 1600, 0.035, { type: 'square', vol: 0.09, delay: i * 0.035 });
        this.noise(0.12, { vol: 0.15, freq: 5000, kind: 'highpass' });
        break;
      case 'planta':
        this.noise(0.22, { vol: 0.2, freq: 4500, kind: 'highpass', attack: 0.03 });
        this.tone(420, 0.12, { type: 'triangle', vol: 0.12, slide: 300 });
        break;
      case 'psiquico':
        this.tone(480, 0.35, { type: 'sine', vol: 0.18, slide: 960 });
        this.tone(960, 0.35, { type: 'sine', vol: 0.12, slide: 480, delay: 0.05 });
        break;
      case 'fantasma':
        this.tone(720, 0.5, { type: 'sine', vol: 0.15, slide: 190 });
        this.tone(735, 0.5, { type: 'sine', vol: 0.12, slide: 200 });
        break;
      case 'hada':
      case 'estrella':
        [1320, 1760, 2093].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.1, delay: i * 0.05 }));
        break;
      case 'aura':
      case 'lucha':
        this.tone(130, 0.18, { type: 'sine', vol: 0.4, slide: 55 });
        this.noise(0.15, { vol: 0.2, freq: 1800, kind: 'bandpass', delay: 0.02 });
        break;
      case 'roca':
        this.noise(0.35, { vol: 0.35, freq: 320 });
        this.tone(85, 0.3, { type: 'triangle', vol: 0.3, slide: 50 });
        break;
      case 'hielo':
        [2200, 2900, 3500].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.07, delay: i * 0.035 }));
        this.noise(0.2, { vol: 0.12, freq: 6000, kind: 'highpass' });
        break;
      default:
        this.noise(0.2, { vol: 0.2, freq: 1500, kind: 'bandpass', attack: 0.04 });
    }
  }

  // Capa extra en cada golpe, según el tipo del ataque
  hitFx(fx, heavy) {
    this.log('hitFx', [fx, heavy]);
    if (!this.ctx || !this.sfxOn || !this.throttle(`hit-${fx}`, 0.06)) return;
    switch (fx) {
      case 'fuego': this.noise(0.25, { vol: 0.3, freq: 1300 }); break;
      case 'agua':
        this.noise(0.25, { vol: 0.25, freq: 1500, kind: 'bandpass' });
        this.tone(650, 0.12, { type: 'sine', vol: 0.15, slide: 180 });
        break;
      case 'electrico':
        this.tone(1600, 0.07, { type: 'square', vol: 0.1, slide: 380 });
        this.tone(1200, 0.07, { type: 'square', vol: 0.08, slide: 300, delay: 0.05 });
        break;
      case 'planta': this.noise(0.08, { vol: 0.25, freq: 5000, kind: 'highpass' }); break;
      case 'psiquico':
      case 'fantasma': this.tone(320, 0.25, { type: 'sine', vol: 0.3, slide: 70 }); break;
      case 'hada':
      case 'estrella': this.tone(1600, 0.15, { type: 'triangle', vol: 0.12, slide: 2400 }); break;
      case 'hielo': [2500, 3300].forEach((f, i) => this.tone(f, 0.1, { type: 'triangle', vol: 0.1, delay: i * 0.03 })); break;
      default: this.tone(100, 0.15, { type: 'sine', vol: 0.35, slide: 45 });
    }
    if (heavy) {
      this.tone(70, 0.35, { type: 'sine', vol: 0.5, slide: 30 });
      this.noise(0.3, { vol: 0.3, freq: 600, delay: 0.01 });
    }
  }

  // Sonido que dura mientras sale un chorro o un rayo
  sustain(fx, dur) {
    this.log('sustain', [fx, dur]);
    if (!this.ctx || !this.sfxOn) return;
    const ctx = this.ctx;
    const t = this.now();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    const cfg = {
      fuego: ['lowpass', 900, 0.32, 11], agua: ['bandpass', 1100, 0.3, 6], hielo: ['highpass', 4500, 0.16, 14],
      hiper: ['lowpass', 1600, 0.3, 18], solar: ['bandpass', 2400, 0.18, 8],
    }[fx] || ['bandpass', 1500, 0.2, 8];
    f.type = cfg[0];
    f.frequency.value = cfg[1];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(cfg[2], t + 0.08);
    g.gain.setValueAtTime(cfg[2], t + Math.max(0.1, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    lfo.frequency.value = cfg[3];
    lg.gain.value = cfg[2] * 0.35;
    lfo.connect(lg);
    lg.connect(g.gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    // Zumbido de fondo en los rayos
    if (fx === 'hiper') this.tone(90, dur, { type: 'sawtooth', vol: 0.1 });
    if (fx === 'solar') [523, 659, 784].forEach((fr) => this.tone(fr, dur, { type: 'triangle', vol: 0.05 }));
    if (fx === 'hielo') for (let i = 0; i < dur / 0.09; i++) this.tone(2000 + Math.random() * 2500, 0.06, { type: 'triangle', vol: 0.04, delay: i * 0.09 });
  }

  // Presentación del ataque definitivo
  ult() {
    this.log('ult', []);
    if (!this.ctx || !this.sfxOn) return;
    this.tone(160, 0.55, { type: 'sawtooth', vol: 0.18, slide: 1100 });
    this.noise(0.55, { vol: 0.25, freq: 2500, kind: 'bandpass', attack: 0.4 });
    this.tone(60, 0.6, { type: 'sine', vol: 0.55, slide: 35, delay: 0.5 });
    this.noise(0.5, { vol: 0.35, freq: 700, delay: 0.5 });
  }

}
