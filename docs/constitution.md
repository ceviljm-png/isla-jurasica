# Constitución — Isla Jurásica

Estado: aprobada (2026-10-11)

1. **Sin compilación ni dependencias.** HTML, CSS y JavaScript clásico que funciona con `file://`; la única
   librería es PeerJS, copiada sin modificar en `js/vendor/`. Nada de empaquetadores, frameworks ni servidor propio.
2. **La spec manda.** Todo cambio de comportamiento empieza por su spec en `specs/`; lo que no está en una spec
   no se implementa. Antes de cambiar un área sin spec, se documenta como está.
3. **Las reglas viven en el motor.** `engine.js` y `ai.js` no tocan el DOM y corren en Node; toda regla nueva va
   ahí. La interfaz solo dibuja y manda órdenes, y en red solo el anfitrión ejecuta el motor.
4. **Tests en verde, siempre.** `npm test` termina en OK antes de dar algo por hecho. Cada regla nueva o
   cambiada lleva un test que fije su resultado, no solo los invariantes.
5. **Nada que llegue de fuera es de fiar.** Los nombres pasan por `esc()`; en red, anfitrión e invitado validan
   todo lo que reciben. Sin cuentas ni datos personales: todo se guarda en `localStorage` (siempre con
   `try/catch`), y si cambia la forma del estado guardado se mantiene la compatibilidad o se sube `VERSION`.
6. **Español y nombre propio.** Textos, comentarios y commits en español. Nombre, arte y vocabulario propios
   (ámbar, zonas, recintos), sin marcas ajenas. Móvil primero: todo cambio visual se prueba a 375 px.
