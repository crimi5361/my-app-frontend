// Assistant Fondateur — pilotage de la session vocale (2026-08-12).
//
// Rassemble en un seul état la connexion WebSocket, la capture micro et la lecture
// audio, pour que l'écran n'ait plus qu'à afficher. La clé Gemini n'apparaît jamais
// ici : le navigateur parle au serveur, qui parle à Google.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureMicro, LecteurAudio } from './assistantVocalAudio';
import { FichierAssistant } from './assistantFichiers';

export type StatutVocal =
  | 'inactif'      // pas encore démarré
  | 'connexion'    // WebSocket en cours d'ouverture
  | 'ecoute'       // micro ouvert, le fondateur peut parler
  | 'reflexion'    // le modèle interroge la base
  | 'construction' // le modèle assemble un graphique
  | 'parle'        // le modèle répond à voix haute
  | 'erreur';

export interface VisualisationVocale {
  type: 'barres' | 'lignes' | 'aire' | 'camembert' | 'barres_empilees';
  titre: string;
  axe_x: string;
  series: { colonne: string; libelle: string }[];
  format_valeur: 'nombre' | 'montant' | 'pourcentage';
}

export interface RequeteVocale {
  intention: string | null;
  sql: string;
  ok: boolean;
  nb_lignes: number;
  duree_ms: number | null;
  motif: string | null;
}

export interface TourConversation {
  id: string;
  rôle: 'fondateur' | 'assistant';
  texte: string;
  /** Vrai tant que l'assistante est en train de prononcer ce tour : l'écran
   *  n'affiche alors que la part deja dite. */
  enCours?: boolean;
  /** Vrai tant que la reconnaissance n'a pas arrêté son choix. Le texte est
   *  alors provisoire — il s'affiche en gris, et rien n'en est déduit. */
  partiel?: boolean;
  /** Texte complet et corrigé, mis de côté le temps que la voix finisse de le
   *  prononcer. Le remonter pendant l'animation ferait clignoter le paragraphe. */
  texteFinal?: string;
}

/** Débriefing de la veille : résumé lu à voix haute + visuels poussés à l'écran. */
export interface DebriefingVocal {
  date: string | null;
  phrases: string[];
  graphiques: {
    visualisation: VisualisationVocale;
    donnees: Record<string, string | number | null>[];
  }[];
}

/** Fiche d'identite dessinee a l'ecran. Le contenu vient du serveur, jamais du
 *  modele : il choisit DE QUI parler, pas ce qu'on affiche. */
export interface FicheVocale {
  categorie: 'etudiant' | 'agent';
  libelle_categorie: string;
  id: number;
  nom_complet: string;
  reference: string | null;
  photo_url: string | null;
  etat: string | null;
  soustitre: string | null;
  blocs: { titre: string; champs: { libelle: string; valeur: string }[] }[];
}

export interface BudgetVocal {
  fcfa: number;
  budget_fcfa: number;
  restant_fcfa: number;
  pourcentage: number;
  appels: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * L'accueil nominatif a-t-il déjà été joué depuis la connexion ?
 *
 * Le serveur ne peut pas répondre : il voit une nouvelle session Live à chaque
 * ouverture de l'écran vocal, et rejouerait donc la phrase à chaque fois. Le
 * navigateur, lui, connaît la connexion.
 *
 * `sessionStorage` et non `localStorage` : la marque disparaît à la fermeture de
 * l'onglet, ce qui correspond à la durée d'une session de travail. La clé porte
 * l'identifiant de l'utilisateur pour qu'un changement de compte sur le même
 * poste soit bien accueilli.
 */
const CLE_ACCUEIL = 'assistant_accueil_joue';

function accueilDejaJoue(): boolean {
  try {
    const brut = localStorage.getItem('user');
    const id = brut ? (JSON.parse(brut)?.id ?? 'anonyme') : 'anonyme';
    const cle = `${CLE_ACCUEIL}:${id}`;
    if (sessionStorage.getItem(cle)) return true;
    sessionStorage.setItem(cle, '1');
    return false;
  } catch {
    // Stockage indisponible (navigation privée stricte) : on préfère accueillir
    // une fois de trop que de laisser le fondateur devant un écran muet.
    return false;
  }
}

// Le worklet émet un niveau toutes les ~8 ms (128 échantillons à 16 kHz) et
// l'analyseur de lecture à 60 Hz. Répercuter ça tel quel dans un état React
// provoque plus de 100 rendus par seconde. On échantillonne à 20 Hz : largement
// assez fluide pour un visualiseur, d'autant que le ressort d'animation lisse
// les valeurs intermédiaires.
const PERIODE_NIVEAU_MS = 50;

// La forme « construction » ne dure qu'un instant si on la laisse écraser par la
// première syllabe de commentaire du modèle. On la tient de force le temps
// qu'elle soit lisible.
const MAINTIEN_CONSTRUCTION_MS = 2600;

function limiterCadence(appliquer: (v: number) => void) {
  let dernier = 0;
  return (valeur: number) => {
    const maintenant = performance.now();
    // La valeur 0 passe toujours : c'est elle qui éteint le visualiseur.
    if (valeur !== 0 && maintenant - dernier < PERIODE_NIVEAU_MS) return;
    dernier = maintenant;
    appliquer(valeur);
  };
}

export function useAssistantVocal() {
  const [statut, setStatut] = useState<StatutVocal>('inactif');
  const [erreur, setErreur] = useState<string | null>(null);
  const [tours, setTours] = useState<TourConversation[]>([]);
  const [requetes, setRequetes] = useState<RequeteVocale[]>([]);
  const [visuel, setVisuel] = useState<{ visualisation: VisualisationVocale; donnees: Record<string, string | number | null>[] } | null>(null);
  const [budget, setBudget] = useState<BudgetVocal | null>(null);
  const [niveauEntree, setNiveauEntree] = useState(0);
  const [niveauSortie, setNiveauSortie] = useState(0);
  const [micCoupe, setMicCoupe] = useState(false);
  const [fichiers, setFichiers] = useState<FichierAssistant[]>([]);
  const [debriefing, setDebriefing] = useState<DebriefingVocal | null>(null);
  const [fiches, setFiches] = useState<FicheVocale[]>([]);
  // Forme 3D a afficher. Emise par le serveur d'apres l'outil appele et la vue
  // interrogee : elle suit ce que l'assistante FAIT, pas ce qui a ete dit.
  const [forme, setForme] = useState('sphere');
  // Part du tour de parole en cours deja prononcee. La transcription arrive du
  // modele bien avant l'audio correspondant : sans ce reglage, la phrase entiere
  // s'affichait avant la premiere syllabe.
  //
  // Volontairement une REF et non un etat : l'ecran la lit a 60 images par
  // seconde pour animer le texte. En passer par un etat React declencherait un
  // rendu complet du fil a chaque image, ce qui saccade precisement l'animation
  // qu'on cherche a rendre fluide.
  const avancementRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const microRef = useRef<CaptureMicro | null>(null);
  const lecteurRef = useRef<LecteurAudio | null>(null);
  // Intention de coupure, lisible SYNCHRONEMENT. L'état React, lui, décrit ce que
  // fait réellement le flux et peut en différer (périphérique débranché) : il
  // arrive trop tard pour décider du sort d'une transcription qui entre.
  const micCoupeRef = useRef(false);
  // La session a-t-elle été fermée volontairement ? Sans cette distinction, une
  // coupure réseau ramenait l'écran à « Prêt » sans un mot : le fondateur
  // continuait de parler à une session morte.
  const fermetureVoulueRef = useRef(false);
  // Les transcriptions arrivent par fragments : on les accumule dans le dernier
  // tour du bon locuteur plutôt que de créer une bulle par fragment.
  const tourEnCoursRef = useRef<{ fondateur: string | null; assistant: string | null }>({ fondateur: null, assistant: null });
  // Maintien de la forme « construction » : instant de fin, statut mis en attente
  // pendant le maintien, et minuteur à annuler si la session se ferme entre-temps.
  const finConstructionRef = useRef(0);
  const statutDiffereRef = useRef<StatutVocal | null>(null);
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Applique un statut, sauf pendant le maintien de la forme « construction »
   *  où il est mémorisé et appliqué à la fin. Une erreur passe toujours. */
  const majStatut = useCallback((s: StatutVocal) => {
    if (s !== 'erreur' && performance.now() < finConstructionRef.current) {
      statutDiffereRef.current = s;
      return;
    }
    setStatut(s);
  }, []);

  const ajouterFragment = useCallback((rôle: 'fondateur' | 'assistant', texte: string) => {
    setTours((precedents) => {
      const idEnCours = tourEnCoursRef.current[rôle];
      const index = idEnCours ? precedents.findIndex((t) => t.id === idEnCours) : -1;
      if (index >= 0) {
        const copie = [...precedents];
        copie[index] = { ...copie[index], texte: copie[index].texte + texte };
        return copie;
      }
      const id = uid();
      tourEnCoursRef.current[rôle] = id;
      return [...precedents, { id, rôle, texte, enCours: rôle === 'assistant', partiel: true }];
    });
  }, []);

  /**
   * Remplace un tour par sa version complète et corrigée, envoyée par le serveur
   * à la fin de la prise de parole.
   *
   * Les fragments s'affichent au fil de l'eau pour que l'écran suive la voix,
   * mais ils sont bruts : sans majuscule, sans ponctuation, sigles en
   * minuscules. La correction ne peut porter que sur le texte entier.
   */
  const finaliserTour = useCallback((rôle: 'fondateur' | 'assistant', texte: string) => {
    const id = tourEnCoursRef.current[rôle];
    if (rôle === 'fondateur') tourEnCoursRef.current.fondateur = null;

    if (!id) {
      // Aucun fragment n'a précédé : le tour n'existe pas encore, on le crée
      // directement dans sa forme définitive.
      setTours((precedents) => [...precedents, { id: uid(), rôle, texte, partiel: false }]);
      return;
    }

    setTours((precedents) => precedents.map((t) => {
      if (t.id !== id) return t;
      // L'assistante est peut-être encore en train de prononcer ce tour, révélé
      // mot à mot. Remonter le texte maintenant remonterait tous les mots d'un
      // coup : on le met de côté, cloreTourAssistant l'appliquera à la dernière
      // syllabe.
      if (rôle === 'assistant' && t.enCours) return { ...t, texteFinal: texte };
      return { ...t, texte, texteFinal: undefined, partiel: false };
    }));
  }, []);

  /** Clot le tour de l'assistante : plus de decoupage, le texte est complet. */
  const cloreTourAssistant = useCallback(() => {
    const id = tourEnCoursRef.current.assistant;
    tourEnCoursRef.current.assistant = null;
    if (id) {
      setTours((t) => t.map((x) => (x.id === id
        ? { ...x, texte: x.texteFinal ?? x.texte, texteFinal: undefined, enCours: false, partiel: false }
        : x)));
    }
    avancementRef.current = 0;
  }, []);

  /** Vrai quand le modele n'emet plus : il ne reste que l'audio a ecouler. */
  const finEmissionRef = useRef(false);

  const arreter = useCallback(() => {
    fermetureVoulueRef.current = true;
    microRef.current?.arreter();
    lecteurRef.current?.arreter();
    microRef.current = null;
    lecteurRef.current = null;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) wsRef.current.close();
    wsRef.current = null;
    if (minuteurRef.current) { clearTimeout(minuteurRef.current); minuteurRef.current = null; }
    finConstructionRef.current = 0;
    statutDiffereRef.current = null;
    setStatut('inactif');
    setForme('sphere');
    setNiveauEntree(0);
    setNiveauSortie(0);
    micCoupeRef.current = false;
    setMicCoupe(false);
  }, []);

  /**
   * Coupe ou rétablit le micro sans interrompre la session en cours.
   *
   * L'effet de bord est ICI et non dans un `setState` : un updater React doit
   * être pur, et StrictMode l'invoque deux fois. Couper un périphérique depuis
   * un updater est un pari sur l'idempotence du pilote audio.
   *
   * La coupure est ensuite ANNONCÉE AU SERVEUR. C'est ce qui la rend réelle : le
   * serveur cesse de relayer les trames à Google et de renvoyer les
   * transcriptions. Sans cet avis, l'audio déjà parti — celui du réseau et celui
   * bufferisé chez Google — continuait d'être transcrit après le clic.
   */
  const basculerMicro = useCallback(() => {
    const micro = microRef.current;
    // On bascule par rapport à ce que le fondateur VOIT. Si la piste s'est
    // arrêtée d'elle-même, l'écran affiche « coupé » et un clic doit rallumer.
    const coupeMaintenant = micro ? !micro.estActif() : micCoupeRef.current;
    const suivant = !coupeMaintenant;

    micCoupeRef.current = suivant;
    micro?.couper(suivant);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'micro', coupe: suivant }));
    }

    // Ce qui s'affiche est relu sur le flux, pas déduit de l'intention.
    setMicCoupe(micro ? !micro.estActif() : suivant);
  }, []);

  // L'indicateur suit le FLUX. Un périphérique débranché ou une permission
  // révoquée coupent le micro sans que personne ait cliqué : l'écran doit le
  // dire, sinon le fondateur croit être entendu alors qu'il ne l'est plus.
  useEffect(() => {
    const suivi = setInterval(() => {
      const micro = microRef.current;
      if (!micro) return;
      const coupe = !micro.estActif();
      setMicCoupe((precedent) => (precedent === coupe ? precedent : coupe));
    }, 500);
    return () => clearInterval(suivi);
  }, []);

  const demarrer = useCallback(async () => {
    // Deux sessions ouvertes en même temps, c'est deux fois le coût et deux voix
    // en écho. Le cas se produit en développement (StrictMode monte deux fois)
    // et sur un clic répété de « Réessayer ».
    if (wsRef.current || microRef.current) arreter();

    setErreur(null);
    setStatut('connexion');
    fermetureVoulueRef.current = false;

    const jeton = localStorage.getItem('token');
    if (!jeton) { setErreur('Session expirée. Reconnectez-vous.'); setStatut('erreur'); return; }

    // L'API expose son URL en http(s) ; le WebSocket suit le même hôte en ws(s).
    const base = (import.meta.env.VITE_API_URL_SERVER as string) || window.location.origin;
    const urlWs = `${base.replace(/^http/, 'ws')}/ws/assistant-vocal`;

    let ws: WebSocket;
    try {
      // Le jeton voyage dans le sous-protocole, pas dans l'URL : les query strings
      // atterrissent dans les journaux d'accès, pas les en-têtes.
      ws = new WebSocket(urlWs, ['jwt', jeton]);
    } catch {
      setErreur("Impossible d'ouvrir la connexion vocale."); setStatut('erreur'); return;
    }
    wsRef.current = ws;

    const lecteur = new LecteurAudio(limiterCadence(setNiveauSortie));
    lecteurRef.current = lecteur;
    finEmissionRef.current = false;

    // Suivi de l'avancement de la parole, a chaque image. Aucun rendu React n'en
    // decoule : l'ecran lit la reference et n'anime que des proprietes CSS.
    const suivre = () => {
      if (wsRef.current !== ws) return;              // session remplacee
      const a = lecteur.avancement();
      avancementRef.current = a;
      // La derniere syllabe est passee et le modele a fini : on figes le tour.
      if (a >= 1 && finEmissionRef.current) {
        finEmissionRef.current = false;
        cloreTourAssistant();
      }
      requestAnimationFrame(suivre);
    };
    requestAnimationFrame(suivre);

    // Une socket remplacée continue de délivrer ses événements en attente. Sans
    // ce filtre, le `onclose` de la session précédente coupait le micro de la
    // session courante et la ramenait à « Prêt » — exactement ce qu'on observait
    // au démarrage, où StrictMode ouvre puis referme une première session.
    const estCourante = () => wsRef.current === ws;

    ws.onmessage = async (evt) => {
      if (!estCourante()) return;
      const m = JSON.parse(evt.data);

      switch (m.type) {
        case 'pret': {
          setBudget(m.budget);
          try {
            const micro = new CaptureMicro(
              (pcm) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'audio', pcm })); },
              limiterCadence(setNiveauEntree),
            );
            await micro.demarrer();
            // L'autorisation micro peut prendre plusieurs secondes ; la session a
            // pu être fermée entre-temps. Sans ce contrôle, le micro resterait
            // ouvert sans propriétaire.
            if (!estCourante()) { micro.arreter(); return; }
            microRef.current = micro;
            // Le fondateur a pu couper le micro pendant que l'autorisation était
            // demandée : la nouvelle capture doit naître déjà muette, sinon elle
            // s'ouvre en grand pendant l'instant qui sépare ces deux lignes.
            if (micCoupeRef.current) {
              micro.couper(true);
              ws.send(JSON.stringify({ type: 'micro', coupe: true }));
            }
            setStatut('ecoute');

            // L'accueil est demandé APRÈS l'ouverture du micro : l'assistante
            // pose une question, elle doit pouvoir entendre la réponse. Demandé
            // avant, le début du « oui » tombait dans le vide.
            if (!accueilDejaJoue()) ws.send(JSON.stringify({ type: 'accueil' }));
          } catch {
            setErreur("Micro inaccessible. Autorisez l'accès au microphone puis réessayez.");
            setStatut('erreur');
            ws.close();
          }
          break;
        }

        case 'transcription_fondateur':
          // Micro coupé : ce fragment vient d'un audio parti AVANT le clic, que
          // le serveur n'a pas eu le temps d'intercepter. Il ne doit pas
          // s'inscrire au fil — sinon la coupure paraît sans effet.
          if (micCoupeRef.current) break;
          // Le fondateur reprend la parole : le tour de l'assistante est clos.
          cloreTourAssistant();
          if (m.partiel === false) finaliserTour('fondateur', m.texte);
          else ajouterFragment('fondateur', m.texte);
          break;

        case 'transcription_assistant':
          tourEnCoursRef.current.fondateur = null;
          if (m.partiel === false) { finaliserTour('assistant', m.texte); break; }
          ajouterFragment('assistant', m.texte);
          majStatut('parle');
          break;

        case 'requete':
          setRequetes((r) => [...r, m as RequeteVocale]);
          majStatut('reflexion');
          break;

        case 'audio':
          lecteur.enfiler(m.pcm);
          break;

        case 'graphique':
          setVisuel({ visualisation: m.visualisation, donnees: m.donnees });
          // Le modèle enchaîne souvent son commentaire dans la foulée : sans ce
          // maintien, la forme « construction » disparaîtrait avant d'être vue.
          finConstructionRef.current = performance.now() + MAINTIEN_CONSTRUCTION_MS;
          setStatut('construction');
          if (minuteurRef.current) clearTimeout(minuteurRef.current);
          minuteurRef.current = setTimeout(() => {
            finConstructionRef.current = 0;
            if (statutDiffereRef.current) {
              setStatut(statutDiffereRef.current);
              statutDiffereRef.current = null;
            }
          }, MAINTIEN_CONSTRUCTION_MS);
          break;

        case 'interrompu':
          // Coupe net ce qui était planifié : sans ça on entend la fin d'une
          // phrase que le modèle a lui-même abandonnée.
          lecteur.vider();
          cloreTourAssistant();
          majStatut('ecoute');
          break;

        case 'tour_termine':
          // Le modele a fini d'emettre, mais l'audio deja planifie continue de
          // jouer : la cloture est differee jusqu'a la derniere syllabe, sinon
          // le texte se completerait d'un coup avant la fin de la phrase.
          finEmissionRef.current = true;
          majStatut('ecoute');
          break;

        case 'forme':
          setForme(m.forme || 'sphere');
          break;

        case 'fiche':
          // Une fiche par personne : redemander la meme deux fois ne doit pas
          // empiler deux cadres identiques.
          setFiches((f) => (f.some((x) => x.id === m.fiche.id && x.categorie === m.fiche.categorie)
            ? f : [...f, m.fiche]));
          break;

        case 'debriefing':
          setDebriefing({ date: m.date, phrases: m.phrases, graphiques: m.graphiques });
          break;

        case 'fichier':
          // Un classeur annonce a l'oral sans bouton visible n'existe pas pour
          // le fondateur : il doit apparaitre dans le fil.
          setFichiers((f) => [...f, m as FichierAssistant]);
          break;

        case 'budget':
          setBudget(m.budget);
          break;

        case 'budget_depasse':
          setBudget(m.budget);
          setErreur(m.message);
          setStatut('erreur');
          break;

        case 'erreur':
          setErreur(m.message);
          setStatut('erreur');
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      if (!estCourante()) return;
      setErreur('La connexion vocale a échoué. Vérifiez que le serveur est démarré.');
      setStatut('erreur');
    };
    ws.onclose = () => {
      if (!estCourante()) return;
      wsRef.current = null;
      microRef.current?.arreter();
      microRef.current = null;
      setNiveauEntree(0);
      // Sans cette remise à zéro, le bouton restait figé sur « coupé » après une
      // reconnexion alors que le micro de la nouvelle session était bien ouvert.
      micCoupeRef.current = false;
      setMicCoupe(false);

      // Fermeture non demandée : c'est une panne, pas une fin de conversation.
      // Le dire, plutôt que de revenir à « Prêt » comme si de rien n'était.
      if (!fermetureVoulueRef.current) {
        setErreur('La connexion vocale a été interrompue. Reprenez avec « Réessayer ».');
        setStatut('erreur');
        return;
      }
      setStatut((s) => (s === 'erreur' ? s : 'inactif'));
    };
  }, [ajouterFragment, arreter, majStatut, cloreTourAssistant, finaliserTour]);

  /** Permet de poser une question au clavier sans couper la session vocale. */
  const envoyerTexte = useCallback((texte: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      tourEnCoursRef.current.fondateur = null;
      setTours((t) => [...t, { id: uid(), rôle: 'fondateur', texte }]);
      wsRef.current.send(JSON.stringify({ type: 'texte', texte }));
      setStatut('reflexion');
    }
  }, []);

  const reinitialiser = useCallback(() => {
    setTours([]);
    setRequetes([]);
    setVisuel(null);
    setFichiers([]);
    setDebriefing(null);
    setFiches([]);
    setForme('sphere');
    setErreur(null);
    tourEnCoursRef.current = { fondateur: null, assistant: null };
  }, []);

  // Une session laissée ouverte continue de consommer : on ferme au démontage.
  useEffect(() => () => arreter(), [arreter]);

  return {
    statut, erreur, tours, requetes, visuel, budget, fichiers, forme, debriefing, fiches,
    niveauEntree, niveauSortie, micCoupe, avancementRef,
    demarrer, arreter, envoyerTexte, reinitialiser, basculerMicro,
  };
}
