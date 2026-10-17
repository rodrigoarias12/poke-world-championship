// Conexión entre dos celulares: WebRTC directo (P2P) con PeerJS.
// PeerJS Cloud solo se usa para que los dos teléfonos se encuentren;
// después los datos van directo de un celular al otro.

const PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm';
const PREFIX = 'pokechamp-v1-';
const STUN = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];

let PeerClass = null;

async function getPeer() {
  if (!PeerClass) PeerClass = (await import(PEERJS_URL)).Peer;
  return PeerClass;
}

// Si algún día existe /api/turn (servidor puente de Cloudflare), se suma; si no, solo STUN.
// Se pregunta una sola vez por visita.
let icePromise = null;
function iceServers() {
  if (!icePromise) icePromise = fetchIce();
  return icePromise;
}

async function fetchIce() {
  try {
    const res = await fetch('/api/turn', { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      if (Array.isArray(data.iceServers)) return [...STUN, ...data.iceServers];
    }
  } catch { /* sin servidor puente */ }
  return STUN;
}

export function randomCode() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

function openPeer(Peer, id, ice) {
  return new Promise((resolve, reject) => {
    const opts = { config: { iceServers: ice } };
    const peer = id ? new Peer(id, opts) : new Peer(opts);
    let opened = false;
    peer.on('open', () => {
      opened = true;
      resolve(peer);
    });
    peer.on('error', (e) => {
      if (opened) return;
      peer.destroy();
      reject(e);
    });
  });
}

// Enlace con mensajes JSON. `sim` agrega demora artificial para probar mala red.
export class Link {
  constructor(conn, peer, sim = {}) {
    this.conn = conn;
    this.peer = peer;
    this.sim = sim;
    this.handlers = new Set();
    this.closed = false;
    this.onClose = null;
    this.lastRecv = performance.now();
    this.nextDeliver = 0;
    // Mensajes que llegan cuando todavía nadie escucha (se entregan después)
    this.queue = [];
    conn.on('data', (d) => this.deliver(d));
    conn.on('close', () => this.close('cerrado'));
    conn.on('error', () => this.close('error'));
    conn.peerConnection?.addEventListener('connectionstatechange', () => {
      if (conn.peerConnection.connectionState === 'failed') this.close('falló');
    });
  }

  deliver(data) {
    this.lastRecv = performance.now();
    const { lag = 0, jitter = 0 } = this.sim;
    if (!lag && !jitter) return this.dispatch(data);
    // Demora simulada sin desordenar los mensajes (el canal es ordenado)
    const now = performance.now();
    const at = Math.max(this.nextDeliver, now + lag / 2 + Math.random() * jitter);
    this.nextDeliver = at;
    setTimeout(() => {
      if (!this.closed) this.dispatch(data);
    }, at - now);
  }

  dispatch(data) {
    if (!this.handlers.size) {
      this.queue.push(data);
      return;
    }
    for (const h of [...this.handlers]) h(data);
  }

  send(msg) {
    if (this.closed || !this.conn.open) return;
    try {
      this.conn.send(msg);
    } catch {
      this.close('error');
    }
  }

  on(fn) {
    this.handlers.add(fn);
    if (this.queue.length) {
      // Se entregan un instante después, cuando ya está todo armado
      setTimeout(() => {
        const q = this.queue.splice(0);
        for (const m of q) this.dispatch(m);
      }, 0);
    }
    return () => this.handlers.delete(fn);
  }

  // El primer mensaje que llegue (o null si no llega a tiempo)
  first(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        off();
        resolve(null);
      }, ms);
      const off = this.on((m) => {
        off();
        clearTimeout(timer);
        resolve(m);
      });
    });
  }

  close(reason = 'cerrado') {
    if (this.closed) return;
    this.closed = true;
    try {
      this.conn.close();
    } catch { /* ya cerrado */ }
    try {
      this.peer.destroy();
    } catch { /* ya destruido */ }
    this.onClose?.(reason);
  }

  // 'host' = misma red local, 'srflx'/'prflx' = directo por internet, 'relay' = servidor puente
  async connectionType() {
    const pc = this.conn.peerConnection;
    if (!pc) return 'desconocido';
    const stats = await pc.getStats();
    let pair = null;
    stats.forEach((s) => {
      if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId);
    });
    if (!pair) stats.forEach((s) => {
      if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s;
    });
    if (!pair) return 'desconocido';
    const local = stats.get(pair.localCandidateId);
    const remote = stats.get(pair.remoteCandidateId);
    return `${local?.candidateType || '?'}/${remote?.candidateType || '?'}`;
  }
}

// Crea una sala. Devuelve el código y una función para esperar al invitado.
export async function hostRoom({ code = null, sim } = {}) {
  const Peer = await getPeer();
  const ice = await iceServers();
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = code || randomCode();
    try {
      const peer = await openPeer(Peer, PREFIX + c, ice);
      const waitGuest = () => new Promise((resolve) => {
        peer.on('connection', (conn) => {
          conn.on('open', () => resolve(new Link(conn, peer, sim)));
        });
      });
      // Si se corta el contacto con PeerJS Cloud, se reintenta (la partida sigue)
      peer.on('disconnected', () => {
        if (!peer.destroyed) peer.reconnect();
      });
      return { code: c, peer, waitGuest };
    } catch (e) {
      if (e?.type === 'unavailable-id' && !code) continue;
      throw e;
    }
  }
  throw new Error('No se pudo crear la sala');
}

// Se une a una sala con su código
export async function joinRoom(code, { sim, timeout = 15000 } = {}) {
  return joinPeerId(PREFIX + code, { sim, timeout });
}

async function joinPeerId(id, { sim, timeout = 15000, onPeer } = {}) {
  const Peer = await getPeer();
  const ice = await iceServers();
  const peer = await openPeer(Peer, null, ice);
  onPeer?.(peer);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error('timeout'));
    }, timeout);
    const conn = peer.connect(id, { reliable: true, serialization: 'json' });
    conn.on('open', () => {
      clearTimeout(timer);
      resolve(new Link(conn, peer, sim));
    });
    peer.on('error', (e) => {
      clearTimeout(timer);
      peer.destroy();
      reject(e);
    });
  });
}

export function describeConnection(type) {
  if (type.startsWith('host')) return 'Directa por la red de casa';
  if (type.includes('relay')) return 'Por servidor puente';
  if (type.includes('srflx') || type.includes('prflx')) return 'Directa por internet';
  return 'Conectados';
}

// ------------------------------------------------------------------
// Emparejamiento automático, sin códigos ni servidor propio.
// En el servidor de señalización hay "lugares de espera" numerados
// (pokechamp-v1-cola-1, -2, …). El primero que llega a un lugar libre lo
// ocupa y espera; el siguiente lo encuentra ocupado y se conecta con quien
// espera. Apenas se arma la pareja, el lugar se libera para otros.
// Quien espera en un lugar que no es el 1 revisa cada tanto los anteriores,
// así dos personas que esperan en lugares distintos igual se encuentran.
// ------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function quickMatch({ sim, slots = 5, queue = '', onStatus } = {}) {
  const SLOT = (k) => `${PREFIX}cola${queue ? `-${queue}` : ''}-${k}`;
  let cancelled = false;
  const peers = new Set();
  const track = (p) => {
    peers.add(p);
    p.on('close', () => peers.delete(p));
    return p;
  };

  // Me conecto con quien espera en el lugar k. Devuelve el enlace o null.
  async function tryJoin(k) {
    let link;
    try {
      link = await joinPeerId(SLOT(k), { sim, timeout: 5000, onPeer: track });
    } catch {
      return null;
    }
    const answer = await link.first(2500);
    if (answer?.t === 'ok' && !cancelled) return link;
    link.close('ocupado');
    return null;
  }

  // Ocupo el lugar k y espero. Termina con la pareja armada o null.
  function waitHere(peer, k) {
    return new Promise((resolve) => {
      let done = false;
      let probing = false;
      const finish = (res) => {
        if (done) return false;
        done = true;
        clearInterval(probe);
        resolve(res);
        return true;
      };
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          if (done || cancelled) {
            conn.send({ t: 'busy' });
            setTimeout(() => conn.close(), 200);
            return;
          }
          conn.send({ t: 'ok' });
          finish({ link: new Link(conn, peer, sim), role: 'host' });
          // Libero el lugar (la partida sigue por la conexión directa)
          setTimeout(() => {
            if (!peer.destroyed) peer.disconnect();
          }, 300);
        });
      });
      peer.on('disconnected', () => {
        if (!done && !peer.destroyed) peer.reconnect();
      });
      peer.on('close', () => finish(null));
      // ¿Hay alguien esperando en un lugar anterior? Me uno a esa persona
      const probe = k > 1 ? setInterval(async () => {
        if (done || probing || cancelled) return;
        probing = true;
        for (let j = 1; j < k && !done && !cancelled; j++) {
          const link = await tryJoin(j);
          if (!link) continue;
          if (!finish({ link, role: 'guest' })) link.close('ocupado');
          else peer.destroy();
          break;
        }
        probing = false;
      }, 6000) : null;
    });
  }

  const promise = (async () => {
    const Peer = await getPeer();
    const ice = await iceServers();
    for (let round = 0; !cancelled; round++) {
      if (round) await sleep(700 + Math.random() * 600);
      for (let k = 1; k <= slots && !cancelled; k++) {
        let peer = null;
        try {
          peer = track(await openPeer(Peer, SLOT(k), ice));
        } catch (e) {
          if (e?.type !== 'unavailable-id') {
            if (cancelled) break;
            throw e;
          }
        }
        if (cancelled) {
          peer?.destroy();
          break;
        }
        if (peer) {
          onStatus?.({ waiting: k });
          const res = await waitHere(peer, k);
          if (res && !cancelled) return res;
          res?.link.close('cancelado');
          break;
        }
        // Ese lugar está ocupado: hay alguien esperando ahí
        onStatus?.({ trying: k });
        const link = await tryJoin(k);
        if (link && !cancelled) return { link, role: 'guest' };
        link?.close('cancelado');
      }
    }
    throw new Error('cancelado');
  })();

  return {
    promise,
    cancel() {
      cancelled = true;
      for (const p of [...peers]) if (!p.destroyed) p.destroy();
    },
  };
}
