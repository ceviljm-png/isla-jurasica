# MEMORY.md — Isla Jurásica

Decisiones de producto y estado del proyecto. Es un archivo público: sin datos privados.

## Decisiones

- Juego tipo «comprar propiedades» con temática de parque de dinosaurios, con **nombre y arte propios**.
- Las casillas van **de menos a más popular**: los dinosaurios más conocidos son los más caros.
  Orden: Compsognathus, Gallimimus · Apatosaurus, Pachycephalosaurus, Parasaurolophus · Therizinosaurus, Baryonyx,
  Allosaurus · Carnotaurus, Ankylosaurus, Pteranodon · Dilophosaurus, Giganotosaurus, Indoraptor · Brachiosaurus,
  Stegosaurus, Spinosaurus · Mosasaurus, Indominus rex, Triceratops · Velociraptor, Tyrannosaurus rex.
- Entran dinosaurios reales y los dos **híbridos de ficción** (Indoraptor, Indominus rex), en la parte cara.
- Se juega **contra la máquina y pasando el dispositivo**, de 2 a 4 jugadores, o **en red** con un móvil por persona.
- Red: conexión directa entre dispositivos (WebRTC con PeerJS), sin cuentas ni servidor propio. Una persona por
  dispositivo; los huecos se pueden rellenar con máquinas, que lleva el dispositivo que crea la sala.
- Al empezar se elige el tablero: **Clásica** (40 casillas, hasta la ruina), **Rápida** (40 casillas, 2 dinosaurios
  de salida, 20 rondas y gana quien más vale) o **Reducida** (24 casillas, 12 dinosaurios, sueldo y dinero inicial menores).
- Tres niveles de máquina (fácil, normal, difícil).

## Estado

- Reglas comprobadas con `npm test` (partidas máquina contra máquina en los tres tableros y niveles).
- Partidas en red comprobadas con tres navegadores a la vez y un transporte simulado: sala, partida, tratos entre
  personas, desconexión, recarga del invitado y del anfitrión, y la máquina jugando por un ausente. El 2026-10-11 la
  conexión WebRTC real funcionó entre dos navegadores del mismo equipo; falta probarla con móviles en redes distintas.
- En red no hay servidor TURN: en redes muy cerradas (algunas de datos móviles) la conexión directa puede fallar.

## SDD

- Kit SDD instalado el 2026-10-11. Adopción con `/sdd-adopt` terminada: fases A, B, C y D hechas.
- Constitución: aprobada el 2026-10-11 (`docs/constitution.md`).
- Spec activa: ninguna.
- `npm test` ejecuta la simulación y los `test/*.test.js` (68 tests): `test/mesa.js` prepara estados a mano y
  `tirar` fija los dados (`g.dado`); `test/red-simulada.js` sustituye a PeerJS para probar `net.js` sin internet.
- El navegador integrado de Claude Code no deja registrar el service worker (la consola muestra «An unknown error
  occurred when fetching the script»): es del navegador, no del juego; `sw.js` se sirve bien.
- Siguiente paso: decidir las dudas abiertas de las specs 000-004 y aplicarlas con `/sdd-change`. Propuesto: sacar de
  `ui.js` a un módulo sin DOM la lógica de anfitrión e invitado (validación de jugadas y tratos, sincronización,
  la máquina jugando por un ausente) para poder probarla, con `/sdd-change 004-partida-en-red`.
- Pendiente de probar a mano: final de una partida en red (resultado en los dos dispositivos) y dos móviles en
  redes distintas; compartir con el menú nativo y el portapapeles (solo en móvil).
- Sin spec todavía (documentarlas antes de tocarlas): compra y subasta, recintos e hipotecas, cartas, tratos,
  tipos de partida y final, jugadores de la máquina.
- Desde aquí, todo cambio va por `/sdd-change NNN-area` o por una spec nueva.

| Spec | Estado | Tareas | Notas |
|------|--------|--------|-------|
| 000-alquileres | implementada (aprobada) · tests de caracterización hechos | 4/4 | 8 RF, 2 dudas abiertas; RF-8 comprobado a mano el 2026-10-11 (375 px y escritorio) |
| 001-deudas-y-ruina | implementada (aprobada) · tests de caracterización hechos | 3/3 | 10 RF, 1 duda abierta; RF-2 y RF-5 comprobados a mano el 2026-10-11 |
| 002-turno-y-cuarentena | implementada (aprobada) · tests de caracterización hechos | 3/3 | 10 RF, dudas resueltas; dados sustituibles con `g.dado`; botones de la cuarentena comprobados a mano el 2026-10-11 |
| 003-salas-en-red | implementada (aprobada) · tests de caracterización hechos | 3/3 | 10 RF, 3 dudas abiertas; tests de `net.js` con red simulada; sala de espera comprobada a mano el 2026-10-11 con conexión real entre dos navegadores (falta compartir con menú nativo o portapapeles, solo en móvil) |
| 004-partida-en-red | implementada (aprobada) · tests de caracterización hechos | 2/2 | 10 RF, 4 dudas abiertas; tests de `net.js`; partida en red comprobada a mano el 2026-10-11 con conexión real (falta: resultado final en los dos dispositivos y móviles en redes distintas) |

### Áreas funcionales (orden previsto para las specs)

| Área | Dónde | Riesgo |
|---|---|---|
| Pagos, deudas y ruina | `engine.js` `rent`, `charge`, `settle`, `bankrupt`, `liquid` | alto |
| Turno, movimiento y cuarentena | `engine.js` `roll`, `advance`, `toJail`, `payJail`, `usePass` | alto |
| Partidas en red | `net.js`, final de `ui.js` | muy alto |
| Compra y subasta | `engine.js` `buy`, `decline`, `bid`, `passBid` | medio |
| Recintos e hipotecas | `engine.js` `canBuild`…`unmortgage` | medio |
| Cartas | `engine.js` `DECKS`, `draw` | medio |
| Tratos | `engine.js` `canTrade`, `trade`; `ui.js` `openTrade`, `resolveTrade` | medio |
| Tipos de partida y final | `engine.js` `BOARDS`, `MODES`, `next`, `finish`, `ranking` | medio |
| Jugadores de la máquina | `ai.js` | medio |
| Interfaz, guardado y PWA | `ui.js`, `index.html`, `css/style.css`, `sw.js` | medio |

### Decisiones que se deducen del código

- Todo el dinero es entero: precios, hipotecas y recintos están elegidos para que sus mitades también lo sean.
- Las jugadas inválidas no lanzan excepciones: el motor devuelve `false` y la interfaz dice «Ahora no se puede».
- Solo el jugador con el turno puede deber dinero: todos los cargos se hacen a quien tiene el turno.
- En red, el estado completo viaja en cada cambio (no hay diferencias) y los efectos se numeran (`fxN`) para no repetirlos.
- El registro guarda las últimas 80 líneas y la cola de efectos las últimas 40.

### Deuda técnica conocida (inventario del 2026-10-11)

- Pruebas: solo invariantes con partidas máquina contra máquina. Nada fija valores concretos (alquileres, cartas,
  reparto en la ruina), no hay semilla (un fallo no se puede repetir) y no hay pruebas de red, interfaz ni guardado.
- Partidas que no terminan: en Reducida con 3-4 máquinas en difícil, entre un 2 % y un 7 % llegan al tope de
  1500 rondas de `test/sim.js` sin ganador.
- El invitado apenas valida el estado que recibe (`ui.js` `playInbox`): algunos números van a `innerHTML` sin
  convertir (`tries`, `debt.n`, `auction.bid`, `houses`) y un estado incoherente rompería la interfaz.
- `ui.js` `gameOver`: en el invitado, `store(SAVE_KEY, load(SAVE_KEY))` no hace nada.
- `ui.js` `cleanOffer` no redondea las cantidades de los tratos (solo afecta a cómo se muestran).

## Vocabulario

| Juego | Equivale a |
|---|---|
| Ámbar | dinero |
| Zona | grupo de color |
| Recinto / santuario | casa / hotel |
| Transporte (Helipuerto, Monorraíl, Embarcadero, Teleférico) | estaciones |
| Central geotérmica, Laboratorio genético | servicios |
| Expedición / Incubadora | cartas de suerte / de caja |
| Cuarentena, pase del veterinario | cárcel, carta de salir gratis |
| Mirador | parking gratuito |
| ¡Alerta de fuga! | ve a la cárcel |

## Reglas simplificadas respecto al juego de mesa clásico

- No hay límite de recintos ni santuarios en la banca.
- Al arruinarse frente al parque (impuestos, cartas), los dinosaurios vuelven libres y sin hipoteca, sin subasta.
- En «cada jugador te regala», quien no tiene efectivo paga lo que tiene.
- No se pueden cambiar los pases del veterinario en los tratos.
- Al arruinarse frente a otro jugador, el acreedor recibe los dinosaurios hipotecados tal cual, sin pagar el 10 % de interés.

## Historial

- 2026-09-30 · Primera versión: tres tableros, subastas, hipotecas, tratos, cartas, animaciones, PWA sin conexión.
- 2026-09-30 · Publicado en GitHub Pages: https://ceviljm-png.github.io/isla-jurasica/
- 2026-10-01 · Partidas en red: salas con código, reconexión, la máquina puede jugar por quien se va.
- 2026-10-11 · Kit SDD y adopción: constitución, specs 000-004 y 68 tests de caracterización. Corregido el registro
  del tercer intento fallido en la cuarentena (ya no da los 50 por pagados) y los dados se pueden fijar en los tests.
