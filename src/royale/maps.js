// Mapa de la BATALLA CAMPAL: un Pueblo Paleta grande (40x28 baldosas de 16).
// Mismos caracteres que la aventura (ver src/adventure/maps.js):
//   . pasto  , pasto alto (para esconderse)  = camino  ~ agua  f flores
//   T árbol  F cerca  S cartel  R/U/K techos  H/O paredes  W ventana  D puerta
// y además:  1..5 salidas de cada jugador   * lugar donde aparecen premios
// (el piso debajo de una marca es la baldosa de su izquierda).

export const ROYALE_MAPS = {
  paleta: {
    name: 'PUEBLO PALETA',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTT...........,,,,,==,,,,,...........TTT',
      'TT............,,*,,=1,,*,,............TT',
      'T...RRRR......,,,,,==,,,,,......UUUU...T',
      'T...RRRR.......,,,,==,,,,.......UUUU...T',
      'T...WHHW...TT...,,,==,,,...TT...WHHW...T',
      'T...HDHH.*.TT......==......TT.*.HDHH...T',
      'T....=.............==............=.....T',
      'T....=============================.....T',
      'T..................==..................T',
      'T.fffff.5.....FFF..==..FFF.....2.,,,,,.T',
      'T.ff*ff.......Fff.S==..ffF.......,,*,,.T',
      'T.FFFFF........f...==...f........,,,,,.T',
      'T......==========================......T',
      'T......=============*============......T',
      'T..............f...==...f..............T',
      'T..,,,,,,.TT..Fff..==..ffF..TT.,,,,,,..T',
      'T..,,*,,,.TT..FFF..==..FFF..TT.,,,*,,..T',
      'T..................==........KKKKKK....T',
      'T...~~~~~~.,,......==........KKKKKK....T',
      'T..~~~~~~~~,*......==......*.OWOOWO....T',
      'T..~~~~~~~~,,......==........OODOOOS...T',
      'T..~~~~~~~~...,,,,,==,,,,,...ff=f*f....T',
      'T...~~~~~~..4.,,*,,==,,*,,.3FFF=FFFF...T',
      'T.....*.......,,,,,=============.......T',
      'TT............,,,,,==,,,,,............TT',
      'TTT................==................TTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
  },
};

// Separa las marcas (salidas y premios) del dibujo del mapa
export function parseRoyaleMap(id) {
  const def = ROYALE_MAPS[id];
  if (!def) throw new Error(`Mapa desconocido: ${id}`);
  if (def.parsed) return def.parsed;
  const h = def.rows.length;
  const w = def.rows[0].length;
  const spawns = [];
  const items = [];
  const rows = def.rows.map((row, y) => {
    if (row.length !== w) throw new Error(`${id}: la fila ${y} mide ${row.length} y no ${w}`);
    return [...row].map((ch, x) => {
      if (/[1-5*]/.test(ch)) {
        if (ch === '*') items.push({ x, y });
        else spawns[Number(ch) - 1] = { x, y };
        const left = row[x - 1];
        return left && !/[1-5*]/.test(left) ? left : '.';
      }
      return ch;
    }).join('');
  });
  def.parsed = { id, name: def.name, rows, w, h, spawns, items, interior: false };
  return def.parsed;
}
