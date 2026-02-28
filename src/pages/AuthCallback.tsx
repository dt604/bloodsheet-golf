import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
    const navigate = useNavigate();
    const navigated = useRef(false);

    function go(path: string) {
        if (navigated.current) return;
        navigated.current = true;
        navigate(path, { replace: true });
    }

    useEffect(() => {
        // Primary: listen for SIGNED_IN event from hash token processing
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) go('/dashboard');
            else if (event === 'SIGNED_OUT') go('/');
        });

        // Fallback: session may have already been established before listener registered
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) go('/dashboard');
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
