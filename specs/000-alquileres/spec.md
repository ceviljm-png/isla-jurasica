# Spec 000 — Alquileres y tasas

Estado: implementada

## Contexto y objetivo
Documenta cuánto paga un jugador al caer en una casilla de otro (dinosaurio, transporte o instalación) o en
una casilla de tasa, tal como funciona hoy el juego. Es la base de la economía de la partida: si cambia sin
querer, cambia el equilibrio de todas las partidas. Qué ocurre cuando el jugador no tiene efectivo para pagar
se documenta en la spec 001 (deudas y ruina).

## Usuarios
Cualquier jugador, persona o máquina, en cualquier tipo de partida (Clásica, Rápida y Reducida).

## Historias de usuario
- HU-1. Como dueño de un dinosaurio, quiero cobrar alquiler a quien caiga en él, y más si tengo la zona completa
  o recintos, para que invertir en zonas compense.
- HU-2. Como dueño de transportes o instalaciones, quiero cobrar según cuántos tengo, para que coleccionarlos valga la pena.
- HU-3. Como jugador que cae en una casilla ajena, quiero saber cuánto voy a pagar antes de caer (en la ficha de la
  casilla), para poder planificar.

## Definiciones
- **Casilla con dueño**: dinosaurio, transporte o instalación comprado por un jugador que sigue en la partida.
- **Zona completa**: el dueño tiene todos los dinosaurios de ese color, estén hipotecados o no.
- **Tabla de alquiler** de un dinosaurio: seis importes (solar, 1, 2, 3 y 4 recintos, santuario), fijos para cada
  dinosaurio y visibles en su ficha. Crecen con el precio del dinosaurio.
- **Tirada**: suma de los dos dados de la última tirada del jugador que cae.

## Requisitos funcionales
- RF-1: SI la casilla en la que cae el jugador no tiene dueño, es suya o está hipotecada, ENTONCES EL SISTEMA no le
  cobra alquiler. Si está hipotecada y es de otro, lo anota en el registro («hipotecado: no paga nada»).
- RF-2: CUANDO un jugador cae en un dinosaurio ajeno sin recintos ni hipoteca, EL SISTEMA le cobra el importe de
  solar de su tabla de alquiler, o el doble si el dueño tiene la zona completa.
- RF-3: CUANDO un jugador cae en un dinosaurio ajeno con recintos o santuario, EL SISTEMA le cobra el importe de su
  tabla de alquiler que corresponde a ese número de recintos (1-4) o al santuario, sin duplicarlo por la zona.
- RF-4: CUANDO un jugador cae en un transporte ajeno no hipotecado, EL SISTEMA le cobra según cuántos transportes
  tiene el dueño (hipotecados incluidos): 25, 50, 100 o 200 en el tablero de 40 casillas; 50 o 100 en el de 24.
- RF-5: CUANDO un jugador cae en una instalación ajena no hipotecada, EL SISTEMA le cobra 4 veces la tirada, o 10
  veces si el dueño tiene las dos instalaciones (hipotecadas incluidas).
- RF-6: CUANDO un jugador cae en una casilla de tasa, EL SISTEMA le cobra su importe y lo pierde (no lo cobra nadie):
  Seguro de visitantes 200 y Pienso de lujo 100 en el tablero de 40 casillas; 100 y 50 en el de 24.
- RF-7: CUANDO se cobra un alquiler, EL SISTEMA pasa el importe completo del que cae al dueño y lo anota en el
  registro con el nombre de la casilla, el importe y los dos jugadores.
- RF-8: EL SISTEMA muestra en la ficha de cada dinosaurio su tabla de alquiler completa (incluido el importe con la
  zona completa) y resalta la fila que se cobraría ahora mismo si tiene dueño.

## Requisitos no funcionales
- RNF-1: Todos los alquileres y tasas son números enteros de ámbar.
- RNF-2: El cálculo da el mismo resultado en el navegador y en Node (no depende de la interfaz).

## Casos límite
- El dueño tiene la zona completa pero alguno de sus dinosaurios está hipotecado: el que no lo está cobra el doble (RF-2).
- Caer en un transporte cuando el dueño tiene 3 hipotecados y 1 libre: se cobra el importe de 4 transportes (RF-4).
- El tablero de 24 casillas no tiene instalaciones: RF-5 no aplica.
- Una carta manda al jugador a un transporte con «paga el doble»: el importe de RF-4 se multiplica por 2
  (se documenta con las cartas).
- Una carta mueve al jugador a una instalación: se usa la última tirada de dados de ese jugador (RF-5).

## Fuera de alcance
- Qué pasa si el jugador no tiene efectivo suficiente (spec 001).
- Cuándo y cómo se construyen recintos o se hipoteca (spec de recintos e hipotecas).
- Movimientos y efectos de las cartas (spec de cartas).

## Criterios de finalización
- Hay tests que fijan, con estados preparados a mano, el importe de cada RF-1 a RF-6 en los dos tableros,
  incluidos los casos límite, y `npm test` termina en OK.

## Dudas abiertas
- [NECESITA ACLARACIÓN] La zona completa duplica el alquiler de solar aunque haya dinosaurios hipotecados en ella
  (`js/engine.js:210`, `ownsGroup` solo mira el dueño). ¿Es intencionado? En el juego de mesa clásico también es
  así, pero en la ficha no se explica.
- [NECESITA ACLARACIÓN] El alquiler de una instalación usa 7 como tirada si no hay tirada registrada
  (`js/engine.js:214`). En juego normal no puede pasar, pero la ficha y la lista «Mis dinosaurios» enseñan siempre
  el alquiler calculado con 7 (`js/ui.js:650`, `js/ui.js:911`), que puede confundir.
