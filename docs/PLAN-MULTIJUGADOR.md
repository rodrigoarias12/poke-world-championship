# Plan: multijugador en línea y juego en celular

Objetivo del MVP: **dos personas, cada una con su celular, juegan una pelea en línea en el Wi-Fi de casa, con revancha.**

## Decisiones de arquitectura

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Conexión | WebRTC P2P con PeerJS 1.5.5 (señalización en PeerJS Cloud) + STUN | Sin servidor propio ni cuentas nuevas; mínima demora en Wi-Fi. Vercel no puede alojar salas de juego. |
| Respaldo | TURN de Cloudflare Realtime vía una función de Vercel (`/api/turn`) | Solo si la prueba de conexión falla (NAT estricto, datos móviles). Requiere cuenta de Cloudflare. |
| Sincronización | Anfitrión autoritativo + interpolación de snapshots | Un solo celular simula, así iOS y Android nunca se desincronizan. Lockstep/rollback costaría el doble y exige simulación idéntica en ambos motores. |
| Canal | Un canal confiable y ordenado (JSON) | Simple y suficiente en Wi-Fi; canal no confiable solo si aparecen trabas. |
| Efectos y sonidos | El anfitrión graba las llamadas de efectos/sonido y las manda en cada snapshot | El invitado ve exactamente lo mismo sin reescribir el motor. |
| Lados | El invitado juega a la derecha (sin espejar) | Espejar tocaría todo (arena, efectos, presentaciones). |
| Emparejamiento | Automático: "lugares de espera" numerados en PeerJS Cloud (`pokechamp-v1-cola-N`) | Sin servidor propio. El primero ocupa un lugar libre y espera; el siguiente lo encuentra ocupado y se conecta. Al armarse la pareja el lugar se libera. Quien espera en un lugar que no es el 1 revisa los anteriores cada 6 s, así nadie queda esperando solo. Si el rival se va antes de pelear, se vuelve a buscar solo. |
| Invitar | Código de 4 cifras + link `?sala=1234` (opción secundaria) | Para jugar con alguien en particular. Teclado numérico grande en pantalla, fácil para chicos. |
| Equipo | El último que usaste queda guardado en el celular | Buscar rival es un solo toque; se puede cambiar mientras busca. |
| Pausa en línea | No hay; salir de la app termina la partida (MVP) | Reconexión en una fase posterior. |

## Fases

0. **Prueba de conexión** (`red.html`): crear/unirse, ping 20 Hz, RTT p50/p95, jitter, tipo de conexión, capacidades del navegador. El dueño la prueba en sus dos celulares.
1. **Arreglos urgentes de celular**: toques en pausa/resultados, controles tras revancha (`onEnter`), aviso de girar, desbloqueo de audio en iOS (`pointerup`, `audioSession`, reanudar), botón de esquivar más grande.
2. **Preparar el código** (sin cambiar el juego de 1 jugador): controladores Local/IA/Remoto, reglas sin sesgo de lado, estadísticas por lado, grabador de efectos, serializador de estado. Verificado con una prueba "golden master" de 60 peleas.
3. **Multijugador mínimo**: lobby (EN LÍNEA → CREAR / UNIRSE), elección de equipos, anfitrión con snapshots a 30 Hz, invitado con interpolación adaptativa, revancha, desconexión vuelve al lobby. Pruebas: dos iframes conectados de verdad + 200 peleas automáticas con lag simulado.
4. **Pulido de celular/audio** (según los datos de la fase 0): gritos MP3 y música por Web Audio en iPhone, app en pantalla de inicio, áreas seguras, animaciones en iPhone.
3b. **Jugar sin fricción** (hecho): JUGAR EN LÍNEA siempre visible y primero en el menú, emparejamiento automático, pantalla VS, revancha con los mismos equipos ("¡Tu rival quiere la revancha!"), "OTRO RIVAL". Pruebas: `tools/duo.html?modo=buscar&n=4` (dos parejas a la vez) y `?cola=xyz` para no cruzarse con jugadores reales.
5. **Robustez**: reconexión, predicción de movimiento del invitado, canal no confiable, señalización de respaldo.
