# Plan 004 — Partida en red (tests de caracterización)

Spec: `specs/004-partida-en-red/spec.md` (implementada, aprobada).
Objetivo: **solo añadir tests** de la parte de la spec que vive en `js/net.js` (latido, desconexión, reconexión y
reapertura), con la red simulada de la spec 003, y una comprobación manual de la parte que vive en `js/ui.js`
(sincronización, jugadas, tratos, la máquina jugando por un ausente y el cierre). Sacar esa lógica de `ui.js` para
poder probarla queda para un `/sdd-change` posterior. No cambia ningún archivo de la app. Las tres dudas abiertas
no bloquean.

## Archivos y responsabilidades

| Archivo | Nuevo / cambia | Responsabilidad | RF |
|---|---|---|---|
| `test/004-partida-en-red.test.js` | nuevo | Tests de `Net` para esta spec, con `test/red-simulada.js` y el reloj simulado. | RF-4, RF-6, RF-7, RF-9 |
| `MEMORY.md` | cambia | Estado de la spec 004 y de la fase D. | — |

## Algoritmo de los tests (pseudocódigo)

```
anfitrión abre sala; invitado se une
avanzar el reloj simulado en pasos de 500 ms dejando pasar la red
comprobar avisos (onLeave, onStatus, onJoin) y si cada lado está en línea
```

| RF | Caso | Esperado |
|---|---|---|
| RF-6 | Un invitado normal durante 30 s | contesta a los latidos: sigue en línea, sin `onLeave` |
| RF-6 | Un dispositivo que se presenta y luego calla | a los 15-20 s el anfitrión lo da por desconectado (`onLeave`) |
| RF-6 | Un anfitrión que acepta pero nunca habla | a los 15-20 s el invitado pasa a `reconnecting` |
| RF-7 | El anfitrión cierra | el invitado pasa a `reconnecting`, no puede mandar jugadas (`toHost` → `false`) y reintenta cada 3 s |
| RF-7 | El anfitrión vuelve con el mismo código | el invitado reconecta solo, se presenta otra vez (`onJoin` con su dispositivo) y pasa a `online` |
| RF-9 | Reabrir con el código aún ocupado | reintenta cada 3 s; cuando el servicio lo libera, abre con el mismo código |
| RF-9 | El código no se libera nunca | 41 intentos (1 + 40) y rechazo `unavailable-id` |
| RF-4 | Mandar al anfitrión con conexión | llega como mensaje del dispositivo (`onMessage`) |

## Interfaz: comprobación manual (dos navegadores con almacenamiento separado, `localhost` y `127.0.0.1`)

Con una partida real entre los dos: RF-1 y RF-2 (lo mismo en los dos lados, sin repetir animaciones), RF-3 (botones
solo en tu asiento y «¡Te toca!»), RF-4 (una jugada del invitado), RF-5 (trato entre personas), RF-6 y RF-8
(desconexión y la máquina jugando por el ausente), RF-7 (recargar el invitado y recuperar el asiento), RF-9 (salir y
reabrir la sala) y RF-10 (abandonar y cierre para el invitado). Vista móvil de 375 px en el invitado.

## Decisiones

- **Reutilizar la red simulada de la spec 003** en lugar de una nueva. Descartado: duplicaría el sustituto de PeerJS.
- **Pasos de 500 ms al simular el reloj** en lugar de saltar 15 s de golpe. Descartado saltar: los latidos y los
  reintentos se encadenan (un temporizador programa otro) y hay que dejar pasar la red entre medias.

## Estrategia de tests

- `npm test` sin fallos. Cada test se comprueba alterando un valor esperado en una copia temporal.
- Parte de interfaz: comprobación manual, anotada en MEMORY.md.
