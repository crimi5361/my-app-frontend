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
  ContactsOutlined,
  UserSwitchOutlined,
  CreditCardOutlined,
  IdcardOutlined,
} from "@ant-design/icons";

import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface SidemenuProps {
  isSidemenuOpen: boolean;
}

const Sidemenu: React.FC<SidemenuProps> = ({ isSidemenuOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  // TODO : Récupérer dynamiquement depuis localStorage ou context
  const currentUserRole = JSON.parse(localStorage.getItem("user") || "{}")?.role || "scolarite";

  const rolePermissions: Record<string, string[]> = {
    admin: ["dashboard", "scolarite", "Gestion_academique", "Etudiant", "Parametres"],
    scolarite: ["Etudiant","Gestion_academique"],
    comptabilite: ["scolarite"],
  };

  const allowedKeys = rolePermissions[currentUserRole] || [];

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

  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
      children: [
        {
          key: "/dashboard",
          label: "Dashboard",
          icon: <AppstoreAddOutlined />,
        },
         { key: "/Etudiant/DashScolarite", label: "Tableau recapitulatif", icon: <DashboardOutlined /> },
        {
          key: "/dashboard/ListePec",
          label: "Prise en charge",
          icon: <SolutionOutlined/>,
        },
        {
          key: "/dashboard/PEC_traiter",
          label: "Prise en charge traiter",
          icon: <SolutionOutlined/>,
        },
      ],
    },
    {
      key: "scolarite",
      icon: <ReadOutlined />,
      label: "Scolarité",
      children: [
        { key: "/scolarite/statuts", label: "Statuts", icon: <FileTextOutlined /> },
        { key: "/scolarite/paiements", label: "Historique Paiement", icon: <CreditCardOutlined /> },
        { key: "/scolarite/inscription_attentes", label: "Inscriptions en attente", icon: <SolutionOutlined /> },
      ],
    },
    {
      key: "Gestion_academique",
      icon: <BankOutlined />,
      label: "Gestion académique",
      children: [
        { key: "/Gestion_academique/Statistique", label: "Statistique", icon: <AppstoreAddOutlined /> },
        { key: "/Gestion_academique/Effectifs", label: "Effectifs", icon: <TeamOutlined /> },
        { key: "/Gestion_academique/Annes_accademique", label: "Années", icon: <ReadOutlined /> },
        { key: "/Gestion_academique/Salles", label: "Salles", icon: <BankOutlined /> },
        { key: "/Gestion_academique/Filieres", label: "Filières", icon: <AppstoreAddOutlined /> },
        { key: "/Gestion_academique/Niviaux", label: "Niveaux", icon: <AppstoreAddOutlined /> },
        { key: "/Gestion_academique/Classes", label: "Classes", icon: <AppstoreAddOutlined /> },
        { key: "/Gestion_academique/Maquettes", label: "Maquettes", icon: <AppstoreAddOutlined /> },
        // { key: "/Gestion_academique/Resultats", label: "Résultats", icon: <AppstoreAddOutlined /> },
        { key: "/Gestion_academique/Migrations", label: "Migrations", icon: <AppstoreAddOutlined /> },
        { key: "/Gestion_academique/Fusion", label: "Fusion", icon: <AppstoreAddOutlined /> },
        { key: "/Gestion_academique/Professeur", label: "Professeur", icon: <TeamOutlined /> }, 
      ],
    },
    {
      key: "Etudiant",
      icon: <TeamOutlined />,
      label: "Étudiants",
      children: [
        { key: "/Etudiant/Nouvelle_Admission", label: "Nouvelle Admission", icon: <UserSwitchOutlined /> },
        { key: "/Etudiant/Reinscription", label: "Ré-inscription", icon: <SolutionOutlined /> },
        { key: "/Etudiant/Dossiers", label: "Dossier", icon: <FileTextOutlined /> },
        { key: "/Etudiant/Effectifs", label: "Effectifs", icon: <TeamOutlined /> },
        { key: "/Etudiant/Cartes", label: "Cartes", icon: <IdcardOutlined /> },
        { key: "/Etudiant/Listes_Ministere", label: "Listes Ministère", icon: <ReadOutlined /> },
        { key: "/Etudiant/Verification", label: "Vérification", icon: <ContactsOutlined /> },
        // { key: "/Etudiant/DashScolarite", label: "Tableau recapitulatif", icon: <DashboardOutlined /> },
        { key: "/Etudiant/Listes_Etudiant", label: "Listes Étudiants", icon: <UserSwitchOutlined /> },
      ],
    },
    {
      key: "Parametres",
      icon: <SettingOutlined />,
      label: "Paramètres",
      children: [
        { key: "/Parametres/gestion_utilisateur", label: "Gestion utilisateurs", icon: <TeamOutlined /> },
        { key: "/Parametres/gestion_permission", label: "Gestion permissions", icon: <TeamOutlined /> },
      ],
    },
  ];

  const filteredMenuItems = menuItems.filter((item) => allowedKeys.includes(item.key));

  return (
    <div
      className={`fixed top-0 left-0 z-40 pt-20 border-r bg-white transition-all duration-300 ${
        isSidemenuOpen ? "w-64" : "w-20"
      } h-screen overflow-y-auto`}
    >
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        openKeys={isSidemenuOpen ? openKeys : []}
        onOpenChange={handleOpenChange}
        onClick={handleClick}
        inlineCollapsed={!isSidemenuOpen}
        items={filteredMenuItems}
        className="!bg-transparent"
      />
    </div>
  );
};

export default Sidemenu;
