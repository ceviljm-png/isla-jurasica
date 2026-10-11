/* Spec 000 — Alquileres y tasas: fija el comportamiento actual. Uso: npm test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mesa, casilla, dar, caer, total } = require('./mesa.js');

test('la ayuda prepara una mesa y localiza casillas', () => {
  const g = mesa();
  assert.equal(g.s.players.length, 2);
  assert.equal(g.sq(casilla(g, 'trex')).n, 'Tyrannosaurus rex');
  assert.equal(g.sq(casilla(g, 'Helipuerto')).t, 'tren');
  assert.throws(() => casilla(g, 'nada'));
});

const ultimo = (g) => g.s.log[g.s.log.length - 1] || '';

test('RF-1: casilla libre, no se paga y se ofrece comprarla', () => {
  const g = mesa();
  assert.deepEqual(caer(g, 1, 'compy'), [0, 0]);
  assert.equal(g.s.phase, 'buy');
});

test('RF-1: casilla propia, no se paga', () => {
  const g = mesa();
  dar(g, 1, 'compy');
  assert.deepEqual(caer(g, 1, 'compy'), [0, 0]);
});

test('RF-1: ajena e hipotecada, no se paga y queda en el registro', () => {
  const g = mesa();
  dar(g, 0, 'compy', { hipoteca: true });
  assert.deepEqual(caer(g, 1, 'compy'), [0, 0]);
  assert.match(ultimo(g), /Compsognathus, hipotecado: no paga nada/);
});

test('RF-2: solar sin zona completa', () => {
  const g = mesa();
  dar(g, 0, 'compy');
  assert.deepEqual(caer(g, 1, 'compy'), [2, -2]);
});

test('RF-2: solar con la zona completa cobra el doble', () => {
  const g = mesa();
  dar(g, 0, ['compy', 'galli']);
  assert.deepEqual(caer(g, 1, 'compy'), [4, -4]);
});

test('RF-2: la zona completa cobra el doble aunque otro de la zona esté hipotecado (duda 1)', () => {
  const g = mesa();
  dar(g, 0, 'compy');
  dar(g, 0, 'galli', { hipoteca: true });
  assert.deepEqual(caer(g, 1, 'compy'), [4, -4]);
});

test('RF-3: recintos y santuario cobran su importe, sin duplicar por la zona', () => {
  [200, 600, 1400, 1700, 2000].forEach((importe, k) => {
    const g = mesa({ dinero: 5000 });
    dar(g, 0, ['velo', 'trex'], { recintos: k + 1 });
    assert.deepEqual(caer(g, 1, 'trex'), [importe, -importe], (k + 1) + ' recintos');
  });
});

test('RF-7: el dueño cobra el importe completo y queda en el registro', () => {
  const g = mesa();
  dar(g, 0, ['velo', 'trex']);
  const d = caer(g, 1, 'trex');
  assert.equal(d[0], -d[1]);
  assert.equal(d[0], 100);
  assert.ok(Number.isInteger(d[0]));
  assert.equal(ultimo(g), '<b>J1</b> cae en Tyrannosaurus rex y paga 100 a <b>J0</b>.');
});

const TRENES = ['Helipuerto', 'Monorraíl', 'Embarcadero', 'Teleférico'];

test('RF-4: los transportes cobran según cuántos tiene el dueño (tablero de 40)', () => {
  [25, 50, 100, 200].forEach((importe, k) => {
    const g = mesa();
    dar(g, 0, TRENES.slice(0, k + 1));
    assert.deepEqual(caer(g, 1, 'Helipuerto'), [importe, -importe], (k + 1) + ' transportes');
  });
});

test('RF-4: los transportes hipotecados también cuentan', () => {
  const g = mesa();
  dar(g, 0, 'Helipuerto');
  dar(g, 0, TRENES.slice(1), { hipoteca: true });
  assert.deepEqual(caer(g, 1, 'Helipuerto'), [200, -200]);
});

test('RF-4: los transportes cobran según cuántos tiene el dueño (tablero de 24)', () => {
  [50, 100].forEach((importe, k) => {
    const g = mesa({ modo: 'reducida' });
    dar(g, 0, TRENES.slice(0, k + 1));
    assert.deepEqual(caer(g, 1, 'Helipuerto'), [importe, -importe], (k + 1) + ' transportes');
  });
});

test('RF-5: una instalación cobra 4 veces la tirada', () => {
  const g = mesa();
  dar(g, 0, 'Central geotérmica');
  assert.deepEqual(caer(g, 1, 'Central geotérmica', [3, 4]), [28, -28]);
});

test('RF-5: las dos instalaciones cobran 10 veces la tirada, aunque una esté hipotecada', () => {
  const g = mesa();
  dar(g, 0, 'Central geotérmica');
  dar(g, 0, 'Laboratorio genético', { hipoteca: true });
  assert.deepEqual(caer(g, 1, 'Central geotérmica', [3, 4]), [70, -70]);
});

test('RF-6: las tasas se pierden: no las cobra nadie', () => {
  for (const [modo, tasas] of [['clasica', [['Seguro de visitantes', 200], ['Pienso de lujo', 100]]],
    ['reducida', [['Seguro de visitantes', 100], ['Pienso de lujo', 50]]]]) {
    for (const [nombre, importe] of tasas) {
      const g = mesa({ modo });
      const antes = total(g);
      assert.deepEqual(caer(g, 1, nombre), [0, -importe], modo + ' · ' + nombre);
      assert.equal(total(g), antes - importe);
    }
  }
});
