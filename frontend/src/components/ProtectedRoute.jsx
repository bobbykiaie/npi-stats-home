// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ user, allowedRoles, children }) => {
  const location = useLocation();

  // 1. Check if the user is logged in
  if (!user) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to. This allows us to redirect them back after login.
    return <Navigate to="/spc-tracking-app/login" state={{ from: location }} replace />;
  }

  // 2. Check if roles are specified and if the user's role is in the allowed list
  // The '&&' is important: if allowedRoles isn't provided, this check is skipped.
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // User is logged in but does not have the required role. Redirect to a "not authorized" page.
    return <Navigate to="/spc-tracking-app/not-authorized" replace />;
  }

  // 3. If all checks pass, render the component they were trying to access
  return children;
};

export default ProtectedRoute;