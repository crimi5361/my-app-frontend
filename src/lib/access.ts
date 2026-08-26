import { GraduationCap, Coins, Landmark, Award, Settings2, Package, CalendarRange, BriefcaseBusiness, Activity, type LucideIcon } from 'lucide-react';

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
  // Module Gestion des Enseignants (2026-08-11). Deux métiers distincts, deux applications :
  //   • le Chargé Pédagogique planifie et pré-évalue, dans le seul périmètre de ses filières ;
  //   • les RH publient, valident et contractualisent.
  // "Gestion_academique" est volontairement absent des deux : ni l'un ni l'autre n'a à
  // toucher au référentiel académique (filières, niveaux, maquettes), qui reste à la
  // scolarité et à l'administration.
  charge_pedagogique: ['charge_pedagogique', 'planning'],
  rh: ['rh'],
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
  charge_pedagogique: '/charge-pedagogique/dashboard',
  rh: '/rh/dashboard',
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
  /**
   * Tuile invisible a qui n'y a pas droit, au lieu d'etre montree cadenassee.
   *
   * Le hub affiche NORMALEMENT toutes les tuiles, verrouillees pour les roles
   * qui n'y ont pas acces : c'est voulu, cela dit ce que la plateforme sait
   * faire. Mais une tuile « Console de l'assistante » cadenassee devant le
   * fondateur lui apprend qu'une console existe, et qu'elle lui est refusee.
   * C'est deja trop : il ne doit rien savoir de la technique qui le sert.
   */
  discret?: boolean;
}

/**
 * Modules RETIRES DE L'ECRAN, sans etre retires du code.
 *
 * Ni tuile dans le hub, ni groupe dans le menu lateral. Les routes, elles,
 * continuent de fonctionner : c'est un masquage, pas une suppression, et il se
 * defait en retirant une ligne d'ici.
 *
 * CE QUE CE MASQUAGE COUTE, ET QU'IL FAUT SAVOIR : quatre comptes actifs portent
 * ces deux roles (deux charges pedagogiques, deux RH). Masquer leur module leur
 * laisse une interface sans rien a cliquer — ils se connectent et ne voient
 * aucun menu. Si ces comptes doivent continuer a servir, il faut soit les
 * desactiver, soit retirer leur module de cette liste.
 *
 * Les deux vocabulaires cohabitent dans le code — le hub dit
 * « charge-pedagogique », le menu dit « charge_pedagogique ». `estMasque`
 * normalise, pour qu'un seul endroit suffise a decider.
 */
export const MODULES_MASQUES: string[] = ['charge_pedagogique', 'rh'];

/** Ce module est-il retire de l'ecran ? Tirets et soulignes y sont equivalents. */
export function estMasque(cle: string): boolean {
  return MODULES_MASQUES.includes(String(cle).replace(/-/g, '_'));
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
    // ADMIN SEUL, et le fondateur en est deliberement absent bien qu'il ait
    // acces a tout le reste de l'assistante. Cet ecran parle de credits, de
    // facturation et de replis de modele : precisement ce que l'assistante
    // s'applique a ne jamais lui dire. Le serveur refuse deja ce role sur les
    // routes correspondantes ; l'omettre ici evite de lui montrer une porte
    // qui se fermerait devant lui.
    slug: 'console-assistant',
    discret: true,
    label: "Console de l'assistante",
    description: "Sante des services, credits, et ce que l'assistante peut lire",
    icon: Activity,
    landingRoute: '/console-assistant',
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
  {
    slug: 'charge-pedagogique',
    label: 'Chargé Pédagogique',
    description: 'Besoins en enseignants, emploi du temps et allocation des salles',
    icon: CalendarRange,
    landingRoute: '/charge-pedagogique/dashboard',
    roles: ['admin', 'charge_pedagogique'],
  },
  {
    slug: 'rh',
    label: 'Ressources Humaines',
    description: 'Offres, candidatures enseignants, accès et contractualisation',
    icon: BriefcaseBusiness,
    landingRoute: '/rh/dashboard',
    roles: ['admin', 'rh'],
  },
];

/**
 * Les tuiles qu'un role donne doit VOIR sur le hub.
 *
 * Trois regles, dans cet ordre : un module masque ne parait jamais ; une tuile
 * discrete ne parait qu'a qui y a droit ; tout le reste parait, cadenasse au
 * besoin. Le hub ne decide plus rien lui-meme — le calcul est ici, en un seul
 * endroit, pour qu'un test puisse le verifier sans monter React.
 */
export function appsVisiblesPour(role?: string | null): HubApp[] {
  return HUB_APPS.filter((app) => {
    if (estMasque(app.slug)) return false;
    if (app.discret) return app.roles.includes(role || '');
    return true;
  });
}
