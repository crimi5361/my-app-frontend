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
}

export interface BudgetVocal {
  fcfa: number;
  budget_fcfa: number;
  restant_fcfa: number;
  pourcentage: number;
  appels: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);

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

  const wsRef = useRef<WebSocket | null>(null);
  const microRef = useRef<CaptureMicro | null>(null);
  const lecteurRef = useRef<LecteurAudio | null>(null);
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
      return [...precedents, { id, rôle, texte }];
    });
  }, []);

  const arreter = useCallback(() => {
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
    setNiveauEntree(0);
    setNiveauSortie(0);
    setMicCoupe(false);
  }, []);

  /** Coupe ou rétablit le micro sans interrompre la session en cours. */
  const basculerMicro = useCallback(() => {
    setMicCoupe((coupe) => {
      const suivant = !coupe;
      microRef.current?.couper(suivant);
      return suivant;
    });
  }, []);

  const demarrer = useCallback(async () => {
    // Deux sessions ouvertes en même temps, c'est deux fois le coût et deux voix
    // en écho. Le cas se produit en développement (StrictMode monte deux fois)
    // et sur un clic répété de « Réessayer ».
    if (wsRef.current || microRef.current) arreter();

    setErreur(null);
    setStatut('connexion');

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
            setStatut('ecoute');
          } catch {
            setErreur("Micro inaccessible. Autorisez l'accès au microphone puis réessayez.");
            setStatut('erreur');
            ws.close();
          }
          break;
        }

        case 'transcription_fondateur':
          // Le fondateur reprend la parole : le tour de l'assistant est clos.
          tourEnCoursRef.current.assistant = null;
          ajouterFragment('fondateur', m.texte);
          break;

        case 'transcription_assistant':
          tourEnCoursRef.current.fondateur = null;
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
          tourEnCoursRef.current.assistant = null;
          majStatut('ecoute');
          break;

        case 'tour_termine':
          tourEnCoursRef.current.assistant = null;
          majStatut('ecoute');
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
      setStatut((s) => (s === 'erreur' ? s : 'inactif'));
    };
  }, [ajouterFragment, arreter, majStatut]);

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
    setErreur(null);
    tourEnCoursRef.current = { fondateur: null, assistant: null };
  }, []);

  // Une session laissée ouverte continue de consommer : on ferme au démontage.
  useEffect(() => () => arreter(), [arreter]);

  return {
    statut, erreur, tours, requetes, visuel, budget, fichiers,
    niveauEntree, niveauSortie, micCoupe,
    demarrer, arreter, envoyerTexte, reinitialiser, basculerMicro,
  };
}
