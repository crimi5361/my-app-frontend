import { Menu } from "antd";
import {
  DashboardOutlined,
  ReadOutlined,
  TeamOutlined,
  BankOutlined,
  SettingOutlined,
  FileTextOutlined,
  SolutionOutlined,
  AppstoreAddOutlined,
  UserSwitchOutlined,
  CreditCardOutlined,
  IdcardOutlined,
  DollarOutlined,
  HistoryOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  ClusterOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  GiftOutlined,
  DatabaseOutlined,
  UsergroupAddOutlined,
  ScheduleOutlined,
  CalendarOutlined,
  InboxOutlined,
  ApartmentOutlined,
  AuditOutlined,
} from "@ant-design/icons";

import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { BookDashedIcon, Sparkles } from "lucide-react";
import { PAGE_PERMISSIONS, getDashboardRouteForRole } from "../../lib/access";

interface SidemenuProps {
  isSidemenuOpen: boolean;
}

const Sidemenu: React.FC<SidemenuProps> = ({ isSidemenuOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const currentUserRole = JSON.parse(localStorage.getItem("user") || "{}")?.role || "scolarite";

  const allowedKeys = PAGE_PERMISSIONS[currentUserRole] || [];

  // Un item n'est affiché que si le rôle courant a réellement accès à sa route (même logique
  // que ProtectedRoute) — sinon le menu affichait des liens qui redirigeaient silencieusement
  // vers /hub au clic. `permission` doit toujours reprendre exactement le `requiredPermission`
  // déclaré pour cette route dans AppRoutes.tsx.
  const hasPermission = (permission: string | string[]) => {
    const required = Array.isArray(permission) ? permission : [permission];
    return required.some((perm) => allowedKeys.includes(perm));
  };
  const filterChildren = <T extends { permission: string | string[] }>(children: T[]) =>
    children.filter((child) => hasPermission(child.permission));

  useEffect(() => {
    const path = location.pathname;
    const segments = path.split("/");
    const mainKey = segments[1];
    setSelectedKey(path);
    if (mainKey && !openKeys.includes(mainKey)) {
      setOpenKeys([mainKey]);
    }
  }, [location.pathname, openKeys]);

  const handleClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  // Seuls admin et fondateur voient la section Dashboard complète
  // (tableau récapitulatif, prise en charge...) ; comptabilite n'a accès
  // qu'à son propre Dashboard métier, en lien direct.
  const isFullDashboardRole = currentUserRole === "admin" || currentUserRole === "fondateur";
  const monDashboard = getDashboardRouteForRole(currentUserRole);

  const dashboardMenuItem = isFullDashboardRole
    ? {
        key: "dashboard",
        icon: <DashboardOutlined />,
        label: "Dashboard",
        children: [
          {
            key: monDashboard,
            label: "Dashboard",
            icon: <AppstoreAddOutlined />,
          },
          {
            key: "/Etudiant/DashScolarite",
            label: "Tableau recapitulatif",
            icon: <DashboardOutlined />,
          },
          {
            key: "/dashboard/ListePec",
            label: "Prise en charge",
            icon: <SolutionOutlined />,
          },
          {
            key: "/dashboard/PEC_traiter",
            label: "Prise en charge traiter",
            icon: <SolutionOutlined />,
          },
        ],
      }
    : {
        key: monDashboard,
        icon: <DashboardOutlined />,
        label: "Dashboard",
      };

  // Le fondateur n'a pas accès au reste de "Gestion académique" mais doit
  // pouvoir consulter les statistiques, partagées avec la scolarité.
  const fondateurStatsItem = {
    key: "fondateur-statistiques",
    icon: <BankOutlined />,
    label: "Statistiques",
    children: [
      { key: "/Gestion_academique/Statistique", label: "Statistique", icon: <AppstoreAddOutlined /> },
      { key: "/Gestion_academique/statistique_Resulat", label: "Statistique Resultat", icon: <AppstoreAddOutlined /> },
    ],
  };

  // Page dédiée à l'Assistant Fondateur (remplace le widget flottant) — lien direct,
  // pas de sous-menu, même principe que les autres entrées "chez soi" (caissier, moyens_generaux).
  const fondateurAssistantItem: { key: string; icon: React.ReactNode; label: string; children?: undefined } = {
    key: "/dashboard/fondateur/assistant",
    icon: <Sparkles size={14} />,
    label: "Assistant IA",
    children: undefined,
  };

  const menuItems = [
    {
      key: "scolarite",
      icon: <ReadOutlined />,
      label: "Comptabilité",
      children: [
        { key: "/scolarite/statuts", label: "Statuts", icon: <FileTextOutlined />, permission: ["admin", "comptabilite", "scolarite"] },
        { key: "/scolarite/paiements", label: "Historique Paiement", icon: <CreditCardOutlined />, permission: ["admin", "comptabilite", "scolarite"] },
      ],
    },
    {
      key: "caisse",
      icon: <DollarOutlined />,
      label: "Caisse",
      children: [
        { key: "/caisse/dashboard", label: "Tableau de bord", icon: <DashboardOutlined />, permission: ["admin", "comptabilite", "caissier"] },
        { key: "/caisse/encaisser", label: "Encaisser", icon: <CreditCardOutlined />, permission: ["admin", "comptabilite", "caissier"] },
        { key: "/caisse/recherche", label: "Rechercher étudiant", icon: <SolutionOutlined />, permission: ["admin", "comptabilite", "caissier"] },
        { key: "/caisse/situation-etudiant", label: "Situation étudiant", icon: <IdcardOutlined />, permission: ["admin", "comptabilite", "caissier"] },
        { key: "/caisse/paiements-jour", label: "Paiements du jour", icon: <HistoryOutlined />, permission: ["admin", "comptabilite", "caissier"] },
        { key: "/caisse/fermer", label: "Fermer la caisse", icon: <CloseCircleOutlined />, permission: ["admin", "comptabilite", "caissier"] },
      ],
    },
    {
      key: "Gestion_academique",
      icon: <BankOutlined />,
      label: "Gestion académique",
      children: [
        { key: "/Gestion_academique/Statistique", label: "Statistique", icon: <AppstoreAddOutlined />, permission: ["admin", "Gestion_academique", "fondateur"] },
        { key: "/Gestion_academique/statistique_Resulat", label: "Statistique Resultat", icon: <AppstoreAddOutlined />, permission: ["admin", "Gestion_academique", "fondateur"] },
        { key: "/Gestion_academique/Effectifs", label: "Effectifs", icon: <TeamOutlined />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/Annes_accademique", label: "Années", icon: <ReadOutlined />, permission: "admin" },
        { key: "/Gestion_academique/Salles", label: "Salles", icon: <BankOutlined />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/Ecoles", label: "Écoles", icon: <GlobalOutlined />, permission: "admin" },
        { key: "/Gestion_academique/Departements", label: "Départements", icon: <ClusterOutlined />, permission: "admin" },
        { key: "/Gestion_academique/Sites", label: "Sites", icon: <EnvironmentOutlined />, permission: "admin" },
        { key: "/Gestion_academique/EtablissementsOrigine", label: "Établissements d'origine", icon: <ReadOutlined />, permission: "admin" },
        { key: "/Gestion_academique/Filieres", label: "Filières", icon: <AppstoreAddOutlined />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/Niviaux", label: "Niveaux", icon: <AppstoreAddOutlined />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/Classes", label: "Classes", icon: <AppstoreAddOutlined />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/GestionGroupes", label: "Gestion des groupes", icon: <UsergroupAddOutlined />, permission: "admin" },
        { key: "/Gestion_academique/Maquettes", label: "Maquettes", icon: <AppstoreAddOutlined />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/Migrations", label: "Migrations", icon: <AppstoreAddOutlined />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/Memoires", label: "Memoires", icon: <BookDashedIcon />, permission: ["admin", "Gestion_academique"] },
        { key: "/Gestion_academique/Professeur", label: "Professeur", icon: <TeamOutlined />, permission: ["admin", "Gestion_academique"] },
      ],
    },
    {
      key: "Etudiant",
      icon: <TeamOutlined />,
      label: "Étudiants",
      children: [
        { key: "/Etudiant/Nouvelle_Admission", label: "Nouvelle Admission", icon: <UserSwitchOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Reinscription", label: "Ré-inscription", icon: <SolutionOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Verification", label: "Vérification", icon: <SafetyCertificateOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Dossiers", label: "Dossier", icon: <FileTextOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Effectifs", label: "Effectifs", icon: <TeamOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Cartes", label: "Cartes", icon: <IdcardOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Inscriptions_En_Attente", label: "Inscriptions en attente de paiement", icon: <SolutionOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Listes_Ministere", label: "Listes Ministère", icon: <ReadOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
        { key: "/Etudiant/Listes_Etudiant", label: "Listes Étudiants", icon: <UserSwitchOutlined />, permission: ["admin", "scolarite", "Etudiant"] },
      ],
    },
    {
      key: "moyens_generaux",
      icon: <GiftOutlined />,
      label: "Moyens Généraux",
      children: [
        { key: "/dashboard/moyensgeneraux", label: "Tableau de bord", icon: <DashboardOutlined />, permission: ["admin", "moyens_generaux"] },
        { key: "/moyens-generaux/accessoires", label: "Accessoires", icon: <AppstoreAddOutlined />, permission: ["admin", "moyens_generaux"] },
        { key: "/moyens-generaux/fournisseurs", label: "Fournisseurs", icon: <TeamOutlined />, permission: ["admin", "moyens_generaux"] },
        { key: "/moyens-generaux/commandes", label: "Commandes", icon: <SolutionOutlined />, permission: ["admin", "moyens_generaux"] },
        { key: "/moyens-generaux/stock", label: "Stock", icon: <DatabaseOutlined />, permission: ["admin", "moyens_generaux"] },
        { key: "/moyens-generaux/distribution", label: "Distribution", icon: <UserSwitchOutlined />, permission: ["admin", "moyens_generaux"] },
        { key: "/moyens-generaux/historique", label: "Historique", icon: <HistoryOutlined />, permission: ["admin", "moyens_generaux"] },
      ],
    },
    {
      key: "charge_pedagogique",
      icon: <ScheduleOutlined />,
      label: "Chargé Pédagogique",
      children: [
        { key: "/charge-pedagogique/dashboard", label: "Tableau de bord", icon: <DashboardOutlined />, permission: ["admin", "charge_pedagogique"] },
        { key: "/charge-pedagogique/besoins", label: "Besoins en enseignants", icon: <SolutionOutlined />, permission: ["admin", "charge_pedagogique"] },
        { key: "/charge-pedagogique/candidatures", label: "Bannette candidatures", icon: <InboxOutlined />, permission: ["admin", "charge_pedagogique"] },
        { key: "/charge-pedagogique/emploi-du-temps", label: "Emploi du temps", icon: <CalendarOutlined />, permission: ["admin", "charge_pedagogique"] },
        { key: "/charge-pedagogique/allocation-salles", label: "Allocation des salles", icon: <BankOutlined />, permission: ["admin", "charge_pedagogique"] },
        { key: "/charge-pedagogique/salles", label: "Référentiel des salles", icon: <ApartmentOutlined />, permission: ["admin", "charge_pedagogique"] },
      ],
    },
    {
      key: "rh",
      icon: <IdcardOutlined />,
      label: "Ressources Humaines",
      children: [
        { key: "/rh/dashboard", label: "Tableau de bord", icon: <DashboardOutlined />, permission: ["admin", "rh"] },
        { key: "/rh/offres", label: "Offres d'emploi", icon: <FileTextOutlined />, permission: ["admin", "rh"] },
        { key: "/rh/candidatures", label: "Candidatures", icon: <InboxOutlined />, permission: ["admin", "rh"] },
        { key: "/rh/enseignants", label: "Enseignants", icon: <TeamOutlined />, permission: ["admin", "rh"] },
        { key: "/rh/contrats", label: "Contrats", icon: <AuditOutlined />, permission: ["admin", "rh"] },
        { key: "/rh/charges-pedagogiques", label: "Chargés Pédagogiques", icon: <UserSwitchOutlined />, permission: ["admin", "rh"] },
      ],
    },
    {
      key: "Parametres",
      icon: <SettingOutlined />,
      label: "Paramètres",
      children: [
        { key: "/Parametres/gestion_utilisateur", label: "Gestion utilisateurs", icon: <TeamOutlined />, permission: ["admin", "Parametres"] },
        { key: "/Parametres/gestion_permission", label: "Gestion permissions", icon: <TeamOutlined />, permission: ["admin", "Parametres"] },
        { key: "/Parametres/dossiers_en_attente", label: "Dossiers en attente", icon: <DatabaseOutlined />, permission: "admin" },
      ],
    },
  ];

  const filteredMenuItems = [
    ...(allowedKeys.includes("dashboard") ? [dashboardMenuItem] : []),
    ...(currentUserRole === "fondateur" ? [fondateurAssistantItem, fondateurStatsItem] : []),
    ...menuItems
      .filter((item) => allowedKeys.includes(item.key))
      .map((item) => ({ ...item, children: filterChildren(item.children) }))
      .filter((item) => item.children.length > 0),
  ];

  // Avec peu d'onglets, un accordéon à replier/déplier n'apporte rien et
  // ajoute un clic inutile — on fige alors les groupes toujours ouverts
  // (rendu en groupe statique antd, sans flèche ni interaction de repli).
  // Au-delà de 3 onglets avec sous-menus (ex. admin), l'accordéon reste
  // pertinent pour ne pas tout afficher d'un bloc.
  const groupCount = filteredMenuItems.filter((item) => "children" in item && item.children).length;
  const useFixedGroups = groupCount <= 3;

  const displayItems = useFixedGroups
    ? filteredMenuItems.map((item) =>
        "children" in item && item.children
          ? { key: `group-${item.key}`, type: "group" as const, label: item.label, children: item.children }
          : item
      )
    : filteredMenuItems;

  return (
    <div
      className={`fixed top-0 left-0 z-40 pt-20 border-r bg-[var(--surface)] border-[var(--border)] transition-all duration-300 ${
        isSidemenuOpen ? "w-64" : "w-20"
      } h-screen overflow-y-auto`}
    >
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        openKeys={useFixedGroups ? undefined : (isSidemenuOpen ? openKeys : [])}
        onOpenChange={useFixedGroups ? undefined : handleOpenChange}
        onClick={handleClick}
        inlineCollapsed={!isSidemenuOpen}
        items={displayItems}
        className="!bg-transparent"
      />
    </div>
  );
};

export default Sidemenu;