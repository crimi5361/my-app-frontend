export interface User {
  id: number;
  nom: string;
  email: string;
  statut: 'active' | 'desactive';
  role: string;
  departementName: string;
  // Site/departement de l'utilisateur — lu directement depuis cet objet par de nombreuses pages
  // (ex. Niviaux.tsx::getDepartementId) pour scoper leurs requetes. Doit rester synchronise avec
  // la cle localStorage separee "departement_id".
  departement_id?: number;
  // Permissions individuelles (Chantier Moyens Généraux, Phase 1, 2026-08-19) — n'affine les
  // droits qu'à L'INTÉRIEUR d'un module déjà autorisé par le rôle ; un admin n'en a pas besoin
  // (accès complet géré séparément, voir lib/permissions.ts::hasPermission).
  permissions?: string[];
}
