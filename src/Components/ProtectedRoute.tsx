import { Navigate } from "react-router-dom";
import React from "react";
import { PAGE_PERMISSIONS } from "../lib/access";

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

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Vérifier les permissions si requiredPermission est spécifié
  if (requiredPermission) {
    const userRole = user.role || "scolarite";
    const allowedPermissions = PAGE_PERMISSIONS[userRole] || [];

    // Convertir requiredPermission en array si c'est une string
    const requiredPermissionsArray = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission];

    // Vérifier si au moins une permission est autorisée
    const hasPermission = requiredPermissionsArray.some(perm =>
      allowedPermissions.includes(perm)
    );

    if (!hasPermission) {
      // Rediriger vers le Hub, qui n'affichera que les applications autorisées
      return <Navigate to="/hub" />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;