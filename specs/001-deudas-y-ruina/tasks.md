# Tareas 001 — Deudas y ruina (tests de caracterización)

Solo se añaden tests; no cambia ningún archivo de la app.

- [x] **T1. Tests de la deuda: pago directo, apertura, acciones permitidas, pago y ruina inmediata.** RF-1 a RF-6
  - Añadir `cobrar` a `test/mesa.js`; casos RF-1 a RF-6 del plan con la deuda típica.
  - Hecho cuando: pasan con `npm test` y, al alterar un valor esperado en una copia, el test correspondiente falla.
- [x] **T2. Tests de la ruina: reparto, salida de la partida y ganador.** RF-7 a RF-10, RNF-3
  - Casos del plan: ruina frente a un jugador y frente al parque, «a todos» (duda), turno saltando al arruinado y final.
  - Hecho cuando: pasan con `npm test` y, al alterar un valor esperado en una copia, el test correspondiente falla.
- [x] **T3. Comprobación manual y MEMORY.md.** RF-2, RF-5
  - En el navegador (375 px y escritorio), con una deuda preparada: el texto de la deuda y la confirmación al
    arruinarse; sin errores propios en la consola. Actualizar MEMORY.md.
  - Hecho cuando: comprobado y anotado en MEMORY.md, y `npm test` sin fallos.
