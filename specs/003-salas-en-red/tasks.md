# Tareas 003 — Salas en red (tests de caracterización)

Solo se añaden tests; no cambia ningún archivo de la app.

- [x] **T1. Red simulada y tests de crear sala, unirse y errores.** RF-1, RF-2, RF-4
  - `test/red-simulada.js` según el plan; tests de código, reintentos, limpieza del código, sala inexistente y sin respuesta.
  - Hecho cuando: pasan con `npm test` y, al alterar un valor esperado en una copia, el test correspondiente falla.
- [x] **T2. Tests de presentación, reentrada, expulsión y salida.** RF-6, RF-7, RF-8, RNF-2
  - Mensajes antes de presentarse, dispositivo mal formado, mismo dispositivo dos veces, `kick`, salida del invitado y `deviceId`.
  - Hecho cuando: pasan con `npm test` y, al alterar un valor esperado en una copia, el test correspondiente falla.
- [x] **T3. Comprobación manual de la sala de espera y MEMORY.md.** RF-3, RF-5, RF-6, RF-7, RF-9, RF-10
  - Dos navegadores con almacenamiento separado. Si la conexión real no es posible en este equipo, se anota como pendiente.
  - Hecho cuando: comprobado (o anotado como pendiente, con el motivo) en MEMORY.md y `npm test` sin fallos.
