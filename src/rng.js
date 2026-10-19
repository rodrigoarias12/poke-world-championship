// Azar solo para lo que se ve (partículas, chispas, temblores de pantalla).
// Va aparte del azar de la pelea, así sumar o cambiar efectos nunca cambia
// cómo se desarrolla un combate.
let s = 0x9e3779b9;

export function fxRandom() {
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  return (s >>> 0) / 4294967296;
}
