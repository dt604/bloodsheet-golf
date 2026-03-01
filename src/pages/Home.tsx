import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    Plus,
    Users,
    ChevronRight,
    Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
    // UI-Only Mock Data (No Logic for now as requested)
    const hasActiveMatch = true;
    const recentActivity = [
        { id: '1', user: 'Mike D.', action: 'finished', score: '-2', course: 'Pebble Beach', time: '2h ago' },
        { id: '2', user: 'Chris P.', action: 'won', amount: '$45', course: 'Spyglass Hill', time: '5h ago' },
        { id: '3', user: 'You', action: 'posted', score: '+4', course: 'Spanish Bay', time: 'Yesterday' }
    ];

    return (
        <div className="space-y-8 pb-24">
            {/* Header Area */}
            <header className="px-4 pt-4 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter italic uppercase">
                        Blood<span className="text-bloodRed">Sheet</span>
                    </h1>
                    <p className="text-[10px] text-secondaryText font-black uppercase tracking-[0.2em] mt-1">
                        Golf Social Hub
                    </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-surface border border-borderColor flex items-center justify-center font-black text-bloodRed">
                    D
                </div>
            </header>

            {/* Active Match Banner (Sunlight Mode Premium) */}
            {hasActiveMatch && (
                <div className="px-4">
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
                                    Pebble Beach GL
                                </h2>
                                <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Hole 14 • 2v2 Skins</p>
                            </div>

                            <Link to="/scorecard" className="w-full">
                                <Button className="w-full bg-white text-bloodRed hover:bg-white/90 font-black shadow-lg flex items-center justify-center gap-2 py-6 rounded-2xl group/btn">
                                    RESUME MATCH
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions Grid */}
            <section className="px-4">
                <h3 className="text-[10px] text-secondaryText font-black uppercase tracking-widest mb-4 ml-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-4">
                    <Link to="/match/setup">
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
