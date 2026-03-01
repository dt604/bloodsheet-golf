import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeaderEntry {
    userId: string;
    fullName: string;
    avatarUrl?: string;
    totalEarnings: number;
    wins: number;
    losses: number;
    pushes: number;
}

export default function MoneyLeaders() {
    const navigate = useNavigate();
    const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchLeaders() {
            const { data: matches } = await supabase
                .from('matches')
                .select('id, format, wager_amount, side_bets, courses(holes)')
                .eq('status', 'completed');

            if (!matches?.length) { setLoading(false); return; }

            const matchIds = matches.map((m: any) => m.id);

            const [{ data: allPlayers }, { data: allScores }, { data: allProfiles }] = await Promise.all([
                supabase.from('match_players').select('match_id, user_id, team').in('match_id', matchIds),
                supabase.from('hole_scores').select('match_id, hole_number, player_id, net, gross').in('match_id', matchIds),
                supabase.from('profiles').select('id, full_name, avatar_url'),
            ]);

            const earningsMap: Record<string, { earnings: number; wins: number; losses: number; pushes: number }> = {};

            for (const match of matches as any[]) {
                const matchId = match.id as string;
                const wager = match.wager_amount as number;
                const format = match.format as string;

                const matchPlayers = (allPlayers ?? []).filter((p: any) => p.match_id === matchId);
                const matchScores = (allScores ?? []).filter((s: any) => s.match_id === matchId);

                const teamA = matchPlayers.filter((p: any) => p.team === 'A');
                const teamB = matchPlayers.filter((p: any) => p.team === 'B');
                if (!teamA.length || !teamB.length) continue;

                function holePoints(hole: number): { a: number; b: number } {
                    const aScores = teamA.map((p: any) => matchScores.find((s: any) => s.hole_number === hole && s.player_id === p.user_id)).filter(Boolean);
                    const bScores = teamB.map((p: any) => matchScores.find((s: any) => s.hole_number === hole && s.player_id === p.user_id)).filter(Boolean);
                    if (!aScores.length || !bScores.length) return { a: 0, b: 0 };
                    const aNets = aScores.map((s: any) => s.net as number);
                    const bNets = bScores.map((s: any) => s.net as number);
                    if (format === '2v2') {
                        let a = 0, b = 0;
                        const aLow = Math.min(...aNets), bLow = Math.min(...bNets);
                        if (aLow < bLow) a++; else if (bLow < aLow) b++;
                        const aSum = aNets.reduce((x: number, y: number) => x + y, 0);
                        const bSum = bNets.reduce((x: number, y: number) => x + y, 0);
                        if (aSum < bSum) a++; else if (bSum < aSum) b++;
                        return { a, b };
                    }
                    if (aNets[0] < bNets[0]) return { a: 1, b: 0 };
                    if (bNets[0] < aNets[0]) return { a: 0, b: 1 };
                    return { a: 0, b: 0 };
                }

                function nassauResult(holes: number[]): number {
                    let aPts = 0, bPts = 0;
                    for (const h of holes) { const { a, b } = holePoints(h); aPts += a; bPts += b; }
                    if (aPts > bPts) return wager;
                    if (bPts > aPts) return -wager;
                    return 0;
                }

                const holesPlayed = [...new Set(matchScores.map((s: any) => s.hole_number as number))].sort((a, b) => (a as number) - (b as number)) as number[];
                const front = holesPlayed.filter((h) => h <= 9);
                const back = holesPlayed.filter((h) => h > 9);

                // Overall result from Team A's perspective
                const matchResult =
                    (front.length >= 9 ? nassauResult(front) : 0) +
                    (back.length >= 9 ? nassauResult(back) : 0) +
                    (holesPlayed.length >= 18 ? nassauResult(holesPlayed) : 0);

                for (const p of matchPlayers as any[]) {
                    const userId = p.user_id as string;
                    const earnings = p.team === 'A' ? matchResult : -matchResult;
                    if (!earningsMap[userId]) earningsMap[userId] = { earnings: 0, wins: 0, losses: 0, pushes: 0 };
                    earningsMap[userId].earnings += earnings;
                    if (earnings > 0) earningsMap[userId].wins++;
                    else if (earnings < 0) earningsMap[userId].losses++;
                    else earningsMap[userId].pushes++;
                }
            }

            const entries: LeaderEntry[] = Object.entries(earningsMap).map(([userId, stats]) => {
                const profile = (allProfiles ?? []).find((p: any) => p.id === userId) as any;
                return {
                    userId,
                    fullName: profile?.full_name ?? 'Unknown',
                    avatarUrl: profile?.avatar_url ?? undefined,
                    totalEarnings: stats.earnings,
                    wins: stats.wins,
                    losses: stats.losses,
                    pushes: stats.pushes,
                };
            });

            entries.sort((a, b) => b.totalEarnings - a.totalEarnings);
            setLeaders(entries);
            setLoading(false);
        }

        fetchLeaders();
    }, []);

    const rankColor = (i: number) =>
        i === 0 ? 'text-yellow-400' : i === 1 ? 'text-white/50' : i === 2 ? 'text-amber-600' : 'text-secondaryText';
    const rankBorder = (i: number) =>
        i === 0 ? 'border-yellow-500/40' : i === 1 ? 'border-white/10' : i === 2 ? 'border-amber-700/30' : 'border-borderColor';

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <header className="flex items-center gap-3 p-4 border-b border-borderColor shrink-0 bg-background z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="font-black text-lg uppercase italic tracking-tight leading-none">Money Leaders</h1>
                    <p className="text-[10px] text-secondaryText font-black uppercase tracking-widest mt-0.5">All-Time Earnings</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-2 pb-8">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : leaders.length === 0 ? (
                    <div className="text-center py-16 text-secondaryText text-sm font-black uppercase tracking-widest">
                        No completed matches yet
                    </div>
                ) : leaders.map((entry, i) => {
                    const isPositive = entry.totalEarnings > 0;
                    const isNegative = entry.totalEarnings < 0;
                    const initials = entry.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                    return (
                        <div key={entry.userId} className={`flex items-center gap-3 p-3.5 rounded-2xl bg-surface border ${rankBorder(i)}`}>
                            <span className={`w-5 text-center font-black text-sm shrink-0 ${rankColor(i)}`}>{i + 1}</span>
                            <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-black text-sm shrink-0 overflow-hidden">
                                {entry.avatarUrl && !entry.avatarUrl.includes('profile_default') ? (
                                    <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-bloodRed italic">{initials}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="block font-black text-sm text-white uppercase italic truncate">{entry.fullName}</span>
                                <span className="text-[9px] text-secondaryText font-black uppercase tracking-widest">
                                    {entry.wins}W · {entry.losses}L{entry.pushes > 0 ? ` · ${entry.pushes}P` : ''}
                                </span>
                            </div>
                            <span className={`font-black text-base shrink-0 ${isPositive ? 'text-neonGreen' : isNegative ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                {isPositive ? '+' : isNegative ? '-' : ''}${Math.abs(entry.totalEarnings)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
