import { Card } from '../../components/ui/Card';
import { Trophy, Trash2, ExternalLink } from 'lucide-react';

const mockMatches = [
    { id: '1', course: 'Torrey Pines', players: 'Dan & John vs Sammie & Tiger', status: 'In Progress', wager: '$20', type: 'Nassau' },
    { id: '2', course: 'Pebble Beach', players: 'Phil vs Brooks', status: 'Completed', wager: '$50', type: 'Per Hole' },
    { id: '3', course: 'St Andrews', players: 'Rory vs Scottie', status: 'Setup', wager: '$10', type: 'Nassau' },
];

export default function MatchManagement() {
    return (
        <div className="space-y-6">
            <header className="px-2">
                <h2 className="text-2xl font-black text-white tracking-tight">Match Oversight</h2>
                <p className="text-xs text-secondaryText font-bold uppercase tracking-wider">Monitor and manage all active rounds</p>
            </header>

            <section className="space-y-3">
                {mockMatches.map((match) => (
                    <Card key={match.id} className="p-4 group hover:border-bloodRed/50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Trophy className={`w-4 h-4 ${match.status === 'In Progress' ? 'text-neonGreen' : 'text-secondaryText'}`} />
                                <span className="text-sm font-black text-white">{match.course}</span>
                            </div>
                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${match.status === 'In Progress'
                                ? 'bg-neonGreen/10 text-neonGreen border-neonGreen/20'
                                : 'bg-surfaceHover text-secondaryText border-borderColor'
                                }`}>
                                {match.status}
                            </span>
                        </div>

                        <p className="text-xs text-secondaryText mb-4">{match.players}</p>

                        <div className="flex items-center justify-between pt-3 border-t border-borderColor/30">
                            <div className="flex gap-4">
                                <div className="text-left">
                                    <span className="block text-[8px] text-secondaryText font-black uppercase tracking-widest">Wager</span>
                                    <span className="text-xs font-bold text-white">{match.wager}</span>
                                </div>
                                <div className="text-left">
                                    <span className="block text-[8px] text-secondaryText font-black uppercase tracking-widest">Format</span>
                                    <span className="text-xs font-bold text-white">{match.type}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button className="p-2 text-secondaryText hover:text-white transition-colors">
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-secondaryText hover:text-bloodRed transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </Card>
                ))}
            </section>
        </div>
    );
}
