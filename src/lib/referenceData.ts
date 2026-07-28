import { apiFetch } from './api';

// Référentiel unique déjà utilisé par le portail public (D:\IIpea) — réutilisé ici tel quel pour
// que les listes déroulantes de la Vérification (Admissions et Réinscriptions) affichent
// exactement les mêmes valeurs, jamais une saisie libre divergente.
export interface Pays {
  id: number;
  code_iso: string;
  nom: string;
  nationalite: string;
}

export interface Ville {
  id: number;
  nom: string;
}

export interface SerieBac {
  id: number;
  nom: string;
}

export interface AnneeBac {
  id: number;
  nom: string;
}

export interface EtablissementOrigine {
  id: number;
  nom_etablissement: string;
  situation_geographique: string | null;
}

export interface ReferenceData {
  pays: Pays[];
  villes: Ville[];
  seriesBac: SerieBac[];
  anneesBac: AnneeBac[];
  etablissementsOrigine: EtablissementOrigine[];
}

export function getReferenceData() {
  return apiFetch<{ success: true; data: ReferenceData }>('/api/public/public/admission/reference-data');
}
