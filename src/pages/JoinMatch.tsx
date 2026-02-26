import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader, Hash } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';

export default function JoinMatchPage() {
    const navigate = useNavigate();
    const loadMatch = useMatchStore((s) => s.loadMatch);
    const { isGuest } = useAuth();

    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleJoin() {
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length < 4) {
            setError('Enter the 6-character match code.');
            return;
        }

        setLoading(true);
        setError('');

        const { data, error: dbError } = await supabase
            .from('matches')
            .select('id, status')
            .eq('join_code', trimmed)
            .single();

        if (dbError || !data) {
            setError('Match not found. Check the code and try again.');
            setLoading(false);
            return;
        }

        const row = data as { id: string; status: string };

        if (row.status === 'completed') {
            setError('That match has already finished.');
            setLoading(false);
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
            return;
        }

        if (navigator.vibrate) navigator.vibrate(50); // Haptic success tick
        await loadMatch(row.id);
        navigate('/leaderboard');
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor">
                <button onClick={() => isGuest ? navigate('/') : navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg tracking-wide uppercase">Join a Match</span>
                <div className="w-10" />
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto w-full">
                <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="w-20 h-20 rounded-full bg-surfaceHover border border-bloodRed/30 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(255,0,63,0.15)] animate-pulse">
                        <Hash className="w-10 h-10 text-bloodRed" />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">Enter Code</h2>
                    <p className="text-sm text-secondaryText leading-relaxed px-4">
                        Ask the match creator for the 6-character code, then enter it below to join the live match.
                    </p>
                </div>

                <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both relative">
                    <div className="relative group">
                        <input
                            type="text"
                            inputMode="text"
                            autoCapitalize="characters"
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={6}
                            className="relative z-10 block w-full px-4 py-6 border border-borderColor rounded-2xl bg-background/50 backdrop-blur-md text-white placeholder-secondaryText/50 focus:outline-none focus:ring-2 focus:ring-bloodRed focus:border-bloodRed text-4xl font-mono font-black text-center tracking-[0.5em] pl-[calc(1rem+0.5em)] uppercase transition-all duration-300 focus:scale-[1.02] focus:shadow-[0_0_40px_rgba(255,0,63,0.15)]"
                            placeholder="ABC123"
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value.toUpperCase());
                                setError('');
                                if (navigator.vibrate && e.target.value.length > code.length) {
                                    navigator.vibrate(10); // tiny tick for each character typed
                                }
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-bloodRed/20 to-transparent rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-xl -z-10" />
                    </div>

                    {error && (
                        <p className="text-bloodRed text-sm font-bold text-center animate-in zoom-in duration-300 drop-shadow-[0_0_5px_rgba(255,0,63,0.8)]">{error}</p>
                    )}

                    <Button
                        size="lg"
                        className="w-full py-6 text-lg font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,0,63,0.3)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,0,63,0.5)] hover:scale-[1.02] active:scale-95 disabled:hover:scale-100 disabled:opacity-50 mt-4 border border-bloodRed/50"
                        onClick={handleJoin}
                        disabled={loading || code.trim().length < 4}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2 justify-center">
                                <Loader className="w-5 h-5 animate-spin" /> Joining…
                            </span>
                        ) : 'Join Match'}
                    </Button>
                </div>
            </main>
        </div>
    );
}
