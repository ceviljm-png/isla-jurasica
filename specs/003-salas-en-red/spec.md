# Spec 003 — Salas en red: crear, unirse y sala de espera

Estado: implementada

## Contexto y objetivo
Documenta cómo se juntan varias personas, cada una con su dispositivo, antes de empezar una partida en red: crear
una sala con un código, unirse con el código o con un enlace, la sala de espera y el arranque de la partida, tal
como funciona hoy. No hay cuentas ni servidor propio: un servicio público solo sirve para que los dispositivos se
encuentren. Lo que pasa una vez empezada la partida (jugadas, reconexión, cierre) se documenta en la spec 004.

## Usuarios
- **Anfitrión**: la persona que crea la sala. Su dispositivo lleva la partida y las máquinas.
- **Invitado**: cada persona que se une desde otro dispositivo.

## Historias de usuario
- HU-1. Como anfitrión, quiero crear una sala y compartir un código corto o un enlace, para que mis amigos entren desde su móvil.
- HU-2. Como invitado, quiero unirme escribiendo el código o abriendo el enlace, sin registrarme.
- HU-3. Como anfitrión, quiero completar la mesa con máquinas, quitar a quien no toca y decidir cuándo empezar.

## Definiciones
- **Código de sala**: 4 letras mayúsculas, sin I ni O para que no se confundan.
- **Dispositivo**: cada navegador tiene un identificador fijo, que se guarda en él y sirve para reconocerlo al volver.
- **Sala de espera**: pantalla con el código y la lista de jugadores, antes de empezar.

## Requisitos funcionales
- RF-1: CUANDO una persona pide crear una sala y escribe su nombre (obligatorio, hasta 14 caracteres), EL SISTEMA
  abre una sala con un código al azar y la lleva a la sala de espera como primer jugador. Si el código ya está
  ocupado, prueba con otro hasta 6 veces.
- RF-2: CUANDO una persona pide unirse, escribe su nombre (obligatorio, hasta 14 caracteres) y un código de 4 letras,
  EL SISTEMA la conecta con esa sala y la lleva a la sala de espera. Mientras escribe el código, solo admite
  letras y las pasa a mayúsculas.
- RF-3: CUANDO se abre el juego con un enlace de sala válido, EL SISTEMA quita el código de la dirección y abre
  directamente «Unirse a una sala» con el código ya escrito.
- RF-4: SI no se puede conectar, ENTONCES EL SISTEMA dice por qué con un mensaje propio: no hay sala con ese código,
  la sala no responde en 15 segundos, el código sigue ocupado, el navegador no permite jugar en red, no se ha
  podido cargar el módulo de red o no hay conexión con el servidor de salas.
- RF-5: MIENTRAS la sala está en espera, EL SISTEMA muestra a todos el código, el tipo de partida y el nivel de las
  máquinas (los que estaban elegidos en el inicio del anfitrión) y la lista de jugadores (hasta 4) con su estado:
  tú, crea la sala, máquina, conectado o desconectado.
- RF-6: SI se intenta unir alguien cuando ya hay 4 jugadores, ENTONCES EL SISTEMA lo rechaza con «La sala está
  llena.»; si se vuelve a unir un dispositivo que ya está en la lista, solo actualiza su nombre.
- RF-7: CUANDO el anfitrión añade una máquina (si hay sitio) o quita a un jugador (cualquiera menos él), EL SISTEMA
  actualiza la lista para todos; la máquina toma un nombre de la lista de máquinas que no esté usado, y al
  invitado quitado le dice «Te han quitado de la sala.» y lo devuelve al inicio.
- RF-8: CUANDO un invitado sale de la sala de espera o pierde la conexión, EL SISTEMA lo quita de la lista.
- RF-9: CUANDO el anfitrión pulsa compartir, EL SISTEMA usa el menú de compartir del dispositivo con el enlace de la
  sala; si no lo hay, copia el texto y el enlace; y si tampoco se puede, enseña el código.
- RF-10: CUANDO el anfitrión empieza la partida con al menos 2 jugadores, EL SISTEMA la crea con los jugadores en el
  orden de la lista y la reparte a todos. Si el anfitrión cierra la sala antes, a los invitados les dice «Se ha
  cerrado la sala.» y los devuelve al inicio.

## Requisitos no funcionales
- RNF-1: Sin cuentas ni datos personales: solo viajan el nombre escrito y el identificador del dispositivo.
- RNF-2: El anfitrión no se fía de lo que recibe: descarta mensajes de dispositivos que no se han presentado o con
  un identificador mal formado, y recorta y escapa los nombres.
- RNF-3: Los datos de la partida van directos entre dispositivos; el servicio público solo pone en contacto.
- RNF-4: Si el navegador no tiene el módulo de red, el inicio avisa y los botones de red no intentan conectar.

## Casos límite
- El código del enlace o del formulario tiene minúsculas, espacios o símbolos: se limpia a 4 letras mayúsculas.
- Un invitado recarga la página en la sala de espera: sale de la lista y, al volver, entra al final (puede
  cambiar de color y de puesto).
- El anfitrión quita a una máquina: desaparece sin más.
- Con un solo jugador no se puede empezar: el botón está desactivado y lo explica.
- Si la partida ya ha empezado, un dispositivo nuevo no puede entrar (spec 004).

## Fuera de alcance
- Jugadas, sincronización, reconexión, reapertura de la sala y la máquina jugando por un ausente (spec 004).
- Servidor TURN para redes muy cerradas: no existe hoy.

## Criterios de finalización
- Hay tests con un transporte simulado (sin red real) que fijan: crear sala, unirse, sala llena, quitar y añadir
  jugadores, salir de la sala de espera, empezar y cerrar. Probado a mano con dos navegadores con almacenamiento
  separado. `npm test` termina en OK.

## Dudas abiertas
- [NECESITA ACLARACIÓN] Cualquiera que sepa o adivine el código puede entrar en la sala de espera: no hay
  contraseña, y hay unos 330 000 códigos (`js/net.js:7`). El anfitrión puede quitarlo a mano (RF-7). ¿Se acepta?
- [NECESITA ACLARACIÓN] Si un invitado recarga en la sala de espera, pierde su puesto y vuelve al final de la lista
  (`js/ui.js:1048`). Una vez empezada la partida sí conserva su asiento. ¿Es intencionado?
- [NECESITA ACLARACIÓN] Si se juega abriendo el archivo directamente (`file://`), el enlace de compartir no sirve
  porque la dirección no es pública (`js/ui.js:1285`). ¿Se oculta el botón en ese caso o se deja?
