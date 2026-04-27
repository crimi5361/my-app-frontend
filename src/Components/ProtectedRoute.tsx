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

  // Définir les permissions par rôle - CORRIGÉ pour correspondre aux permissions utilisées dans AppRoutes
  const rolePermissions: Record<string, string[]> = {
    admin: ["admin", "scolarite", "comptabilite", "dashboard", "Gestion_academique", "Etudiant", "Parametres"],
    scolarite: ["scolarite", "Etudiant"],
    comptabilite: ["comptabilite", "dashboard", "scolarite"],
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
      const defaultRedirects: Record<string, string> = {
        admin: "/dashboard",
        scolarite: "/Etudiant/Listes_Etudiant",
        comptabilite: "/dashboard",
      };
      return <Navigate to={defaultRedirects[userRole] || "/login"} />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;