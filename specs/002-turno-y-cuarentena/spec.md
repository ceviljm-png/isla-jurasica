# Spec 002 — Turno, movimiento y cuarentena

Estado: implementada

## Contexto y objetivo
Documenta cómo avanza la partida: la tirada de dados, el movimiento, el sueldo al pasar por la Salida, los dobles,
la cuarentena y el paso del turno, tal como funciona hoy. Qué ocurre al caer en cada casilla se documenta en las
specs de alquileres (000), compra y subasta, y cartas.

## Usuarios
Cualquier jugador, persona o máquina, en cualquier tipo de partida.

## Historias de usuario
- HU-1. Como jugador, quiero tirar dos dados y avanzar, cobrando el sueldo cada vez que paso por la Salida.
- HU-2. Como jugador, quiero volver a tirar si saco dobles, sin poder abusar de ello.
- HU-3. Como jugador en cuarentena, quiero poder elegir entre pagar, usar un pase o probar suerte con los dados.

## Definiciones
- **Dobles**: los dos dados sacan el mismo número.
- **Sueldo**: 200 en las partidas Clásica y Rápida; 100 en la Reducida.
- **Cuarentena**: casilla en la que el jugador queda retenido. Caer en ella al moverse es solo una visita.
- **Salida de la cuarentena**: cuesta 50.
- **Ronda**: se completa cuando el turno vuelve al primer jugador de la lista.

## Requisitos funcionales
- RF-1: CUANDO el jugador con el turno tira los dados (fuera de la cuarentena), EL SISTEMA saca dos dados de 1 a 6,
  avanza su ficha la suma de casillas y aplica el efecto de la casilla en la que cae.
- RF-2: CUANDO un jugador pasa por la Salida o cae en ella al avanzar, EL SISTEMA le paga el sueldo y lo anota en
  el registro.
- RF-3: CUANDO el jugador saca dobles fuera de la cuarentena, EL SISTEMA le deja volver a tirar después de resolver
  la casilla en la que ha caído, salvo que haya acabado en la cuarentena.
- RF-4: CUANDO el jugador saca dobles por tercera vez seguida en el mismo turno, EL SISTEMA lo manda a la cuarentena
  sin mover la ficha con esa tirada ni pagar sueldo, y su turno ya no tira más.
- RF-5: CUANDO el jugador cae en «¡Alerta de fuga!», EL SISTEMA lo manda a la cuarentena sin pasar por la Salida
  (sin sueldo) y su turno ya no tira más aunque hubiera sacado dobles.
- RF-6: MIENTRAS el jugador está en la cuarentena y aún no ha tirado en su turno, EL SISTEMA le deja salir pagando 50
  (si tiene ese efectivo) o usando un pase del veterinario (que se gasta), y después tirar normalmente.
- RF-7: CUANDO el jugador en la cuarentena tira y saca dobles, EL SISTEMA lo saca, avanza la suma de los dados y no
  le deja volver a tirar.
- RF-8: CUANDO el jugador en la cuarentena tira sin sacar dobles por tercera vez, EL SISTEMA anota en el registro
  que tiene que pagar 50 para salir (sin darlo por pagado), se los cobra con las reglas de deuda y ruina de la
  spec 001, lo saca y, una vez pagado, avanza la suma de esa tirada.
- RF-9: CUANDO el jugador en la cuarentena tira sin sacar dobles y aún no es su tercer intento, EL SISTEMA lo deja
  en la cuarentena, cuenta el intento y su turno ya no tira más.
- RF-10: CUANDO el jugador termina su turno, EL SISTEMA da el turno al siguiente jugador que no esté arruinado,
  pone a cero sus dobles y suma una ronda cada vez que el turno vuelve al primero de la lista.

## Requisitos no funcionales
- RNF-1: Los dados son equiprobables e independientes.
- RNF-2: La posición de cada ficha siempre es una casilla del tablero (da la vuelta al llegar al final).
- RNF-3: Cada tirada y cada movimiento quedan registrados para que la interfaz (y los otros dispositivos en red)
  los animen una sola vez.

## Casos límite
- Caer en la casilla de la cuarentena al avanzar: es una visita, no pasa nada.
- Sacar dobles y caer en «¡Alerta de fuga!»: va a la cuarentena y no vuelve a tirar (RF-5).
- Pagar los 50 o usar el pase y luego sacar dobles: vuelve a tirar como en un turno normal (RF-6 y RF-3).
- No tener 50 en efectivo en la cuarentena: no puede pagar antes de tirar, pero sí hipotecar o vender para tenerlos.
- Fallar el tercer intento sin poder pagar 50 ni reuniéndolo todo: se arruina (spec 001) y no avanza.
- Al entrar en la cuarentena se reinician sus intentos, sea cual sea el motivo.
- En la partida Rápida, la ronda 20 es la última (spec de tipos de partida).

## Fuera de alcance
- Efectos de las casillas: compra, alquiler, tasas y cartas (specs 000 y siguientes).
- Movimientos por cartas («avanza hasta…», «retrocede 3 casillas», «vas a la cuarentena»): spec de cartas.
- Gestionar dinosaurios y proponer tratos antes de tirar o al final del turno: specs de recintos y de tratos.
- Cuándo decide la máquina pagar, usar el pase o probar dobles: spec de la máquina.

## Criterios de finalización
- Hay tests que fijan, con dados controlados: avance y vuelta al tablero, sueldo al pasar y al caer en la Salida,
  repetir tras dobles, tercer doble a la cuarentena, «¡Alerta de fuga!», las tres formas de salir de la cuarentena,
  el tercer intento fallido (con y sin efectivo) y el paso del turno y de la ronda. `npm test` termina en OK.

## Dudas abiertas
- Resuelta (2026-10-11): en el tercer intento fallido el registro decía «paga 50 y sale de la cuarentena» antes de
  cobrarlo, y podía ser falso si se abría deuda o se arruinaba. Se corrige el texto (RF-8).
- Resuelta (2026-10-11): los dados usan `Math.random` dentro del motor, sin forma de fijarlos desde fuera. Se acepta
  el cambio mínimo de poder inyectarlos para los tests, como parte de la fase D. No cambia el comportamiento del juego.
