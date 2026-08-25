/* eslint-disable @typescript-eslint/no-explicit-any */
// Assistant Fondateur — écran de conversation vocale (2026-08-12).
//
// Plein écran volontairement : parler à une machine devant un tableau de bord
// chargé est déroutant. Ici, une seule chose se passe, et l'orbe central dit
// en permanence où on en est — écoute, recherche, réponse.
import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mic, MicOff, Database, BarChart3, Volume2, Loader2, AlertTriangle,
  FileSpreadsheet, FileText, Download, CalendarClock, ArrowRightCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { StatutVocal } from '../../lib/useAssistantVocal';
import { useVocal, SessionVocale } from '../../lib/ContexteVocal';
import Modale from './Modale';
import BlobVocal, { NomForme } from './BlobVocal';
import FichePersonne from './FichePersonne';
import { telechargerFichier, FichierAssistant } from '../../lib/assistantFichiers';
import './ModeVocal.css';

// Palette relevée pour le fond sombre. Recharts ne lit pas les variables CSS :
// toutes ces couleurs doivent être fournies en dur, et celles du thème clair
// disparaissaient sur #050a14.
const PALETTE = ['#4fd8ff', '#ffb454', '#6ee7b7', '#b48cff', '#ff8a9b', '#7fd4c1', '#ffd48a'];
const AXE_SOMBRE = '#6f8299';
const GRILLE_SOMBRE = 'rgba(255,255,255,0.09)';

// Chaque état a sa couleur et son libellé : c'est le seul retour visuel dont
// dispose quelqu'un qui parle sans regarder l'écran de près.
// Teintes relevées pour le fond sombre : les couleurs du thème clair — or #a97723,
// bleu #1e4d82 — y devenaient illisibles. Elles restent accordées à la sphère 3D,
// dont les couleurs d'état n'ont pas bougé.
const ETATS: Record<StatutVocal, { libelle: string; teinte: string; icone: any }> = {
  inactif:   { libelle: 'En veille',           teinte: '#6f8299', icone: Mic },
  connexion: { libelle: 'Liaison en cours',    teinte: '#8fa3ba', icone: Loader2 },
  ecoute:    { libelle: 'À votre écoute',      teinte: '#ffb454', icone: Mic },
  reflexion: { libelle: 'Lecture de la base',  teinte: '#4fd8ff', icone: Database },
  construction: { libelle: 'Assemblage du visuel', teinte: '#b48cff', icone: BarChart3 },
  parle:     { libelle: 'Transmission',        teinte: '#6ee7b7', icone: Volume2 },
  erreur:    { libelle: 'Liaison interrompue', teinte: '#ff8a75', icone: AlertTriangle },
};

const formatteurs = {
  montant: (v: number) =>
    Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)} Md`
      : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)} M`
        : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)} k` : String(Math.round(v)),
  pourcentage: (v: number) => `${v.toFixed(1)} %`,
  nombre: (v: number) => v.toLocaleString('fr-FR'),
};

// ───────────────────────────────────────────────────────────────────────────
//  L'orbe : cœur visuel de l'écran
// ───────────────────────────────────────────────────────────────────────────
type Etat = { libelle: string; teinte: string; icone: any };

const Orbe = ({ statut, forme, etat }: { statut: StatutVocal; forme: NomForme; etat: Etat }) => {
  return (
    <div className="mv-orbe-zone">
      {/* Réticule : ce qui transforme une sphère qui flotte en une cible suivie
          par un instrument. Purement décoratif, donc masqué aux lecteurs
          d'écran. */}
      <span className="mv-reticule anneau-2" aria-hidden="true" />
      <span className="mv-reticule graduations" aria-hidden="true" />
      <span className="mv-reticule anneau-1" aria-hidden="true" />
      {/* La forme EST l'orbe : cylindre à bourrelets quand le modèle interroge la
          base, histogramme en gradins quand il assemble un graphique, sphère le
          reste du temps — la couleur suivant l'état dans tous les cas. */}
      <BlobVocal statut={statut} forme={forme} />

      {/* Icone d'etat au centre. Blanche et non teintee : elle se detache du
          coeur sombre quelle que soit la couleur de l'etat en cours. */}
      <div className="mv-icone">
        <AnimatePresence mode="wait">
          <motion.div
            key={etat.libelle}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            <etat.icone
              size={34}
              strokeWidth={1.7}
              color="#ffffff"
              className={statut === 'connexion' ? 'mv-tourne' : ''}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
//  Texte devoile au rythme de la voix
// ───────────────────────────────────────────────────────────────────────────

/**
 * Affiche le texte au fur et a mesure qu'il est prononce.
 *
 * Le decoupage se fait par MOT et non par caractere : une coupure au milieu d'un
 * mot se lit comme une faute de frappe, et le mot a moitie forme saute a la ligne
 * des qu'il s'allonge, ce qui fait tressauter tout le paragraphe.
 */
/**
 * Texte revele au rythme de la voix.
 *
 * Tous les mots sont rendus des le depart et ne bougent plus : ce qui change,
 * c'est une seule variable CSS `--p` ecrite sur le conteneur a chaque image.
 * Chaque mot en deduit lui-meme son opacite et sa position, ce qui produit une
 * onde continue plutot qu'une succession d'apparitions.
 *
 * C'est la difference entre les deux approches qui fait toute la fluidite : en
 * montant les mots un par un, le navigateur relayoute le paragraphe a chaque
 * ajout et React re-rend le fil, d'ou l'effet saccade. Ici rien n'est monte ni
 * demonte pendant la parole, et aucun rendu React n'a lieu.
 */
const TexteParle = ({
  texte, enCours, avancementRef,
}: {
  texte: string;
  enCours: boolean;
  avancementRef: React.RefObject<number>;
}) => {
  const hote = useRef<HTMLSpanElement>(null);
  const morceaux = useMemo(() => texte.split(/(\s+)/), [texte]);
  const total = useMemo(() => morceaux.filter((m) => m.trim()).length, [morceaux]);

  useEffect(() => {
    const el = hote.current;
    if (!el) return undefined;

    // Tour clos : tout est allume, plus rien a animer.
    if (!enCours) {
      el.style.setProperty('--p', String(total + 6));
      return undefined;
    }

    let image = 0;
    const boucle = () => {
      // Le +0.6 fait devancer legerement la voix : un mot pleinement lisible au
      // moment ou il est prononce se lit mieux qu'un mot qui s'allume apres.
      el.style.setProperty('--p', ((avancementRef.current || 0) * total + 0.6).toFixed(2));
      image = requestAnimationFrame(boucle);
    };
    image = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(image);
  }, [enCours, total, avancementRef]);

  let indice = -1;
  return (
    <span ref={hote} className="mv-flux">
      {morceaux.map((m, i) => {
        if (!m.trim()) return <span key={i}>{m}</span>;
        indice += 1;
        return (
          <span key={i} className="mv-mot" style={{ '--i': indice } as React.CSSProperties}>
            {m}
          </span>
        );
      })}
      {enCours && <span className="mv-curseur" />}
    </span>
  );
};


// ───────────────────────────────────────────────────────────────────────────
//  Fichiers annonces a l'oral
// ───────────────────────────────────────────────────────────────────────────
const FichierVocal = ({ fichier }: { fichier: FichierAssistant }) => {
  const tableur = fichier.extension === 'xlsx';
  return (
    <motion.button
      type="button"
      className="mv-fichier"
      onClick={() => { telechargerFichier(fichier).catch(() => { /* signale a l'oral */ }); }}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
    >
      <span className={`mv-fichier-icone${tableur ? ' est-tableur' : ' est-document'}`}>
        {tableur ? <FileSpreadsheet size={19} /> : <FileText size={19} />}
      </span>
      <span className="mv-fichier-corps">
        <span className="mv-fichier-nom">{fichier.nom}</span>
        <span className="mv-fichier-meta">
          {tableur ? 'Classeur Excel' : 'Document Word'}
          {fichier.nb_lignes ? ` · ${fichier.nb_lignes} lignes` : ''}
        </span>
      </span>
      <Download size={17} />
    </motion.button>
  );
};


// ───────────────────────────────────────────────────────────────────────────
//  Graphique poussé en direct par le modèle
// ───────────────────────────────────────────────────────────────────────────
type Visuel = NonNullable<SessionVocale['visuel']>;

/**
 * Un graphique, en modale ou en ligne.
 *
 * EN MODALE quand le fondateur en demande un : c'est l'objet de sa question, il
 * mérite tout l'écran. Dans le fil, il était contraint à 720 px de large sous la
 * conversation, et un classement de trente-trois agents y devenait illisible.
 *
 * EN LIGNE pour le débriefing, qui en pousse plusieurs d'affilée : les empiler
 * en modales obligerait à les fermer un par un. `onFermer` absent = en ligne.
 */
const GraphiqueVocal = ({ visuel, onFermer }: { visuel: Visuel; onFermer?: () => void }) => {
  const { visualisation: v, donnees } = visuel;

  // PostgreSQL renvoie numeric/bigint en chaîne : sans conversion, Recharts
  // trace des barres vides sans le signaler.
  const data = useMemo(() => donnees.map((l) => {
    const p: Record<string, string | number> = { __x: String(l[v.axe_x] ?? '—') };
    v.series.forEach((s) => { p[s.colonne] = Number(l[s.colonne] ?? 0); });
    return p;
  }), [donnees, v]);

  /**
   * BARRES HORIZONTALES dès que les libellés ne tiennent pas.
   *
   * En vertical, Recharts incline les étiquettes à -20° et les tronque : sur un
   * classement d'agents — « MOULHYIDINE OUSMANE SALAH », « Syanou Kablan Amed » —
   * elles se chevauchaient et devenaient illisibles. Constaté en démonstration.
   *
   * À l'horizontale, chaque libellé occupe sa propre ligne et se lit sans
   * rotation. Le seuil combine le NOMBRE de catégories et la LONGUEUR des
   * libellés : six catégories courtes tiennent très bien en vertical, quatre
   * noms complets non.
   */
  const libelleLePlusLong = useMemo(
    () => data.reduce((m, l) => Math.max(m, String(l.__x).length), 0),
    [data],
  );
  const horizontal = v.type === 'barres'
    && (data.length > 6 || libelleLePlusLong > 14);

  // Une ligne par catégorie, plus la place des axes et du titre. Borné pour que
  // le panneau reste dans l'écran : au-delà, c'est le panneau qui défile.
  const hauteur = horizontal
    ? Math.min(Math.max(data.length * 30 + 80, 300), 1400)
    : 420;

  const formater = formatteurs[v.format_valeur] ?? formatteurs.nombre;
  const tooltip = {
    contentStyle: {
      background: '#0a1424', border: '1px solid rgba(79,216,255,0.32)', borderRadius: 4,
      boxShadow: '0 12px 32px -12px rgba(0,0,0,.8)',
    },
    labelStyle: { color: AXE_SOMBRE, fontSize: 11 },
    itemStyle: { color: '#dce9f7', fontSize: 12.5 },
    formatter: (val: number) => formater(val),
  };
  const axeX = (
    <XAxis dataKey="__x" tick={{ fontSize: 10, fill: AXE_SOMBRE }} interval={0}
      angle={data.length > 4 ? -20 : 0} textAnchor={data.length > 4 ? 'end' : 'middle'}
      height={data.length > 4 ? 56 : 28} axisLine={{ stroke: GRILLE_SOMBRE }} tickLine={false} />
  );
  const axeY = (
    <YAxis tick={{ fontSize: 11, fill: AXE_SOMBRE }} axisLine={false} tickLine={false}
      tickFormatter={formater} width={60} />
  );
  const grille = <CartesianGrid strokeDasharray="3 3" stroke={GRILLE_SOMBRE} vertical={false} />;
  const legende = v.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: AXE_SOMBRE }} /> : null;

  const rendu = () => {
    switch (v.type) {
      case 'camembert':
        return (
          <PieChart>
            <Tooltip {...tooltip} />
            <Pie data={data} dataKey={v.series[0].colonne} nameKey="__x" outerRadius={92}
              animationDuration={900}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 12, color: AXE_SOMBRE }} />
          </PieChart>
        );
      case 'lignes':
        return (
          <LineChart data={data}>
            {grille}{axeX}{axeY}<Tooltip {...tooltip} />{legende}
            {v.series.map((s, i) => (
              <Line key={s.colonne} type="monotone" dataKey={s.colonne} name={s.libelle}
                stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.6}
                dot={{ r: 3, fill: PALETTE[i % PALETTE.length] }} animationDuration={900} />
            ))}
          </LineChart>
        );
      case 'aire':
        return (
          <AreaChart data={data}>
            {grille}{axeX}{axeY}<Tooltip {...tooltip} />{legende}
            {v.series.map((s, i) => (
              <Area key={s.colonne} type="monotone" dataKey={s.colonne} name={s.libelle}
                stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]}
                fillOpacity={0.2} strokeWidth={2.6} animationDuration={900} />
            ))}
          </AreaChart>
        );
      default:
        if (horizontal) {
          return (
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRILLE_SOMBRE} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: AXE_SOMBRE }}
                tickFormatter={formater} axisLine={false} tickLine={false} />
              {/* `width` généreux : c'est lui qui donne sa place au libellé.
                  Calculé sur le plus long, borné pour ne pas manger le graphe. */}
              <YAxis type="category" dataKey="__x" tick={{ fontSize: 11.5, fill: AXE_SOMBRE }}
                width={Math.min(Math.max(libelleLePlusLong * 7.2, 90), 260)}
                interval={0} axisLine={false} tickLine={false} />
              <Tooltip {...tooltip} cursor={{ fill: 'rgba(255,255,255,.05)' }} />{legende}
              {v.series.map((s2, i) => (
                <Bar key={s2.colonne} dataKey={s2.colonne} name={s2.libelle}
                  stackId={v.type === 'barres_empilees' ? 'pile' : undefined}
                  fill={PALETTE[i % PALETTE.length]} radius={[0, 5, 5, 0]}
                  animationDuration={900} />
              ))}
            </BarChart>
          );
        }
        return (
          <BarChart data={data}>
            {grille}{axeX}{axeY}<Tooltip {...tooltip} cursor={{ fill: 'rgba(255,255,255,.05)' }} />{legende}
            {v.series.map((s, i) => (
              <Bar key={s.colonne} dataKey={s.colonne} name={s.libelle}
                stackId={v.type === 'barres_empilees' ? 'pile' : undefined}
                fill={PALETTE[i % PALETTE.length]}
                radius={v.type === 'barres_empilees' ? undefined : [7, 7, 0, 0]}
                animationDuration={900} />
            ))}
          </BarChart>
        );
    }
  };

  if (!onFermer) {
    return (
      <motion.div
        className="mv-graphique"
        initial={{ opacity: 0, y: 26, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      >
        <div className="mv-graphique-titre">{v.titre}</div>
        <ResponsiveContainer width="100%" height={Math.min(hauteur, 300)}>{rendu()}</ResponsiveContainer>
      </motion.div>
    );
  }

  return (
    <Modale libelle={v.titre} onFermer={onFermer} classe="md-graphique">
      <div className="md-graphique-entete">
        <span className="md-graphique-titre">{v.titre}</span>
        <button type="button" className="md-fermer" onClick={onFermer} aria-label="Fermer le graphique">
          &times;
        </button>
      </div>
      <div className="md-graphique-corps">
        <ResponsiveContainer width="100%" height={hauteur}>{rendu()}</ResponsiveContainer>
      </div>
    </Modale>
  );
};

// ───────────────────────────────────────────────────────────────────────────
//  Débriefing de la veille
// ───────────────────────────────────────────────────────────────────────────

/**
 * Ce que l'assistante vient de dire, mis par écrit et en graphiques.
 *
 * Les chiffres affichés sont EXACTEMENT ceux qu'elle prononce : le serveur les
 * calcule une seule fois, en SQL, et envoie le même jeu aux deux. Le modèle ne
 * les voit jamais autrement que sous forme de phrases toutes faites.
 *
 * Les visuels réutilisent le composant du graphique poussé par le modèle. Il est
 * éprouvé, il gère déjà les conversions numériques de PostgreSQL : en écrire un
 * second n'aurait servi qu'à dupliquer ses défauts.
 */
const DebriefingVocal = ({ debriefing }: { debriefing: NonNullable<SessionVocale['debriefing']> }) => (
  <motion.div
    className="mv-debriefing"
    initial={{ opacity: 0, y: 22 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 210, damping: 26 }}
  >
    <div className="mv-debriefing-entete">
      <CalendarClock size={17} />
      <span>Mouvements de la veille{debriefing.date ? ` — ${debriefing.date}` : ''}</span>
    </div>

    <ul className="mv-debriefing-faits">
      {debriefing.phrases.map((p) => <li key={p}>{p}</li>)}
    </ul>

    {debriefing.graphiques.map((g) => (
      <GraphiqueVocal key={g.visualisation.titre} visuel={g as Visuel} />
    ))}

    {/* Dit à l'écrit ce que l'assistante dit à l'oral. Un rapport d'activité
        qu'on croit exhaustif alors qu'il ne couvre que les créations conduirait
        à des conclusions fausses sur le travail des agents. */}
    <p className="mv-debriefing-limite">
      Ne couvre que les actes de création tracés dans la base : inscriptions,
      encaissements, prises en charge, sessions de caisse, mouvements de stock.
      Les connexions, consultations, modifications et suppressions ne sont
      enregistrées nulle part.
    </p>
  </motion.div>
);

// ───────────────────────────────────────────────────────────────────────────
//  Écran principal
// ───────────────────────────────────────────────────────────────────────────
const ModeVocal = ({ onFermer }: { onFermer: () => void }) => {
  // CONSOMME la session, ne la cree pas. Le serveur n'en autorise qu'une par
  // utilisateur et ferme silencieusement l'ancienne : une seconde instance ici
  // tuerait celle du bouton flottant, sans le moindre message d'erreur.
  const v = useVocal();
  const filRef = useRef<HTMLDivElement>(null);

  /**
   * Ouvrir cet écran EST le consentement à parler : on démarre au montage,
   * un bouton « démarrer » de plus serait redondant.
   *
   * MAIS SEULEMENT SI RIEN N'EST EN COURS. Depuis que la session vit dans le
   * fournisseur, le fondateur peut l'avoir ouverte par le bouton flottant puis
   * venir sur cet écran. `demarrer()` commence par `arreter()` : rappelé sur une
   * session vivante, il couperait la conversation au moment précis où le
   * fondateur vient la regarder de plus près.
   */
  useEffect(() => {
    if (v.statut === 'inactif') v.demarrer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: 'smooth' });
  }, [v.tours, v.visuel]);

  const fermer = () => { v.arreter(); onFermer(); };

  /**
   * La redirection vocale vit desormais dans le fournisseur
   * (Components/Vocal/NavigationVocale) : elle doit fonctionner depuis
   * n'importe quel ecran, pas seulement quand cette page est ouverte. La
   * temporisation — 900 ms apres la fin de parole, 9 s de garde-fou — n'a pas
   * change d'un chiffre.
   *
   * Consequence ici : c'est le fournisseur qui arrete la session, et cet ecran
   * doit s'effacer en la voyant s'eteindre. Sans quoi il resterait affiche par
   * dessus l'ecran de destination, et le fondateur arriverait derriere un voile
   * noir. On ne referme QUE sur `inactif` : `erreur` doit rester lisible, c'est
   * le seul endroit ou le fondateur peut lire ce qui a echoue.
   */
  const etaitActif = useRef(false);
  useEffect(() => {
    if (v.statut !== 'inactif') { etaitActif.current = true; return; }
    if (etaitActif.current) { etaitActif.current = false; onFermer(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.statut]);

  // Échap ferme : le fondateur a les mains libres, pas forcément la souris.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });

  // Micro coupé, l'écran doit le dire AVANT tout le reste : afficher « Je vous
  // écoute » alors que rien n'est capté est exactement ce qui rendait la coupure
  // ambiguë. L'état vient de `micCoupe`, lui-même relu sur le flux réel — pas
  // sur l'intention du dernier clic.
  const etat: Etat = v.micCoupe && v.statut !== 'erreur' && v.statut !== 'parle'
    ? { libelle: "Micro coupé — je n'entends rien", teinte: '#b03a2b', icone: MicOff }
    : ETATS[v.statut];
  const derniereRequete = v.requetes[v.requetes.length - 1];

  return (
    <motion.div
      className="mv-fond"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      {/* Équerres d'écran : elles cadrent la vue comme un viseur. */}
      <span className="mv-equerre ht-g" aria-hidden="true" />
      <span className="mv-equerre ht-d" aria-hidden="true" />
      <span className="mv-equerre bs-g" aria-hidden="true" />
      <span className="mv-equerre bs-d" aria-hidden="true" />

      {/* Barre haute : identité, micro, sortie */}
      <div className="mv-entete">
        <div className="mv-titre">
          <span className="mv-pastille" style={{ background: etat.teinte, color: etat.teinte }} />
          Assistant vocal <span style={{ opacity: 0.4 }}>//</span> IIPEA
        </div>

        {/* Coupure du micro sans fermer la session : le fondateur peut prendre un
            appel ou parler à quelqu'un sans que tout soit transmis. */}
        <button
          className={`mv-micro${v.micCoupe ? ' est-coupe' : ''}`}
          onClick={v.basculerMicro}
          title={v.micCoupe ? 'Réactiver le micro' : 'Couper le micro'}
          aria-label={v.micCoupe ? 'Réactiver le micro' : 'Couper le micro'}
          aria-pressed={v.micCoupe}
        >
          {v.micCoupe ? <MicOff size={17} /> : <Mic size={17} />}
          {/* Le libellé n'apparaît QUE coupé : une icône barrée seule se
              confond avec un bouton désactivé, et c'est l'état dangereux —
              celui où l'on croit être entendu — qui doit être écrit. */}
          {v.micCoupe && <span className="mv-micro-libelle">Micro coupé</span>}
        </button>

        <button className="mv-fermer" onClick={fermer} aria-label="Fermer le mode vocal">
          <X size={20} />
        </button>
      </div>

      {/* Orbe + état */}
      <div className="mv-scene">
        <Orbe statut={v.statut} forme={v.forme as NomForme} etat={etat} />

        <AnimatePresence mode="wait">
          <motion.div
            key={etat.libelle}
            className="mv-etat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24 }}
            style={{ color: etat.teinte }}
          >
            {etat.libelle}
          </motion.div>
        </AnimatePresence>

        {/* La requête en cours rassure : le fondateur voit que ça travaille
            réellement sur ses données, et non que ça improvise. */}
        <AnimatePresence>
          {v.statut === 'reflexion' && derniereRequete?.intention && (
            <motion.div
              className="mv-intention"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {derniereRequete.intention}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fil de conversation + graphique */}
      <div className="mv-fil" ref={filRef}>
        <AnimatePresence initial={false}>
          {v.tours.map((t) => (
            t.rôle === 'fondateur' ? (
              // Ce que dit le fondateur reste une bulle : c'est un message envoye.
              // Tant que la reconnaissance n'a pas tranche, la bulle est grise et
              // en italique : le texte est provisoire, il changera peut-etre.
              <motion.div
                key={t.id}
                className={`mv-bulle mv-bulle-fondateur${t.partiel ? ' est-partiel' : ''}`}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              >
                {t.texte}
              </motion.div>
            ) : (
              // La reponse, elle, n'est pas un message : c'est une parole. Elle
              // s'inscrit a meme la page, sans cadre, comme un texte qu'on lit.
              <motion.p
                key={t.id}
                className="mv-dit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <TexteParle
                  texte={t.texte}
                  enCours={!!t.enCours}
                  avancementRef={v.avancementRef}
                />
              </motion.p>
            )
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {v.debriefing && <DebriefingVocal key="debriefing" debriefing={v.debriefing} />}
        </AnimatePresence>

        <AnimatePresence>
          {v.visuel && (
            <GraphiqueVocal key={v.visuel.visualisation.titre} visuel={v.visuel} onFermer={v.fermerVisuel} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {v.fichiers.map((f) => <FichierVocal key={f.id} fichier={f} />)}
        </AnimatePresence>

        {v.tours.length === 0 && v.statut === 'ecoute' && !v.micCoupe && (
          <motion.div
            className="mv-invite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Posez votre question à voix haute.
            <span>« Quel chiffre d'affaires avons-nous fait cette année ? »</span>
          </motion.div>
        )}
      </div>

      {/* La fiche passe AU-DESSUS de tout, orbe comprise : elle se consulte,
          puis on la ferme. Elle se monte elle-meme via un portail, donc elle ne
          depend pas de l'empilement de cet ecran. */}
      {v.ficheActive && (
        <FichePersonne
          key={`${v.ficheActive.categorie}-${v.ficheActive.id}`}
          fiche={v.ficheActive}
          onFermer={v.fermerFiche}
        />
      )}

      {/* Départ annoncé : le fondateur doit voir où il va avant d'y être. */}
      <AnimatePresence>
        {v.navigation && (
          <motion.div
            className="mv-depart"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <ArrowRightCircle size={17} />
            <span>Ouverture de {v.navigation.libelle}…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Erreurs */}
      <AnimatePresence>
        {v.erreur && (
          <motion.div
            className="mv-erreur"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <AlertTriangle size={16} />
            <span>{v.erreur}</span>
            <button onClick={() => { v.reinitialiser(); v.demarrer(); }}>Réessayer</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ModeVocal;
