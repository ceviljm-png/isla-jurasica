# Plan 003 — Salas en red (tests de caracterización)

Spec: `specs/003-salas-en-red/spec.md` (implementada, aprobada).
Objetivo: **solo añadir tests** de la parte de la spec que vive en `js/net.js`, con una red simulada en Node, y una
lista de comprobación manual para la parte que vive en `js/ui.js` (sala de espera, límite de 4, compartir), que
depende del DOM. Sacar esa lógica de `ui.js` para poder probarla queda para un `/sdd-change` posterior. No cambia
ningún archivo de la app. Las dudas abiertas no bloquean: se fija lo que hace hoy.

## Archivos y responsabilidades

| Archivo | Nuevo / cambia | Responsabilidad | RF |
|---|---|---|---|
| `test/red-simulada.js` | nuevo | Sustituto de PeerJS en memoria (`Peer` y conexiones) que se instala en `globalThis.Peer`. Permite marcar nombres ocupados, salas que no contestan y cortar conexiones. | todos los de red |
| `test/003-salas-en-red.test.js` | nuevo | Tests de `Net` para esta spec. | RF-1, RF-2, RF-4, RF-6, RF-7, RF-8, RNF-2 |
| `MEMORY.md` | cambia | Estado de la spec 003 y lista de comprobación manual pendiente. | — |

## Red simulada (`test/red-simulada.js`)

- `instalar()` → pone `globalThis.Peer = PeerSimulado`, vacía el registro de nombres y devuelve un control:
  `{ ocupar(id), liberar(id), mudo(id), creados }`.
- `new PeerSimulado(id?, opciones)`: si el nombre está ocupado emite `error { type: 'unavailable-id' }`; si no, se
  registra y emite `open`. Sin nombre recibe uno al azar.
- `peer.connect(id)` → conexión; si el destino no existe, el peer emite `error { type: 'peer-unavailable' }`; si
  está marcado como mudo, la conexión nunca se abre. Si existe, el destino recibe `connection` y ambas puntas `open`.
- `conn.send(m)` entrega una copia JSON en la otra punta (`data`); `conn.close()` cierra las dos y emite `close`.
- `peer.destroy()` lo quita del registro y cierra sus conexiones.
- Todo se entrega con `setImmediate`, así que los tests pueden simular el reloj (`setTimeout`, `setInterval` y
  `Date`) con `mock.timers` de `node:test` sin bloquear la entrega. Ayuda `esperar()` que vacía la cola.

## Algoritmo de los tests (pseudocódigo)

```
ctl ← instalar(); require('../js/net.js')  → globalThis.Net
anfitrión ← new Net.Room('islajurasica-', manejadores que apuntan los eventos)
código ← await anfitrión.open()
invitado ← new Net.Room(...); await invitado.join(código, { dev, name })
esperar(); comprobar eventos de cada lado
```

| RF | Caso | Esperado |
|---|---|---|
| RF-1 | `open()` | código de 4 letras sin I ni O; el anfitrión está registrado como `islajurasica-CÓDIGO` |
| RF-1 | Nombres ocupados siempre | 7 intentos (1 + 6 reintentos) y rechazo `unavailable-id` |
| RF-2 | `join(' ab-c9d ')` | se limpia a `ABCD` y se conecta a esa sala; el anfitrión recibe `onJoin(dev, hola)` con nombre y dispositivo |
| RF-2 | `cleanCode` | solo letras, en mayúsculas, máximo 4 |
| RF-4 | Código sin sala | rechazo `peer-unavailable` |
| RF-4 | Sala que no contesta | rechazo `timeout` a los 15 s (reloj simulado) |
| RNF-2 | Mensaje antes de presentarse, o presentación con un dispositivo mal formado | el anfitrión no avisa de nada |
| RF-6 | El mismo dispositivo se presenta otra vez | la conexión vieja se cierra, `onJoin` de nuevo, sin `onLeave` |
| RF-7 | `kick(dev, m)` | el invitado recibe `m` y a los 400 ms se cierra; el anfitrión deja de tenerlo en línea |
| RF-8 | El invitado cierra su sala | el anfitrión recibe `onLeave(dev)` |
| — | `deviceId` sin `localStorage` | 12 letras, el mismo en cada llamada |

## Interfaz: comprobación manual (dos navegadores con almacenamiento separado, `localhost` y `127.0.0.1`)

RF-3 (enlace con código), RF-5 (sala de espera), RF-6 (sala llena), RF-7 (añadir máquina y quitar jugador),
RF-9 (compartir) y RF-10 (empezar con 2 y cerrar la sala). Necesita conexión real con el servicio público de
salas: si en este equipo no se puede, queda anotada como pendiente en MEMORY.md.

## Decisiones

- **Sustituir `Peer` por uno en memoria** en lugar de usar PeerJS real. Descartado: depende de internet y de un
  servicio externo, y no permite simular el reloj. `net.js` ya lee `Peer` de `globalThis`, así que no hay que tocarlo.
- **Entregar los mensajes con `setImmediate`** en lugar de en el momento. Descartado entregarlos en el momento: PeerJS
  es asíncrono y el código cuenta con ello (por ejemplo, registra los manejadores después de crear la conexión).

## Estrategia de tests

- `npm test` sin fallos. Cada test se comprueba alterando un valor esperado en una copia temporal.
- Parte de interfaz: comprobación manual.
