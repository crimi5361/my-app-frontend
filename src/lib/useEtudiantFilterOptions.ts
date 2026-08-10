import { useEffect, useState } from 'react';
import { apiFetch } from './api';

export interface FiliereOption {
  id: number;
  nom: string;
  sigle: string;
  departement_id: number | null;
  niveaux: { id: number; libelle: string }[];
}

export interface ClasseOption {
  id: number;
  nom: string;
  filiere: string;
  niveau: string;
}

export interface GroupeOption {
  id: number;
  nom: string;
  classeNom: string;
}

export interface CurcusOption {
  id: number;
  type_parcours: string;
}

const parseNiveauNumero = (libelle: string): number => {
  const match = libelle.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

/**
 * Charge les référentiels utilisés par les filtres de colonnes de "Gestion des statuts" et
 * "Liste des étudiants" — chaque liste est renvoyée à plat, sans dépendance envers un autre
 * filtre (comportement DataGrid façon Excel/Ant Design Table demandé par l'utilisateur : chaque
 * colonne filtre indépendamment des autres).
 *
 * - Niveau : dédupliqué par libellé (un même libellé "Licence 2" existe sur plusieurs filières,
 *   une ligne `niveau` par filière/année en base) — le filtre envoie le libellé au paramètre
 *   historique `niveau` (n.libelle), pas un id, pour ne jamais dépendre de la filière choisie.
 * - Groupe : aucun endpoint ne liste tous les groupes d'une année (seulement
 *   /api/decoupage/classes/:id, par classe) — agrégé ici côté client à partir de la liste des
 *   classes de l'année, sans backend supplémentaire, pour obtenir une liste plate immédiatement
 *   utilisable sans avoir à choisir une classe au préalable.
 */
export function useEtudiantFilterOptions(anneeAcademiqueId: number | null) {
  const [filieres, setFilieres] = useState<FiliereOption[]>([]);
  const [classes, setClasses] = useState<ClasseOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [groupes, setGroupes] = useState<GroupeOption[]>([]);
  const [loadingGroupes, setLoadingGroupes] = useState(false);
  const [curcusListe, setCurcusListe] = useState<CurcusOption[]>([]);

  useEffect(() => {
    apiFetch<FiliereOption[]>('/api/filieres/table/Filiere').then(setFilieres).catch(() => setFilieres([]));
    apiFetch<CurcusOption[]>('/api/curcus').then(setCurcusListe).catch(() => setCurcusListe([]));
  }, []);

  useEffect(() => {
    if (!anneeAcademiqueId) {
      setClasses([]);
      setGroupes([]);
      return;
    }
    let cancelled = false;
    setLoadingClasses(true);
    setLoadingGroupes(true);

    apiFetch<{ data: ClasseOption[] }>(`/api/decoupage/classes?anneeAcademiqueId=${anneeAcademiqueId}`)
      .then(async (res) => {
        const classeList = res.data || [];
        if (cancelled) return;
        setClasses(classeList);
        setLoadingClasses(false);

        // Le groupe primaire (technique, "non répartis") ne doit jamais apparaître dans une liste
        // /filtre destinée à l'agent — même règle que le masquage de groupe_nom déjà appliqué côté
        // backend pour les étudiants non encore répartis (voir etudiant.controller.js, Chantier 11).
        const parClasse = await Promise.all(
          classeList.map((cl) =>
            apiFetch<{ data: { groupes_pedagogiques: { id: number; nom: string }[] } }>(
              `/api/decoupage/classes/${cl.id}`
            )
              .then((detail) =>
                (detail.data?.groupes_pedagogiques || []).map((g) => ({ id: g.id, nom: g.nom, classeNom: cl.nom }))
              )
              .catch(() => [] as GroupeOption[])
          )
        );
        if (!cancelled) setGroupes(parClasse.flat());
      })
      .catch(() => {
        if (!cancelled) setClasses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingGroupes(false);
      });

    return () => { cancelled = true; };
  }, [anneeAcademiqueId]);

  const niveauLibelles = Array.from(new Set(filieres.flatMap((f) => f.niveaux.map((n) => n.libelle))))
    .sort((a, b) => {
      const diff = parseNiveauNumero(a) - parseNiveauNumero(b);
      return diff !== 0 ? diff : a.localeCompare(b, 'fr');
    });

  return { filieres, niveauLibelles, classes, loadingClasses, groupes, loadingGroupes, curcusListe };
}
