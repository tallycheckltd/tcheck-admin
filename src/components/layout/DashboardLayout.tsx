import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';

export function DashboardLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center app-shell">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'STUDENT') return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen app-shell transition-[background-color,color] duration-200">
      <Sidebar />
      <main className="ml-64 p-6 min-h-screen antialiased text-[color:var(--app-text)] dark:text-slate-100">
        <Outlet />
      </main>
    </div>
  );
}
