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
  FileSpreadsheet, FileText, Download,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { useAssistantVocal, StatutVocal } from '../../lib/useAssistantVocal';
import BlobVocal from './BlobVocal';
import { telechargerFichier, FichierAssistant } from '../../lib/assistantFichiers';
import './ModeVocal.css';

const PALETTE = ['#a97723', '#1e4d82', '#2f9166', '#a4515f', '#7b5fbe', '#2f7d8f', '#8a6d3b'];

// Chaque état a sa couleur et son libellé : c'est le seul retour visuel dont
// dispose quelqu'un qui parle sans regarder l'écran de près.
const ETATS: Record<StatutVocal, { libelle: string; teinte: string; icone: any }> = {
  inactif:   { libelle: 'Prêt',                teinte: '#7b8499', icone: Mic },
  connexion: { libelle: 'Connexion…',          teinte: '#7b8499', icone: Loader2 },
  ecoute:    { libelle: 'Je vous écoute',      teinte: '#a97723', icone: Mic },
  reflexion: { libelle: 'Je consulte la base', teinte: '#1e4d82', icone: Database },
  construction: { libelle: 'Je construis le graphique', teinte: '#6d4bb8', icone: BarChart3 },
  parle:     { libelle: 'Réponse en cours',    teinte: '#237a53', icone: Volume2 },
  erreur:    { libelle: 'Interrompu',          teinte: '#b03a2b', icone: AlertTriangle },
};

// Jauge de consommation. Le fondateur n'a pas à lire un montant en pleine
// conversation : ce qui lui est utile, c'est de savoir s'il est tranquille, s'il
// approche de la limite, ou s'il y est. Le montant exact reste sur l'écran écrit.
const niveauBudget = (pourcentage: number): 'vert' | 'orange' | 'rouge' =>
  (pourcentage >= 85 ? 'rouge' : pourcentage >= 60 ? 'orange' : 'vert');

const LIBELLE_NIVEAU = {
  vert: 'Consommation du mois : niveau normal',
  orange: 'Consommation du mois : niveau élevé',
  rouge: 'Consommation du mois : limite presque atteinte',
} as const;

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
const Orbe = ({ statut }: { statut: StatutVocal }) => {
  const etat = ETATS[statut];

  return (
    <div className="mv-orbe-zone">
      {/* La forme EST l'orbe : cylindre à bourrelets quand le modèle interroge la
          base, histogramme en gradins quand il assemble un graphique, sphère le
          reste du temps — la couleur suivant l'état dans tous les cas. */}
      <BlobVocal statut={statut} />

      {/* Icône posée au centre. Blanche et non teintée : elle se détache du cœur
          sombre quelle que soit la couleur de l'état en cours. */}
      <div className="mv-icone">
        <AnimatePresence mode="wait">
          <motion.div
            key={statut}
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
const GraphiqueVocal = ({ visuel }: { visuel: NonNullable<ReturnType<typeof useAssistantVocal>['visuel']> }) => {
  const { visualisation: v, donnees } = visuel;

  // PostgreSQL renvoie numeric/bigint en chaîne : sans conversion, Recharts
  // trace des barres vides sans le signaler.
  const data = useMemo(() => donnees.map((l) => {
    const p: Record<string, string | number> = { __x: String(l[v.axe_x] ?? '—') };
    v.series.forEach((s) => { p[s.colonne] = Number(l[s.colonne] ?? 0); });
    return p;
  }), [donnees, v]);

  const formater = formatteurs[v.format_valeur] ?? formatteurs.nombre;
  const tooltip = {
    contentStyle: {
      background: '#ffffff', border: '1px solid rgba(16,26,51,.12)', borderRadius: 12,
      boxShadow: '0 12px 32px -12px rgba(16,26,51,.35)',
    },
    labelStyle: { color: '#55607a', fontSize: 12 },
    itemStyle: { color: '#101a33', fontSize: 12.5 },
    formatter: (val: number) => formater(val),
  };
  const axeX = (
    <XAxis dataKey="__x" tick={{ fontSize: 10, fill: '#7b8499' }} interval={0}
      angle={data.length > 4 ? -20 : 0} textAnchor={data.length > 4 ? 'end' : 'middle'}
      height={data.length > 4 ? 56 : 28} axisLine={{ stroke: 'rgba(16,26,51,.12)' }} tickLine={false} />
  );
  const axeY = (
    <YAxis tick={{ fontSize: 11, fill: '#7b8499' }} axisLine={false} tickLine={false}
      tickFormatter={formater} width={60} />
  );
  const grille = <CartesianGrid strokeDasharray="3 3" stroke="rgba(16,26,51,.09)" vertical={false} />;
  const legende = v.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12, color: '#55607a' }} /> : null;

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
            <Legend wrapperStyle={{ fontSize: 12, color: '#97a0bd' }} />
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
        return (
          <BarChart data={data}>
            {grille}{axeX}{axeY}<Tooltip {...tooltip} cursor={{ fill: 'rgba(16,26,51,.05)' }} />{legende}
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

  return (
    <motion.div
      className="mv-graphique"
      initial={{ opacity: 0, y: 26, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
    >
      <div className="mv-graphique-titre">{v.titre}</div>
      <ResponsiveContainer width="100%" height={260}>{rendu()}</ResponsiveContainer>
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
//  Écran principal
// ───────────────────────────────────────────────────────────────────────────
const ModeVocal = ({ onFermer }: { onFermer: () => void }) => {
  const v = useAssistantVocal();
  const filRef = useRef<HTMLDivElement>(null);

  // Une seule session est démarrée au montage : ouvrir le mode vocal EST le
  // consentement à parler, un bouton « démarrer » de plus serait redondant.
  useEffect(() => { v.demarrer(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: 'smooth' });
  }, [v.tours, v.visuel]);

  const fermer = () => { v.arreter(); onFermer(); };

  // Échap ferme : le fondateur a les mains libres, pas forcément la souris.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(); };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });

  const etat = ETATS[v.statut];
  const derniereRequete = v.requetes[v.requetes.length - 1];

  return (
    <motion.div
      className="mv-fond"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      {/* Barre haute : identité, budget, sortie */}
      <div className="mv-entete">
        <div className="mv-titre">
          <span className="mv-pastille" style={{ background: etat.teinte }} />
          Assistant vocal
        </div>

        {v.budget && (
          <motion.div
            className={`mv-budget niveau-${niveauBudget(v.budget.pourcentage)}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            title={LIBELLE_NIVEAU[niveauBudget(v.budget.pourcentage)]}
            aria-label={LIBELLE_NIVEAU[niveauBudget(v.budget.pourcentage)]}
          >
            <div className="mv-budget-barre">
              <motion.div
                className="mv-budget-remplissage"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(Math.min(v.budget.pourcentage, 100), 2)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 24 }}
              />
            </div>
          </motion.div>
        )}

        {/* Coupure du micro sans fermer la session : le fondateur peut prendre un
            appel ou parler à quelqu'un sans que tout soit transmis — ni facturé. */}
        <button
          className={`mv-micro${v.micCoupe ? ' est-coupe' : ''}`}
          onClick={v.basculerMicro}
          title={v.micCoupe ? 'Réactiver le micro' : 'Couper le micro'}
          aria-label={v.micCoupe ? 'Réactiver le micro' : 'Couper le micro'}
          aria-pressed={v.micCoupe}
        >
          {v.micCoupe ? <MicOff size={17} /> : <Mic size={17} />}
        </button>

        <button className="mv-fermer" onClick={fermer} aria-label="Fermer le mode vocal">
          <X size={20} />
        </button>
      </div>

      {/* Orbe + état */}
      <div className="mv-scene">
        <Orbe statut={v.statut} />

        <AnimatePresence mode="wait">
          <motion.div
            key={v.statut}
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
            <motion.div
              key={t.id}
              className={`mv-bulle mv-bulle-${t.rôle}`}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            >
              {t.texte}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {v.visuel && <GraphiqueVocal key={v.visuel.visualisation.titre} visuel={v.visuel} />}
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
