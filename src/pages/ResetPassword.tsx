import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const { updatePassword } = useAuth();

    const [ready, setReady] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const inputClass =
        'block w-full px-4 py-3 border border-borderColor rounded-xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-1 focus:ring-bloodRed focus:border-bloodRed text-sm transition-all';

    useEffect(() => {
        // Check the URL hash directly — Supabase may have already processed the token
        // before our listener was registered
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        if (hashParams.get('type') === 'recovery') {
            setReady(true);
            return;
        }

        // Fallback: catch the event if it fires after mount
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') setReady(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    async function handleReset() {
        setError('');
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        if (password !== confirm) { setError('Passwords do not match.'); return; }
        setLoading(true);
        const err = await updatePassword(password);
        setLoading(false);
        if (err) { setError(err); return; }
        setDone(true);
        setTimeout(() => navigate('/'), 2000);
    }

    return (
        <div className="flex-1 flex flex-col bg-background p-6 items-center justify-center">
            <div className="w-full space-y-4">
                <h2 className="text-white font-black text-2xl tracking-tight text-center mb-2">
                    Reset Password
                </h2>

                {done && (
                    <p className="text-neonGreen text-sm font-semibold text-center">
                        Password updated! Redirecting…
                    </p>
                )}

                {!done && !ready && (
                    <p className="text-secondaryText text-sm text-center">
                        Verifying reset link…
                    </p>
                )}

                {!done && ready && (
                    <>
                        <input
                            type="password"
                            className={inputClass}
                            placeholder="New password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            className={inputClass}
                            placeholder="Confirm new password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                        {error && (
                            <p className="text-bloodRed text-xs font-semibold px-1">{error}</p>
                        )}
                        <Button
                            size="lg"
                            className="uppercase font-bold tracking-wider text-lg shadow-[0_0_20px_rgba(255,0,63,0.3)]"
                            onClick={handleReset}
                            disabled={loading}
                        >
                            {loading ? 'Saving…' : 'Set New Password'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
