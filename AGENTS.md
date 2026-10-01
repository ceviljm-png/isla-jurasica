# AGENTS.md — Isla Jurásica

Guía para agentes de código (y personas) que trabajen en este repositorio. Léela antes de tocar nada.
El contexto de producto, las decisiones ya tomadas y el historial están en [MEMORY.md](MEMORY.md).

## Qué es

Juego de tablero por turnos de comprar propiedades, con dinosaurios. App web instalable (PWA) sin servidor
propio ni cuentas: todo ocurre en el navegador y la partida se guarda en `localStorage`. Se puede jugar en un
solo dispositivo (pasándolo) o **en red**, cada persona con el suyo, mediante salas con código de 4 letras.

- Publicado en: https://ceviljm-png.github.io/isla-jurasica/
- Repositorio: https://github.com/ceviljm-png/isla-jurasica (rama `main`, servida con GitHub Pages)

## Comandos

| Para | Comando |
|---|---|
| Comprobar las reglas (partidas máquina contra máquina) | `npm test` — equivale a `node test/sim.js [partidas]` |
| Servir el juego en local, puerto 8140 | `npm start` — equivale a `python3 serve.py [puerto]` |

No hay paso de compilación ni empaquetador. La única dependencia es PeerJS, copiada tal cual en `js/vendor/`
(ver más abajo). Node solo para las pruebas y Python 3 solo para el servidor local.

## Estructura

```
index.html              Página única: iconos y siluetas SVG (<symbol>), menú de inicio y esqueleto de la partida
css/style.css           Todos los estilos
js/engine.js            Reglas, tableros, cartas y estado. Sin DOM: también corre en Node
js/ai.js                Decisiones de los rivales que lleva la máquina. Sin DOM
js/ui.js                Interfaz: dibujo, entrada, diálogos, animaciones, bucle de turnos, guardado y partidas en red
js/net.js               Salas en red (anfitrión e invitados) sobre PeerJS. Sin DOM
js/vendor/peerjs.min.js PeerJS 1.5.5 (MIT, licencia en PEERJS-LICENSE), sin modificar
sw.js                   Service worker: red primero, copia guardada si no hay red
manifest.webmanifest    Datos de instalación de la PWA
icons/                  Icono (SVG de origen y PNG de 192 y 512 px)
test/sim.js             Partidas completas con comprobación de invariantes
serve.py                Servidor estático para desarrollo
```

Los scripts son clásicos (no módulos ES) y se cargan en orden `vendor/peerjs.min.js`, `net.js`, `engine.js`, `ai.js`, `ui.js`, para que el juego
también funcione con `file://`. `engine.js` expone `window.Jurasica` y `ai.js` expone `window.JurasicaAI`;
en Node se exportan con `module.exports`.

## Arquitectura

### Motor (`js/engine.js`)

- `DINOS`: nombre, abreviatura del tablero, silueta (`fig`) y dato curioso de cada dinosaurio.
- `BOARDS`: los dos tableros (`clasico` de 40 casillas y `mini` de 24). Cada casilla tiene un tipo `t`:
  `prop` (dinosaurio), `tren` (transporte), `serv` (instalación), `carta`, `tasa`, `salida`, `cuar`, `mirador`, `fuga`.
  Precios y alquileres crecen con la popularidad del dinosaurio.
- `DECKS`: cartas de Expedición (`exp`) e Incubadora (`inc`), con el efecto como datos (`k`).
- `MODES` (clasica, rapida, reducida) y `LEVELS` (facil, normal, dificil).
- `Game` envuelve el estado `g.s`, JSON plano. `Game.create({ mode, level, players })` crea; `new Game(estado)` reanuda.
- Cada acción valida, modifica `g.s` y devuelve `true`/`false`; nunca lanza excepciones por una jugada inválida.
- Fases (`g.s.phase`): `roll` → (`buy` → `auction`) / `debt` → `main` → siguiente turno; final en `over`.
  `g.actor()` dice quién decide ahora (en subasta y deuda no tiene por qué ser quien tiene el turno).
- Los pagos pasan por `charge()`: si no llega el efectivo abre la fase `debt`; si ni vendiéndolo todo llega, arruina al jugador.
- `g.s.fx` es una cola de efectos (dados, movimientos, cartas) que la interfaz reproduce y vacía.

### Máquina (`js/ai.js`)

- `AI.step(g)` ejecuta **una** acción del jugador automático al que le toque y devuelve `true`;
  `false` si hay que esperar a una persona, o `{ offer }` si propone un trato que debe resolver la interfaz.
- `AI.judge(g, q, offer)` decide si `q` acepta un trato (`{ ok, why, gap }`), comparando el valor de sus posesiones
  antes y después y penalizando que otro complete una zona. `AI.refusal()` redacta el rechazo.
- `CFG` ajusta por nivel el colchón de dinero, el margen para aceptar tratos, cuánto puja y cuánto construye.

### Interfaz (`js/ui.js`)

- `pump()` es el bucle: dibuja, reproduce `g.s.fx`, guarda y llama a `AI.step` hasta que le toca a una persona.
- El tablero es una rejilla CSS de `D × D` celdas (`D = casillas / 4 + 1`) que se redibuja entera en cada `render()`.
  Las fichas van en una capa aparte (`#tokens`) para poder animarlas.
- Toda la información es pública (como en la mesa), así que no hay pantalla de «pasa el dispositivo»; solo un aviso de turno.
- `local(p)`: el jugador `p` es una persona que juega en este dispositivo. Todo lo que decide qué botones salen usa `local()`.
- Toda jugada pasa por `exec(orden, args)` → `apply(asiento, orden, args)`, que comprueba que quien la manda puede hacerla.

### Partidas en red (`js/net.js` y la parte final de `js/ui.js`)

- **El anfitrión manda.** Su dispositivo tiene la partida de verdad, ejecuta el motor y las máquinas, y guarda.
  Cada vez que cambia el estado lo manda entero a los invitados (`sync()` dentro de `render()`).
- **Los invitados** tienen una copia (`new Game(estado)`), reproducen los efectos nuevos (`fx` con número `n` mayor que
  el último visto) y envían sus jugadas al anfitrión como `{ t: 'act', cmd, args }`. Nunca tocan el motor.
- Cada dispositivo tiene un identificador fijo (`Net.deviceId`, en `localStorage`); cada asiento humano guarda el suyo
  en `players[i].dev`. Así, quien se desconecta recupera su asiento al volver.
- Mensajes: invitado → anfitrión `hello`, `act`, `answer`, `pong`; anfitrión → invitado `lobby`, `state`, `ask`
  (pregunta un trato), `tradeRes`, `msg`, `kick`, `end`, `ping`. Todo es JSON.
- El anfitrión no se fía de nada de lo que llega: valida el asiento, la orden y los números, y el motor vuelve a validar.
  El invitado tampoco se fía del anfitrión: el texto que llega solo puede traer `<b>` (`clean()`).
- Conexión: PeerJS usa su servidor público gratuito (0.peerjs.com) solo para encontrarse; los datos van directos por
  WebRTC. Se usan servidores STUN públicos; **no hay TURN** (los que traía PeerJS ya no existen), así que en redes muy
  cerradas la conexión directa puede fallar. Si hiciera falta, se añadiría un TURN en `ICE` de `net.js`.
- Si el anfitrión cierra la app, la partida se para: al reabrirla («Reabrir la sala») recupera el mismo código y los
  invitados se reconectan solos. Si se va un invitado, el anfitrión puede dejar que la máquina juegue por él (`takeover`).
- Las salas se llaman `islajurasica-XXXX` en el servidor de PeerJS.

## Normas

- **Idioma**: textos, comentarios y mensajes de commit en español.
- **Nombre y arte propios**: no usar nombres, logotipos ni arte de juegos o películas comerciales. El juego se llama
  «Isla Jurásica»; la moneda es el ámbar. Los dinosaurios reales pueden nombrarse; los dos híbridos de ficción
  (Indominus rex e Indoraptor) están por decisión del propietario.
- **Proyecto independiente**: sin nombres de empresas, personas, correos ni enlaces ajenos al juego.
- **Sin dependencias ni compilación**, salvo PeerJS copiado en `js/vendor/` (no se edita; para actualizarlo se copia `dist/peerjs.min.js` del paquete de npm).
- **El motor y la máquina no tocan el DOM.** Toda regla nueva va en `engine.js` y debe poder simularse en Node.
- **Seguridad**: todo texto del usuario (nombres) pasa por `esc()` antes de entrar en `innerHTML`; el motor ya escapa los nombres en el registro.
- **Almacenamiento**: `localStorage` siempre dentro de `try/catch`.
- **Estado guardado**: si cambia la forma de `g.s`, mantener compatibilidad o subir `VERSION` (las partidas antiguas se descartan en `showMenu()`).
- **Rechazos**: cada rechazo de un trato debe dar un texto distinto del anterior, con el motivo.
- **Móvil primero**: comprobar cualquier cambio visual a 375 px de ancho y en escritorio.

## Antes de dar algo por terminado

1. `npm test` termina en `OK`.
2. Probado a mano en el navegador el flujo afectado, sin errores en la consola.
3. Si se toca la red: probar con al menos dos dispositivos (o dos navegadores con almacenamiento separado,
   por ejemplo `127.0.0.1` y `localhost`) crear sala, unirse, jugar, recargar el invitado y recargar el anfitrión.
4. Si cambian archivos que la app necesita sin conexión, están en `FILES` de `sw.js` (y sube `CACHE`).

## Publicación

GitHub Pages sirve la raíz de `main`: un `git push` actualiza la web en un minuto aproximadamente.
Publicar es una acción visible para cualquiera: **no hacer commit ni push sin que el propietario lo pida**.
`index.html`, `sw.js` y `manifest.webmanifest` deben seguir en la raíz; las rutas son relativas porque la app vive en `/isla-jurasica/`.
