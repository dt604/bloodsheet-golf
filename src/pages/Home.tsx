import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Users, ChevronRight, Zap } from 'lucide-react';
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
        <div className="flex-1 overflow-y-auto momentum-scroll space-y-8 pb-32">
            {/* Header Area */}
            {/* Premium Centralized Header */}
            <header className="relative pt-12 pb-6 px-4 flex flex-col items-center">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-bloodRed/5 rounded-full blur-[100px] -z-10" />

                {/* Large Central Logo */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-bloodRed/20 rounded-full blur-2xl group-hover:bg-bloodRed/30 transition-all duration-700" />
                    <img
                        src="/logo-final.png"
                        alt="BloodSheet"
                        className="w-32 h-32 object-contain relative z-10 drop-shadow-[0_0_20px_rgba(255,0,0,0.4)] transition-transform duration-500 hover:scale-105"
                    />
                </div>

                {/* Profile Info Underneath */}
                <div className="mt-6 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4">
                        <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-bloodRed/50" />
                        <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-bloodRed to-neonGreen shadow-[0_0_15px_rgba(255,0,0,0.2)]">
                            <div className="w-full h-full rounded-full bg-surfaceHover border border-black/20 flex items-center justify-center font-black text-bloodRed text-xs overflow-hidden">
                                {profile?.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    initials
                                )}
                            </div>
                        </div>
                        <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-bloodRed/50" />
                    </div>

                    <div className="text-center">
                        <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
                            {profile?.fullName || 'GOLFER'}
                        </h2>
                        <p className="text-[9px] text-secondaryText font-black uppercase tracking-[0.3em] mt-0.5 opacity-60">
                            Member since {new Date(profile?.createdAt || Date.now()).getFullYear()}
                        </p>
                    </div>
                </div>
            </header>

            {/* Dynamic Top Banner */}
            <div className="px-4">
                {activeMatch && (
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bloodRed to-[#C4002F] p-6 shadow-[0_0_30px_rgba(255,0,63,0.3)] border border-white/20 group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Zap className="w-32 h-32 text-white" />
                        </div>

                        <div className="relative z-10 flex flex-col items-start gap-4">
                            <div className="flex items-center gap-2 px-2 py-1 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none">Live Round</span>
                            </div>

                            <div>
                                <h2 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
                                    {activeMatch.courses?.name || 'Active Match'}
                                </h2>
                                <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Hole 1 • Skins & Trash</p>
                            </div>

                            <Button
                                onClick={handleResume}
                                className="w-full bg-white text-bloodRed hover:bg-white/90 font-black shadow-lg flex items-center justify-center gap-2 py-6 rounded-2xl group/btn"
                            >
                                RESUME MATCH
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Actions Grid */}
            <section className="px-4">
                <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest mb-4 ml-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                    <Link to="/setup">
                        <Card className="p-5 bg-surface hover:border-neonGreen/50 transition-all group flex flex-col gap-4">
                            <div className="w-10 h-10 rounded-xl bg-neonGreen/10 flex items-center justify-center text-neonGreen group-hover:scale-110 transition-transform">
                                <Plus className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-white font-black text-sm uppercase">Start</span>
                                <span className="text-[10px] text-secondaryText font-bold uppercase">New Match</span>
                            </div>
                        </Card>
                    </Link>
                    <Link to="/join">
                        <Card className="p-5 bg-surface hover:border-bloodRed/50 transition-all group flex flex-col gap-4">
                            <div className="w-10 h-10 rounded-xl bg-bloodRed/10 flex items-center justify-center text-bloodRed group-hover:scale-110 transition-transform">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-white font-black text-sm uppercase">Join</span>
                                <span className="text-[10px] text-secondaryText font-bold uppercase">with code</span>
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
