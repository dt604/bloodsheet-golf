import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
    const [debugInfo, setDebugInfo] = useState('Initializing callback...');
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        console.log('AuthCallback: Starting recovery process...');

        async function processAuth() {
            try {
                const hasHash = window.location.hash.length > 1;
                const hasCode = window.location.search.includes('code=');

                setDebugInfo(`Verifying Connection...\nMode: ${hasHash ? 'Token Hash' : (hasCode ? 'PKCE Code' : 'No Data')}`);

                // 1. Immediate sync check
                const { data: { session }, error: authError } = await supabase.auth.getSession();

                if (authError) throw authError;

                if (session) {
                    setDebugInfo('Authenticated!');
                    // Use React Router for instant navigation instead of full reload
                    navigate('/home', { replace: true });
                } else {
                    if (!hasHash && !hasCode) {
                        setError('No login data found in the URL.');
                    } else {
                        setDebugInfo('Synchronizing tokens...');
                        // Wait just enough for the hash to be processed if it's the first hit
                        setTimeout(async () => {
                            const { data: { session: retrySession } } = await supabase.auth.getSession();
                            if (retrySession) {
                                navigate('/home', { replace: true });
                            } else {
                                window.location.reload(); // Fallback to full reload if SPA fails
                            }
                        }, 500);
                    }
                }
            } catch (err: any) {
                console.error('AUTH_FAIL:', err);
                setError(err.message || 'Authentication error');
            }
        }

        processAuth();
    }, [navigate]);

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#1C1C1E] min-h-screen text-white text-center">
                <div className="w-16 h-16 bg-bloodRed/20 rounded-full flex items-center justify-center mb-6">
                    <span className="text-bloodRed text-3xl font-black">!</span>
                </div>
                <h1 className="text-xl font-black uppercase italic text-white mb-2">Sync Error</h1>
                <p className="text-secondaryText text-xs leading-relaxed max-w-xs mb-8 whitespace-pre-wrap">
                    {error}
                </p>
                <button
                    onClick={() => window.location.assign('/')}
                    className="px-8 py-4 bg-bloodRed text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all"
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#1C1C1E] min-h-screen text-white">
            <div className="relative mb-8">
                <div className="w-16 h-16 border-4 border-bloodRed/20 rounded-full" />
                <div className="w-16 h-16 border-4 border-bloodRed border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
            </div>

            <div className="text-center space-y-4 max-w-xs">
                <h1 className="text-2xl font-black italic uppercase tracking-tighter text-bloodRed animate-pulse">
                    Authenticating
                </h1>
                <pre className="text-secondaryText text-[8px] font-mono leading-relaxed opacity-60 text-left bg-black/30 p-4 rounded-xl border border-white/5">
                    {debugInfo}
                </pre>
            </div>
        </div>
    );
}
