import { Navigate } from "react-router-dom";
import React from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string | string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission 
}) => {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  // Définir les permissions par rôle
  const rolePermissions: Record<string, string[]> = {
    admin: ["admin", "scolarite", "comptabilite", "caissier", "dashboard", "Gestion_academique", "Etudiant", "Parametres"],
    scolarite: [ "Etudiant", "Gestion_academique"],
    comptabilite: ["comptabilite", "dashboard", "scolarite", "caisse"],
    caissier: ["caissier"], //  Le caissier a accès au module caisse
  };

  // Redirections par défaut selon le rôle
  const defaultRedirects: Record<string, string> = {
    admin: "/dashboard",
    scolarite: "/Etudiant/Listes_Etudiant",
    comptabilite: "/dashboard",
    caissier: "/caisse/dashboard", //  Redirection corrigée
  };

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Vérifier les permissions si requiredPermission est spécifié
  if (requiredPermission) {
    const userRole = user.role || "scolarite";
    const allowedPermissions = rolePermissions[userRole] || [];
    
    // Convertir requiredPermission en array si c'est une string
    const requiredPermissionsArray = Array.isArray(requiredPermission) 
      ? requiredPermission 
      : [requiredPermission];
    
    // Vérifier si au moins une permission est autorisée
    const hasPermission = requiredPermissionsArray.some(perm => 
      allowedPermissions.includes(perm)
    );
    
    if (!hasPermission) {
      // Rediriger vers la page d'accueil autorisée
      return <Navigate to={defaultRedirects[userRole] || "/login"} />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;