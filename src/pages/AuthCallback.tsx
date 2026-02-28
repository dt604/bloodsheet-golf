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
        // onAuthStateChange in Supabase v2 fires INITIAL_SESSION immediately on
        // subscribe with the current session state, then SIGNED_IN once the
        // OAuth hash token is processed. Handling both covers all timing cases.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                if (session) go('/dashboard');
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
