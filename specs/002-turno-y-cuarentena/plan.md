# Plan 002 — Turno, movimiento y cuarentena (tests de caracterización)

Spec: `specs/002-turno-y-cuarentena/spec.md` (implementada, aprobada).
Objetivo: añadir tests que fijen el comportamiento actual. Incluye el único cambio de código aprobado en la spec
(duda resuelta): poder fijar los dados desde fuera, sin cambiar cómo se juega.

## Archivos y responsabilidades

| Archivo | Nuevo / cambia | Responsabilidad | RF |
|---|---|---|---|
| `js/engine.js` | cambia | `roll()` pide cada dado a un método `dado()` de la partida, que por defecto devuelve `die()` (azar de siempre). Un test puede sustituir `g.dado` en su partida. No cambia `g.s` ni el estado guardado. | RF-1, RNF-1 |
| `test/mesa.js` | cambia | `tirar(g, p, ...dados)`: deja el turno en `p` en fase `roll`, fija la secuencia de dados y llama a `g.roll()`. Devuelve el cambio de dinero de cada jugador. | todos |
| `test/002-turno-y-cuarentena.test.js` | nuevo | Tests de esta spec. | RF-1 a RF-10 |
| `sw.js` | cambia | Sube `CACHE` porque cambia `engine.js`. | — |
| `MEMORY.md` | cambia | Estado de la spec 002. | — |

## Funciones

- Motor: `dado() { return die(); }` y en `roll`: `const a = this.dado(), b = this.dado()`. Función sin estado; la
  dependencia (el azar) queda sustituible desde fuera.
- Ayuda: `tirar(g, p, ...dados)` → `s.turn = p`, fase `roll`; `g.dado = () => dados.shift()`; `g.roll()`;
  devuelve `[Δ0, Δ1, …]`. Para colocar la ficha antes se usa `g.s.players[p].pos`.

## Algoritmo de los tests (pseudocódigo)

```
g ← mesa(); colocar ficha, dinero, cuarentena o dobles previos
Δ ← tirar(g, p, a, b)
comprobar posición, dinero, fase, «again», cuarentena, intentos y registro
```

Se eligen tiradas que caen en casillas sin cartas, para no depender del orden de los mazos.

| RF | Caso | Esperado |
|---|---|---|
| RF-1 | Desde la Salida, 2+3 | ficha en el Helipuerto (5), fase `buy` |
| RF-2 | Desde la casilla 38, 1+2 | ficha en la 1, +200 |
| RF-2 | Desde la 35, 2+3 (cae en la Salida) | ficha en la 0, +200 |
| RF-2 | Tablero reducido, desde la 22, 1+2 | ficha en la 1, +100 |
| RF-3 | Desde la 18, 1+1 (Mirador) | fase `roll` de nuevo, `again` |
| RF-4 | Con 2 dobles previos, 1+1 | en la cuarentena (10), sin moverse con la tirada, sin sueldo, fase `main` |
| RF-5 | Desde la 26, 2+2 (¡Alerta de fuga!) | cuarentena, sin sueldo, fase `main`, sin repetir |
| caso | Desde la 4, 3+3 (cae en la Cuarentena) | solo visita: no queda retenido; vuelve a tirar |
| RF-6 | En cuarentena, `payJail` | −50, libre, fase `roll`; luego 2+2 repite tirada |
| RF-6 | En cuarentena con un pase, `usePass` | sin pase, libre |
| RF-6 | En cuarentena con 40 | `payJail` → `false` |
| RF-7 | En cuarentena, 3+3 | libre, ficha en la 16, sin repetir tirada |
| RF-8 | Tercer intento, 1+2, con efectivo | −50, libre, ficha en la 13; el registro dice «tiene que pagar 50 para salir» |
| RF-8 | Tercer intento con 10 y el Triceratops | deuda de 50; tras hipotecar y pagar, avanza a la 13 |
| RF-8 | Tercer intento con 10 y nada más (3 jugadores) | arruinado, la ficha no avanza, el turno pasa |
| RF-9 | Primer intento, 1+2 | sigue en cuarentena, 1 intento, fase `main` |
| caso | Con 2 intentos, «¡Alerta de fuga!» | los intentos vuelven a 0 |
| RF-10 | 3 jugadores, J2 termina | turno de J0, ronda + 1; los dobles a 0 |
| RNF-3 | Cualquier tirada | efectos `dice` y `move` numerados en orden creciente |

## Interfaz

No cambia. Se comprueba a mano, en el navegador (375 px y escritorio), una partida en cuarentena: los botones
«Probar dobles», «Pagar 50» y «Usar pase», y que sin 50 «Pagar 50» sale desactivado.

## Decisiones

- **Método `dado()` sustituible por partida** en lugar de pasar una función de azar a `Game.create` o guardarla en
  el estado. Descartado: guardarla en `g.s` rompería el JSON del guardado y de la red, y cambiar `create` obligaría a
  tocar la interfaz. El método no viaja en el estado y la app no lo sustituye nunca.
- **Tiradas que evitan las casillas de carta**, en lugar de fijar también el mazo. Descartado: las cartas tienen su
  propia spec pendiente.

## Estrategia de tests

- Primero los tests con `g.dado` sustituido: sin el cambio del motor fallan (los dados siguen siendo al azar).
  Después el cambio en el motor, y `npm test` sin fallos (la simulación sigue igual: usa el azar por defecto).
- Interfaz de la cuarentena: comprobación manual.
