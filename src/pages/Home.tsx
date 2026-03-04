import { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Flag, ChevronRight, Zap, Compass } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMatchStore } from '../store/useMatchStore';
import SEO from '../components/SEO';
import { ActivityFeed } from '../components/home/ActivityFeed';

export default function Home() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const { loadMatch } = useMatchStore();
    const [activeMatch, setActiveMatch] = useState<any>(null);
    const [pendingAttestMatch, setPendingAttestMatch] = useState<any>(null);

    useEffect(() => {
        if (!user) return;
        const userId = user.id;

        async function fetchData() {
            // Fetch Active and Pending Matches in Parallel
            const [activeRes, attestRes] = await Promise.all([
                // 1. Check for Active Match
                supabase
                    .from('match_players')
                    .select('match_id, matches!inner(id, status, created_at, courses(name))')
                    .eq('user_id', userId)
                    .eq('matches.status', 'in_progress')
                    .order('matches(created_at)', { ascending: false })
                    .limit(1),
                // 1b. Check for pending attestation match
                supabase
                    .from('match_players')
                    .select('match_id, matches!inner(id, status, created_at, courses(name))')
                    .eq('user_id', userId)
                    .eq('matches.status', 'pending_attestation')
                    .order('matches(created_at)', { ascending: false })
                    .limit(1)
            ]);

            if (activeRes.data && activeRes.data.length > 0) {
                setActiveMatch((activeRes.data[0] as any).matches);
            }

            if (attestRes.data && attestRes.data.length > 0) {
                setPendingAttestMatch((attestRes.data[0] as any).matches);
            }
        }

        fetchData();
    }, [user?.id]);

    const handleAttest = async () => {
        if (!pendingAttestMatch) return;
        localStorage.setItem('activeMatchId', pendingAttestMatch.id);
        await loadMatch(pendingAttestMatch.id);
        navigate('/ledger');
    };

    const handleResume = async () => {
        if (!activeMatch) return;
        localStorage.setItem('activeMatchId', activeMatch.id);
        await loadMatch(activeMatch.id);
        navigate('/play/1');
    };

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <>
            <SEO title="Home Dashboard" />
            {/* Dynamic Top Banner */}
            <div className="px-0">
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
                ) : pendingAttestMatch ? (
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-600 to-amber-700 p-8 shadow-[0_0_30px_rgba(217,119,6,0.3)] border border-white/20 group">
                        <div className="relative z-10 flex flex-col items-start gap-4">
                            <div className="flex items-center gap-2 px-2 py-1 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none">Awaiting Your Signature</span>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white mb-1 flex items-center gap-2 uppercase italic">
                                    {pendingAttestMatch.courses?.name || 'Match Complete'}
                                </h2>
                                <p className="text-white/80 text-[10px] font-bold uppercase tracking-[0.2em]">Review Scores · Sign Off</p>
                            </div>
                            <Button
                                onClick={handleAttest}
                                className="w-full bg-white text-amber-700 hover:bg-white/90 font-black shadow-lg flex items-center justify-center gap-2 py-6 rounded-2xl group/btn transition-transform active:scale-[0.98]"
                            >
                                REVIEW & ATTEST
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-[#1a1a1c] border border-white/10 flex flex-col items-center justify-center group shadow-2xl min-h-[300px] text-center p-8">
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
                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-neonGreen/5 rounded-full blur-2xl group-hover:bg-neonGreen/10 transition-colors" />
                            <div className="w-14 h-14 rounded-2xl bg-neonGreen/10 border border-neonGreen/20 flex items-center justify-center text-neonGreen shadow-inner relative shrink-0 transition-transform group-hover:scale-110 duration-500">
                                <Flag className="w-7 h-7 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]" />
                            </div>
                            <div className="flex-1 flex flex-col justify-center relative z-10">
                                <span className="block text-white font-black text-lg uppercase leading-none italic group-hover:text-neonGreen transition-colors">Start Round</span>
                                <span className="text-[9px] text-secondaryText font-black uppercase tracking-widest mt-1 opacity-60">Tee It Up</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </section>



            <section className="px-4">
                <div className="flex items-center justify-between mb-4 ml-1">
                    <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest">Activity Feed</h3>
                    <Link to="/discover" className="text-[10px] text-neonGreen font-black uppercase tracking-widest hover:underline flex items-center gap-1 drop-shadow-[0_0_5px_rgba(0,255,102,0.3)]">
                        <Compass className="w-3.5 h-3.5" />
                        Discover
                    </Link>
                </div>
                <ActivityFeed />
            </section>
        </>
    );
}
