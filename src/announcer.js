// Relator del combate. Por defecto comenta con subtítulos en pantalla;
// opcionalmente también habla con las voces del navegador (Web Speech API).
// Idioma: español o inglés.

const LINES = {
  es: {
    start: ['¡Bienvenidos al Poké World Championship! ¡{a} contra {b}! ¡A pelear!', '¡Comienza el combate! ¡{a} se enfrenta a {b}!', '¡Atención, público! ¡{a} contra {b}! ¡Que gane el mejor!'],
    ult: ['¡{a} usa {move}!', '¡Atención! ¡{move}!', '¡{a} lanza {move}! ¡Qué poder!'],
    surf: ['¡Una ola gigante! ¡A surfear!', '¡{a} usa Surf! ¡Cuidado con la ola!'],
    ice: ['¡Rayo Hielo! ¡Se congela el agua!', '¡Brrr! ¡Qué frío!'],
    super: ['¡Es súper eficaz!', '¡Eso dolió mucho!', '¡Súper eficaz!'],
    crit: ['¡Golpe crítico!', '¡Crítico! ¡Qué golpe!'],
    combo: ['¡Qué combo increíble!', '¡No para de pegar!', '¡Combo de {n} golpes!'],
    dodge: ['¡Lo esquivó!', '¡Qué reflejos!', '¡Uy, por poquito!'],
    sleep: ['¡{b} se quedó dormido!', '¡Zzz! ¡A dormir!'],
    low: ['¡A {a} le queda poca vida!', '¡{a} está en problemas!', '¡Aguanta, {a}!'],
    faint: ['¡{a} se debilitó!', '¡{a} está fuera de combate!', '¡Cayó {a}!'],
    next: ['¡Adelante, {a}!', '¡Dale, {a}, es tu turno!'],
    nextEnemy: ['¡El rival envía a {a}!', '¡Aparece {a}!'],
    boss: ['¡Cuidado! ¡Llega el jefe! ¡{a}!', '¡Uy, uy, uy! ¡{a}! ¡Esto se pone difícil!'],
    win: ['¡Victoria! ¡Qué combate increíble!', '¡Ganaste! ¡La arena explota de alegría!'],
    lose: ['¡Oh, no! Esta vez ganó el rival. ¡La revancha va a ser tuya!', '¡Casi! ¡Vamos de nuevo!'],
    champion: ['¡Tenemos nuevos campeones del mundo! ¡Felicitaciones!'],
  },
  en: {
    start: ['Welcome to the Poké World Championship! {a} versus {b}! Let\'s battle!', 'Here we go! {a} takes on {b}!', 'Ladies and gentlemen! {a} versus {b}!'],
    ult: ['{a} used {move}!', 'Here comes {move}!', '{a} unleashes {move}! What power!'],
    surf: ['Surf\'s up, dude!', '{a} used Surf! Ride the wave!'],
    ice: ['Ice Beam! The water is freezing!', 'Brrr! That\'s cold!'],
    super: ['It\'s super effective!', 'That\'s gotta hurt!', 'Super effective!'],
    crit: ['A critical hit!', 'Critical hit! What a blow!'],
    combo: ['What a combo!', 'Unstoppable!', '{n} hit combo!'],
    dodge: ['Dodged it!', 'Nice reflexes!', 'So close!'],
    sleep: ['{b} fell asleep!', 'Zzz! Nap time!'],
    low: ['{a} is in trouble!', 'Hang in there, {a}!'],
    faint: ['{a} fainted!', '{a} is down!', '{a} is out!'],
    next: ['Go, {a}!', 'You\'re up, {a}!'],
    nextEnemy: ['The rival sends out {a}!', 'Here comes {a}!'],
    boss: ['Watch out! The boss is here! {a}!', 'Uh oh! {a}! This is getting tough!'],
    win: ['Victory! What a battle!', 'You win! The crowd goes wild!'],
    lose: ['Oh no! The rival wins this time. Try again!', 'So close! Let\'s go again!'],
    champion: ['We have new world champions! Congratulations!'],
  },
};

// Cada cuánto puede repetirse cada tipo de frase (segundos)
const COOLDOWN = { super: 5, crit: 5, combo: 6, dodge: 10, ult: 3, low: 0, sleep: 6, surf: 6, ice: 6 };

const MODES = ['texto', 'voz', 'off'];

// Nombres oficiales en inglés de los ataques (para el relator en inglés)
const EN_MOVES = {
  'Placaje Eléctrico': 'Volt Tackle', Trueno: 'Thunder', Llamarada: 'Fire Blast', Hidrobomba: 'Hydro Pump',
  'Rayo Solar': 'Solar Beam', Hipnosis: 'Hypnosis', Gigaimpacto: 'Giga Impact', 'Rayo Hielo': 'Ice Beam',
  Hiperrayo: 'Hyper Beam', 'Último Recurso': 'Last Resort', Canto: 'Sing', 'A Bocajarro': 'Close Combat',
  'Psíquico': 'Psychic', Surf: 'Surf',
};

export function moveNameFor(mode, name) {
  return mode === 'en' ? EN_MOVES[name] || name : name;
}

function load(key, options, def) {
  try {
    const v = localStorage.getItem(key);
    return options.includes(v) ? v : def;
  } catch {
    return def;
  }
}

function save(key, v) {
  try {
    localStorage.setItem(key, v);
  } catch { /* almacenamiento no disponible */ }
}

// "MEGA GYARADOS" -> "Mega Gyarados" (algunas voces deletrean las mayúsculas)
export function speakName(name) {
  return name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export class Announcer {
  constructor(audio) {
    this.audio = audio;
    this.mode = load('arena-brava-relator-modo', MODES, 'texto');
    this.lang = load('arena-brava-relator-idioma', ['es', 'en'], 'es');
    this.onLine = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = { es: null, en: null };
    this.last = {};
    this.busyUntil = 0;
    this.priority = 0;
    if (this.synth) {
      this.pickVoices();
      this.synth.addEventListener?.('voiceschanged', () => this.pickVoices());
    }
  }

  get label() {
    return { texto: 'TEXTO', voz: 'CON VOZ', off: 'NO' }[this.mode];
  }

  get short() {
    return { texto: 'TXT', voz: 'VOZ', off: 'NO' }[this.mode];
  }

  get langLabel() {
    return this.lang === 'es' ? 'ESPAÑOL' : 'INGLÉS';
  }

  // ¿La voz disponible es de las buenas? (Google, Microsoft Natural, Premium…)
  get goodVoice() {
    const v = this.voices[this.lang];
    return !!v && /google|natural|premium|enhanced|neural|siri/i.test(v.name);
  }

  cycle() {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    save('arena-brava-relator-modo', this.mode);
    this.stop();
    if (this.mode === 'voz') this.say('start', { a: 'Pikachu', b: 'Charizard' }, 5);
  }

  toggleLang() {
    this.lang = this.lang === 'es' ? 'en' : 'es';
    save('arena-brava-relator-idioma', this.lang);
    this.stop();
  }

  pickVoices() {
    const all = this.synth.getVoices();
    const best = (prefs) => {
      for (const p of prefs) {
        const v = all.find((x) => x.lang.replace('_', '-').toLowerCase().startsWith(p.lang) && (!p.name || p.name.test(x.name)));
        if (v) return v;
      }
      return null;
    };
    // Voz de relator: primero las de Google (Chrome), después las voces nuevas de Mac
    this.voices.es = best([
      { lang: 'es', name: /natural|neural/i }, { lang: 'es', name: /premium|enhanced/i },
      { lang: 'es-us', name: /google/i }, { lang: 'es-419', name: /google/i }, { lang: 'es-mx', name: /reed/i },
      { lang: 'es-mx', name: /eddy/i }, { lang: 'es-ar' }, { lang: 'es-mx', name: /paulina/i }, { lang: 'es-mx' },
      { lang: 'es-us' }, { lang: 'es-419' }, { lang: 'es-es', name: /google/i }, { lang: 'es' },
    ]);
    this.voices.en = best([
      { lang: 'en', name: /natural|neural/i }, { lang: 'en', name: /premium|enhanced/i },
      { lang: 'en-us', name: /google/i }, { lang: 'en-us', name: /reed/i }, { lang: 'en-us', name: /eddy/i },
      { lang: 'en-us', name: /samantha|alex/i }, { lang: 'en-us' }, { lang: 'en' },
    ]);
  }

  stop() {
    this.synth?.cancel();
    this.busyUntil = 0;
    this.priority = 0;
    this.audio.duck?.(false);
  }

  // Dice una frase del tipo `kind`. Las más importantes interrumpen a las otras.
  say(kind, vars = {}, priority = 1) {
    if (this.mode === 'off') return;
    const now = performance.now() / 1000;
    const cd = COOLDOWN[kind] ?? 0;
    if (cd && this.last[kind] && now - this.last[kind] < cd) return;
    const speaking = now < this.busyUntil;
    // Lo importante que llega mientras habla queda en fila; lo menor se descarta
    const queue = speaking && priority <= this.priority && priority >= 2;
    if (speaking && priority <= this.priority && !queue) return;
    const options = LINES[this.lang][kind];
    if (!options) return;
    this.last[kind] = now;
    let line = options[Math.floor(Math.random() * options.length)];
    for (const [k, v] of Object.entries(vars)) line = line.replaceAll(`{${k}}`, v);
    this.lastLine = line;
    this.onLine?.(line, priority);
    const voiceOn = this.mode === 'voz' && this.synth && !this.audio.silent;
    if (!voiceOn) {
      // Solo subtítulos: el tiempo de lectura reemplaza al de la voz
      this.priority = Math.max(priority, queue ? this.priority : 0);
      this.busyUntil = now + 1.2 + line.length * 0.03;
      return;
    }
    if (speaking && !queue) this.synth.cancel();
    const u = new SpeechSynthesisUtterance(line);
    const voice = this.voices[this.lang];
    if (voice) u.voice = voice;
    u.lang = voice?.lang || (this.lang === 'es' ? 'es-419' : 'en-US');
    u.rate = 1.12;
    u.pitch = 1.1;
    u.volume = 1;
    this.priority = Math.max(priority, queue ? this.priority : 0);
    // Estimación por si el navegador no avisa cuándo termina
    this.busyUntil = Math.max(queue ? this.busyUntil : now, now) + 0.5 + line.length * 0.06;
    u.onstart = () => this.audio.duck?.(true);
    u.onend = u.onerror = () => {
      if (this.synth.pending || this.synth.speaking) return;
      this.busyUntil = 0;
      this.priority = 0;
      this.audio.duck?.(false);
    };
    this.synth.speak(u);
  }
}
