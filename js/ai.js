/* Isla Jurásica — decisiones de los rivales que lleva la máquina. Sin DOM. */
(function (root) {
  'use strict';

  const J = root.Jurasica || require('./engine.js');
  const { esc } = J;

  /* reserve: cuánto colchón guarda frente al peor alquiler que le puede tocar
     margin: cuánto tiene que ganar con un cambio para aceptarlo (fracción del valor en juego)
     skip: probabilidad de no comprar algo que podría comprar */
  const CFG = {
    facil: { reserve: 0.25, margin: -0.15, skip: 0.25, bidUp: 0.8, trade: 0.2, build: 0.6 },
    normal: { reserve: 0.6, margin: 0.05, skip: 0, bidUp: 1.1, trade: 0.45, build: 0.9 },
    dificil: { reserve: 0.9, margin: 0.15, skip: 0, bidUp: 1.3, trade: 0.8, build: 1 }
  };
  const cfg = (g) => CFG[g.s.level] || CFG.normal;

  /* Peor alquiler que le pueden cobrar ahora mismo */
  function threat(g, p) {
    let m = 0;
    g.s.owner.forEach((o, i) => { if (o != null && o >= 0 && o !== p) m = Math.max(m, g.rent(i, 7)); });
    return m;
  }
  function reserve(g, p) {
    const early = g.s.owner.filter((o) => o === -1).length > 6 ? 60 : 120;
    return Math.min(700, Math.max(early, threat(g, p) * cfg(g).reserve));
  }

  /* ---------- valor de las posesiones ---------- */
  /* own: dueño de cada casilla (puede ser hipotético) */
  function holdings(g, p, own) {
    const B = g.B;
    let v = 0;
    own.forEach((o, i) => {
      if (o !== p) return;
      const q = B.sq[i];
      let m = 1;
      if (q.t === 'prop') {
        const gs = B.groups[q.g].sq, have = gs.filter((j) => own[j] === p).length;
        if (have === gs.length) m = 2.4;
        else if (have === gs.length - 1 && gs.length > 2) m = 1.35;
        else if (gs.some((j) => own[j] >= 0 && own[j] !== p)) m = 0.85;
      } else if (q.t === 'tren') m = 0.8 + 0.3 * B.trenes.filter((j) => own[j] === p).length;
      else m = B.servs.every((j) => own[j] === p) ? 1.3 : 0.8;
      v += q.price * m * (g.s.mort[i] ? 0.55 : 1) + (g.s.houses[i] ? g.s.houses[i] * g.houseCost(i) : 0);
    });
    return v;
  }
  /* Lo que le preocupa: grupos completos de los demás */
  function danger(g, p, own) {
    let d = 0;
    g.B.groups.forEach((gr) => {
      const o = own[gr.sq[0]];
      if (o >= 0 && o !== p && gr.sq.every((j) => own[j] === o)) d += gr.sq.reduce((n, j) => n + g.sq(j).price, 0) * 0.9;
    });
    return d;
  }
  const score = (g, p, own, money) => money + holdings(g, p, own) - danger(g, p, own);

  function afterTrade(g, o) {
    const own = g.s.owner.slice();
    o.give.forEach((i) => { own[i] = o.to; });
    o.get.forEach((i) => { own[i] = o.from; });
    return own;
  }
  const completes = (g, own, p, sqs) => sqs.some((i) => g.sq(i).t === 'prop' && g.B.groups[g.sq(i).g].sq.every((j) => own[j] === p));

  /* ¿Acepta q el cambio? Devuelve { ok, why, gap } */
  function judge(g, q, o) {
    const s = g.s, c = cfg(g);
    const mine = q === o.to ? 1 : -1;
    const gm = o.giveMoney | 0, tm = o.getMoney | 0;
    const before = score(g, q, s.owner, s.players[q].money);
    const own = afterTrade(g, o);
    const after = score(g, q, own, s.players[q].money + mine * (gm - tm));
    const size = [...o.give, ...o.get].reduce((n, i) => n + g.sq(i).price, 0) + gm + tm;
    const need = size * c.margin;
    const gap = Math.ceil((before + need - after) / 10) * 10;
    const other = mine === 1 ? o.from : o.to;
    if (s.players[q].money + mine * (gm - tm) < reserve(g, q) * 0.5 && mine * (gm - tm) < 0) return { ok: false, why: 'cash', gap };
    if (g.s.level !== 'facil' && completes(g, own, other, mine === 1 ? o.get : o.give) && !completes(g, own, q, mine === 1 ? o.give : o.get) && gap > -size * 0.6) {
      return { ok: false, why: 'group', gap };
    }
    if (after - before < need) return { ok: false, why: 'low', gap };
    return { ok: true, why: '', gap };
  }

  /* Texto de rechazo: siempre distinto y con el motivo concreto */
  const REFUSALS = {
    low: [
      (w, d, gap) => `${w} no lo ve claro: por ${d} querría unos ${gap} más.`,
      (w, d, gap) => `${w} se ríe: «¿Eso por ${d}? Pon ${gap} más y hablamos».`,
      (w, d, gap) => `${w} dice que ${d} vale bastante más. Le faltan ${gap} para aceptar.`,
      (w, d, gap) => `${w} lo piensa y dice que no: le salen ${gap} de menos.`,
      (w, d, gap) => `${w} rechaza el trato por ${d}: le parece corto por unos ${gap}.`
    ],
    group: [
      (w, d) => `${w} no suelta ${d}: te daría una zona completa.`,
      (w, d) => `${w} sabe que con ${d} podrías construir recintos. Ni hablar.`,
      (w, d) => `${w} protege ${d}: no quiere que completes esa zona.`,
      (w, d) => `${w} se huele la jugada: ${d} te cerraría la zona. Rechazado.`
    ],
    cash: [
      (w) => `${w} no quiere quedarse sin ámbar para pagar alquileres.`,
      (w) => `${w} necesita guardar su dinero: la isla está peligrosa.`,
      (w) => `${w} dice que así se queda sin colchón. No acepta.`
    ]
  };
  function refusal(g, q, o, r) {
    const s = g.s;
    const list = REFUSALS[r.why] || REFUSALS.low;
    // nunca repite la frase anterior, para que se note que ha contestado
    s.refN = ((s.refN || 0) + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
    const pick = list[s.refN];
    const ask = q === o.to ? o.get : o.give;
    const d = ask.length ? ask.map((i) => esc(g.sq(i).n)).join(' y ') : 'eso';
    return pick('<b>' + esc(s.players[q].name) + '</b>', d, Math.max(10, r.gap));
  }

  /* ---------- acciones ---------- */
  function wantBuy(g, p, i) {
    const s = g.s, q = g.sq(i), pl = s.players[p];
    const own = s.owner.slice(); own[i] = p;
    const mine = q.t === 'prop' && completes(g, own, p, [i]);
    let block = false;
    if (q.t === 'prop') {
      const gs = g.B.groups[q.g].sq;
      block = s.players.some((_, o) => o !== p && gs.filter((j) => s.owner[j] === o).length === gs.length - 1);
    }
    return { mine, block, keep: pl.money - q.price >= reserve(g, p) };
  }

  /* Consigue dinero paso a paso: primero hipoteca lo suelto, luego desmonta recintos */
  function raise(g, p) {
    const s = g.s;
    const list = g.owned(p);
    const loose = list.filter((i) => g.canMortgage(i) && !(g.sq(i).t === 'prop' && g.ownsGroup(p, g.sq(i).g)))
      .sort((a, b) => g.sq(a).price - g.sq(b).price);
    if (loose.length) return g.mortgage(loose[0]);
    const sell = list.filter((i) => g.canSell(i)).sort((a, b) => g.houseCost(a) - g.houseCost(b));
    if (sell.length) return g.sell(sell[0]);
    const rest = list.filter((i) => g.canMortgage(i)).sort((a, b) => g.sq(a).price - g.sq(b).price);
    if (rest.length) return g.mortgage(rest[0]);
    return false;
  }

  function manage(g, p) {
    const s = g.s, c = cfg(g), pl = s.players[p], res = reserve(g, p);
    // levantar hipotecas de zonas completas primero
    const mort = g.owned(p).filter((i) => s.mort[i]).sort((a, b) => {
      const ga = g.sq(a).t === 'prop' && g.ownsGroup(p, g.sq(a).g), gb = g.sq(b).t === 'prop' && g.ownsGroup(p, g.sq(b).g);
      return gb - ga;
    });
    for (const i of mort) if (g.canUnmortgage(i) && pl.money - g.unmortgageCost(i) >= res + 80) return g.unmortgage(i);
    // construir en la zona que más renta
    const opts = g.owned(p).filter((i) => g.canBuild(i) && pl.money - g.houseCost(i) >= res * c.build)
      .sort((a, b) => (g.sq(b).rent[s.houses[b] + 1] - g.sq(b).rent[s.houses[b]]) / g.houseCost(b)
        - (g.sq(a).rent[s.houses[a] + 1] - g.sq(a).rent[s.houses[a]]) / g.houseCost(a));
    if (opts.length && (s.level !== 'facil' || Math.random() < 0.7)) return g.build(opts[0]);
    return false;
  }

  /* Propone un cambio para completar una zona */
  function propose(g, p) {
    const s = g.s, c = cfg(g), pl = s.players[p];
    s.tried = true;
    if (Math.random() > c.trade) return null;
    const res = reserve(g, p);
    const best = [];
    g.B.groups.forEach((gr) => {
      const mine = gr.sq.filter((j) => s.owner[j] === p).length;
      let x = -1, mults = [1.2, 1.5, 1.9, 2.4, 3];
      if (mine === gr.sq.length - 1) x = gr.sq.find((j) => s.owner[j] !== p);
      else if (mine >= 1 && s.level !== 'facil') {
        // paso intermedio: comprar la pieza suelta de alguien que no va a por esa zona
        x = gr.sq.find((j) => s.owner[j] >= 0 && s.owner[j] !== p && gr.sq.filter((k) => s.owner[k] === s.owner[j]).length === 1) ?? -1;
        mults = [1.1, 1.3, 1.6];
      }
      if (x < 0) return;
      const o = s.owner[x];
      if (o < 0 || s.players[o].out || g.groupHouses(g.sq(x).g) > 0) return;
      if ((s.refused[p + '-' + x] || -99) > s.round - 3) return;
      const price = g.sq(x).price;
      const cands = [];
      for (const k of mults) {
        const m = Math.round(price * k / 10) * 10;
        if (pl.money - m >= res * 0.5) cands.push({ from: p, to: o, give: [], get: [x], giveMoney: m, getMoney: 0 });
      }
      // cambio de un dinosaurio suelto (que no le sirva a quien propone)
      g.owned(p).forEach((y) => {
        const qy = g.sq(y);
        if (s.mort[y] || (qy.t === 'prop' && (g.B.groups[qy.g].sq.filter((j) => s.owner[j] === p).length > 1 || g.groupHouses(qy.g)))) return;
        for (const m of [0, 50, 100, 200]) {
          if (pl.money - m >= res * 0.5) cands.push({ from: p, to: o, give: [y], get: [x], giveMoney: m, getMoney: 0 });
        }
      });
      for (const o2 of cands) {
        if (!g.canTrade(o2)) continue;
        const gain = score(g, p, afterTrade(g, o2), pl.money - o2.giveMoney) - score(g, p, s.owner, pl.money);
        if (gain <= 0) continue;
        if (!judge(g, o, o2).ok) continue;
        best.push({ o: o2, gain });
      }
    });
    if (!best.length) return null;
    best.sort((a, b) => b.gain - a.gain);
    return best[0].o;
  }

  /* Una acción del jugador automático al que le toque. false = le toca a una persona */
  function step(g) {
    const s = g.s;
    if (s.phase === 'over') return false;
    const p = g.actor(), pl = s.players[p], c = cfg(g);
    if (!pl.ai) return false;

    if (s.phase === 'auction') {
      const a = s.auction, i = a.sq, q = g.sq(i), w = wantBuy(g, p, i);
      let max = q.price * (w.mine ? 1.7 : w.block ? 1.25 : 0.85) * c.bidUp;
      max = Math.min(max, w.mine ? pl.money : pl.money - reserve(g, p) * 0.5);
      const inc = a.bid < q.price * 0.4 ? Math.max(10, Math.round(q.price * 0.4 / 10) * 10 - a.bid) : 10;
      if (a.bid + inc <= max) return g.bid(a.bid + inc);
      return g.passBid();
    }
    if (s.phase === 'debt') {
      if (pl.money >= s.debt.n) return g.settle();
      return raise(g, p) || g.declare();
    }
    if (s.phase === 'buy') {
      const i = pl.pos, q = g.sq(i), w = wantBuy(g, p, i);
      const want = w.mine || w.block || (w.keep && Math.random() >= c.skip);
      if (want && pl.money >= q.price) return g.buy();
      if ((w.mine || (w.block && s.level === 'dificil')) && g.liquid(p) - pl.money > q.price - pl.money) {
        const before = pl.money;
        if (raise(g, p) && pl.money > before) return true;
      }
      return g.decline();
    }
    if (s.phase === 'roll' || s.phase === 'main') {
      if (manage(g, p)) return true;
      if (!s.tried && g.alive().length > 1) {
        const offer = propose(g, p);
        if (offer) return { offer };
      }
      if (s.phase === 'main') return g.endTurn();
      if (pl.jail) {
        const free = s.owner.filter((o) => o === -1).length;
        const early = free > s.owner.filter((o) => o != null).length * 0.25;
        if (early && pl.passes.length) return g.usePass();
        if (early && pl.money - J.JAIL_FEE >= reserve(g, p)) return g.payJail();
      }
      return g.roll();
    }
    return false;
  }

  const api = { step, judge, refusal, reserve, CFG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JurasicaAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
