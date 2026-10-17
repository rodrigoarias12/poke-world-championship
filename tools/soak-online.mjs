// Prueba de resistencia del modo en línea, sin pantalla ni red real:
// un anfitrión y un invitado (IA contra IA) conectados por una "tubería" en
// memoria con demora simulada. Busca errores y verifica que los dos terminen igual.
//
//   node tools/soak-online.mjs 200

const N = Number(process.argv[2] || 50);
const noop = () => {};
const fakeCtx = new Proxy({}, {
  get(t, k) {
    if (k === 'measureText') return (s) => ({ width: String(s).length * 2.5 });
    if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (k in t) return t[k];
    return noop;
  },
  set(t, k, v) {
    t[k] = v;
    return true;
  },
});
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx }) };
globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = { getItem: () => null, setItem: noop };
globalThis.location = { search: '' };

const root = new URL('../src/', import.meta.url).href;
const { Battle } = await import(root + 'battle.js');
const { AI } = await import(root + 'ai.js');
const { RemoteController } = await import(root + 'controllers.js');
const { ROSTER, ARENAS } = await import(root + 'data.js');
const { snapshot } = await import(root + 'net/protocol.js');
const { startRecording } = await import(root + 'net/recorder.js');
const { GuestBattle } = await import(root + 'net/guest.js');

const anyAudio = new Proxy({}, { get: () => noop });
const game = { audio: anyAudio, input: { moveVector: () => [0, 0], isDown: () => false, wasPressed: () => false, touchMode: false } };

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
let errors = 0;
let mismatches = 0;
let totalEvents = 0;
let gmaxUsed = 0;
const started = Date.now();

for (let i = 0; i < N; i++) {
  const roster = shuffle(ROSTER);
  const cfg = { teamA: roster.slice(0, 3), teamB: roster.slice(3, 6), bossLast: false, difficulty: 'normal', arena: ARENAS[i % 3], round: 'EN LÍNEA', seed: i + 1 };
  try {
    const host = new Battle(game, cfg);
    host.online = true;
    const remote = new RemoteController(host, 1);
    host.setController(1, remote);
    const aiHost = new AI(host, 0, 'dificil');
    host.setController(0, { side: 0, isAI: false, update: (dt) => aiHost.update(dt) });
    const sink = startRecording(host);
    const guest = new GuestBattle(game, cfg);
    const aiGuest = new AI(guest, 1, 'dificil');
    const counts = [0, 0, 0, 0, 0];
    let lastUse = -1;
    // Tubería con demora: [momento de entrega, mensaje]
    const toGuest = [];
    const toHost = [];
    const lag = 0.03 + Math.random() * 0.06;
    let t = 0;
    let sendAcc = 0;
    let k = 0;
    for (; k < 60 * 300 && !(host.state === 'end' && guest.state === 'end'); k++) {
      const dt = 1 / 60;
      t += dt;
      while (toHost.length && toHost[0][0] <= t) remote.receive(JSON.parse(toHost.shift()[1]));
      host.update(dt);
      sendAcc += dt;
      if (sendAcc >= 1 / 30) {
        sendAcc -= 1 / 30;
        const s = snapshot(host, sink.splice(0));
        totalEvents += s.ev.length;
        toGuest.push([t + lag + Math.random() * 0.03, JSON.stringify(s)]);
        toGuest.sort((a, b) => a[0] - b[0]);
      }
      while (toGuest.length && toGuest[0][0] <= t) guest.receive(JSON.parse(toGuest.shift()[1]));
      aiGuest.update(dt);
      const f = guest.fighters[1];
      if (f.intent.use >= 0 && f.intent.use !== lastUse) counts[f.intent.use]++;
      lastUse = f.intent.use;
      toHost.push([t + lag, JSON.stringify({ t: 'in', mx: f.intent.mx, my: f.intent.my, h: 0, p: [...counts, guest.gmaxPress || 0] })]);
      guest.update(dt);
      if (k % 6 === 0) {
        host.render(fakeCtx);
        guest.render(fakeCtx);
      }
    }
    gmaxUsed += host.gx.filter((g) => g.used).length;
    const same = host.winner?.side === guest.winner?.side && host.fighters.every((f, s) => Math.round(f.hp) === Math.round(guest.fighters[s].hp));
    if (host.state !== 'end' || guest.state !== 'end' || !same) {
      mismatches++;
      console.log(`#${i} distinto: host=${host.state}/${host.winner?.side} guest=${guest.state}/${guest.winner?.side} hp=${host.fighters.map((f) => Math.round(f.hp))} vs ${guest.fighters.map((f) => Math.round(f.hp))}`);
    }
  } catch (e) {
    errors++;
    console.log(`#${i} ERROR ${cfg.teamA} vs ${cfg.teamB}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
  }
}
console.log(`peleas=${N} errores=${errors} distintas=${mismatches} gigamax=${gmaxUsed}/${N * 2} eventos=${totalEvents} tiempo=${((Date.now() - started) / 1000).toFixed(1)}s`);
