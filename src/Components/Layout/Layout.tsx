import { ReactNode } from "react";
import Header from "../Header/Header";
import Sidemenu from "../Sidemenu/Sidemenu";
import PageContent from "../PageContent/PageContent";

interface LayoutProps {
  children: ReactNode;
  isSidemenuOpen: boolean;
  toggleSidemenu: () => void;
  userName: string;
  userRole: string;
  departementName: string;
  onLogout: () => void;
  /** Header + Sidemenu ne s'affichent pas sur certains écrans (login, espace étudiant). */
  showShell: boolean;
}

// Shell applicatif unique (Header + Sidemenu + zone de contenu), extrait de
// App.tsx (Phase 1 — cf. plan de refonte). Assemblage identique à l'existant,
// simplement regroupé pour être réutilisable et plus lisible.
const Layout = ({
  children,
  isSidemenuOpen,
  toggleSidemenu,
  userName,
  userRole,
  departementName,
  onLogout,
  showShell,
}: LayoutProps) => (
  <div>
    {showShell && (
      <>
        <Header
          toggleSidemenu={toggleSidemenu}
          darkMode={false}
          userName={userName}
          userRole={userRole}
          departementName={departementName}
          onLogout={onLogout}
        />
        <Sidemenu isSidemenuOpen={isSidemenuOpen} />
      </>
    )}
    <PageContent isSidemenuOpen={isSidemenuOpen}>{children}</PageContent>
  </div>
);

export default Layout;
