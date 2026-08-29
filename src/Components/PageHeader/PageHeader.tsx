import React from "react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  // Dashboard
  "/dashboard": "Vue générale du tableau de bord",
  "/dashboard/ListePec": "Liste des PEC",
  "/dashboard/PEC_traiter": "Prise en charge traiter",

  // Enseignant
  "/enseignants/enregistrement": "Page des enregistrements",
  "/enseignants/contrat": "Gestion des contrats",
  "/enseignants/liste": "Liste des enseignants",

  // Scolarité
  "/scolarite/statuts": "Gestion des statuts",
  "/scolarite/paiements": "Suivi des paiements",
  "/scolarite/inscription_attentes": "Inscriptions en attente",

  // Progression
  "/progression/global_progress": "Progression globale",
  "/progression/progress": "Suivi des progrès",

  // Transport
  "/transport/vehicules": "Liste des véhicules",
  "/transport/itineraires": "Gestion des itinéraires",
  "/transport/abonnements": "Abonnements de transport",

  // Caisse
  "/caisse/dashboard": "Tableau de bord de la caisse",
  "/caisse/encaisser": "Encaisser un paiement",
  "/caisse/recherche": "Rechercher un étudiant",
  "/caisse/situation-etudiant": "Situation et paiements de l'étudiant",
  "/caisse/paiements-jour": "Paiements du jour",
  "/caisse/reçus": "Mes reçus",
  "/caisse/fermer": "Fermer la caisse",
  "/caisse/gestion-kits": "Gestion des Kits — régularisation",

  // Gestion académique
  "/Gestion_academique/Statistique": "Statistiques académiques",
  "/Gestion_academique/Effectifs": "Effectifs généraux",
  "/Gestion_academique/Annes_accademique": "Années académiques",
  "/Gestion_academique/Salles": "Gestion des salles",
  "/Gestion_academique/Filieres": "Gestion des filières",
  "/Gestion_academique/Niviaux": "Niveaux d'études",
  "/Gestion_academique/EtablissementsOrigine": "Établissements d'origine",
  "/Gestion_academique/Classes": "Gestion des classes",
  "/Gestion_academique/Maquettes": "Maquettes pédagogiques",
  "/Gestion_academique/Resultats": "Résultats académiques",
  "/Gestion_academique/Migrations": "Gestion des équivalences",
  "/Gestion_academique/OrientationsReinscription": "Orientations de réinscription",
  "/Gestion_academique/Fusion": "Fusion des classes ou filières",
  "/Gestion_academique/DetailMaquette/": "Détails de la maquette",
  "/Gestion_academique/Groupe-Evaluation/:id": "Evaluation du Groupe",
  "/Gestion_academique/Groupe-Resultats/:id": "Résultats du Groupe",
  "/Gestion_academique/Groupe-NouvelleNote/:id": "Nouvelle note du Groupe",
  "/Gestion_academique/Professeur": "Gestion professeur",
  "/Gestion_academique/Professeur_detail/:id": "Detail complet sur les prof",

  // Étudiant
  "/Etudiant/Nouvelle_Admission": "Nouvelle admission étudiant",
  "/Etudiant/Reinscription": "Réinscription étudiant",
  "/Etudiant/Verification": "Vérification des informations",
  "/Etudiant/Dossiers": "Dossiers étudiants",
  "/Etudiant/Effectifs": "Effectifs étudiants",
  "/Etudiant/Cartes": "Cartes étudiantes",
  "/Etudiant/Listes_Ministere": "Listes transmises au ministère",
  "/Etudiant/Listes_Etudiant": "Liste des étudiants",
  "/Etudiant/Details_Etudiant/:id": "Détails de l'etudiant",
  "/Etudiant/Certificat_Scolarite/:id": "Certificat de scolarité",
  "/Etudiant/Certificat_Frequentation/:id": "Certificat de frequentation",
  "/Etudiant/DashScolarite": "DashScolarite",

  // Dossier L3
  "/Dossier_l3/Nouveau": "Nouveau dossier L3",
  "/Dossier_l3/Liste_Dossiers": "Liste des dossiers L3",
  "/Dossier_l3/Dossier_Djabou": "Dossier Djabou",
  "/Dossier_l3/Invoice_Plus": "Gestion des factures avancées",

  // Moyens Généraux
  "/Moyens_Generaux/Etat_du_stock": "État du stock",
  "/Moyens_Generaux/Fournisseurs": "Liste des fournisseurs",
  "/Moyens_Generaux/Commandes": "Commandes en cours",
  "/Moyens_Generaux/Reception_Commande": "Réception des commandes",
  "/Moyens_Generaux/Kit_et_Accessoires": "Kits et accessoires disponibles",

  // Parametre
  "/Parametres/gestion_utilisateur": "Gestion utilisateur",
  "/Parametres/gestion_permission": "Gestion permission utilisateur",
};

const formatSegment = (segment: string) => {
  if (!segment) return "";
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/_/g, " ");
};

const PageHeader: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  const segments = path.split("/").filter(Boolean);
  const folder = segments[0] ? formatSegment(segments[0]) : "Accueil";
  const page = segments[1] ? formatSegment(segments[1]) : "";
  const fullPath = `/${segments.join("/")}`;

  const title = titles[fullPath] || " ";

  return (
    <div className="p-4">
      <div className="text-sl text-[var(--text-soft)] font-semibold">
        {folder} / {page} / {title}
      </div>
    </div>
  );
};

export default PageHeader;