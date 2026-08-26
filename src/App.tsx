// App.tsx
import { useContext, useState, useEffect, ReactNode } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";

import Layout from "./Components/Layout/Layout";
import Login from "./Components/Login/Login";
import AppRoutes from "./Components/AppRoutes/AppRoutes";
import Hub from "./Pages/Hub/Hub";
import ProtectedRoute from "./Components/ProtectedRoute";
import ConsoleSante from "./Pages/Console/ConsoleSante";
import ConsoleDonnees from "./Pages/Console/ConsoleDonnees";
import { UserProvider, UserContext } from "./context/UserContext";
import { useTheme } from "./context/ThemeContext";
import { getDashboardRouteForRole } from "./lib/access";

// Jetons AntD dérivés de src/theme/tokens.css. AntD calcule ses propres
// dégradés de couleur (hover, active...) à partir de ces valeurs et ne peut
// pas consommer directement des `var(--xxx)` — ces hex doivent donc rester
// synchronisés manuellement avec tokens.css à chaque évolution de la palette.
const ANTD_TOKENS = {
  light: {
    colorPrimary: "#101a33", // --ink
    colorSuccess: "#1e8e5a", // --success
    colorWarning: "#b7791f", // --warning
    colorError: "#c0392b", // --danger
    colorInfo: "#101a33", // --ink
    colorBorder: "#e4e7f1", // --mist
    colorBorderSecondary: "#e4e7f1", // --mist
    colorBgContainer: "#ffffff", // --surface
    colorBgLayout: "#f4f5f9", // --paper
    colorText: "#101a33", // --ink
    colorTextSecondary: "#5b6478", // --ink-soft
    colorTextTertiary: "#5b6478", // --ink-soft
  },
  dark: {
    colorPrimary: "#4C7FFF", // l'encre serait invisible sur fond sombre
    colorSuccess: "#1e8e5a",
    colorWarning: "#b7791f",
    colorError: "#c0392b",
    colorInfo: "#4C7FFF",
    colorBorder: "#223055",
    colorBorderSecondary: "#223055",
    colorBgContainer: "#101a33", // --surface (sombre)
    colorBgLayout: "#080d1a", // --ink-deep
    colorText: "#eef0f8",
    colorTextSecondary: "#97a0bd",
    colorTextTertiary: "#97a0bd",
  },
};

// Applique l'algorithme clair/sombre d'antd en fonction du thème choisi par
// l'utilisateur — pose le socle pour les prochaines phases de refonte UI.
const AntdThemeBridge = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  return (
    <ConfigProvider
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          ...ANTD_TOKENS[theme === "dark" ? "dark" : "light"],
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

  // Racine "/" (et tout autre point de retour "accueil" — logo, ancienne URL /dashboard) :
  // toujours le Dashboard métier du rôle, jamais le Hub ni l'ancien Dashboard générique. Le
  // Hub reste uniquement la destination du flux de connexion lui-même (Login.tsx), inchangé.
  const getDefaultRedirectPath = () => {
    const storedUser = localStorage.getItem("user");
    const currentUser = storedUser ? JSON.parse(storedUser) : null;
    const currentUserRole = currentUser?.role;

    if (!currentUserRole) return "/login";
    if (currentUserRole === "etudiant") return "/acceuil/espace_etudiant";
    return getDashboardRouteForRole(currentUserRole);
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

      {/* Console de l'assistante — HORS du Layout, comme l'espace étudiant.
          Elle ne gère qu'un sujet : rendue dans le cadre de l'ERP, elle
          s'entourait du menu des inscriptions, des paiements et du stock, soit
          vingt portes vers autre chose autour d'un écran qui n'en a qu'une.

          ADMIN SEUL, et le fondateur en est exclu bien qu'il ait accès à tout
          le reste de l'assistante : ces écrans parlent de modèles, de crédits
          et de facturation, précisément ce que l'instruction système
          s'applique à taire devant lui. Le serveur refuse déjà ce rôle sur les
          routes correspondantes ; ce filtre évite d'ouvrir un écran qui ne se
          remplirait pas. */}
      <Route
        path="/console-assistant"
        element={isAuthenticated
          ? <ProtectedRoute requiredPermission={["admin"]}><ConsoleSante /></ProtectedRoute>
          : <Navigate to="/login" replace />}
      />
      <Route
        path="/console-assistant/donnees"
        element={isAuthenticated
          ? <ProtectedRoute requiredPermission={["admin"]}><ConsoleDonnees /></ProtectedRoute>
          : <Navigate to="/login" replace />}
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
            <Layout
              isSidemenuOpen={isSidemenuOpen}
              toggleSidemenu={toggleSidemenu}
              userName={user?.nom || ""}
              userRole={user?.role || ""}
              departementName={user?.departementName || ""}
              onLogout={handleLogout}
              showShell={!isLoginPage && !isEspaceEtudiant} // Ne pas afficher header/sidemenu sur l'espace étudiant
            >
              <AppRoutes />
            </Layout>
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