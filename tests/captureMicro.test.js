// Coupure du micro — état RÉEL de la capture (2026-08-14).
//
// Ce test existe parce que le défaut signalé était invisible à la lecture : le
// code « coupait » bien le micro, et pourtant la transcription continuait. On ne
// vérifie donc pas une intention, on vérifie qu'aucun échantillon ne sort.
//
// Le faux graphe audio reproduit la sémantique du navigateur : un nœud
// débranché ne délivre plus rien. Mais le test pousse quand même des trames
// dans le worklet APRÈS la coupure — c'est le pire cas, celui d'une fuite — et
// exige qu'il n'en sorte rien malgré tout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureMicro } from '../src/lib/assistantVocalAudio.ts';

// ───────────────────────────────────────────────────────────────────────────
//  Faux navigateur
// ───────────────────────────────────────────────────────────────────────────
class FaussePiste {
  constructor() { this.enabled = true; this.readyState = 'live'; }
  stop() { this.readyState = 'ended'; }
}

class FauxFlux {
  constructor() { this.pistes = [new FaussePiste()]; }
  getAudioTracks() { return this.pistes; }
  getTracks() { return this.pistes; }
}

class FauxNoeudSource {
  constructor() { this.liens = new Set(); }
  connect(n) { this.liens.add(n); }
  disconnect(n) { if (n) this.liens.delete(n); else this.liens.clear(); }
  estRelieA(n) { return this.liens.has(n); }
}

class FauxWorklet {
  constructor() {
    this.port = { onmessage: null, close() {} };
    FauxWorklet.dernier = this;
  }
  connect() {}
  disconnect() {}
}

class FauxContexte {
  constructor({ sampleRate }) {
    this.sampleRate = sampleRate;
    this.destination = {};
    this.ferme = false;
    this.audioWorklet = { addModule: async () => {} };
  }
  createMediaStreamSource() { this.source = new FauxNoeudSource(); return this.source; }
  createGain() { return { gain: { value: 1 }, connect() {} }; }
  close() { this.ferme = true; }
}

/** Installe le faux navigateur et rend de quoi observer ce qui s'y passe. */
function installer() {
  const observe = { appelsGetUserMedia: 0, flux: null, contexte: null };

  // `navigator` est en lecture seule sur globalThis depuis Node 21 : on redéfinit
  // la propriété plutôt que de l'affecter.
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          observe.appelsGetUserMedia += 1;
          observe.flux = new FauxFlux();
          return observe.flux;
        },
      },
    },
  });
  globalThis.AudioContext = class extends FauxContexte {
    constructor(opts) { super(opts); observe.contexte = this; }
  };
  globalThis.AudioWorkletNode = FauxWorklet;
  globalThis.URL.createObjectURL = () => 'blob:faux';
  globalThis.URL.revokeObjectURL = () => {};

  return observe;
}

/** Pousse une trame dans le worklet, que le graphe soit branché ou non.
 *  C'est volontairement le pire cas : une fuite de trames. */
function pousserTrame() {
  const trame = new Float32Array(128).fill(0.35);
  FauxWorklet.dernier.port.onmessage({ data: trame });
}

/** Monte une capture prête à l'emploi et collecte le PCM émis. */
async function monter() {
  const observe = installer();
  const pcm = [];
  const niveaux = [];
  const micro = new CaptureMicro((b64) => pcm.push(b64), (n) => niveaux.push(n));
  await micro.demarrer();
  return { micro, pcm, niveaux, observe };
}

// ───────────────────────────────────────────────────────────────────────────
//  Tests
// ───────────────────────────────────────────────────────────────────────────

test('avant coupure, la capture émet bien du PCM', async () => {
  const { pcm } = await monter();
  pousserTrame();
  assert.equal(pcm.length, 1, 'le montage de référence doit produire un échantillon');
});

test('micro coupé : plus aucun échantillon ne sort, même si des trames arrivent', async () => {
  const { micro, pcm, observe } = await monter();
  pousserTrame();
  const avant = pcm.length;

  micro.couper(true);
  pousserTrame();
  pousserTrame();
  pousserTrame();

  assert.equal(pcm.length, avant, 'aucun échantillon ne doit être émis après la coupure');
  assert.equal(observe.flux.getAudioTracks()[0].enabled, false, 'la piste doit être désactivée');
  assert.equal(
    observe.contexte.source.estRelieA(FauxWorklet.dernier), false,
    "le nœud d'entrée doit être débranché du worklet",
  );
  assert.equal(micro.estActif(), false, 'estActif doit refléter la coupure');
});

test('le niveau retombe à zéro à la coupure, sinon le visualiseur reste figé', async () => {
  const { micro, niveaux } = await monter();
  pousserTrame();
  micro.couper(true);
  assert.equal(niveaux.at(-1), 0);
});

test('rétablissement : la capture repart sans redemander la permission', async () => {
  const { micro, pcm, observe } = await monter();
  const fluxInitial = observe.flux;

  micro.couper(true);
  const apresCoupure = pcm.length;
  micro.couper(false);
  pousserTrame();

  assert.equal(pcm.length, apresCoupure + 1, 'la capture doit reprendre');
  assert.equal(observe.appelsGetUserMedia, 1, 'getUserMedia ne doit pas être rappelé');
  assert.equal(observe.flux, fluxInitial, 'le flux doit être le même objet');
  assert.equal(
    observe.contexte.source.estRelieA(FauxWorklet.dernier), true,
    "le nœud d'entrée doit être rebranché",
  );
  assert.equal(micro.estActif(), true);
});

test('coupures répétées : idempotent, aucun lien en double', async () => {
  // StrictMode invoque deux fois ce qu'il croit être une fonction pure : la
  // coupure doit survivre à un appel dupliqué.
  const { micro, pcm, observe } = await monter();
  micro.couper(true);
  micro.couper(true);
  micro.couper(false);
  micro.couper(false);

  assert.equal(observe.contexte.source.liens.size, 1, "un seul lien vers le worklet");
  const avant = pcm.length;
  pousserTrame();
  assert.equal(pcm.length, avant + 1);
});

test('périphérique débranché : estActif est faux sans qu\'on ait cliqué', async () => {
  const { micro, observe } = await monter();
  assert.equal(micro.estActif(), true);
  observe.flux.getAudioTracks()[0].stop();     // câble arraché, permission révoquée…
  assert.equal(micro.estActif(), false, "l'écran doit pouvoir dire que le micro est mort");
});

test('arrêt : tout est libéré', async () => {
  const { micro, observe } = await monter();
  micro.arreter();
  assert.equal(observe.flux.getAudioTracks()[0].readyState, 'ended');
  assert.equal(observe.contexte.ferme, true);
  assert.equal(micro.estActif(), false);
});
