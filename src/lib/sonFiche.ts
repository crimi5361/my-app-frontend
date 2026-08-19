// Habillage sonore de la fiche d'identité (2026-08-19).
//
// Le fondateur veut « un petit son de recherche par intelligence artificielle »
// pendant que la fiche se monte. Tout est SYNTHÉTISÉ ici, aucun fichier audio :
// pas de téléchargement, pas de latence au premier usage, et rien à déployer.
//
// TROIS CONTRAINTES ONT DICTÉ LE DOSAGE, et elles vont toutes dans le même sens
// — discret :
//
//   1. L'assistante PARLE pendant que la fiche se construit. Un son fort
//      couvrirait sa voix, qui porte l'information utile.
//   2. Le micro est ouvert. Un son trop présent revient dans la capture ;
//      l'annulation d'écho du navigateur le rattrape, mais autant ne pas la
//      solliciter pour rien.
//   3. Le fondateur consulte des fiches à longueur de journée. Ce qui
//      impressionne la première fois agace la vingtième.
//
// D'où : volume à 4 % du maximum, sons courts, filtrés dans l'aigu, et jamais
// plus d'un événement par bloc d'information.

/** Volume maître. Volontairement très bas — voir l'en-tête. */
const VOLUME = 0.04;

class Sonar {
  private ctx: AudioContext | null = null;
  private maitre: GainNode | null = null;
  private souffle: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Le contexte n'est créé qu'au premier son : le construire au chargement de
   *  la page le laisserait suspendu par la politique d'autoplay. */
  private assurer(): AudioContext | null {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext
          || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.maitre = this.ctx.createGain();
        this.maitre.gain.value = VOLUME;
        this.maitre.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;   // audio indisponible : la fiche s'affiche sans son
    }
  }

  /** Bip court et propre. `hauteur` en hertz, `duree` en secondes. */
  private bip(hauteur: number, duree: number, retard = 0, forme: OscillatorType = 'triangle') {
    const ctx = this.assurer();
    if (!ctx || !this.maitre) return;
    const t = ctx.currentTime + retard;

    const osc = ctx.createOscillator();
    osc.type = forme;
    osc.frequency.setValueAtTime(hauteur, t);

    const g = ctx.createGain();
    // Attaque quasi instantanée, extinction exponentielle : c'est ce profil qui
    // fait « électronique » plutôt que « note de musique ».
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);

    osc.connect(g);
    g.connect(this.maitre);
    osc.start(t);
    osc.stop(t + duree + 0.02);
  }

  /** Ouverture : un balayage descendant, comme un faisceau qui accroche sa cible. */
  ouverture() {
    const ctx = this.assurer();
    if (!ctx || !this.maitre) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1750, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.42);

    // Le filtre suit la fréquence : sans lui, le balayage siffle désagréablement.
    const filtre = ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.Q.value = 5;
    filtre.frequency.setValueAtTime(1750, t);
    filtre.frequency.exponentialRampToValueAtTime(340, t + 0.42);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);

    osc.connect(filtre); filtre.connect(g); g.connect(this.maitre);
    osc.start(t); osc.stop(t + 0.5);
  }

  /**
   * Souffle continu pendant la frappe — le bruit de fond d'une machine qui
   * travaille. Bruit blanc bouclé, écrasé par un passe-bande étroit : on entend
   * une présence, pas un sifflement.
   */
  demarrerSouffle() {
    const ctx = this.assurer();
    if (!ctx || !this.maitre || this.souffle) return;

    const taille = ctx.sampleRate * 2;
    const tampon = ctx.createBuffer(1, taille, ctx.sampleRate);
    const canal = tampon.getChannelData(0);
    for (let i = 0; i < taille; i += 1) canal[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = tampon;
    source.loop = true;

    const filtre = ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.frequency.value = 2600;
    filtre.Q.value = 12;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.15);

    source.connect(filtre); filtre.connect(g); g.connect(this.maitre);
    source.start();
    this.souffle = { source, gain: g };
  }

  arreterSouffle() {
    const ctx = this.ctx;
    if (!ctx || !this.souffle) return;
    const { source, gain } = this.souffle;
    this.souffle = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    try { source.stop(t + 0.3); } catch { /* déjà arrêtée */ }
  }

  /** Un bloc d'information vient de se remplir. */
  bloc() { this.bip(1180, 0.055); }

  /** Fiche complète : deux notes montantes, la confirmation. */
  fin() {
    this.bip(880, 0.09);
    this.bip(1320, 0.16, 0.085);
  }

  /** Le contexte audio est libéré à la fermeture : une fiche consultée cent
   *  fois ne doit pas laisser cent contextes derrière elle. */
  fermer() {
    this.arreterSouffle();
    const ctx = this.ctx;
    this.ctx = null;
    this.maitre = null;
    if (ctx) setTimeout(() => { ctx.close().catch(() => {}); }, 500);
  }
}

/** Sonar muet, utilisé quand l'utilisateur a demandé moins d'animations : il a
 *  la même surface, ce qui évite un test à chaque appel dans le composant. */
const MUET = {
  ouverture() {}, demarrerSouffle() {}, arreterSouffle() {},
  bloc() {}, fin() {}, fermer() {},
};

export type SonarFiche = Sonar | typeof MUET;

export function creerSonar(): SonarFiche {
  const reduit = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduit ? MUET : new Sonar();
}
