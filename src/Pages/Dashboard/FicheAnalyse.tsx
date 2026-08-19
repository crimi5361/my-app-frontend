/* eslint-disable @typescript-eslint/no-explicit-any */
// Visualisations de la fiche (2026-08-19).
//
// Les graphiques sont DANS la fiche, pas en annexe : c'est en les voyant à côté
// des chiffres qu'on lit un profil. Chacun porte son titre et une phrase de
// lecture calculée par le serveur à partir des données — jamais rédigée par le
// modèle, qui pourrait la contredire.
//
// Quand une donnée manque, on le DIT. Un graphique silencieusement absent
// laisse croire à un défaut d'affichage ; une ligne « la base ne l'enregistre
// pas » ferme la question.
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell,
} from 'recharts';
import { AlertCircle } from 'lucide-react';

export interface GraphiqueFiche {
  type: 'radar' | 'barres' | 'courbe' | 'histogramme';
  titre: string;
  cle: string;
  serie?: string;
  series?: { colonne: string; libelle: string }[];
  donnees: Record<string, any>[];
  lecture: string;
}

export interface AnalyseFiche {
  disponible: boolean;
  motif?: string;
  synthese?: Record<string, number | null>;
  graphiques?: GraphiqueFiche[];
  lacunes: string[];
}

// Recharts ne lit pas les variables CSS : sur fond sombre, les couleurs doivent
// être fournies en dur. Elles reprennent celles du panneau.
const CYAN = '#4fd8ff';
const AMBRE = '#ffb454';
const GRILLE = 'rgba(255,255,255,0.10)';
const AXE = '#7d92ad';

const infobulle = {
  contentStyle: {
    background: '#0b1526', border: '1px solid rgba(79,216,255,0.3)',
    borderRadius: 4, fontSize: 12,
  },
  labelStyle: { color: '#7d92ad', fontSize: 11 },
  itemStyle: { color: '#e8f2fb', fontSize: 12 },
};

/** Un libellé de matière tient rarement sur un axe : on l'abrège au premier
 *  mot significatif plutôt que de le laisser se chevaucher. */
const abreger = (v: string, n = 14) => {
  const t = String(v ?? '');
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
};

const Visuel = ({ g }: { g: GraphiqueFiche }) => {
  const hauteur = g.type === 'radar' ? 260 : 210;

  const rendu = () => {
    switch (g.type) {
      case 'radar':
        return (
          <RadarChart data={g.donnees} outerRadius="72%">
            <PolarGrid stroke={GRILLE} />
            <PolarAngleAxis
              dataKey={g.cle}
              tick={{ fontSize: 9, fill: AXE }}
              tickFormatter={(v) => abreger(v, 16)}
            />
            <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 9, fill: AXE }} axisLine={false} />
            <Radar
              dataKey={g.serie || 'moyenne'} name="Moyenne"
              stroke={CYAN} fill={CYAN} fillOpacity={0.28} strokeWidth={2}
            />
            <Tooltip {...infobulle} />
          </RadarChart>
        );

      case 'courbe':
        return (
          <LineChart data={g.donnees} margin={{ top: 6, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRILLE} vertical={false} />
            <XAxis dataKey={g.cle} tick={{ fontSize: 10, fill: AXE }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: AXE }} axisLine={false} tickLine={false} />
            <Tooltip {...infobulle} />
            <Line
              type="monotone" dataKey={g.serie || 'moyenne'} name="Moyenne"
              stroke={CYAN} strokeWidth={2.6} dot={{ r: 4, fill: CYAN }} animationDuration={900}
            />
          </LineChart>
        );

      case 'histogramme':
        return (
          <BarChart data={g.donnees} margin={{ top: 6, right: 12, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRILLE} vertical={false} />
            <XAxis dataKey={g.cle} tick={{ fontSize: 9, fill: AXE }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: AXE }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip {...infobulle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey={g.serie || 'effectif'} name="Étudiants" radius={[3, 3, 0, 0]} animationDuration={900}>
              {/* La tranche de l'étudiant se détache : c'est elle qui répond à
                  « où se situe-t-il ? », le reste n'est que le décor. */}
              {g.donnees.map((d, i) => (
                <Cell key={i} fill={d.est_le_sien ? AMBRE : 'rgba(79,216,255,0.34)'} />
              ))}
            </Bar>
          </BarChart>
        );

      default:
        return (
          <BarChart data={g.donnees} margin={{ top: 6, right: 12, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRILLE} vertical={false} />
            <XAxis
              dataKey={g.cle} tick={{ fontSize: 9, fill: AXE }} axisLine={false} tickLine={false}
              interval={0} angle={-28} textAnchor="end" height={62}
              tickFormatter={(v) => abreger(v)}
            />
            <YAxis tick={{ fontSize: 10, fill: AXE }} axisLine={false} tickLine={false} />
            <Tooltip {...infobulle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            {(g.series?.length ?? 0) > 1 && (
              <Legend wrapperStyle={{ fontSize: 11, color: AXE }} />
            )}
            {(g.series || [{ colonne: g.serie || 'valeur', libelle: 'Valeur' }]).map((s, i) => (
              <Bar
                key={s.colonne} dataKey={s.colonne} name={s.libelle}
                fill={i === 0 ? CYAN : 'rgba(255,180,84,0.75)'}
                radius={[3, 3, 0, 0]} animationDuration={900}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <figure className="fa-visuel">
      <figcaption className="fa-titre">{g.titre}</figcaption>
      <div className="fa-toile">
        <ResponsiveContainer width="100%" height={hauteur}>{rendu()}</ResponsiveContainer>
      </div>
      {g.lecture && <p className="fa-lecture">{g.lecture}</p>}
    </figure>
  );
};

/** Indicateur synthétique. La barre donne la position d'un coup d'œil, le
 *  chiffre donne la valeur exacte : les deux servent. */
const Jauge = ({ libelle, valeur, sur, suffixe, inverse }: {
  libelle: string; valeur: number | null; sur: number; suffixe?: string; inverse?: boolean;
}) => {
  if (valeur === null || valeur === undefined) {
    return (
      <div className="fa-jauge">
        <span className="fa-jauge-lib">{libelle}</span>
        <span className="fa-jauge-val est-vide">non calculable</span>
      </div>
    );
  }
  // Pour un rang, 1 est le meilleur : la jauge est donc inversée.
  const part = Math.max(0, Math.min(1, inverse ? 1 - (valeur - 1) / Math.max(sur - 1, 1) : valeur / sur));
  const ton = part >= 0.66 ? 'bon' : part >= 0.4 ? 'moyen' : 'faible';

  return (
    <div className="fa-jauge">
      <span className="fa-jauge-lib">{libelle}</span>
      <span className="fa-jauge-val">
        {valeur}{suffixe ? <em>{suffixe}</em> : null}
      </span>
      <span className="fa-jauge-piste">
        <span className={`fa-jauge-part ton-${ton}`} style={{ width: `${part * 100}%` }} />
      </span>
    </div>
  );
};

const FicheAnalyse = ({ analyse }: { analyse: AnalyseFiche }) => {
  if (!analyse) return null;

  const s = analyse.synthese || {};
  const estEtudiant = s.moyenne !== undefined;

  return (
    <section className="fa-racine">
      <h4 className="fa-section-titre">Analyse</h4>

      {!analyse.disponible && (
        <p className="fa-indisponible">
          <AlertCircle size={14} />
          {analyse.motif || "Aucune donnée exploitable."}
        </p>
      )}

      {analyse.disponible && estEtudiant && (
        <div className="fa-jauges">
          <Jauge libelle="Moyenne générale" valeur={s.moyenne ?? null} sur={20} suffixe="/20" />
          <Jauge libelle="Rang" valeur={s.rang ?? null} sur={s.effectif || 1} suffixe={`e/${s.effectif ?? '?'}`} inverse />
          <Jauge libelle="Matières validées" valeur={s.matieres_validees ?? null} sur={s.matieres || 1} suffixe={`/${s.matieres ?? '?'}`} />
          <Jauge libelle="Crédits acquis" valeur={s.credits_valides ?? null} sur={s.credits_total || 1} suffixe={`/${s.credits_total ?? '?'}`} />
        </div>
      )}

      {analyse.disponible && (analyse.graphiques || []).map((g) => (
        <Visuel key={g.titre} g={g} />
      ))}

      {(analyse.lacunes || []).length > 0 && (
        <div className="fa-lacunes">
          <span className="fa-lacunes-titre">Ce que la base n'enregistre pas</span>
          <ul>{analyse.lacunes.map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
      )}
    </section>
  );
};

export default FicheAnalyse;
