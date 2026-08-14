// Assistant Fondateur — couche audio du mode vocal (2026-08-12).
//
// L'API Live attend du PCM 16 bits mono à 16 kHz en entrée, et renvoie du PCM
// 16 bits mono à 24 kHz. Le navigateur, lui, travaille en Float32 à la fréquence
// de sa carte son (souvent 48 kHz) : tout ce fichier existe pour faire le pont.
//
// Deux pièges traités ici, qui s'entendent immédiatement quand on les rate :
//   • la lecture doit être PLANIFIÉE bout à bout, pas jouée à l'arrivée — sinon
//     chaque paquet produit un micro-silence et la voix hache ;
//   • à l'interruption, il faut couper les sources DÉJÀ planifiées, sinon on
//     entend la fin d'une phrase que le modèle a abandonnée.

/** Le worklet tourne dans un thread audio isolé : il est chargé depuis un Blob
 *  pour éviter un fichier statique séparé à déployer. */
const CODE_WORKLET = `
class CaptureProcesseur extends AudioWorkletProcessor {
  process(entrees) {
    const canal = entrees[0] && entrees[0][0];
    if (canal && canal.length) {
      // On copie : le tampon est réutilisé par le moteur audio au tour suivant.
      this.port.postMessage(new Float32Array(canal));
    }
    return true;
  }
}
registerProcessor('capture-processeur', CaptureProcesseur);
`;

const base64DepuisInt16 = (echantillons: Int16Array): string => {
  const octets = new Uint8Array(echantillons.buffer);
  let binaire = '';
  // Par tranches : String.fromCharCode(...tableau) dépasse la pile au-delà de ~100 k.
  const TRANCHE = 8192;
  for (let i = 0; i < octets.length; i += TRANCHE) {
    binaire += String.fromCharCode(...octets.subarray(i, i + TRANCHE));
  }
  return btoa(binaire);
};

const int16DepuisBase64 = (b64: string): Int16Array => {
  const binaire = atob(b64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return new Int16Array(octets.buffer);
};

/** Rééchantillonnage linéaire — utilisé seulement si le navigateur refuse la
 *  fréquence demandée (Firefox et Safari ignorent parfois sampleRate). */
function reechantillonner(entree: Float32Array, deDepuis: number, vers: number): Float32Array {
  if (deDepuis === vers) return entree;
  const rapport = deDepuis / vers;
  const sortie = new Float32Array(Math.round(entree.length / rapport));
  for (let i = 0; i < sortie.length; i++) {
    const pos = i * rapport;
    const gauche = Math.floor(pos);
    const droite = Math.min(gauche + 1, entree.length - 1);
    const frac = pos - gauche;
    sortie[i] = entree[gauche] * (1 - frac) + entree[droite] * frac;
  }
  return sortie;
}

// ───────────────────────────────────────────────────────────────────────────
//  Capture micro → PCM 16 kHz base64
// ───────────────────────────────────────────────────────────────────────────
export class CaptureMicro {
  private contexte: AudioContext | null = null;
  private flux: MediaStream | null = null;
  private noeud: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sourdine = false;
  /** Le nœud d'entrée est-il relié au worklet ? C'est cette liaison, et non un
   *  drapeau, qui détermine si une trame peut seulement être captée. */
  private branchee = false;

  private surPcm: (base64: string) => void;
  private surNiveau: (niveau: number) => void;

  // Champs déclarés puis affectés, plutôt que des propriétés de paramètre : ces
  // dernières ne sont pas du JavaScript et empêchent d'exécuter ce fichier hors
  // du bundler, donc de le tester.
  constructor(
    surPcm: (base64: string) => void,
    surNiveau: (niveau: number) => void,
  ) {
    this.surPcm = surPcm;
    this.surNiveau = surNiveau;
  }

  /**
   * Coupe le micro sans fermer la session.
   *
   * TROIS BARRIÈRES, et non une seule. Une version précédente se contentait de
   * `enabled = false` plus un test dans le gestionnaire de trames : le graphe
   * audio continuait de tourner et la moindre régression sur le drapeau
   * rouvrait le micro sans que rien ne le signale.
   *
   *   1. la piste est désactivée — le navigateur affiche le micro comme muet ;
   *   2. le nœud d'entrée est DÉBRANCHÉ du worklet — plus une seule trame
   *      n'atteint le code de capture, quoi qu'il arrive ensuite ;
   *   3. le drapeau `sourdine` bloque l'envoi en dernier recours.
   *
   * Le flux et le contexte audio sont conservés : le rétablissement ne redemande
   * aucune permission, ne crée aucun écouteur en double et ne fuit rien.
   */
  couper(muet: boolean): void {
    this.sourdine = muet;
    this.flux?.getAudioTracks().forEach((piste) => { piste.enabled = !muet; });

    if (muet) {
      if (this.branchee && this.source && this.noeud) {
        try { this.source.disconnect(this.noeud); } catch { /* déjà détaché */ }
        this.branchee = false;
      }
      this.surNiveau(0);
      return;
    }

    if (!this.branchee && this.source && this.noeud) {
      this.source.connect(this.noeud);
      this.branchee = true;
    }
  }

  /**
   * État RÉEL de la capture, lu sur le flux — jamais sur une intention mémorisée.
   *
   * C'est ce que l'écran doit afficher : si le périphérique est débranché ou la
   * permission révoquée, le micro est effectivement coupé, même si personne n'a
   * cliqué sur le bouton.
   */
  estActif(): boolean {
    if (!this.flux || !this.branchee || this.sourdine) return false;
    return this.flux.getAudioTracks().some((p) => p.enabled && p.readyState === 'live');
  }

  async demarrer(): Promise<void> {
    this.flux = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        // Sans annulation d'écho, le modèle s'entend parler et se coupe lui-même.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.contexte = new AudioContext({ sampleRate: 16000 });
    const urlWorklet = URL.createObjectURL(new Blob([CODE_WORKLET], { type: 'application/javascript' }));
    await this.contexte.audioWorklet.addModule(urlWorklet);
    URL.revokeObjectURL(urlWorklet);

    this.source = this.contexte.createMediaStreamSource(this.flux);
    this.noeud = new AudioWorkletNode(this.contexte, 'capture-processeur');

    const freqReelle = this.contexte.sampleRate;

    this.noeud.port.onmessage = (evt) => {
      if (this.sourdine) return;
      const brut = evt.data as Float32Array;
      const echantillons = reechantillonner(brut, freqReelle, 16000);

      // Niveau sonore (RMS) : sert uniquement à animer le visualiseur.
      let somme = 0;
      for (let i = 0; i < echantillons.length; i++) somme += echantillons[i] * echantillons[i];
      this.surNiveau(Math.min(Math.sqrt(somme / echantillons.length) * 4, 1));

      const pcm = new Int16Array(echantillons.length);
      for (let i = 0; i < echantillons.length; i++) {
        const v = Math.max(-1, Math.min(1, echantillons[i]));
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      this.surPcm(base64DepuisInt16(pcm));
    };

    // Une capture démarrée alors que la sourdine est déjà demandée reste
    // débranchée : ouvrir le micro pour le refermer aussitôt laisserait passer
    // les trames de l'intervalle.
    if (!this.sourdine) {
      this.source.connect(this.noeud);
      this.branchee = true;
    }
    // Le worklet doit être relié à la destination pour que le graphe tourne, mais
    // via un gain nul : sans ça, le fondateur s'entend lui-même en retour.
    const muet = this.contexte.createGain();
    muet.gain.value = 0;
    this.noeud.connect(muet);
    muet.connect(this.contexte.destination);
  }

  arreter(): void {
    this.noeud?.port.close();
    this.source?.disconnect();
    this.noeud?.disconnect();
    this.flux?.getTracks().forEach((t) => t.stop());
    this.contexte?.close();
    this.branchee = false;
    this.noeud = null;
    this.source = null;
    this.flux = null;
    this.contexte = null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Lecture du flux 24 kHz renvoyé par le modèle
// ───────────────────────────────────────────────────────────────────────────
export class LecteurAudio {
  private contexte: AudioContext | null = null;
  private analyseur: AnalyserNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  /** Instant (horloge audio) où le prochain paquet doit commencer. */
  private prochainDebut = 0;
  /** Instant où a commencé la plage sonore en cours. Avec prochainDebut, il
   *  borne le tour de parole et permet d'en connaître l'avancement. */
  private debutPlage = 0;
  private animation = 0;
  private surNiveau: (niveau: number) => void;

  constructor(surNiveau: (niveau: number) => void) {
    this.surNiveau = surNiveau;
  }

  private assurerContexte(): AudioContext {
    if (!this.contexte) {
      this.contexte = new AudioContext({ sampleRate: 24000 });
      this.analyseur = this.contexte.createAnalyser();
      this.analyseur.fftSize = 256;
      this.analyseur.connect(this.contexte.destination);
      this.boucleNiveau();
    }
    return this.contexte;
  }

  private boucleNiveau(): void {
    const donnees = new Uint8Array(this.analyseur!.frequencyBinCount);
    const lire = () => {
      if (!this.analyseur) return;
      this.analyseur.getByteTimeDomainData(donnees);
      let somme = 0;
      for (let i = 0; i < donnees.length; i++) {
        const v = (donnees[i] - 128) / 128;
        somme += v * v;
      }
      this.surNiveau(Math.min(Math.sqrt(somme / donnees.length) * 3, 1));
      this.animation = requestAnimationFrame(lire);
    };
    this.animation = requestAnimationFrame(lire);
  }

  /** Ajoute un paquet à la file, planifié exactement après le précédent. */
  enfiler(base64: string): void {
    const ctx = this.assurerContexte();
    if (ctx.state === 'suspended') ctx.resume();

    const pcm = int16DepuisBase64(base64);
    const tampon = ctx.createBuffer(1, pcm.length, 24000);
    const canal = tampon.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) canal[i] = pcm[i] / 32768;

    const source = ctx.createBufferSource();
    source.buffer = tampon;
    source.connect(this.analyseur!);

    // Si la file s'est vidée (silence), on repart de maintenant ; sinon on
    // enchaîne exactement à la fin du paquet précédent — c'est ce calage qui
    // évite les micro-coupures entre paquets.
    const maintenant = ctx.currentTime;
    const fileVide = this.prochainDebut <= maintenant;
    const debut = Math.max(this.prochainDebut, maintenant + 0.02);
    // Nouvelle plage de parole : c'est ici que commence le tour dont on mesurera
    // l'avancement pour derouler le texte au rythme de la voix.
    if (fileVide) this.debutPlage = debut;
    source.start(debut);
    this.prochainDebut = debut + tampon.duration;

    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }

  /**
   * Part du tour de parole deja prononcee, entre 0 et 1.
   *
   * Sert a n'afficher que les mots deja dits : la transcription arrive du modele
   * bien avant que l'audio correspondant ne soit joue, donc l'afficher telle
   * quelle ferait apparaitre la phrase entiere avant la premiere syllabe.
   */
  avancement(): number {
    if (!this.contexte || this.prochainDebut === 0) return 1;
    const duree = this.prochainDebut - this.debutPlage;
    if (duree <= 0) return 1;
    const ecoule = this.contexte.currentTime - this.debutPlage;
    return Math.min(Math.max(ecoule / duree, 0), 1);
  }

  /** Interruption : coupe tout ce qui est planifié et repart de zéro. */
  vider(): void {
    this.sources.forEach((s) => { try { s.stop(); } catch { /* déjà terminée */ } });
    this.sources.clear();
    this.prochainDebut = 0;
    this.debutPlage = 0;
    this.surNiveau(0);
  }

  arreter(): void {
    cancelAnimationFrame(this.animation);
    this.vider();
    this.analyseur?.disconnect();
    this.contexte?.close();
    this.analyseur = null;
    this.contexte = null;
  }
}
