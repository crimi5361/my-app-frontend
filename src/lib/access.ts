import { GraduationCap, Coins, Landmark, Award, Settings2, type LucideIcon } from 'lucide-react';

/**
 * Source unique de vérité pour les accès par rôle.
 * Remplace les copies auparavant dupliquées (et désynchronisées) dans
 * ProtectedRoute.tsx, Sidemenu.tsx et App.tsx.
 */
export const PAGE_PERMISSIONS: Record<string, string[]> = {
  // "caissier" est requis par les gardes de route (ProtectedRoute/AppRoutes),
  // "caisse" par le filtre de menu (Sidemenu) — les deux coexistent le temps
  // qu'un seul vocabulaire soit adopté partout.
  admin: ['admin', 'scolarite', 'comptabilite', 'caissier', 'caisse', 'dashboard', 'Gestion_academique', 'Etudiant', 'Parametres'],
  scolarite: ['Etudiant', 'Gestion_academique'],
  comptabilite: ['comptabilite', 'dashboard', 'scolarite', 'caisse'],
  // Le caissier est chez lui dans "Caisse" (son propre tableau de bord,
  // /caisse/dashboard) — pas de lien vers le Dashboard générique.
  caissier: ['caissier', 'caisse'],
  fondateur: ['dashboard', 'fondateur'],
  // Jeton dédié (distinct de "Etudiant", qui couvre tout le module Scolarité) pour ne
  // donner accès qu'à la fiche Détails Étudiant, pas à Nouvelle Admission/Réinscription/etc.
  // Pas d'entrée HUB_APPS : l'archiviste ouvre la page via un lien direct, pas via le Hub.
  archiviste: ['EtudiantArchivage'],
};

export interface HubApp {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
  landingRoute: string;
  roles: string[];
}

export const HUB_APPS: HubApp[] = [
  {
    slug: 'scolarite',
    label: 'Scolarité / Vie Académique',
    description: 'Gestion académique, admissions, effectifs, mémoires',
    icon: GraduationCap,
    landingRoute: '/Etudiant/Listes_Etudiant',
    roles: ['admin', 'scolarite'],
  },
  {
    slug: 'caisse',
    label: 'Caisse',
    description: 'Encaissements, reçus, paiements du jour',
    icon: Coins,
    landingRoute: '/caisse/dashboard',
    roles: ['admin', 'caissier'],
  },
  {
    slug: 'comptabilite',
    label: 'Comptabilité',
    description: 'Statuts, historique des paiements, inscriptions en attente',
    icon: Landmark,
    landingRoute: '/scolarite/statuts',
    roles: ['admin', 'comptabilite'],
  },
  {
    slug: 'fondateur',
    label: 'Espace Fondateur',
    description: 'Vue d\'ensemble, statistiques, prise en charge',
    icon: Award,
    landingRoute: '/dashboard',
    roles: ['admin', 'fondateur'],
  },
  {
    slug: 'administration',
    label: 'Administration',
    description: 'Gestion des utilisateurs et des permissions',
    icon: Settings2,
    landingRoute: '/Parametres/gestion_utilisateur',
    roles: ['admin'],
  },
];
