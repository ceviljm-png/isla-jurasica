/* Partidas completas máquina contra máquina para comprobar las reglas.  Uso: node test/sim.js [partidas] */
const { Game, MODES, LEVELS, ownable } = require('../js/engine.js');
const AI = require('../js/ai.js');

const N = Number(process.argv[2]) || 60;
const MAX_TURNS = 1500;
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

function check(g) {
  const s = g.s, B = g.B;
  s.players.forEach((pl, i) => {
    assert(pl.money >= 0 && Number.isInteger(pl.money), 'dinero inválido de ' + i + ': ' + pl.money);
    assert(pl.pos >= 0 && pl.pos < B.sq.length, 'posición fuera del tablero');
    if (pl.out) assert(!g.owned(i).length, 'un arruinado conserva dinosaurios');
  });
  B.sq.forEach((q, i) => {
    if (!ownable(q)) return assert(s.owner[i] === null && !s.houses[i], 'casilla especial con dueño');
    assert(s.owner[i] >= -1 && s.owner[i] < s.players.length, 'dueño inválido');
    if (s.owner[i] === -1) assert(!s.mort[i] && !s.houses[i], 'casilla libre hipotecada o con recintos');
    if (s.mort[i]) assert(!s.houses[i], 'hipoteca con recintos');
  });
  B.groups.forEach((gr) => {
    const h = gr.sq.map((j) => s.houses[j]);
    if (h.some((x) => x > 0)) {
      assert(gr.sq.every((j) => s.owner[j] === s.owner[gr.sq[0]] && !s.mort[j]), 'recintos sin zona completa');
      assert(Math.max(...h) - Math.min(...h) <= 1, 'recintos desiguales');
    }
  });
  if (s.phase === 'debt') assert(g.liquid(s.debt.p) >= s.debt.n, 'deuda impagable sin quiebra');
  if (s.phase === 'auction') assert(s.auction.active.includes(s.auction.cur), 'subasta con pujador inválido');
}

for (const level of Object.keys(LEVELS)) for (const mode of Object.keys(MODES)) {
  for (const n of [2, 3, 4]) {
    let rounds = 0, trades = 0, ended = 0, auctions = 0, houses = 0;
    for (let k = 0; k < N; k++) {
      const g = Game.create({ mode, level, players: Array.from({ length: n }, (_, i) => ({ name: 'IA' + i, ai: true })) });
      let steps = 0;
      while (g.s.phase !== 'over' && g.s.round <= MAX_TURNS) {
        if (g.s.phase === 'auction' && g.s.auction.bid === 0 && g.s.auction.high === -1) auctions++;
        const r = AI.step(g);
        assert(r, 'la máquina se queda parada en fase ' + g.s.phase);
        if (r.offer) {
          assert(g.canTrade(r.offer), 'oferta inválida');
          if (AI.judge(g, r.offer.to, r.offer).ok) { assert(g.trade(r.offer), 'cambio aceptado pero inválido'); trades++; }
          else g.s.refused[r.offer.from + '-' + r.offer.get[0]] = g.s.round;
        }
        check(g);
        assert(++steps < 400000, 'demasiados pasos');
      }
      if (g.s.phase === 'over') {
        ended++;
        assert(g.s.winner >= 0 && !g.s.players[g.s.winner].out, 'ganador inválido');
      }
      rounds += g.s.round;
      houses += g.s.houses.reduce((a, b) => a + b, 0);
      g.s.fx.length = 0;
    }
    console.log(level.padEnd(8), mode.padEnd(9), n + ' jug.', '· rondas medias', (rounds / N).toFixed(0),
      '· terminadas', Math.round(ended / N * 100) + '%', '· cambios', (trades / N).toFixed(1), '· recintos al final', (houses / N).toFixed(1));
  }
}
console.log('OK');
