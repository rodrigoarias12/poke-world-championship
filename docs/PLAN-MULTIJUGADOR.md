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
| Sala | Código de 4 cifras + link `?sala=1234` | Teclado numérico grande en pantalla, fácil para chicos. |
| Pausa en línea | No hay; salir de la app termina la partida (MVP) | Reconexión en una fase posterior. |

## Fases

0. **Prueba de conexión** (`red.html`): crear/unirse, ping 20 Hz, RTT p50/p95, jitter, tipo de conexión, capacidades del navegador. El dueño la prueba en sus dos celulares.
1. **Arreglos urgentes de celular**: toques en pausa/resultados, controles tras revancha (`onEnter`), aviso de girar, desbloqueo de audio en iOS (`pointerup`, `audioSession`, reanudar), botón de esquivar más grande.
2. **Preparar el código** (sin cambiar el juego de 1 jugador): controladores Local/IA/Remoto, reglas sin sesgo de lado, estadísticas por lado, grabador de efectos, serializador de estado. Verificado con una prueba "golden master" de 60 peleas.
3. **Multijugador mínimo**: lobby (EN LÍNEA → CREAR / UNIRSE), elección de equipos, anfitrión con snapshots a 30 Hz, invitado con interpolación adaptativa, revancha, desconexión vuelve al lobby. Pruebas: dos iframes conectados de verdad + 200 peleas automáticas con lag simulado.
4. **Pulido de celular/audio** (según los datos de la fase 0): gritos MP3 y música por Web Audio en iPhone, app en pantalla de inicio, áreas seguras, animaciones en iPhone.
5. **Robustez**: reconexión, predicción de movimiento del invitado, canal no confiable, señalización de respaldo.
