// App.tsx
import { useContext, useState, useEffect, ReactNode } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";

import Layout from "./Components/Layout/Layout";
import Login from "./Components/Login/Login";
import AppRoutes from "./Components/AppRoutes/AppRoutes";
import ProtectedRoute from "./Components/ProtectedRoute";
import Hub from "./Pages/Hub/Hub";
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
import SecuriteEtudiant from "./Pages/ESPACE_ETUDIANT/SecuriteEtudiant";
import VerificationCarte from "./Pages/Public/VerificationCarte";

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

      {/* Vérification publique d'une carte étudiante — cible du QR code.
          Déclarée AVANT le « /* » plus bas, qui redirige tout visiteur non
          authentifié vers /login : un tiers qui scanne une carte n'a pas de
          session, et doit pourtant obtenir une réponse. */}
      <Route path="/verification-carte" element={<VerificationCarte />} />

      {/* Hub - point d'entrée après connexion pour les rôles staff */}
      <Route
        path="/hub"
        element={isAuthenticated ? <Hub /> : <Navigate to="/login" replace />}
      />

      {/* ════════ Espace étudiant — layout indépendant ════════
          Phase 0 (2026-11-11) : ces routes étaient déclarées SANS garde. Vérifié au
          navigateur, 10 d'entre elles s'affichaient sans aucune session — certaines
          en exposant des messages techniques. Elles passent sous le ProtectedRoute
          déjà utilisé par le reste de l'application : sans session, redirection vers
          /login ; avec un rôle du personnel, redirection vers /hub.
          Cette garde ne remplace pas les contrôles serveur, qui restent la seule
          barrière réelle (middleware/dossierEtudiant.middleware.js côté backend). */}
      <Route path="/acceuil/espace_etudiant" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <Acceuille />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <Acceuille />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/scolarite" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <ScolariteEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/documents" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <DocumentsEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/mes-acces" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <AccesEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/carte" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <CarteEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/notes" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <NotesEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/profil" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <ProfilEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/cours" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <CoursEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/emploi-du-temps" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <EdtEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/maquette-pedagogique" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <MaquetteEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/transports" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <TransportEtudiant />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/depot-memoire" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <DepotMemoire />
        </ProtectedRoute>
      } />
      <Route path="/espace-etudiant/securite" element={
        <ProtectedRoute requiredPermission={["etudiant"]}>
          <SecuriteEtudiant />
        </ProtectedRoute>
      } />

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