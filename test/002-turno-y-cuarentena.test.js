/* Spec 002 — Turno, movimiento y cuarentena: fija el comportamiento actual. Uso: npm test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mesa, dar, tirar } = require('./mesa.js');

const en = (g, p, pos, extra) => Object.assign(g.s.players[p], { pos }, extra);

test('RF-1: se avanza la suma de los dados y se aplica la casilla', () => {
  const g = mesa();
  assert.deepEqual(tirar(g, 0, 2, 3), [0, 0]);
  assert.equal(g.s.players[0].pos, 5);
  assert.deepEqual(g.s.dice, [2, 3]);
  assert.equal(g.s.phase, 'buy');
});

test('RF-2: pasar por la Salida paga el sueldo y da la vuelta al tablero', () => {
  const g = mesa();
  en(g, 0, 38);
  assert.deepEqual(tirar(g, 0, 1, 2), [200, 0]);
  assert.equal(g.s.players[0].pos, 1);
  assert.match(g.s.log.join('\n'), /<b>J0<\/b> pasa por la Salida y cobra 200\./);
});

test('RF-2: caer justo en la Salida también paga el sueldo', () => {
  const g = mesa();
  en(g, 0, 35);
  assert.deepEqual(tirar(g, 0, 2, 3), [200, 0]);
  assert.equal(g.s.players[0].pos, 0);
  assert.equal(g.s.phase, 'main');
});

test('RF-2: en la partida Reducida el sueldo es 100', () => {
  const g = mesa({ modo: 'reducida' });
  en(g, 0, 22);
  assert.deepEqual(tirar(g, 0, 1, 2), [100, 0]);
  assert.equal(g.s.players[0].pos, 1);
});

test('RF-3: con dobles se vuelve a tirar tras resolver la casilla', () => {
  const g = mesa();
  en(g, 0, 18);
  tirar(g, 0, 1, 1);
  assert.equal(g.s.players[0].pos, 20);
  assert.equal(g.s.phase, 'roll');
  assert.equal(g.s.again, true);
  assert.equal(g.s.doubles, 1);
});

test('RF-4: el tercer doble seguido manda a la cuarentena sin mover ni cobrar sueldo', () => {
  const g = mesa();
  en(g, 0, 0);
  g.s.doubles = 2;
  assert.deepEqual(tirar(g, 0, 1, 1), [0, 0]);
  const pl = g.s.players[0];
  assert.deepEqual([pl.pos, pl.jail, g.s.phase, g.s.again], [10, true, 'main', false]);
});

test('RF-5: «¡Alerta de fuga!» manda a la cuarentena sin sueldo y anula los dobles', () => {
  const g = mesa();
  en(g, 0, 26);
  assert.deepEqual(tirar(g, 0, 2, 2), [0, 0]);
  const pl = g.s.players[0];
  assert.deepEqual([pl.pos, pl.jail, g.s.phase, g.s.again], [10, true, 'main', false]);
});

test('caso límite: caer en la Cuarentena es solo una visita', () => {
  const g = mesa();
  en(g, 0, 4);
  tirar(g, 0, 3, 3);
  assert.deepEqual([g.s.players[0].pos, g.s.players[0].jail, g.s.phase], [10, false, 'roll']);
});

test('RNF-3: la tirada y el movimiento quedan como efectos numerados en orden', () => {
  const g = mesa();
  tirar(g, 0, 2, 3);
  assert.deepEqual(g.s.fx.map((e) => e.k), ['dice', 'move']);
  assert.ok(g.s.fx[1].n > g.s.fx[0].n);
  assert.deepEqual([g.s.fx[0].a, g.s.fx[0].b, g.s.fx[1].from, g.s.fx[1].to], [2, 3, 0, 5]);
});

const preso = (g, p, extra) => en(g, p, 10, Object.assign({ jail: true, tries: 0 }, extra));

test('RF-6: pagar 50 saca de la cuarentena y luego se tira normalmente (dobles incluidos)', () => {
  const g = mesa();
  preso(g, 0);
  assert.equal(g.payJail(), true);
  assert.deepEqual([g.s.players[0].money, g.s.players[0].jail, g.s.phase], [1450, false, 'roll']);
  tirar(g, 0, 2, 2);
  assert.equal(g.s.players[0].pos, 14);
  assert.equal(g.s.again, true);
});

test('RF-6: el pase del veterinario saca de la cuarentena y se gasta', () => {
  const g = mesa();
  preso(g, 0, { passes: ['exp'] });
  assert.equal(g.usePass(), true);
  assert.deepEqual([g.s.players[0].passes, g.s.players[0].jail], [[], false]);
  assert.equal(g.usePass(), false);
});

test('RF-6: sin 50 en efectivo no se puede pagar la salida', () => {
  const g = mesa();
  preso(g, 0, { money: 40 });
  assert.equal(g.payJail(), false);
  assert.equal(g.s.players[0].jail, true);
});

test('RF-7: con dobles se sale, se avanza y no se vuelve a tirar', () => {
  const g = mesa();
  preso(g, 0);
  assert.deepEqual(tirar(g, 0, 3, 3), [0, 0]);
  assert.deepEqual([g.s.players[0].jail, g.s.players[0].pos, g.s.again], [false, 16, false]);
});

test('RF-8: al tercer intento fallido paga 50, sale y avanza', () => {
  const g = mesa();
  preso(g, 0, { tries: 2 });
  assert.deepEqual(tirar(g, 0, 1, 2), [-50, 0]);
  assert.deepEqual([g.s.players[0].jail, g.s.players[0].pos], [false, 13]);
  assert.match(g.s.log.join('\n'), /<b>J0<\/b> no saca dobles a la tercera: tiene que pagar 50 para salir de la cuarentena\./);
  assert.doesNotMatch(g.s.log.join('\n'), /paga 50 y sale/);
});

test('RF-8: al tercer intento sin efectivo, deuda; tras pagarla avanza con esa tirada', () => {
  const g = mesa();
  preso(g, 0, { tries: 2, money: 10 });
  dar(g, 0, 'trice');
  tirar(g, 0, 1, 2);
  assert.equal(g.s.phase, 'debt');
  assert.deepEqual(g.s.debt, { p: 0, n: 50, to: -1, then: 'move' });
  assert.equal(g.s.players[0].pos, 10);
  g.mortgage(34);
  assert.equal(g.settle(), true);
  assert.deepEqual([g.s.players[0].pos, g.s.players[0].money], [13, 10 + 160 - 50]);
});

test('RF-8: al tercer intento sin poder reunir 50, se arruina y no avanza', () => {
  const g = mesa({ jugadores: 3 });
  preso(g, 0, { tries: 2, money: 10 });
  tirar(g, 0, 1, 2);
  assert.deepEqual([g.s.players[0].out, g.s.players[0].pos, g.s.turn], [true, 10, 1]);
});

test('RF-9: sin dobles y antes del tercer intento, sigue en la cuarentena y acaba la tirada', () => {
  const g = mesa();
  preso(g, 0);
  assert.deepEqual(tirar(g, 0, 1, 2), [0, 0]);
  const pl = g.s.players[0];
  assert.deepEqual([pl.jail, pl.tries, pl.pos, g.s.phase], [true, 1, 10, 'main']);
});

test('caso límite: al entrar en la cuarentena los intentos vuelven a 0', () => {
  const g = mesa();
  en(g, 0, 26, { tries: 2 });
  tirar(g, 0, 2, 2);
  assert.deepEqual([g.s.players[0].jail, g.s.players[0].tries], [true, 0]);
});

test('RF-10: al terminar el turno pasa al siguiente, suma una ronda al volver al primero y pone a cero los dobles', () => {
  const g = mesa({ jugadores: 3 });
  assert.equal(g.endTurn(), false, 'no se puede terminar antes de tirar');
  Object.assign(g.s, { turn: 1, phase: 'main', doubles: 1, again: true });
  assert.equal(g.endTurn(), true);
  assert.deepEqual([g.s.turn, g.s.round, g.s.phase, g.s.doubles, g.s.again], [2, 1, 'roll', 0, false]);
  g.s.phase = 'main';
  g.endTurn();
  assert.deepEqual([g.s.turn, g.s.round], [0, 2]);
});
