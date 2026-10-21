# Poké World Championship

Juego de combates Pokémon para el navegador: arma un equipo de 3 entre 28 Pokémon, elige
la cancha y la dificultad y pelea en tiempo real. También hay un Modo Aventura (caminar por
Kanto) y una Batalla Campal (cinco Pokémon en un pueblo, gana el último). Hay 11 canchas:
tres arenas acuáticas y los 8 gimnasios de Kanto (Brock, Misty, Lt. Surge, Erika, Koga,
Sabrina, Blaine y Giovanni). El torneo pasa por tres gimnasios, cada líder con su Pokémon
estrella, y termina con un jefe Mega. Nació para jugar en familia, inspirado en los videos
de "Pokémon Arena" de Big Kid Nation.

**Jugar:** https://pokechampions.vercel.app

## Cómo se juega

| Tecla | Acción |
| --- | --- |
| W A S D (o flechas) | Moverse |
| 1 | Ataque rápido |
| 2 | Ataque fuerte |
| ESPACIO | Esquivar (o volar) |
| Q | Ataque especial |
| E | Ataque definitivo |
| R | ¡GIGAMAX! (una vez por pelea, cuando se llena el anillo rojo) |
| M / N / V | Música / sonidos / relator |

En tableta o celular aparecen un joystick y botones en pantalla (el botón GIGA es el
Gigamax). Los ataques apuntan solos al rival.

**Gigamax:** pegando y recibiendo golpes se llena el anillo rojo del retrato. Al usarlo, tu
Pokémon se vuelve gigante por 14 segundos: pega más fuerte, recibe menos daño y su ataque
definitivo pasa a ser su ataque Gigamax (Gigallamarada, Gigatronada…). Pikachu, Charizard,
Blastoise, Venusaur, Gengar, Snorlax, Lapras y Eevee tienen forma Gigamax; los demás hacen
Dinamax.

## Modo Aventura

Caminá por Kanto como en Pokémon Rojo y Azul, pero cada encuentro se pelea en tiempo real.
Empezás en tu casa de PUEBLO PALETA, elegís tu inicial en el laboratorio del PROF. OAK,
peleás con tu rival AZUL y salís a la RUTA 1, donde los Pokémon salvajes caminan por el
pasto alto: tocás uno y empieza la pelea. Cuando queda **MAREADO** (estrellitas), la Poké
Ball (tecla R o el botón) lo atrapa seguro. Los entrenadores te ven y te desafían, y en
CIUDAD VERDE la enfermera Joy cura a tu equipo. Hay niveles, experiencia, equipo de hasta
6 y guardado automático. Si perdés, volvés a casa con el equipo curado.

Controles: flechas para caminar, ESPACIO para hablar, ESC para el menú. En el celular:
joystick, A y B. El plan completo está en `docs/PLAN-AVENTURA.md`.

## Batalla Campal

Como un battle royale: cinco Pokémon (vos y hasta 4 bots) en un PUEBLO PALETA grande, todos
contra todos, y gana el último en pie. La **NIEBLA MORADA** de Gengar achica el pueblo de a
poco (en las primeras fases no elimina a nadie; te deja con un poquito de vida). Por el mapa
aparecen premios: **Baya Aranja** (cura), **Caramelo Raro** (más fuerza) y **Deportivas** (más
rapidez). En el pasto alto no te ven de lejos. Los ataques apuntan solos al rival más cercano
que tengas en pantalla, y los árboles y las casas frenan los disparos.

Los bots tienen tres niveles y nunca atacan de a dos a la misma persona. Si quedás afuera
podés **MIRAR** el resto de la partida. Por ahora es contra bots en un solo dispositivo; el
plan (incluida la versión en línea para varios celulares) está en `docs/PLAN-CAMPAL.md`.

## Jugar en línea

**JUGAR EN LÍNEA** te junta solo con otra persona que esté buscando, sin códigos ni
salas: usa tu último equipo (lo puedes cambiar mientras busca), aparece la pantalla VS y
arranca la pelea. Al terminar puedes pedir la revancha o buscar otro rival.

Para jugar con alguien en particular, **INVITAR A UN AMIGO** da un link (o un código de
4 números para **TENGO UN CÓDIGO**). Los dos celulares se conectan directo (WebRTC); ver
`docs/PLAN-MULTIJUGADOR.md`.

## Correrlo en tu compu

No hace falta instalar nada: es HTML y JavaScript sin compilar.

```bash
python3 servidor.py
```

Después abre http://localhost:5173 (en Mac también sirve el doble clic en `Jugar.command`).
Funciona mejor en Chrome, que anima los sprites y reproduce los gritos.

## De dónde salen los sprites, gritos y música

Nada de eso está en este repositorio: el juego lo carga en vivo desde proyectos abiertos.

- Sprites animados y gritos: [PokeAPI/sprites](https://github.com/PokeAPI/sprites) y [PokeAPI/cries](https://github.com/PokeAPI/cries)
- Música de batalla: [Pokémon Showdown](https://pokemonshowdown.com)
- Música propia opcional: ver `musica/LEEME.txt`

## Aviso

Proyecto de fans, sin fines de lucro. No está afiliado a Nintendo, The Pokémon Company
ni Game Freak. Pokémon y los nombres de sus personajes son marcas de sus respectivos dueños.
