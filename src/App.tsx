// App.tsx
import { useContext, useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

import Header from "./Components/Header/Header";
import PageContent from "./Components/PageContent/PageContent";
import Sidemenu from "./Components/Sidemenu/Sidemenu";
import Login from "./Components/Login/Login";
import AppRoutes from "./Components/AppRoutes/AppRoutes";
import { UserProvider, UserContext } from "./context/UserContext";

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
    const currentUserRole = currentUser?.role || "scolarite";
    
    const defaultRedirects: Record<string, string> = {
      admin: "/dashboard",
      scolarite: "/Etudiant/Listes_Etudiant",
      comptabilite: "/dashboard",
      etudiant: "/acceuil/espace_etudiant", // Redirection pour les étudiants vers l'ancienne route
    };
    return defaultRedirects[currentUserRole] || "/login";
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
      <AppContent />
    </UserProvider>
  );
}