/* Ayuda común de los tests de caracterización: prepara a mano el estado de una partida.
   No contiene reglas propias; todo lo que comprueban los tests lo hace el motor. */
const { Game } = require('../js/engine.js');

/* Partida con jugadores persona J0, J1…, sin registro ni efectos pendientes */
function mesa({ modo = 'clasica', jugadores = 2, dinero } = {}) {
  const g = Game.create({ mode: modo, level: 'normal', players: Array.from({ length: jugadores }, (_, i) => ({ name: 'J' + i, ai: false })) });
  if (dinero != null) g.s.players.forEach((pl) => { pl.money = dinero; });
  g.s.log = [];
  g.s.fx = [];
  return g;
}

/* Índice de una casilla por clave de dinosaurio ('trex') o por nombre ('Helipuerto') */
function casilla(g, clave) {
  const i = g.B.sq.findIndex((q) => q.key === clave || q.n === clave);
  if (i < 0) throw new Error('No hay ninguna casilla «' + clave + '» en este tablero');
  return i;
}

/* Pone a p como dueño de esas casillas, con recintos (0-5) o hipotecadas */
function dar(g, p, claves, { recintos = 0, hipoteca = false } = {}) {
  for (const clave of [].concat(claves)) {
    const i = casilla(g, clave);
    g.s.owner[i] = p;
    g.s.houses[i] = recintos;
    g.s.mort[i] = hipoteca;
  }
}

/* El jugador p llega a la casilla tras tirar esos dados. Devuelve el cambio de dinero de cada jugador */
function caer(g, p, clave, dados = [3, 4]) {
  const s = g.s, antes = s.players.map((pl) => pl.money);
  s.turn = p;
  s.phase = 'roll';
  s.again = false;
  s.dice = dados.slice();
  s.players[p].pos = casilla(g, clave);
  g.land(1);
  return s.players.map((pl, i) => pl.money - antes[i]);
}

/* Cargo del motor al jugador p con el turno: a = acreedor (-1 el parque, 'todos' los demás). Devuelve el cambio de dinero */
function cobrar(g, p, n, a = -1) {
  const s = g.s, antes = s.players.map((pl) => pl.money);
  s.turn = p;
  s.phase = 'main';
  s.again = false;
  g.charge(p, n, a);
  return s.players.map((pl, i) => pl.money - antes[i]);
}

/* El jugador p tira con esos dados (en orden). Devuelve el cambio de dinero de cada jugador */
function tirar(g, p, ...dados) {
  const s = g.s, antes = s.players.map((pl) => pl.money);
  s.turn = p;
  s.phase = 'roll';
  g.dado = () => {
    if (!dados.length) throw new Error('El test no ha previsto más dados');
    return dados.shift();
  };
  g.roll();
  return s.players.map((pl, i) => pl.money - antes[i]);
}

const total = (g) => g.s.players.reduce((n, pl) => n + pl.money, 0);

module.exports = { mesa, casilla, dar, caer, cobrar, tirar, total };
