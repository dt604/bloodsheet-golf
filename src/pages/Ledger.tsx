import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Receipt } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';

interface LineItem {
    label: string;
    sublabel: string;
    amount: number;
    isPress?: boolean;
}

interface Settlement {
    opponentName: string;
    total: number;
    items: LineItem[];
}

export default function LedgerPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { matchId, match, players, scores, presses, course, loadMatch, refreshScores } = useMatchStore();

    const [settlement, setSettlement] = useState<Settlement | null>(null);

    // On mount: full load if store is empty, otherwise refresh scores only
    useEffect(() => {
        if (!matchId) return;
        if (!match) loadMatch(matchId);
        else refreshScores(matchId);
    }, [matchId]);

    useEffect(() => {
        if (!match || !user) return;
        let cancelled = false;

        async function calculate() {
            const opponentIds = players
                .filter((p) => p.userId !== user!.id)
                .map((p) => p.userId);

            const nameMap: Record<string, string> = {};
            if (opponentIds.length > 0) {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', opponentIds);
                for (const row of (data ?? []) as { id: string; full_name: string }[]) {
                    nameMap[row.id] = row.full_name;
                }
            }

            const myPlayer = players.find((p) => p.userId === user!.id);
            if (!myPlayer) return;

            const myTeam = myPlayer.team;
            const oppTeam: 'A' | 'B' = myTeam === 'A' ? 'B' : 'A';

            // First player on the opposing team (for display name)
            const oppPlayer = players.find((p) => p.team === oppTeam);
            if (!oppPlayer) return;

            const oppName = oppPlayer.guestName ?? nameMap[oppPlayer.userId] ?? 'Opponent';

            const myTeamPlayers = players.filter((p) => p.team === myTeam);
            const oppTeamPlayers = players.filter((p) => p.team === oppTeam);

            // Per-hole scores for all players on each team
            function teamScoresOnHole(teamPlayers: typeof myTeamPlayers, hole: number): { net: number, gross: number }[] {
                return teamPlayers
                    .map((p) => {
                        const s = scores.find((sc) => sc.holeNumber === hole && sc.playerId === p.userId);
                        return s ? { net: s.net, gross: s.gross } : undefined;
                    })
                    .filter((s): s is { net: number, gross: number } => s !== undefined);
            }

            // Determine which holes both teams have scores for
            const holesPlayed: number[] = [];
            for (let h = 1; h <= 18; h++) {
                if (teamScoresOnHole(myTeamPlayers, h).length > 0 && teamScoresOnHole(oppTeamPlayers, h).length > 0) {
                    holesPlayed.push(h);
                }
            }

            // Points my team earned vs opp on a given hole (1v1: 0 or 1; 2v2 high-low: 0, 1, or 2)
            function holePoints(hole: number): { my: number; opp: number } {
                const myScores = teamScoresOnHole(myTeamPlayers, hole);
                const oppScores = teamScoresOnHole(oppTeamPlayers, hole);
                if (!myScores.length || !oppScores.length) return { my: 0, opp: 0 };

                const par = course?.holes?.find((h) => h.number === hole)?.par ?? 4;
                const birdiesDouble = match?.sideBets?.birdiesDouble ?? false;

                const myHasBirdie = myScores.some((s) => s.net < par);
                const oppHasBirdie = oppScores.some((s) => s.net < par);

                const myNets = myScores.map(s => s.net);
                const oppNets = oppScores.map(s => s.net);

                if (match!.format === '2v2') {
                    let my = 0, opp = 0;
                    // Low ball
                    const myLow = Math.min(...myNets), oppLow = Math.min(...oppNets);
                    if (myLow < oppLow) my += (birdiesDouble && myHasBirdie) ? 2 : 1;
                    else if (oppLow < myLow) opp += (birdiesDouble && oppHasBirdie) ? 2 : 1;

                    // Aggregate
                    const mySum = myNets.reduce((a, b) => a + b, 0);
                    const oppSum = oppNets.reduce((a, b) => a + b, 0);
                    if (mySum < oppSum) my += (birdiesDouble && myHasBirdie) ? 2 : 1;
                    else if (oppSum < mySum) opp += (birdiesDouble && oppHasBirdie) ? 2 : 1;

                    return { my, opp };
                } else {
                    if (myNets[0] < oppNets[0]) return { my: (birdiesDouble && myHasBirdie) ? 2 : 1, opp: 0 };
                    if (oppNets[0] < myNets[0]) return { my: 0, opp: (birdiesDouble && oppHasBirdie) ? 2 : 1 };
                    return { my: 0, opp: 0 };
                }
            }

            // Nassau: whichever team has more points in the segment wins the bet
            function nassauResult(holes: number[]): number {
                let myPts = 0, oppPts = 0;
                for (const h of holes) {
                    const { my, opp } = holePoints(h);
                    myPts += my;
                    oppPts += opp;
                }
                if (myPts > oppPts) return match!.wagerAmount;
                if (oppPts > myPts) return -match!.wagerAmount;
                return 0;
            }

            const front9Holes = holesPlayed.filter((h) => h <= 9);
            const back9Holes = holesPlayed.filter((h) => h > 9);
            const front9Amount = front9Holes.length >= 9 ? nassauResult(front9Holes) : 0;
            const back9Amount = back9Holes.length >= 9 ? nassauResult(back9Holes) : 0;
            const overallAmount = holesPlayed.length >= 18 ? nassauResult(holesPlayed) : 0;

            const items: LineItem[] = [
                {
                    label: 'Front 9 (Base)',
                    sublabel: front9Amount > 0 ? 'Won' : front9Amount < 0 ? 'Lost' : 'Pushed',
                    amount: front9Amount,
                },
                {
                    label: 'Back 9 (Base)',
                    sublabel: back9Amount > 0 ? 'Won' : back9Amount < 0 ? 'Lost' : 'Pushed',
                    amount: back9Amount,
                },
                {
                    label: 'Overall (18 Holes)',
                    sublabel: overallAmount > 0 ? 'Won' : overallAmount < 0 ? 'Lost' : 'Pushed',
                    amount: overallAmount,
                },
            ];

            // Press line items
            // nassauResult already returns result from myTeam's perspective — no sign flip needed.
            for (const press of presses) {
                const pressHoles = holesPlayed.filter((h) => h >= press.startHole);
                const pressAmount = nassauResult(pressHoles);
                items.push({
                    label: `Press`,
                    sublabel: `Hole ${press.startHole} • Team ${press.pressedByTeam}`,
                    amount: pressAmount,
                    isPress: true,
                });
            }

            // Trash / side bets
            const trashVal = match!.sideBets.trashValue ?? 5;

            function trashLineItem(dot: string, label: string) {
                // Determine how many dots were earned by each team
                const myDots = scores.filter(
                    (s) => players.find((p) => p.userId === s.playerId && p.team === myTeam) && s.trashDots.includes(dot)
                ).length;
                const oppDots = scores.filter(
                    (s) => players.find((p) => p.userId === s.playerId && p.team === oppTeam) && s.trashDots.includes(dot)
                ).length;

                if (myDots === 0 && oppDots === 0) return;

                if (dot === 'snake') {
                    // Snake is strictly negative. The team holding the snake PAYS the other team.
                    items.push({
                        label,
                        sublabel: myDots > oppDots ? 'You held the snake 🐍' : 'Opponent held the snake 🐍',
                        amount: (oppDots - myDots) * trashVal, // They pay me if they have it, I pay them if I have it
                    });
                } else {
                    items.push({
                        label,
                        sublabel: `${myDots} won, ${oppDots} lost`,
                        amount: (myDots - oppDots) * trashVal,
                    });
                }
            }

            if (match!.sideBets.greenies) trashLineItem('greenie', 'Greenies');
            if (match!.sideBets.sandies) trashLineItem('sandie', 'Sandies');
            if (match!.sideBets.snake) trashLineItem('snake', 'Snake');

            const total = items.reduce((sum, i) => sum + i.amount, 0);
            if (!cancelled) setSettlement({ opponentName: oppName, total, items });
        }

        calculate();
        return () => { cancelled = true; };
    }, [match, players, scores, presses, user]);

    const total = settlement?.total ?? 0;
    const isWinner = total > 0;

    useEffect(() => {
        if (isWinner) {
            // Haptic success burst
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);

            // High-octane confetti cannon
            const duration = 2500;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 8,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#00FF66', '#FFFFFF', '#1C1C1E'],
                    zIndex: 100,
                });
                confetti({
                    particleCount: 8,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#00FF66', '#FFFFFF', '#1C1C1E'],
                    zIndex: 100,
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
        } else if (total < 0) {
            // Sad haptic for loss
            if (navigator.vibrate) navigator.vibrate([50, 100, 50, 100]);
        }
    }, [isWinner, total]);

    const settlementLabel = total > 0
        ? `${settlement?.opponentName ?? 'Opponent'} Owes You`
        : total < 0
            ? `You Owe ${settlement?.opponentName ?? 'Opponent'}`
            : 'All Square';

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            {/* Header - Stationary */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-background/95 backdrop-blur shrink-0 z-20">
                <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-secondaryText hover:text-white">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <span className="font-bold text-lg tracking-wide uppercase">Settlement</span>
                    <span className="block text-[10px] text-bloodRed font-black tracking-[0.2em] uppercase -mt-1 underline decoration-bloodRed/30 underline-offset-4">Match Ledger</span>
                </div>
                <button className="p-2 -mr-2 text-secondaryText hover:text-white transition-colors" onClick={() => window.print()}>
                    <Share2 className="w-5 h-5" />
                </button>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-6 pb-6 relative">
                {/* Hero Outcome */}
                <section className={`py-8 text-center flex flex-col items-center justify-center rounded-2xl relative overflow-hidden animate-in zoom-in-95 duration-500 ${isWinner ? 'bg-gradient-to-b from-neonGreen/10 to-transparent border border-neonGreen/20 shadow-[0_0_50px_rgba(0,255,102,0.1)]' : total < 0 ? 'bg-gradient-to-b from-bloodRed/10 to-transparent border border-bloodRed/10' : ''}`}>
                    <div className="w-16 h-16 rounded-full bg-surface border border-borderColor flex items-center justify-center mb-6 relative z-10">
                        <Receipt className={`w-8 h-8 ${isWinner ? 'text-neonGreen drop-shadow-[0_0_8px_rgba(0,255,102,0.8)]' : total < 0 ? 'text-bloodRed' : 'text-secondaryText'}`} />
                    </div>
                    <h2 className="text-sm font-bold text-secondaryText tracking-widest uppercase mb-2 relative z-10">{settlementLabel}</h2>
                    <div className={`text-7xl font-sans tracking-tighter font-black relative z-10 ${isWinner ? 'text-neonGreen drop-shadow-[0_0_20px_rgba(0,255,102,0.4)] scale-110 transition-transform duration-700' : total < 0 ? 'text-bloodRed drop-shadow-[0_0_20px_rgba(255,0,63,0.4)]' : 'text-secondaryText'}`}>
                        {total > 0 ? '+' : ''}${Math.abs(total)}
                    </div>
                    <p className="mt-4 text-sm text-white font-bold opacity-80 relative z-10">
                        {match?.format} • ${match?.wagerAmount} {match?.wagerType} vs {settlement?.opponentName ?? '…'}
                    </p>
                </section>

                {/* Detailed Breakdown */}
                {settlement && (
                    <section className="animate-in slide-in-from-bottom-8 fade-in h-fill-mode-both duration-700 delay-200">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <span className="text-sm font-bold text-secondaryText uppercase tracking-wider">Line Item Breakdown</span>
                            <span className="text-xs font-mono text-secondaryText bg-surface px-2 py-1 rounded">
                                {match?.id?.slice(-6).toUpperCase() ?? '—'}
                            </span>
                        </div>

                        <Card className="divide-y divide-borderColor/50 font-sans border-borderColor">
                            {settlement.items.map((item, i) => (
                                <div
                                    key={i}
                                    className={`p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors ${item.isPress ? 'bg-bloodRed/5 border-l-2 border-l-bloodRed' : ''}`}
                                >
                                    <div>
                                        <span className={`font-bold block ${item.isPress ? 'text-bloodRed' : 'text-white'}`}>{item.label}</span>
                                        <span className="text-xs text-secondaryText">{item.sublabel}</span>
                                    </div>
                                    <span className={`font-bold text-lg ${item.amount > 0 ? 'text-neonGreen' : item.amount < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                        {item.amount > 0 ? '+' : ''}${item.amount}
                                    </span>
                                </div>
                            ))}

                            {/* Total */}
                            <div className="p-5 flex items-center justify-between bg-surface border-t-2 border-t-borderColor">
                                <span className="font-bold tracking-wider uppercase text-white">Total Settlement</span>
                                <span className={`font-black text-2xl ${isWinner ? 'text-neonGreen' : total < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                    {total > 0 ? '+' : ''}${total}
                                </span>
                            </div>
                        </Card>
                    </section>
                )}
            </main>

            {/* Stationary Footer */}
            <footer className="p-4 bg-background border-t border-borderColor shrink-0 pb-safe">
                <Button size="lg" className="w-full font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,63,0.4)]" onClick={() => navigate('/dashboard')}>
                    Finish & Return to Dashboard
                </Button>
            </footer>
        </div>
    );
}
