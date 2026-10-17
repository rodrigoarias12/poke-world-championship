export const TYPES = {
  normal: { name: 'NORMAL', color: '#a8a77a' },
  fuego: { name: 'FUEGO', color: '#ff7a2f' },
  agua: { name: 'AGUA', color: '#3fa7ff' },
  planta: { name: 'PLANTA', color: '#4cc44a' },
  electrico: { name: 'ELÉCTRICO', color: '#f2c318' },
  roca: { name: 'ROCA', color: '#b8a038' },
  fantasma: { name: 'FANTASMA', color: '#7a5bbf' },
  psiquico: { name: 'PSÍQUICO', color: '#f95587' },
  lucha: { name: 'LUCHA', color: '#d24a3a' },
  hada: { name: 'HADA', color: '#f08fd0' },
};

// Multiplicador de daño: atacante -> defensor (tabla simplificada)
const CHART = {
  normal: { roca: 0.5, fantasma: 0.5 },
  fuego: { planta: 2, agua: 0.5, roca: 0.5, fuego: 0.5 },
  agua: { fuego: 2, roca: 2, planta: 0.5, agua: 0.5 },
  planta: { agua: 2, roca: 2, fuego: 0.5, planta: 0.5 },
  electrico: { agua: 2, planta: 0.5, electrico: 0.5, roca: 0.5 },
  roca: { fuego: 2, lucha: 0.5 },
  fantasma: { fantasma: 2, psiquico: 2, normal: 0.5 },
  psiquico: { lucha: 2, psiquico: 0.5 },
  lucha: { normal: 2, roca: 2, psiquico: 0.5, hada: 0.5, fantasma: 0.5 },
  hada: { lucha: 2, fuego: 0.5 },
};

export function typeMultiplier(attack, defend) {
  return CHART[attack]?.[defend] ?? 1;
}

export function strongAgainst(type) {
  return Object.entries(CHART[type]).filter(([, m]) => m > 1).map(([t]) => t);
}

// ------------------------------------------------------------------ Ataques
// kind: shot | melee | dash | stream | beam | ring | quake | zone | thunder | wave | fly | teleport | dodge | blink | rest
// type: tipo del ataque (para la tabla de tipos); fx: colores del efecto
export const MOVES = {
  esquivar: { name: 'Esquivar', kind: 'dodge', cd: 1 },
  ataqueRapido: { name: 'Ataque Rápido', kind: 'dodge', cd: 0.9, speed: 290, time: 0.22 },
  refugio: { name: 'Refugio', kind: 'dodge', cd: 1.4, speed: 0, time: 0.45, shell: true },
  vuelo: { name: 'Vuelo', kind: 'fly', type: 'normal', fx: 'normal', up: 1.0, dmg: 16, r: 22, cd: 4 },
  teletransporte: { name: 'Teletransporte', kind: 'blink', cd: 1.2, dist: 70 },
  descanso: { name: 'Descanso', kind: 'rest', heal: 0.3, sleep: 1.6, cd: 14 },

  impactrueno: { name: 'Impactrueno', kind: 'shot', type: 'electrico', proj: 'spark', fx: 'electrico', dmg: 6, speed: 250, r: 2.5, cd: 0.55 },
  bolaVoltio: { name: 'Bola Voltio', kind: 'shot', type: 'electrico', proj: 'orb', fx: 'electrico', dmg: 13, speed: 150, r: 5, explode: 16, stun: 0.35, weight: 2, cd: 2.6 },
  placajeElectrico: { name: 'Placaje Eléctrico', kind: 'dash', type: 'electrico', fx: 'electrico', dmg: 11, speed: 320, time: 0.3, hits: 3, spin: true, kb: 180, stun: 0.15, cd: 7 },
  trueno: { name: 'Trueno', kind: 'thunder', type: 'electrico', fx: 'electrico', dmg: 16, strikes: 3, interval: 0.45, r: 14, warn: 0.55, stun: 0.4, cd: 13 },

  ascuas: { name: 'Ascuas', kind: 'shot', type: 'fuego', proj: 'fireball', fx: 'fuego', dmg: 7, speed: 210, r: 3, explode: 9, cd: 0.6 },
  lanzallamas: { name: 'Lanzallamas', kind: 'stream', type: 'fuego', fx: 'fuego', tick: 2.6, len: 75, width: 10, dur: 0.9, cd: 3 },
  giroFuego: { name: 'Giro Fuego', kind: 'zone', type: 'fuego', visual: 'fire', fx: 'fuego', r: 22, warn: 0.35, burst: 8, dur: 2.2, tick: 2.5, slow: 0.5, cd: 7 },
  llamarada: { name: 'Llamarada', kind: 'shot', type: 'fuego', proj: 'bigfire', fx: 'fuego', dmg: 24, speed: 150, r: 7, explode: 28, weight: 3, kb: 220, cd: 12 },

  pistolaAgua: { name: 'Pistola Agua', kind: 'shot', type: 'agua', proj: 'water', fx: 'agua', dmg: 6, speed: 240, r: 2.8, cd: 0.5 },
  burbuja: { name: 'Burbuja', kind: 'shot', type: 'agua', proj: 'bubble', fx: 'agua', dmg: 11, speed: 115, r: 6, bounces: 2, life: 3.5, weight: 2, cd: 2.4 },
  hidropulso: { name: 'Hidropulso', kind: 'shot', type: 'agua', proj: 'orb', fx: 'agua', dmg: 14, speed: 165, r: 6, explode: 18, stun: 0.3, weight: 2, cd: 2.6 },
  giroRapido: { name: 'Giro Rápido', kind: 'dash', type: 'agua', fx: 'agua', dmg: 8, speed: 270, time: 0.3, hits: 1, spin: true, kb: 140, cd: 0.9 },
  giroRapidoQ: { name: 'Giro Rápido', kind: 'dash', type: 'agua', fx: 'agua', dmg: 10, speed: 280, time: 0.3, hits: 3, spin: true, kb: 150, cd: 6 },
  cascada: { name: 'Cascada', kind: 'dash', type: 'agua', fx: 'agua', dmg: 13, speed: 290, time: 0.3, hits: 1, kb: 200, cd: 2.6 },
  hidrobomba: { name: 'Hidrobomba', kind: 'beam', type: 'agua', fx: 'agua', tick: 3.4, width: 10, dur: 1.5, track: 1.5, cd: 14 },
  surf: { name: 'Surf', kind: 'wave', type: 'agua', fx: 'agua', dmg: 18, speed: 160, width: 150, kb: 240, cd: 9 },
  rayoHielo: { name: 'Rayo Hielo', kind: 'beam', type: 'agua', fx: 'hielo', tick: 2.8, width: 8, dur: 1.2, track: 1.6, freeze: true, slow: 0.7, cd: 13 },
  torbellino: { name: 'Torbellino', kind: 'zone', type: 'agua', visual: 'whirl', fx: 'agua', r: 32, warn: 0.3, burst: 6, dur: 2.6, tick: 2.5, pull: 70, cd: 8 },
  hiperrayo: { name: 'Hiperrayo', kind: 'beam', type: 'normal', fx: 'hiper', tick: 6, width: 15, dur: 0.9, charge: 0.6, recharge: 1.0, track: 0.8, cd: 15 },
  mordisco: { name: 'Mordisco', kind: 'melee', type: 'normal', fx: 'normal', range: 22, dmg: 9, kb: 120, stun: 0.2, cd: 0.7 },

  latigoCepa: { name: 'Látigo Cepa', kind: 'melee', type: 'planta', fx: 'planta', range: 26, dmg: 8, kb: 110, cd: 0.6 },
  hojaAfilada: { name: 'Hoja Afilada', kind: 'shot', type: 'planta', proj: 'needle', fx: 'planta', dmg: 5, speed: 230, r: 2.2, count: 3, spread: 0.25, cd: 1.4 },
  bombaGermen: { name: 'Bomba Germen', kind: 'shot', type: 'planta', proj: 'seed', fx: 'planta', dmg: 9, speed: 175, r: 3.5, count: 2, spread: 0.2, explode: 12, cd: 2.6 },
  drenadoras: { name: 'Drenadoras', kind: 'zone', type: 'planta', visual: 'vines', fx: 'planta', r: 16, warn: 0.4, burst: 5, dur: 2.5, tick: 2, root: 0.7, cd: 7 },
  plantaFeroz: { name: 'Planta Feroz', kind: 'zone', type: 'planta', visual: 'vines', fx: 'planta', r: 28, warn: 0.6, burst: 17, dur: 1.8, tick: 2, root: 1.0, cd: 10 },
  rayoSolar: { name: 'Rayo Solar', kind: 'beam', type: 'planta', fx: 'solar', tick: 5, width: 13, dur: 0.7, charge: 0.9, track: 0.6, cd: 14 },

  lenguetazo: { name: 'Lengüetazo', kind: 'melee', type: 'fantasma', fx: 'fantasma', range: 20, dmg: 8, stun: 0.3, kb: 80, cd: 0.7 },
  bolaSombra: { name: 'Bola Sombra', kind: 'shot', type: 'fantasma', proj: 'orb', fx: 'fantasma', dmg: 13, speed: 125, r: 5, homing: 2.4, life: 3.5, weight: 2, cd: 2.6 },
  golpeFantasma: { name: 'Golpe Fantasma', kind: 'teleport', type: 'fantasma', fx: 'fantasma', vanish: true, slashes: 3, dmg: 9, last: 13, cd: 8 },
  hipnosis: { name: 'Hipnosis', kind: 'ring', type: 'psiquico', fx: 'fantasma', count: 2, dmg: 2, sleep: true, stun: 1.6, speed: 115, maxR: 75, cd: 13 },

  placaje: { name: 'Placaje', kind: 'dash', type: 'normal', fx: 'normal', dmg: 8, speed: 250, time: 0.18, kb: 140, cd: 0.8 },
  golpeCuerpo: { name: 'Golpe Cuerpo', kind: 'quake', type: 'normal', fx: 'normal', dmg: 14, stun: 0.4, maxR: 50, cd: 3.2 },
  golpeCuerpoDash: { name: 'Golpe Cuerpo', kind: 'dash', type: 'normal', fx: 'normal', dmg: 14, speed: 260, time: 0.3, kb: 220, stun: 0.3, cd: 3 },
  terremoto: { name: 'Terremoto', kind: 'quake', type: 'roca', fx: 'roca', dmg: 20, stun: 0.7, maxR: 130, cd: 9 },
  gigaimpacto: { name: 'Gigaimpacto', kind: 'dash', type: 'normal', fx: 'hiper', dmg: 28, speed: 340, time: 0.45, kb: 300, stun: 0.4, recharge: 0.8, cd: 13 },
  rapidez: { name: 'Rapidez', kind: 'shot', type: 'normal', proj: 'star', fx: 'estrella', dmg: 5, speed: 190, r: 2.8, count: 3, spread: 0.35, homing: 1.8, cd: 2.2 },
  excavar: { name: 'Excavar', kind: 'fly', type: 'roca', fx: 'roca', dig: true, up: 1.0, dmg: 16, r: 22, cd: 7 },
  ultimoRecurso: { name: 'Último Recurso', kind: 'ring', type: 'normal', fx: 'estrella', count: 3, dmg: 9, speed: 150, maxR: 85, kb: 150, cd: 13 },

  destructor: { name: 'Destructor', kind: 'melee', type: 'normal', fx: 'hada', range: 18, dmg: 7, kb: 100, cd: 0.6 },
  vozCautivadora: { name: 'Voz Cautivadora', kind: 'shot', type: 'hada', proj: 'note', fx: 'hada', dmg: 10, speed: 145, r: 4, homing: 2.5, life: 3, cd: 2.2 },
  rodada: { name: 'Rodada', kind: 'dash', type: 'roca', fx: 'hada', dmg: 9, speed: 250, time: 0.35, hits: 3, spin: true, kb: 150, cd: 7 },
  canto: { name: 'Canto', kind: 'ring', type: 'hada', fx: 'hada', count: 3, dmg: 3, sleep: true, stun: 1.5, speed: 110, maxR: 80, cd: 13 },

  palmeo: { name: 'Palmeo', kind: 'melee', type: 'lucha', fx: 'aura', range: 20, dmg: 9, stun: 0.3, kb: 140, cd: 0.7 },
  esferaAural: { name: 'Esfera Aural', kind: 'shot', type: 'lucha', proj: 'orb', fx: 'aura', dmg: 12, speed: 155, r: 5, homing: 2.6, life: 3, weight: 2, cd: 2.4 },
  velocidadExtrema: { name: 'Velocidad Extrema', kind: 'dash', type: 'normal', fx: 'aura', dmg: 10, speed: 340, time: 0.25, hits: 3, kb: 160, cd: 7 },
  aBocajarro: { name: 'A Bocajarro', kind: 'teleport', type: 'lucha', fx: 'lucha', vanish: false, slashes: 5, dmg: 7, last: 12, cd: 12 },

  confusion: { name: 'Confusión', kind: 'shot', type: 'psiquico', proj: 'psy', fx: 'psiquico', dmg: 7, speed: 220, r: 3, cd: 0.6 },
  psicocorte: { name: 'Psicocorte', kind: 'shot', type: 'psiquico', proj: 'needle', fx: 'psiquico', dmg: 6, speed: 240, r: 2.4, count: 3, spread: 0.22, cd: 2.2 },
  bolaSombraQ: { name: 'Bola Sombra', kind: 'shot', type: 'fantasma', proj: 'orb', fx: 'fantasma', dmg: 16, speed: 130, r: 6, homing: 2.2, life: 3.5, weight: 2, cd: 6 },
  psiquico: { name: 'Psíquico', kind: 'zone', type: 'psiquico', visual: 'psy', fx: 'psiquico', r: 26, warn: 0.7, burst: 26, dur: 0.5, tick: 0, stun: 0.6, cd: 12 },
};

// --------------------------------------------------------------- Pokémon
// id: número en la Pokédex (sprites de PokeAPI). moves: [1, 2, ESPACIO, Q, E]
export const CREATURES = {
  pikachu: {
    name: 'PIKACHU', id: 25, type: 'electrico', cry: '¡Pika pika!',
    hp: 100, speed: 128, pow: 1.0, def: 0.92,
    moves: ['impactrueno', 'bolaVoltio', 'ataqueRapido', 'placajeElectrico', 'trueno'],
    boss: { id: 26, name: 'RAICHU' },
  },
  charmander: {
    name: 'CHARMANDER', id: 4, type: 'fuego', cry: '¡Char char!',
    hp: 100, speed: 118, pow: 1.02, def: 0.92,
    moves: ['ascuas', 'lanzallamas', 'esquivar', 'giroFuego', 'llamarada'],
    boss: { id: 10034, name: 'MEGA CHARIZARD X' },
  },
  squirtle: {
    name: 'SQUIRTLE', id: 7, type: 'agua', cry: '¡Squirtle!',
    hp: 110, speed: 110, pow: 0.98, def: 1.08,
    moves: ['pistolaAgua', 'burbuja', 'refugio', 'giroRapidoQ', 'hidrobomba'],
    boss: { id: 10036, name: 'MEGA BLASTOISE' },
  },
  bulbasaur: {
    name: 'BULBASAUR', id: 1, type: 'planta', cry: '¡Bulba bulba!',
    hp: 110, speed: 108, pow: 1.0, def: 1.04,
    moves: ['latigoCepa', 'hojaAfilada', 'esquivar', 'drenadoras', 'rayoSolar'],
    boss: { id: 10033, name: 'MEGA VENUSAUR' },
  },
  charizard: {
    name: 'CHARIZARD', id: 6, type: 'fuego', cry: '¡ROAAAR!',
    hp: 130, speed: 112, pow: 1.15, def: 1.0,
    moves: ['ascuas', 'lanzallamas', 'vuelo', 'giroFuego', 'llamarada'],
    boss: { id: 10034, name: 'MEGA CHARIZARD X' },
  },
  blastoise: {
    name: 'BLASTOISE', id: 9, type: 'agua', cry: '¡Blastoise!',
    hp: 140, speed: 96, pow: 1.08, def: 1.18,
    moves: ['pistolaAgua', 'hidropulso', 'refugio', 'surf', 'hidrobomba'],
    boss: { id: 10036, name: 'MEGA BLASTOISE' },
  },
  venusaur: {
    name: 'VENUSAUR', id: 3, type: 'planta', cry: '¡Venusaur!',
    hp: 140, speed: 94, pow: 1.08, def: 1.15,
    moves: ['hojaAfilada', 'bombaGermen', 'esquivar', 'plantaFeroz', 'rayoSolar'],
    boss: { id: 10033, name: 'MEGA VENUSAUR' },
  },
  gengar: {
    name: 'GENGAR', id: 94, type: 'fantasma', cry: '¡Gengar, je je je!',
    hp: 108, speed: 124, pow: 1.12, def: 0.9,
    moves: ['lenguetazo', 'bolaSombra', 'esquivar', 'golpeFantasma', 'hipnosis'],
    boss: { id: 10038, name: 'MEGA GENGAR' },
  },
  snorlax: {
    name: 'SNORLAX', id: 143, type: 'normal', cry: '¡Snoooorlax…!',
    hp: 175, speed: 80, pow: 1.15, def: 1.12,
    moves: ['placaje', 'golpeCuerpo', 'descanso', 'terremoto', 'gigaimpacto'],
    boss: { id: 143, name: 'SNORLAX GIGANTE' },
  },
  lapras: {
    name: 'LAPRAS', id: 131, type: 'agua', cry: '¡A surfear!',
    hp: 150, speed: 98, pow: 1.05, def: 1.1,
    moves: ['pistolaAgua', 'golpeCuerpoDash', 'esquivar', 'surf', 'rayoHielo'],
    boss: { id: 131, name: 'LAPRAS GIGANTE' },
  },
  gyarados: {
    name: 'GYARADOS', id: 130, type: 'agua', cry: '¡GYAAARADOS!',
    hp: 150, speed: 104, pow: 1.18, def: 1.02,
    moves: ['mordisco', 'cascada', 'esquivar', 'torbellino', 'hiperrayo'],
    boss: { id: 10041, name: 'MEGA GYARADOS' },
  },
  starmie: {
    name: 'STARMIE', id: 121, type: 'agua', cry: '¡Hiaaa!',
    hp: 105, speed: 130, pow: 1.02, def: 0.95,
    moves: ['giroRapido', 'pistolaAgua', 'esquivar', 'rapidez', 'rayoHielo'],
    boss: { id: 121, name: 'STARMIE GIGANTE' },
  },
  eevee: {
    name: 'EEVEE', id: 133, type: 'normal', cry: '¡Eevee!',
    hp: 104, speed: 124, pow: 1.0, def: 0.98,
    moves: ['placaje', 'rapidez', 'ataqueRapido', 'excavar', 'ultimoRecurso'],
    boss: { id: 700, name: 'SYLVEON' },
  },
  jigglypuff: {
    name: 'JIGGLYPUFF', id: 39, type: 'hada', cry: '¡Jiggly… puuuff!',
    hp: 125, speed: 100, pow: 0.95, def: 0.95,
    moves: ['destructor', 'vozCautivadora', 'esquivar', 'rodada', 'canto'],
    boss: { id: 40, name: 'WIGGLYTUFF' },
  },
  lucario: {
    name: 'LUCARIO', id: 448, type: 'lucha', cry: '¡Siento tu aura!',
    hp: 112, speed: 122, pow: 1.12, def: 0.98,
    moves: ['palmeo', 'esferaAural', 'esquivar', 'velocidadExtrema', 'aBocajarro'],
    boss: { id: 10059, name: 'MEGA LUCARIO' },
  },
  mewtwo: {
    name: 'MEWTWO', id: 150, type: 'psiquico', cry: '¡Soy el más fuerte!',
    hp: 120, speed: 120, pow: 1.2, def: 1.0,
    moves: ['confusion', 'psicocorte', 'teletransporte', 'bolaSombraQ', 'psiquico'],
    boss: { id: 10044, name: 'MEGA MEWTWO Y' },
  },
};

export const ROSTER = Object.keys(CREATURES);

export function allSpriteIds() {
  const set = new Set();
  for (const c of Object.values(CREATURES)) {
    set.add(c.id);
    set.add(c.boss.id);
  }
  return [...set];
}

export const KEY_LABELS = ['1', '2', 'ESP', 'Q', 'E'];

export const DIFFICULTY = {
  facil: { label: 'IA FÁCIL', color: '#4cc44a', reaction: 0.6, dodge: 0.05, lead: 0, aggression: 0.3, aimError: 0.35, ultDelay: 4, dmgMult: 0.65 },
  normal: { label: 'IA NORMAL', color: '#3fa7ff', reaction: 0.35, dodge: 0.3, lead: 0.4, aggression: 0.55, aimError: 0.16, ultDelay: 1.5, dmgMult: 0.85 },
  dificil: { label: 'IA DIFÍCIL', color: '#ff7a2f', reaction: 0.2, dodge: 0.6, lead: 0.8, aggression: 0.75, aimError: 0.07, ultDelay: 0.6, dmgMult: 1 },
  jefe: { label: 'IA JEFE', color: '#e0399a', reaction: 0.13, dodge: 0.75, lead: 1, aggression: 0.85, aimError: 0.03, ultDelay: 0.2, dmgMult: 1.1 },
};

export const ARENAS = ['piscina', 'lago', 'noche'];

export const TOURNAMENT_DIFFICULTY = ['facil', 'normal', 'dificil', 'jefe'];

export const GAME_NAME = 'POKÉ WORLD CHAMPIONSHIP';
export const LEAGUE_NAME = 'CAMPEONATO MUNDIAL';
