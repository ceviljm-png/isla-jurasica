# Plan 001 — Deudas y ruina (tests de caracterización)

Spec: `specs/001-deudas-y-ruina/spec.md` (implementada, aprobada).
Objetivo: **solo añadir tests** que fijen el comportamiento actual; no cambia ningún archivo de la app. La duda
abierta («paga a cada jugador» con ruina: los demás no cobran) se fija tal como está hoy.

## Archivos y responsabilidades

| Archivo | Nuevo / cambia | Responsabilidad | RF |
|---|---|---|---|
| `test/001-deudas-y-ruina.test.js` | nuevo | Tests de esta spec con `node:test`. | RF-1 a RF-10 |
| `test/mesa.js` | cambia | Añade `cobrar(g, p, n, a)`: deja el turno en `p` y ejecuta un cargo del motor (`g.charge`), devolviendo el cambio de dinero de cada jugador. | RF-1, RF-2, RF-6, RF-8 |
| `MEMORY.md` | cambia | Estado de la spec 001. | — |

## Funciones de la ayuda

- `cobrar(g, p, n, a = -1)` → `s.turn = p`, fase `main`; llama a `g.charge(p, n, a)` (`a`: jugador acreedor, `-1`
  el parque o `'todos'`). Devuelve `[Δ0, Δ1, …]`. Se reutilizan `mesa`, `dar`, `caer`, `casilla` y `total`.

## Algoritmo (pseudocódigo)

```
deuda típica: J1 con 10 de efectivo, la zona Pradera (Compsognathus y Gallimimus) con 1 recinto cada uno
              y el Triceratops sin hipotecar  → podría reunir 10 + 25 + 25 + 30 + 30 + 160 = 280
              J0 dueño del Velociraptor y el T. rex (alquiler 100)
caer(J1, T. rex) → fase 'debt', deuda { p: 1, n: 100, a: 0 }, sin mover dinero
```

| RF | Caso | Esperado |
|---|---|---|
| RF-1 | J1 con 1500 cae en el T. rex de J0 | paga 100 y la fase sigue (`main`) |
| RF-2 | Deuda típica | fase `debt`; deuda de 100 a J0; nadie cobra todavía |
| RF-3 | Durante la deuda | `build`, `unmortgage`, `trade`, `roll`, `endTurn` → `false`; `sell` (+25) y `mortgage` del Triceratops (+160) → `true`; hipotecar una casilla de J0 → `false`; hipotecar el Compsognathus con recintos en la zona → `false` |
| RF-4 | Tras reunir el dinero, `settle` | `true`; J0 cobra 100; fase `main`, sin deuda |
| RF-4 | `settle` sin dinero suficiente | `false`; la deuda sigue |
| RF-5 | `declare` con la deuda típica | J1 arruinado aunque podía reunir 280 |
| RF-6 | J1 con 10 y nada más cae en el T. rex | arruinado sin pasar por la fase `debt` |
| RF-7 | `declare` en la deuda típica, con un pase y el Triceratops hipotecado | J0 recibe las 3 casillas sin recintos (el Triceratops sigue hipotecado), el efectivo de J1 más 50 de los recintos y el pase |
| RF-8 | J1 con 10, el Compsognathus hipotecado y un pase; tasa de 200 al parque | casilla libre y sin hipoteca; el efectivo desaparece (`total` baja 10); el pase no pasa a nadie |
| RF-8 | Duda: 3 jugadores, J1 sin nada, `cobrar(J1, 50, 'todos')` | arruinado; J0 y J2 no cobran nada |
| RF-9 | 3 jugadores; arruinado J1 con el turno | dinero 0, sin casillas, fuera de la cuarentena, `out`; el turno pasa a J2, y al terminar J2 vuelve a J0 saltando a J1 |
| RF-10 | 2 jugadores; arruinado J1 | fase `over` y ganador J0 |
| RNF-3 | En todos | dinero entero y no negativo; ningún arruinado con casillas |

## Interfaz

No cambia. La confirmación antes de arruinarse (RF-5) y el texto «debe X a Y y le faltan Z» (RF-2) son de la
interfaz: se comprueban a mano en el navegador con una deuda preparada, a 375 px y en escritorio.

## Decisiones

- **Llamar a `g.charge` desde la ayuda** para los cargos al parque y a «todos», en lugar de preparar una carta o
  una tasa concreta. Descartado: ataría estos tests a la spec de cartas. Para el alquiler se sigue usando `caer`.
- **La continuación tras pagar la cuarentena (RF-4)** se prueba en la spec 002, que tendrá dados controlados.
  Descartado probarla aquí: necesitaría ya la inyección de dados.

## Estrategia de tests

- `npm test` sin fallos. Cada test se comprueba también alterando a mano un valor esperado en una copia temporal
  y viendo que falla.
- RF-2 (texto) y RF-5 (confirmación): comprobación manual.
