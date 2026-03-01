import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
    const navigated = useRef(false);
    const [status, setStatus] = useState('Initializing secure session...');
    const [showSkip, setShowSkip] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            if (navigated.current) return;

            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('Session confirmed via checkSession');
                navigated.current = true;
                // Using window.location.replace is more reliable for clearing the #hash fragment
                // than React Router's navigate in some environments.
                window.location.replace('/dashboard');
            }
        };

        // 1. Initial check
        checkSession();

        // 2. Event listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Callback Page - Auth Event:', event);
            if (session && !navigated.current) {
                navigated.current = true;
                setStatus('Authenticated! Redirecting...');
                window.location.replace('/dashboard');
            }
        });

        // 3. Status updates & Safety skip
        const timer1 = setTimeout(() => setStatus('Exchanging tokens with Google...'), 800);
        const timer2 = setTimeout(() => setStatus('Syncing your player profile...'), 1800);
        const timer3 = setTimeout(() => setShowSkip(true), 3000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, []);

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-bloodRed/20 rounded-full" />
                <div className="w-16 h-16 border-4 border-bloodRed border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
            </div>

            <div className="mt-8 text-center space-y-2">
                <h1 className="text-white font-black italic text-xl uppercase tracking-tighter italic">BloodSheet Golf</h1>
                <p className="text-secondaryText text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">
                    {status}
                </p>
            </div>

            {showSkip && (
                <button
                    onClick={() => window.location.replace('/dashboard')}
                    className="mt-12 px-6 py-3 bg-surface border border-borderColor rounded-xl text-white text-xs font-black uppercase tracking-widest hover:bg-surfaceHover transition-colors"
                >
                    Continue to Dashboard →
                </button>
            )}
        </div>
    );
}
