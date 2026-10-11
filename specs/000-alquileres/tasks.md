# Tareas 000 — Alquileres y tasas (tests de caracterización)

Solo se añaden tests y la ayuda común; no cambia ningún archivo de la app.

- [x] **T1. Ayuda común `test/mesa.js` y nuevo `npm test`.** RF-1 a RF-7 (base)
  - `mesa`, `casilla`, `dar`, `caer` y `total` según el plan; `package.json` ejecuta `node test/sim.js && node --test test/*.test.js`.
  - Hecho cuando: un `test/000-alquileres.test.js` con un único test de humo (crear una mesa y localizar el T. rex
    y el Helipuerto) pasa y `npm test` termina sin fallos.
- [x] **T2. Tests de dinosaurios: sin alquiler, solar, zona completa y recintos.** RF-1, RF-2, RF-3, RF-7, RNF-1
  - Casos del plan: libre (fase `buy`), propia, ajena hipotecada (con el texto del registro), Compsognathus solo y
    con zona, zona con el Gallimimus hipotecado, T. rex con 1-4 recintos y santuario, transferencia exacta y registro.
  - Hecho cuando: los casos pasan con `npm test` y, al cambiar a mano un importe esperado, el test correspondiente falla.
- [x] **T3. Tests de transportes, instalaciones y tasas en los dos tableros.** RF-4, RF-5, RF-6, RNF-1
  - Casos del plan: 1-4 transportes, 3 hipotecados + 1 libre, tablero reducido; una y dos instalaciones con dados
    3+4; las cuatro tasas, comprobando que el dinero total de la mesa baja lo mismo.
  - Hecho cuando: los casos pasan con `npm test` y, al cambiar a mano un importe esperado, el test correspondiente falla.
- [x] **T4. Comprobación manual de la ficha y documentación.** RF-8
  - En el navegador (375 px y escritorio): ficha del Compsognathus libre, con dueño, con la zona completa y con
    recintos; fila resaltada correcta y sin errores en la consola. Actualizar AGENTS.md (comandos y estructura) y MEMORY.md.
  - Hecho cuando: la comprobación está hecha y anotada en MEMORY.md, AGENTS.md describe el nuevo `npm test` y
    `npm test` termina sin fallos.
