import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { user, updateProfile } = useAuth();

    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    const inputClass =
        'block w-full px-4 py-3 border border-borderColor rounded-xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-1 focus:ring-bloodRed focus:border-bloodRed text-sm transition-all';

    // Auto-search by Google email on mount
    useEffect(() => {
        if (user?.email) {
            setSearch(user.email);
            runSearch(user.email);
        }
    }, [user?.email]);

    async function runSearch(term: string) {
        if (!term) return;
        setSearching(true);
        setResults([]);
        try {
            const { data } = await supabase.functions.invoke('grint-search', {
                body: { search: term }
            });
            if (data?.data) {
                setResults(data.data.map((u: any) => ({
                    grintId: `grint-${u.id}`,
                    fullName: u.name,
                    handicap: parseFloat(u.handicap) || 0,
                    avatarUrl: `https://profile.static.thegrint.com/thumb_${u.image}`,
                    username: u.username,
                })));
            }
        } catch (e) {
            console.error(e);
        }
        setSearching(false);
    }

    async function handleSelect(res: any) {
        setSaving(true);
        await updateProfile({
            handicap: res.handicap,
            avatarUrl: res.avatarUrl,
        });
        setSaving(false);
        navigate('/dashboard', { replace: true });
    }

    function handleSkip() {
        navigate('/dashboard', { replace: true });
    }

    return (
        <div className="flex-1 flex flex-col bg-background p-6 overflow-y-auto">
            <div className="space-y-4 bg-surface/90 backdrop-blur-xl p-5 rounded-2xl border border-borderColor shadow-2xl text-left mt-8">
                <div className="flex flex-col mb-2">
                    <span className="text-[10px] text-bloodRed font-bold tracking-[0.2em] mb-1">OPTIONAL</span>
                    <h3 className="text-white font-black tracking-tight text-xl mb-1">Find Your Handicap</h3>
                    <p className="text-secondaryText text-sm">Search The Grint to instantly link your verified index and profile picture.</p>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        className={`${inputClass} pl-11 shadow-inner`}
                        placeholder="Name, Email, or Username"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runSearch(search)}
                    />
                    <Search className="w-5 h-5 text-secondaryText absolute left-4 top-3.5" />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 mt-4 custom-scrollbar">
                    {searching && (
                        <div className="flex justify-center py-6">
                            <Loader className="w-8 h-8 animate-spin text-bloodRed" />
                        </div>
                    )}
                    {!searching && results.length === 0 && search && (
                        <p className="text-secondaryText text-center py-4 font-semibold text-sm">No results found.</p>
                    )}
                    {!searching && results.map((res) => (
                        <button
                            key={res.grintId}
                            onClick={() => handleSelect(res)}
                            disabled={saving}
                            className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-background hover:bg-surfaceHover border border-borderColor transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                {res.avatarUrl && !res.avatarUrl.includes('profile_default') ? (
                                    <img src={res.avatarUrl} alt={res.fullName} className="w-10 h-10 rounded-full object-cover border border-borderColor" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-white font-bold">
                                        {res.fullName.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <div className="text-white font-bold text-sm tracking-wide group-hover:text-bloodRed transition-colors">
                                        {res.fullName}
                                    </div>
                                    <div className="text-[10px] text-secondaryText font-mono uppercase tracking-widest mt-0.5">
                                        {res.username}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-secondaryText uppercase tracking-widest font-bold mb-0.5">Index</div>
                                <div className="text-base font-black text-neonGreen leading-none">{res.handicap}</div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="pt-4 border-t border-borderColor mt-4 flex justify-end">
                    <button
                        className="text-white text-sm font-bold bg-surfaceHover px-5 py-2.5 rounded-xl border border-borderColor hover:bg-white hover:text-black transition-colors"
                        onClick={handleSkip}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Skip for now'}
                    </button>
                </div>
            </div>
        </div>
    );
}
