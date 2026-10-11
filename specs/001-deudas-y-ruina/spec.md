# Spec 001 — Deudas y ruina

Estado: implementada

## Contexto y objetivo
Documenta qué ocurre cuando un jugador tiene que pagar (alquiler, tasa, carta o salida de la cuarentena) y no le
llega el efectivo: cómo consigue el dinero, cuándo se arruina, a quién va lo suyo y cuándo termina la partida por
ruina. Cuánto se paga en cada casilla está en la spec 000.

## Usuarios
Cualquier jugador, persona o máquina, en cualquier tipo de partida.

## Historias de usuario
- HU-1. Como jugador sin efectivo suficiente, quiero poder hipotecar o vender recintos para pagar, en lugar de
  arruinarme a la primera.
- HU-2. Como jugador que no puede pagar de ninguna forma, quiero que la partida me saque sin quedarse bloqueada.
- HU-3. Como acreedor, quiero quedarme con lo que tenía quien se arruina por mi culpa.

## Definiciones
- **Cargo**: cantidad que el jugador con el turno tiene que pagar, a otro jugador o al parque.
- **Dinero que podría reunir**: su efectivo, más la mitad del coste de cada recinto o santuario que tiene, más la
  mitad del precio de cada casilla suya sin hipotecar.
- **Deuda**: estado de la partida en el que solo el deudor puede actuar, hasta que paga o se arruina.
- **Arruinarse**: quedar fuera de la partida.

## Requisitos funcionales
- RF-1: CUANDO el jugador tiene que pagar un cargo y tiene efectivo suficiente, EL SISTEMA se lo descuenta, se lo
  da al acreedor (si es el parque, no se lo da a nadie) y el turno sigue.
- RF-2: SI el efectivo no llega pero el dinero que podría reunir sí, ENTONCES EL SISTEMA abre una deuda e indica
  cuánto debe, a quién y cuánto le falta.
- RF-3: MIENTRAS hay una deuda, EL SISTEMA solo deja al deudor desmontar recintos y santuarios (recibe la mitad
  de su coste, siempre del dinosaurio de su zona que más tenga), hipotecar casillas sin recintos en su zona
  (recibe la mitad del precio), pagar o arruinarse. No deja construir, levantar hipotecas, proponer tratos,
  tirar ni terminar el turno, ni actuar a nadie más.
- RF-4: CUANDO el deudor ya tiene efectivo suficiente y paga, EL SISTEMA hace el pago de RF-1 y continúa donde se
  quedó el turno (si la deuda era la salida de la cuarentena a la tercera, avanza con esa tirada).
- RF-5: CUANDO el deudor decide arruinarse, EL SISTEMA lo arruina aunque aún pudiera reunir el dinero. A una
  persona se le pide confirmación antes.
- RF-6: SI el dinero que podría reunir no llega al cargo, ENTONCES EL SISTEMA arruina al jugador en el momento,
  sin abrir deuda.
- RF-7: CUANDO un jugador se arruina frente a otro jugador que sigue en la partida, EL SISTEMA vende al parque sus
  recintos y santuarios por la mitad de su coste y da al acreedor todas sus casillas (las hipotecadas siguen
  hipotecadas, sin que el acreedor pague ningún interés), todo su efectivo y sus pases del veterinario.
- RF-8: CUANDO un jugador se arruina frente al parque (o al pagar a todos los demás), EL SISTEMA deja libres y sin
  hipoteca todas sus casillas, quita sus recintos y pierde su efectivo y sus pases.
- RF-9: CUANDO un jugador se arruina, EL SISTEMA lo deja fuera: sin dinero ni casillas, fuera de la cuarentena,
  sin ficha en el tablero, saltado en los turnos siguientes, y pasa el turno al siguiente jugador. Lo anota en
  el registro diciendo a dónde va lo suyo.
- RF-10: CUANDO solo queda un jugador sin arruinar, EL SISTEMA termina la partida y lo declara ganador.

## Requisitos no funcionales
- RNF-1: La partida nunca se queda bloqueada en una deuda: siempre se puede pagar o arruinarse.
- RNF-2: En todo momento, una deuda abierta es pagable con el dinero que el deudor podría reunir; si no, ya se
  habría arruinado (RF-6).
- RNF-3: En ningún momento un jugador arruinado conserva casillas, ni hay dinero negativo o con decimales.

## Casos límite
- Cargo de 0 o menos: no se cobra nada y el turno sigue.
- El deudor reúne exactamente lo que debe: puede pagar y se queda con 0.
- El deudor se arruina con dinero en efectivo frente al parque: ese efectivo desaparece (RF-8).
- Un pase del veterinario perdido al arruinarse frente al parque vuelve a poder salir en las cartas.
- En la partida Rápida, la ruina también puede terminarla antes de las 20 rondas (RF-10).

## Fuera de alcance
- Importes de alquileres y tasas (spec 000).
- Cargos de las cartas y el reparto de «paga a cada jugador» (spec de cartas).
- Cómo decide la máquina qué hipotecar o vender (spec de la máquina).
- Final por rondas en la partida Rápida (spec de tipos de partida).

## Criterios de finalización
- Hay tests que fijan, con estados preparados a mano: pago directo, apertura de deuda, acciones permitidas y
  prohibidas durante la deuda, pago tras reunir el dinero, ruina inmediata, ruina voluntaria, reparto frente a un
  jugador y frente al parque, y final con un solo jugador. `npm test` termina en OK.

## Dudas abiertas
- [NECESITA ACLARACIÓN] Si alguien se arruina con la carta «paga 25 a cada jugador», los demás no cobran nada: todo
  vuelve al parque (`js/engine.js:418`, solo hay acreedor si es un único jugador). MEMORY.md solo menciona la ruina
  frente al parque por impuestos y cartas de pagar al parque. ¿Es intencionado?
- Resuelta (2026-10-11): el acreedor recibe las casillas hipotecadas sin pagar el 10 % de interés del juego de
  mesa clásico. Es una simplificación intencionada y figura en las reglas simplificadas de MEMORY.md (RF-7).
