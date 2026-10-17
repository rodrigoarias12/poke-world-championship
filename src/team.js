// El último equipo que usaste queda guardado en este celular,
// así EN LÍNEA puede buscar rival sin pedirte que armes uno de nuevo.
import { ROSTER } from './data.js';

const KEY = 'pokechamp-equipo';

export function randomTeam(exclude = []) {
  const pool = ROSTER.filter((k) => !exclude.includes(k));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export function loadTeam() {
  try {
    const team = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(team) && team.length === 3 && team.every((k) => ROSTER.includes(k)) && new Set(team).size === 3) return team;
  } catch { /* sin almacenamiento */ }
  const team = randomTeam();
  saveTeam(team);
  return team;
}

export function saveTeam(team) {
  try {
    localStorage.setItem(KEY, JSON.stringify(team));
  } catch { /* sin almacenamiento */ }
}
