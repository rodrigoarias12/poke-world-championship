// Personajes del mapa (10x14 + contorno = 12x16), dibujados como sellos de
// texto igual que los líderes de gimnasio de art.js.
import { buildSprite } from '../art.js';

const PLAYER_ROWS = {
  down: ['...hhhh...', '..hhwwhh..', '.hhhwwhhh.', '.vvvvvvvv.', '.kssssssk.', '.ksessesk.', '...ssss...', '.rrrrrrrr.', 'rrrrvvrrrr', 'rrrrvvrrrr', 's.bbbbbb.s', '..bbbbbb..', '..bb..bb..', '..nn..nn..'],
  downStep: ['...hhhh...', '..hhwwhh..', '.hhhwwhhh.', '.vvvvvvvv.', '.kssssssk.', '.ksessesk.', '...ssss...', '.rrrrrrrr.', 'rrrrvvrrrr', 'rrrrvvrrrr', 's.bbbbbb.s', '..bbbbbb..', '..bb..nn..', '..nn......'],
  up: ['...hhhh...', '..hhhhhh..', '.hhhhhhhh.', '.hhhhhhhh.', '.kkkkkkkk.', '.kkkkkkkk.', '..kkkkkk..', '.rryyyyrr.', 'rrryyyyrrr', 'rrryyyyrrr', 's.bbbbbb.s', '..bbbbbb..', '..bb..bb..', '..nn..nn..'],
  upStep: ['...hhhh...', '..hhhhhh..', '.hhhhhhhh.', '.hhhhhhhh.', '.kkkkkkkk.', '.kkkkkkkk.', '..kkkkkk..', '.rryyyyrr.', 'rrryyyyrrr', 'rrryyyyrrr', 's.bbbbbb.s', '..bbbbbb..', '..bb..nn..', '..nn......'],
  right: ['...hhhh...', '..hhhhhh..', '..hhhhhwh.', '..hhhvvvvv', '..kksssss.', '..kkssses.', '...ksssss.', '...yrrrr..', '..yyrrrr..', '..yyrrsr..', '...bbbb...', '...bbbb...', '...bbbb...', '...nnnnn..'],
  rightStep: ['...hhhh...', '..hhhhhh..', '..hhhhhwh.', '..hhhvvvvv', '..kksssss.', '..kkssses.', '...ksssss.', '...yrrrr..', '..yyrrrrs.', '..yyrrrr..', '...bbbbb..', '..bbb.bb..', '.bb....bb.', '.nn....nn.'],
};

// La chica: pelo largo por los costados y otros colores
function girlRows(rows, dir) {
  if (dir.startsWith('up')) return rows.map((r, i) => (i === 7 ? 'krryyyyrrk' : r));
  if (dir.startsWith('right')) return rows.map((r, i) => (i === 7 ? '..kyrrrr..' : i === 8 ? '..kyrrrr..' : r));
  return rows.map((r, i) => (i === 6 ? '.k.ssss.k.' : i === 7 ? 'krrrrrrrrk' : r));
}

const LOOKS = {
  chico: { pal: { h: '#e8402c', v: '#a82a22', w: '#f4f4f4', k: '#2a2230', s: '#f8c890', e: '#1a1020', r: '#d84a3a', y: '#f0c040', b: '#3a5ec8', n: '#40303a' }, flat: 'ewk' },
  chica: { pal: { h: '#f4f4f4', v: '#e8508a', w: '#e8508a', k: '#7a4a2a', s: '#f8c890', e: '#1a1020', r: '#4aa8e8', y: '#f8f0f0', b: '#d8406a', n: '#40303a' }, flat: 'ew' },
};

const NPCS = {
  oak: { pal: { h: '#b4b4bc', s: '#f0c08a', e: '#1a1020', w: '#f2f2f2', r: '#a83a3a', p: '#8a7050', n: '#4a3a30' }, flat: 'e', rows: ['..hhhhhh..', '.hhhhhhhh.', '.hssssssh.', '.hsessesh.', '..ssssss..', '...ssss...', '.wwwrrwww.', 'wwwwrrwwww', 'wwwwrrwwww', 'swwwrrwwws', 's.wwppww.s', '..wppppw..', '..pp..pp..', '..nn..nn..'] },
  joy: { pal: { h: '#f088b0', w: '#f8f8f8', x: '#e03040', s: '#ffdbac', e: '#1a1020', d: '#f8a8c8', n: '#f8f8f8' }, flat: 'ex', rows: ['...wwww...', '..wwxxww..', '.hhhhhhhh.', 'hhsesseshh', 'hhsssssshh', 'hh.ssss.hh', '.hddddddh.', 'ddwwwwwwdd', 'sdwwwwwwds', 's.wwwwww.s', '..dddddd..', '..dddddd..', '..ss..ss..', '..nn..nn..'] },
  mama: { pal: { h: '#8a4a2a', w: '#f8f8f8', s: '#ffdbac', e: '#1a1020', d: '#f0b050', n: '#7a4a2a' }, flat: 'e', rows: ['...hhhh...', '..hhhhhh..', '.hhhhhhhh.', 'hhsesseshh', 'hhsssssshh', 'hh.ssss.hh', '.hddddddh.', 'ddwwwwwwdd', 'sdwwwwwwds', 's.wwwwww.s', '..dddddd..', '..dddddd..', '..ss..ss..', '..nn..nn..'] },
  hermana: { pal: { h: '#c07a3a', w: '#f8f8f8', s: '#ffdbac', e: '#1a1020', d: '#7ab0e0', n: '#5a3a2a' }, flat: 'e', rows: ['...hhhh...', '..hhhhhh..', '.hhhhhhhh.', 'hhsesseshh', 'hhsssssshh', 'hh.ssss.hh', '.hddddddh.', 'ddwwwwwwdd', 'sdwwwwwwds', 's.wwwwww.s', '..dddddd..', '..dddddd..', '..ss..ss..', '..nn..nn..'] },
  joven: { pal: { c: '#3a6ad8', v: '#24449a', k: '#5a3a20', s: '#f8c890', e: '#1a1020', t: '#f6c840', p: '#2a3a70', w: '#f4f4f4' }, flat: 'e', rows: ['...cccc...', '..cccccc..', '.vvvvvvvv.', '.kssssssk.', '.ksessesk.', '..ssssss..', '...ssss...', '.tttttttt.', 'tttttttttt', 's.tttttt.s', '..pppppp..', '..pp..pp..', '..ss..ss..', '..ww..ww..'] },
  joven2: { pal: { c: '#d83a3a', v: '#902020', k: '#5a3a20', s: '#f8c890', e: '#1a1020', t: '#58b8f0', p: '#2a3a70', w: '#f4f4f4' }, flat: 'e', rows: ['...cccc...', '..cccccc..', '.vvvvvvvv.', '.kssssssk.', '.ksessesk.', '..ssssss..', '...ssss...', '.tttttttt.', 'tttttttttt', 's.tttttt.s', '..pppppp..', '..pp..pp..', '..ss..ss..', '..ww..ww..'] },
  cazabichos: { pal: { m: '#f4f4f4', a: '#ecd078', v: '#c09848', n: '#8a5a30', s: '#f8c890', e: '#1a1020', w: '#f4f4f4', g: '#4a9a3a', b: '#5a4030' }, flat: 'em', rows: ['.......mmm', '...aaa.mmm', '..aaaaa.n.', '.vvvvvvvn.', '..ssssssn.', '..sessesn.', '...ssss.n.', '..wwwwwwn.', '.wwwwwwws.', 's.wwwwww..', '..gggggg..', '..gg..gg..', '..ss..ss..', '..bb..bb..'] },
  rival: { pal: { h: '#b0703a', s: '#f8c890', e: '#1a1020', p: '#7a50c0', y: '#f2c84a', b: '#4a4a5a', n: '#2a2a30' }, flat: 'ey', rows: ['.h.h.hh.h.', '.hhhhhhhh.', 'hhhhhhhhhh', '.hssssssh.', '.hsessesh.', '..ssssss..', '...ssss...', '.pppyyppp.', 'pppppppppp', 's.pppppp.s', '..bbbbbb..', '..bbbbbb..', '..bb..bb..', '..nn..nn..'] },
  vendedor: { pal: { c: '#4cc44a', v: '#2f8a2c', k: '#3a2a1a', s: '#f8c890', e: '#1a1020', t: '#f4f4f4', p: '#3a5ec8', w: '#2a2a30' }, flat: 'e', rows: ['...cccc...', '..cccccc..', '.vvvvvvvv.', '.kssssssk.', '.ksessesk.', '..ssssss..', '...ssss...', '.tttttttt.', 'tttttttttt', 's.tttttt.s', '..pppppp..', '..pp..pp..', '..ss..ss..', '..ww..ww..'] },
};

const cache = new Map();

function build(pal, flat, rows) {
  return buildSprite(10, 14, pal, flat, (p) => p.stamp(0, 0, rows));
}

const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

// Cuadros del protagonista: { down:[quieto, paso, quieto, paso espejado], up:[…], left:[…], right:[…] }
export function playerSprites(look = 'chico') {
  const key = `player:${look}`;
  if (cache.has(key)) return cache.get(key);
  const L = LOOKS[look] || LOOKS.chico;
  const rows = (name) => (look === 'chica' ? girlRows(PLAYER_ROWS[name], name) : PLAYER_ROWS[name]);
  const mk = (r) => build(L.pal, L.flat, r);
  const out = {
    down: [mk(rows('down')), mk(rows('downStep')), mk(rows('down')), mk(mirror(rows('downStep')))],
    up: [mk(rows('up')), mk(rows('upStep')), mk(rows('up')), mk(mirror(rows('upStep')))],
    right: [mk(rows('right')), mk(rows('rightStep')), mk(rows('right')), mk(rows('rightStep'))],
    left: [mk(mirror(rows('right'))), mk(mirror(rows('rightStep'))), mk(mirror(rows('right'))), mk(mirror(rows('rightStep')))],
  };
  cache.set(key, out);
  return out;
}

// Personaje fijo (siempre de frente)
export function npcSprite(kind) {
  const key = `npc:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const N = NPCS[kind] || NPCS.joven;
  const img = build(N.pal, N.flat, N.rows);
  cache.set(key, img);
  return img;
}
