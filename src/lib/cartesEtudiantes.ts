/**
 * Cartes étudiantes — types, accès API et feuille d'impression.
 *
 * Les valeurs imprimées (couleurs, coordonnées, mentions, format physique)
 * viennent toutes du serveur, via `GET /api/cartes-etudiantes/configuration`.
 * Rien n'est redéclaré ici : ce module décrit la forme des données, il n'en
 * invente aucune.
 */

import { apiFetch } from './api';
import { CARTE_LARGEUR_MM, CARTE_HAUTEUR_MM, STYLES_CARTE_ETUDIANTE } from '../Components/CarteEtudiante/CarteEtudiante';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IdentiteEcole = {
  /** Sigle imprimé sur la carte : TEC, DRT, ECO, MGT, COM. */
  code: string;
  /** Code réellement stocké en base : TECH, LAW, ECO, MGT, COM. */
  code_base: string | null;
  nom: string;
  principal: string;
  fonce: string;
  profond: string;
  /** `false` si la filière n'est rattachée à aucune des cinq écoles connues. */
  reconnue: boolean;
};

export type CarteEtudianteData = {
  etudiant_id: number;
  annee_academique_id: number;
  nom: string | null;
  prenoms: string | null;
  numero_etudiant: string | null;
  matricule_ip: string | null;
  date_naissance: string | null;
  filiere: string | null;
  filiere_sigle: string | null;
  niveau: string | null;
  annee_academique: string | null;
  valable_jusquau: string | null;
  photo_url: string | null;
  /** Site de rattachement de l'étudiant (« IIPEA COCODY »…), imprimé au verso.
      null si inconnu : jamais remplacé par un site par défaut. */
  site: string | null;
  ecole: IdentiteEcole;
  verification_url: string;
  champs_manquants: string[];
  complete: boolean;
  /** Affectation — affichée à l'écran, absente de la carte imprimée. */
  groupe_id: number | null;
  groupe: string | null;
  classe: string | null;
};

export type ConfigurationCartes = {
  ecoles: Record<string, { sigle: string; nom: string; principal: string; fonce: string; profond: string }>;
  or: { principal: string; clair: string };
  etablissement: {
    sigle: string;
    nom: string;
    contacts: {
      scolarite_telephone: string;
      scolarite_email: string;
      site: string;
      urgence_telephone: string;
    };
  };
  mentions_verso: { titre: string; corps: string[]; emphases: string[]; authenticite: string };
  format: { largeur_mm: number; hauteur_mm: number; orientation: string; rayon_mm: number };
  verification: { url: string; etiquette: string };
  lot_max: number;
  /** `null` : statut illisible côté serveur (informatif uniquement). */
  photos_verrouillees?: boolean | null;
};

export type OptionAnnee = { id: number; annee: string };
export type OptionEcole = { id: number; code: string; sigle: string; nom: string; effectif: number };
export type OptionFiliere = { id: number; nom: string; sigle: string | null; effectif: number };
export type OptionNiveau = { libelle: string; ids: number[]; effectif: number };
export type OptionGroupe = {
  id: number;
  /** Nom complet en base, qui reprend celui de la classe. */
  nom_complet: string;
  /** Part utile du nom (« Groupe 2 »), pour que la liste reste lisible. */
  libelle: string;
  classe_nom: string | null;
  effectif: number;
};

/**
 * Hiérarchie de sélection : année → école → filière → niveau → groupe.
 * Tous les échelons sauf l'année sont facultatifs : on imprime aussi bien une
 * école entière qu'un groupe précis.
 *
 * `niveau_ids` est une LISTE : un même libellé (« BTS 1 ») existe sous plusieurs
 * `niveau.id`, un par filière. N'en envoyer qu'un seul omettait des étudiants
 * dès lors qu'aucune filière n'était choisie.
 */
export type Filtres = {
  annee_id: number | null;
  ecole_id: number | null;
  filiere_id: number | null;
  niveau_ids: number[] | null;
  groupe_id: number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Accès API
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/api/cartes-etudiantes';

/**
 * Transforme le chemin de photo renvoyé par le serveur (`/uploads/photos/…`) en
 * URL absolue vers le backend.
 *
 * Le serveur ne préfixe pas lui-même ce chemin : sa variable `API_URL` vaut
 * `http://localhost:5173/` y compris en production, et ne désigne donc pas le
 * backend. `VITE_API_URL_SERVER` est la seule valeur fiable — c'est déjà celle
 * que `apiFetch` utilise pour joindre l'API.
 *
 * La résolution est indispensable à l'impression : la fenêtre ouverte porte un
 * `<base href>` sur l'origine du FRONTEND, où `/uploads` n'existe pas. Un chemin
 * relatif y produirait des cartes sans photo.
 */
export const urlPhotoAbsolue = (chemin: string | null): string | null => {
  if (!chemin) return null;
  if (/^https?:\/\//i.test(chemin)) return chemin;
  const base = String(import.meta.env.VITE_API_URL_SERVER || '').replace(/\/+$/, '');
  return base ? `${base}${chemin.startsWith('/') ? chemin : '/' + chemin}` : chemin;
};

/** Applique `urlPhotoAbsolue` à une carte, une fois, à la réception. */
const resoudre = (carte: CarteEtudianteData): CarteEtudianteData => ({
  ...carte,
  photo_url: urlPhotoAbsolue(carte.photo_url),
});

const parametres = (
  valeurs: Record<string, string | number | number[] | null | undefined>
) => {
  const p = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (valeur === null || valeur === undefined || valeur === '') continue;
    // Une liste part en valeurs séparées par des virgules ; une liste vide est
    // l'absence de filtre, et non un filtre qui ne retiendrait personne.
    if (Array.isArray(valeur)) {
      if (valeur.length > 0) p.set(cle, valeur.join(','));
      continue;
    }
    p.set(cle, String(valeur));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const chargerConfiguration = async (): Promise<ConfigurationCartes> =>
  (await apiFetch<{ data: ConfigurationCartes }>(`${BASE}/configuration`)).data;

export const chargerAnnees = async (): Promise<OptionAnnee[]> =>
  (await apiFetch<{ data: OptionAnnee[] }>(`${BASE}/filtres/annees`)).data;

export const chargerEcoles = async (anneeId: number | null): Promise<OptionEcole[]> =>
  (await apiFetch<{ data: OptionEcole[] }>(`${BASE}/filtres/ecoles${parametres({ annee_id: anneeId })}`)).data;

export const chargerFilieres = async (
  anneeId: number | null,
  ecoleId: number | null
): Promise<OptionFiliere[]> =>
  (
    await apiFetch<{ data: OptionFiliere[] }>(
      `${BASE}/filtres/filieres${parametres({ annee_id: anneeId, ecole_id: ecoleId })}`
    )
  ).data;

export const chargerNiveaux = async (
  anneeId: number | null,
  ecoleId: number | null,
  filiereId: number | null
): Promise<OptionNiveau[]> =>
  (
    await apiFetch<{ data: OptionNiveau[] }>(
      `${BASE}/filtres/niveaux${parametres({ annee_id: anneeId, ecole_id: ecoleId, filiere_id: filiereId })}`
    )
  ).data;

export const chargerGroupes = async (
  anneeId: number | null,
  ecoleId: number | null,
  filiereId: number | null,
  niveauIds: number[] | null
): Promise<OptionGroupe[]> =>
  (
    await apiFetch<{ data: OptionGroupe[] }>(
      `${BASE}/filtres/groupes${parametres({
        annee_id: anneeId,
        ecole_id: ecoleId,
        filiere_id: filiereId,
        niveau_ids: niveauIds,
      })}`
    )
  ).data;

export const chargerEtudiants = async (
  filtres: Filtres,
  recherche?: string
): Promise<{ data: CarteEtudianteData[]; total: number; total_filtres: number; lot_max: number }> => {
  const r = await apiFetch<{ data: CarteEtudianteData[]; total: number; total_filtres: number; lot_max: number }>(
    `${BASE}/etudiants${parametres({ ...filtres, recherche })}`
  );
  return { ...r, data: r.data.map(resoudre) };
};

export const chargerLot = async (
  filtres: Filtres,
  etudiantIds?: number[],
  /** Transmise au serveur : « imprimer tous les étudiants filtrés » doit porter
      sur ce que l'agent a sous les yeux, recherche comprise. */
  recherche?: string
): Promise<{
  data: CarteEtudianteData[];
  total: number;
  pages: number;
  incomplets: number;
  sans_photo: number;
}> => {
  const r = await apiFetch<{
    data: CarteEtudianteData[];
    total: number;
    pages: number;
    incomplets: number;
    sans_photo: number;
  }>(`${BASE}/lot`, {
    method: 'POST',
    body: JSON.stringify({
      ...filtres,
      ...(etudiantIds ? { etudiant_ids: etudiantIds } : {}),
      ...(recherche ? { recherche } : {}),
    }),
  });
  return { ...r, data: r.data.map(resoudre) };
};

export const chargerMaCarte = async (): Promise<CarteEtudianteData> =>
  resoudre((await apiFetch<{ data: CarteEtudianteData }>(`${BASE}/ma-carte`)).data);

// ─────────────────────────────────────────────────────────────────────────────
// Impression
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Règles d'impression des cartes.
 *
 * LA CONTRAINTE CENTRALE : une face = une page, jamais deux faces sur la même
 * page. Elle est obtenue par `@page { size: 85.6mm 53.98mm }` — la page EST la
 * carte. Chaque `.ci-page` force ensuite une rupture après elle, et interdit
 * toute rupture à l'intérieur. Un lot de 100 étudiants produit donc exactement
 * 200 pages, dans l'ordre recto₁, verso₁, recto₂, verso₂…
 *
 * `margin: 0` est indispensable : la moindre marge réduirait la surface
 * imprimable sous 85,6 mm et le navigateur réduirait la carte pour la faire
 * tenir, ce qui casserait le format physique.
 *
 * Aucune mise à l'échelle n'est appliquée (pas de `transform: scale`) : la carte
 * doit sortir à 100 %, et c'est au réglage d'impression de ne pas la réduire.
 */
export const STYLES_IMPRESSION_CARTES = `
${STYLES_CARTE_ETUDIANTE}

.ci-page {
  width: ${CARTE_LARGEUR_MM}mm;
  height: ${CARTE_HAUTEUR_MM}mm;
  overflow: hidden;
}

@page {
  size: ${CARTE_LARGEUR_MM}mm ${CARTE_HAUTEUR_MM}mm;
  margin: 0;
}

@media print {
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #FFFFFF !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .ci-page {
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
    margin: 0 !important;
    /* Les angles arrondis sont ceux de la carte physique découpée ; à
       l'impression la page est rectangulaire et le fond doit aller bord à bord. */
    border-radius: 0;
  }
  .ci-page:last-child { page-break-after: auto; break-after: auto; }
  .ci-carte { border-radius: 0; box-shadow: none !important; }
}
`;

/**
 * Ouvre le document imprimable dans UN seul onglet — jamais une fenêtre par
 * étudiant — et déclenche l'impression.
 *
 * `window.open` doit être appelé de façon synchrone depuis le clic : après un
 * `await`, le navigateur a perdu l'activation utilisateur et bloque la fenêtre.
 * La fenêtre est donc ouverte par l'appelant et passée ici.
 */
export const ecrireDocumentImpression = (
  fenetre: Window,
  titre: string,
  contenuHtml: string,
  origine: string
) => {
  // `window.print()` est appelé depuis `body onload`, et non depuis un
  // `fenetre.onload` posé après coup : avec `document.write`, l'événement peut
  // avoir déjà été émis quand on s'y abonne. L'événement `load` attend par
  // ailleurs le chargement des images — le blason et les photos sont donc en
  // place avant l'impression, au lieu de sortir en blanc.
  fenetre.document.write(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>${titre}</title>
    <!-- La fenêtre est ouverte sur about:blank : sans cette base, les URL
         commençant par « / » (le blason, les photos) n'ont aucune origine à
         laquelle se rattacher et ne se chargent pas. -->
    <base href="${origine}/">
    <style>${STYLES_IMPRESSION_CARTES}</style>
    <script>
      // Le document imprime est du HTML STATIQUE : le repli React sur photo
      // introuvable n'y existe plus. Sans ce script, une photo dont le fichier
      // manque sur le serveur imprimerait l'icone d'image cassee du navigateur
      // sur une carte officielle. Pose en <head>, donc avant le chargement des
      // images ; en capture, car l'evenement « error » ne remonte pas.
      document.addEventListener('error', function (evenement) {
        var image = evenement.target;
        if (!image || image.tagName !== 'IMG' || !image.classList.contains('ci-photo')) return;
        var cadre = image.parentNode;
        if (!cadre) return;
        var initiales = image.getAttribute('data-initiales') || '';
        cadre.innerHTML =
          '<div class="ci-photo-absente">' +
          '<span class="ci-photo-initiales">' + initiales + '</span>' +
          '<span class="ci-photo-mention">PHOTO MANQUANTE</span></div>';
      }, true);
    </script>
  </head>
  <body onload="window.focus(); window.print();">${contenuHtml}</body>
</html>`);
  fenetre.document.close();
};

/**
 * Injecte une seule fois la feuille de style des cartes dans le document de
 * l'application, pour l'aperçu à l'écran. L'impression, elle, embarque ses
 * propres styles dans la fenêtre qu'elle ouvre.
 */
const ID_STYLES = 'styles-cartes-iipea';

export const injecterStylesCartes = () => {
  if (typeof document === 'undefined' || document.getElementById(ID_STYLES)) return;
  const balise = document.createElement('style');
  balise.id = ID_STYLES;
  balise.textContent = STYLES_CARTE_ETUDIANTE;
  document.head.appendChild(balise);
};

// ─── Verrouillage / Déverrouillage des photos étudiantes ─────────────────────

export type StatutVerrouillagePhotos = {
  verrouille: boolean;
  updated_at: string | null;
  modifie_par_id: number | null;
  modifie_par_nom: string | null;
};

export const chargerStatutVerrouillagePhotos = async (): Promise<StatutVerrouillagePhotos> =>
  (await apiFetch<{ data: StatutVerrouillagePhotos }>(`${BASE}/photos/verrouillage`)).data;

export const modifierVerrouillagePhotos = async (
  verrouille: boolean
): Promise<{ success: boolean; message: string; data: StatutVerrouillagePhotos }> =>
  await apiFetch<{ success: boolean; message: string; data: StatutVerrouillagePhotos }>(
    `${BASE}/photos/verrouillage`,
    {
      method: 'POST',
      body: JSON.stringify({ verrouille }),
    }
  );
