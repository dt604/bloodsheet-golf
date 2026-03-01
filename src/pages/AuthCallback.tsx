import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
    const [debugInfo, setDebugInfo] = useState('Initializing callback...');

    useEffect(() => {
        console.log('AuthCallback: Starting process...');

        async function processAuth() {
            try {
                // 1. Check if we even have a hash
                if (!window.location.hash && !window.location.search.includes('code=')) {
                    setDebugInfo('Error: No authentication tokens found in URL. Please try signing in again.');

                    return;
                }

                setDebugInfo('Processing secure tokens...');

                // Supabase pick up the hash fragment automatically
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    throw error;
                }

                if (session) {
                    setDebugInfo('Identity verified! Redirecting to Dashboard...');
                    // Full page reload to clear any memory/state issues
                    setTimeout(() => {
                        window.location.assign('/dashboard');
                    }, 500);
                } else {
                    setDebugInfo('Session sync failed. Retrying...');
                    // Try one more time after 1s
                    setTimeout(async () => {
                        const { data } = await supabase.auth.getSession();
                        if (data.session) window.location.assign('/dashboard');
                        else {
                            setDebugInfo('No session found. Please try logging in again.');

                        }
                    }, 1500);
                }
            } catch (err: any) {
                console.error('CRITICAL AUTH ERROR:', err);
                const msg = err.message || 'Unknown initialization error';
                setDebugInfo(`Error: ${msg}`);


                // FINAL FALLBACK: If React is dead, write to the DOM directly
                const root = document.getElementById('root');
                if (root) {
                    root.innerHTML = `
                        <div style="background:#1C1C1E; color:white; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif; text-align:center; padding:20px;">
                            <h1 style="color:#FF003F;">AUTH CRASH</h1>
                            <p style="opacity:0.6; font-size:14px;">${msg}</p>
                            <a href="/" style="color:white; margin-top:20px; text-decoration:none; border:1px solid #333; padding:10px 20px; border-radius:10px;">Back to Welcome</a>
                        </div>
                    `;
                }
            }
        }

        processAuth();
    }, []);

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
                <p className="text-secondaryText text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
                    {debugInfo}
                </p>
            </div>
        </div>
    );
}
