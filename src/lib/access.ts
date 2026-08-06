import { GraduationCap, Coins, Landmark, Award, Settings2, Package, type LucideIcon } from 'lucide-react';

/**
 * Source unique de vérité pour les accès par rôle.
 * Remplace les copies auparavant dupliquées (et désynchronisées) dans
 * ProtectedRoute.tsx, Sidemenu.tsx et App.tsx.
 */
export const PAGE_PERMISSIONS: Record<string, string[]> = {
  // "caissier" est requis par les gardes de route (ProtectedRoute/AppRoutes),
  // "caisse" par le filtre de menu (Sidemenu) — les deux coexistent le temps
  // qu'un seul vocabulaire soit adopté partout.
  admin: ['admin', 'scolarite', 'comptabilite', 'caissier', 'caisse', 'dashboard', 'Gestion_academique', 'Etudiant', 'Parametres', 'moyens_generaux'],
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
  // Moyens Généraux (Chantier 10) — chez lui dans son propre module, même principe que caissier :
  // pas de lien vers le Dashboard générique.
  moyens_generaux: ['moyens_generaux'],
};

/**
 * Dashboard métier de chaque rôle — un seul dashboard par métier (2026-08-02).
 * L'ancien Dashboard générique (/dashboard) est retiré du parcours utilisateur : toute
 * destination "accueil/retour" (logo, racine "/", ancienne URL /dashboard) doit résoudre vers
 * cette table plutôt que vers une route en dur, pour rester centralisée et cohérente partout
 * (Header, Sidemenu, App.tsx). Rôles sans dashboard dédié pour l'instant (archiviste) : absents
 * de la table, repli explicite sur /hub dans getDashboardRouteForRole.
 */
export const ROLE_DASHBOARD_ROUTE: Record<string, string> = {
  fondateur: '/dashboard/fondateur',
  admin: '/dashboard/administrateur',
  scolarite: '/dashboard/scolarite',
  comptabilite: '/dashboard/comptabilite',
  caissier: '/caisse/dashboard',
  moyens_generaux: '/dashboard/moyensgeneraux',
};

export function getDashboardRouteForRole(role?: string | null): string {
  if (role && ROLE_DASHBOARD_ROUTE[role]) return ROLE_DASHBOARD_ROUTE[role];
  return '/hub';
}

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
    landingRoute: '/dashboard/scolarite',
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
    description: 'Recettes consolidées, statuts, historique des paiements',
    icon: Landmark,
    landingRoute: '/dashboard/comptabilite',
    roles: ['admin', 'comptabilite'],
  },
  {
    slug: 'fondateur',
    label: 'Espace Fondateur',
    description: 'Pilotage stratégique de toute l\'institution',
    icon: Award,
    landingRoute: '/dashboard/fondateur',
    roles: ['admin', 'fondateur'],
  },
  {
    slug: 'administration',
    label: 'Administration',
    description: 'Agents, rôles, cloisonnement par école, structure académique',
    icon: Settings2,
    landingRoute: '/dashboard/administrateur',
    roles: ['admin'],
  },
  {
    slug: 'moyens-generaux',
    label: 'Moyens Généraux',
    description: 'Stock, fournisseurs et distribution des accessoires institutionnels',
    icon: Package,
    landingRoute: '/dashboard/moyensgeneraux',
    roles: ['admin', 'moyens_generaux'],
  },
];
