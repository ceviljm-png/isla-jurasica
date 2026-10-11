# Plan 000 — Alquileres y tasas (tests de caracterización)

Spec: `specs/000-alquileres/spec.md` (implementada, aprobada).
Objetivo del plan: **solo añadir tests** que fijen el comportamiento actual. No cambia ningún archivo de la app
(`js/`, `index.html`, `css/`, `sw.js`). Las dos dudas abiertas de la spec no bloquean: los tests fijan lo que
hace hoy el código (por ejemplo, la zona completa con un dinosaurio hipotecado cobra el doble); si más adelante
se decide cambiarlo, se hará con `/sdd-change` y se ajustará el test.

## Archivos y responsabilidades

| Archivo | Nuevo / cambia | Responsabilidad | RF |
|---|---|---|---|
| `test/mesa.js` | nuevo | Ayuda común para todos los tests de caracterización: crea una partida y prepara a mano el estado (dueños, recintos, hipotecas, dinero, posición, dados). Sin lógica del juego propia. | todos |
| `test/000-alquileres.test.js` | nuevo | Tests de esta spec con `node:test` y `node:assert/strict`. | RF-1 a RF-7 |
| `package.json` | cambia | `"test": "node test/sim.js && node --test test/*.test.js"`: la simulación de siempre y después los tests nuevos. | — |
| `AGENTS.md` | cambia | Tabla de comandos y estructura: `npm test` ejecuta la simulación y los `*.test.js`; `test/mesa.js` es la ayuda común. | — |
| `MEMORY.md` | cambia | Estado de la spec 000 y de la fase D. | — |

`sw.js` no cambia: los tests no forman parte de la app.

## Funciones de la ayuda (`test/mesa.js`)

Funciones puras sobre el motor; la partida y las casillas entran por parámetro, nada global:

- `mesa({ modo = 'clasica', jugadores = 2, dinero })` → `Game` creado con `Game.create`, jugadores persona
  (`ai: false`) llamados J0, J1…, y todos con `dinero` si se indica. Vacía el registro y los efectos.
- `casilla(g, clave)` → índice de la casilla: por clave de dinosaurio (`'trex'`) o por nombre (`'Helipuerto'`,
  `'Seguro de visitantes'`). Lanza un error si no existe, para que un test mal escrito falle claro.
- `dar(g, p, claves, { recintos, hipoteca })` → pone a `p` como dueño de esas casillas, con ese número de recintos
  (0-5) o hipotecadas.
- `caer(g, p, clave, dados = [3, 4])` → deja el turno en `p`, fase `roll`, los dados indicados y la ficha en la
  casilla, y ejecuta la llegada a la casilla (`g.land(1)`) como si acabara de moverse. Devuelve el cambio de
  dinero de cada jugador (`[Δ0, Δ1, …]`).
- `total(g)` → suma del efectivo de todos los jugadores.

## Algoritmo de cada test (pseudocódigo)

```
para cada caso:
  g ← mesa(tablero adecuado)
  dar(g, dueño, casillas, recintos/hipoteca)
  Δ ← caer(g, pagador, casilla, dados)
  comprobar Δ[pagador] = −importe esperado y Δ[dueño] = +importe (o 0)
  comprobar g.rent(casilla, suma) = importe cuando aplica
```

Casos (importes tomados de la tabla del motor actual):

| RF | Caso | Esperado |
|---|---|---|
| RF-1 | Casilla libre | no cambia el dinero; fase `buy` |
| RF-1 | Casilla propia | no cambia el dinero |
| RF-1 | Ajena hipotecada | no cambia; el registro contiene «hipotecado: no paga nada» |
| RF-2 | Compsognathus solo | 2 |
| RF-2 | Compsognathus con la zona completa | 4 |
| RF-2 | Zona completa con el Gallimimus hipotecado, cae en el Compsognathus (caso límite, duda 1) | 4 |
| RF-3 | T. rex con 1, 2, 3, 4 recintos y santuario, zona completa | 200, 600, 1400, 1700, 2000 |
| RF-4 | 1, 2, 3, 4 transportes (clásico) | 25, 50, 100, 200 |
| RF-4 | 3 hipotecados + 1 libre, cae en el libre | 200 |
| RF-4 | 1 y 2 transportes (reducido) | 50, 100 |
| RF-5 | Una instalación, dados 3+4 | 28 |
| RF-5 | Las dos (una hipotecada), dados 3+4, cae en la libre | 70 |
| RF-6 | Seguro de visitantes / Pienso de lujo (clásico) | −200 / −100 y `total` baja lo mismo |
| RF-6 | Las dos tasas (reducido) | −100 / −50 |
| RF-7 | Alquiler cobrado | Δ pagador = −Δ dueño; el registro nombra casilla, importe y los dos jugadores |
| RNF-1 | Todos los anteriores | importes enteros |

## Interfaz

No cambia. RF-8 (la ficha muestra la tabla y resalta la fila actual) depende del DOM y no se puede probar en
Node sin dependencias: se comprueba a mano en el navegador (ficha del Compsognathus libre, con dueño, con la
zona completa y con recintos), a 375 px y en escritorio, sin errores en la consola.

## Decisiones

- **`node:test` del propio Node** en lugar de ampliar `test/sim.js` con asserts propios. Descartado ampliar
  `sim.js`: mezclaría la simulación aleatoria con casos fijos y no diría qué caso falla. `node:test` viene con
  Node, así que no añade dependencias (principio 1).
- **Preparar el estado a mano y llamar a `land`** en lugar de jugar partidas con dados hasta caer en la casilla.
  Descartado jugar: es lento, aleatorio y no garantiza el caso. `land` es el punto real por donde pasa todo
  alquiler y tasa, así que el test fija el comportamiento completo (cobro, transferencia y registro), no solo `rent`.
- **Una ayuda común (`test/mesa.js`)** en lugar de repetir la preparación en cada archivo. Descartado repetirla:
  las specs 001 y 002 la necesitan igual.
- **Fijar el comportamiento actual de las dudas abiertas** en lugar de esperar a resolverlas. Descartado esperar:
  la fase D es la red de seguridad antes de cualquier cambio.

## Estrategia de tests

- Comando: `npm test` (AGENTS.md). Tras el cambio ejecuta `node test/sim.js` y luego `node --test test/*.test.js`;
  tiene que terminar sin fallos.
- Como el código ya existe, los tests deberían salir en verde a la primera. Para comprobar que de verdad vigilan
  algo, al escribirlos se cambia a mano un importe esperado y se confirma que el test falla; después se deja bien.
- RF-8: comprobación manual descrita en «Interfaz».
