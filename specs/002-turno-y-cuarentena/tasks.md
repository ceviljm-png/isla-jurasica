# Tareas 002 — Turno, movimiento y cuarentena (tests de caracterización)

- [x] **T1. Dados sustituibles y tests de tirada, sueldo, dobles y fuga.** RF-1 a RF-5, RNF-1, RNF-3
  - `tirar` en `test/mesa.js` y los tests primero (en rojo con los dados al azar); después `dado()` en el motor y
    subir `CACHE` en `sw.js`.
  - Hecho cuando: los tests pasan con `npm test`, la simulación sigue terminando en OK y, al alterar un valor
    esperado en una copia, el test correspondiente falla.
- [x] **T2. Tests de la cuarentena.** RF-6 a RF-9
  - Pagar, pase, sin dinero, salir con dobles, tercer intento (efectivo, deuda y ruina), intento normal, reinicio de intentos.
  - Hecho cuando: pasan con `npm test` y, al alterar un valor esperado en una copia, el test correspondiente falla.
- [x] **T3. Paso del turno, comprobación manual y MEMORY.md.** RF-10
  - Test del paso de turno y la ronda; en el navegador, los botones de la cuarentena a 375 px y en escritorio.
  - Hecho cuando: el test pasa, la comprobación está anotada en MEMORY.md y `npm test` no tiene fallos.
