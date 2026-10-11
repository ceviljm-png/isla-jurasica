/* Spec 003 — Salas en red: fija el comportamiento actual de js/net.js con una red simulada. Uso: npm test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { instalar, esperar, PeerSimulado } = require('./red-simulada.js');
require('../js/net.js');
const { Net } = globalThis;

const PREFIJO = 'islajurasica-';
const ANA = 'AAAAAAAAAAAA', BEA = 'BBBBBBBBBBBB';

/* Sala que apunta todo lo que le pasa en una lista */
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
/* Avanza el reloj simulado de a poco, dejando pasar la red entre medias */
async function pasar(t, ms, paso = 500) {
  for (let hecho = 0; hecho < ms; hecho += paso) { t.mock.timers.tick(Math.min(paso, ms - hecho)); await esperar(); }
}
const reloj = (t) => t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });

test('RF-1: crear sala da un código de 4 letras sin I ni O', async (t) => {
  reloj(t);
  const ctl = instalar();
  const host = sala();
  const codigo = await host.open();
  assert.match(codigo, /^[A-HJ-NP-Z]{4}$/);
  assert.ok(ctl.registrado(PREFIJO + codigo));
  host.close();
});

test('RF-1: si los códigos están ocupados, lo intenta 7 veces y se rinde', async (t) => {
  reloj(t);
  const ctl = instalar({ todoOcupado: true });
  const host = sala();
  let error = null;
  host.open().catch((e) => { error = e; });
  for (let i = 0; i < 20 && !error; i++) { await esperar(); t.mock.timers.tick(0); }
  assert.equal(error, 'unavailable-id');
  assert.equal(ctl.creados.filter((id) => id.startsWith(PREFIJO)).length, 7);
  host.close();
});

test('RF-2: el código se limpia a 4 letras mayúsculas', () => {
  assert.equal(Net.cleanCode(' ab-c9d '), 'ABCD');
  assert.equal(Net.cleanCode('xyzwq'), 'XYZW');
  assert.equal(Net.cleanCode(null), '');
});

test('RF-2: unirse conecta con la sala y se presenta con nombre y dispositivo', async (t) => {
  reloj(t);
  instalar();
  const host = sala(), guest = sala();
  const codigo = await host.open();
  const c = await guest.join(' ' + codigo.toLowerCase() + '!', { dev: ANA, name: 'Ana' });
  assert.equal(c, codigo);
  await esperar();
  assert.deepEqual(host.ev, [['join', ANA, 'Ana']]);
  assert.deepEqual(guest.ev, [['status', 'online']]);
  assert.equal(host.online(ANA), true);
  host.close(); guest.close();
});

test('RF-4: sin sala con ese código, falla con peer-unavailable', async (t) => {
  reloj(t);
  instalar();
  const guest = sala();
  await assert.rejects(guest.join('ZZZZ', { dev: ANA, name: 'Ana' }), (e) => e === 'peer-unavailable');
  guest.close();
});

test('RF-4: si la sala no contesta, falla con timeout a los 15 segundos', async (t) => {
  reloj(t);
  const ctl = instalar();
  const host = sala();
  const codigo = await host.open();
  ctl.mudo(PREFIJO + codigo);
  const guest = sala();
  let error = null;
  guest.join(codigo, { dev: ANA, name: 'Ana' }).catch((e) => { error = e; });
  await pasar(t, 14500);
  assert.equal(error, null, 'aún espera a los 14,5 s');
  await pasar(t, 1000);
  assert.equal(error, 'timeout');
  host.close(); guest.close();
});


/* Un dispositivo que habla con la sala a mano, sin pasar por Net.Room */
async function crudo(codigo) {
  const p = new PeerSimulado();
  await esperar();
  const conn = p.connect(PREFIJO + codigo);
  await esperar();
  return conn;
}

test('RNF-2: el anfitrión ignora mensajes de quien no se ha presentado bien', async (t) => {
  reloj(t);
  instalar();
  const host = sala();
  const codigo = await host.open();
  const conn = await crudo(codigo);
  conn.send({ t: 'act', cmd: 'roll' });
  conn.send({ t: 'hello', dev: 'abc', name: 'Malo' });
  conn.send('texto suelto');
  await esperar();
  assert.deepEqual(host.ev, []);
  conn.send({ t: 'hello', dev: BEA, name: 'Bea' });
  conn.send({ t: 'act', cmd: 'roll' });
  await esperar();
  assert.deepEqual(host.ev, [['join', BEA, 'Bea'], ['msg', BEA, { t: 'act', cmd: 'roll' }]]);
  host.close();
});

test('RF-6: si el mismo dispositivo vuelve a entrar, sustituye a su conexión anterior', async (t) => {
  reloj(t);
  instalar();
  const host = sala();
  const codigo = await host.open();
  const vieja = await crudo(codigo);
  vieja.send({ t: 'hello', dev: ANA, name: 'Ana' });
  await esperar();
  const nueva = await crudo(codigo);
  nueva.send({ t: 'hello', dev: ANA, name: 'Ana 2' });
  await esperar();
  assert.equal(vieja.open, false, 'la conexión vieja se cierra');
  assert.equal(nueva.open, true);
  assert.deepEqual(host.ev, [['join', ANA, 'Ana'], ['join', ANA, 'Ana 2']], 'sin aviso de salida');
  host.close();
});

test('RF-7: al expulsar, el invitado recibe el motivo y se le cierra la conexión', async (t) => {
  reloj(t);
  instalar();
  const host = sala(), guest = sala();
  const codigo = await host.open();
  await guest.join(codigo, { dev: ANA, name: 'Ana' });
  await esperar();
  host.kick(ANA, { t: 'kick', why: 'La sala está llena.' });
  assert.equal(host.online(ANA), false);
  await esperar();
  assert.deepEqual(guest.ev.filter((e) => e[0] === 'msg'), [['msg', 'host', { t: 'kick', why: 'La sala está llena.' }]]);
  assert.equal(guest.conn.open, true, 'aún abierta antes de 400 ms');
  await pasar(t, 400, 400);
  assert.equal(guest.conn, null, 'cerrada: el invitado pasa a reconectar');
  assert.deepEqual(guest.ev.at(-1), ['status', 'reconnecting']);
  host.close(); guest.close();
});

test('RF-8: cuando un invitado se va, el anfitrión recibe el aviso', async (t) => {
  reloj(t);
  instalar();
  const host = sala(), guest = sala();
  const codigo = await host.open();
  await guest.join(codigo, { dev: ANA, name: 'Ana' });
  await esperar();
  guest.close();
  await esperar();
  assert.deepEqual(host.ev, [['join', ANA, 'Ana'], ['leave', ANA]]);
  assert.equal(host.online(ANA), false);
  host.close();
});

test('el identificador del dispositivo son 12 letras y no cambia', () => {
  const a = Net.deviceId('isla-jurasica-prueba'), b = Net.deviceId('isla-jurasica-prueba');
  assert.match(a, /^[A-Z]{12}$/);
  assert.equal(a, b);
});
