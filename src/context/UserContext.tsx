import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { User } from "../type/User";
import { apiFetch, ApiError } from "../lib/api";

// Forme de GET /api/auth/me — cf. controllers/auth.controller.js::me. Volontairement minimal
// (seuls les champs réellement consommés ici), pas une copie de l'interface backend.
interface MeResponseUser {
  id: number;
  nom: string;
  email: string;
  role: string;
  permissions: string[];
  departement?: { id: number; nom: string };
}

interface UserContextType {
  user: User | null;
  isAuthenticated: boolean | null;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext<UserContextType>({
  user: null,
  isAuthenticated: null,
  setUser: () => {},
  setIsAuthenticated: () => {},
});

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Correction 2026-08-21 — synchronisation des permissions sans reconnexion : le JWT est signé
  // une seule fois à la connexion et reste valable 48h, donc un retrait/ajout de permission fait
  // par un admin (Paramètres → Gestion des permissions) sur un utilisateur déjà connecté n'était
  // jamais reflété avant expiration du token ou reconnexion manuelle. Source de vérité = base
  // (utilisateur_permission), jamais le JWT — voir GET /api/auth/me. Ce rafraîchissement met à jour
  // le contexte + localStorage lus par lib/permissions.ts::hasPermission ; la protection réelle
  // reste backend (permission.middleware.js revérifie aussi en base à CHAQUE requête protégée,
  // indépendamment de ce mécanisme, qui n'est qu'une resynchronisation UX).
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await apiFetch<{ user: MeResponseUser }>("/api/auth/me");
      const dep = res.user.departement;
      const refreshed: User = {
        id: res.user.id,
        nom: res.user.nom,
        email: res.user.email,
        statut: "active",
        role: res.user.role,
        departementName: dep?.nom ?? "",
        permissions: res.user.permissions ?? [],
      };
      localStorage.setItem("user", JSON.stringify(refreshed));
      if (dep?.id !== undefined) localStorage.setItem("departement_id", String(dep.id));
      setUser(refreshed);
    } catch (e) {
      // 401 (token expiré/invalide) est déjà géré par apiFetch (déconnexion + redirection). Un 403
      // signale un compte désactivé entre-temps par un admin — même traitement qu'une session
      // expirée, jamais une erreur silencieuse. Toute autre erreur (réseau, 500 ponctuel) ne casse
      // rien : on retentera au prochain cycle.
      if (e instanceof ApiError && e.status === 403) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("departement_id");
        localStorage.removeItem("user_id");
        setUser(null);
        setIsAuthenticated(false);
      }
    }
  }, []);

  useEffect(() => {
    // Étudiants exclus : aucune permission Moyens Généraux ne les concerne, inutile de les
    // interroger en boucle pour rien.
    if (!isAuthenticated || user?.role === "etudiant") return;

    refreshUser(); // resynchronise tout de suite (ex. reprise d'onglet après une longue pause)
    const intervalId = window.setInterval(refreshUser, 60_000);
    window.addEventListener("focus", refreshUser);
    document.addEventListener("visibilitychange", refreshUser);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshUser);
      document.removeEventListener("visibilitychange", refreshUser);
    };
  }, [isAuthenticated, user?.role, refreshUser]);

  return (
    <UserContext.Provider
      value={{ user, isAuthenticated, setUser, setIsAuthenticated }}
    >
      {children}
    </UserContext.Provider>
  );
};
