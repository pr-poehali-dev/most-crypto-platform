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
    const ROLE_ROUTES: Record<string, string> = {
      superadmin: '/admin',
      admin:      '/admin',
      finance:    '/admin',
      devops:     '/admin',
      compliance: '/compliance-officer',
      regulator:  '/regulator',
      user:       '/dashboard',
    };
    return <Navigate to={ROLE_ROUTES[user.role] ?? '/dashboard'} replace />;
  }

  return <>{children}</>;
}