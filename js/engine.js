/* Isla Jurásica — reglas y estado de la partida. Sin DOM: también corre en Node. */
(function (root) {
  'use strict';

  const VERSION = 1;
  const JAIL_FEE = 50;

  /* ---------- dinosaurios (de menos a más popular) ---------- */
  const DINOS = {
    compy: { n: 'Compsognathus', ab: 'COMPY', fig: 'raptor', dato: 'Del tamaño de un pavo. Cazaba lagartijas e insectos a la carrera.' },
    galli: { n: 'Gallimimus', ab: 'GALLI', fig: 'raptor', dato: 'Corría como un avestruz y vivía en manadas.' },
    apato: { n: 'Apatosaurus', ab: 'APATO', fig: 'sauro', dato: 'Unos 22 metros de cuello y cola. Su nombre significa «lagarto engañoso».' },
    pachy: { n: 'Pachycephalosaurus', ab: 'PACHY', fig: 'hadro', dato: 'Su cráneo en forma de cúpula tenía hasta 25 cm de hueso macizo.' },
    para: { n: 'Parasaurolophus', ab: 'PARA', fig: 'hadro', dato: 'Su cresta hueca hacía de trompeta para llamar a la manada.' },
    theri: { n: 'Therizinosaurus', ab: 'THERI', fig: 'raptor', dato: 'Tenía las garras más largas que se conocen… y comía plantas.' },
    bary: { n: 'Baryonyx', ab: 'BARY', fig: 'terop', dato: 'Pescador con hocico de cocodrilo y una garra enorme en el pulgar.' },
    allo: { n: 'Allosaurus', ab: 'ALLO', fig: 'terop', dato: 'El gran cazador del Jurásico, 80 millones de años antes que el T. rex.' },
    carno: { n: 'Carnotaurus', ab: 'CARNO', fig: 'terop', dato: '«Toro carnívoro»: dos cuernos sobre los ojos y unos brazos diminutos.' },
    anky: { n: 'Ankylosaurus', ab: 'ANKY', fig: 'anqui', dato: 'Un tanque acorazado con una maza de hueso en la punta de la cola.' },
    ptera: { n: 'Pteranodon', ab: 'PTERA', fig: 'ptero', dato: 'No era un dinosaurio, sino un reptil volador de 6 metros de envergadura.' },
    dilo: { n: 'Dilophosaurus', ab: 'DILO', fig: 'raptor', dato: 'Tenía dos crestas en la cabeza. Lo del veneno y el collar es invento del cine.' },
    giga: { n: 'Giganotosaurus', ab: 'GIGA', fig: 'terop', dato: 'Uno de los mayores carnívoros terrestres: tan grande como el T. rex.' },
    indor: { n: 'Indoraptor', ab: 'INDOR', fig: 'raptor', dato: 'Híbrido de ficción: nunca existió. Un raptor de laboratorio, oscuro y listo.' },
    brachi: { n: 'Brachiosaurus', ab: 'BRACH', fig: 'sauro', dato: 'Con el cuello estirado alcanzaba las copas de los árboles a 12 metros.' },
    stego: { n: 'Stegosaurus', ab: 'STEGO', fig: 'stego', dato: 'Placas en el lomo, cuatro púas en la cola y un cerebro muy pequeño.' },
    spino: { n: 'Spinosaurus', ab: 'SPINO', fig: 'spino', dato: 'Una vela de casi 2 metros en la espalda y vida medio acuática.' },
    mosa: { n: 'Mosasaurus', ab: 'MOSA', fig: 'mosa', dato: 'No era un dinosaurio: era un reptil marino de más de 12 metros.' },
    indom: { n: 'Indominus rex', ab: 'INDOM', fig: 'terop', dato: 'Híbrido de ficción: nunca existió. La atracción estrella… hasta que se escapa.' },
    trice: { n: 'Triceratops', ab: 'TRICE', fig: 'cerat', dato: 'Tres cuernos y una gola de hueso. Convivió con el T. rex.' },
    velo: { n: 'Velociraptor', ab: 'VELO', fig: 'raptor', dato: 'En realidad era del tamaño de un pavo y estaba cubierto de plumas.' },
    trex: { n: 'Tyrannosaurus rex', ab: 'T. REX', fig: 'terop', dato: 'El rey: la mordida más potente de todos los animales terrestres conocidos.' }
  };

  /* Alquiler: solar, 1–4 recintos, santuario */
  const RENT = {
    60: [2, 10, 30, 90, 160, 250], '60b': [4, 20, 60, 180, 320, 450],
    100: [6, 30, 90, 270, 400, 550], 120: [8, 40, 100, 300, 450, 600],
    140: [10, 50, 150, 450, 625, 750], 160: [12, 60, 180, 500, 700, 900],
    180: [14, 70, 200, 550, 750, 950], 200: [16, 80, 220, 600, 800, 1000],
    220: [18, 90, 250, 700, 875, 1050], 240: [20, 100, 300, 750, 925, 1100],
    260: [22, 110, 330, 800, 975, 1150], 280: [24, 120, 360, 850, 1025, 1200],
    300: [26, 130, 390, 900, 1100, 1275], 320: [28, 150, 450, 1000, 1200, 1400],
    350: [35, 175, 500, 1100, 1300, 1500], 400: [50, 200, 600, 1400, 1700, 2000]
  };

  const dino = (key, g, price, rent) => Object.assign({ t: 'prop', key, g, price, rent: RENT[rent || price] }, DINOS[key]);
  const tren = (n, ab) => ({ t: 'tren', n, ab, price: 200 });
  const serv = (n, ab) => ({ t: 'serv', n, ab, price: 150 });
  const carta = (deck) => deck === 'exp' ? { t: 'carta', deck, n: 'Expedición', ab: 'EXPED.' } : { t: 'carta', deck, n: 'Incubadora', ab: 'INCUB.' };
  const tasa = (n, ab, amount) => ({ t: 'tasa', n, ab, amount });
  const SALIDA = { t: 'salida', n: 'Salida', ab: 'SALIDA' };
  const CUAR = { t: 'cuar', n: 'Cuarentena', ab: 'CUARENT.' };
  const MIRADOR = { t: 'mirador', n: 'Mirador', ab: 'MIRADOR' };
  const FUGA = { t: 'fuga', n: '¡Alerta de fuga!', ab: 'FUGA' };

  const BOARDS = {
    clasico: {
      groups: [
        { n: 'Pradera', c: '#8d5a3b', house: 50 }, { n: 'Ribera', c: '#79c2e6', house: 50 },
        { n: 'Pantano', c: '#d6559b', house: 100 }, { n: 'Desfiladero', c: '#ef8d32', house: 100 },
        { n: 'Volcán', c: '#d8402f', house: 150 }, { n: 'Valle', c: '#efc93a', house: 150 },
        { n: 'Laguna', c: '#2e9b5a', house: 200 }, { n: 'Cumbre', c: '#2b4da0', house: 200 }
      ],
      trenRent: [25, 50, 100, 200],
      sq: [
        SALIDA, dino('compy', 0, 60), carta('inc'), dino('galli', 0, 60, '60b'), tasa('Seguro de visitantes', 'SEGURO', 200),
        tren('Helipuerto', 'HELI'), dino('apato', 1, 100), carta('exp'), dino('pachy', 1, 100), dino('para', 1, 120),
        CUAR, dino('theri', 2, 140), serv('Central geotérmica', 'ENERGÍA'), dino('bary', 2, 140), dino('allo', 2, 160),
        tren('Monorraíl', 'MONORR.'), dino('carno', 3, 180), carta('inc'), dino('anky', 3, 180), dino('ptera', 3, 200),
        MIRADOR, dino('dilo', 4, 220), carta('exp'), dino('giga', 4, 220), dino('indor', 4, 240),
        tren('Embarcadero', 'BARCO'), dino('brachi', 5, 260), dino('stego', 5, 260), serv('Laboratorio genético', 'LAB.'), dino('spino', 5, 280),
        FUGA, dino('mosa', 6, 300), dino('indom', 6, 300), carta('inc'), dino('trice', 6, 320),
        tren('Teleférico', 'TELEF.'), carta('exp'), dino('velo', 7, 350), tasa('Pienso de lujo', 'PIENSO', 100), dino('trex', 7, 400)
      ]
    },
    mini: {
      groups: [
        { n: 'Pradera', c: '#8d5a3b', house: 50 }, { n: 'Ribera', c: '#79c2e6', house: 50 },
        { n: 'Desfiladero', c: '#ef8d32', house: 100 }, { n: 'Laguna', c: '#d8402f', house: 150 },
        { n: 'Valle', c: '#2e9b5a', house: 200 }, { n: 'Cumbre', c: '#2b4da0', house: 200 }
      ],
      trenRent: [50, 100],
      sq: [
        SALIDA, dino('compy', 0, 60), carta('inc'), dino('galli', 0, 60, '60b'), tasa('Seguro de visitantes', 'SEGURO', 100), dino('dilo', 1, 120),
        CUAR, dino('ptera', 1, 140), tren('Helipuerto', 'HELI'), dino('stego', 2, 180), carta('exp'), dino('brachi', 2, 200),
        MIRADOR, dino('spino', 3, 240), carta('inc'), dino('mosa', 3, 260), tren('Monorraíl', 'MONORR.'), dino('indom', 4, 300),
        FUGA, dino('trice', 4, 320), carta('exp'), dino('velo', 5, 350), tasa('Pienso de lujo', 'PIENSO', 50), dino('trex', 5, 400)
      ]
    }
  };
  for (const B of Object.values(BOARDS)) {
    B.groups.forEach((gr, gi) => { gr.sq = B.sq.map((q, i) => q.t === 'prop' && q.g === gi ? i : -1).filter((i) => i >= 0); });
    B.jail = B.sq.findIndex((q) => q.t === 'cuar');
    B.trenes = B.sq.map((q, i) => q.t === 'tren' ? i : -1).filter((i) => i >= 0);
    B.servs = B.sq.map((q, i) => q.t === 'serv' ? i : -1).filter((i) => i >= 0);
  }

  /* ---------- cartas ---------- */
  const DECKS = {
    exp: [
      { t: 'Avanza hasta la Salida y cobra el sueldo.', k: 'ir', to: 'salida' },
      { t: '¡Un T. rex anda suelto y todos quieren verlo! Avanza hasta el Tyrannosaurus rex.', k: 'ir', to: 'rex' },
      { t: 'Coge el transporte más cercano. Si tiene dueño, le pagas el doble.', k: 'ir', to: 'tren', x2: true },
      { t: 'Una estampida de Gallimimus te hace retroceder 3 casillas.', k: 'atras', n: 3 },
      { t: '¡Alerta de fuga! Vas directo a la cuarentena, sin pasar por la Salida.', k: 'cuar' },
      { t: 'Pase del veterinario: sales gratis de la cuarentena. Guárdalo hasta usarlo.', k: 'libre' },
      { t: 'Encuentras un mosquito atrapado en ámbar. Cobra 150.', k: 'cobra', n: 150 },
      { t: 'Tu documental de dinosaurios es un éxito. Cobra 100.', k: 'cobra', n: 100 },
      { t: 'Multa por dar de comer a los carnívoros. Paga 50.', k: 'paga', n: 50 },
      { t: 'Refuerzas las vallas: paga 25 por recinto y 100 por santuario.', k: 'obras', casa: 25, hotel: 100 },
      { t: 'Invitas a todos a la cafetería del parque: paga 25 a cada jugador.', k: 'atodos', n: 25 },
      { t: 'Te vas a descansar: avanza hasta el Mirador.', k: 'ir', to: 'mirador' }
    ],
    inc: [
      { t: 'Nace una cría sana y fuerte. Cobra 100.', k: 'cobra', n: 100 },
      { t: 'Vendes unos fósiles a un museo. Cobra 50.', k: 'cobra', n: 50 },
      { t: 'Te conceden una beca de investigación. Cobra 200.', k: 'cobra', n: 200 },
      { t: '¡Es tu cumpleaños! Cada jugador te regala 20.', k: 'cadauno', n: 20 },
      { t: 'Factura del veterinario. Paga 50.', k: 'paga', n: 50 },
      { t: 'Se estropea una incubadora. Paga 100.', k: 'paga', n: 100 },
      { t: 'Pase del veterinario: sales gratis de la cuarentena. Guárdalo hasta usarlo.', k: 'libre' },
      { t: 'Brote de gripe de saurio: vas a la cuarentena.', k: 'cuar' },
      { t: 'Avanza hasta la Salida y cobra el sueldo.', k: 'ir', to: 'salida' },
      { t: 'Revisión de seguridad: paga 40 por recinto y 115 por santuario.', k: 'obras', casa: 40, hotel: 115 },
      { t: 'Ganas el concurso de fotografía del parque. Cobra 20.', k: 'cobra', n: 20 },
      { t: 'Vendes réplicas de huevos en la tienda. Cobra 25.', k: 'cobra', n: 25 }
    ]
  };

  /* ---------- tipos de partida y niveles ---------- */
  const MODES = {
    clasica: { n: 'Clásica', board: 'clasico', start: 1500, salary: 200, rounds: 0, deal: 0,
      desc: 'Tablero de 40 casillas y 22 dinosaurios. Se juega hasta que solo quede uno.' },
    rapida: { n: 'Rápida', board: 'clasico', start: 1500, salary: 200, rounds: 20, deal: 2,
      desc: 'Mismo tablero, pero cada uno empieza con 2 dinosaurios. A las 20 rondas gana quien más valga.' },
    reducida: { n: 'Reducida', board: 'mini', start: 1000, salary: 100, rounds: 0, deal: 0,
      desc: 'Tablero de 24 casillas y 12 dinosaurios. Partidas cortas, ideal para el móvil.' }
  };
  const LEVELS = {
    facil: { n: 'Fácil', desc: 'Las máquinas compran sin pensar mucho y aceptan casi cualquier cambio.' },
    normal: { n: 'Normal', desc: 'Las máquinas juegan con sentido y aceptan los cambios que les compensan.' },
    dificil: { n: 'Difícil', desc: 'Las máquinas guardan dinero, construyen rápido y no regalan nada.' }
  };

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const die = () => 1 + Math.floor(Math.random() * 6);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const ownable = (q) => q.t === 'prop' || q.t === 'tren' || q.t === 'serv';
  const unmortgageCost = (q) => Math.ceil(q.price / 2 * 1.1);

  /* ---------- partida ---------- */
  class Game {
    constructor(s) { this.s = s; this.M = MODES[s.mode]; this.B = BOARDS[this.M.board]; }

    static create({ mode, level, players }) {
      const M = MODES[mode] ? mode : 'clasica';
      const B = BOARDS[MODES[M].board];
      const s = {
        version: VERSION, mode: M, level: LEVELS[level] ? level : 'normal',
        players: players.map((p) => ({ name: String(p.name || 'Jugador').slice(0, 14), ai: !!p.ai, money: MODES[M].start,
          pos: 0, jail: false, tries: 0, passes: [], out: false })),
        owner: B.sq.map((q) => ownable(q) ? -1 : null), houses: B.sq.map(() => 0), mort: B.sq.map(() => false),
        turn: 0, round: 1, phase: 'roll', dice: [0, 0], doubles: 0, again: false,
        decks: { exp: shuffle(DECKS.exp.map((_, i) => i)), inc: shuffle(DECKS.inc.map((_, i) => i)) },
        debt: null, auction: null, fx: [], log: [], winner: -1, tried: false, refused: {}, refN: 0
      };
      const g = new Game(s);
      if (MODES[M].deal) {
        const free = shuffle(B.sq.map((q, i) => q.t === 'prop' ? i : -1).filter((i) => i >= 0));
        for (let k = 0; k < MODES[M].deal; k++) s.players.forEach((_, p) => { s.owner[free.pop()] = p; });
      }
      g.log('Empieza la partida. ¡Bienvenidos a la isla!');
      return g;
    }

    /* ---------- utilidades ---------- */
    nm(p) { return '<b>' + esc(this.s.players[p].name) + '</b>'; }
    log(t) { this.s.log.push(t); if (this.s.log.length > 80) this.s.log.shift(); }
    fx(e) { this.s.fx.push(e); if (this.s.fx.length > 40) this.s.fx.shift(); }
    sq(i) { return this.B.sq[i]; }
    alive() { return this.s.players.map((_, i) => i).filter((i) => !this.s.players[i].out); }
    /* Quién tiene que decidir ahora */
    actor() {
      const s = this.s;
      if (s.phase === 'auction') return s.auction.cur;
      if (s.phase === 'debt') return s.debt.p;
      return s.turn;
    }
    owned(p) { return this.s.owner.map((o, i) => o === p ? i : -1).filter((i) => i >= 0); }
    ownsGroup(p, gi) { return this.B.groups[gi].sq.every((i) => this.s.owner[i] === p); }
    groupHouses(gi) { return this.B.groups[gi].sq.reduce((n, i) => n + this.s.houses[i], 0); }
    countType(p, t) { return (t === 'tren' ? this.B.trenes : this.B.servs).filter((i) => this.s.owner[i] === p).length; }
    houseCost(i) { return this.B.groups[this.sq(i).g].house; }
    unmortgageCost(i) { return unmortgageCost(this.sq(i)); }

    rent(i, diceSum) {
      const s = this.s, q = this.sq(i), o = s.owner[i];
      if (o == null || o < 0 || s.mort[i]) return 0;
      if (q.t === 'prop') {
        const h = s.houses[i];
        if (h > 0) return q.rent[h];
        return this.ownsGroup(o, q.g) ? q.rent[0] * 2 : q.rent[0];
      }
      if (q.t === 'tren') return this.B.trenRent[this.countType(o, 'tren') - 1];
      const all = this.countType(o, 'serv') === this.B.servs.length;
      return (diceSum || 7) * (all ? 10 : 4);
    }
    /* Dinero que podría reunir vendiendo recintos e hipotecando todo */
    liquid(p) {
      let n = this.s.players[p].money;
      for (const i of this.owned(p)) {
        if (this.s.houses[i]) n += this.s.houses[i] * this.houseCost(i) / 2;
        if (!this.s.mort[i]) n += this.sq(i).price / 2;
      }
      return n;
    }
    worth(p) {
      let n = this.s.players[p].money;
      for (const i of this.owned(p)) {
        n += this.s.mort[i] ? this.sq(i).price / 2 : this.sq(i).price;
        if (this.s.houses[i]) n += this.s.houses[i] * this.houseCost(i);
      }
      return n;
    }
    ranking() {
      const s = this.s, idx = s.players.map((_, i) => i);
      return idx.sort((a, b) => (s.players[a].out - s.players[b].out) || (this.worth(b) - this.worth(a)));
    }

    /* ---------- movimiento ---------- */
    roll() {
      const s = this.s;
      if (s.phase !== 'roll') return false;
      const p = s.turn, pl = s.players[p];
      const a = die(), b = die(), dbl = a === b;
      s.dice = [a, b];
      this.fx({ k: 'dice', p, a, b });
      if (pl.jail) {
        s.again = false;
        if (dbl) {
          pl.jail = false; pl.tries = 0;
          this.log(`${this.nm(p)} saca dobles y sale de la cuarentena.`);
          this.advance(a + b);
          return true;
        }
        if (++pl.tries >= 3) {
          pl.jail = false; pl.tries = 0;
          this.log(`${this.nm(p)} no saca dobles a la tercera: paga ${JAIL_FEE} y sale de la cuarentena.`);
          this.charge(p, JAIL_FEE, -1, 'move');
          return true;
        }
        this.log(`${this.nm(p)} no saca dobles y sigue en cuarentena.`);
        s.phase = 'main';
        return true;
      }
      if (dbl) {
        if (++s.doubles === 3) {
          this.log(`${this.nm(p)} saca dobles tres veces seguidas: ¡a la cuarentena!`);
          this.toJail(p);
          s.phase = 'main';
          return true;
        }
        s.again = true;
      } else s.again = false;
      this.advance(a + b);
      return true;
    }
    advance(n) {
      const s = this.s, p = s.turn, pl = s.players[p], N = this.B.sq.length;
      const from = pl.pos;
      pl.pos = (from + n) % N;
      this.fx({ k: 'move', p, from, to: pl.pos, how: 'f' });
      if (pl.pos < from) this.salary(p);
      this.land(1);
    }
    goTo(to) {
      const s = this.s, p = s.turn, pl = s.players[p], from = pl.pos;
      pl.pos = to;
      this.fx({ k: 'move', p, from, to, how: 'f' });
      if (to <= from) this.salary(p);
    }
    salary(p) {
      this.s.players[p].money += this.M.salary;
      this.log(`${this.nm(p)} pasa por la Salida y cobra ${this.M.salary}.`);
    }
    toJail(p) {
      const s = this.s, pl = s.players[p];
      this.fx({ k: 'move', p, from: pl.pos, to: this.B.jail, how: 'j' });
      pl.pos = this.B.jail; pl.jail = true; pl.tries = 0;
      s.again = false; s.doubles = 0;
    }
    land(mult) {
      const s = this.s, p = s.turn, pl = s.players[p], i = pl.pos, q = this.sq(i);
      if (ownable(q)) {
        const o = s.owner[i];
        if (o === -1) { s.phase = 'buy'; return; }
        if (o !== p && !s.mort[i]) {
          const n = this.rent(i, s.dice[0] + s.dice[1]) * mult;
          this.log(`${this.nm(p)} cae en ${esc(q.n)} y paga ${n} a ${this.nm(o)}.`);
          return this.charge(p, n, o);
        }
        if (o !== p) this.log(`${this.nm(p)} cae en ${esc(q.n)}, hipotecado: no paga nada.`);
        return this.resume();
      }
      if (q.t === 'tasa') {
        this.log(`${this.nm(p)} paga ${q.amount} de ${esc(q.n.toLowerCase())}.`);
        return this.charge(p, q.amount, -1);
      }
      if (q.t === 'carta') return this.draw(q.deck);
      if (q.t === 'fuga') {
        this.log(`¡Alerta de fuga! ${this.nm(p)} va a la cuarentena.`);
        this.toJail(p);
      }
      this.resume();
    }
    /* Sigue el turno: vuelve a tirar si sacó dobles, si no puede gestionar y pasar */
    resume() {
      const s = this.s;
      if (s.phase === 'over') return;
      const pl = s.players[s.turn];
      if (pl.out) return this.next();
      s.phase = s.again && !pl.jail ? 'roll' : 'main';
    }

    /* ---------- cartas ---------- */
    draw(deck) {
      const s = this.s, p = s.turn, pl = s.players[p], D = DECKS[deck], N = this.B.sq.length;
      const held = s.players.some((x) => x.passes.includes(deck));
      let id;
      do { id = s.decks[deck].shift(); s.decks[deck].push(id); } while (D[id].k === 'libre' && held);
      const c = D[id];
      this.fx({ k: 'card', p, deck, id });
      this.log(`${this.nm(p)} saca una carta de ${deck === 'exp' ? 'Expedición' : 'Incubadora'}: «${c.t}»`);
      switch (c.k) {
        case 'cobra': pl.money += c.n; return this.resume();
        case 'paga': return this.charge(p, c.n, -1);
        case 'libre': pl.passes.push(deck); return this.resume();
        case 'cuar': this.toJail(p); return this.resume();
        case 'atras': {
          const from = pl.pos;
          pl.pos = (from - c.n + N) % N;
          this.fx({ k: 'move', p, from, to: pl.pos, how: 'b' });
          return this.land(1);
        }
        case 'ir': {
          let to = 0;
          if (c.to === 'rex') to = N - 1;
          else if (c.to === 'mirador') to = this.B.sq.findIndex((q) => q.t === 'mirador');
          else if (c.to === 'tren') to = this.B.trenes.find((i) => i > pl.pos) ?? this.B.trenes[0];
          this.goTo(to);
          return this.land(c.x2 ? 2 : 1);
        }
        case 'cadauno': {
          for (const o of this.alive()) {
            if (o === p) continue;
            const x = Math.min(c.n, s.players[o].money);
            s.players[o].money -= x; pl.money += x;
          }
          return this.resume();
        }
        case 'atodos': return this.charge(p, c.n * (this.alive().length - 1), 'todos');
        case 'obras': {
          let n = 0;
          for (const i of this.owned(p)) n += s.houses[i] === 5 ? c.hotel : s.houses[i] * c.casa;
          if (!n) { this.log(`${this.nm(p)} no tiene recintos: no paga nada.`); return this.resume(); }
          this.log(`${this.nm(p)} tiene que pagar ${n} de obras.`);
          return this.charge(p, n, -1);
        }
      }
      this.resume();
    }

    /* ---------- pagos y deudas ---------- */
    charge(p, n, to, then) {
      const s = this.s, pl = s.players[p];
      if (n <= 0) return this.after(then);
      if (pl.money >= n) { this.transfer(p, n, to); return this.after(then); }
      if (this.liquid(p) < n) return this.bankrupt(p, to);
      s.debt = { p, n, to, then: then || null };
      s.phase = 'debt';
    }
    transfer(p, n, to) {
      const s = this.s;
      s.players[p].money -= n;
      if (to === 'todos') {
        const others = this.alive().filter((o) => o !== p);
        others.forEach((o) => { s.players[o].money += n / others.length; });
      } else if (to >= 0) s.players[to].money += n;
    }
    after(then) {
      if (then === 'move') return this.advance(this.s.dice[0] + this.s.dice[1]);
      this.resume();
    }
    /* Paga la deuda pendiente cuando ya tiene el dinero */
    settle() {
      const s = this.s, d = s.debt;
      if (s.phase !== 'debt' || s.players[d.p].money < d.n) return false;
      this.transfer(d.p, d.n, d.to);
      s.debt = null;
      this.after(d.then);
      return true;
    }
    declare() {
      if (this.s.phase !== 'debt') return false;
      this.bankrupt(this.s.debt.p, this.s.debt.to);
      return true;
    }
    bankrupt(p, to) {
      const s = this.s, pl = s.players[p];
      const cred = typeof to === 'number' && to >= 0 && !s.players[to].out ? to : -1;
      for (const i of this.owned(p)) {
        if (s.houses[i]) { pl.money += s.houses[i] * this.houseCost(i) / 2; s.houses[i] = 0; }
        if (cred >= 0) s.owner[i] = cred;
        else { s.owner[i] = -1; s.mort[i] = false; }
      }
      if (cred >= 0) {
        s.players[cred].money += pl.money;
        s.players[cred].passes.push(...pl.passes);
      }
      pl.money = 0; pl.passes = []; pl.jail = false; pl.out = true;
      s.debt = null;
      this.log(`${this.nm(p)} se arruina${cred >= 0 ? ' y todo lo suyo pasa a ' + this.nm(cred) : ' y sus dinosaurios vuelven al parque'}.`);
      const alive = this.alive();
      if (alive.length === 1) return this.finish(alive[0]);
      if (p === s.turn) return this.next();
      this.resume();
    }

    /* ---------- compra y subasta ---------- */
    buy() {
      const s = this.s, p = s.turn, i = s.players[p].pos, q = this.sq(i);
      if (s.phase !== 'buy' || s.players[p].money < q.price) return false;
      s.players[p].money -= q.price;
      s.owner[i] = p;
      this.log(`${this.nm(p)} compra ${esc(q.n)} por ${q.price}.`);
      this.resume();
      return true;
    }
    decline() {
      const s = this.s;
      if (s.phase !== 'buy') return false;
      const i = s.players[s.turn].pos, n = s.players.length;
      const active = [];
      for (let d = 1; d <= n; d++) {
        const o = (s.turn + d) % n;
        if (!s.players[o].out && s.players[o].money > 0) active.push(o);
      }
      this.log(`${this.nm(s.turn)} no compra ${esc(this.sq(i).n)}: sale a subasta.`);
      if (!active.length) { this.log('Nadie puede pujar.'); this.resume(); return true; }
      s.auction = { sq: i, bid: 0, high: -1, active, cur: active[0] };
      s.phase = 'auction';
      return true;
    }
    bid(n) {
      const s = this.s, a = s.auction;
      if (s.phase !== 'auction') return false;
      n = Math.floor(n);
      if (!(n > a.bid) || n > s.players[a.cur].money) return false;
      a.bid = n; a.high = a.cur;
      const k = a.active.indexOf(a.cur);
      if (a.active.length === 1) return this.sold();
      a.cur = a.active[(k + 1) % a.active.length];
      return true;
    }
    passBid() {
      const s = this.s, a = s.auction;
      if (s.phase !== 'auction') return false;
      const k = a.active.indexOf(a.cur);
      a.active.splice(k, 1);
      if (!a.active.length) {
        this.log(`Nadie puja por ${esc(this.sq(a.sq).n)}: sigue libre.`);
        s.auction = null;
        this.resume();
        return true;
      }
      if (a.active.length === 1 && a.high === a.active[0]) return this.sold();
      a.cur = a.active[k % a.active.length];
      return true;
    }
    sold() {
      const s = this.s, a = s.auction;
      s.players[a.high].money -= a.bid;
      s.owner[a.sq] = a.high;
      this.log(`${this.nm(a.high)} gana la subasta de ${esc(this.sq(a.sq).n)} por ${a.bid}.`);
      s.auction = null;
      this.resume();
      return true;
    }

    /* ---------- recintos e hipotecas ---------- */
    /* Quién puede gestionar sus dinosaurios ahora mismo */
    manager() {
      const s = this.s;
      if (s.phase === 'debt') return s.debt.p;
      if (s.phase === 'roll' || s.phase === 'main' || s.phase === 'buy') return s.turn;
      return -1;
    }
    canBuild(i) {
      const s = this.s, q = this.sq(i), p = s.owner[i];
      if (q.t !== 'prop' || p < 0 || p !== this.manager() || s.phase === 'debt') return false;
      const gs = this.B.groups[q.g].sq;
      if (!gs.every((j) => s.owner[j] === p && !s.mort[j])) return false;
      if (s.houses[i] >= 5 || s.houses[i] > Math.min(...gs.map((j) => s.houses[j]))) return false;
      return s.players[p].money >= this.houseCost(i);
    }
    build(i) {
      if (!this.canBuild(i)) return false;
      const s = this.s, p = s.owner[i];
      s.players[p].money -= this.houseCost(i);
      s.houses[i]++;
      this.log(`${this.nm(p)} construye ${s.houses[i] === 5 ? 'un santuario' : 'un recinto'} en ${esc(this.sq(i).n)}.`);
      return true;
    }
    canSell(i) {
      const s = this.s, q = this.sq(i), p = s.owner[i];
      if (q.t !== 'prop' || p < 0 || p !== this.manager() || !s.houses[i]) return false;
      return s.houses[i] >= Math.max(...this.B.groups[q.g].sq.map((j) => s.houses[j]));
    }
    sell(i) {
      if (!this.canSell(i)) return false;
      const s = this.s, p = s.owner[i];
      s.players[p].money += this.houseCost(i) / 2;
      this.log(`${this.nm(p)} desmonta ${s.houses[i] === 5 ? 'el santuario' : 'un recinto'} de ${esc(this.sq(i).n)}.`);
      s.houses[i]--;
      return true;
    }
    canMortgage(i) {
      const s = this.s, q = this.sq(i), p = s.owner[i];
      if (!ownable(q) || p == null || p < 0 || p !== this.manager() || s.mort[i]) return false;
      return q.t !== 'prop' || this.groupHouses(q.g) === 0;
    }
    mortgage(i) {
      if (!this.canMortgage(i)) return false;
      const s = this.s, p = s.owner[i], q = this.sq(i);
      s.mort[i] = true;
      s.players[p].money += q.price / 2;
      this.log(`${this.nm(p)} hipoteca ${esc(q.n)} y recibe ${q.price / 2}.`);
      return true;
    }
    canUnmortgage(i) {
      const s = this.s, p = s.owner[i];
      if (p == null || p < 0 || p !== this.manager() || !s.mort[i] || s.phase === 'debt') return false;
      return s.players[p].money >= this.unmortgageCost(i);
    }
    unmortgage(i) {
      if (!this.canUnmortgage(i)) return false;
      const s = this.s, p = s.owner[i], n = this.unmortgageCost(i);
      s.mort[i] = false;
      s.players[p].money -= n;
      this.log(`${this.nm(p)} levanta la hipoteca de ${esc(this.sq(i).n)} por ${n}.`);
      return true;
    }

    /* ---------- cuarentena ---------- */
    payJail() {
      const s = this.s, pl = s.players[s.turn];
      if (s.phase !== 'roll' || !pl.jail || pl.money < JAIL_FEE) return false;
      pl.money -= JAIL_FEE; pl.jail = false; pl.tries = 0;
      this.log(`${this.nm(s.turn)} paga ${JAIL_FEE} y sale de la cuarentena.`);
      return true;
    }
    usePass() {
      const s = this.s, pl = s.players[s.turn];
      if (s.phase !== 'roll' || !pl.jail || !pl.passes.length) return false;
      pl.passes.shift(); pl.jail = false; pl.tries = 0;
      this.log(`${this.nm(s.turn)} usa el pase del veterinario y sale de la cuarentena.`);
      return true;
    }

    /* ---------- cambios entre jugadores ---------- */
    /* o = { from, to, give: [casillas], get: [casillas], giveMoney, getMoney } */
    canTrade(o) {
      const s = this.s;
      if (s.phase !== 'roll' && s.phase !== 'main') return false;
      if (o.from !== s.turn || o.to === o.from || !s.players[o.to] || s.players[o.to].out) return false;
      const gm = o.giveMoney | 0, tm = o.getMoney | 0;
      if (gm < 0 || tm < 0 || gm > s.players[o.from].money || tm > s.players[o.to].money) return false;
      if (!o.give.length && !o.get.length) return false;
      const okSq = (i, p) => s.owner[i] === p && (this.sq(i).t !== 'prop' || this.groupHouses(this.sq(i).g) === 0);
      return o.give.every((i) => okSq(i, o.from)) && o.get.every((i) => okSq(i, o.to));
    }
    trade(o) {
      if (!this.canTrade(o)) return false;
      const s = this.s;
      o.give.forEach((i) => { s.owner[i] = o.to; });
      o.get.forEach((i) => { s.owner[i] = o.from; });
      s.players[o.from].money += (o.getMoney | 0) - (o.giveMoney | 0);
      s.players[o.to].money += (o.giveMoney | 0) - (o.getMoney | 0);
      this.log(`Trato hecho entre ${this.nm(o.from)} y ${this.nm(o.to)}: ${this.describe(o)}.`);
      return true;
    }
    describe(o) {
      const side = (sqs, m) => {
        const parts = sqs.map((i) => esc(this.sq(i).n));
        if (m) parts.push(m + ' de ámbar');
        return parts.join(', ') || 'nada';
      };
      return `${side(o.give, o.giveMoney | 0)} a cambio de ${side(o.get, o.getMoney | 0)}`;
    }

    /* ---------- turnos y final ---------- */
    endTurn() {
      if (this.s.phase !== 'main') return false;
      this.next();
      return true;
    }
    next() {
      const s = this.s, n = s.players.length;
      s.doubles = 0; s.again = false; s.tried = false;
      let i = s.turn;
      do {
        i = (i + 1) % n;
        if (i === 0) s.round++;
      } while (s.players[i].out);
      s.turn = i;
      s.phase = 'roll';
      if (this.M.rounds && s.round > this.M.rounds) {
        s.round = this.M.rounds;
        this.finish(this.ranking()[0]);
      }
    }
    finish(w) {
      const s = this.s;
      s.phase = 'over'; s.winner = w; s.auction = null; s.debt = null;
      this.log(`¡${this.nm(w)} gana la partida!`);
    }
  }

  const api = { Game, MODES, LEVELS, BOARDS, DECKS, DINOS, JAIL_FEE, VERSION, esc, ownable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Jurasica = api;
})(typeof window !== 'undefined' ? window : globalThis);
