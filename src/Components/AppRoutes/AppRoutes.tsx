import { Route, Routes } from "react-router-dom";

// Dashboard
import Dashboard from "../../Pages/Dashboard/Dashboard";

// Scolarité
import Statuts from "../../Pages/Scolarite/Statuts";
import Paiements from "../../Pages/Scolarite/Paiements";
import Statistique from "../../Pages/Gestion_academique/Statistique";
import Effectifs from "../../Pages/Gestion_academique/Effectifs";
import Annes_accademique from "../../Pages/Gestion_academique/Annes_accademique";
import Salles from "../../Pages/Gestion_academique/Salles";
import Niviaux from "../../Pages/Gestion_academique/Niviaux";
import Filieres from "../../Pages/Gestion_academique/Filieres";
import Ecoles from "../../Pages/Gestion_academique/Ecoles";
import Departements from "../../Pages/Gestion_academique/Departements";
import Sites from "../../Pages/Gestion_academique/Sites";
import EtablissementsOrigine from "../../Pages/Gestion_academique/EtablissementsOrigine";
import Classes from "../../Pages/Gestion_academique/Classes";

import Cartes from "../../Pages/Etudiant/Cartes";
import Dossiers from "../../Pages/Etudiant/Dossiers";
import EffectifsEtudiant from "../../Pages/Etudiant/EffectifsEtudiant";
import InscriptionsEnAttente from "../../Pages/Etudiant/InscriptionsEnAttente";
import ListesMinistere from "../../Pages/Etudiant/ListesMinistere";
import NouvelleAdmission from "../../Pages/Etudiant/NouvelleAdmission";
import Reinscription from "../../Pages/Etudiant/Reinscription";
import Verification from "../../Pages/Etudiant/Verification";
import Maquettes from "../../Pages/Gestion_academique/Maquettes";
import Migrations from "../../Pages/Gestion_academique/Migrations";
import Resultats from "../../Pages/Gestion_academique/Professeur";

import Parametres from "../../Pages/Parametres/Parametres";
import ProtectedRoute from "../ProtectedRoute";
import Permission_user from "../../Pages/Parametres/Permission_user";
import Etudiant from "../../Pages/Etudiant/Etudiant";
import DetailEtudiant from "../../Pages/Etudiant/DetailEtudiant";
import EffectuerPayement from "../../Pages/Scolarite/EffectuerPayement";
import DetailClasse from "../../Pages/Gestion_academique/DetailClasse";
import DetailGroupe from "../../Pages/Gestion_academique/DetailGroupe";
import ListePEC from "../../Pages/Dashboard/ListePEC";
import RecuEtudiant from "../../Pages/Scolarite/RecuEtudiant";
import PriseEnchargeTraiter from "../../Pages/Dashboard/PriseEnchargeTraiter";
import CertidicatScolarite from "../../Pages/Etudiant/CertidicatScolarite";
import CertificatFrequentation from "../../Pages/Etudiant/CertificatFrequentation";
import DashScolarite from "../../Pages/Etudiant/DashScolarite";
import DetailMaquette from "../../Pages/Gestion_academique/DetailMaquette";
import Evaluation from "../../Pages/Gestion_academique/Evaluation";
import Resultat from "../../Pages/Gestion_academique/Resultat";
import NouvelleNote from "../../Pages/Gestion_academique/NouvelleNote";
import Professeur from "../../Pages/Gestion_academique/Professeur";
import GesMemoire from "../../Pages/Gestion_academique/GesMemoire";

// Caisse - Importer les pages
import CaisseDashboard from "../../Pages/CAISSE/CaisseDashboard";
import Encaisser from "../../Pages/CAISSE/Encaisser";
import RechercheEtudiantCaisse from "../../Pages/CAISSE/RechercheEtudiantCaisse";
import PaiementsJour from "../../Pages/CAISSE/PaiementsJour";
import FermerCaisse from "../../Pages/CAISSE/FermerCaisse";
import SituationEtudiant from "../../Pages/CAISSE/SituationEtudiant";
import StatsResultat from "../../Pages/Gestion_academique/StatsResultat";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Dashboard accessible par admin ET comptabilite */}
      <Route path="/dashboard" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "dashboard"]}>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/dashboard/ListePec" element={
        <ProtectedRoute requiredPermission={["admin", "fondateur"]}>
          <ListePEC />
        </ProtectedRoute>
      } />

      <Route path="/dashboard/PEC_traiter" element={
        <ProtectedRoute requiredPermission={["admin", "fondateur"]}>
          <PriseEnchargeTraiter />
        </ProtectedRoute>
      } />

      {/* Scolarité - accessible par comptabilite ET admin */}
      <Route path="/scolarite/statuts" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "scolarite"]}>
          <Statuts />
        </ProtectedRoute>
      } />
      
      <Route path="/scolarite/paiements" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "scolarite"]}>
          <Paiements />
        </ProtectedRoute>
      } />
      
      {/* Gestion académique - seulement admin */}
      <Route path="/Gestion_academique/Statistique" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique", "fondateur"]}>
          <Statistique />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Effectifs" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Effectifs />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Annes_accademique" element={
        <ProtectedRoute requiredPermission="admin">
          <Annes_accademique />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/Salles" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Salles />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Ecoles" element={
        <ProtectedRoute requiredPermission="admin">
          <Ecoles />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/EtablissementsOrigine" element={
        <ProtectedRoute requiredPermission="admin">
          <EtablissementsOrigine />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/Departements" element={
        <ProtectedRoute requiredPermission="admin">
          <Departements />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/Sites" element={
        <ProtectedRoute requiredPermission="admin">
          <Sites />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/Filieres" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Filieres />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/Niviaux" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Niviaux />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Classes" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Classes />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Maquettes" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Maquettes />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/DetailMaquette/:id" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <DetailMaquette />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Resultats" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Resultats />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Migrations" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Migrations />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Memoires" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <GesMemoire />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/statistique_Resulat" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique", "fondateur"]}>
          <StatsResultat />
        </ProtectedRoute>
      } />

      <Route path="/Gestion_academique/Professeur" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Professeur />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/DetailClasse/:id" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <DetailClasse />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/DetailGroupe/:id" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <DetailGroupe />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Groupe-Evaluation/:id" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Evaluation />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Groupe-Resultats/:id" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <Resultat />
        </ProtectedRoute>
      } />
      
      <Route path="/Gestion_academique/Groupe-NouvelleNote/:id" element={
        <ProtectedRoute requiredPermission={["admin", "Gestion_academique"]}>
          <NouvelleNote />
        </ProtectedRoute>
      } />

      {/* Étudiant - accessible par scolarite ET admin */}
      <Route path="/Etudiant/Nouvelle_Admission" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <NouvelleAdmission />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Reinscription" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <Reinscription />
        </ProtectedRoute>
      } />

      <Route path="/Etudiant/Verification" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <Verification />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Dossiers" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <Dossiers />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Effectifs" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <EffectifsEtudiant />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Cartes" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <Cartes />
        </ProtectedRoute>
      } />

      <Route path="/Etudiant/Inscriptions_En_Attente" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <InscriptionsEnAttente />
        </ProtectedRoute>
      } />

      <Route path="/Etudiant/Listes_Ministere" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <ListesMinistere />
        </ProtectedRoute>
      } />

      <Route path="/Etudiant/Listes_Etudiant" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <Etudiant />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Details_Etudiant/:id" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant", "EtudiantArchivage"]}>
          <DetailEtudiant />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Effectuer_Payement/:id" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <EffectuerPayement />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Recu_Payement/:id" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant", "comptabilite", "caissier"]}>
          <RecuEtudiant />
        </ProtectedRoute>
      } />
      
      <Route path="/Etudiant/Certificat_Scolarite/:id" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <CertidicatScolarite />
        </ProtectedRoute>
      } />

      <Route path="/Etudiant/Certificat_Frequentation/:id" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant"]}>
          <CertificatFrequentation />
        </ProtectedRoute>
      } />

      <Route path="/Etudiant/DashScolarite" element={
        <ProtectedRoute requiredPermission={["admin", "scolarite", "Etudiant", "fondateur"]}>
          <DashScolarite />
        </ProtectedRoute>
      } />

      {/* CAISSE - Nouveau module */}
      <Route path="/caisse/dashboard" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "caissier"]}>
          <CaisseDashboard />
        </ProtectedRoute>
      } />

      <Route path="/caisse/encaisser" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "caissier"]}>
          <Encaisser />
        </ProtectedRoute>
      } />

      <Route path="/caisse/recherche" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "caissier"]}>
          <RechercheEtudiantCaisse />
        </ProtectedRoute>
      } />

      <Route path="/caisse/situation-etudiant" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "caissier"]}>
          <SituationEtudiant />
        </ProtectedRoute>
      } />

      <Route path="/caisse/paiements-jour" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "caissier"]}>
          <PaiementsJour />
        </ProtectedRoute>
      } />

      <Route path="/caisse/fermer" element={
        <ProtectedRoute requiredPermission={["admin", "comptabilite", "caissier"]}>
          <FermerCaisse />
        </ProtectedRoute>
      } />


      {/* Paramètres - seulement admin */}
      <Route path="/Parametres/gestion_utilisateur" element={
        <ProtectedRoute requiredPermission={["admin", "Parametres"]}>
          <Parametres />
        </ProtectedRoute>
      } />
      
      <Route path="/Parametres/gestion_permission" element={
        <ProtectedRoute requiredPermission={["admin", "Parametres"]}>
          <Permission_user />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppRoutes;