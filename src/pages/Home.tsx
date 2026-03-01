import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, ChevronRight, Zap, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMatchStore } from '../store/useMatchStore';

export default function Home() {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const { loadMatch } = useMatchStore();
    const [activeMatch, setActiveMatch] = useState<any>(null);
    const [recentMatches, setRecentMatches] = useState<any[]>([]);
    const [loadingMatches, setLoadingMatches] = useState(true);

    useEffect(() => {
        if (!profile) return;

        async function fetchData() {
            setLoadingMatches(true);

            // 1. Check for Active Match
            const { data: activeJoin } = await supabase
                .from('match_players')
                .select('match_id, matches!inner(id, status, created_at, courses(name))')
                .eq('user_id', profile?.id)
                .eq('matches.status', 'in_progress')
                .order('matches(created_at)', { ascending: false })
                .limit(1);

            if (activeJoin && activeJoin.length > 0) {
                setActiveMatch((activeJoin[0] as any).matches);
            }

            // 2. Fetch Recent Matches (History)
            const { data: historyJoin } = await supabase
                .from('match_players')
                .select('match_id, matches!inner(id, status, created_at, format, wager_type, courses(name))')
                .eq('user_id', profile?.id)
                .order('matches(created_at)', { ascending: false })
                .limit(3);

            if (historyJoin) {
                setRecentMatches(historyJoin.map((h: any) => h.matches));
            }

            setLoadingMatches(false);
        }

        fetchData();
    }, [profile]);

    const handleResume = async () => {
        if (!activeMatch) return;
        localStorage.setItem('activeMatchId', activeMatch.id);
        await loadMatch(activeMatch.id);
        navigate('/play/1');
    };

    const handleMatchClick = async (matchId: string) => {
        localStorage.setItem('activeMatchId', matchId);
        await loadMatch(matchId);
        navigate('/play/1');
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between p-4 px-6 border-b border-borderColor bg-background/95 backdrop-blur z-20 shrink-0">
                <div className="flex items-center gap-2">
                    <img src="/logo-final.png" alt="BSG" className="w-8 h-8 object-contain" />
                    <span className="text-white font-black italic text-lg uppercase tracking-tighter">BloodSheet</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-secondaryText hover:text-bloodRed transition-colors"
                    title="Log Out"
                >
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Log Out</span>
                    <LogOut className="w-5 h-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto overflow-x-hidden momentum-scroll space-y-8 pb-32 pt-6">
                {/* Dynamic Top Banner */}
                <div className="px-4">
                    {activeMatch ? (
                        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-bloodRed to-[#C4002F] p-8 shadow-[0_0_30px_rgba(255,0,63,0.3)] border border-white/20 group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                                <Zap className="w-32 h-32 text-white" />
                            </div>

                            <div className="relative z-10 flex flex-col items-start gap-4">
                                <div className="flex items-center gap-2 px-2 py-1 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none">Live Round</span>
                                </div>

                                <div>
                                    <h2 className="text-3xl font-black text-white mb-1 flex items-center gap-2 uppercase italic">
                                        {activeMatch.courses?.name || 'Active Match'}
                                    </h2>
                                    <p className="text-white/80 text-[10px] font-bold uppercase tracking-[0.2em]">In Progress • Scoring Live</p>
                                </div>

                                <Button
                                    onClick={handleResume}
                                    className="w-full bg-white text-bloodRed hover:bg-white/90 font-black shadow-lg flex items-center justify-center gap-2 py-6 rounded-2xl group/btn transition-transform active:scale-[0.98]"
                                >
                                    RESUME MATCH
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative overflow-hidden rounded-[2.5rem] bg-[#1a1a1c] border border-white/10 flex flex-col items-center justify-center group shadow-2xl min-h-[300px] text-center p-8">
                            {/* Premium Background with welcome-bg image */}
                            <div
                                className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-[10s] group-hover:scale-110"
                                style={{ backgroundImage: 'url("/welcome-bg.png")' }}
                            />
                            <div className="absolute inset-0 bg-black/70 z-1" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-2" />

                            <div className="relative z-10 w-48 h-48 mb-4 transition-all duration-700 group-hover:scale-110 group-hover:rotate-2">
                                <img
                                    src="/logo-final.png"
                                    alt="BloodSheet Golf"
                                    className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(255,0,63,0.6)]"
                                />
                            </div>

                            <div className="relative z-10 space-y-2">
                                <h2 className="text-4xl sm:text-5xl font-black text-white italic tracking-tighter leading-none">
                                    <span className="text-bloodRed drop-shadow-[0_0_15px_rgba(255,0,63,0.5)]">BLOOD</span>SHEET
                                </h2>
                                <p className="text-[10px] text-white/60 font-black uppercase tracking-[0.3em] ml-1">The Ledger of Legend</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions Grid */}
                <section className="px-4">
                    <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest mb-4 ml-1">Player Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Link to="/dashboard" className="block h-full group">
                            <div className="relative h-full overflow-hidden rounded-[2rem] bg-[#1a1a1c] border border-white/5 p-5 transition-all duration-300 group-hover:border-bloodRed/50 group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-15px_rgba(255,0,63,0.3)] shadow-xl flex flex-col items-start gap-4">
                                {/* Accent Glow */}
                                <div className="absolute -top-12 -right-12 w-24 h-24 bg-bloodRed/10 rounded-full blur-2xl group-hover:bg-bloodRed/20 transition-colors" />

                                <div className="w-14 h-14 rounded-2xl bg-surfaceHover border border-borderColor flex items-center justify-center font-black text-bloodRed text-xs shadow-inner overflow-hidden relative shrink-0 transition-transform group-hover:scale-110 duration-500">
                                    {profile?.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="relative z-10 text-lg uppercase italic">{initials}</span>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-bloodRed" />
                                </div>
                                <div className="flex-1 flex flex-col justify-center relative z-10">
                                    <span className="block text-white font-black text-lg uppercase leading-none italic group-hover:text-bloodRed transition-colors">HCP {profile?.handicap?.toFixed(1) || '0.0'}</span>
                                    <span className="text-[9px] text-secondaryText font-black uppercase tracking-widest mt-1 opacity-60">View Profile</span>
                                </div>
                            </div>
                        </Link>

                        <Link to="/setup" className="block h-full group">
                            <div className="relative h-full overflow-hidden rounded-[2rem] bg-[#1a1a1c] border border-white/5 p-5 transition-all duration-300 group-hover:border-neonGreen/50 group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-15px_rgba(0,255,102,0.2)] shadow-xl flex flex-col items-start gap-4">
                                {/* Accent Glow */}
                                <div className="absolute -top-12 -right-12 w-24 h-24 bg-neonGreen/5 rounded-full blur-2xl group-hover:bg-neonGreen/10 transition-colors" />

                                <div className="w-14 h-14 rounded-2xl bg-neonGreen/10 border border-neonGreen/20 flex items-center justify-center text-neonGreen shadow-inner relative shrink-0 transition-transform group-hover:scale-110 duration-500">
                                    <Plus className="w-8 h-8 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]" />
                                </div>
                                <div className="flex-1 flex flex-col justify-center relative z-10">
                                    <span className="block text-white font-black text-lg uppercase leading-none italic group-hover:text-neonGreen transition-colors">Setup</span>
                                    <span className="text-[9px] text-secondaryText font-black uppercase tracking-widest mt-1 opacity-60">Start Match</span>
                                </div>
                            </div>
                        </Link>
                    </div>
                </section>

                {/* Recent Activity Feed */}
                <section className="px-4">
                    <div className="flex items-center justify-between mb-4 ml-1">
                        <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest">Recent Activity</h3>
                        <Link to="/history" className="text-[10px] text-bloodRed font-black uppercase tracking-widest hover:underline">See All</Link>
                    </div>
                    <div className="space-y-3">
                        {loadingMatches ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : recentMatches.length > 0 ? (
                            recentMatches.map((match) => (
                                <Card
                                    key={match.id}
                                    className="p-4 bg-surface border-white/5 flex items-center justify-between group hover:border-bloodRed/30 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                                    onClick={() => match.status === 'completed' ? navigate(`/history/${match.id}`) : handleMatchClick(match.id)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-black text-bloodRed shrink-0 overflow-hidden">
                                            {profile?.avatarUrl ? (
                                                <img src={profile.avatarUrl} alt="Me" className="w-full h-full object-cover grayscale" />
                                            ) : (
                                                initials
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-white text-[10px] uppercase tracking-wider truncate block">{match.format || 'Match'}</span>
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${match.status === 'completed' ? 'bg-neonGreen/10 text-neonGreen' : 'bg-bloodRed/10 text-bloodRed animate-pulse'}`}>
                                                    {match.status === 'completed' ? 'Finished' : 'Live'}
                                                </span>
                                            </div>
                                            <span className="text-xs font-black italic text-white uppercase tracking-tight truncate block">
                                                {match.courses?.name || 'Unknown Course'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="block text-[8px] text-secondaryText uppercase font-black">
                                            {new Date(match.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-secondaryText group-hover:text-bloodRed transition-colors ml-auto mt-1" />
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center py-10 bg-surface/50 rounded-3xl border border-dashed border-borderColor">
                                <p className="text-[10px] text-secondaryText font-black uppercase tracking-[0.2em]">No Recent Activity</p>
                            </div>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
}
