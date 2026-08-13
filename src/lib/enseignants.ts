// Module Gestion des Enseignants (2026-08-11) — types et utilitaires partagés entre
// l'espace Chargé Pédagogique et l'espace RH.
//
// Les deux espaces manipulent les mêmes objets métier (candidature, enseignant, contrat,
// séance) vus sous des angles différents : les décrire une seule fois évite que la
// bannette du CP et l'écran de validation RH divergent sur la forme des données.
import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from './api';

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

export interface AnneeAcademique {
  id: number;
  annee: string;
  etat: string;
}

export interface Filiere {
  id: number;
  nom: string;
  sigle: string | null;
}

export interface ClasseCP {
  id: number;
  nom: string;
  filiere_id: number;
  niveau_id: number | null;
  annee_academique_id: number;
  filiere: string | null;
  sigle: string | null;
  niveau: string | null;
  annee_academique: string | null;
}

export interface Salle {
  id: number;
  code: string;
  nom: string;
  site_id: number;
  site_nom?: string;
  batiment: string | null;
  etage: string | null;
  capacite: number;
  type_salle: string;
  equipements: string | null;
  statut: 'actif' | 'inactif';
  observations: string | null;
}

export interface SalleDisponibilite {
  id: number;
  code: string;
  nom: string;
  capacite: number;
  type_salle: string;
  batiment: string | null;
  occupee: boolean;
  occupee_par_classe: string | null;
  occupee_par_matiere: string | null;
  occupee_de: string | null;
  occupee_a: string | null;
}

export interface Besoin {
  id: number;
  annee_academique_id: number;
  filiere_id: number;
  niveau_id: number | null;
  matiere_id: number | null;
  intitule: string;
  specialite_attendue: string | null;
  volume_horaire_prevu: number;
  nombre_postes: number;
  priorite: 'basse' | 'normale' | 'haute';
  statut: 'ouvert' | 'pourvu' | 'annule';
  commentaire: string | null;
  filiere: string | null;
  niveau: string | null;
  matiere: string | null;
  annee_academique: string | null;
  cree_par_nom: string | null;
  nb_offres: number;
  created_at: string;
}

export type StatutCandidature = 'recue' | 'preselectionnee' | 'transmise_rh' | 'validee' | 'refusee';

export interface CandidatureListe {
  id: number;
  reference: string;
  nom: string;
  prenoms: string;
  email: string;
  telephone: string | null;
  grade: string | null;
  specialite: string | null;
  annees_experience: number | null;
  statut: StatutCandidature;
  source: 'portail_public' | 'saisie_interne';
  cv_path: string | null;
  created_at: string;
  date_prevalidation: string | null;
  commentaire_cp: string | null;
  offre_titre: string | null;
  filieres_visees: string[];
}

export interface CandidatureDetail extends CandidatureListe {
  date_naissance: string | null;
  genre: string | null;
  nationalite: string | null;
  cv_original_name: string | null;
  lettre_motivation: string | null;
  commentaire_rh: string | null;
  motif_refus: string | null;
  date_decision: string | null;
  offre_reference: string | null;
  cp_evaluateur_nom: string | null;
  rh_valideur_nom: string | null;
  filieres: Filiere[];
  diplomes: {
    id: number;
    intitule: string;
    etablissement: string | null;
    annee_obtention: number | null;
    fichier_path: string | null;
  }[];
}

export interface Offre {
  id: number;
  reference: string;
  titre: string;
  description: string | null;
  specialite: string | null;
  besoin_id: number | null;
  besoin_intitule: string | null;
  filiere_id: number | null;
  niveau_id: number | null;
  site_id: number | null;
  filiere: string | null;
  niveau: string | null;
  site_nom: string | null;
  type_contrat: 'vacataire' | 'permanent' | 'mission';
  volume_horaire_indicatif: number | null;
  profil_recherche: string | null;
  date_publication: string | null;
  date_cloture: string | null;
  statut: 'brouillon' | 'publiee' | 'cloturee';
  publiee_par_nom: string | null;
  nb_candidatures: number;
}

export interface EnseignantListe {
  id: number;
  matricule: string;
  nom: string;
  prenoms: string;
  email: string;
  telephone: string | null;
  grade: string | null;
  specialite: string | null;
  cv_path: string | null;
  date_recrutement: string;
  statut: 'actif' | 'inactif';
  site_id: number | null;
  ecole_id: number | null;
  site_nom: string | null;
  ecole_nom: string | null;
  contrat_id: number | null;
  taux_horaire: string | null;
  volume_horaire_global: number | null;
  type_contrat: string | null;
  contrat_statut: string | null;
  nb_classes: number;
}

export interface Contrat {
  id: number;
  enseignant_id: number;
  annee_academique_id: number;
  matricule: string;
  nom: string;
  prenoms: string;
  grade: string | null;
  specialite: string | null;
  annee_academique: string | null;
  type_contrat: 'vacataire' | 'permanent' | 'mission';
  taux_horaire: string;
  volume_horaire_global: number;
  date_debut: string;
  date_fin: string | null;
  statut: 'actif' | 'suspendu' | 'termine';
  observations: string | null;
  classes: { id: number; nom: string }[];
  cout_previsionnel: string;
}

export interface EnseignantPlanifiable {
  id: number;
  matricule: string;
  nom: string;
  prenoms: string;
  grade: string | null;
  specialite: string | null;
  contrat_id: number;
  taux_horaire: string;
  volume_horaire_global: number;
  type_contrat: string;
  classes_autorisees: number[];
  heures_planifiees: string;
}

export interface Trame {
  id: number;
  annee_academique_id: number;
  classe_id: number;
  matiere_id: number | null;
  enseignant_id: number | null;
  intitule: string | null;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  type_seance: string;
  date_debut: string;
  date_fin: string;
  frequence: 'hebdomadaire' | 'quinzaine_paire' | 'quinzaine_impaire';
  statut: string;
  classe: string;
  matiere: string | null;
  filiere: string | null;
  niveau: string | null;
  enseignant_nom: string | null;
  enseignant_prenoms: string | null;
  nb_seances: number;
  nb_sans_salle: number;
}

export interface Seance {
  id: number;
  trame_id: number | null;
  classe_id: number;
  matiere_id: number | null;
  enseignant_id: number | null;
  salle_id: number | null;
  intitule: string | null;
  date_seance: string;
  heure_debut: string;
  heure_fin: string;
  type_seance: string;
  statut: 'planifiee' | 'confirmee' | 'annulee';
  observations: string | null;
  classe: string;
  matiere: string | null;
  salle_code: string | null;
  salle_nom: string | null;
  salle_capacite: number | null;
  enseignant_nom: string | null;
  enseignant_prenoms: string | null;
  filiere: string | null;
  niveau: string | null;
}

export interface ChargePedagogique {
  id: number;
  nom: string;
  email: string;
  statut: string;
  site_nom: string | null;
  affectations: {
    id: number;
    filiere_id: number;
    filiere: string;
    niveau_id: number | null;
    niveau: string | null;
  }[];
}

// ---------------------------------------------------------------------------
//  Libellés
// ---------------------------------------------------------------------------

export const JOURS_SEMAINE = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
];

export const LIBELLE_JOUR = (jour: number) =>
  JOURS_SEMAINE.find((j) => j.value === jour)?.label ?? '—';

export const STATUT_CANDIDATURE: Record<StatutCandidature, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  recue: { label: 'Reçue', tone: 'neutral' },
  preselectionnee: { label: 'Présélectionnée', tone: 'info' },
  transmise_rh: { label: 'Transmise aux RH', tone: 'warning' },
  validee: { label: 'Acceptée', tone: 'success' },
  refusee: { label: 'Refusée', tone: 'danger' },
};

export const STATUT_OFFRE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  brouillon: { label: 'Brouillon', tone: 'neutral' },
  publiee: { label: 'Publiée', tone: 'success' },
  cloturee: { label: 'Clôturée', tone: 'danger' },
};

export const TYPE_SALLE: Record<string, string> = {
  cours: 'Salle de cours',
  td: 'Salle de TD',
  tp: 'Salle de TP',
  amphi: 'Amphithéâtre',
  labo: 'Laboratoire',
  informatique: 'Salle informatique',
};

/** '08:00:00' → '08:00' : les secondes renvoyées par PostgreSQL n'apportent rien à l'écran. */
export const formatHeure = (heure?: string | null) => (heure ? heure.slice(0, 5) : '—');

export const formatDate = (date?: string | null) =>
  date ? new Date(date).toLocaleDateString('fr-FR') : '—';

export const formatMontant = (montant?: string | number | null) =>
  montant == null ? '—' : `${Number(montant).toLocaleString('fr-FR')} FCFA`;

export const nomComplet = (nom?: string | null, prenoms?: string | null) =>
  [prenoms, nom].filter(Boolean).join(' ') || '—';

// ---------------------------------------------------------------------------
//  Hook années académiques
// ---------------------------------------------------------------------------

/** Identité de l'agent connecté, telle que stockée à la connexion. */
export function getUtilisateurCourant() {
  try {
    const brut = localStorage.getItem('user');
    if (!brut) return null;
    const user = JSON.parse(brut);
    if (!user.departement_id) {
      const siteId = localStorage.getItem('departement_id');
      if (siteId) user.departement_id = parseInt(siteId, 10);
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Années académiques du site, avec présélection de l'année en cours.
 * Repris à l'identique des dashboards existants ('en cour' / 'en cours' cohabitent en
 * base), mais factorisé : les six écrans de ce module en ont tous besoin.
 */
export function useAnneesAcademiques() {
  const utilisateur = getUtilisateurCourant();
  const siteId = utilisateur?.departement_id;

  const [annees, setAnnees] = useState<AnneeAcademique[]>([]);
  const [anneeId, setAnneeId] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setErreur('Site introuvable. Veuillez vous reconnecter.');
      setChargement(false);
      return;
    }
    apiFetch<AnneeAcademique[]>(`/api/annees?site_id=${siteId}`)
      .then((data) => {
        setAnnees(data);
        const enCours = data.find((a) => a.etat === 'en cour' || a.etat === 'en cours');
        setAnneeId(enCours ? enCours.id : data[0]?.id ?? null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setErreur('Impossible de charger les années académiques.');
      })
      .finally(() => setChargement(false));
  }, [siteId]);

  return { annees, anneeId, setAnneeId, chargement, erreur, siteId };
}
