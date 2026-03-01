import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, ChevronRight, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMatchStore } from '../store/useMatchStore';

export default function Home() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { loadMatch } = useMatchStore();
    const [activeMatch, setActiveMatch] = useState<any>(null);

    useEffect(() => {
        if (!profile) return;

        async function checkActiveMatch() {
            const { data } = await supabase
                .from('match_players')
                .select('match_id, matches!inner(id, status, created_at, courses(name))')
                .eq('user_id', profile?.id)
                .eq('matches.status', 'in_progress')
                .order('matches(created_at)', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                setActiveMatch((data[0] as any).matches);
            }
        }

        checkActiveMatch();
    }, [profile]);

    const handleResume = async () => {
        if (!activeMatch) return;
        localStorage.setItem('activeMatchId', activeMatch.id);
        await loadMatch(activeMatch.id);
        navigate('/play/1');
    };

    const recentActivity = [
        { id: '1', user: 'Mike D.', action: 'finished', score: '-2', course: 'Pebble Beach', time: '2h ago' },
        { id: '2', user: 'Chris P.', action: 'won', amount: '$45', course: 'Spyglass Hill', time: '5h ago' },
        { id: '3', user: 'You', action: 'posted', score: '+4', course: 'Spanish Bay', time: 'Yesterday' }
    ];

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <div className="flex-1 overflow-y-auto momentum-scroll space-y-8 pb-32 pt-6">
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
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-[#1a1a1c] border border-white/5 p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between group shadow-2xl min-h-[260px]">
                        {/* Decorative Premium Backgrounds */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,0,63,0.15),transparent_50%)]" />
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-bloodRed/10 rounded-full blur-[80px]" />

                        <div className="relative z-10 text-center sm:text-left space-y-2 order-2 sm:order-1 mt-6 sm:mt-0">
                            <h2 className="text-5xl sm:text-6xl font-black text-white italic tracking-tighter leading-none flex flex-col">
                                <span className="text-bloodRed drop-shadow-[0_0_15px_rgba(255,0,63,0.3)]">READY TO</span>
                                <span>TEE OFF?</span>
                            </h2>
                            <div className="h-1.5 w-16 bg-bloodRed rounded-full mx-auto sm:mx-0 shadow-[0_0_10px_rgba(255,0,63,0.5)]" />
                        </div>

                        <div className="relative z-10 w-40 h-40 sm:w-52 sm:h-52 order-1 sm:order-2 transition-transform duration-700 group-hover:scale-105">
                            <div className="absolute inset-0 bg-bloodRed/20 rounded-full blur-3xl animate-pulse" />
                            <img
                                src="/logo-final.png"
                                alt="BloodSheet Golf"
                                className="w-full h-full object-contain filter drop-shadow-[0_0_35px_rgba(255,0,63,0.5)] relative z-10"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions Grid */}
            <section className="px-4">
                <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest mb-4 ml-1">Player Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                    <Link to="/dashboard">
                        <Card className="p-5 bg-surface hover:border-bloodRed/50 transition-all group flex flex-col gap-4 border-white/5">
                            <div className="w-12 h-12 rounded-2xl bg-surfaceHover border border-borderColor flex items-center justify-center font-black text-bloodRed text-xs shadow-inner overflow-hidden relative">
                                {profile?.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="relative z-10">{initials}</span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 h-1 bg-bloodRed/30" />
                            </div>
                            <div>
                                <span className="block text-white font-black text-sm uppercase">HCP {profile?.handicap?.toFixed(1) || '0.0'}</span>
                                <span className="text-[10px] text-secondaryText font-bold uppercase truncate max-w-full block">View Profile</span>
                            </div>
                        </Card>
                    </Link>
                    <Link to="/setup">
                        <Card className="p-5 bg-surface hover:border-neonGreen/50 transition-all group flex flex-col gap-4 border-white/5 shadow-lg">
                            <div className="w-12 h-12 rounded-2xl bg-neonGreen/10 flex items-center justify-center text-neonGreen group-hover:scale-110 transition-transform">
                                <Plus className="w-7 h-7" />
                            </div>
                            <div>
                                <span className="block text-white font-black text-sm uppercase">Start Match</span>
                                <span className="text-[10px] text-secondaryText font-bold uppercase">Setup Rounds</span>
                            </div>
                        </Card>
                    </Link>
                </div>
            </section>

            {/* Recent Activity Feed */}
            <section className="px-4">
                <div className="flex items-center justify-between mb-4 ml-1">
                    <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest">Recent Activity</h3>
                    <Link to="/activity" className="text-[10px] text-bloodRed font-black uppercase tracking-widest hover:underline">See All</Link>
                </div>
                <div className="space-y-3">
                    {recentActivity.map((act) => (
                        <Card key={act.id} className="p-4 bg-surface border-borderColor flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold text-bloodRed">
                                    {act.user.charAt(0)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-white text-xs">{act.user}</span>
                                        <span className="text-[10px] text-secondaryText font-bold uppercase">{act.action}</span>
                                    </div>
                                    <span className="text-[10px] font-black italic text-bloodRed uppercase tracking-tight">{act.course}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                {act.score && <span className="block font-black text-white text-sm">{act.score}</span>}
                                {act.amount && <span className="block font-black text-neonGreen text-sm">{act.amount}</span>}
                                <span className="text-[8px] text-secondaryText uppercase font-black">{act.time}</span>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* Mini Dashboard Snippet */}
            <section className="px-4">
                <Card className="p-6 bg-surface border-borderColor relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 font-black opacity-[0.03] text-6xl tracking-tighter select-none group-hover:opacity-[0.05] transition-opacity">
                        STATS
                    </div>
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest">Player Profile</h3>
                            <span className="block text-2xl font-black text-white italic tracking-tight uppercase">Dashboard</span>
                        </div>
                        <Link to="/dashboard">
                            <Button variant="outline" size="sm" className="rounded-full border-bloodRed/30 text-bloodRed font-black text-[10px] tracking-widest px-6 hover:bg-bloodRed hover:text-white transition-all">
                                VIEW
                            </Button>
                        </Link>
                    </div>
                </Card>
            </section>
        </div>
    );
}
