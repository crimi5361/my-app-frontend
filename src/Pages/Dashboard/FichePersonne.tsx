/* eslint-disable @typescript-eslint/no-explicit-any */
// Fiche d'identité — affichage HUD (2026-08-18).
//
// Le fondateur demande « qui est untel ? » et veut voir une fiche se dessiner,
// pas lire un paragraphe. Deux exigences qui commandent tout le composant :
//
//   1. RIEN N'APPARAÎT D'UN COUP. Le cadre se trace, la photo se révèle, puis
//      les blocs s'inscrivent l'un après l'autre. On doit voir la fiche SE
//      CONSTRUIRE — c'est ce qui donne l'impression d'un système qui travaille,
//      et non d'une page qui se charge.
//
//   2. TECHNOLOGIQUE, PAS TAPAGEUR. Balayage, liseré, points d'ancrage. Aucune
//      animation ne doit gêner la lecture : la fiche est un outil de travail,
//      pas une démonstration. Tout se fige une fois la construction terminée.
//
// L'ORDONNANCEMENT EST EN CSS, PAS EN REACT. Chaque élément porte son propre
// délai via une variable `--d`. Aucun minuteur, aucun état intermédiaire, donc
// aucun rendu React pendant l'animation — c'est ce qui la garde fluide même
// pendant que le modèle continue de parler.
import { useMemo } from 'react';
import { User, ShieldCheck, GraduationCap, ScanLine } from 'lucide-react';
import './FichePersonne.css';

export interface ChampFiche { libelle: string; valeur: string }
export interface BlocFiche { titre: string; champs: ChampFiche[] }

export interface Fiche {
  categorie: 'etudiant' | 'agent';
  libelle_categorie: string;
  id: number;
  nom_complet: string;
  reference: string | null;
  photo_url: string | null;
  etat: string | null;
  soustitre: string | null;
  blocs: BlocFiche[];
}

/** Cadence de la construction, en secondes. Assez lent pour qu'on voie la fiche
 *  se monter, assez vif pour ne pas faire attendre : la fiche complète est en
 *  place en moins de deux secondes et demie. */
const T = {
  cadre: 0,
  photo: 0.35,
  identite: 0.75,
  bloc: 0.95,        // départ du premier bloc
  parBloc: 0.16,     // décalage entre deux blocs
  parChamp: 0.038,   // décalage entre deux lignes d'un même bloc
};

const BASE = (import.meta.env.VITE_API_URL_SERVER as string) || '';

/** L'état colore la pastille. Les libellés viennent de la base — on reconnaît
 *  les cas connus et on retombe sur un neutre plutôt que d'inventer. */
function tonEtat(etat: string | null): 'ok' | 'attention' | 'neutre' {
  const e = (etat || '').toLowerCase();
  if (/inscrit|active|valide|solde/.test(e)) return 'ok';
  if (/desactive|non_solde|non solde|attente|suspendu/.test(e)) return 'attention';
  return 'neutre';
}

const FichePersonne = ({ fiche }: { fiche: Fiche }) => {
  const etudiant = fiche.categorie === 'etudiant';
  const Icone = etudiant ? GraduationCap : ShieldCheck;

  // Chaque champ reçoit son instant d'apparition une fois pour toutes : le
  // calcul ne dépend que de sa position, il ne se refait jamais.
  const blocs = useMemo(() => {
    let depart = T.bloc;
    return fiche.blocs.map((b) => {
      const debut = depart;
      depart += T.parBloc + b.champs.length * T.parChamp;
      return { ...b, debut };
    });
  }, [fiche.blocs]);

  const photo = fiche.photo_url
    ? (fiche.photo_url.startsWith('http') ? fiche.photo_url : `${BASE}${fiche.photo_url}`)
    : null;

  return (
    <div className={`fp-cadre${etudiant ? '' : ' est-agent'}`} style={{ '--d': `${T.cadre}s` } as any}>
      {/* Coins d'ancrage : ils se tracent en premier et donnent le sentiment
          que l'affichage se verrouille sur la cible. */}
      <span className="fp-coin ht-g" /><span className="fp-coin ht-d" />
      <span className="fp-coin bs-g" /><span className="fp-coin bs-d" />

      <div className="fp-entete">
        <span className="fp-puce"><Icone size={13} /> {fiche.libelle_categorie}</span>
        {fiche.reference && <span className="fp-ref">{fiche.reference}</span>}
      </div>

      <div className="fp-haut">
        {/* La photo arrive avant tout le reste : c'est elle qui dit au fondateur
            qu'on a trouvé la bonne personne. */}
        <div className="fp-photo" style={{ '--d': `${T.photo}s` } as any}>
          {photo ? (
            <img src={photo} alt="" loading="lazy" />
          ) : (
            <div className="fp-photo-absente"><User size={30} /><span>Sans photo</span></div>
          )}
          <span className="fp-balayage" />
          <span className="fp-reticule" />
        </div>

        <div className="fp-identite" style={{ '--d': `${T.identite}s` } as any}>
          <h3 className="fp-nom">{fiche.nom_complet}</h3>
          {fiche.soustitre && <p className="fp-soustitre">{fiche.soustitre}</p>}
          {fiche.etat && (
            <span className={`fp-etat ton-${tonEtat(fiche.etat)}`}>{fiche.etat}</span>
          )}
        </div>
      </div>

      <div className="fp-blocs">
        {blocs.map((b) => (
          <section className="fp-bloc" key={b.titre} style={{ '--d': `${b.debut}s` } as any}>
            <h4 className="fp-bloc-titre">{b.titre}</h4>
            <dl className="fp-champs">
              {b.champs.map((c, i) => (
                <div
                  className="fp-champ"
                  key={c.libelle}
                  style={{ '--d': `${b.debut + 0.12 + i * T.parChamp}s` } as any}
                >
                  <dt>{c.libelle}</dt>
                  <dd>{c.valeur}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="fp-pied">
        <ScanLine size={12} />
        <span>Fiche établie depuis la base — {new Date().toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  );
};

export default FichePersonne;
