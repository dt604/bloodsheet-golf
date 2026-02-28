import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
    const navigate = useNavigate();
    const navigated = useRef(false);

    function go(session: { user: { created_at: string } } | null) {
        if (navigated.current) return;
        navigated.current = true;
        if (!session) { navigate('/', { replace: true }); return; }
        // New user = account created within the last 2 minutes
        const ageMs = Date.now() - new Date(session.user.created_at).getTime();
        const isNew = ageMs < 2 * 60 * 1000;
        navigate(isNew ? '/onboarding' : '/dashboard', { replace: true });
    }

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                if (session) go(session);
                // INITIAL_SESSION with no session = still processing; wait for SIGNED_IN
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
