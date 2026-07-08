import React from 'react';
import ProtectedRoute from '../ProtectedRoute/ProtectedRoute';

/**
 * AdminRoute — convenience wrapper around ProtectedRoute.
 *
 * Reuses the existing ProtectedRoute component with roles=['admin'].
 * If the authenticated user's user_type is not 'admin' they are
 * redirected to '/'.
 */
const AdminRoute = ({ children }) => (
  <ProtectedRoute roles={['admin']}>
    {children}
  </ProtectedRoute>
);

export default AdminRoute;
