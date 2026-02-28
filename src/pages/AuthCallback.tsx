import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallbackPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;
        if (user) navigate('/dashboard', { replace: true });
        else navigate('/', { replace: true });
    }, [user, loading, navigate]);

    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
