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

// Si algún día existe /api/turn (servidor puente de Cloudflare), se suma; si no, solo STUN
async function iceServers() {
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
    peer.on('open', () => resolve(peer));
    peer.on('error', (e) => reject(e));
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
    if (!lag && !jitter) {
      for (const h of this.handlers) h(data);
      return;
    }
    // Demora simulada sin desordenar los mensajes (el canal es ordenado)
    const now = performance.now();
    const at = Math.max(this.nextDeliver, now + lag / 2 + Math.random() * jitter);
    this.nextDeliver = at;
    setTimeout(() => {
      if (!this.closed) for (const h of this.handlers) h(data);
    }, at - now);
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
    return () => this.handlers.delete(fn);
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
  const Peer = await getPeer();
  const ice = await iceServers();
  const peer = await openPeer(Peer, null, ice);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      peer.destroy();
      reject(new Error('timeout'));
    }, timeout);
    const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
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
