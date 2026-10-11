# Spec 004 — Partida en red: sincronización, jugadas y reconexión

Estado: implementada

## Contexto y objetivo
Documenta cómo se juega una partida en red una vez empezada, tal como funciona hoy: quién lleva la partida, cómo
llegan las jugadas y el estado a cada dispositivo, qué pasa si alguien se desconecta o recarga, y cómo se cierra.
Cómo se crea la sala y se empieza está en la spec 003. Las reglas del juego son las mismas que sin red.

## Usuarios
- **Anfitrión**: lleva la partida de verdad, ejecuta las reglas y las máquinas, y guarda.
- **Invitado**: ve una copia de la partida y manda sus jugadas al anfitrión.

## Historias de usuario
- HU-1. Como jugador en red, quiero ver lo mismo que los demás (dados, movimientos, cartas) y jugar solo cuando me toca.
- HU-2. Como invitado, quiero poder recargar o perder la cobertura y volver a mi asiento sin perder la partida.
- HU-3. Como anfitrión, quiero que la partida no se quede bloqueada si alguien se va.

## Definiciones
- **Estado**: la partida completa (jugadores, casillas, turno, registro y efectos pendientes de animar).
- **Asiento**: cada jugador de la partida. Los de personas recuerdan su dispositivo.
- **Desconectado**: un dispositivo del que no llega nada en 15 segundos o cuya conexión se ha cerrado.

## Requisitos funcionales
- RF-1: CUANDO cambia el estado de la partida en el anfitrión, EL SISTEMA lo manda completo a todos los invitados,
  junto con quién está conectado, solo si es distinto del último que mandó.
- RF-2: CUANDO un invitado recibe estados, EL SISTEMA los aplica en orden y anima solo los efectos (dados,
  movimientos, cartas) que aún no había visto. Con el primer estado, enseña la partida sin repetir efectos antiguos.
- RF-3: EL SISTEMA solo enseña a cada dispositivo los botones de los asientos que se juegan en él, y le avisa con
  «¡Te toca!» (y vibración si la hay) cuando empieza a decidir uno de ellos.
- RF-4: CUANDO un invitado hace una jugada, EL SISTEMA la manda al anfitrión, que solo la ejecuta si viene del
  asiento que puede hacerla ahora (quien tiene el turno, el que puja, el que debe o el que gestiona sus casillas) y
  con números válidos. Si no, el invitado ve «Ahora no se puede.»; si no hay conexión, «Sin conexión con la sala. Reintentando…».
- RF-5: CUANDO alguien propone un trato a una persona en otro dispositivo, EL SISTEMA se lo pregunta en su dispositivo
  y lo da por rechazado si no contesta en 90 segundos o no está conectada. Quien propone ve la respuesta; si en
  100 segundos no llega ninguna, ve «No ha llegado respuesta.».
- RF-6: MIENTRAS un dispositivo está desconectado, EL SISTEMA lo marca en su ficha de jugador y, cuando le toca
  decidir, dice a todos que se ha desconectado.
- RF-7: CUANDO un invitado pierde la conexión, EL SISTEMA se lo indica con una barra y reintenta cada 3 segundos
  hasta que vuelve a conectar. Si recarga o cierra la app, el inicio le ofrece «Volver a la sala XXXX» y, al volver,
  recupera su asiento. Un dispositivo que no tiene asiento no puede entrar: «La partida de esta sala ya ha empezado.».
- RF-8: CUANDO le toca decidir a una persona desconectada, EL SISTEMA ofrece al anfitrión que la máquina juegue por
  ella. Si acepta (tras confirmar), la máquina juega por esa persona hasta que vuelva a conectarse, y entonces recupera
  su asiento. Las dos cosas se anotan en el registro.
- RF-9: CUANDO el anfitrión sale o cierra la app, EL SISTEMA guarda la partida en su dispositivo y la partida se
  detiene. Al pulsar «Reabrir la sala XXXX» en el inicio, recupera el mismo código (reintenta cada 3 segundos hasta
  40 veces mientras el servicio lo libera) y los invitados se reconectan solos.
- RF-10: CUANDO la partida termina, EL SISTEMA enseña el resultado en todos los dispositivos. Si el anfitrión empieza
  una nueva o abandona la partida, a los invitados les cierra la sala («Se ha cerrado la sala.», salvo si ya había
  terminado) y les olvida la sala guardada.

## Requisitos no funcionales
- RNF-1: El anfitrión no se fía de nada de lo que recibe: valida el asiento, la orden y los números (y el motor los
  vuelve a validar). En los tratos limpia las listas de casillas y las cantidades.
- RNF-2: El invitado no se fía del anfitrión: los textos que llegan solo pueden traer negritas; el resto se escapa.
- RNF-3: Solo el anfitrión ejecuta las reglas y las máquinas, y solo él guarda la partida.
- RNF-4: Mientras se juega en red, la pantalla no se apaga sola si el navegador lo permite.

## Casos límite
- Un invitado recarga a mitad de una animación: al volver ve el estado actual sin repetir efectos (RF-2).
- La persona por la que juega la máquina vuelve mientras la máquina está decidiendo: recupera el control en
  cuanto termina esa decisión.
- Se propone un trato a una persona desconectada: se rechaza en el momento (RF-5).
- El anfitrión pierde la conexión con el servicio de salas pero no con los invitados: la partida sigue y reintenta
  conectarse para poder admitir reconexiones.
- El anfitrión sale «al inicio» sin abandonar: los invitados ven la barra de reconexión hasta que reabra (RF-7 y RF-9).

## Fuera de alcance
- Crear la sala, unirse y la sala de espera (spec 003).
- Reglas del juego (specs 000-002 y siguientes) y cómo decide la máquina.
- Servidor TURN para redes muy cerradas: no existe hoy.

## Criterios de finalización
- Hay tests con un transporte simulado que fijan: sincronización sin efectos repetidos, jugada válida e inválida de
  un invitado, trato con una persona en otro dispositivo (aceptado, rechazado y sin respuesta), reconexión con
  recuperación del asiento, entrada rechazada a un dispositivo nuevo, la máquina jugando por un ausente y su vuelta,
  y la reapertura de la sala. `npm test` termina en OK.
- Probado a mano con dos navegadores con almacenamiento separado y, al menos una vez, con dos móviles reales
  (la conexión WebRTC real no se ha probado nunca).

## Dudas abiertas
- [NECESITA ACLARACIÓN] El invitado apenas valida el estado que recibe: solo mira que haya jugadores y que el tipo de
  partida y el nivel existan (`js/ui.js:1188`). Algunos números del estado van a la página sin convertir
  (`js/ui.js:325`, `js/ui.js:367`, `js/ui.js:370` y el número de recintos en las fichas), y un estado incoherente (por
  ejemplo, una subasta sin datos) rompería la interfaz. Choca con el principio 5 de la constitución. ¿Se corrige?
- [NECESITA ACLARACIÓN] Al terminar la partida, en el invitado, «Nueva partida» vuelve a guardar lo mismo que lee
  (`js/ui.js:841`): no hace nada. Parece un despiste sin efectos. ¿Se quita?
- [NECESITA ACLARACIÓN] Al preguntar un trato, el invitado no redondea las cantidades a enteros (`js/ui.js:1176`), a
  diferencia del anfitrión. Solo afecta a cómo se enseña la oferta. ¿Se iguala?
- [NECESITA ACLARACIÓN] En red, cuando te toca, el estado dice «Turno de ti.» (`js/ui.js:322`, `you()` devuelve «ti»
  y `phaseLine` lo pone detrás de «Turno de»). No es correcto en español; ¿se cambia por «Te toca.» o «Tu turno.»?
  Detectado en la comprobación manual del 2026-10-11.
