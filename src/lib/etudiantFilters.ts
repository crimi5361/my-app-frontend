export interface EtudiantFiltersValue {
  ecole_id?: number;
  academique_departement_id?: number;
  filiere_id?: number;
  /** Libellé exact du niveau (ex. "Licence 2") — pas un id : un même libellé existe sur
   * plusieurs filières (une ligne `niveau` par filière/année), le filtre doit rester indépendant
   * de la filière choisie. Backend : paramètre historique `niveau` (n.libelle), déjà supporté par
   * _construireFiltresEtudiants aux côtés de `niveau_id`. */
  niveau?: string;
  classe_id?: number;
  groupe_id?: number;
  curcus_id?: number;
  sexe?: string;
  statut_scolaire?: string;
}

/**
 * Sérialise les filtres combinables (école/département académique/filière/niveau/classe/
 * groupe/cursus/genre/statut) en query string — mêmes noms de paramètres que
 * _construireFiltresEtudiants côté backend (etudiant.controller.js). Réutilisée à l'identique
 * par la liste paginée ET l'export (Scolarité/Statuts.tsx, Etudiant/Etudiant.tsx), pour que les
 * deux écrans envoient toujours exactement les mêmes filtres à l'un et l'autre endpoint. Chaque
 * champ est indépendant des autres — aucun n'est jamais requis pour qu'un autre s'applique.
 */
export const buildFiltersQuery = (f: EtudiantFiltersValue): string => {
  const params = new URLSearchParams();
  if (f.ecole_id) params.set('ecole_id', String(f.ecole_id));
  if (f.academique_departement_id) params.set('academique_departement_id', String(f.academique_departement_id));
  if (f.filiere_id) params.set('filiere_id', String(f.filiere_id));
  if (f.niveau) params.set('niveau', f.niveau);
  if (f.classe_id) params.set('classe_id', String(f.classe_id));
  if (f.groupe_id) params.set('groupe_id', String(f.groupe_id));
  if (f.curcus_id) params.set('curcus_id', String(f.curcus_id));
  if (f.sexe) params.set('sexe', f.sexe);
  if (f.statut_scolaire) params.set('statut_scolaire', f.statut_scolaire);
  const qs = params.toString();
  return qs ? `&${qs}` : '';
};
