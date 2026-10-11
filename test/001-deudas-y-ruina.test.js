/* Spec 001 — Deudas y ruina: fija el comportamiento actual. Uso: npm test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mesa, casilla, dar, caer, cobrar, total } = require('./mesa.js');

/* J1 con 10 de efectivo, la Pradera con 1 recinto en cada dinosaurio y el Triceratops: podría reunir 280.
   J0 tiene el Velociraptor y el T. rex: su alquiler es 100. */
function deudaTipica(jugadores = 2) {
  const g = mesa({ jugadores });
  dar(g, 1, ['compy', 'galli'], { recintos: 1 });
  dar(g, 1, 'trice');
  dar(g, 0, ['velo', 'trex']);
  g.s.players[1].money = 10;
  return g;
}
const idx = (g, ...claves) => claves.map((c) => casilla(g, c));

test('RF-1: con efectivo suficiente se paga y el turno sigue', () => {
  const g = mesa();
  dar(g, 0, ['velo', 'trex']);
  assert.deepEqual(caer(g, 1, 'trex'), [100, -100]);
  assert.equal(g.s.phase, 'main');
  assert.equal(g.s.debt, null);
});

test('RF-2: si el efectivo no llega pero podría reunirlo, se abre una deuda sin mover dinero', () => {
  const g = deudaTipica();
  assert.equal(g.liquid(1), 280);
  assert.deepEqual(caer(g, 1, 'trex'), [0, 0]);
  assert.equal(g.s.phase, 'debt');
  assert.deepEqual(g.s.debt, { p: 1, n: 100, to: 0, then: null });
  assert.equal(g.actor(), 1);
});

test('RF-3: durante la deuda solo se puede desmontar, hipotecar, pagar o arruinarse', () => {
  const g = deudaTipica();
  caer(g, 1, 'trex');
  const [compy, , trice, velo] = idx(g, 'compy', 'galli', 'trice', 'velo');
  assert.equal(g.build(compy), false, 'construir');
  assert.equal(g.trade({ from: 1, to: 0, give: [trice], get: [], giveMoney: 0, getMoney: 0 }), false, 'tratar');
  assert.equal(g.roll(), false, 'tirar');
  assert.equal(g.endTurn(), false, 'terminar el turno');
  assert.equal(g.mortgage(velo), false, 'hipotecar algo de otro');
  assert.equal(g.sell(compy), true, 'desmontar');
  assert.equal(g.s.players[1].money, 35);
  assert.equal(g.mortgage(compy), false, 'hipotecar con recintos en la zona');
  assert.equal(g.mortgage(trice), true, 'hipotecar');
  assert.equal(g.s.players[1].money, 195);
  assert.equal(g.unmortgage(trice), false, 'levantar la hipoteca');
  assert.equal(g.s.phase, 'debt');
});

test('RF-4: no se puede pagar hasta tener el efectivo; al pagar, el turno sigue', () => {
  const g = deudaTipica();
  caer(g, 1, 'trex');
  assert.equal(g.settle(), false);
  assert.equal(g.s.phase, 'debt');
  g.mortgage(casilla(g, 'trice'));
  const antes = g.s.players.map((pl) => pl.money);
  assert.equal(g.settle(), true);
  assert.deepEqual(g.s.players.map((pl, i) => pl.money - antes[i]), [100, -100]);
  assert.equal(g.s.phase, 'main');
  assert.equal(g.s.debt, null);
});

test('RF-5: el deudor puede arruinarse aunque pudiera reunir el dinero', () => {
  const g = deudaTipica(3);
  caer(g, 1, 'trex');
  assert.equal(g.declare(), true);
  assert.equal(g.s.players[1].out, true);
  assert.equal(g.declare(), false, 'sin deuda ya no hay nada que declarar');
});

test('RF-6: si ni reuniéndolo todo llega, se arruina en el momento, sin deuda', () => {
  const g = mesa({ jugadores: 3 });
  dar(g, 0, ['velo', 'trex']);
  g.s.players[1].money = 10;
  caer(g, 1, 'trex');
  assert.equal(g.s.players[1].out, true);
  assert.notEqual(g.s.phase, 'debt');
});

test('RF-1: un cargo de 0 no cobra nada y el turno sigue', () => {
  const g = mesa();
  assert.deepEqual(cobrar(g, 1, 0), [0, 0]);
  assert.equal(g.s.phase, 'main');
});

test('RF-2: un cargo al parque sin efectivo también abre deuda', () => {
  const g = deudaTipica();
  assert.deepEqual(cobrar(g, 1, 200), [0, 0]);
  assert.deepEqual(g.s.debt, { p: 1, n: 200, to: -1, then: null });
});

test('RNF-3: el dinero sigue siendo entero y no negativo', () => {
  const g = deudaTipica();
  caer(g, 1, 'trex');
  g.sell(casilla(g, 'compy'));
  g.mortgage(casilla(g, 'trice'));
  g.settle();
  assert.ok(g.s.players.every((pl) => Number.isInteger(pl.money) && pl.money >= 0));
  assert.equal(total(g), 1500 + 10 + 25 + 160);
});

const sinCasillas = (g) => g.s.players.every((pl, i) => !pl.out || g.owned(i).length === 0);

test('RF-7: frente a otro jugador, el acreedor se queda casillas, efectivo, recintos vendidos y pases', () => {
  const g = deudaTipica(3);
  g.s.mort[casilla(g, 'trice')] = true;
  g.s.players[1].passes = ['exp'];
  caer(g, 1, 'trex');
  assert.equal(g.s.phase, 'debt');
  const antes = g.s.players[0].money;
  g.declare();
  const [compy, galli, trice] = idx(g, 'compy', 'galli', 'trice');
  assert.deepEqual([compy, galli, trice].map((i) => g.s.owner[i]), [0, 0, 0]);
  assert.deepEqual([compy, galli].map((i) => g.s.houses[i]), [0, 0]);
  assert.equal(g.s.mort[trice], true, 'la hipoteca pasa tal cual, sin interés');
  assert.equal(g.s.players[0].money - antes, 10 + 25 + 25);
  assert.deepEqual(g.s.players[0].passes, ['exp']);
  assert.ok(sinCasillas(g));
});

test('RF-8: frente al parque, las casillas quedan libres y sin hipoteca, y el efectivo y los pases se pierden', () => {
  const g = mesa({ jugadores: 3 });
  dar(g, 1, 'compy', { hipoteca: true });
  g.s.players[1].money = 10;
  g.s.players[1].passes = ['inc'];
  const antes = total(g);
  cobrar(g, 1, 200);
  const compy = casilla(g, 'compy');
  assert.equal(g.s.players[1].out, true);
  assert.equal(g.s.owner[compy], -1);
  assert.equal(g.s.mort[compy], false);
  assert.equal(total(g), antes - 10);
  assert.ok(g.s.players.every((pl) => pl.passes.length === 0));
});

test('RF-8: frente al parque, los recintos se quitan', () => {
  const g = mesa({ jugadores: 3 });
  dar(g, 1, ['compy', 'galli'], { recintos: 1 });
  g.s.players[1].money = 0;
  cobrar(g, 1, 1000);
  assert.deepEqual(idx(g, 'compy', 'galli').map((i) => [g.s.owner[i], g.s.houses[i]]), [[-1, 0], [-1, 0]]);
});

test('RF-8 (duda 1): arruinarse al pagar a todos los demás no da nada a nadie', () => {
  const g = mesa({ jugadores: 3 });
  g.s.players[1].money = 0;
  assert.deepEqual(cobrar(g, 1, 50, 'todos'), [0, 0, 0]);
  assert.equal(g.s.players[1].out, true);
});

test('RF-9: el arruinado queda fuera y se salta en los turnos', () => {
  const g = mesa({ jugadores: 3 });
  dar(g, 0, ['velo', 'trex']);
  dar(g, 1, 'compy', { hipoteca: true });
  Object.assign(g.s.players[1], { money: 10, jail: true });
  caer(g, 1, 'trex');
  const pl = g.s.players[1];
  assert.deepEqual([pl.out, pl.money, pl.jail, g.owned(1).length], [true, 0, false, 0]);
  assert.equal(g.s.turn, 2);
  assert.equal(g.s.phase, 'roll');
  assert.match(g.s.log.join('\n'), /<b>J1<\/b> se arruina y todo lo suyo pasa a <b>J0<\/b>/);
  g.s.phase = 'main';
  g.endTurn();
  assert.equal(g.s.turn, 0);
  g.s.phase = 'main';
  g.endTurn();
  assert.equal(g.s.turn, 2, 'se salta a J1');
});

test('RF-10: cuando solo queda uno, gana y la partida termina', () => {
  const g = mesa();
  dar(g, 0, ['velo', 'trex']);
  g.s.players[1].money = 10;
  caer(g, 1, 'trex');
  assert.equal(g.s.phase, 'over');
  assert.equal(g.s.winner, 0);
  assert.ok(sinCasillas(g));
});
