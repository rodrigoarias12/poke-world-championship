// En el anfitrión: graba cada efecto visual y sonido que hace la pelea,
// para mandarlos al invitado junto con la próxima foto (snapshot).
import { pack } from './protocol.js';

const FX = ['burst', 'trail', 'dust', 'ring', 'float', 'ghost', 'impact', 'circle', 'add'];
const AUDIO = ['play', 'cry', 'cast', 'hitFx', 'sustain', 'ult'];
const ARENA = ['freeze'];

function recordCalls(obj, tag, methods, sink) {
  return new Proxy(obj, {
    get(target, key) {
      const v = target[key];
      if (typeof v !== 'function') return v;
      if (methods.includes(key)) {
        return (...args) => {
          sink.push([tag, key, args.map(pack)]);
          return v.apply(target, args);
        };
      }
      return v.bind(target);
    },
  });
}

export function startRecording(b) {
  const sink = [];
  b.effects = recordCalls(b.effects, 'fx', FX, sink);
  b.audio = recordCalls(b.audio, 'au', AUDIO, sink);
  b.arena = recordCalls(b.arena, 'ar', ARENA, sink);
  // Etiquetas de ataque y frases del relator (el invitado las adapta a su punto de vista)
  for (const m of ['callout', 'say']) {
    const orig = b[m].bind(b);
    b[m] = (...args) => {
      sink.push(['b', m, args.map(pack)]);
      return orig(...args);
    };
  }
  return sink;
}
