import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type AuthUser } from '@/context/AuthContext';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  roles?: AuthUser['role'][];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    const dest = user.role === 'user' ? '/dashboard' : '/compliance';
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
