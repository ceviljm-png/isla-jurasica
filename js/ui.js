/* Isla Jurásica — interfaz: dibujo, entrada, diálogos, bucle de turnos, guardado y partidas en red */
(function () {
  'use strict';

  const { Game, MODES, LEVELS, DECKS, JAIL_FEE, VERSION, esc, ownable } = window.Jurasica;
  const AI = window.JurasicaAI;
  const Net = window.Net;
  const $ = (q) => document.querySelector(q);

  const SAVE_KEY = 'isla-jurasica-partida';
  const PREFS_KEY = 'isla-jurasica-ajustes';
  const NET_KEY = 'isla-jurasica-sala';        // invitado: a qué sala volver
  const DEV_KEY = 'isla-jurasica-dispositivo';
  const ROOM_PREFIX = 'islajurasica-';
  const COLORS = ['#e4572e', '#2f7cf6', '#e0a800', '#9b5de5'];
  const AI_NAMES = ['Dra. Fósil', 'Capitán Ámbar', 'Tía Raptor', 'Profe Huesos'];
  const TOKEN_OFF = [[-0.2, -0.17], [0.2, -0.17], [-0.2, 0.19], [0.2, 0.19]];

  let g = null;          // partida en curso (en un invitado, copia de la del anfitrión)
  let busy = false;      // la máquina o una animación tienen el control
  let shown = [];        // casilla en la que se ve cada ficha
  let lastMoney = [];
  let lastLocal = -1;
  let prefs = { speed: 1, mode: 'clasica', level: 'normal', slots: null, netName: '' };
  const refreshers = new Set();   // ventanas abiertas que se redibujan con cada cambio

  /* Red: net = { role: 'host' | 'guest', room, code } */
  let net = null;
  let lobby = null;      // anfitrión antes de empezar: { players: [{ name, dev, ai }] }
  let online = {};       // dispositivo → conectado
  let lastSent = '';
  let lastFxN = 0;
  let inbox = [];        // invitado: estados pendientes de reproducir
  let overShown = false;
  let wake = null;
  const asks = new Map(); let askN = 0;        // anfitrión: preguntas a invitados
  const waits = new Map(); let waitN = 0;      // invitado: respuestas del anfitrión
  const myDev = Net.deviceId(DEV_KEY);

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
    if (!g || isGuest()) return;
    store(SAVE_KEY, g.s.phase === 'over' ? null : g.s);
  }

  const isGuest = () => !!net && net.role === 'guest';
  const isHost = () => !!net && net.role === 'host';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * (prefs.speed || 1) * (inbox.length > 1 ? 0.3 : 1)));
  const am = (n) => `<span class="amb">${Math.round(n)}</span>`;
  const icon = (id, cls) => `<svg class="${cls || 'ic'}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const fig = (id, cls) => `<svg class="${cls || 'fig'}" viewBox="0 0 100 60" aria-hidden="true"><use href="#f-${id}"/></svg>`;
  const initial = (n) => (String(n).trim()[0] || '?').toUpperCase();
  const tokdot = (p) => `<i class="tokdot" style="--c:${COLORS[p]}">${esc(initial(g.s.players[p].name))}</i>`;
  const pname = (p) => '<b>' + esc(g.s.players[p].name) + '</b>';
  /* Persona que sigue en juego */
  const person = (p) => p >= 0 && !!g.s.players[p] && !g.s.players[p].ai && !g.s.players[p].out;
  /* Persona que juega en este dispositivo */
  const local = (p) => person(p) && (!net || g.s.players[p].dev === myDev);
  const connected = (p) => !net || !g.s.players[p].dev || online[g.s.players[p].dev] !== false;
  /* Lo que llega de otro dispositivo solo puede traer negritas */
  const clean = (html) => String(html).replace(/<(?!\/?b>)/g, '&lt;');
  const SQ_ICON = { salida: 'salida', carta: null, tasa: 'tasa', tren: 'tren', serv: 'serv', cuar: 'cuar', mirador: 'mirador', fuga: 'fuga' };
  const sqIcon = (q) => q.t === 'carta' ? q.deck : SQ_ICON[q.t];

  /* ---------- diálogos y avisos ---------- */
  function openModal(html, cls) {
    const wrap = document.createElement('div');
    wrap.className = 'backdrop';
    wrap.innerHTML = `<div class="modal ${cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const m = { el: wrap.firstElementChild, close: () => { wrap.remove(); refreshers.delete(m.draw); } };
    return m;
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
  const closeModals = () => document.querySelectorAll('.backdrop').forEach((b) => b.remove());

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
    $('#resume').addEventListener('click', resumeSaved);
    $('#net-host').addEventListener('click', () => askName('host'));
    $('#net-join').addEventListener('click', () => askName('join'));
    $('#net-back').addEventListener('click', () => {
      const r = load(NET_KEY);
      if (r) joinRoom(r.code, r.name);
    });
    showMenu();
    const code = Net.cleanCode(new URLSearchParams(location.search).get('sala'));
    if (code.length === 4) {
      history.replaceState(null, '', location.pathname);
      askName('join', code);
    }
  }

  function showMenu() {
    g = null;
    leaveNet();
    const s = load(SAVE_KEY);
    const ok = s && s.version === VERSION && s.phase !== 'over' && MODES[s.mode];
    if (s && !ok) store(SAVE_KEY, null);
    $('#resume').hidden = !ok;
    if (ok) {
      $('#resume').textContent = s.net
        ? `Reabrir la sala ${s.net.room} (${MODES[s.mode].n.toLowerCase()}, ronda ${s.round})`
        : `Continuar la partida (${MODES[s.mode].n.toLowerCase()}, ronda ${s.round})`;
    }
    const r = load(NET_KEY);
    $('#net-back').hidden = !r;
    if (r) $('#net-back').textContent = `Volver a la sala ${r.code}`;
    $('#net-help').hidden = Net.available();
    $('#game').hidden = true;
    $('#lobby').hidden = true;
    $('#menu').hidden = false;
    closeModals();
    releaseWake();
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

  async function resumeSaved() {
    const s = load(SAVE_KEY);
    if (!s) return;
    if (!s.net) { enterGame(new Game(s)); return; }
    // partida en red guardada en el anfitrión: reabrir la misma sala
    if (!Net.available()) { toast('No se ha podido cargar el módulo de red.'); return; }
    toast(`Reabriendo la sala ${esc(s.net.room)}…`, '', 4000);
    try {
      await hostRoom(s.net.room);
      enterGame(new Game(s));
    } catch (e) {
      leaveNet();
      toast(netError(e));
    }
  }

  function enterGame(game) {
    g = game;
    g.s.fx = [];
    lastFxN = g.s.fxN || 0;
    shown = g.s.players.map((p) => p.pos);
    lastMoney = g.s.players.map((p) => p.money);
    lastLocal = -1;
    overShown = false;
    $('#menu').hidden = true;
    $('#lobby').hidden = true;
    $('#game').hidden = false;
    buildTokens();
    if (net) keepAwake();
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
    $('#round').textContent = `${M.n} · ${LEVELS[s.level].n} · ronda ${s.round}${M.rounds ? ' de ' + M.rounds : ''}${net ? ' · sala ' + net.code : ''}`;
    renderPlayers();
    $('#board').innerHTML = g.B.sq.map((_, i) => cellHtml(i)).join('') + centerHtml();
    renderActs();
    renderLog();
    placeTokens();
    refreshers.forEach((f) => f());
    sync();
  }

  function renderPlayers() {
    const s = g.s;
    $('#players').className = 'players n' + s.players.length;
    $('#players').innerHTML = s.players.map((pl, p) => {
      const n = g.owned(p).length;
      const d = pl.money - (lastMoney[p] ?? pl.money);
      const flash = d > 0 ? 'flash-up' : d < 0 ? 'flash-down' : '';
      const badges = (n ? n + '🦕' : '') + (pl.jail ? ' 🔒' : '') + (pl.passes.length ? ' 🎟️' : '') +
        (net && pl.dev && !pl.out && !connected(p) ? ' 📵' : '') + (pl.away ? ' 🤖' : '');
      return `<button class="pchip ${p === s.turn && s.phase !== 'over' ? 'on' : ''} ${pl.out ? 'out' : ''} ${net && pl.dev === myDev ? 'me' : ''}" style="--c:${COLORS[p]}" data-p="${p}">
        <span class="pname">${tokdot(p)}<span>${esc(pl.name)}</span></span>
        <span class="pmoney"><span class="${flash}">${am(pl.money)}</span><small>${badges}</small></span>
      </button>`;
    }).join('');
    lastMoney = s.players.map((pl) => pl.money);
  }

  function statusHtml() {
    const s = g.s, a = g.actor(), pl = s.players[s.turn];
    const last = s.log[s.log.length - 1] || '';
    const sub = `<span class="sub">${clean(last)}</span>`;
    if (s.phase === 'over') return `¡${pname(s.winner)} gana la partida!`;
    if (!local(a)) {
      const wait = person(a) && !connected(a) ? `<br><b>${esc(s.players[a].name)}</b> se ha desconectado.` : '';
      return `<span class="thinking"><i></i><i></i><i></i></span><br>${phaseLine(a)}${wait}${sub}`;
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
    const you = (p) => net && local(p) ? '<b>ti</b>' : pname(p);
    switch (s.phase) {
      case 'roll':
        if (pl.jail) return `${pname(s.turn)} está en cuarentena (intento ${pl.tries + 1} de 3).`;
        return s.again ? `¡Dobles! ${pname(s.turn)} vuelve a tirar.` : `Turno de ${you(s.turn)}.`;
      case 'main': return `Turno de ${you(s.turn)}.`;
      case 'buy': return `${pname(s.turn)} decide si compra ${esc(g.sq(pl.pos).n)}.`;
      case 'auction': {
        const au = s.auction;
        return `Subasta de <b>${esc(g.sq(au.sq).n)}</b>: ${au.high >= 0 ? am(au.bid) + ' de ' + pname(au.high) : 'sin pujas'}. Puja ${you(a)}.`;
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
    if (!local(a)) {
      // el anfitrión puede dejar a la máquina el turno de quien se ha ido
      if (isHost() && person(a) && !connected(a)) return `<button class="btn full" data-act="takeover">Que juegue la máquina por ${esc(s.players[a].name)}</button>`;
      return '';
    }
    const dis = busy ? 'disabled' : '';
    const pl = s.players[a];
    const b = (act, label, cls, off) => `<button class="btn ${cls || ''}" data-act="${act}" ${dis} ${off ? 'disabled' : ''}>${label}</button>`;
    switch (s.phase) {
      case 'roll':
        if (pl.jail) {
          return b('roll', 'Probar dobles', 'primary full') + b('payJail', `Pagar ${JAIL_FEE}`, '', pl.money < JAIL_FEE) +
            (pl.passes.length ? b('usePass', 'Usar pase') : '');
        }
        return b('roll', '🎲 Tirar los dados', 'primary full');
      case 'main': return b('endTurn', 'Terminar turno', 'primary full');
      case 'buy': {
        const q = g.sq(pl.pos);
        return b('buy', 'Comprar', 'primary', pl.money < q.price) + b('decline', 'Subastar');
      }
      case 'auction': {
        const au = s.auction;
        return [10, 50, 100].map((k) => b('bid' + k, `+${k} → ${au.bid + k}`, k === 10 ? 'primary' : '', au.bid + k > pl.money)).join('') + b('passBid', 'Me retiro');
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
    const canMine = local(m) && !busy;
    const canTrade = local(t) && !busy && (s.phase === 'roll' || s.phase === 'main') && g.alive().length > 1;
    $('#acts').innerHTML = `
      <button class="btn" data-act="mine" ${canMine ? '' : 'disabled'}>🦕 Mis dinosaurios</button>
      <button class="btn" data-act="trade" ${canTrade ? '' : 'disabled'}>🤝 Proponer trato</button>`;
  }

  function renderLog() {
    $('#log').innerHTML = g.s.log.slice(-40).reverse().map((t) => `<p>${clean(t)}</p>`).join('');
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
      const [x, y] = tokXY(p, shown[p] ?? pl.pos);
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
  async function playFx(fx) {
    while (fx.length) {
      const e = fx.shift();
      if (e.n) lastFxN = Math.max(lastFxN, e.n);
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
    const c = DECKS[e.deck] && DECKS[e.deck][e.id];
    if (!c) return;
    const title = e.deck === 'exp' ? 'Expedición' : 'Incubadora';
    if (local(e.p)) {
      await dialog(`<div class="cardhead">${icon(e.deck)}<b>${title}</b></div>
        <p class="cardtext">${esc(c.t)}</p><button class="btn primary big" data-close="ok">Vale</button>`, 'card-' + e.deck);
    } else {
      toast(`${icon(e.deck)} <b>${title}</b> · ${pname(e.p)}: ${esc(c.t)}`, 'card ' + e.deck, 3200);
      await sleep(1300);
    }
  }

  /* ---------- bucle de la partida (sin red o en el anfitrión) ---------- */
  async function pump() {
    if (busy || !g || isGuest()) return;
    busy = true;
    const game = g;
    try {
      for (;;) {
        if (g !== game) return;
        render();
        await playFx(g.s.fx);
        if (g !== game) return;
        save();
        if (g.s.phase === 'over') break;
        const a = g.actor();
        if (local(a)) { announce(a); break; }
        lastLocal = -1;
        if (person(a)) break;   // persona en otro dispositivo: se espera su jugada
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

  /* Avisa de a quién le toca: con varias personas en el mismo dispositivo, o en red cuando te toca a ti */
  function announce(a) {
    if (a === lastLocal) return;
    lastLocal = a;
    if (net) {
      toast('¡Te toca!', '', 1800);
      if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) { /* sin vibración */ }
      return;
    }
    const humans = g.s.players.filter((pl) => !pl.ai && !pl.out).length;
    if (humans > 1) toast(`Le toca a ${pname(a)}`, '', 1800);
  }

  /* ---------- órdenes ---------- */
  const PARAM = ['bid', 'build', 'sell', 'mortgage', 'unmortgage'];
  /* Aplica una orden en el motor. seat = asiento de quien la manda (null si es de este dispositivo) */
  function apply(seat, cmd, args) {
    const s = g.s, a = Array.isArray(args) ? args : [];
    const n = Number(a[0]);
    if (PARAM.includes(cmd) && !Number.isInteger(n)) return false;
    const who = { actor: g.actor(), manage: g.manager(), debt: s.phase === 'debt' ? s.debt.p : -2 };
    const CMDS = {
      roll: ['actor', () => g.roll()], payJail: ['actor', () => g.payJail()], usePass: ['actor', () => g.usePass()],
      endTurn: ['actor', () => g.endTurn()], buy: ['actor', () => g.buy()], decline: ['actor', () => g.decline()],
      bid: ['actor', () => g.bid(n)], passBid: ['actor', () => g.passBid()],
      settle: ['debt', () => g.settle()], declare: ['debt', () => g.declare()],
      build: ['manage', () => g.build(n)], sell: ['manage', () => g.sell(n)],
      mortgage: ['manage', () => g.mortgage(n)], unmortgage: ['manage', () => g.unmortgage(n)]
    };
    const c = CMDS[cmd];
    if (!c || (seat != null && who[c[0]] !== seat)) return false;
    return c[1]();
  }
  /* Orden desde este dispositivo: se aplica aquí o se manda al anfitrión */
  function exec(cmd, args) {
    if (!g) return;
    if (isGuest()) {
      if (!net.room.toHost({ t: 'act', cmd, args: args || [] })) toast('Sin conexión con la sala. Reintentando…');
      return;
    }
    if (busy && !PARAM.slice(1).includes(cmd)) return;
    if (!apply(null, cmd, args)) { toast('Ahora no se puede.'); return; }
    changed();
  }
  function changed() {
    if (busy) render(); else pump();
  }

  function act(name) {
    if (!g) return;
    const s = g.s;
    if (name.startsWith('bid') && name !== 'bid') return exec('bid', [s.auction ? s.auction.bid + Number(name.slice(3)) : 0]);
    switch (name) {
      case 'declare': return confirmDeclare();
      case 'mine': return openMine(g.manager());
      case 'trade': return openTrade();
      case 'final': return gameOver();
      case 'takeover': return takeover();
      default: return exec(name);
    }
  }

  async function confirmDeclare() {
    const r = await dialog(`<h2>¿Te arruinas?</h2>
      <p>Si no puedes reunir el dinero, lo pierdes todo y quedas fuera de la partida.</p>
      <div class="row"><button class="btn" data-close="no">Seguir intentándolo</button><button class="btn danger" data-close="yes">Me arruino</button></div>`);
    if (r === 'yes') exec('declare');
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
    const m = openModal(`<div id="deedbox"></div><div class="row" id="deedbtns"></div>`);
    m.draw = () => {
      if (!g) return m.close();
      const mgr = g.manager();
      const mine = ownable(g.sq(i)) && g.s.owner[i] === mgr && local(mgr);
      m.el.querySelector('#deedbox').innerHTML = deedHtml(i);
      m.el.querySelector('#deedbtns').innerHTML = (mine ? manageBtns(i) : '') + '<button class="btn" data-x="close">Cerrar</button>';
    };
    m.draw();
    refreshers.add(m.draw);
    m.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.x === 'close') { m.close(); return; }
      if (b.dataset.m) exec(b.dataset.m, [Number(b.dataset.i)]);
    });
  }

  function manageBtns(i, short) {
    const q = g.sq(i), s = g.s, out = [];
    if (q.t === 'prop') {
      out.push(`<button class="btn" data-m="build" data-i="${i}" ${g.canBuild(i) ? '' : 'disabled'} title="Construir">＋${short ? '' : ' ' + (s.houses[i] === 4 ? 'Santuario' : 'Recinto')}</button>`);
      if (s.houses[i]) out.push(`<button class="btn" data-m="sell" data-i="${i}" ${g.canSell(i) ? '' : 'disabled'} title="Vender">−${short ? '' : ' Vender'}</button>`);
    }
    if (s.mort[i]) out.push(`<button class="btn" data-m="unmortgage" data-i="${i}" ${g.canUnmortgage(i) ? '' : 'disabled'}>Levantar${short ? '' : ' ' + g.unmortgageCost(i)}</button>`);
    else out.push(`<button class="btn" data-m="mortgage" data-i="${i}" ${g.canMortgage(i) ? '' : 'disabled'}>Hipotecar</button>`);
    return out.join('');
  }

  /* ---------- mis dinosaurios ---------- */
  function openMine(p) {
    if (!local(p) || busy) return;
    const m = openModal('<div id="minebox"></div>');
    const rowHtml = (i) => {
      const q = g.sq(i), s = g.s;
      const col = q.t === 'prop' ? g.B.groups[q.g].c : '#8a7a55';
      const st = [s.houses[i] === 5 ? 'Santuario' : s.houses[i] ? s.houses[i] + ' recinto' + (s.houses[i] > 1 ? 's' : '') : '',
        s.mort[i] ? 'Hipotecado' : '', q.t === 'prop' && g.ownsGroup(p, q.g) ? 'Zona completa' : '',
        !s.mort[i] ? 'Alquiler ' + g.rent(i, 7) : ''].filter(Boolean).join(' · ');
      return `<div class="prow" style="--g:${col}"><i></i><span class="nm">${esc(q.n)}</span><span class="st">${st}</span>
        <span class="pb">${manageBtns(i, true)}</span></div>`;
    };
    m.draw = () => {
      if (!g) return m.close();
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
    m.draw();
    refreshers.add(m.draw);
    m.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.x === 'close') { m.close(); return; }
      if (b.dataset.x === 'settle') { m.close(); exec('settle'); return; }
      if (b.dataset.m) exec(b.dataset.m, [Number(b.dataset.i)]);
    });
  }

  /* ---------- tratos ---------- */
  function openTrade() {
    const s = g.s, me = s.turn;
    if (!local(me) || busy) return;
    const others = g.alive().filter((p) => p !== me);
    const st = { to: others[0], give: new Set(), get: new Set(), gm: 0, tm: 0, msg: '', cls: '', sending: false };
    const m = openModal('<div id="tradebox"></div>');
    const tradable = (i) => g.sq(i).t !== 'prop' || g.groupHouses(g.sq(i).g) === 0;
    const offer = () => ({ from: me, to: st.to, give: [...st.give], get: [...st.get], giveMoney: st.gm, getMoney: st.tm });
    const pick = (i, set, side) => {
      const q = g.sq(i), ok = tradable(i);
      const col = q.t === 'prop' ? g.B.groups[q.g].c : '#8a7a55';
      return `<label class="tpick ${ok ? '' : 'no'}" style="--g:${col}"><input type="checkbox" data-side="${side}" data-i="${i}" ${set.has(i) ? 'checked' : ''} ${ok ? '' : 'disabled'}><i></i><span>${esc(q.n)}${g.s.mort[i] ? ' (hip.)' : ''}</span></label>`;
    };
    const money = (side, v, max) => `<div class="money"><button class="btn" data-mm="${side}" data-d="-50">−50</button><button class="btn" data-mm="${side}" data-d="-10">−10</button>
      <b>${am(v)}</b><button class="btn" data-mm="${side}" data-d="10" ${v + 10 > max ? 'disabled' : ''}>+10</button><button class="btn" data-mm="${side}" data-d="50" ${v + 50 > max ? 'disabled' : ''}>+50</button></div>`;
    const draw = () => {
      const S = g.s;
      // lo que ya no es de quien lo daba deja de estar en la oferta
      st.give.forEach((i) => { if (S.owner[i] !== me) st.give.delete(i); });
      st.get.forEach((i) => { if (S.owner[i] !== st.to) st.get.delete(i); });
      const mine = g.owned(me), theirs = g.owned(st.to);
      const o = offer();
      m.el.querySelector('#tradebox').innerHTML = `<h2>Proponer un trato</h2>
        <div class="who">${others.map((p) => `<button class="btn ${p === st.to ? 'sel' : ''}" data-to="${p}">${tokdot(p)} ${esc(S.players[p].name)}</button>`).join('')}</div>
        <div class="tcols">
          <div class="tcol"><h3>Tú das</h3>${mine.map((i) => pick(i, st.give, 'give')).join('') || '<p class="muted">Nada que dar.</p>'}${money('gm', st.gm, S.players[me].money)}</div>
          <div class="tcol"><h3>Pides a ${esc(S.players[st.to].name)}</h3>${theirs.map((i) => pick(i, st.get, 'get')).join('') || '<p class="muted">No tiene dinosaurios.</p>'}${money('tm', st.tm, S.players[st.to].money)}</div>
        </div>
        <p class="muted">No se pueden cambiar dinosaurios de una zona con recintos.</p>
        <p class="tmsg ${st.cls}">${st.msg}</p>
        <div class="row"><button class="btn" data-x="close">Cerrar</button><button class="btn primary" data-x="send" ${!st.sending && g.canTrade(o) ? '' : 'disabled'}>${st.sending ? 'Esperando…' : 'Proponer'}</button></div>`;
    };
    m.draw = () => { if (!g) return m.close(); draw(); };
    draw();
    refreshers.add(m.draw);
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
        const key = b.dataset.mm, max = key === 'gm' ? g.s.players[me].money : g.s.players[st.to].money;
        st[key] = Math.max(0, Math.min(max, st[key] + Number(b.dataset.d)));
        st.msg = ''; draw(); return;
      }
      if (b.dataset.x === 'close') { m.close(); return; }
      if (b.dataset.x === 'send') {
        const o = offer();
        if (!g.canTrade(o)) return;
        st.sending = true; st.msg = person(o.to) ? `Esperando a ${pname(o.to)}…` : ''; st.cls = ''; draw();
        const r = await proposeTrade(o);
        st.sending = false;
        if (!document.body.contains(m.el)) return;
        if (r.ok) { m.close(); toast(clean(r.html) || 'Trato hecho.'); return; }
        st.msg = clean(r.html); st.cls = '';
        if (g) draw();
        requestAnimationFrame(() => { const el = m.el.querySelector('.tmsg'); if (el) el.classList.add('no'); });
      }
    });
  }

  /* Propone un trato desde este dispositivo y espera la respuesta */
  function proposeTrade(o) {
    if (!isGuest()) return resolveTrade(o);
    return new Promise((resolve) => {
      const rid = ++waitN;
      waits.set(rid, resolve);
      if (!net.room.toHost({ t: 'act', cmd: 'trade', args: [o], rid })) {
        waits.delete(rid);
        resolve({ ok: false, html: 'Sin conexión con la sala.' });
        return;
      }
      setTimeout(() => { if (waits.has(rid)) { waits.delete(rid); resolve({ ok: false, html: 'No ha llegado respuesta.' }); } }, 100000);
    });
  }
  /* Resuelve un trato en el anfitrión (o sin red): la máquina juzga y a las personas se les pregunta */
  async function resolveTrade(o) {
    if (!g.canTrade(o)) return { ok: false, html: 'Ahora no se puede hacer ese trato.' };
    const to = o.to, pl = g.s.players[to];
    let yes, html = '';
    if (pl.ai) {
      const r = AI.judge(g, to, o);
      yes = r.ok;
      if (!yes) html = AI.refusal(g, to, o, r);
    } else {
      yes = await askPerson(to, o);
      if (!yes) html = `${pname(to)} rechaza el trato.`;
    }
    if (yes && g && g.canTrade(o) && g.trade(o)) {
      changed();
      return { ok: true, html: `${pname(to)} acepta el trato.` };
    }
    return { ok: false, html: html || 'El trato ya no es posible.' };
  }
  function askPerson(p, o) {
    if (local(p)) return askHuman(p, o);
    const dev = g.s.players[p].dev;
    if (!isHost() || !net.room.online(dev)) return Promise.resolve(false);
    return new Promise((resolve) => {
      const id = ++askN;
      asks.set(id, { dev, resolve });
      net.room.send(dev, { t: 'ask', id, offer: o });
      setTimeout(() => { if (asks.has(id)) { asks.delete(id); resolve(false); } }, 90000);
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
      ok = await askPerson(o.to, o);
    }
    if (!g) return;
    if (ok && g.trade(o)) { toast(`🤝 Trato: ${pname(o.from)} y ${pname(o.to)}`); return; }
    s.refused[o.from + '-' + o.get[0]] = s.round;
    g.log(`${pname(o.to)} rechaza la propuesta de ${pname(o.from)} (${g.describe(o)}).`);
  }

  /* ---------- final ---------- */
  async function gameOver() {
    if (!g) return;
    const s = g.s;
    overShown = true;
    save();
    const rank = g.ranking();
    const why = g.M.rounds && g.alive().length > 1 ? `Se han jugado las ${g.M.rounds} rondas: gana quien más vale.` : 'Todos los demás se han arruinado.';
    const r = await dialog(`<h2>¡${esc(s.players[s.winner].name)} gana!</h2><p class="muted">${why}</p>
      <div class="rank">${rank.map((p) => `<div>${tokdot(p)}<span>${esc(s.players[p].name)}</span>${s.players[p].out ? 'arruinado' : am(g.worth(p))}</div>`).join('')}</div>
      <div class="row"><button class="btn" data-close="board">Ver el tablero</button><button class="btn primary" data-close="menu">Nueva partida</button></div>`);
    if (r === 'menu') {
      if (isHost()) net.room.broadcast({ t: 'end' });
      if (isGuest()) store(NET_KEY, null);
      store(SAVE_KEY, isGuest() ? load(SAVE_KEY) : null);
      showMenu();
    }
  }

  /* ---------- menú de la partida y reglas ---------- */
  async function gameMenu() {
    const where = net ? `<p class="muted">Sala <b>${esc(net.code)}</b> · ${isHost() ? 'la llevas tú: si cierras la app, la partida se para hasta que vuelvas' : 'puedes salir y volver a entrar cuando quieras'}.</p>` : '<p class="muted">La partida se guarda sola en este dispositivo.</p>';
    const r = await dialog(`<h2>Menú</h2>${where}
      <div class="row"><button class="btn" data-close="speed">Velocidad: ${prefs.speed < 1 ? 'rápida' : 'normal'}</button></div>
      ${net ? '<div class="row"><button class="btn" data-close="share">Invitar a la sala</button></div>' : ''}
      <div class="row"><button class="btn" data-close="rules">Cómo se juega</button></div>
      <div class="row"><button class="btn" data-close="exit">${isGuest() ? 'Salir de la sala' : 'Salir al inicio'}</button></div>
      ${isGuest() ? '' : '<div class="row"><button class="btn danger" data-close="quit">Abandonar la partida</button></div>'}
      <div class="row"><button class="btn primary" data-close="close">Volver al juego</button></div>`);
    if (r === 'speed') { prefs.speed = prefs.speed < 1 ? 1 : 0.45; store(PREFS_KEY, prefs); toast('Velocidad ' + (prefs.speed < 1 ? 'rápida' : 'normal') + '.'); }
    else if (r === 'share') shareRoom();
    else if (r === 'rules') showRules();
    else if (r === 'exit') { save(); showMenu(); }
    else if (r === 'quit') {
      const c = await dialog(`<h2>¿Abandonar?</h2><p>Se borrará la partida guardada${net ? ' y se cerrará la sala para todos' : ''}.</p>
        <div class="row"><button class="btn" data-close="no">No</button><button class="btn danger" data-close="yes">Abandonar</button></div>`);
      if (c === 'yes') {
        if (isHost()) net.room.broadcast({ t: 'end' });
        store(SAVE_KEY, null);
        showMenu();
      }
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
      <h3>Jugar en red</h3>
      <p>Una persona crea la sala y los demás se unen con el código de 4 letras, cada uno desde su móvil. Quien crea la sala
      lleva la partida (y las máquinas): si cierra la app, la partida se para hasta que vuelva. Si alguien se desconecta,
      puede volver a entrar con el mismo código, o quien lleva la sala puede dejar que la máquina juegue por él.</p>
      <h3>Consejo</h3><p>Pulsa cualquier casilla del tablero para ver su ficha, con el dato curioso del dinosaurio.</p>
      <div class="row"><button class="btn primary" data-close="ok">Entendido</button></div></div>`);
  }

  function showPlayer(p) {
    const s = g.s, pl = s.players[p];
    if (local(p) && p === g.manager() && !busy) return openMine(p);
    const list = g.owned(p);
    const kind = pl.ai ? (pl.away ? 'Juega la máquina por esta persona' : 'Máquina') : net && pl.dev !== myDev ? (connected(p) ? 'Persona en otro dispositivo' : 'Persona desconectada') : 'Persona';
    dialog(`<h2>${tokdot(p)} ${esc(pl.name)}</h2>
      <p class="muted">${kind} · ${am(pl.money)} en efectivo · vale ${am(g.worth(p))}${pl.passes.length ? ' · tiene pase del veterinario' : ''}</p>
      <div class="plist">${list.map((i) => {
        const q = g.sq(i), col = q.t === 'prop' ? g.B.groups[q.g].c : '#8a7a55';
        const st = [s.houses[i] === 5 ? 'Santuario' : s.houses[i] ? s.houses[i] + ' recinto' + (s.houses[i] > 1 ? 's' : '') : '', s.mort[i] ? 'Hipotecado' : ''].filter(Boolean).join(' · ');
        return `<div class="prow" style="--g:${col}"><i></i><span class="nm">${esc(q.n)}</span><span class="st">${st || 'Alquiler ' + g.rent(i, 7)}</span><span class="pb"></span></div>`;
      }).join('') || '<p class="muted">Sin dinosaurios.</p>'}</div>
      <div class="row"><button class="btn primary" data-close="ok">Cerrar</button></div>`);
  }

  /* ====================================================================
     Partidas en red
     ==================================================================== */
  function netError(e) {
    switch (e) {
      case 'peer-unavailable': return 'No hay ninguna sala abierta con ese código.';
      case 'timeout': return 'La sala no responde. Comprueba el código y que quien la creó tenga el juego abierto.';
      case 'unavailable-id': return 'Ese código de sala sigue ocupado. Prueba otra vez en un momento.';
      case 'browser-incompatible': return 'Este navegador no permite jugar en red.';
      case 'nomodule': return 'No se ha podido cargar el módulo de red. Comprueba la conexión y recarga.';
      default: return 'No se puede conectar con el servidor de salas. ¿Hay internet?';
    }
  }

  async function askName(kind, code) {
    if (!Net.available()) { toast(netError('nomodule')); return; }
    const name = prefs.netName || (prefs.slots && prefs.slots[0] && prefs.slots[0].type === 'human' ? prefs.slots[0].name : '') || '';
    const m = openModal(`<h2>${kind === 'host' ? 'Crear una sala' : 'Unirse a una sala'}</h2>
      ${kind === 'host' ? `<p class="muted">Se jugará en ${esc(MODES[document.querySelector('input[name=mode]:checked').value].n.toLowerCase())}, con máquinas en nivel ${esc(LEVELS[document.querySelector('input[name=level]:checked').value].n.toLowerCase())}. Lo puedes cambiar en el inicio antes de crearla.</p>` : ''}
      <label class="field">Tu nombre<input id="f-name" type="text" maxlength="14" value="${esc(name)}" autocomplete="nickname"></label>
      ${kind === 'join' ? `<label class="field">Código de la sala<input id="f-code" class="codein" type="text" maxlength="4" value="${esc(code || '')}" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD"></label>` : ''}
      <p class="tmsg" id="f-msg"></p>
      <div class="row"><button class="btn" data-x="close">Cancelar</button><button class="btn primary" data-x="go">${kind === 'host' ? 'Crear' : 'Entrar'}</button></div>`);
    const nameIn = m.el.querySelector('#f-name'), codeIn = m.el.querySelector('#f-code');
    (kind === 'join' && !code ? codeIn : nameIn).focus();
    if (codeIn) codeIn.addEventListener('input', () => { codeIn.value = Net.cleanCode(codeIn.value); });
    const go = async () => {
      const nm = nameIn.value.trim().slice(0, 14);
      const msg = m.el.querySelector('#f-msg');
      if (!nm) { msg.textContent = 'Escribe tu nombre.'; msg.className = 'tmsg no'; return; }
      const c = codeIn ? Net.cleanCode(codeIn.value) : '';
      if (codeIn && c.length !== 4) { msg.textContent = 'El código tiene 4 letras.'; msg.className = 'tmsg no'; return; }
      prefs.netName = nm;
      prefs.mode = document.querySelector('input[name=mode]:checked').value;
      prefs.level = document.querySelector('input[name=level]:checked').value;
      store(PREFS_KEY, prefs);
      m.el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      msg.textContent = 'Conectando…'; msg.className = 'tmsg';
      const ok = kind === 'host' ? await createRoom(nm) : await joinRoom(c, nm, true);
      if (ok) { m.close(); return; }
      msg.textContent = ok === false ? '' : ok;
      m.el.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    };
    m.el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.x === 'close') m.close();
      if (b.dataset.x === 'go') go();
    });
    m.el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
  }

  function netHandlers() {
    return {
      onJoin: (dev, hello) => hostJoin(dev, hello),
      onLeave: (dev) => hostLeave(dev),
      onMessage: (from, msg) => (isHost() ? hostMessage(from, msg) : guestMessage(msg)),
      onStatus: (st) => guestStatus(st)
    };
  }

  function leaveNet() {
    if (net) net.room.close();
    net = null;
    lobby = null;
    online = {};
    inbox = [];
    lastSent = '';
    asks.forEach((a) => a.resolve(false)); asks.clear();
    waits.forEach((w) => w({ ok: false, html: 'Has salido de la sala.' })); waits.clear();
    $('#netbar').hidden = true;
  }

  /* ---------- anfitrión ---------- */
  async function hostRoom(code) {
    leaveNet();
    const room = new Net.Room(ROOM_PREFIX, netHandlers());
    net = { role: 'host', room, code: '' };
    net.code = await room.open(code);
    online = { [myDev]: true };
    return net.code;
  }

  async function createRoom(name) {
    try {
      await hostRoom();
    } catch (e) {
      leaveNet();
      return netError(e);
    }
    lobby = { players: [{ name, dev: myDev, ai: false }] };
    showLobby();
    return true;
  }

  function lobbyMsg() {
    return { t: 'lobby', code: net.code, mode: prefs.mode, level: prefs.level, players: lobby.players.map((p) => ({ name: p.name, ai: p.ai, dev: p.dev, on: p.ai || p.dev === myDev || net.room.online(p.dev) })) };
  }
  function lobbyChanged() {
    net.room.broadcast(lobbyMsg());
    showLobby();
  }

  function hostJoin(dev, hello) {
    const name = String(hello.name || '').trim().slice(0, 14) || 'Invitado';
    if (g) {
      const seat = g.s.players.findIndex((pl) => pl.dev === dev);
      if (seat < 0) { net.room.kick(dev, { t: 'kick', why: 'La partida de esta sala ya ha empezado.' }); return; }
      const pl = g.s.players[seat];
      if (pl.away && !pl.out) {
        pl.ai = false; pl.away = false;
        g.log(`${pname(seat)} vuelve a la partida.`);
      }
      online[dev] = true;
      toast(`${pname(seat)} se ha conectado.`, '', 2000);
      lastSent = '';
      changed();
      return;
    }
    if (!lobby) return;
    const known = lobby.players.find((p) => p.dev === dev);
    if (known) known.name = name;
    else if (lobby.players.length >= 4) { net.room.kick(dev, { t: 'kick', why: 'La sala está llena.' }); return; }
    else lobby.players.push({ name, dev, ai: false });
    online[dev] = true;
    lobbyChanged();
  }

  function hostLeave(dev) {
    online[dev] = false;
    asks.forEach((a, id) => { if (a.dev === dev) { asks.delete(id); a.resolve(false); } });
    if (!g && lobby) {
      lobby.players = lobby.players.filter((p) => p.dev !== dev);
      lobbyChanged();
      return;
    }
    if (g) {
      const seat = g.s.players.findIndex((pl) => pl.dev === dev);
      if (seat >= 0 && !g.s.players[seat].out) toast(`${pname(seat)} se ha desconectado.`, '', 2500);
      lastSent = '';
      render();
    }
  }

  function hostMessage(dev, m) {
    if (m.t === 'answer') {
      const a = asks.get(m.id);
      if (a && a.dev === dev) { asks.delete(m.id); a.resolve(!!m.yes); }
      return;
    }
    if (m.t !== 'act' || !g) return;
    const seat = g.s.players.findIndex((pl) => pl.dev === dev && !pl.ai && !pl.out);
    if (seat < 0) return;
    if (m.cmd === 'trade') { hostTrade(dev, seat, m); return; }
    if (apply(seat, String(m.cmd), m.args)) changed();
    else net.room.send(dev, { t: 'msg', html: 'Ahora no se puede.' });
  }

  async function hostTrade(dev, seat, m) {
    const raw = Array.isArray(m.args) ? m.args[0] : null;
    const ints = (a) => (Array.isArray(a) ? a : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < N()).slice(0, 40);
    const o = raw && typeof raw === 'object' ? {
      from: seat, to: Number(raw.to), give: [...new Set(ints(raw.give))], get: [...new Set(ints(raw.get))],
      giveMoney: Math.max(0, Math.floor(Number(raw.giveMoney) || 0)), getMoney: Math.max(0, Math.floor(Number(raw.getMoney) || 0))
    } : null;
    const r = o && Number.isInteger(o.to) && g.s.players[o.to] ? await resolveTrade(o) : { ok: false, html: 'Trato no válido.' };
    if (net) net.room.send(dev, { t: 'tradeRes', rid: m.rid, ok: r.ok, html: r.html });
  }

  /* Manda el estado a los invitados cuando cambia */
  function sync() {
    if (!isHost() || !g) return;
    const on = {};
    g.s.players.forEach((pl) => { if (pl.dev) on[pl.dev] = pl.dev === myDev || net.room.online(pl.dev); });
    online = on;
    const key = JSON.stringify(g.s) + JSON.stringify(on);
    if (key === lastSent) return;
    lastSent = key;
    net.room.broadcast({ t: 'state', s: g.s, online: on });
  }

  async function takeover() {
    const a = g.actor();
    if (!isHost() || !person(a) || connected(a)) return;
    const pl = g.s.players[a];
    const r = await dialog(`<h2>¿Juega la máquina?</h2><p>${esc(pl.name)} se ha desconectado. La máquina jugará por esta persona hasta que vuelva a entrar en la sala.</p>
      <div class="row"><button class="btn" data-close="no">Esperar</button><button class="btn primary" data-close="yes">Que juegue la máquina</button></div>`);
    if (r !== 'yes' || !person(a) || connected(a)) return;
    pl.ai = true; pl.away = true;
    g.log(`La máquina juega por ${pname(a)} mientras está fuera.`);
    changed();
  }

  function startNetGame() {
    if (!lobby || lobby.players.length < 2) return;
    const players = lobby.players.map((p) => ({ name: p.name, ai: p.ai, dev: p.ai ? null : p.dev }));
    const game = Game.create({ mode: prefs.mode, level: prefs.level, players });
    game.s.net = { room: net.code };
    lobby = null;
    lastSent = '';
    enterGame(game);
  }

  /* ---------- invitado ---------- */
  async function joinRoom(code, name, fromDialog) {
    leaveNet();
    const room = new Net.Room(ROOM_PREFIX, netHandlers());
    net = { role: 'guest', room, code };
    try {
      await room.join(code, { dev: myDev, name });
    } catch (e) {
      leaveNet();
      if (!fromDialog) toast(netError(e));
      return netError(e);
    }
    store(NET_KEY, { code, name });
    lastFxN = 0;
    overShown = false;
    if (!fromDialog) toast(`Conectado a la sala ${esc(code)}.`);
    showLobby({ t: 'lobby', code, players: [], waiting: true });
    return true;
  }

  function guestStatus(st) {
    if (!isGuest()) return;
    const bar = $('#netbar');
    if (st === 'reconnecting') { bar.hidden = false; bar.textContent = 'Se ha perdido la conexión con la sala. Reintentando…'; }
    else if (st === 'online') bar.hidden = true;
  }

  async function guestMessage(m) {
    switch (m.t) {
      case 'lobby': if (!g) showLobby(m); return;
      case 'state': inbox.push(m); playInbox(); return;
      case 'ask': {
        if (!g) return;
        const me = g.s.players.findIndex((pl) => pl.dev === myDev);
        const o = cleanOffer(m.offer);
        const yes = o && me === o.to ? await askHuman(me, o) : false;
        if (net) net.room.toHost({ t: 'answer', id: m.id, yes });
        return;
      }
      case 'tradeRes': {
        const w = waits.get(m.rid);
        if (w) { waits.delete(m.rid); w({ ok: !!m.ok, html: clean(m.html || '') }); }
        return;
      }
      case 'msg': toast(clean(m.html || '')); return;
      case 'kick': store(NET_KEY, null); showMenu(); toast(clean(m.why || 'No se puede entrar en la sala.'), '', 4000); return;
      case 'end':
        store(NET_KEY, null);
        if (g && g.s.phase === 'over') { leaveNet(); return; }
        showMenu();
        toast('Se ha cerrado la sala.', '', 4000);
    }
  }
  function cleanOffer(o) {
    if (!o || typeof o !== 'object' || !g) return null;
    const ints = (a) => (Array.isArray(a) ? a : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < N());
    const p = (x) => (Number.isInteger(Number(x)) && g.s.players[Number(x)] ? Number(x) : -1);
    const r = { from: p(o.from), to: p(o.to), give: ints(o.give), get: ints(o.get), giveMoney: Math.max(0, Number(o.giveMoney) || 0), getMoney: Math.max(0, Number(o.getMoney) || 0) };
    return r.from >= 0 && r.to >= 0 ? r : null;
  }

  /* Reproduce, en orden, los estados que manda el anfitrión */
  async function playInbox() {
    if (busy) return;
    busy = true;
    try {
      while (inbox.length && isGuest()) {
        const m = inbox[0];
        const s = m.s;
        if (!s || !Array.isArray(s.players) || !MODES[s.mode] || !LEVELS[s.level]) { inbox.shift(); continue; }
        const first = !g;
        g = new Game(s);
        online = m.online && typeof m.online === 'object' ? m.online : {};
        const fx = first ? [] : (s.fx || []).filter((e) => e && e.n > lastFxN);
        if (first) {
          lastFxN = s.fxN || 0;
          enterGuestView();
        }
        g.s.fx = [];
        render();
        await playFx(fx);
        inbox.shift();
      }
    } finally {
      busy = false;
    }
    if (!g || !isGuest()) return;
    render();
    const a = g.actor();
    if (local(a)) announce(a); else lastLocal = -1;
    if (g.s.phase === 'over' && !overShown) gameOver();
  }
  function enterGuestView() {
    shown = g.s.players.map((p) => p.pos);
    lastMoney = g.s.players.map((p) => p.money);
    lastLocal = -1;
    closeModals();
    $('#menu').hidden = true;
    $('#lobby').hidden = true;
    $('#game').hidden = false;
    buildTokens();
    keepAwake();
  }

  /* ---------- sala de espera ---------- */
  function showLobby(m) {
    const host = isHost();
    const info = host ? lobbyMsg() : m;
    if (!info) return;
    const players = info.players || [];
    const mode = MODES[info.mode], level = LEVELS[info.level];
    const hostName = players[0] ? esc(players[0].name) : 'quien ha creado la sala';
    $('#lobbycard').innerHTML = `
      <div class="brand"><svg class="brand-mark" aria-hidden="true"><use href="#logo"/></svg>
        <div><h1>Sala</h1><p>${mode ? mode.n + ' · máquinas en nivel ' + level.n.toLowerCase() : 'Conectando…'}</p></div></div>
      <div class="roomcode" aria-label="Código de la sala">${esc(info.code || net.code)}</div>
      <p class="muted tc">${host ? 'Los demás abren el juego, pulsan «Unirse» y escriben este código. O mándales el enlace:' : `Esperando a que ${hostName} empiece la partida…`}</p>
      ${host ? '<button class="btn wide" data-l="share">📤 Compartir el enlace de la sala</button>' : ''}
      <h2>Jugadores (${players.length}/4)</h2>
      <div class="slots">${players.map((p, i) => `
        <div class="lslot">
          <i class="tokdot" style="--c:${COLORS[i]}">${esc(initial(p.name))}</i>
          <span class="lname">${esc(p.name)}</span>
          <span class="ltag">${p.ai ? 'Máquina' : p.dev === myDev ? 'Tú' : i === 0 ? 'Crea la sala' : p.on === false ? 'Desconectado' : 'Conectado'}</span>
          ${host && i > 0 ? `<button class="iconbtn" data-l="rm" data-i="${i}" aria-label="Quitar">✕</button>` : ''}
        </div>`).join('')}</div>
      ${host ? `<button class="btn wide" data-l="ai" ${players.length >= 4 ? 'disabled' : ''}>＋ Añadir una máquina</button>
        <button class="btn primary big" data-l="start" ${players.length < 2 ? 'disabled' : ''}>Empezar la partida</button>
        <p class="muted tc">${players.length < 2 ? 'Hace falta al menos otro jugador (persona o máquina).' : 'Cuando empiece, ya no podrá entrar nadie más.'}</p>` : ''}
      <button class="btn ghost wide" data-l="leave">${host ? 'Cerrar la sala' : 'Salir de la sala'}</button>`;
    $('#menu').hidden = true;
    $('#game').hidden = true;
    $('#lobby').hidden = false;
  }

  function lobbyClick(b) {
    switch (b.dataset.l) {
      case 'share': shareRoom(); break;
      case 'ai': {
        if (!lobby || lobby.players.length >= 4) return;
        const used = lobby.players.map((p) => p.name);
        const name = AI_NAMES.find((n) => !used.includes(n)) || 'Máquina';
        lobby.players.push({ name, dev: null, ai: true });
        lobbyChanged();
        break;
      }
      case 'rm': {
        const i = Number(b.dataset.i);
        const p = lobby && lobby.players[i];
        if (!p || i === 0) return;
        lobby.players.splice(i, 1);
        if (p.dev) net.room.kick(p.dev, { t: 'kick', why: 'Te han quitado de la sala.' });
        lobbyChanged();
        break;
      }
      case 'start': startNetGame(); break;
      case 'leave':
        if (isHost()) net.room.broadcast({ t: 'end' });
        store(NET_KEY, null);
        setTimeout(showMenu, 150);
        break;
    }
  }

  async function shareRoom() {
    if (!net) return;
    const url = location.origin + location.pathname + '?sala=' + net.code;
    const text = `¡Juega conmigo a Isla Jurásica! Sala ${net.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Isla Jurásica', text, url }); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text + ': ' + url);
      toast('Enlace copiado. Pégalo en un mensaje.');
    } catch (e) {
      toast(`Código de la sala: <b>${esc(net.code)}</b>`);
    }
  }

  /* Mantener la pantalla encendida durante una partida en red */
  async function keepAwake() {
    try { if (navigator.wakeLock && !wake && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
    if (wake) wake.addEventListener('release', () => { wake = null; });
  }
  function releaseWake() {
    if (wake) try { wake.release(); } catch (e) { /* nada */ }
    wake = null;
  }
  document.addEventListener('visibilitychange', () => { if (net && g && document.visibilityState === 'visible') keepAwake(); });

  /* ---------- entrada ---------- */
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('.backdrop')) return;
    const l = ev.target.closest('[data-l]');
    if (l && !l.disabled && !$('#lobby').hidden) { lobbyClick(l); return; }
    if (!g || $('#game').hidden) return;
    const a = ev.target.closest('[data-act]');
    if (a && !a.disabled) { act(a.dataset.act); return; }
    const sq = ev.target.closest('[data-sq]');
    if (sq) { openSquare(Number(sq.dataset.sq)); return; }
    const pc = ev.target.closest('[data-p]');
    if (pc) { showPlayer(Number(pc.dataset.p)); return; }
  });
  $('#bmenu').addEventListener('click', gameMenu);
  $('#bhelp').addEventListener('click', showRules);

  initMenu();
})();
