/* Spec 004 — Partida en red: fija el comportamiento actual de js/net.js con una red simulada. Uso: npm test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { instalar, esperar, PeerSimulado } = require('./red-simulada.js');
require('../js/net.js');
const { Net } = globalThis;

const PREFIJO = 'islajurasica-';
const ANA = 'AAAAAAAAAAAA', BEA = 'BBBBBBBBBBBB';

function sala() {
  const ev = [];
  const room = new Net.Room(PREFIJO, {
    onJoin: (dev, hola) => ev.push(['join', dev, hola.name]),
    onLeave: (dev) => ev.push(['leave', dev]),
    onMessage: (de, m) => ev.push(['msg', de, m]),
    onStatus: (st) => ev.push(['status', st])
  });
  room.ev = ev;
  return room;
}
async function pasar(t, ms, paso = 500) {
  for (let hecho = 0; hecho < ms; hecho += paso) { t.mock.timers.tick(Math.min(paso, ms - hecho)); await esperar(); }
}
const reloj = (t) => t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
const estados = (room) => room.ev.filter((e) => e[0] === 'status').map((e) => e[1]);

/* Anfitrión con un invitado ya dentro */
async function mesaEnRed(t) {
  reloj(t);
  const ctl = instalar();
  const host = sala(), guest = sala();
  const codigo = await host.open();
  await guest.join(codigo, { dev: ANA, name: 'Ana' });
  await esperar();
  return { ctl, host, guest, codigo };
}

test('RF-4: la jugada del invitado llega al anfitrión como mensaje de su dispositivo', async (t) => {
  const { host, guest } = await mesaEnRed(t);
  assert.equal(guest.toHost({ t: 'act', cmd: 'roll', args: [] }), true);
  await esperar();
  assert.deepEqual(host.ev.at(-1), ['msg', ANA, { t: 'act', cmd: 'roll', args: [] }]);
  host.close(); guest.close();
});

test('RF-6: un invitado que contesta a los latidos sigue en línea', async (t) => {
  const { host, guest } = await mesaEnRed(t);
  await pasar(t, 30000);
  assert.equal(host.online(ANA), true);
  assert.deepEqual(host.ev, [['join', ANA, 'Ana']]);
  assert.deepEqual(estados(guest), ['online']);
  host.close(); guest.close();
});

test('RF-6: si un dispositivo deja de hablar, el anfitrión lo da por desconectado entre los 15 y los 20 s', async (t) => {
  reloj(t);
  instalar();
  const host = sala();
  const codigo = await host.open();
  const p = new PeerSimulado();
  await esperar();
  const conn = p.connect(PREFIJO + codigo);
  await esperar();
  conn.send({ t: 'hello', dev: BEA, name: 'Bea' });
  await esperar();
  await pasar(t, 15000);
  assert.equal(host.online(BEA), true, 'a los 15 s aún cuenta');
  await pasar(t, 5000);
  assert.equal(host.online(BEA), false);
  assert.deepEqual(host.ev, [['join', BEA, 'Bea'], ['leave', BEA]]);
  host.close();
});

test('RF-6: si el anfitrión deja de hablar, el invitado pasa a reconectar entre los 15 y los 20 s', async (t) => {
  reloj(t);
  instalar();
  const mudo = new PeerSimulado(PREFIJO + 'MUDO');
  await esperar();
  const guest = sala();
  await guest.join('MUDO', { dev: ANA, name: 'Ana' });
  await pasar(t, 15000);
  assert.deepEqual(estados(guest), ['online']);
  await pasar(t, 5000);
  assert.equal(estados(guest)[1], 'reconnecting');
  guest.close(); mudo.destroy();
});

test('RF-7: si el anfitrión se va, el invitado no puede mandar jugadas y reintenta cada 3 s', async (t) => {
  const { ctl, host, guest } = await mesaEnRed(t);
  host.close();
  await esperar();
  assert.deepEqual(estados(guest), ['online', 'reconnecting']);
  assert.equal(guest.toHost({ t: 'act', cmd: 'roll' }), false);
  const intentos = () => ctl.creados.filter((id) => id.startsWith('anonimo-')).length;
  const antes = intentos();
  await pasar(t, 9000);
  assert.equal(intentos() - antes, 3, 'un intento cada 3 s');
  guest.close();
});

test('RF-7: cuando el anfitrión vuelve con el mismo código, el invitado reconecta solo y se presenta', async (t) => {
  const { host, guest, codigo } = await mesaEnRed(t);
  host.close();
  await pasar(t, 4000);
  const host2 = sala();
  assert.equal(await host2.open(codigo), codigo);
  await pasar(t, 3500);
  assert.deepEqual(host2.ev, [['join', ANA, 'Ana']]);
  assert.equal(estados(guest).at(-1), 'online');
  assert.equal(guest.toHost({ t: 'act', cmd: 'roll' }), true);
  host2.close(); guest.close();
});

test('RF-9: al reabrir con el código aún ocupado, reintenta cada 3 s hasta recuperarlo', async (t) => {
  reloj(t);
  const ctl = instalar();
  ctl.ocupar(PREFIJO + 'ABCD');
  await esperar();
  const host = sala();
  let codigo = null;
  host.open('ABCD').then((c) => { codigo = c; });
  await pasar(t, 6000);
  assert.equal(codigo, null);
  assert.equal(ctl.creados.filter((id) => id === PREFIJO + 'ABCD').length, 3, 'el ocupante y 2 intentos');
  ctl.liberar(PREFIJO + 'ABCD');
  await pasar(t, 3000);
  assert.equal(codigo, 'ABCD');
  host.close();
});

test('RF-9: si el código no se libera nunca, lo intenta 41 veces y se rinde', async (t) => {
  reloj(t);
  const ctl = instalar();
  ctl.ocupar(PREFIJO + 'ABCD');
  await esperar();
  const host = sala();
  let error = null;
  host.open('ABCD').catch((e) => { error = e; });
  await pasar(t, 125000, 1000);
  assert.equal(error, 'unavailable-id');
  assert.equal(ctl.creados.filter((id) => id === PREFIJO + 'ABCD').length, 1 + 41);
  host.close();
});
