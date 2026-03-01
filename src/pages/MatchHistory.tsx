import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Home } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface MatchHistoryItem {
    id: string;
    courseName: string;
    playerLabel: string;
    format: string;
    wagerType: string;
    createdAt: string;
    payout: number;
    holesUp: number;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MatchHistoryPage() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [history, setHistory] = useState<MatchHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        async function load() {
            const userId = profile!.id;

            const { data: userMatchPlayers } = await supabase
                .from('match_players')
                .select('match_id, team')
                .eq('user_id', userId);
            const allMatchIds = (userMatchPlayers ?? []).map((mp) => mp.match_id as string);
            if (allMatchIds.length === 0) { setLoading(false); return; }

            const { data: matches } = await supabase
                .from('matches')
                .select('id, format, wager_type, wager_amount, status, created_at, courses(name)')
                .in('id', allMatchIds)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            if (!matches) { setLoading(false); return; }

            const matchIds = (matches as any[]).map((m) => m.id as string);
            const { data: allPlayers } = await supabase
                .from('match_players')
                .select('match_id, user_id, team, guest_name')
                .in('match_id', matchIds);

            const playerUserIds = [...new Set(
                (allPlayers ?? []).map((p) => (p as any).user_id as string).filter(Boolean)
            )];
            const nameMap: Record<string, string> = {};
            if (playerUserIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', playerUserIds);
                for (const pr of (profiles ?? []) as { id: string; full_name: string }[]) {
                    nameMap[pr.id] = pr.full_name;
                }
            }

            const items: MatchHistoryItem[] = (matches as any[]).map((m) => {
                const matchId = m.id as string;
                const matchPlayers = (allPlayers ?? []).filter((p) => (p as any).match_id === matchId);
                const otherPlayers = matchPlayers
                    .filter((p) => (p as any).user_id !== userId)
                    .map((p) => {
                        const row = p as any;
                        return row.guest_name ?? nameMap[row.user_id] ?? 'Guest';
                    });
                const playerLabel = otherPlayers.length > 0 ? `vs. ${otherPlayers.slice(0, 2).join(', ')}` : 'Solo';
                return {
                    id: matchId,
                    courseName: (m.courses as any)?.name ?? 'Unknown Course',
                    playerLabel,
                    format: m.format as string,
                    wagerType: m.wager_type as string,
                    createdAt: m.created_at as string,
                    payout: 0,
                    holesUp: 0,
                };
            });
            setHistory(items);

            // Compute payouts
            const { data: allScores } = await supabase
                .from('hole_scores')
                .select('match_id, hole_number, player_id, gross, net, trash_dots')
                .in('match_id', matchIds);

            const { data: completedMatches } = await supabase
                .from('matches')
                .select('id, format, wager_amount, side_bets, courses(holes)')
                .in('id', matchIds);

            const payoutMap: Record<string, { payout: number; holesUp: number }> = {};

            for (const matchRow of (completedMatches ?? []) as any[]) {
                const matchId = matchRow.id as string;
                const format = matchRow.format as string;
                const wagerAmount = matchRow.wager_amount as number;
                const myEntry = (userMatchPlayers ?? []).find((mp) => mp.match_id === matchId);
                if (!myEntry) continue;
                const myTeam = myEntry.team as 'A' | 'B';
                const oppTeam: 'A' | 'B' = myTeam === 'A' ? 'B' : 'A';
                const matchPlayers = (allPlayers ?? []).filter((p) => (p as any).match_id === matchId);
                const matchScores = (allScores ?? []).filter((s) => (s as any).match_id === matchId);

                if (format === 'skins') {
                    const numPlayers = matchPlayers.length;
                    const sideBets = matchRow.side_bets as { teamSkins?: boolean; potMode?: boolean } | null;
                    const isTeamSkins = sideBets?.teamSkins ?? false;
                    const isPotMode = sideBets?.potMode ?? false;
                    const skinCounts: Record<string, number> = {};
                    let carry = 0;
                    let skinsPayout = 0;

                    function hScoresForHole(h: number) {
                        return matchScores
                            .filter((s) => (s as any).hole_number === h)
                            .map((s) => ({
                                playerId: (s as any).player_id as string,
                                net: (s as any).net as number,
                                team: ((matchPlayers.find(p => (p as any).user_id === (s as any).player_id) as any)?.team ?? 'A') as 'A' | 'B',
                            }));
                    }

                    // First pass: count skins per player
                    for (let h = 1; h <= 18; h++) {
                        const hScores = hScoresForHole(h);
                        if (hScores.length < numPlayers) continue;
                        const holesInPot = 1 + carry;
                        if (isTeamSkins) {
                            const aNet = Math.min(...hScores.filter(s => s.team === 'A').map(s => s.net));
                            const bNet = Math.min(...hScores.filter(s => s.team === 'B').map(s => s.net));
                            if (aNet !== bNet) {
                                const winTeam = aNet < bNet ? 'A' : 'B';
                                hScores.filter(s => s.team === winTeam).forEach(s => {
                                    skinCounts[s.playerId] = (skinCounts[s.playerId] ?? 0) + holesInPot;
                                });
                                carry = 0;
                            } else carry += 1;
                        } else {
                            const minNet = Math.min(...hScores.map(s => s.net));
                            const winners = hScores.filter(s => s.net === minNet);
                            if (winners.length === 1) {
                                skinCounts[winners[0].playerId] = (skinCounts[winners[0].playerId] ?? 0) + holesInPot;
                                carry = 0;
                            } else carry += 1;
                        }
                    }

                    if (isPotMode) {
                        const pot = wagerAmount * numPlayers;
                        const maxSkins = Math.max(0, ...Object.values(skinCounts));
                        const potWinners = maxSkins > 0 ? Object.keys(skinCounts).filter(id => skinCounts[id] === maxSkins) : [];
                        const potShare = potWinners.length > 1 ? pot / potWinners.length : pot;
                        skinsPayout = potWinners.includes(userId) ? potShare - wagerAmount : -wagerAmount;
                    } else {
                        // Per-skin payout
                        let carry2 = 0;
                        for (let h = 1; h <= 18; h++) {
                            const hScores = hScoresForHole(h);
                            if (hScores.length < numPlayers) continue;
                            const holesInPot = 1 + carry2;
                            const potVal = holesInPot * wagerAmount;
                            if (isTeamSkins) {
                                const aNet = Math.min(...hScores.filter(s => s.team === 'A').map(s => s.net));
                                const bNet = Math.min(...hScores.filter(s => s.team === 'B').map(s => s.net));
                                if (aNet !== bNet) {
                                    const winTeam = aNet < bNet ? 'A' : 'B';
                                    const myScore = hScores.find(s => s.playerId === userId);
                                    const numOpp = hScores.filter(s => s.team !== winTeam).length;
                                    const numWin = hScores.filter(s => s.team === winTeam).length;
                                    if (myScore?.team === winTeam) skinsPayout += potVal * numOpp;
                                    else skinsPayout -= potVal * numWin;
                                    carry2 = 0;
                                } else carry2 += 1;
                            } else {
                                const minNet = Math.min(...hScores.map(s => s.net));
                                const winners = hScores.filter(s => s.net === minNet);
                                if (winners.length === 1) {
                                    skinsPayout += winners[0].playerId === userId ? potVal * (numPlayers - 1) : -potVal;
                                    carry2 = 0;
                                } else carry2 += 1;
                            }
                        }
                    }
                    payoutMap[matchId] = { payout: skinsPayout, holesUp: 0 };
                } else {
                    const myTeamPlayers = matchPlayers.filter((p) => (p as any).team === myTeam);
                    const oppTeamPlayers = matchPlayers.filter((p) => (p as any).team === oppTeam);
                    let myPts = 0, oppPts = 0;
                    for (let h = 1; h <= 18; h++) {
                        const myScores = myTeamPlayers.map((p) => {
                            const s = matchScores.find((sc) => (sc as any).hole_number === h && (sc as any).player_id === (p as any).user_id);
                            return s ? (s as any).net as number : null;
                        }).filter((n): n is number => n !== null);
                        const oppScores = oppTeamPlayers.map((p) => {
                            const s = matchScores.find((sc) => (sc as any).hole_number === h && (sc as any).player_id === (p as any).user_id);
                            return s ? (s as any).net as number : null;
                        }).filter((n): n is number => n !== null);
                        if (!myScores.length || !oppScores.length) continue;
                        const myBest = Math.min(...myScores), oppBest = Math.min(...oppScores);
                        if (myBest < oppBest) myPts++;
                        else if (oppBest < myBest) oppPts++;
                    }
                    const front9 = Array.from({ length: 9 }, (_, i) => i + 1);
                    const back9 = Array.from({ length: 9 }, (_, i) => i + 10);
                    const score9 = (holes: number[]) => {
                        let my = 0, opp = 0;
                        for (const h of holes) {
                            const myS = myTeamPlayers.map((p) => { const s = matchScores.find((sc) => (sc as any).hole_number === h && (sc as any).player_id === (p as any).user_id); return s ? (s as any).net as number : null; }).filter((n): n is number => n !== null);
                            const oppS = oppTeamPlayers.map((p) => { const s = matchScores.find((sc) => (sc as any).hole_number === h && (sc as any).player_id === (p as any).user_id); return s ? (s as any).net as number : null; }).filter((n): n is number => n !== null);
                            if (!myS.length || !oppS.length) continue;
                            if (Math.min(...myS) < Math.min(...oppS)) my++;
                            else if (Math.min(...oppS) < Math.min(...myS)) opp++;
                        }
                        if (my > opp) return wagerAmount;
                        if (opp > my) return -wagerAmount;
                        return 0;
                    };
                    const allHolesPlayed = matchScores.map((s) => (s as any).hole_number as number);
                    const front9Played = front9.filter((h) => allHolesPlayed.includes(h));
                    const back9Played = back9.filter((h) => allHolesPlayed.includes(h));
                    const payout = (front9Played.length >= 9 ? score9(front9) : 0) + (back9Played.length >= 9 ? score9(back9) : 0) + (allHolesPlayed.length >= 18 ? score9([...front9, ...back9]) : 0);
                    payoutMap[matchId] = { payout, holesUp: myPts - oppPts };
                }
            }

            setHistory((prev) => prev.map((item) => ({
                ...item,
                payout: payoutMap[item.id]?.payout ?? 0,
                holesUp: payoutMap[item.id]?.holesUp ?? 0,
            })));
            setLoading(false);
        }
        load();
    }, [profile]);

    return (
        <div className="flex flex-col h-full bg-background font-sans">
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-surface/90 backdrop-blur sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2 ml-1">
                        <History className="w-4 h-4 text-secondaryText" />
                        <h2 className="text-xl font-black text-white tracking-tighter pt-0.5">Match History</h2>
                    </div>
                </div>
                <button onClick={() => navigate('/home')} className="p-2 text-secondaryText hover:text-white transition-colors" title="Home Hub">
                    <Home className="w-5 h-5" />
                </button>
            </header>

            <main className="flex-1 overflow-y-auto momentum-scroll p-4 pb-8">
                {loading ? (
                    <p className="text-center text-secondaryText mt-8">Loading...</p>
                ) : history.length === 0 ? (
                    <p className="text-center text-secondaryText mt-8">No completed matches yet.</p>
                ) : (
                    <Card className="divide-y divide-borderColor/50">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer"
                                onClick={() => navigate(`/history/${item.id}`)}
                            >
                                <div>
                                    <span className="font-bold text-white block">{item.courseName} • {item.format}</span>
                                    <span className="text-xs text-secondaryText block mt-0.5">{item.playerLabel}</span>
                                    <span className="text-xs text-secondaryText uppercase tracking-wider">
                                        {formatDate(item.createdAt)} • {item.wagerType}
                                    </span>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <div className={`font-black text-base leading-tight ${item.payout > 0 ? 'text-neonGreen' : item.payout < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                        {item.payout > 0 ? `+$${item.payout}` : item.payout < 0 ? `-$${Math.abs(item.payout)}` : 'PUSH'}
                                    </div>
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${item.holesUp > 0 ? 'text-neonGreen' : item.holesUp < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                        {item.format === 'skins' ? 'SKINS' : item.holesUp > 0 ? `${item.holesUp} UP` : item.holesUp < 0 ? `${Math.abs(item.holesUp)} DN` : 'A/S'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </Card>
                )}
            </main>
        </div>
    );
}
