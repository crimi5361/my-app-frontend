/* eslint-disable @typescript-eslint/no-explicit-any */
// Fiche d'identité — fenêtre de consultation (2026-08-19).
//
// PREMIÈRE VERSION ÉCARTÉE. La fiche s'insérait dans le fil de conversation,
// entre la phrase de l'assistante et le bouton de téléchargement. Elle y était
// à l'étroit, rognée, et se retrouvait poussée hors de l'écran par le message
// suivant. Ce n'était pas une fiche : c'était un paragraphe encadré.
//
// Elle est donc devenue une FENÊTRE. Le fond s'assombrit, l'orbe passe
// derrière, et la fiche occupe le centre — on la consulte, puis on la ferme.
//
// TROIS TEMPS, dans cet ordre, parce que c'est l'ordre du regard :
//   1. le cadre s'ouvre et les équerres se verrouillent sur la cible ;
//   2. la photo se révèle sous un balayage — c'est elle qui dit « c'est bien
//      cette personne » ;
//   3. les informations SE TAPENT, ligne après ligne, comme sur un terminal.
//
// LA FRAPPE NE PASSE PAS PAR REACT. Une lettre par rendu, ce serait six cents
// rendus pour une fiche, pendant que l'assistante parle et que le fil se met à
// jour. Le texte est écrit directement dans le DOM depuis une seule boucle
// d'animation : aucun rendu React pendant toute la construction.
import { memo, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, User, ShieldCheck, GraduationCap } from 'lucide-react';
import { creerSonar } from '../../lib/sonFiche';
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

/** Caractères par seconde. À 190, une fiche de vingt lignes se remplit en un
 *  peu plus de deux secondes : on voit distinctement la frappe sans jamais
 *  attendre après elle. En dessous de 120 on s'impatiente, au-dessus de 260 on
 *  ne voit plus qu'un clignotement. */
const VITESSE = 190;

/** Instant où la frappe commence, après l'ouverture du cadre et la photo. */
const DEBUT_FRAPPE_MS = 900;

/**
 * Où sont servies les photos.
 *
 * Par défaut, là où est l'API — c'est le cas en production. Mais en
 * développement l'API tourne en local alors que la BASE est celle de
 * production : les chemins `/uploads/photos/...` désignent alors des fichiers
 * qui n'existent que sur le serveur distant, et le navigateur reçoit un 404.
 *
 * `VITE_URL_MEDIAS` permet de pointer les médias vers le serveur de production
 * tout en gardant l'API en local. Non renseignée, rien ne change.
 */
const BASE_MEDIAS = (import.meta.env.VITE_URL_MEDIAS as string)
  || (import.meta.env.VITE_API_URL_SERVER as string)
  || '';

/**
 * Initiales, pour quand il n'y a pas de photo.
 *
 * Ce n'est pas un cas marginal : 61 % des étudiants n'en ont pas, et le
 * personnel n'en a JAMAIS — la table `utilisateur` ne porte aucune colonne de
 * photo. Un monogramme se lit comme une identité ; un cadre vide se lit comme
 * une panne.
 */
function initiales(nom: string): string {
  return String(nom || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0])
    .join('')
    .toUpperCase() || '?';
}

function tonEtat(etat: string | null): 'ok' | 'attention' | 'neutre' {
  const e = (etat || '').toLowerCase();
  if (/inscrit|active|valide|solde/.test(e) && !/non/.test(e)) return 'ok';
  if (/desactive|non_solde|non solde|attente|suspendu|refus/.test(e)) return 'attention';
  return 'neutre';
}

const FichePersonne = ({ fiche, onFermer }: { fiche: Fiche; onFermer: () => void }) => {
  const etudiant = fiche.categorie === 'etudiant';
  const Icone = etudiant ? GraduationCap : ShieldCheck;

  const panneau = useRef<HTMLDivElement>(null);
  const fermeture = useRef(onFermer);
  fermeture.current = onFermer;

  const cadrePhoto = useRef<HTMLDivElement>(null);

  // La chaîne vide existe en base (38 étudiants) : elle ne doit pas produire une
  // requête vers la racine du serveur.
  const chemin = (fiche.photo_url || '').trim();
  const photo = chemin
    ? (chemin.startsWith('http') ? chemin : `${BASE_MEDIAS}${chemin}`)
    : null;

  /**
   * Photo introuvable — le fichier a été supprimé, ou il n'est pas sur ce
   * serveur. On bascule sur le monogramme plutôt que de laisser l'icône
   * d'image cassée du navigateur, qui donne l'impression que la fiche a raté.
   *
   * Une classe sur le conteneur plutôt qu'un état React : la bascule ne doit
   * pas provoquer de rendu pendant que le texte se tape.
   */
  const photoAbsente = () => cadrePhoto.current?.classList.add('sans-image');

  const total = useMemo(
    () => fiche.blocs.reduce((s, b) => s + b.champs.length, 0),
    [fiche.blocs],
  );

  // ── La frappe ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Les zones sont relues DANS LE DOM plutôt que collectées par des refs
    // pendant le rendu. Une première version remplissait un tableau au fil des
    // refs et le vidait à chaque rendu : l'écran vocal se redessine vingt fois
    // par seconde pour son visualiseur, et le tableau se retrouvait vide entre
    // deux passages. querySelectorAll donne l'ordre du document, qui est
    // exactement l'ordre de frappe voulu, et ne dépend d'aucun cycle de rendu.
    const cibles = Array.from(
      panneau.current?.querySelectorAll<HTMLElement>('.fp-tape') ?? [],
    );
    const textes = cibles.map((z) => z.dataset.texte || '');
    cibles.forEach((z) => { z.textContent = ''; });

    const sonar = creerSonar();
    let raf = 0;
    let minuteur = 0;
    let annule = false;

    minuteur = window.setTimeout(() => {
      if (annule) return;
      sonar.demarrerSouffle();

      let i = 0;          // zone en cours
      let pos = 0;        // caractères déjà écrits dans cette zone
      let reste = 0;      // fraction de caractère reportée d'une image à l'autre
      let precedent = performance.now();

      const boucle = (t: number) => {
        if (annule) return;
        reste += ((t - precedent) / 1000) * VITESSE;
        precedent = t;

        let aEcrire = Math.floor(reste);
        reste -= aEcrire;

        while (aEcrire > 0 && i < cibles.length) {
          const texte = textes[i];
          const prendre = Math.min(aEcrire, texte.length - pos);
          pos += prendre;
          aEcrire -= prendre;
          cibles[i].textContent = texte.slice(0, pos);

          if (pos >= texte.length) {
            cibles[i].classList.remove('est-actif');
            // Le bip marque la fin d'un BLOC, pas d'une ligne : un son par ligne
            // ferait une mitraillette.
            if (cibles[i].dataset.fin === 'bloc') sonar.bloc();
            i += 1; pos = 0;
            if (i < cibles.length) cibles[i].classList.add('est-actif');
          }
        }

        if (i < cibles.length) { raf = requestAnimationFrame(boucle); return; }
        sonar.arreterSouffle();
        sonar.fin();
        panneau.current?.classList.add('est-complete');
      };

      if (cibles.length) cibles[0].classList.add('est-actif');
      sonar.ouverture();
      raf = requestAnimationFrame(boucle);
    }, DEBUT_FRAPPE_MS);

    return () => {
      annule = true;
      clearTimeout(minuteur);
      cancelAnimationFrame(raf);
      sonar.fermer();
      // Démontage en pleine frappe (StrictMode, ou fermeture rapide) : on rétablit
      // le texte complet pour ne jamais laisser une fiche à moitié écrite.
      cibles.forEach((z, k) => { z.textContent = textes[k]; z.classList.remove('est-actif'); });
    };
  }, [fiche.id, fiche.categorie]);

  // ── Fermeture ────────────────────────────────────────────────────────────
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); fermeture.current(); }
    };
    // En phase de capture : l'écran vocal écoute aussi Échap pour se fermer, et
    // c'est la fiche qui doit partir en premier.
    window.addEventListener('keydown', surTouche, true);
    panneau.current?.focus();
    return () => window.removeEventListener('keydown', surTouche, true);
  }, []);

  let rang = 0;

  const contenu = (
    <div className="fp-voile" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div
        className={`fp-panneau${etudiant ? '' : ' est-agent'}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Fiche de ${fiche.nom_complet}`}
        tabIndex={-1}
        ref={panneau}
      >
        <span className="fp-eq ht-g" /><span className="fp-eq ht-d" />
        <span className="fp-eq bs-g" /><span className="fp-eq bs-d" />
        <span className="fp-grille" aria-hidden="true" />

        <header className="fp-barre">
          <span className="fp-titre-barre">
            PROFIL INDIVIDUEL <span className="fp-sep">//</span> BASE IIPEA
          </span>
          <button type="button" className="fp-fermer" onClick={onFermer} aria-label="Fermer la fiche">
            <X size={16} />
          </button>
        </header>

        <div className="fp-corps">
          <div className="fp-colonne-gauche">
            <div className={`fp-photo${photo ? '' : ' sans-image'}`} ref={cadrePhoto}>
              {/* Le monogramme est TOUJOURS monté, sous la photo. C'est lui qui
                  apparaît si l'image manque ou n'arrive pas, sans qu'aucun
                  rendu React ne soit nécessaire pour basculer. */}
              <div className="fp-monogramme" aria-hidden="true">
                <span className="fp-initiales">{initiales(fiche.nom_complet)}</span>
                <User size={15} strokeWidth={1.6} />
              </div>
              {photo && <img src={photo} alt="" onError={photoAbsente} />}
              <span className="fp-balayage" aria-hidden="true" />
              <span className="fp-reticule" aria-hidden="true" />
            </div>

            <span className={`fp-genre ton-${etudiant ? 'etu' : 'agt'}`}>
              <Icone size={12} /> {fiche.libelle_categorie.toUpperCase()}
            </span>
            {fiche.reference && <span className="fp-ref">{fiche.reference}</span>}
            {fiche.etat && <span className={`fp-etat ton-${tonEtat(fiche.etat)}`}>{fiche.etat}</span>}
          </div>

          <div className="fp-colonne-droite">
            <div className="fp-identite">
              <h3 className="fp-nom">{fiche.nom_complet}</h3>
              {fiche.soustitre && <p className="fp-soustitre">{fiche.soustitre}</p>}
            </div>

            <div className="fp-blocs">
              {fiche.blocs.map((b) => (
                <section className="fp-bloc" key={b.titre}>
                  <h4 className="fp-bloc-titre">{b.titre}</h4>
                  <dl className="fp-champs">
                    {b.champs.map((c, ic) => {
                      rang += 1;
                      const dernier = ic === b.champs.length - 1;
                      return (
                        <div className="fp-champ" key={c.libelle} style={{ '--r': rang } as any}>
                          <dt>{c.libelle}</dt>
                          <dd>
                            {/* Le texte complet reste lisible par un lecteur
                                d'écran : la frappe est une mise en scène, pas
                                une rétention d'information. */}
                            <span className="fp-sr">{c.valeur}</span>
                            <span
                              className="fp-tape"
                              aria-hidden="true"
                              data-texte={c.valeur}
                              data-fin={dernier ? 'bloc' : 'ligne'}
                            />
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              ))}
            </div>
          </div>
        </div>

        <footer className="fp-pied">
          <span className="fp-etat-scan">ANALYSE EN COURS</span>
          <span className="fp-compte">{total} champs — source : base IIPEA</span>
        </footer>
      </div>
    </div>
  );

  // Portail : la fiche se place au-dessus de tout, sans dépendre du contexte
  // d'empilement du fil de conversation où elle a été demandée.
  return createPortal(contenu, document.body);
};

/**
 * Mémoïsé volontairement. L'écran vocal met à jour le niveau sonore vingt fois
 * par seconde ; sans ce garde, toute la fiche se redessinait à la même cadence
 * pendant qu'elle se tape. Les deux props sont stables — la fiche vient du
 * serveur, la fermeture est un `useCallback`.
 */
export default memo(FichePersonne);
