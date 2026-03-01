import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function AdminRoute({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-bloodRed"></div>
            </div>
        );
    }

    if (!profile?.is_admin) {
        // Redirect non-admins to dashboard
        return <Navigate to="/dashboard" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
