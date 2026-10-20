# Plan: Modo Aventura

Objetivo: caminar por Kanto como en Pokémon Rojo/Azul, pero cada encuentro (salvaje, entrenador, rival, líder) se pelea con las **peleas en tiempo real** de este juego, no con el combate por turnos.

Cómo se armó: tres estudios en paralelo (diseño de Rojo/Azul y juegos parecidos, arquitectura sobre el código real, mapas y pixel art con vistas previas) y una revisión de "CTO" que eligió entre las propuestas y recortó el alcance.

## Decisiones

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Encuentros | Pokémon salvajes **visibles** caminando en el pasto alto; tocarlos empieza la pelea | Ella elige cuándo pelear; nada interrumpe por sorpresa (como Let's Go) |
| Especies | Solo los 28 del plantel, con tablas por zona | Ya tienen sprites, gritos, ataques y equilibrio; mejor encontrar a Pikachu que a Rattata |
| Equipo en pelea | Hasta 3 sanos (los primeros); si uno cae entra el siguiente | Encaja con el motor; siempre hay respaldo |
| Rivales | Salvaje 1, entrenador 1–2, rival 1 | Peleas cortas para chicos |
| Niveles | vida = base·(0.45+0.03·Nv), poder = base·(0.8+0.02·Nv) | 7 niveles de diferencia ≈ 1.5 veces más fuerte |
| Experiencia | Lineal: subir cuesta 5·Nv; ganar da ≈3.5·Nv del rival (×1.5 entrenadores); todo el equipo recibe | ≈25 peleas por capítulo |
| Captura | En salvajes, el lugar del Gigamax (R / botón) pasa a ser **POKÉ BALL ×N**; tiro automático que siempre pega; 3 sacudidas | Un solo botón, sin puntería difícil |
| Indicador | Ícono de Poké Ball rojo/amarillo/verde sobre el salvaje (sin porcentajes) | Lo entiende una nena |
| Mareado | Al llegar a 0 de vida queda **MAREADO 6 s**; ahí la Poké Ball atrapa seguro. Si no tirás, se debilita y ganás igual | Evita el "¡uy, lo debilité!" y nunca se siente como perder |
| Ataques | Los 5 desde el principio | Ya los conoce de la arena |
| Plata/tienda | No en el MVP; mamá y Joy reponen Poké Balls (mínimo 5) | Menos sistemas |
| Perder | Despertás en casa (o el último Centro) con el equipo curado; el que te ganó baja 1 nivel | Sin castigo |
| Caminar | 0.20 s por casilla, sin correr | Un botón menos |
| Guardado | `localStorage` versionado, copia `-bak`, validación al cargar, autoguardado | Que nunca se pierda la partida |
| Código | Todo en `src/adventure/`, cargado con `import()` dinámico; el núcleo solo suma ganchos | El resto del juego y las pruebas quedan idénticos |

## Fases

1. **MVP: Pueblo Paleta → Ciudad Verde** (hecho y publicado)
   - Mapas: Pueblo Paleta, casa, laboratorio, Ruta 1, Ciudad Verde, Centro Pokémon. Otras puertas: "Está cerrado".
   - Caminar en grilla, colisiones, puertas, bordes entre mapas, cornisas, cámara, fundidos, controles táctiles (joystick como cruceta, A/B).
   - Diálogos con texto tipo máquina, ▼ y Sí/No (con 400 ms de espera para que apretar repetido no elija solo).
   - Historia: mamá; Oak no te deja salir sin Pokémon; elegís inicial (lo ves grande y escuchás su grito); el rival elige el que le gana y te desafía (perder está bien); Oak da 10 Poké Balls; Ruta 1 con 2 entrenadores con visión y "!"; Joy cura en Ciudad Verde; "¡Capítulo 1 (parte 1) completo!" y se sigue jugando libre.
   - Pelea de aventura: niveles, vida que sigue, mareado y captura, experiencia y resumen de subidas de nivel, equipo de hasta 6 + caja, pantalla de equipo con "poner primero".
   - Cancha nueva "ruta" (pasto).
   - Recorte si hace falta: visión de entrenadores → hablar para pelear; salvajes visibles → pasto al azar; cornisas.
2. Ruta 2, Bosque Verde, Ciudad Plateada, gimnasio y Brock con la medalla; Pociones y mochila; canchas bosque y laboratorio; íconos de los salvajes; relator que lee los diálogos; 2 partidas y código de guardado.
3. Evolución (a las formas del plantel, Nv16; Eevee elige), los 16 Pokémon nuevos con tipos Dragón/Hielo/Siniestro (re-base deliberada de las pruebas), caja visible, música propia, tiro co-op, final Gigamax contra Brock.

## Pruebas por fase

- `tools/simular.mjs` (con y sin `GMAX=0`) igual a la base; `tools/soak-online.mjs 200` sin errores ni diferencias; ningún archivo del núcleo importa `src/adventure` de forma estática.
- `tools/aventura.mjs`: valida mapas (filas, caracteres, puertas de ida y vuelta, alcance, cornisas sin trampas, visión libre), 200 peleas (ninguna error, todas terminan, ella gana ≥85% a igual nivel, mareado + Poké Ball = 100%, entrenadores rechazan la Poké Ball), experiencia de la Ruta 1 ≈ Nv8, guardado ida y vuelta + copia de respaldo + almacenamiento que falla.
- Navegador: título entra en celular y compu, Combate/Torneo/En línea siguen andando, la historia completa con teclado, controles táctiles, volver de la pelea a la misma casilla, perder te manda a casa curado, recargar → CONTINUAR, consola sin errores.
