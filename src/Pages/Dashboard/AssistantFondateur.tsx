import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, ArrowUp, Trash2, Plus, Menu, X, MoreHorizontal, AudioLines,
  FileSpreadsheet, FileText, Download, Loader2, CalendarCheck, Link2Off,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { apiFetch, ApiError } from '../../lib/api';
import { telechargerFichier, FichierAssistant } from '../../lib/assistantFichiers';
import { corrigerTranscription, CONFIG_VIDE, ConfigTranscription } from '../../lib/transcription';
import './AssistantFondateur.css';

// Chargé à la demande : l'écran vocal embarque three.js et ses shaders, inutiles
// tant que le fondateur écrit ses questions au clavier.
const ModeVocal = lazy(() => import('./ModeVocal'));

// Dictée vocale — Web Speech API du navigateur, 100% front-end.
interface SpeechRecognitionResultLike { 0: { transcript: string }; isFinal: boolean }
interface SpeechRecognitionEventLike { resultIndex: number; results: { length: number; [i: number]: SpeechRecognitionResultLike } }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
const getSpeechRecognitionCtor = (): SpeechRecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

// La spécification de graphique ne porte QUE des noms de colonnes — jamais de valeurs.
// Les chiffres affichés viennent de `donnees`, produit par le serveur à partir du SQL
// réellement exécuté : le modèle choisit quoi tracer, il ne peut pas inventer combien.
type TypeVisuel = 'barres' | 'lignes' | 'aire' | 'camembert' | 'barres_empilees';
interface SerieVisuel { colonne: string; libelle: string }
interface Visualisation {
  type: TypeVisuel;
  titre: string;
  axe_x: string;
  series: SerieVisuel[];
  format_valeur: 'nombre' | 'montant' | 'pourcentage';
}
type LigneDonnees = Record<string, string | number | null>;

/** Trace d'une requête exécutée — permet au fondateur de vérifier d'où sort un chiffre. */
interface RequeteTracee {
  intention: string | null;
  sql: string;
  ok: boolean;
  nb_lignes: number;
  duree_ms: number | null;
  motif: string | null;
}

interface AssistantDisplay {
  visualisation: Visualisation;
  donnees: LigneDonnees[];
}
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  display?: AssistantDisplay;
  requetes?: RequeteTracee[];
  fichiers?: FichierAssistant[];
}
interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  geminiHistory: unknown[];
  updatedAt: number;
}
interface AssistantChatResponse {
  success: boolean;
  message: string;
  visualisation: Visualisation | null;
  donnees: LigneDonnees[] | null;
  requetes: RequeteTracee[];
  fichiers?: FichierAssistant[];
  history: unknown[];
}

const STORAGE_KEY = 'fdt_assistant_conversations';

/** Civilités proposées. Liste fermée, identique à celle du serveur
 *  (services/assistantReglages.service.js) : la valeur est prononcée par
 *  l'assistante, elle ne peut pas être une saisie libre. */
const CIVILITES = [
  { valeur: 'Monsieur', libelle: 'Monsieur' },
  { valeur: 'Madame', libelle: 'Madame' },
  { valeur: '', libelle: 'Sans civilité' },
];

// Recharts ne lit pas les variables CSS : les couleurs des axes/grilles doivent être fournies en
// dur. L'or est volontairement assombri par rapport au jeton de marque, pour rester lisible sur
// fond clair (règle "accent adjusted for WCAG 3:1" de la base de design).
const CHART = {
  series: '#b8862b',
  // Palette multi-séries : l'or de marque en tête, puis des teintes distinctes
  // à luminosité proche pour rester lisibles côte à côte et en camembert.
  palette: ['#b8862b', '#3454a0', '#2f9166', '#a4515f', '#7b5fbe', '#2f7d8f', '#8a6d3b'],
  axis: '#5f6a80',
  grid: 'rgba(16,26,51,0.09)',
  panel: '#ffffff',
  panelBorder: 'rgba(16,26,51,0.12)',
  label: '#5f6a80',
  item: '#101a33',
  cursor: 'rgba(16,26,51,0.04)',
};

const SUGGESTIONS = [
  'Quelle est la situation financière du site ?',
  'Répartition des étudiants par école',
  'Combien de caisses sont ouvertes ?',
  "État du stock des accessoires",
  'Combien d\'inscriptions ce mois-ci ?',
  'Évolution des recettes sur l\'année',
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createConversation = (): Conversation => ({
  id: uid(),
  title: 'Nouvelle discussion',
  messages: [],
  geminiHistory: [],
  updatedAt: Date.now(),
});

const loadConversations = (): Conversation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // stockage local indisponible ou corrompu — on repart sur une discussion neuve
  }
  return [createConversation()];
};

const getUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Formatage des valeurs selon ce que la donnée représente réellement. */
const formatteurs = {
  montant: (v: number) =>
    Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)} Md`
      : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} M`
        : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)} k`
          : String(Math.round(v)),
  pourcentage: (v: number) => `${v.toFixed(1)} %`,
  nombre: (v: number) => v.toLocaleString('fr-FR'),
};

/**
 * Trace repliée des requêtes exécutées. Un chiffre affiché sans moyen de vérifier
 * d'où il sort n'est pas exploitable pour piloter : le fondateur doit pouvoir
 * remonter au SQL, surtout quand deux sources de données se ressemblent.
 */
const TraceRequetes = ({ requetes }: { requetes: RequeteTracee[] }) => {
  const [ouvert, setOuvert] = useState(false);
  const enErreur = requetes.filter((r) => !r.ok).length;

  return (
    <div className="afx-trace">
      <button type="button" className="afx-trace-toggle" onClick={() => setOuvert((v) => !v)}>
        {ouvert ? '▾' : '▸'} {requetes.length} requête{requetes.length > 1 ? 's' : ''} sur la base
        {enErreur > 0 && ` · ${enErreur} corrigée${enErreur > 1 ? 's' : ''}`}
      </button>
      {ouvert && (
        <div className="afx-trace-body">
          {requetes.map((r, i) => (
            <div key={i} className={`afx-trace-item${r.ok ? '' : ' afx-trace-item-erreur'}`}>
              {r.intention && <div className="afx-trace-intention">{r.intention}</div>}
              <pre className="afx-trace-sql">{r.sql}</pre>
              <div className="afx-trace-meta">
                {r.ok ? `${r.nb_lignes} ligne${r.nb_lignes > 1 ? 's' : ''}${r.duree_ms != null ? ` · ${r.duree_ms} ms` : ''}` : r.motif}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Fichiers produits par l'assistante. Le telechargement passe par fetch et non
 * par un lien direct : la route exige un JWT, qu'un <a href> ne transmettrait pas.
 */
const FichiersProduits = ({ fichiers }: { fichiers: FichierAssistant[] }) => {
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recuperer = async (f: FichierAssistant) => {
    setEnCours(f.id); setErreur(null);
    try { await telechargerFichier(f); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Telechargement impossible.'); }
    finally { setEnCours(null); }
  };

  return (
    <div className="afx-fichiers">
      {fichiers.map((f) => {
        const tableur = f.extension === 'xlsx';
        return (
          <button
            key={f.id}
            type="button"
            className="afx-fichier"
            onClick={() => recuperer(f)}
            disabled={enCours === f.id}
          >
            <span className={`afx-fichier-icone${tableur ? ' est-tableur' : ' est-document'}`}>
              {tableur ? <FileSpreadsheet size={17} /> : <FileText size={17} />}
            </span>
            <span className="afx-fichier-corps">
              <span className="afx-fichier-nom">{f.nom}</span>
              <span className="afx-fichier-meta">
                {tableur ? 'Classeur Excel' : 'Document Word'}
                {f.nb_lignes ? ` · ${f.nb_lignes} lignes` : ''}
              </span>
            </span>
            {enCours === f.id
              ? <Loader2 size={16} className="afx-fichier-attente" />
              : <Download size={16} />}
          </button>
        );
      })}
      {erreur && <div className="afx-fichier-erreur">{erreur}</div>}
    </div>
  );
};

const AssistantVisual = ({ display }: { display: AssistantDisplay }) => {
  const c = CHART;
  const { visualisation: v, donnees } = display;

  // PostgreSQL renvoie numeric/bigint en chaîne : sans conversion, Recharts
  // trace des barres vides sans rien signaler.
  const data = donnees.map((ligne) => {
    const point: Record<string, string | number> = { __x: String(ligne[v.axe_x] ?? '—') };
    v.series.forEach((s) => { point[s.colonne] = Number(ligne[s.colonne] ?? 0); });
    return point;
  });

  const formater = formatteurs[v.format_valeur] ?? formatteurs.nombre;
  const tooltipStyle = {
    contentStyle: { background: c.panel, border: `1px solid ${c.panelBorder}`, borderRadius: 10 },
    labelStyle: { color: c.label, fontSize: 12 },
    itemStyle: { color: c.item, fontSize: 12.5 },
    formatter: (valeur: number) => formater(valeur),
  };
  const axeX = (
    <XAxis
      dataKey="__x"
      tick={{ fontSize: 10, fill: c.axis }}
      interval={0}
      angle={data.length > 4 ? -20 : 0}
      textAnchor={data.length > 4 ? 'end' : 'middle'}
      height={data.length > 4 ? 58 : 30}
      axisLine={{ stroke: c.grid }}
      tickLine={false}
    />
  );
  const axeY = (
    <YAxis tick={{ fontSize: 11, fill: c.axis }} axisLine={false} tickLine={false} tickFormatter={formater} width={62} />
  );
  const grille = <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />;
  const legende = v.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null;

  const rendu = () => {
    switch (v.type) {
      case 'camembert':
        return (
          <PieChart>
            <Tooltip {...tooltipStyle} />
            <Pie data={data} dataKey={v.series[0].colonne} nameKey="__x" outerRadius={95} label={false}>
              {data.map((_, i) => <Cell key={i} fill={CHART.palette[i % CHART.palette.length]} />)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        );
      case 'lignes':
        return (
          <LineChart data={data}>
            {grille}{axeX}{axeY}
            <Tooltip {...tooltipStyle} cursor={{ stroke: c.grid }} />{legende}
            {v.series.map((s, i) => (
              <Line key={s.colonne} type="monotone" dataKey={s.colonne} name={s.libelle}
                stroke={CHART.palette[i % CHART.palette.length]} strokeWidth={2.5}
                dot={{ r: 3, fill: CHART.palette[i % CHART.palette.length] }} />
            ))}
          </LineChart>
        );
      case 'aire':
        return (
          <AreaChart data={data}>
            {grille}{axeX}{axeY}
            <Tooltip {...tooltipStyle} cursor={{ stroke: c.grid }} />{legende}
            {v.series.map((s, i) => (
              <Area key={s.colonne} type="monotone" dataKey={s.colonne} name={s.libelle}
                stroke={CHART.palette[i % CHART.palette.length]}
                fill={CHART.palette[i % CHART.palette.length]} fillOpacity={0.18} strokeWidth={2.5} />
            ))}
          </AreaChart>
        );
      default: // barres | barres_empilees
        return (
          <BarChart data={data}>
            {grille}{axeX}{axeY}
            <Tooltip {...tooltipStyle} cursor={{ fill: c.cursor }} />{legende}
            {v.series.map((s, i) => (
              <Bar key={s.colonne} dataKey={s.colonne} name={s.libelle}
                stackId={v.type === 'barres_empilees' ? 'pile' : undefined}
                fill={CHART.palette[i % CHART.palette.length]}
                radius={v.type === 'barres_empilees' ? undefined : [6, 6, 0, 0]} />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <div className="afx-visual">
      <div className="afx-visual-title">{v.titre}</div>
      <ResponsiveContainer width="100%" height={280}>{rendu()}</ResponsiveContainer>
    </div>
  );
};

const AssistantFondateur = () => {
  const user = useMemo(getUser, []);

  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [allChips, setAllChips] = useState(false);
  const [listening, setListening] = useState(false);
  const [vocalOuvert, setVocalOuvert] = useState(false);
  // Rattachement du compte Google du fondateur : sans lui, l'assistante ne peut
  // ni consulter l'agenda, ni programmer de Meet, ni toucher a la messagerie.
  const [google, setGoogle] = useState<{ configure: boolean; connecte: boolean; email?: string } | null>(null);
  // Prénom donné à l'assistante. Il est propre au site : sur un même site, tous
  // les agents doivent la voir porter le même nom.
  const [nomAssistante, setNomAssistante] = useState('');
  const [nomEnregistre, setNomEnregistre] = useState('');
  const [msgNom, setMsgNom] = useState<string | null>(null);
  const [rechercheWeb, setRechercheWeb] = useState(false);
  // Civilité employée à l'accueil. Réglage de SITE et non de personne : la table
  // utilisateur ne porte aucun genre — voir migration 2026-08-14_assistant_civilite.
  const [civilite, setCivilite] = useState('Monsieur');
  const [point, setPoint] = useState<{ phrases: string[]; alertes: string[]; fenetre_jours: number } | null>(null);
  const [speechSupported] = useState(() => Boolean(getSpeechRecognitionCtor()));
  // Dictée en cours, pas encore arrêtée par la reconnaissance. Volontairement
  // HORS du champ de saisie : un texte qui se réécrit sous les doigts empêche de
  // corriger quoi que ce soit, et rien ne distingue le provisoire du définitif.
  const [dicteeProvisoire, setDicteeProvisoire] = useState('');
  const [erreurDictee, setErreurDictee] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef('');
  const finalTranscriptRef = useRef('');
  // Sigles et corrections, servis par le serveur : mêmes données que le mode
  // vocal. Absents, la dictée fonctionne — simplement sans correction.
  const configDicteeRef = useRef<ConfigTranscription>(CONFIG_VIDE);

  const activeConversation = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation]);
  const sortedConversations = useMemo(() => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt), [conversations]);
  const isWelcome = messages.length === 0;

  const firstName = (user?.nom || '').split(' ')[0] || '';

  useEffect(() => {
    apiFetch<{ reglages: { nom_assistant: string | null; recherche_web: boolean; civilite?: string } }>('/api/assistant/reglages')
      .then((r) => {
        setNomAssistante(r.reglages.nom_assistant || '');
        setNomEnregistre(r.reglages.nom_assistant || '');
        setRechercheWeb(!!r.reglages.recherche_web);
        setCivilite(r.reglages.civilite ?? 'Monsieur');
      })
      .catch(() => { /* l'assistante reste utilisable sans prénom */ });

    apiFetch<{ point: { ok: boolean; phrases: string[]; alertes: string[]; fenetre_jours: number } }>(
      '/api/assistant/point-du-jour',
    )
      .then((r) => { if (r.point?.ok) setPoint(r.point); })
      .catch(() => { /* un point du jour absent n'empêche rien */ });

    apiFetch<{ google: { configure: boolean; connecte: boolean; email?: string } }>('/api/assistant/google/statut')
      .then((r) => setGoogle(r.google))
      .catch(() => setGoogle(null));   // l'assistante reste utilisable sans Google
  }, []);

  const enregistrerNom = async () => {
    setMsgNom(null);
    try {
      const r = await apiFetch<{ reglages: { nom_assistant: string | null }; message?: string }>(
        '/api/assistant/reglages',
        { method: 'PUT', body: JSON.stringify({ nom_assistant: nomAssistante }) },
      );
      const retenu = r.reglages.nom_assistant || '';
      setNomAssistante(retenu);
      setNomEnregistre(retenu);
      setMsgNom(r.message || (retenu ? `Elle répondra désormais au nom de ${retenu}.` : 'Prénom retiré.'));
    } catch (e) {
      setMsgNom(e instanceof ApiError ? e.message : "Enregistrement impossible.");
    }
  };

  const enregistrerCivilite = async (valeur: string) => {
    const precedent = civilite;
    setCivilite(valeur);
    try {
      await apiFetch('/api/assistant/reglages', {
        method: 'PUT', body: JSON.stringify({ civilite: valeur }),
      });
    } catch {
      setCivilite(precedent);   // le serveur n'a pas suivi : on revient en arrière
    }
  };

  const basculerWeb = async () => {
    const suivant = !rechercheWeb;
    setRechercheWeb(suivant);
    try {
      await apiFetch('/api/assistant/reglages', {
        method: 'PUT', body: JSON.stringify({ recherche_web: suivant }),
      });
    } catch {
      setRechercheWeb(!suivant);   // le serveur n'a pas suivi : on revient en arrière
    }
  };

  const connecterGoogle = async () => {
    try {
      const r = await apiFetch<{ url: string }>('/api/assistant/google/connexion', { method: 'POST' });
      // Nouvel onglet plutot que redirection : la conversation en cours survit.
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Connexion Google impossible.");
    }
  };

  const deconnecterGoogle = async () => {
    await apiFetch('/api/assistant/google/deconnexion', { method: 'DELETE' }).catch(() => {});
    setGoogle((g) => (g ? { ...g, connecte: false, email: undefined } : g));
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }, [input, isWelcome]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); } catch { /* stockage indisponible */ }
  }, [conversations]);

  useEffect(() => {
    /* la voix vit desormais en base, pas dans le navigateur */
  }, []);

  useEffect(() => {
    if (!conversations.some((c) => c.id === activeId)) {
      setActiveId(conversations[0]?.id ?? '');
    }
  }, [conversations, activeId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Sigles et corrections de dictée. Un échec ici est sans gravité : la dictée
  // marche, le texte est simplement moins bien mis en forme.
  useEffect(() => {
    apiFetch<ConfigTranscription>('/api/assistant/vocabulaire')
      .then((r) => { configDicteeRef.current = r; })
      .catch(() => { /* on garde CONFIG_VIDE */ });
  }, []);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onend = () => { setListening(false); setDicteeProvisoire(''); };
    recognition.onerror = () => {
      setListening(false);
      setDicteeProvisoire('');
      // Un échec muet laissait le fondateur parler dans le vide, bouton allumé.
      setErreurDictee("La dictée s'est interrompue. Vérifiez le micro, puis reprenez.");
    };
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) { recognition.stop(); return; }

    baseTextRef.current = input.trim();
    finalTranscriptRef.current = '';
    setErreurDictee(null);
    setDicteeProvisoire('');

    recognition.onresult = (event) => {
      let provisoire = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const morceau = event.results[i][0].transcript;
        // La correction ne s'applique qu'aux résultats DÉFINITIFS : sur un
        // résultat provisoire, la majuscule et le point sauteraient à chaque
        // mot ajouté, et le texte clignoterait.
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += `${corrigerTranscription(morceau, configDicteeRef.current)} `;
        } else {
          provisoire += morceau;
        }
      }
      // Seul le définitif entre dans le champ de saisie : le fondateur peut donc
      // corriger au clavier sans être écrasé par la phrase suivante.
      const acquis = finalTranscriptRef.current.trim();
      setInput(baseTextRef.current && acquis ? `${baseTextRef.current} ${acquis}` : (acquis || baseTextRef.current));
      setDicteeProvisoire(provisoire.trim());
    };

    recognition.start();
    setListening(true);
  };

  const appendUserMessage = (text: string) => {
    setConversations((convs) => convs.map((c) => {
      if (c.id !== activeId) return c;
      return {
        ...c,
        messages: [...c.messages, { id: uid(), role: 'user' as const, text }],
        title: c.messages.length === 0 ? text.slice(0, 42) : c.title,
        updatedAt: Date.now(),
      };
    }));
  };

  const appendAssistantMessage = (
    text: string,
    display: AssistantDisplay | undefined,
    history: unknown[],
    requetes?: RequeteTracee[],
    fichiers?: FichierAssistant[],
  ) => {
    setConversations((convs) => convs.map((c) => (
      c.id === activeId
        ? {
            ...c,
            messages: [...c.messages, { id: uid(), role: 'assistant' as const, text, display, requetes, fichiers }],
            geminiHistory: history,
            updatedAt: Date.now(),
          }
        : c
    )));
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || typing) return;
    const historyForRequest = activeConversation?.geminiHistory ?? [];
    appendUserMessage(text);
    setInput('');
    setTyping(true);

    try {
      const res = await apiFetch<AssistantChatResponse>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history: historyForRequest }),
      });
      // Le graphique n'est monté que si le serveur a fourni ET la spécification
      // ET les lignes correspondantes : jamais l'une sans l'autre.
      const display: AssistantDisplay | undefined = res.visualisation && res.donnees?.length
        ? { visualisation: res.visualisation, donnees: res.donnees }
        : undefined;
      appendAssistantMessage(res.message, display, res.history, res.requetes, res.fichiers);
    } catch (e) {
      const errText = e instanceof ApiError ? e.message : "Une erreur est survenue en contactant l'assistant. Réessayez.";
      appendAssistantMessage(errText, undefined, historyForRequest);
    } finally {
      setTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const newConversation = () => {
    const conv = createConversation();
    setConversations((convs) => [conv, ...convs]);
    setActiveId(conv.id);
    setDrawerOpen(false);
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((convs) => {
      const next = convs.filter((c) => c.id !== id);
      return next.length > 0 ? next : [createConversation()];
    });
  };

  const composer = (
    <div className="afx-composer">
      {/* Ce que la reconnaissance entend sans l'avoir encore arrêté. En gris et
          en italique, hors du champ : c'est provisoire, ça ne se corrige pas au
          clavier, et ça disparaîtra dès que le texte définitif sera connu. */}
      {dicteeProvisoire && (
        <div className="afx-dictee-provisoire" aria-live="polite">{dicteeProvisoire}</div>
      )}
      {erreurDictee && (
        <div className="afx-dictee-erreur" role="alert">{erreurDictee}</div>
      )}
      <div className={`afx-inputcard${listening ? ' is-recording' : ''}`}>
        <textarea
          ref={inputRef}
          className="afx-input"
          placeholder="Posez votre question sur vos données…"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="afx-input-actions">
          <div className="afx-input-left">
            <button
              type="button"
              className={`afx-tool-btn${listening ? ' is-listening' : ''}`}
              disabled={!speechSupported}
              title={speechSupported ? (listening ? 'Arrêter la dictée' : 'Dicter votre question') : 'Dictée non prise en charge par ce navigateur'}
              aria-label={listening ? 'Arrêter la dictée' : 'Dicter votre question'}
              onClick={toggleListening}
            >
              <Mic size={17} />
            </button>
          </div>
          <div className="afx-input-right">
            <button
              type="button"
              className="afx-send"
              disabled={!input.trim() || typing}
              onClick={() => send()}
              aria-label="Envoyer"
            >
              <ArrowUp size={17} />
            </button>
            {/* Conversation de vive voix — session séparée du fil écrit : elle
                consomme du budget audio et doit rester un geste délibéré. */}
            <button
              type="button"
              className="afx-vocal-btn"
              title="Parler à l'assistant"
              aria-label="Ouvrir le mode vocal"
              onClick={() => setVocalOuvert(true)}
            >
              <AudioLines size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const visibleChips = allChips ? SUGGESTIONS : SUGGESTIONS.slice(0, 3);

  return (
    <div className="afx-root">
      {drawerOpen && (
        <>
          <div className="afx-scrim" onClick={() => setDrawerOpen(false)} />
          <aside className="afx-drawer">
            <div className="afx-drawer-head">
              <span className="afx-drawer-title">Discussions</span>
              <button type="button" className="afx-iconbtn" aria-label="Fermer le menu" onClick={() => setDrawerOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="afx-drawer-new">
              <button type="button" className="afx-new-chat" onClick={newConversation}>
                <Plus size={15} /> Nouvelle discussion
              </button>
            </div>
            <div className="afx-drawer-list">
              {sortedConversations.map((c) => (
                <div key={c.id} className={`afx-conv${c.id === activeId ? ' active' : ''}`}>
                  <button type="button" className="afx-conv-open" onClick={() => { setActiveId(c.id); setDrawerOpen(false); }}>
                    {c.title}
                  </button>
                  <button type="button" className="afx-conv-del" aria-label="Supprimer cette discussion" onClick={(e) => deleteConversation(c.id, e)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Réglages en pied de panneau — l'ancienne pastille utilisateur du bandeau faisait
                doublon avec celle du header de l'application, mais elle portait ces réglages. */}
            <div className="afx-drawer-foot">
              <div>
                <span className="afx-set-label">Son prénom</span>
                <div className="afx-set-nom">
                  <input
                    className="afx-set-input"
                    value={nomAssistante}
                    onChange={(e) => { setNomAssistante(e.target.value); setMsgNom(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') enregistrerNom(); }}
                    placeholder="Aïcha, Sarah…"
                    maxLength={24}
                    aria-label="Prénom de l'assistante"
                  />
                  <button
                    type="button"
                    onClick={enregistrerNom}
                    disabled={nomAssistante.trim() === nomEnregistre.trim()}
                  >
                    Valider
                  </button>
                </div>
                {msgNom && <div className="afx-set-aide">{msgNom}</div>}
              </div>
              {google?.configure && (
                <div>
                  <span className="afx-set-label">Agenda et messagerie</span>
                  {google.connecte ? (
                    <div className="afx-google est-connecte">
                      <CalendarCheck size={15} />
                      <span className="afx-google-mail">{google.email}</span>
                      <button type="button" onClick={deconnecterGoogle} title="Deconnecter ce compte">
                        <Link2Off size={14} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="afx-google-connecter" onClick={connecterGoogle}>
                      <CalendarCheck size={15} /> Connecter Google
                    </button>
                  )}
                </div>
              )}

              <div>
                <span className="afx-set-label">Recherche sur internet</span>
                <button
                  type="button"
                  className={`afx-bascule${rechercheWeb ? ' est-active' : ''}`}
                  onClick={basculerWeb}
                  role="switch"
                  aria-checked={rechercheWeb}
                >
                  <span className="afx-bascule-piste"><span className="afx-bascule-pastille" /></span>
                  <span>{rechercheWeb ? 'Autorisée' : 'Désactivée'}</span>
                </button>
                <div className="afx-set-aide">
                  Lui permet de consulter le web quand la réponse n'est pas dans vos
                  données. Elle précise toujours ce qui vient du web.
                </div>
              </div>

              {/* La table des utilisateurs ne porte aucun genre : sans ce
                  réglage, il faudrait écrire « Monsieur » en dur et redéployer
                  le jour où une femme occupe le poste. */}
              <div>
                <span className="afx-set-label">Comment elle vous salue</span>
                <div className="afx-set-civilites">
                  {CIVILITES.map((c) => (
                    <button
                      key={c.valeur}
                      type="button"
                      className={`afx-set-civilite${civilite === c.valeur ? ' est-active' : ''}`}
                      onClick={() => enregistrerCivilite(c.valeur)}
                      aria-pressed={civilite === c.valeur}
                    >
                      {c.libelle}
                    </button>
                  ))}
                </div>
                <div className="afx-set-aide">
                  « Bonjour{civilite ? ` ${civilite}` : ''}
                  {firstName ? ` ${firstName}` : ''}, j'espère que vous allez bien. »
                  Votre nom est lu dans la base à chaque ouverture.
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      <div className={`afx-stage${typing ? ' is-thinking' : ''}`}>
        <div className="afx-aurora afx-aurora-idle">
          <span className="afx-glow g1" />
          <span className="afx-glow g2" />
          <span className="afx-glow g3" />
        </div>
        <div className="afx-aurora afx-aurora-think">
          <span className="afx-glow g1" />
          <span className="afx-glow g2" />
          <span className="afx-glow g3" />
        </div>

        <header className="afx-topbar">
          <button
            type="button"
            className={`afx-iconbtn afx-menu-btn${drawerOpen ? ' active' : ''}`}
            title="Discussions"
            aria-label="Ouvrir le menu des discussions"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <Menu size={19} />
          </button>
        </header>

        <div className="afx-body">
          {isWelcome ? (
            <div className="afx-welcome">
              <div className="afx-hero-mark">
                <img src="/logo.png" alt="" />
              </div>
              <p className="afx-hero-eyebrow">{firstName ? `Bonjour ${firstName},` : 'Bonjour,'}</p>
              <h1 className="afx-hero-title">Sur quoi travaillons-nous aujourd'hui ?</h1>

              {point && (point.phrases.length > 0 || point.alertes.length > 0) && (
                <motion.div
                  className="afx-point"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  {point.phrases.length > 0 && (
                    <span className="afx-point-fait">
                      Ces {point.fenetre_jours} derniers jours : {point.phrases.join(', ')}.
                    </span>
                  )}
                  {point.alertes.map((a) => (
                    <span key={a} className="afx-point-alerte">{a}</span>
                  ))}
                </motion.div>
              )}

              {composer}

              <div className="afx-chips">
                {visibleChips.map((s) => (
                  <button key={s} type="button" className="afx-chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
                {!allChips && (
                  <button type="button" className="afx-chip afx-chip-more" aria-label="Voir plus de suggestions" onClick={() => setAllChips(true)}>
                    <MoreHorizontal size={15} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="afx-thread" ref={threadRef}>
              <div className="afx-thread-inner">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    className={`afx-msg afx-msg-${m.role}${m.display ? ' afx-msg-wide' : ''}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="afx-msg-text">{m.text}</div>
                    {m.display && <AssistantVisual display={m.display} />}
                    {m.fichiers && m.fichiers.length > 0 && <FichiersProduits fichiers={m.fichiers} />}
                    {m.requetes && m.requetes.length > 0 && <TraceRequetes requetes={m.requetes} />}
                  </motion.div>
                ))}
                {typing && <div className="afx-typing"><span /><span /><span /></div>}
              </div>
            </div>
          )}
        </div>

        {!isWelcome && (
          <div className="afx-composer-dock">
            {composer}
          </div>
        )}
      </div>

      <AnimatePresence>
        {vocalOuvert && (
          <Suspense fallback={<div className="afx-vocal-chargement">Préparation du mode vocal…</div>}>
            <ModeVocal onFermer={() => setVocalOuvert(false)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssistantFondateur;
