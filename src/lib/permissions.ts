// Permissions par rôle + par utilisateur (Chantier Moyens Généraux, Phase 1, corrigé le 2026-08-19).
//
// Complète lib/access.ts SANS le remplacer : PAGE_PERMISSIONS (rôle -> pages) continue de
// déterminer l'appartenance à un module — un collaborateur moyens_generaux voit toujours les 7
// pages du module. Ce fichier détermine ce que CE compte précis peut y faire — chaque page/bouton
// sensible vérifie une permission avant de s'afficher ou d'agir. Ce masquage est une amélioration
// UX uniquement : le backend revalide systématiquement (middleware/permission.middleware.js) —
// jamais l'inverse.
//
// Le catalogue affiché à l'écran d'administration (Pages/Parametres/Permission_user.tsx) n'est
// PAS figé ici : il vient de GET /api/utilisateurs/:id/permissions, déjà filtré côté backend au
// rôle de l'utilisateur sélectionné (table rolepermission). Ce fichier ne fournit que des
// libellés d'affichage (purement cosmétiques) et le regroupement par module.

const getStoredUser = (): { role?: string; permissions?: string[] } | null => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// admin garde toujours un accès complet, sans jamais avoir de ligne utilisateur_permission —
// même convention que côté backend (middleware/permission.middleware.js).
export const hasPermission = (code: string): boolean => {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  return (user.permissions || []).includes(code);
};

export const hasAnyPermission = (...codes: string[]): boolean => {
  const user = getStoredUser();
  if (!user) return false;
  if (user.role === 'admin') return true;
  const granted = user.permissions || [];
  return codes.some((code) => granted.includes(code));
};

// ── Affichage du catalogue (écran d'administration) ─────────────────────────────────────────
// Libellés connus — purement cosmétiques, la source de vérité reste le catalogue renvoyé par le
// backend (rolepermission). Un code de permission sans entrée ici retombe sur un libellé générique
// dérivé du code lui-même : rien ne bloque l'apparition d'une permission non encore "traduite" ici.
const LIBELLES_MODULE: Record<string, string> = {
  accessoire: 'Accessoires',
  fournisseur: 'Fournisseurs',
  commande: 'Commandes',
  reception: 'Réceptions',
  stock: 'Stock',
  distribution: 'Distribution',
  dashboard: 'Dashboard',
};

const LIBELLES_ACTION: Record<string, string> = {
  voir: 'Voir',
  gerer: 'Gérer',
  effectuer: 'Effectuer',
  ajuster: 'Ajuster',
};

const capitaliser = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s);

export interface PermissionCatalogueLigne {
  id: number;
  nom: string;
  description: string;
  accorde: boolean;
}

export interface PermissionAffichage {
  id: number;
  code: string;
  label: string;
  accorde: boolean;
}

export interface PermissionModuleAffichage {
  module: string;
  permissions: PermissionAffichage[];
}

// Regroupe une liste de permissions (renvoyée par GET /api/utilisateurs/:id/permissions, déjà
// filtrée côté backend au catalogue du rôle sélectionné) par "module" — le préfixe avant le point
// dans le code (ex. "accessoire.voir" -> module "accessoire"). Générique : ne suppose aucune
// liste figée de permissions, fonctionne pour n'importe quel rôle dont le catalogue évolue.
export function grouperParModule(permissions: PermissionCatalogueLigne[]): PermissionModuleAffichage[] {
  const groupes = new Map<string, PermissionModuleAffichage>();
  for (const p of permissions) {
    const [prefixe, suffixe = ''] = p.nom.split('.');
    if (!groupes.has(prefixe)) {
      groupes.set(prefixe, { module: LIBELLES_MODULE[prefixe] ?? capitaliser(prefixe), permissions: [] });
    }
    groupes.get(prefixe)!.permissions.push({
      id: p.id,
      code: p.nom,
      label: LIBELLES_ACTION[suffixe] ?? capitaliser(suffixe),
      accorde: p.accorde,
    });
  }
  return Array.from(groupes.values());
}
