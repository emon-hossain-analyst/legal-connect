import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, roles }) => {
  const location = useLocation();
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center space-y-4 p-8">
        <div className="w-12 h-12 border-4 border-surface-container-high border-t-primary rounded-full animate-spin"></div>
        <div className="w-48 h-4 bg-surface-container-high rounded animate-pulse"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const userRole = user?.user_type || user?.role || user?.user_metadata?.role || user?.user_metadata?.user_type;
  if (roles && roles.length > 0 && (!userRole || !roles.includes(userRole))) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;

