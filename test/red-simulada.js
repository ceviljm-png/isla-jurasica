/* Sustituto de PeerJS en memoria para probar js/net.js en Node, sin internet.
   Imita lo que usa net.js: Peer con nombre o sin él, connect, send, close, destroy y los eventos
   open, connection, data, close, error. Todo se entrega con setImmediate, como si fuera asíncrono,
   para que los tests puedan simular el reloj (setTimeout, setInterval, Date) sin bloquear la red. */

let registro = new Map();   // nombre → peer abierto
let opciones = {};
let mudos = new Set();      // salas que aceptan la conexión pero nunca la abren
let creados = [];           // nombres pedidos, en orden
let anonimos = 0;

const pronto = (fn) => setImmediate(fn);

class Emisor {
  constructor() { this.h = {}; }
  on(ev, fn) { (this.h[ev] || (this.h[ev] = [])).push(fn); return this; }
  emit(ev, ...args) { (this.h[ev] || []).slice().forEach((fn) => fn(...args)); }
}

class ConexionSimulada extends Emisor {
  constructor(peer, otroId) {
    super();
    this.peer = peer.id;
    this.peerId = otroId;
    this.open = false;
    this.otra = null;
  }
  send(m) {
    if (!this.open) throw new Error('Conexión cerrada');
    const copia = JSON.parse(JSON.stringify(m)), otra = this.otra;
    pronto(() => { if (otra && otra.open) otra.emit('data', copia); });
  }
  close() {
    for (const c of [this, this.otra]) {
      if (c && c.open) { c.open = false; pronto(() => c.emit('close')); }
    }
  }
}

class PeerSimulado extends Emisor {
  constructor(id) {
    super();
    this.id = typeof id === 'string' ? id : 'anonimo-' + (++anonimos);
    this.destroyed = false;
    this.disconnected = false;
    this.conns = [];
    creados.push(this.id);
    pronto(() => {
      if (this.destroyed) return;
      if (opciones.todoOcupado || registro.has(this.id)) { this.emit('error', { type: 'unavailable-id' }); return; }
      registro.set(this.id, this);
      this.emit('open', this.id);
    });
  }
  connect(id) {
    const local = new ConexionSimulada(this, id);
    this.conns.push(local);
    pronto(() => {
      const destino = registro.get(id);
      if (!destino || destino.destroyed) { this.emit('error', { type: 'peer-unavailable' }); return; }
      if (mudos.has(id)) return;
      const remota = new ConexionSimulada(destino, this.id);
      local.otra = remota; remota.otra = local;
      local.open = remota.open = true;
      destino.conns.push(remota);
      destino.emit('connection', remota);
      pronto(() => { remota.emit('open'); local.emit('open'); });
    });
    return local;
  }
  reconnect() { this.disconnected = false; }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (registro.get(this.id) === this) registro.delete(this.id);
    this.conns.forEach((c) => c.close());
  }
}

/* Instala la red vacía en globalThis.Peer y devuelve cómo manejarla desde el test */
function instalar(ops = {}) {
  registro = new Map();
  opciones = ops;
  mudos = new Set();
  creados = [];
  globalThis.Peer = PeerSimulado;
  return {
    creados,
    registrado: (id) => registro.has(id),
    /* Ocupa un nombre (como si el servicio aún no lo hubiera liberado) */
    ocupar: (id) => { const p = new PeerSimulado(id); return p; },
    liberar: (id) => { const p = registro.get(id); if (p) p.destroy(); },
    mudo: (id) => mudos.add(id),
    todoOcupado: (si) => { opciones.todoOcupado = si; }
  };
}

/* Deja pasar todo lo que está en camino por la red */
async function esperar(veces = 30) {
  for (let i = 0; i < veces; i++) await new Promise((r) => setImmediate(r));
}

module.exports = { instalar, esperar, PeerSimulado };
