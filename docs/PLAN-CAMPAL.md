# Plan: Batalla Campal

Objetivo: un modo tipo battle royale. Entre 3 y 5 Pokémon en un PUEBLO PALETA grande, todos contra todos y en el mismo mapa, en tiempo real. Una niebla achica el pueblo y gana el último en pie. Los lugares vacíos los ocupan bots.

Cómo se armó: dos estudios en paralelo, uno de arquitectura sobre el código real y otro de diseño de juego para chicos. Después una revisión de "CTO" eligió entre las propuestas, revisó el código y recortó el alcance. Decisiones del usuario: todos en el mismo mapa (sin pantalla de pelea aparte) y cada jugador con un solo Pokémon.

## Decisiones

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Mapa | Pueblo Paleta de 40x28 baldosas con las baldosas de la aventura. Tiene 5 salidas a 12 baldosas del centro y 15 lugares de premios. Las 838 baldosas que se pisan están conectadas. | Se reconoce y no hace falta dibujar nada nuevo |
| Choques | Pies de radio fijo (5) contra las baldosas, avanzando de a pasos de 4 | Así Snorlax y Onix pasan por pasillos de una baldosa y nada atraviesa un árbol aunque vaya rápido |
| Qué frena qué | Los árboles, las casas y los carteles frenan el paso y los disparos. Las cercas y el agua frenan el paso pero se dispara por encima. | Fácil de entender |
| Apuntar | Al rival más cercano dentro de la pantalla (150x82 alrededor), con preferencia por el que ya tenías. Si no hay nadie, hacia donde caminás. | Nadie recibe un golpe de alguien que no ve |
| Niebla | 5 fases: el círculo pasa de 25 baldosas a 14, 9, 5, 3 y 0. El daño va de 2% a 15% de la vida por segundo. En las fases 1 y 2 no elimina (te deja en 10%). | Que la nena no quede afuera por la niebla al principio |
| Equilibrio | Vida = (vida+130)/2 × 2.5, poder = (poder+1.08)/2, defensa = (def+1.02)/2. Rayos de 9 baldosas como mucho que se cortan en los árboles. Terremoto, Surf y anillos llegan a 80 de radio, y desde el segundo golpeado pegan ×0.7. Dormir dura 1 s y después hay 4 s en los que no se vuelve a dormir. | En un todos contra todos los tanques y los ataques de área ganarían siempre |
| Pausas | Nada pausa el juego: el ataque definitivo es un cartel abajo (solo el tuyo), sin golpe congelado ni zoom. Los sonidos, temblores y destellos solo se activan si pasan cerca de tu cámara. | Con 5 Pokémon, las pausas y temblores de los demás serían un caos |
| Gigamax | Apagado en la campal | Cinco gigantes y la pausa de transformación no entran en este modo |
| Premios | Baya Aranja (+30% vida), Caramelo Raro (+25% daño por 15 s) y Deportivas (+30% velocidad por 12 s). Hay 6 al empezar y después 1 cada 12 s dentro del próximo círculo, con tope de vivos+2. Cada eliminado deja una baya. | Pocos y fáciles de entender. Defensa X no entró porque no se nota. |
| Pasto alto | No te ven a más de 3 baldosas (ni en el minimapa, ni para apuntar). Atacar te deja a la vista 1.5 s. La misma regla vale para bots y personas. | "El pasto te esconde" se entiende solo |
| Bots | Deciden cada 0.25–0.6 s entre ZONA, HUIR, PELEAR, JUNTAR y EXPLORAR. Caminan con un mapa de distancias. La pelea la maneja la IA de siempre. | Reusan todo lo que ya pelea bien |
| Justicia con chicos | Regla de la ficha: a cada persona la ataca un solo bot por vez (dos si quedan 3 o menos). La suelta a los 6 s y la persona respira 3 s. Los bots le pegan a las personas con el daño de su dificultad (65%, 85% o 100%). En FÁCIL y NORMAL no atacan a una persona dormida o aturdida. | Que nunca la "pandilleen" |
| Perder | Nunca dice "PERDISTE": dice "¡Quedaste 3º!" con MIRAR, ¡OTRA! y MENÚ. Al final hay un podio con los K.O. de cada uno. | Que se sienta bien igual |
| Código | Todo en `src/royale/`, cargado con `import()` dinámico. El núcleo solo suma ganchos en `Battle` cuya versión base es el código de siempre. | Las peleas de siempre quedan idénticas byte a byte |

## Ganchos en el núcleo

`Battle` tiene métodos que la campal reemplaza:

- `targetFor`
- `enemiesOf`
- `hitBefore` / `markHit` / `clearHits`
- `dmgScale`
- `confine`
- `clampSpot` / `spotFree`
- `dashBounce`
- `projectileOut`
- `rayLength`
- `waveOut`
- `avoidEdges` / `centerFor`
- `ringColor`
- `focus`

En la versión base hacen lo de siempre: el blanco es el otro Pokémon, la lista de rivales tiene un solo elemento y los bordes son los de la cancha.

Además:

- `moves.js` recorre `enemiesOf()` en cada lugar donde se pegaba al rival (cuerpo a cuerpo, embestidas, rayos, vuelo, explosiones, proyectiles, anillos, zonas, rayos del cielo y olas).
- `fighter.js` y `ai.js` usan los ganchos para el rival y los bordes.

## Fases

1. **Contra bots en un solo dispositivo** (hecho):
   - mapa, choques, cámara, niebla, premios, pasto alto, bots con la ficha;
   - HUD con vida, QUEDAN N, reloj de la niebla, minimapa, nombres, quién sacó a quién y flechas;
   - elegir Pokémon, rivales (2–4) y dificultad;
   - 3-2-1, "¡Quedaste Nº!", MIRAR y podio.
2. **En línea, sala por código**:
   - CREAR SALA / TENGO UN CÓDIGO, con 2 a 5 personas y bots que completan.
   - Un anfitrión que maneja la sala con N conexiones (hoy `Link.close()` cierra el Peer compartido, así que hay que separarlo).
   - Fotos del estado a 20 por segundo con una lista corta de campos, los 5 Pokémon siempre y los proyectiles solo cerca de cada cámara. Eventos importantes en lista blanca: golpes, K.O. y premios.
   - Si alguien se va, lo reemplaza un bot. Si se va el anfitrión, pasa a los resultados.
   - `tools/soak-royale.mjs` con 1 anfitrión y 4 invitados en memoria, con demora y una desconexión.
3. **Mejoras en línea**: medir bytes, enviar solo lo que cambia si hace falta, predecir tu propio movimiento, búsqueda rápida y revancha.
4. **Más adelante**:
   - el Orbe Gigamax (uno por partida y sin pausa);
   - "¡AGUANTÁ!", la corona del que más sacó y el PÚBLICO que tira bayas;
   - la dificultad automática y el modo FAMILIA CONTRA BOTS;
   - que los de tipo agua naden y los logros.

## Pruebas

- `tools/simular.mjs` (60 y 300 peleas, con y sin `GMAX=0`) idéntico a la base, `tools/soak-online.mjs 100` sin errores ni diferencias, y `tools/aventura.mjs` bien.
- `tools/royale-unit.mjs`:
  - **Golpes con varios rivales:**
    - el proyectil le pega solo al primero;
    - anillo y terremoto pegan una vez a cada uno, el segundo ×0.7;
    - el rayo les pega a todos los de la línea y se corta en los árboles;
    - el golpe cuerpo a cuerpo les pega a todos los que están al alcance;
    - la explosión no repite al golpeado de lleno.
  - **Mapa:**
    - cercas y agua no frenan disparos;
    - 10.000 movimientos al azar nunca quedan adentro de algo;
    - teletransporte y vuelo caen en lugar libre.
  - **Reglas:**
    - sueño de 1 s;
    - niebla que no elimina al principio;
    - crédito del K.O.;
    - nada pausa el juego;
    - la ficha.
- `tools/royale-sim.mjs` (con semilla, todo bots y el jugador 0 contado como persona):
  - un solo ganador por partida;
  - ninguna posición rota ni adentro de algo;
  - la ficha se cumple siempre;
  - el mismo resultado dos veces seguidas.
  - Hoy, en 100 partidas: duran de 0:44 a 2:13 (mediana 1:18) y ningún Pokémon gana más del doble del promedio.
- Navegador:
  - elegir, preparar, 3-2-1, pelea, niebla, eliminación, MIRAR y podio sin errores en la consola;
  - COMBATE sigue igual;
  - controles táctiles sin el botón GIGA.
  - Pendiente: medir en los celulares de la familia (que no baje de 30 cuadros por segundo con 5 peleando en la niebla).
