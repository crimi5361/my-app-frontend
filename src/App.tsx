// App.tsx
import { useContext, useState, useEffect, ReactNode } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";

import Header from "./Components/Header/Header";
import PageContent from "./Components/PageContent/PageContent";
import Sidemenu from "./Components/Sidemenu/Sidemenu";
import Login from "./Components/Login/Login";
import AppRoutes from "./Components/AppRoutes/AppRoutes";
import Hub from "./Pages/Hub/Hub";
import { UserProvider, UserContext } from "./context/UserContext";
import { useTheme } from "./context/ThemeContext";

// Applique l'algorithme clair/sombre d'antd en fonction du thème choisi par
// l'utilisateur — pose le socle pour les prochaines phases de refonte UI.
const AntdThemeBridge = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          // En clair, l'encre (quasi noire) contraste bien sur fond clair.
          // En sombre, garder cette même couleur rendrait invisibles tous les
          // éléments qui s'appuient dessus (boutons, item de menu actif...)
          // sur un fond déjà sombre — on passe donc sur un bleu lisible.
          colorPrimary: theme === "dark" ? "#4C7FFF" : "#101a33",
          fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",
          borderRadius: 10,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};

// Import des pages de l'espace étudiant
import Acceuille from "./Pages/ESPACE_ETUDIANT/acceuille";
import ScolariteEtudiant from "./Pages/ESPACE_ETUDIANT/scolariteEtudiant";
import DocumentsEtudiant from "./Pages/ESPACE_ETUDIANT/documentsEtudiant";
import AccesEtudiant from "./Pages/ESPACE_ETUDIANT/AccesEtudiant";
import CarteEtudiant from "./Pages/ESPACE_ETUDIANT/CarteEtudiant";
import NotesEtudiant from "./Pages/ESPACE_ETUDIANT/NotesEtudiant";
import ProfilEtudiant from "./Pages/ESPACE_ETUDIANT/ProfilEtudiant";
import CoursEtudiant from "./Pages/ESPACE_ETUDIANT/CoursEtudiant";
import EdtEtudiant from "./Pages/ESPACE_ETUDIANT/EdtEtudiant";
import MaquetteEtudiant from "./Pages/ESPACE_ETUDIANT/MaquetteEtudiant";
import TransportEtudiant from "./Pages/ESPACE_ETUDIANT/TransportEtudiant";
import DepotMemoire from "./Pages/ESPACE_ETUDIANT/DepotMemoire";

function AppContent() {
  const { user, isAuthenticated, setIsAuthenticated, setUser } = useContext(UserContext);

  const location = useLocation();
  const navigate = useNavigate();
  const [isSidemenuOpen, setIsSidemenuOpen] = useState(true);

  const getDefaultRedirectPath = () => {
    const storedUser = localStorage.getItem("user");
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    const currentUserRole = currentUser?.role;

    if (!currentUserRole) return "/login";
    if (currentUserRole === "etudiant") return "/acceuil/espace_etudiant";
    return "/hub";
  };

  const isLoginPage = location.pathname === "/login";
  const isEspaceEtudiant = location.pathname.startsWith("/espace-etudiant") || 
                           location.pathname === "/acceuil/espace_etudiant";

  const toggleSidemenu = () => {
    setIsSidemenuOpen(!isSidemenuOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("departement_id");
    localStorage.removeItem("user_id"); // Nettoyer aussi l'ID étudiant
    setIsAuthenticated(false);
    setUser(null);
    navigate("/login");
  };

  useEffect(() => {
    if (isAuthenticated && location.pathname === "/") {
      const redirectPath = getDefaultRedirectPath();
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  if (isAuthenticated === null) return null;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Hub - point d'entrée après connexion pour les rôles staff */}
      <Route
        path="/hub"
        element={isAuthenticated ? <Hub /> : <Navigate to="/login" replace />}
      />

      {/* Routes de l'espace étudiant - Layout indépendant */}
      <Route path="/acceuil/espace_etudiant" element={<Acceuille />} />
      <Route path="/espace-etudiant" element={<Acceuille />} />
      <Route path="/espace-etudiant/scolarite" element={<ScolariteEtudiant />} />
      <Route path="/espace-etudiant/documents" element={<DocumentsEtudiant />} />
      <Route path="/espace-etudiant/mes-acces" element={<AccesEtudiant />} />
      <Route path="/espace-etudiant/carte" element={<CarteEtudiant />} />
      <Route path="/espace-etudiant/notes" element={<NotesEtudiant />} />
      <Route path="/espace-etudiant/profil" element={<ProfilEtudiant />} />
      <Route path="/espace-etudiant/cours" element={<CoursEtudiant />} />
      <Route path="/espace-etudiant/emploi-du-temps" element={<EdtEtudiant />} />
      <Route path="/espace-etudiant/maquette-pedagogique" element={<MaquetteEtudiant />} />
      <Route path="/espace-etudiant/transports" element={<TransportEtudiant />} />
      <Route path="/espace-etudiant/depot-memoire" element={<DepotMemoire />} />

      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <div className="font-tinos">
              {!isLoginPage && !isEspaceEtudiant && ( // Ne pas afficher header/sidemenu sur l'espace étudiant
                <>
                  <Header
                    toggleSidemenu={toggleSidemenu}
                    darkMode={false}
                    userName={user?.nom || ""}
                    userRole={user?.role || ""}
                    departementName={user?.departementName || ""}
                    onLogout={handleLogout}
                  />
                  <Sidemenu isSidemenuOpen={isSidemenuOpen} />
                </>
              )}
              <PageContent isSidemenuOpen={isSidemenuOpen}>
                <AppRoutes />
              </PageContent>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AntdThemeBridge>
        <AppContent />
      </AntdThemeBridge>
    </UserProvider>
  );
}