/* Salas en red entre dispositivos (WebRTC con PeerJS).
   El anfitrión lleva la partida; los invitados le mandan sus jugadas y reciben el estado.
   Sin DOM. Uso: const room = new Net.Room('prefijo-', { onJoin, onLeave, onMessage, onStatus }) */
(function (root) {
  'use strict';

  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // sin I ni O, para que no se confundan
  const PING = 4000, DEAD = 15000, RETRY = 3000, CONNECT_TIMEOUT = 15000;
  /* Servidores STUN públicos para atravesar el router. Los TURN que traía PeerJS ya no existen:
     en redes muy cerradas (algunas de datos móviles) la conexión directa puede fallar. */
  const ICE = { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ] };

  function randomCode(n) {
    const a = new Uint32Array(n);
    (root.crypto || globalThis.crypto).getRandomValues(a);
    return Array.from(a, (x) => ALPHA[x % ALPHA.length]).join('');
  }
  let memoryId = '';
  /* Identificador estable del dispositivo: sirve para recuperar el asiento al reconectar */
  function deviceId(key) {
    try {
      let id = localStorage.getItem(key);
      if (!id || !/^[A-Z]{12}$/.test(id)) { id = randomCode(12); localStorage.setItem(key, id); }
      return id;
    } catch (e) {
      return memoryId || (memoryId = randomCode(12));
    }
  }
  const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const available = () => typeof root.Peer === 'function';

  class Room {
    constructor(prefix, handlers) {
      this.prefix = prefix;
      this.h = handlers;
      this.role = null;
      this.code = '';
      this.peer = null;
      this.conns = new Map();   // anfitrión: dispositivo → conexión
      this.seen = new Map();    // anfitrión: dispositivo → último mensaje
      this.conn = null;         // invitado: conexión con el anfitrión
      this.lastHost = 0;
      this.closed = false;
      this.timer = null;
      this.retry = null;
    }
    emit(name, ...args) { if (!this.closed && this.h[name]) this.h[name](...args); }

    /* ---------- anfitrión ---------- */
    /* Sin código crea una sala nueva; con código la reabre (reintenta mientras el servidor libere el nombre) */
    open(code) {
      this.role = 'host';
      return new Promise((resolve, reject) => {
        let tries = 0;
        const attempt = () => {
          if (this.closed) return reject('closed');
          const c = code || randomCode(4);
          const peer = new root.Peer(this.prefix + c, { debug: 0, config: ICE });
          let opened = false;
          peer.on('open', () => {
            opened = true;
            this.peer = peer;
            this.code = c;
            this.startPing();
            resolve(c);
          });
          peer.on('connection', (conn) => this.accept(conn));
          peer.on('disconnected', () => {
            // se ha caído la conexión con el servidor de salas: las partidas en curso siguen; se reintenta para admitir a más
            if (this.closed || peer.destroyed) return;
            setTimeout(() => { if (!this.closed && !peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (e) { /* reintenta luego */ } }, RETRY);
          });
          peer.on('error', (err) => {
            const type = (err && err.type) || 'error';
            if (opened) { this.emit('onStatus', type); return; }
            peer.destroy();
            if (type === 'unavailable-id' && tries++ < (code ? 40 : 6)) { setTimeout(attempt, code ? RETRY : 0); return; }
            reject(type);
          });
        };
        attempt();
      });
    }
    accept(conn) {
      conn.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        if (!conn.dev) {
          if (m.t !== 'hello' || typeof m.dev !== 'string' || !/^[A-Z]{12}$/.test(m.dev)) return;
          conn.dev = m.dev;
          const old = this.conns.get(m.dev);
          this.conns.set(m.dev, conn);
          if (old && old !== conn) old.close();
          this.seen.set(m.dev, Date.now());
          this.emit('onJoin', m.dev, m);
          return;
        }
        this.seen.set(conn.dev, Date.now());
        if (m.t === 'pong') return;
        this.emit('onMessage', conn.dev, m);
      });
      conn.on('close', () => this.drop(conn));
      conn.on('error', () => this.drop(conn));
    }
    drop(conn) {
      if (!conn.dev || this.conns.get(conn.dev) !== conn) return;
      this.conns.delete(conn.dev);
      this.emit('onLeave', conn.dev);
    }
    online(dev) { const c = this.conns.get(dev); return !!(c && c.open); }
    send(dev, m) {
      const c = this.conns.get(dev);
      if (c && c.open) try { c.send(m); } catch (e) { /* se recupera con la siguiente sincronización */ }
    }
    broadcast(m) { for (const dev of this.conns.keys()) this.send(dev, m); }
    kick(dev, m) {
      this.send(dev, m);
      const c = this.conns.get(dev);
      this.conns.delete(dev);
      setTimeout(() => c && c.close(), 400);
    }

    /* ---------- invitado ---------- */
    join(code, hello) {
      this.role = 'guest';
      this.code = cleanCode(code);
      this.hello = Object.assign({ t: 'hello' }, hello);
      return this.connect();
    }
    connect() {
      return new Promise((resolve, reject) => {
        let done = false;
        const peer = new root.Peer({ debug: 0, config: ICE });
        this.peer = peer;
        const fail = (type) => {
          if (done) return;
          done = true;
          peer.destroy();
          reject(type);
        };
        const timer = setTimeout(() => fail('timeout'), CONNECT_TIMEOUT);
        peer.on('open', () => {
          const conn = peer.connect(this.prefix + this.code, { reliable: true, serialization: 'json' });
          conn.on('open', () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            this.conn = conn;
            this.lastHost = Date.now();
            conn.send(this.hello);
            this.startPing();
            this.emit('onStatus', 'online');
            resolve(this.code);
          });
          conn.on('data', (m) => {
            this.lastHost = Date.now();
            if (!m || typeof m !== 'object') return;
            if (m.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) { /* nada */ } return; }
            this.emit('onMessage', 'host', m);
          });
          conn.on('close', () => { if (this.conn === conn) this.lost(); });
        });
        peer.on('error', (err) => {
          const type = (err && err.type) || 'error';
          if (!done) { clearTimeout(timer); fail(type); } else if (this.conn && peer === this.peer) this.lost();
        });
      });
    }
    /* Se ha perdido el anfitrión: reintentar hasta que vuelva o el invitado se vaya */
    lost() {
      if (this.closed || this.retry) return;
      this.conn = null;
      if (this.peer) this.peer.destroy();
      this.emit('onStatus', 'reconnecting');
      const again = () => {
        this.retry = null;
        if (this.closed) return;
        this.connect().catch(() => { if (!this.closed) this.retry = setTimeout(again, RETRY); });
      };
      this.retry = setTimeout(again, RETRY);
    }
    toHost(m) {
      if (this.conn && this.conn.open) try { this.conn.send(m); return true; } catch (e) { /* se pierde */ }
      return false;
    }

    /* ---------- comunes ---------- */
    startPing() {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        const now = Date.now();
        if (this.role === 'host') {
          this.broadcast({ t: 'ping' });
          for (const [dev, c] of this.conns) if (now - (this.seen.get(dev) || 0) > DEAD) { c.close(); this.drop(c); }
        } else if (this.conn && now - this.lastHost > DEAD) this.lost();
      }, PING);
    }
    close() {
      this.closed = true;
      clearInterval(this.timer);
      clearTimeout(this.retry);
      for (const c of this.conns.values()) try { c.close(); } catch (e) { /* nada */ }
      this.conns.clear();
      if (this.conn) try { this.conn.close(); } catch (e) { /* nada */ }
      if (this.peer) this.peer.destroy();
    }
  }

  root.Net = { Room, deviceId, cleanCode, available, randomCode };
})(typeof window !== 'undefined' ? window : globalThis);
