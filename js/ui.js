/* Isla Jurásica — interfaz: dibujo, entrada, diálogos, bucle de turnos y guardado */
(function () {
  'use strict';

  const { Game, MODES, LEVELS, DECKS, JAIL_FEE, VERSION, esc, ownable } = window.Jurasica;
  const AI = window.JurasicaAI;
  const $ = (q) => document.querySelector(q);

  const SAVE_KEY = 'isla-jurasica-partida';
  const PREFS_KEY = 'isla-jurasica-ajustes';
  const COLORS = ['#e4572e', '#2f7cf6', '#e0a800', '#9b5de5'];
  const AI_NAMES = ['Dra. Fósil', 'Capitán Ámbar', 'Tía Raptor', 'Profe Huesos'];
  const TOKEN_OFF = [[-0.2, -0.17], [0.2, -0.17], [-0.2, 0.19], [0.2, 0.19]];

  let g = null;          // partida en curso
  let busy = false;      // la máquina o una animación tienen el control
  let shown = [];        // casilla en la que se ve cada ficha
  let lastMoney = [];
  let lastHuman = -1;
  let prefs = { speed: 1, mode: 'clasica', level: 'normal', slots: null };

  /* ---------- almacenamiento ---------- */
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function store(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* sin almacenamiento: se juega igual */ }
  }
  function save() {
    if (!g) return;
    store(SAVE_KEY, g.s.phase === 'over' ? null : g.s);
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * (prefs.speed || 1)));
  const am = (n) => `<span class="amb">${Math.round(n)}</span>`;
  const icon = (id, cls) => `<svg class="${cls || 'ic'}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const fig = (id, cls) => `<svg class="${cls || 'fig'}" viewBox="0 0 100 60" aria-hidden="true"><use href="#f-${id}"/></svg>`;
  const tokdot = (p) => `<i class="tokdot" style="--c:${COLORS[p]}">${esc(initial(g.s.players[p].name))}</i>`;
  const pname = (p) => '<b>' + esc(g.s.players[p].name) + '</b>';
  const initial = (n) => (String(n).trim()[0] || '?').toUpperCase();
  const human = (p) => p >= 0 && !g.s.players[p].ai && !g.s.players[p].out;
  const SQ_ICON = { salida: 'salida', carta: null, tasa: 'tasa', tren: 'tren', serv: 'serv', cuar: 'cuar', mirador: 'mirador', fuga: 'fuga' };
  const sqIcon = (q) => q.t === 'carta' ? q.deck : SQ_ICON[q.t];

  /* ---------- diálogos y avisos ---------- */
  function openModal(html, cls) {
    const wrap = document.createElement('div');
    wrap.className = 'backdrop';
    wrap.innerHTML = `<div class="modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    return { el: wrap.firstElementChild, close: () => wrap.remove() };
  }
  /* Se cierra al pulsar un botón con data-close y devuelve su valor */
  function dialog(html, cls) {
    return new Promise((resolve) => {
      const m = openModal(html, cls);
      m.el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-close]');
        if (b && !b.disabled) { m.close(); resolve(b.dataset.close); }
      });
    });
  }
  function toast(html, cls, ms) {
    const el = document.createElement('div');
    el.className = 'toast ' + (cls || '');
    el.innerHTML = html;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), ms || 3000);
  }

  /* ---------- menú de inicio ---------- */
  function initMenu() {
    const saved = load(PREFS_KEY);
    if (saved) Object.assign(prefs, saved);
    $('#modes').innerHTML = Object.entries(MODES).map(([k, m]) => `
      <label class="mode"><input type="radio" name="mode" value="${k}" ${k === prefs.mode ? 'checked' : ''}>
        <span><b>${m.n}</b><small>${m.desc}</small></span></label>`).join('');
    $('#levels').innerHTML = Object.entries(LEVELS).map(([k, l]) => `
      <label class="mode"><input type="radio" name="level" value="${k}" ${k === prefs.level ? 'checked' : ''}><b>${l.n}</b></label>`).join('');
    const hint = () => { $('#level-hint').textContent = LEVELS[document.querySelector('input[name=level]:checked').value].desc; };
    $('#levels').addEventListener('change', hint);
    hint();

    const slots = prefs.slots || [
      { type: 'human', name: 'Jugador 1' }, { type: 'ai', name: AI_NAMES[0] },
      { type: 'ai', name: AI_NAMES[1] }, { type: 'off', name: AI_NAMES[2] }
    ];
    $('#slots').innerHTML = slots.map((sl, i) => `
      <div class="slot ${sl.type === 'off' ? 'off' : ''}" data-i="${i}">
        <i class="tokdot" style="--c:${COLORS[i]}"></i>
        <input type="text" maxlength="14" value="${esc(sl.name)}" aria-label="Nombre del jugador ${i + 1}">
        <select aria-label="Tipo del jugador ${i + 1}">
          <option value="human" ${sl.type === 'human' ? 'selected' : ''}>Persona</option>
          <option value="ai" ${sl.type === 'ai' ? 'selected' : ''}>Máquina</option>
          <option value="off" ${sl.type === 'off' ? 'selected' : ''}>No juega</option>
        </select>
      </div>`).join('');
    $('#slots').addEventListener('change', (ev) => {
      const slot = ev.target.closest('.slot');
      if (!slot || ev.target.tagName !== 'SELECT') return;
      const input = slot.querySelector('input'), i = +slot.dataset.i;
      slot.classList.toggle('off', ev.target.value === 'off');
      if (ev.target.value === 'ai' && /^Jugador \d$/.test(input.value)) input.value = AI_NAMES[i % AI_NAMES.length];
      if (ev.target.value === 'human' && AI_NAMES.includes(input.value)) input.value = 'Jugador ' + (i + 1);
    });
    $('#start').addEventListener('click', startGame);
    $('#rules').addEventListener('click', showRules);
    $('#resume').addEventListener('click', () => {
      const s = load(SAVE_KEY);
      if (s) enterGame(new Game(s));
    });
    showMenu();
  }

  function showMenu() {
    g = null;
    const s = load(SAVE_KEY);
    const ok = s && s.version === VERSION && s.phase !== 'over';
    if (s && !ok) store(SAVE_KEY, null);
    $('#resume').hidden = !ok;
    if (ok) $('#resume').textContent = `Continuar la partida (${MODES[s.mode].n.toLowerCase()}, ronda ${s.round})`;
    $('#game').hidden = true;
    $('#menu').hidden = false;
    document.querySelectorAll('.backdrop').forEach((b) => b.remove());
  }

  function startGame() {
    const mode = document.querySelector('input[name=mode]:checked').value;
    const level = document.querySelector('input[name=level]:checked').value;
    const slots = [...document.querySelectorAll('.slot')].map((el, i) => ({
      type: el.querySelector('select').value,
      name: el.querySelector('input').value.trim().slice(0, 14) || 'Jugador ' + (i + 1)
    }));
    const players = slots.filter((sl) => sl.type !== 'off').map((sl) => ({ name: sl.name, ai: sl.type === 'ai' }));
    if (players.length < 2) { toast('Hacen falta al menos 2 jugadores.'); return; }
    prefs.mode = mode; prefs.level = level; prefs.slots = slots;
    store(PREFS_KEY, prefs);
    enterGame(Game.create({ mode, level, players }));
  }

  function enterGame(game) {
    g = game;
    g.s.fx = [];
    shown = g.s.players.map((p) => p.pos);
    lastMoney = g.s.players.map((p) => p.money);
    lastHuman = -1;
    $('#menu').hidden = true;
    $('#game').hidden = false;
    buildTokens();
    render();
    pump();
  }

  /* ---------- tablero ---------- */
  const N = () => g.B.sq.length;
  function cellPos(i) {
    const n = N() / 4, D = n + 1;
    let r, c, side;
    if (i <= n) { r = D; c = D - i; side = 'b'; }
    else if (i <= 2 * n) { c = 1; r = D - (i - n); side = 'l'; }
    else if (i <= 3 * n) { r = 1; c = 1 + (i - 2 * n); side = 't'; }
    else { c = D; r = 1 + (i - 3 * n); side = 'r'; }
    return { r, c, side: i % n === 0 ? 'c' : side };
  }

  function housesHtml(h) {
    if (h === 5) return '<i class="hs big"></i>';
    return '<i class="hs"></i>'.repeat(h);
  }

  function cellHtml(i) {
    const s = g.s, q = g.sq(i), P = cellPos(i), o = s.owner[i];
    let cls = `sq s-${P.side} t-${q.t}`;
    let style = `grid-area:${P.r}/${P.c}`;
    let inner = '';
    if (q.t === 'prop') {
      style += `;--g:${g.B.groups[q.g].c}`;
      inner += `<i class="band">${housesHtml(s.houses[i])}</i><span class="ab">${esc(q.ab)}</span>`;
    } else {
      inner += icon(sqIcon(q), 'sic');
      if (P.side !== 'c') inner += `<span class="ab">${esc(q.ab)}</span>`;
    }
    if (o === -1) inner += `<span class="pr">${q.price}</span>`;
    if (o != null && o >= 0) {
      cls += ' own';
      style += `;--o:${COLORS[o]}`;
      if (s.mort[i]) cls += ' mort';
    }
    if ((s.phase === 'buy' && s.players[s.turn].pos === i) || (s.phase === 'auction' && s.auction.sq === i)) cls += ' hot';
    return `<button class="${cls}" style="${style}" data-sq="${i}" aria-label="${esc(q.n)}">${inner}</button>`;
  }

  function dieHtml(n) {
    const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    const on = PIPS[n] || [];
    return `<span class="die ${n ? '' : 'blank'}">${Array.from({ length: 9 }, (_, k) => on.includes(k) ? '<i></i>' : '<b></b>').join('')}</span>`;
  }

  function render() {
    if (!g) return;
    const s = g.s;
    const D = N() / 4 + 1;
    $('#boardbox').style.setProperty('--D', D);
    $('#boardbox').classList.toggle('mini', g.M.board === 'mini');
    const M = g.M;
    $('#round').textContent = `${M.n} · ${LEVELS[s.level].n} · ronda ${s.round}${M.rounds ? ' de ' + M.rounds : ''}`;
    renderPlayers();
    $('#board').innerHTML = g.B.sq.map((_, i) => cellHtml(i)).join('') + centerHtml();
    renderActs();
    renderLog();
    placeTokens();
  }

  function renderPlayers() {
    const s = g.s;
    $('#players').className = 'players n' + s.players.length;
    $('#players').innerHTML = s.players.map((pl, p) => {
      const n = g.owned(p).length;
      const d = pl.money - (lastMoney[p] ?? pl.money);
      const flash = d > 0 ? 'flash-up' : d < 0 ? 'flash-down' : '';
      return `<button class="pchip ${p === s.turn && s.phase !== 'over' ? 'on' : ''} ${pl.out ? 'out' : ''}" style="--c:${COLORS[p]}" data-p="${p}">
        <span class="pname">${tokdot(p)}<span>${esc(pl.name)}</span></span>
        <span class="pmoney"><span class="${flash}">${am(pl.money)}</span><small>${n ? n + '🦕' : ''}${pl.jail ? ' 🔒' : ''}${pl.passes.length ? ' 🎟️' : ''}</small></span>
      </button>`;
    }).join('');
    lastMoney = s.players.map((pl) => pl.money);
  }

  function statusHtml() {
    const s = g.s, a = g.actor(), pl = s.players[s.turn];
    const last = s.log[s.log.length - 1] || '';
    const sub = `<span class="sub">${last}</span>`;
    if (s.phase === 'over') return `¡${pname(s.winner)} gana la partida!`;
    if (busy && !human(a)) {
      return `<span class="thinking"><i></i><i></i><i></i></span><br>${phaseLine(a)}${sub}`;
    }
    if (s.phase === 'buy') {
      const i = pl.pos, q = g.sq(i);
      const gcol = q.t === 'prop' ? g.B.groups[q.g].c : 'var(--amber)';
      const pic = q.t === 'prop' ? fig(q.fig) : '';
      return `<span style="--g:${gcol}">${pic}</span><b>${esc(q.n)}</b> está libre. ¿Lo compras por ${am(q.price)}?`;
    }
    return phaseLine(a) + sub;
  }
  function phaseLine(a) {
    const s = g.s, pl = s.players[s.turn];
    switch (s.phase) {
      case 'roll':
        if (pl.jail) return `${pname(s.turn)} está en cuarentena (intento ${pl.tries + 1} de 3).`;
        return s.again ? `¡Dobles! ${pname(s.turn)} vuelve a tirar.` : `Turno de ${pname(s.turn)}.`;
      case 'main': return `Turno de ${pname(s.turn)}.`;
      case 'buy': return `${pname(s.turn)} decide si compra ${esc(g.sq(pl.pos).n)}.`;
      case 'auction': {
        const au = s.auction;
        return `Subasta de <b>${esc(g.sq(au.sq).n)}</b>: ${au.high >= 0 ? am(au.bid) + ' de ' + pname(au.high) : 'sin pujas'}. Puja ${pname(a)}.`;
      }
      case 'debt': {
        const d = s.debt;
        const to = d.to === 'todos' ? 'los demás' : d.to >= 0 ? pname(d.to) : 'el parque';
        return `${pname(d.p)} debe ${am(d.n)} a ${to} y le faltan ${am(d.n - s.players[d.p].money)}.`;
      }
    }
    return '';
  }

  function buttonsHtml() {
    const s = g.s, a = g.actor();
    if (s.phase === 'over') return `<button class="btn primary full" data-act="final">Ver resultado</button>`;
    if (!human(a)) return '';
    const dis = busy ? 'disabled' : '';
    const pl = s.players[a];
    const b = (act, label, cls, off) => `<button class="btn ${cls || ''}" data-act="${act}" ${dis} ${off ? 'disabled' : ''}>${label}</button>`;
    switch (s.phase) {
      case 'roll':
        if (pl.jail) {
          return b('roll', 'Probar dobles', 'primary full') + b('payjail', `Pagar ${JAIL_FEE}`, '', pl.money < JAIL_FEE) +
            (pl.passes.length ? b('pass', 'Usar pase') : '');
        }
        return b('roll', '🎲 Tirar los dados', 'primary full');
      case 'main': return b('end', 'Terminar turno', 'primary full');
      case 'buy': {
        const q = g.sq(pl.pos);
        return b('buy', 'Comprar', 'primary', pl.money < q.price) + b('decline', 'Subastar');
      }
      case 'auction': {
        const au = s.auction;
        return [10, 50, 100].map((k) => b('bid' + k, `+${k} → ${au.bid + k}`, k === 10 ? 'primary' : '', au.bid + k > pl.money)).join('') + b('bidpass', 'Me retiro');
      }
      case 'debt':
        return b('settle', `Pagar ${s.debt.n}`, 'primary', pl.money < s.debt.n) + b('mine', 'Conseguir dinero') + b('declare', 'Me arruino', 'danger full');
    }
    return '';
  }

  function centerHtml() {
    const s = g.s;
    return `<div class="center">
      <div class="cbrand"><svg aria-hidden="true"><use href="#logo"/></svg>Isla Jurásica</div>
      <div class="dice" id="dice">${dieHtml(s.dice[0])}${dieHtml(s.dice[1])}</div>
      <div class="status">${statusHtml()}</div>
      <div class="cbtns">${buttonsHtml()}</div>
    </div>`;
  }

  function renderActs() {
    const s = g.s, m = g.manager(), t = s.turn;
    const canMine = human(m) && !busy;
    const canTrade = human(t) && !busy && (s.phase === 'roll' || s.phase === 'main') && g.alive().length > 1;
    $('#acts').innerHTML = `
      <button class="btn" data-act="mine" ${canMine ? '' : 'disabled'}>🦕 Mis dinosaurios</button>
      <button class="btn" data-act="trade" ${canTrade ? '' : 'disabled'}>🤝 Proponer trato</button>`;
  }

  function renderLog() {
    $('#log').innerHTML = g.s.log.slice(-40).reverse().map((t) => `<p>${t}</p>`).join('');
  }

  /* ---------- fichas ---------- */
  function buildTokens() {
    $('#tokens').innerHTML = g.s.players.map((pl, p) =>
      `<i class="tok" id="tok-${p}" style="--c:${COLORS[p]}">${esc(initial(pl.name))}</i>`).join('');
  }
  function tokXY(p, i) {
    const P = cellPos(i), D = N() / 4 + 1, o = TOKEN_OFF[p];
    return [((P.c - 0.5 + o[0]) / D) * 100, ((P.r - 0.5 + o[1]) / D) * 100];
  }
  function placeTokens() {
    g.s.players.forEach((pl, p) => {
      const el = document.getElementById('tok-' + p);
      if (!el) return;
      el.hidden = pl.out;
      const [x, y] = tokXY(p, shown[p]);
      el.style.left = x + '%';
      el.style.top = y + '%';
      el.classList.toggle('on', p === g.s.turn);
    });
  }
  async function moveToken(e) {
    const el = document.getElementById('tok-' + e.p), n = N();
    if (!el) return;
    if (e.how === 'j') {
      el.classList.add('jump');
      shown[e.p] = e.to; placeTokens();
      await sleep(520);
      el.classList.remove('jump');
      return;
    }
    const dir = e.how === 'b' ? -1 : 1;
    const steps = (dir === 1 ? e.to - e.from + n : e.from - e.to + n) % n;
    const ms = steps > 12 ? 55 : 115;
    for (let k = 1; k <= steps; k++) {
      shown[e.p] = (e.from + dir * k + n) % n;
      placeTokens();
      await sleep(ms);
    }
    shown[e.p] = e.to;
    placeTokens();
    await sleep(120);
  }

  /* Reproduce lo que acaba de pasar: dados, movimientos y cartas */
  async function playFx() {
    const fx = g.s.fx;
    while (fx.length) {
      const e = fx.shift();
      if (e.k === 'dice') {
        const d = $('#dice');
        if (d) {
          d.innerHTML = dieHtml(e.a) + dieHtml(e.b);
          d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll');
        }
        await sleep(450);
      } else if (e.k === 'move') await moveToken(e);
      else if (e.k === 'card') await showCard(e);
    }
  }

  async function showCard(e) {
    const c = DECKS[e.deck][e.id], title = e.deck === 'exp' ? 'Expedición' : 'Incubadora';
    if (human(e.p)) {
      await dialog(`<div class="cardhead">${icon(e.deck)}<b>${title}</b></div>
        <p class="cardtext">${esc(c.t)}</p><button class="btn primary big" data-close="ok">Vale</button>`, 'card-' + e.deck);
    } else {
      toast(`${icon(e.deck)} <b>${title}</b> · ${pname(e.p)}: ${esc(c.t)}`, 'card ' + e.deck, 3200);
      await sleep(1300);
    }
  }

  /* ---------- bucle de la partida ---------- */
  async function pump() {
    if (busy || !g) return;
    busy = true;
    const game = g;
    try {
      for (;;) {
        if (g !== game) return;
        render();
        await playFx();
        if (g !== game) return;
        save();
        if (g.s.phase === 'over') break;
        const a = g.actor();
        if (human(a)) { announce(a); break; }
        await sleep(g.s.phase === 'auction' ? 380 : 560);
        if (g !== game) return;
        const r = AI.step(g);
        if (r && r.offer) await resolveAiOffer(r.offer);
        else if (!r) break;
      }
    } finally {
      busy = false;
    }
    if (g !== game) return;
    render();
    if (g.s.phase === 'over') gameOver();
  }

  /* Con varias personas, avisa de a quién le toca */
  function announce(a) {
    const humans = g.s.players.filter((pl) => !pl.ai && !pl.out).length;
    if (humans > 1 && a !== lastHuman) toast(`Le toca a ${pname(a)}`, '', 1800);
    lastHuman = a;
  }

  function act(name) {
    if (busy || !g) return;
    const s = g.s, a = g.actor();
    let ok = true;
    switch (name) {
      case 'roll': ok = g.roll(); break;
      case 'payjail': ok = g.payJail(); break;
      case 'pass': ok = g.usePass(); break;
      case 'end': ok = g.endTurn(); break;
      case 'buy': ok = g.buy(); break;
      case 'decline': ok = g.decline(); break;
      case 'bid10': case 'bid50': case 'bid100': ok = g.bid(s.auction.bid + Number(name.slice(3))); break;
      case 'bidpass': ok = g.passBid(); break;
      case 'settle': ok = g.settle(); break;
      case 'declare': return confirmDeclare();
      case 'mine': return openMine(g.manager());
      case 'trade': return openTrade();
      case 'final': return gameOver();
      default: return;
    }
    if (!ok) { toast('Ahora no se puede.'); return; }
    if (human(a)) lastHuman = a;
    pump();
  }

  async function confirmDeclare() {
    const r = await dialog(`<h2>¿Te arruinas?</h2>
      <p>Si no puedes reunir el dinero, lo pierdes todo y quedas fuera de la partida.</p>
      <div class="row"><button class="btn" data-close="no">Seguir intentándolo</button><button class="btn danger" data-close="yes">Me arruino</button></div>`);
    if (r === 'yes' && g.declare()) pump();
  }

  /* ---------- fichas de casilla ---------- */
  function deedHtml(i) {
    const s = g.s, q = g.sq(i), o = s.owner[i];
    const gr = q.t === 'prop' ? g.B.groups[q.g] : null;
    const color = gr ? gr.c : q.t === 'tren' ? '#6e5a2a' : q.t === 'serv' ? '#5a5f2a' : '#2e7d4f';
    let body = '';
    if (q.t === 'prop') {
      const full = o >= 0 && g.ownsGroup(o, q.g), h = s.houses[i];
      const rows = [['Solar', q.rent[0], !h && !full], ['Con la zona completa', q.rent[0] * 2, !h && full],
        ['1 recinto', q.rent[1], h === 1], ['2 recintos', q.rent[2], h === 2], ['3 recintos', q.rent[3], h === 3],
        ['4 recintos', q.rent[4], h === 4], ['Santuario', q.rent[5], h === 5]];
      body = `<div class="figbox">${fig(q.fig)}</div><p class="dato">${esc(q.dato)}</p>
        <table class="rents">${rows.map(([t, n, now]) => `<tr class="${o >= 0 && now ? 'now' : ''}"><td>${t}</td><td>${am(n)}</td></tr>`).join('')}</table>
        <p class="deedfoot">Cada recinto cuesta ${am(gr.house)}. El santuario cuesta lo mismo y se pone sobre 4 recintos. Hipoteca: ${am(q.price / 2)}.</p>`;
    } else if (q.t === 'tren') {
      body = `<div class="figbox">${icon('tren', 'sicbig')}</div>
        <table class="rents">${g.B.trenRent.map((n, k) => `<tr><td>Con ${k + 1} transporte${k ? 's' : ''}</td><td>${am(n)}</td></tr>`).join('')}</table>
        <p class="deedfoot">Hipoteca: ${am(q.price / 2)}.</p>`;
    } else if (q.t === 'serv') {
      body = `<div class="figbox">${icon('serv', 'sicbig')}</div>
        <p class="dato">Si tienes uno, cobras 4 veces lo que saque la tirada. Si tienes los dos, 10 veces.</p>
        <p class="deedfoot">Hipoteca: ${am(q.price / 2)}.</p>`;
    } else {
      const TXT = {
        salida: `Cada vez que pasas por aquí cobras ${am(g.M.salary)}.`,
        carta: q.deck === 'exp' ? 'Saca una carta de Expedición: aventuras, sustos y atajos.' : 'Saca una carta de Incubadora: dinero, gastos y alguna sorpresa.',
        tasa: `Pagas ${am(q.amount)} al parque.`,
        cuar: `Si solo pasas de visita no ocurre nada. Para salir de la cuarentena: saca dobles, paga ${am(JAIL_FEE)} o usa un pase del veterinario.`,
        mirador: 'Un rato de descanso con vistas. Aquí no pasa nada.',
        fuga: '¡Un dinosaurio se ha escapado! Vas directo a la cuarentena sin pasar por la Salida.'
      };
      body = `<div class="figbox">${icon(sqIcon(q), 'sicbig')}</div><p class="dato">${TXT[q.t]}</p>`;
    }
    const zone = gr ? 'Zona ' + gr.n : q.t === 'tren' ? 'Transporte' : q.t === 'serv' ? 'Instalación' : 'Casilla especial';
    const who = o == null ? '' : o >= 0
      ? `<div class="owner">${tokdot(o)} De ${esc(s.players[o].name)}${s.mort[i] ? ' · hipotecado' : ''}${s.houses[i] ? ' · ' + (s.houses[i] === 5 ? 'santuario' : s.houses[i] + ' recinto' + (s.houses[i] > 1 ? 's' : '')) : ''}</div>`
      : `<div class="owner">Libre · ${am(q.price)}</div>`;
    return `<div class="deed" style="--g:${color}"><header><small>${zone}</small><h2>${esc(q.n)}</h2></header>${body}${who}</div>`;
  }

  function openSquare(i) {
    const q = g.sq(i), m = g.manager();
    const mine = ownable(q) && g.s.owner[i] === m && human(m) && !busy;
    const m2 = openModal(`<div id="deedbox"></div><div class="row" id="deedbtns"></div>`);
    const draw = () => {
      m2.el.querySelector('#deedbox').innerHTML = deedHtml(i);
      m2.el.querySelector('#deedbtns').innerHTML = (mine ? manageBtns(i) : '') + '<button class="btn" data-x="close">Cerrar</button>';
    };
    draw();
    m2.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.x === 'close') { m2.close(); return; }
      if (manageClick(b)) { draw(); render(); }
    });
  }

  function manageBtns(i) {
    const q = g.sq(i), s = g.s, out = [];
    if (q.t === 'prop') {
      out.push(`<button class="btn" data-m="build" data-i="${i}" ${g.canBuild(i) ? '' : 'disabled'} title="Construir">＋ ${s.houses[i] === 4 ? 'Santuario' : 'Recinto'}</button>`);
      if (s.houses[i]) out.push(`<button class="btn" data-m="sell" data-i="${i}" ${g.canSell(i) ? '' : 'disabled'}>− Vender</button>`);
    }
    if (s.mort[i]) out.push(`<button class="btn" data-m="unmort" data-i="${i}" ${g.canUnmortgage(i) ? '' : 'disabled'}>Levantar ${g.unmortgageCost(i)}</button>`);
    else out.push(`<button class="btn" data-m="mort" data-i="${i}" ${g.canMortgage(i) ? '' : 'disabled'}>Hipotecar</button>`);
    return out.join('');
  }
  function manageClick(b) {
    const i = Number(b.dataset.i);
    switch (b.dataset.m) {
      case 'build': return g.build(i);
      case 'sell': return g.sell(i);
      case 'mort': return g.mortgage(i);
      case 'unmort': return g.unmortgage(i);
    }
    return false;
  }

  /* ---------- mis dinosaurios ---------- */
  function openMine(p) {
    if (!human(p) || busy) return;
    const m = openModal('<div id="minebox"></div>');
    const draw = () => {
      const s = g.s;
      const list = g.owned(p).sort((a, b) => (g.sq(a).g ?? 99) - (g.sq(b).g ?? 99) || a - b);
      const debt = s.phase === 'debt' && s.debt.p === p
        ? `<div class="debtbar"><span>Debes ${am(s.debt.n)} · tienes ${am(s.players[p].money)}</span>
            <button class="btn primary" data-x="settle" ${s.players[p].money < s.debt.n ? 'disabled' : ''}>Pagar</button></div>` : '';
      m.el.querySelector('#minebox').innerHTML = `<h2>Dinosaurios de ${esc(s.players[p].name)}</h2>
        <p class="muted">Tienes ${am(s.players[p].money)}. Para construir necesitas toda la zona y sin hipotecas; los recintos se reparten por igual.</p>
        ${debt}
        <div class="plist">${list.length ? list.map((i) => rowHtml(i)).join('') : '<p class="muted">Todavía no tienes ninguno.</p>'}</div>
        <div class="row"><button class="btn primary" data-x="close">Listo</button></div>`;
    };
    const rowHtml = (i) => {
      const q = g.sq(i), s = g.s;
      const col = q.t === 'prop' ? g.B.groups[q.g].c : '#8a7a55';
      const st = [s.houses[i] === 5 ? 'Santuario' : s.houses[i] ? s.houses[i] + ' recinto' + (s.houses[i] > 1 ? 's' : '') : '',
        s.mort[i] ? 'Hipotecado' : '', q.t === 'prop' && g.ownsGroup(p, q.g) ? 'Zona completa' : '',
        !s.mort[i] ? 'Alquiler ' + g.rent(i, 7) : ''].filter(Boolean).join(' · ');
      return `<div class="prow" style="--g:${col}"><i></i><span class="nm">${esc(q.n)}</span><span class="st">${st}</span>
        <span class="pb">${manageBtns(i).replace(/＋ (Recinto|Santuario)/, '＋').replace('− Vender', '−').replace(/Levantar (\d+)/, 'Levantar')}</span></div>`;
    };
    draw();
    m.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.x === 'close') { m.close(); render(); return; }
      if (b.dataset.x === 'settle') {
        if (g.settle()) { m.close(); pump(); }
        return;
      }
      if (manageClick(b)) { draw(); render(); }
    });
  }

  /* ---------- tratos ---------- */
  function openTrade() {
    const s = g.s, me = s.turn;
    if (!human(me) || busy) return;
    const others = g.alive().filter((p) => p !== me);
    const st = { to: others[0], give: new Set(), get: new Set(), gm: 0, tm: 0, msg: '', cls: '' };
    const m = openModal('<div id="tradebox"></div>');
    const tradable = (i) => g.sq(i).t !== 'prop' || g.groupHouses(g.sq(i).g) === 0;
    const offer = () => ({ from: me, to: st.to, give: [...st.give], get: [...st.get], giveMoney: st.gm, getMoney: st.tm });
    const pick = (i, set, side) => {
      const q = g.sq(i), ok = tradable(i);
      const col = q.t === 'prop' ? g.B.groups[q.g].c : '#8a7a55';
      return `<label class="tpick ${ok ? '' : 'no'}" style="--g:${col}"><input type="checkbox" data-side="${side}" data-i="${i}" ${set.has(i) ? 'checked' : ''} ${ok ? '' : 'disabled'}><i></i><span>${esc(q.n)}${s.mort[i] ? ' (hip.)' : ''}</span></label>`;
    };
    const money = (side, v, max) => `<div class="money"><button class="btn" data-mm="${side}" data-d="-50">−50</button><button class="btn" data-mm="${side}" data-d="-10">−10</button>
      <b>${am(v)}</b><button class="btn" data-mm="${side}" data-d="10" ${v + 10 > max ? 'disabled' : ''}>+10</button><button class="btn" data-mm="${side}" data-d="50" ${v + 50 > max ? 'disabled' : ''}>+50</button></div>`;
    const draw = () => {
      const mine = g.owned(me), theirs = g.owned(st.to);
      const o = offer();
      m.el.querySelector('#tradebox').innerHTML = `<h2>Proponer un trato</h2>
        <div class="who">${others.map((p) => `<button class="btn ${p === st.to ? 'sel' : ''}" data-to="${p}">${tokdot(p)} ${esc(s.players[p].name)}</button>`).join('')}</div>
        <div class="tcols">
          <div class="tcol"><h3>Tú das</h3>${mine.map((i) => pick(i, st.give, 'give')).join('') || '<p class="muted">Nada que dar.</p>'}${money('gm', st.gm, s.players[me].money)}</div>
          <div class="tcol"><h3>Pides a ${esc(s.players[st.to].name)}</h3>${theirs.map((i) => pick(i, st.get, 'get')).join('') || '<p class="muted">No tiene dinosaurios.</p>'}${money('tm', st.tm, s.players[st.to].money)}</div>
        </div>
        <p class="muted">No se pueden cambiar dinosaurios de una zona con recintos.</p>
        <p class="tmsg ${st.cls}">${st.msg}</p>
        <div class="row"><button class="btn" data-x="close">Cerrar</button><button class="btn primary" data-x="send" ${g.canTrade(o) ? '' : 'disabled'}>Proponer</button></div>`;
    };
    draw();
    m.el.addEventListener('change', (ev) => {
      const c = ev.target;
      if (!c.dataset.side) return;
      const set = c.dataset.side === 'give' ? st.give : st.get, i = Number(c.dataset.i);
      if (c.checked) set.add(i); else set.delete(i);
      st.msg = ''; draw();
    });
    m.el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.to) { st.to = Number(b.dataset.to); st.get.clear(); st.tm = 0; st.msg = ''; draw(); return; }
      if (b.dataset.mm) {
        const key = b.dataset.mm, max = key === 'gm' ? s.players[me].money : s.players[st.to].money;
        st[key] = Math.max(0, Math.min(max, st[key] + Number(b.dataset.d)));
        st.msg = ''; draw(); return;
      }
      if (b.dataset.x === 'close') { m.close(); render(); return; }
      if (b.dataset.x === 'send') {
        const o = offer();
        if (!g.canTrade(o)) return;
        if (s.players[st.to].ai) {
          const r = AI.judge(g, st.to, o);
          if (r.ok) {
            g.trade(o); m.close(); toast(`${pname(st.to)} acepta el trato.`); pump();
          } else {
            st.msg = AI.refusal(g, st.to, o, r); st.cls = '';
            draw();
            requestAnimationFrame(() => { const el = m.el.querySelector('.tmsg'); if (el) el.classList.add('no'); });
          }
        } else {
          m.close();
          const yes = await askHuman(st.to, o);
          if (yes) { g.trade(o); toast('Trato hecho.'); }
          else toast(`${pname(st.to)} rechaza el trato.`);
          pump();
        }
      }
    });
  }

  function offerHtml(o) {
    const own = g.s.owner.slice();
    o.give.forEach((i) => { own[i] = o.to; });
    o.get.forEach((i) => { own[i] = o.from; });
    const zones = (p, sqs) => [...new Set(sqs.filter((i) => g.sq(i).t === 'prop').map((i) => g.sq(i).g))]
      .filter((gi) => g.B.groups[gi].sq.every((j) => own[j] === p)).map((gi) => g.B.groups[gi].n);
    const warn = [[o.from, o.get], [o.to, o.give]].map(([p, sqs]) => {
      const z = zones(p, sqs);
      return z.length ? `<p class="muted">Con este trato ${pname(p)} completaría la zona ${z.join(' y la zona ')}.</p>` : '';
    }).join('');
    return `<div class="offer">${pname(o.from)} da: <b>${sideTxt(o.give, o.giveMoney)}</b><br>${pname(o.to)} da: <b>${sideTxt(o.get, o.getMoney)}</b></div>${warn}`;
  }
  function sideTxt(sqs, m) {
    const parts = sqs.map((i) => esc(g.sq(i).n));
    if (m) parts.push(am(m));
    return parts.join(', ') || 'nada';
  }
  async function askHuman(p, o) {
    const r = await dialog(`<h2>${esc(g.s.players[p].name)}, te proponen un trato</h2>${offerHtml(o)}
      <div class="row"><button class="btn" data-close="no">Rechazar</button><button class="btn primary" data-close="yes">Aceptar</button></div>`);
    return r === 'yes';
  }
  async function resolveAiOffer(o) {
    const s = g.s;
    let ok;
    if (s.players[o.to].ai) ok = AI.judge(g, o.to, o).ok;
    else {
      render();
      ok = await askHuman(o.to, o);
    }
    if (ok && g.trade(o)) { toast(`🤝 Trato: ${pname(o.from)} y ${pname(o.to)}`); return; }
    s.refused[o.from + '-' + o.get[0]] = s.round;
    g.log(`${pname(o.to)} rechaza la propuesta de ${pname(o.from)} (${g.describe(o)}).`);
  }

  /* ---------- final ---------- */
  async function gameOver() {
    const s = g.s;
    save();
    const rank = g.ranking();
    const why = g.M.rounds && g.alive().length > 1 ? `Se han jugado las ${g.M.rounds} rondas: gana quien más vale.` : 'Todos los demás se han arruinado.';
    const r = await dialog(`<h2>¡${esc(s.players[s.winner].name)} gana!</h2><p class="muted">${why}</p>
      <div class="rank">${rank.map((p) => `<div>${tokdot(p)}<span>${esc(s.players[p].name)}</span>${s.players[p].out ? 'arruinado' : am(g.worth(p))}</div>`).join('')}</div>
      <div class="row"><button class="btn" data-close="board">Ver el tablero</button><button class="btn primary" data-close="menu">Nueva partida</button></div>`);
    if (r === 'menu') { store(SAVE_KEY, null); showMenu(); }
  }

  /* ---------- menú de la partida y reglas ---------- */
  async function gameMenu() {
    const r = await dialog(`<h2>Menú</h2>
      <p class="muted">La partida se guarda sola en este dispositivo.</p>
      <div class="row"><button class="btn" data-close="speed">Velocidad: ${prefs.speed < 1 ? 'rápida' : 'normal'}</button></div>
      <div class="row"><button class="btn" data-close="rules">Cómo se juega</button></div>
      <div class="row"><button class="btn" data-close="exit">Salir al inicio</button></div>
      <div class="row"><button class="btn danger" data-close="quit">Abandonar la partida</button></div>
      <div class="row"><button class="btn primary" data-close="close">Volver al juego</button></div>`);
    if (r === 'speed') { prefs.speed = prefs.speed < 1 ? 1 : 0.45; store(PREFS_KEY, prefs); toast('Velocidad ' + (prefs.speed < 1 ? 'rápida' : 'normal') + '.'); }
    else if (r === 'rules') showRules();
    else if (r === 'exit') { save(); showMenu(); }
    else if (r === 'quit') {
      const c = await dialog(`<h2>¿Abandonar?</h2><p>Se borrará la partida guardada.</p>
        <div class="row"><button class="btn" data-close="no">No</button><button class="btn danger" data-close="yes">Abandonar</button></div>`);
      if (c === 'yes') { store(SAVE_KEY, null); showMenu(); }
    }
  }

  function showRules() {
    dialog(`<div class="rules"><h2>Cómo se juega</h2>
      <p>Recorre la isla tirando dos dados. Compra dinosaurios, completa zonas y cobra a los demás cada vez que caigan en lo tuyo.
      Gana quien deje a los demás sin ámbar (o, en la partida rápida, quien más valga al final).</p>
      <h3>Tu turno</h3>
      <ul><li>Tira los dados y avanza. Si sacas dobles vuelves a tirar; tres dobles seguidos te mandan a la cuarentena.</li>
      <li>Cada vez que pasas por la <b>Salida</b> cobras tu sueldo.</li>
      <li>Si caes en un dinosaurio libre puedes comprarlo. Si no lo quieres, sale a <b>subasta</b> entre todos.</li>
      <li>Si tiene dueño, le pagas el alquiler (salvo que esté hipotecado).</li></ul>
      <h3>Zonas, recintos y santuarios</h3>
      <ul><li>Los dinosaurios del mismo color forman una <b>zona</b>. Con la zona completa cobras el doble.</li>
      <li>Con la zona completa y sin hipotecas puedes construir <b>recintos</b> (hasta 4 por dinosaurio) y luego un <b>santuario</b>. Hay que repartirlos por igual.</li>
      <li>Los dinosaurios van de menos a más populares: el Compsognathus es el más barato y el Tyrannosaurus rex, el más caro.</li></ul>
      <h3>Transportes e instalaciones</h3>
      <ul><li>Los transportes cobran más cuantos más tengas.</li>
      <li>La Central geotérmica y el Laboratorio genético cobran 4 veces la tirada (10 si tienes los dos).</li></ul>
      <h3>Dinero y apuros</h3>
      <ul><li>Si no te llega, puedes <b>hipotecar</b> (recibes la mitad del precio) o vender recintos a mitad de precio.</li>
      <li>Si ni así puedes pagar, te arruinas y quedas fuera.</li>
      <li>En <b>Proponer trato</b> puedes cambiar dinosaurios y dinero con los demás. Las máquinas solo aceptan si les compensa.</li></ul>
      <h3>Cuarentena</h3>
      <p>Para salir: saca dobles (tienes tres intentos), paga ${JAIL_FEE} o usa un pase del veterinario.</p>
      <h3>Consejo</h3><p>Pulsa cualquier casilla del tablero para ver su ficha, con el dato curioso del dinosaurio.</p>
      <div class="row"><button class="btn primary" data-close="ok">Entendido</button></div></div>`);
  }

  /* ---------- entrada ---------- */
  document.addEventListener('click', (ev) => {
    if (!g || $('#game').hidden || ev.target.closest('.backdrop')) return;
    const a = ev.target.closest('[data-act]');
    if (a && !a.disabled) { act(a.dataset.act); return; }
    const sq = ev.target.closest('[data-sq]');
    if (sq) { openSquare(Number(sq.dataset.sq)); return; }
    const pc = ev.target.closest('[data-p]');
    if (pc) { showPlayer(Number(pc.dataset.p)); return; }
  });
  $('#bmenu').addEventListener('click', gameMenu);
  $('#bhelp').addEventListener('click', showRules);

  function showPlayer(p) {
    const s = g.s, pl = s.players[p];
    if (human(p) && p === g.manager() && !busy) return openMine(p);
    const list = g.owned(p);
    dialog(`<h2>${tokdot(p)} ${esc(pl.name)}</h2>
      <p class="muted">${pl.ai ? 'Máquina' : 'Persona'} · ${am(pl.money)} en efectivo · vale ${am(g.worth(p))}${pl.passes.length ? ' · tiene pase del veterinario' : ''}</p>
      <div class="plist">${list.map((i) => {
        const q = g.sq(i), col = q.t === 'prop' ? g.B.groups[q.g].c : '#8a7a55';
        const st = [s.houses[i] === 5 ? 'Santuario' : s.houses[i] ? s.houses[i] + ' recinto' + (s.houses[i] > 1 ? 's' : '') : '', s.mort[i] ? 'Hipotecado' : ''].filter(Boolean).join(' · ');
        return `<div class="prow" style="--g:${col}"><i></i><span class="nm">${esc(q.n)}</span><span class="st">${st || 'Alquiler ' + g.rent(i, 7)}</span><span class="pb"></span></div>`;
      }).join('') || '<p class="muted">Sin dinosaurios.</p>'}</div>
      <div class="row"><button class="btn primary" data-close="ok">Cerrar</button></div>`);
  }

  initMenu();
})();
