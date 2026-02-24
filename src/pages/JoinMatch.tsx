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
            return;
        }

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

            <main className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-16 h-16 rounded-full bg-surface border border-borderColor flex items-center justify-center mx-auto mb-6">
                        <Hash className="w-8 h-8 text-bloodRed" />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">Enter Match Code</h2>
                    <p className="text-sm text-secondaryText">
                        Ask the match creator for the 6-character code,<br />
                        then enter it below to join the live match.
                    </p>
                </div>

                <div className="w-full space-y-4">
                    <input
                        type="text"
                        inputMode="text"
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={6}
                        className="block w-full px-4 py-5 border border-borderColor rounded-2xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-2 focus:ring-bloodRed focus:border-bloodRed text-3xl font-mono font-black text-center tracking-[0.4em] uppercase transition-all"
                        placeholder="ABC123"
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            setError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />

                    {error && (
                        <p className="text-bloodRed text-sm font-semibold text-center">{error}</p>
                    )}

                    <Button
                        size="lg"
                        className="w-full font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,63,0.3)]"
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
