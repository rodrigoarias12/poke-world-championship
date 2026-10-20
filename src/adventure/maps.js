// Mapas del capítulo 1 (parte 1): Pueblo Paleta → Ruta 1 → Ciudad Verde.
// Cada fila es una tira de baldosas (1 carácter = 1 baldosa de 16x16).
// Exteriores: . pasto  , pasto alto  = camino  ~ agua  f flores  T árbol  F cerca
//   L cornisa (solo se baja)  S cartel  R/U/K techos  H/O/g paredes  W ventana  D puerta
//   C cartel del Centro  M cartel de la Tienda  G cartel del gimnasio
// Interiores: # pared  . piso  = mostrador  B estante  P PC  V tele  b cama  t mesa
//   o mesa con Poké Ball  p planta  h máquina de curar  m alfombra de salida
// Los números marcan personas (el piso debajo es el de su izquierda).

const CASA = ['########', '#BV..Pb#', '#......#', '#..tt..#', '#..tt1.#', '#......#', '#p....p#', '###mm###'];

export const MAPS = {
  pueblo: {
    name: 'PUEBLO PALETA',
    rows: [
      'TTTTTTTTT==TTTTTTTTT',
      'T........==........T',
      'T.RRRR...==...UUUU.T',
      'T.RRRR...==...UUUU.T',
      'T.WHHW...==...WHHW.T',
      'T.HDHH...==...HDHH.T',
      'T..=.....==....=...T',
      'T..=============...T',
      'T......S.==........T',
      'T........==..1.....T',
      'T.ffff...==.KKKKKK.T',
      'T.ffff...==.KKKKKK.T',
      'T.FFFF...==.OWOOWO.T',
      'T........==.OODOOO.T',
      'T........======.S..T',
      'T.~~~~~~...........T',
      'T.~~~~~~...........T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    doors: [
      { x: 3, y: 5, to: 'casa', tx: 3, ty: 6 },
      { x: 15, y: 5, to: 'casaAzul', tx: 3, ty: 6 },
      { x: 14, y: 13, to: 'lab', tx: 4, ty: 8 },
    ],
    edges: { n: { to: 'ruta1', dx: 0 } },
    npcs: { 1: { look: 'joven2', text: ['¡El PROF. OAK está en su laboratorio!', 'Es el edificio grande de abajo a la derecha.'] } },
    signs: [
      { x: 7, y: 8, text: ['PUEBLO PALETA', 'Un pueblo tranquilo donde empiezan las aventuras.'] },
      { x: 16, y: 14, text: ['LABORATORIO POKÉMON DEL PROF. OAK'] },
    ],
  },

  casa: {
    name: 'TU CASA',
    interior: true,
    floor: 'wood',
    rows: CASA,
    exit: { to: 'pueblo', x: 3, y: 6 },
    npcs: { 1: { look: 'mama', script: 'mama' } },
  },

  casaAzul: {
    name: 'CASA DE AZUL',
    interior: true,
    floor: 'wood',
    rows: CASA,
    exit: { to: 'pueblo', x: 15, y: 6 },
    npcs: { 1: { look: 'hermana', text: ['¡Hola! Soy la hermana de AZUL.', 'Mi hermano siempre quiere ganarle a todo el mundo…'] } },
  },

  lab: {
    name: 'LABORATORIO DE OAK',
    interior: true,
    floor: 'tiles',
    rows: ['##########', '#PP....BB#', '#...1....#', '#.....ooo#', '#.2......#', '#........#', '#BBB..BBB#', '#........#', '#p......p#', '####mm####'],
    exit: { to: 'pueblo', x: 14, y: 14 },
    npcs: {
      1: { look: 'oak', script: 'oak' },
      2: { look: 'rival', script: 'rival', hideIf: 'rivalDone' },
    },
    // Las tres Poké Balls de la mesa
    balls: [{ x: 6, y: 3, key: 'bulbasaur' }, { x: 7, y: 3, key: 'charmander' }, { x: 8, y: 3, key: 'squirtle' }],
  },

  ruta1: {
    name: 'RUTA 1',
    rows: [
      'TTTTTTTTT==TTTTTTTTT',
      'TT.......==.......TT',
      'TT.,,,,,.==..ffff.TT',
      'TT.,,,,,.==.......TT',
      'TT.,,,,,.==..S....TT',
      'TT.......==.......TT',
      'TT.......======...TT',
      'TT.......======...TT',
      'TT...........==...TT',
      'TT.,,,,,,,,..==,,,TT',
      'TT.,,,,,,,,..==,,,TT',
      'TT.,,,,,,,,..==,,,TT',
      'TT.,,,,,,,,..==,,,TT',
      'TT.,,,,,,,,..==,,,TT',
      'TT......1....==...TT',
      'TT...........==...TT',
      'TT..===========...TT',
      'TT..===========...TT',
      'TT..==............TT',
      'TT..==.LLLLLLLLLLLTT',
      'TT..==..,,,,,,,,,.TT',
      'TT..==..,,,,,,,,,.TT',
      'TT..==..,,,,,,,,,.TT',
      'TT..==..,,,,,,,,,.TT',
      'TT..==.2,,,,,,,,,.TT',
      'TT..==............TT',
      'TT..=======.......TT',
      'TT..=======.......TT',
      'TT.......==LLLLLLLTT',
      'TT.......==.,,,,,,TT',
      'TT,,,,,,.==.,,,,,,TT',
      'TT,,,,,,.==3,,,,,,TT',
      'TT,,,,,,.==.,,,,,,TT',
      'TT,,,,,,.==.,,,,,,TT',
      'TT.......==.......TT',
      'TTTTTTTTT==TTTTTTTTT',
    ],
    edges: { s: { to: 'pueblo', dx: 0 }, n: { to: 'verde', dx: 4 } },
    npcs: {
      1: {
        look: 'joven', dir: 'down',
        trainer: { id: 'tito', name: 'JOVEN TITO', team: [['jigglypuff', 4]], sight: 3, before: ['¡Eh, vos! ¡Mirame cuando te hablo!', '¡A pelear!'], after: ['¡Uf! Tu Pokémon es muy fuerte.'] },
      },
      2: {
        look: 'joven2', dir: 'down',
        trainer: { id: 'leo', name: 'JOVEN LEO', team: [['eevee', 5]], sight: 3, before: ['¡Mi EEVEE es el más rápido de la ruta!'], after: ['Voy a entrenar más…'] },
      },
      3: { look: 'vendedor', script: 'regalo' },
    },
    signs: [{ x: 13, y: 4, text: ['RUTA 1', 'PUEBLO PALETA ↔ CIUDAD VERDE'] }],
    // Pokémon salvajes que caminan por el pasto alto: [especie, peso, nivel mín, nivel máx]
    wild: { count: 5, table: [['eevee', 35, 3, 4], ['jigglypuff', 30, 3, 5], ['pikachu', 20, 3, 4], ['psyduck', 15, 4, 5]] },
    arena: 'ruta',
  },

  verde: {
    name: 'CIUDAD VERDE',
    rows: [
      'TTTTTTTTTTTTT==TTTTTTTTTTTTT',
      'T............==............T',
      'T............==...KKKKKK...T',
      'T............==...KKKKKK...T',
      'T.~~~~~......==...gggGgg...T',
      'T.~~~~~......==...gggDgg...T',
      'T.~~~~~......=========..S..T',
      'T.~~~~~......==............T',
      'T............==....1.......T',
      'T..ffff......==.......ffff.T',
      'T............==............T',
      'T....RRRRR...==..UUUU......T',
      'T....RRRRR...==..UUUU......T',
      'T....WHCHW...==..HMWH......T',
      'T....HHDHH...==..HDHH......T',
      'T......============........T',
      'T............==............T',
      'T.RRRR.......==.....TTT....T',
      'T.RRRR.......==.....TTT....T',
      'T.WHHW.......==..2.........T',
      'T.HDHH...S...==............T',
      'T..============............T',
      'T............==............T',
      'TTTTTTTTTTTTT==TTTTTTTTTTTTT',
    ],
    doors: [
      { x: 7, y: 14, to: 'centro', tx: 5, ty: 6 },
      { x: 18, y: 14, closed: ['La TIENDA POKÉMON está cerrada por inventario.', '¡Volvé pronto!'] },
      { x: 21, y: 5, closed: ['El GIMNASIO está cerrado.', 'Dicen que el líder anda de viaje…'] },
      { x: 3, y: 20, closed: ['Está cerrado. No hay nadie en casa.'] },
    ],
    edges: { s: { to: 'ruta1', dx: -4 }, n: { blocked: ['El camino al norte todavía está en obras.', '¡Llega en el capítulo 2!'] } },
    npcs: {
      1: { look: 'joven', text: ['El gimnasio de CIUDAD VERDE siempre está cerrado.', '¿Quién será el líder?'] },
      2: { look: 'cazabichos', text: ['¡Dicen que en el bosque del norte hay PIKACHU!'] },
    },
    signs: [
      { x: 24, y: 6, text: ['GIMNASIO POKÉMON DE CIUDAD VERDE', 'Líder: ???'] },
      { x: 9, y: 20, text: ['CIUDAD VERDE', 'La ciudad de los bosques eternos.'] },
    ],
  },

  centro: {
    name: 'CENTRO POKÉMON',
    interior: true,
    floor: 'tiles',
    rows: ['############', '#P...hh...p#', '#....1.....#', '#..======..#', '#..........#', '#tt......tt#', '#p........p#', '#####mm#####'],
    exit: { to: 'verde', x: 7, y: 15 },
    npcs: { 1: { look: 'joy', script: 'joy' } },
  },
};

// Prepara un mapa: tamaño, personas en su lugar y piso debajo de ellas
export function parseMap(id) {
  const def = MAPS[id];
  if (!def) throw new Error(`Mapa desconocido: ${id}`);
  if (def.parsed) return def.parsed;
  const h = def.rows.length;
  const w = def.rows[0].length;
  const people = [];
  const rows = def.rows.map((row, y) => {
    if (row.length !== w) throw new Error(`${id}: la fila ${y} mide ${row.length} y no ${w}`);
    return [...row].map((ch, x) => {
      if (/\d/.test(ch)) {
        const npc = def.npcs?.[ch];
        if (!npc) throw new Error(`${id}: la persona ${ch} en ${x},${y} no está definida`);
        people.push({ ...npc, n: ch, x, y });
        const left = row[x - 1];
        return left && !/\d/.test(left) ? left : def.interior ? '.' : '.';
      }
      return ch;
    }).join('');
  });
  def.parsed = { id, ...def, rows, w, h, people };
  return def.parsed;
}

export function mapIds() {
  return Object.keys(MAPS);
}
