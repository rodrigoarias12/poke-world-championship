# Poké World Championship

Juego de combates Pokémon para el navegador: arma un equipo de 3, elige la dificultad
y pelea en una arena acuática en tiempo real. Tiene un torneo de 4 rondas con un
jefe Mega en la final. Nació para jugar en familia, inspirado en los videos de
"Pokémon Arena" de Big Kid Nation.

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
