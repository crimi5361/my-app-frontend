// Source unique des moyens de paiement proposés pour un NOUVEAU paiement, réutilisée par tous
// les écrans d'encaissement (Caisse/Encaisser.tsx, Caisse/SituationEtudiant.tsx,
// Scolarite/EffectuerPayement.tsx, Components/KitTraitement).
//
// ⚠️ Doit rester synchronisé avec METHODES_VALIDES_NOUVEAU_PAIEMENT dans
// d:\my-app-backend\services\methodesPaiement.service.js — deux dépôts séparés (pas d'import
// cross-repo possible), toute évolution de la liste doit être répercutée manuellement des deux
// côtés. Ne concerne que l'écriture de nouveaux paiements : les paiements historiques enregistrés
// avec d'autres valeurs (Espèces avec accent) restent affichés tels quels partout où ils sont
// lus, cette liste ne gate que la sélection.
export const METHODES_PAIEMENT = [
  { value: 'especes', label: 'Espèces' },
  { value: 'Mobile Money', label: 'Mobile Money' },
  { value: 'Orange Money', label: 'Orange Money' },
] as const;
