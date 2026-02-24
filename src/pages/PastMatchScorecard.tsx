import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, Receipt, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMatchStore } from '../store/useMatchStore';
import { Button } from '../components/ui/Button';

interface CourseHole {
    number: number;
    par: number;
    yardage: number;
    strokeIndex: number;
}

interface MatchPlayer {
    id: string;
    fullName: string;
    handicap: number;
    team: 'A' | 'B';
    scores: Record<number, { gross: number; net: number; dots: string[] }>;
}

interface PressData {
    startHole: number;
    pressedByTeam: 'A' | 'B';
}

interface SettlementLineItem {
    label: string;
    sublabel: string;
    amount: number;
    isPress?: boolean;
}

interface MatchScorecardData {
    createdAt: string;
    courseName: string;
    format: string;
    wagerAmount: number;
    wagerType: string;
    sideBets: {
        greenies?: boolean;
        sandies?: boolean;
        snake?: boolean;
        birdiesDouble?: boolean;
        trashValue?: number;
    };
    holes: CourseHole[];
    players: MatchPlayer[];
    presses: PressData[];
    myTeam: 'A' | 'B' | null;
}

export default function PastMatchScorecardPage() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { deleteMatch } = useMatchStore();
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [data, setData] = useState<MatchScorecardData | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    async function handleDelete() {
        if (!matchId) return;
        await deleteMatch(matchId);
        navigate('/dashboard');
    }

    useEffect(() => {
        async function fetchScorecard() {
            if (!matchId) return;
            setLoading(true);
            try {
                // Fetch match and course details
                const { data: matchData, error: matchErr } = await supabase
                    .from('matches')
                    .select('created_at, format, wager_amount, wager_type, side_bets, courses!inner(name, holes)')
                    .eq('id', matchId)
                    .single();

                if (matchErr) { setErrorMsg(`Match fetch err: ${matchErr.message}`); return; }
                if (!matchData) { setErrorMsg('No matchData returned'); return; }

                const m = matchData as Record<string, unknown>;
                const course = m.courses as Record<string, unknown>;
                const sideBets = (m.side_bets ?? {}) as MatchScorecardData['sideBets'];

                // Fetch players with team
                const { data: mps, error: mpsErr } = await supabase
                    .from('match_players')
                    .select('user_id, initial_handicap, guest_name, team')
                    .eq('match_id', matchId);

                if (mpsErr) console.error('MPS err', mpsErr);

                // Find non-guest user IDs
                const authUserIds = (mps || [])
                    .filter((mp: Record<string, unknown>) => !mp.guest_name && typeof mp.user_id === 'string')
                    .map((mp: Record<string, unknown>) => String(mp.user_id).toLowerCase());

                let fetchedProfiles: Record<string, unknown>[] = [];
                if (authUserIds.length > 0) {
                    const { data: profs } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', authUserIds);
                    if (profs) fetchedProfiles = profs;
                }

                // Fetch scores
                const { data: scores, error: scoresErr } = await supabase
                    .from('hole_scores')
                    .select('*')
                    .eq('match_id', matchId);

                if (scoresErr) console.error('Scores err', scoresErr);

                // Fetch presses
                const { data: pressesData } = await supabase
                    .from('presses')
                    .select('start_hole, pressed_by_team')
                    .eq('match_id', matchId);

                const presses: PressData[] = (pressesData ?? []).map((p: Record<string, unknown>) => ({
                    startHole: p.start_hole as number,
                    pressedByTeam: p.pressed_by_team as 'A' | 'B',
                }));

                const playersMap = new Map<string, MatchPlayer>();
                if (mps) {
                    mps.forEach((mp: Record<string, unknown>) => {
                        const isGuest = !!mp.guest_name;
                        const pId = String(mp.user_id || '').toLowerCase();
                        if (!pId) return;

                        let assignedName = isGuest ? (mp.guest_name as string) : 'Unknown';
                        if (!isGuest) {
                            const found = fetchedProfiles.find((p) => String(p.id).toLowerCase() === pId);
                            if (found && found.full_name) assignedName = found.full_name as string;
                        }

                        playersMap.set(pId, {
                            id: pId,
                            fullName: assignedName,
                            handicap: (mp.initial_handicap as number) || 0,
                            team: mp.team as 'A' | 'B',
                            scores: {}
                        });
                    });
                }

                if (scores) {
                    scores.forEach((s: Record<string, unknown>) => {
                        const pid = String(s.player_id || '').toLowerCase();
                        const hnum = s.hole_number as number;
                        if (playersMap.has(pid)) {
                            const pData = playersMap.get(pid)!;
                            pData.scores[hnum] = {
                                gross: (s.gross as number) || 0,
                                net: (s.net as number) || 0,
                                dots: (s.trash_dots as string[]) || []
                            };
                        }
                    });
                }

                // Determine current user's team
                const myTeam = user
                    ? (playersMap.get(user.id.toLowerCase())?.team ?? null)
                    : null;

                setData({
                    createdAt: m.created_at as string,
                    courseName: (course?.name as string) || 'Unknown Course',
                    format: m.format as string,
                    wagerAmount: (m.wager_amount as number) || 0,
                    wagerType: m.wager_type as string,
                    sideBets,
                    holes: (course?.holes as CourseHole[]) || [],
                    players: Array.from(playersMap.values()),
                    presses,
                    myTeam,
                });
            } catch (err: unknown) {
                const e = err as Error;
                console.error(e);
                setErrorMsg(`Exception: ${e.message}`);
            } finally {
                setLoading(false);
            }
        }
        fetchScorecard();
    }, [matchId, user]);

    if (loading) {
        return <div className="p-8 text-center text-secondaryText min-h-screen flex items-center justify-center">Loading scorecard...</div>;
    }
    if (errorMsg) {
        return (
            <div className="p-8 text-center text-bloodRed min-h-screen flex flex-col items-center justify-center gap-4">
                <p>Error loading match:</p>
                <code className="text-xs">{errorMsg}</code>
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 border border-borderColor text-white rounded-xl">Go Back</button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="p-8 text-center text-secondaryText min-h-screen flex flex-col items-center justify-center gap-4">
                <p>Match not found.</p>
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 border border-borderColor rounded-xl">Go Back</button>
            </div>
        );
    }

    const { holes, players, presses, myTeam, sideBets, wagerAmount, format } = data;
    const sortedHoles = [...holes].sort((a, b) => a.number - b.number);
    while (sortedHoles.length < 18) {
        sortedHoles.push({ number: sortedHoles.length + 1, par: 4, yardage: 0, strokeIndex: 0 });
    }

    const frontNine = sortedHoles.slice(0, 9);
    const backNine = sortedHoles.slice(9, 18);
    const outPar = frontNine.reduce((s, h) => s + h.par, 0);
    const inPar = backNine.reduce((s, h) => s + h.par, 0);
    const totPar = outPar + inPar;

    const headers = [
        ...frontNine.map(h => ({ type: 'hole', val: h.number })),
        { type: 'divider', val: 'OUT' },
        ...backNine.map(h => ({ type: 'hole', val: h.number })),
        { type: 'divider', val: 'IN' },
        { type: 'header', val: 'HCP' },
        { type: 'header', val: 'GROSS' }
    ];

    const outIndices = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const inIndices = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18]);

    function getPlayerScore(player: MatchPlayer, type: 'gross' | 'net', holeNum: number) {
        return player.scores[holeNum]?.[type] || 0;
    }

    function getPlayerBlockSum(player: MatchPlayer, type: 'gross' | 'net', holeset: Set<number>) {
        let sum = 0;
        holeset.forEach(h => sum += getPlayerScore(player, type, h));
        return sum;
    }

    function renderRowTracker({
        rowKey, title, titleColor = 'text-white', cellRenderer,
        dividerClass = 'bg-background/80 font-bold',
        totClass = 'bg-bloodRed text-white font-black',
        frontNineSum, backNineSum, extHCP, extGROSS,
        height = 'h-11',
        stickyWidth = 'min-w-[70px] max-w-[70px]'
    }: {
        rowKey?: string | number;
        title: string;
        titleColor?: string;
        cellRenderer: (holeNum: number) => React.ReactNode;
        dividerClass?: string;
        totClass?: string;
        frontNineSum: React.ReactNode;
        backNineSum: React.ReactNode;
        extHCP?: React.ReactNode;
        extGROSS?: React.ReactNode;
        height?: string;
        stickyWidth?: string;
    }) {
        return (
            <div key={rowKey} className={`flex flex-row border-b border-borderColor last:border-b-0 ${height}`}>
                <div className={`sticky left-0 z-20 bg-background border-r border-borderColor ${stickyWidth} h-full flex items-center justify-start px-3 font-bold uppercase tracking-tighter text-[10px] ${titleColor} truncate shadow-[2px_0_5px_rgba(0,0,0,0.5)]`}>
                    {title}
                </div>
                {headers.map((h, i) => {
                    const baseClass = `${height} border-r border-borderColor flex items-center justify-center flex-shrink-0`;
                    if (h.type === 'divider') {
                        if (h.val === 'OUT') return <div key={i} className={`${baseClass} min-w-[44px] ${dividerClass}`}>{frontNineSum}</div>;
                        if (h.val === 'IN') return <div key={i} className={`${baseClass} min-w-[44px] ${dividerClass}`}>{backNineSum}</div>;
                    } else if (h.type === 'header') {
                        if (h.val === 'HCP') return <div key={i} className={`${baseClass} min-w-[44px] bg-black/40 text-secondaryText font-bold text-[11px]`}>{extHCP}</div>;
                        if (h.val === 'GROSS') return <div key={i} className={`${baseClass} min-w-[44px] ${totClass} text-sm`}>{extGROSS}</div>;
                    }
                    return (
                        <div key={i} className={`${baseClass} min-w-[40px] text-xs font-semibold`}>
                            {cellRenderer(h.val as number)}
                        </div>
                    );
                })}
            </div>
        );
    }

    // ── Settlement Calculation ────────────────────────────────────────────────
    let settlementItems: SettlementLineItem[] | null = null;
    let settlementTotal = 0;
    let oppName = 'Opponent';

    if (myTeam && data.wagerType === 'NASSAU') {
        const oppTeam: 'A' | 'B' = myTeam === 'A' ? 'B' : 'A';
        const myTeamPlayers = players.filter(p => p.team === myTeam);
        const oppTeamPlayers = players.filter(p => p.team === oppTeam);

        // Build opponent display name
        const oppFirst = oppTeamPlayers[0]?.fullName?.split(' ')[0];
        const oppSecond = oppTeamPlayers[1]?.fullName?.split(' ')[0];
        oppName = oppSecond ? `${oppFirst} & ${oppSecond}` : (oppFirst ?? 'Opponent');

        function teamNetScoresOnHole(teamPlayers: MatchPlayer[], hole: number): { net: number }[] {
            return teamPlayers
                .map(p => {
                    const s = p.scores[hole];
                    return s ? { net: s.net } : undefined;
                })
                .filter((s): s is { net: number } => s !== undefined);
        }

        const holesPlayed: number[] = [];
        for (let h = 1; h <= 18; h++) {
            if (teamNetScoresOnHole(myTeamPlayers, h).length > 0 && teamNetScoresOnHole(oppTeamPlayers, h).length > 0) {
                holesPlayed.push(h);
            }
        }

        function holePoints(hole: number): { my: number; opp: number } {
            const myScores = teamNetScoresOnHole(myTeamPlayers, hole);
            const oppScores = teamNetScoresOnHole(oppTeamPlayers, hole);
            if (!myScores.length || !oppScores.length) return { my: 0, opp: 0 };

            const par = sortedHoles.find(h => h.number === hole)?.par ?? 4;
            const birdiesDouble = sideBets.birdiesDouble ?? false;
            const myNets = myScores.map(s => s.net);
            const oppNets = oppScores.map(s => s.net);
            const myHasBirdie = myNets.some(n => n < par);
            const oppHasBirdie = oppNets.some(n => n < par);

            if (format === '2v2') {
                let my = 0, opp = 0;
                const myLow = Math.min(...myNets), oppLow = Math.min(...oppNets);
                if (myLow < oppLow) my += (birdiesDouble && myHasBirdie) ? 2 : 1;
                else if (oppLow < myLow) opp += (birdiesDouble && oppHasBirdie) ? 2 : 1;
                const mySum = myNets.reduce((a, b) => a + b, 0);
                const oppSum = oppNets.reduce((a, b) => a + b, 0);
                if (mySum < oppSum) my += (birdiesDouble && myHasBirdie) ? 2 : 1;
                else if (oppSum < mySum) opp += (birdiesDouble && oppHasBirdie) ? 2 : 1;
                return { my, opp };
            }
            if (myNets[0] < oppNets[0]) return { my: (birdiesDouble && myHasBirdie) ? 2 : 1, opp: 0 };
            if (oppNets[0] < myNets[0]) return { my: 0, opp: (birdiesDouble && oppHasBirdie) ? 2 : 1 };
            return { my: 0, opp: 0 };
        }

        function nassauResult(holeSet: number[]): number {
            let myPts = 0, oppPts = 0;
            for (const h of holeSet) {
                const { my, opp } = holePoints(h);
                myPts += my; oppPts += opp;
            }
            if (myPts > oppPts) return wagerAmount;
            if (oppPts > myPts) return -wagerAmount;
            return 0;
        }

        const front9Holes = holesPlayed.filter(h => h <= 9);
        const back9Holes = holesPlayed.filter(h => h > 9);
        const front9Amount = front9Holes.length >= 9 ? nassauResult(front9Holes) : null;
        const back9Amount = back9Holes.length >= 9 ? nassauResult(back9Holes) : null;
        const overallAmount = holesPlayed.length >= 18 ? nassauResult(holesPlayed) : null;

        const items: SettlementLineItem[] = [];

        if (front9Amount !== null) items.push({
            label: 'Front 9',
            sublabel: front9Amount > 0 ? 'Won' : front9Amount < 0 ? 'Lost' : 'Pushed',
            amount: front9Amount,
        });
        if (back9Amount !== null) items.push({
            label: 'Back 9',
            sublabel: back9Amount > 0 ? 'Won' : back9Amount < 0 ? 'Lost' : 'Pushed',
            amount: back9Amount,
        });
        if (overallAmount !== null) items.push({
            label: 'Overall (18)',
            sublabel: overallAmount > 0 ? 'Won' : overallAmount < 0 ? 'Lost' : 'Pushed',
            amount: overallAmount,
        });

        for (const press of presses) {
            const pressHoles = holesPlayed.filter(h => h >= press.startHole);
            if (pressHoles.length > 0) {
                const pressAmount = nassauResult(pressHoles);
                items.push({
                    label: `Press (Hole ${press.startHole})`,
                    sublabel: pressAmount > 0 ? 'Won' : pressAmount < 0 ? 'Lost' : 'Pushed',
                    amount: pressAmount,
                    isPress: true,
                });
            }
        }

        // Trash / side bets
        const trashVal = sideBets.trashValue ?? 5;

        function trashItem(dot: string, label: string) {
            const myDots = players.filter(p => p.team === myTeam).reduce((acc, p) =>
                acc + Object.values(p.scores).filter(s => s.dots.includes(dot)).length, 0);
            const oppDots = players.filter(p => p.team === oppTeam).reduce((acc, p) =>
                acc + Object.values(p.scores).filter(s => s.dots.includes(dot)).length, 0);
            if (myDots === 0 && oppDots === 0) return;
            if (dot === 'snake') {
                items.push({
                    label,
                    sublabel: myDots > oppDots ? 'You held the snake 🐍' : 'Opponent held the snake 🐍',
                    amount: (oppDots - myDots) * trashVal,
                });
            } else {
                items.push({
                    label,
                    sublabel: `${myDots} won · ${oppDots} lost`,
                    amount: (myDots - oppDots) * trashVal,
                });
            }
        }

        if (sideBets.greenies) trashItem('greenie', 'Greenies');
        if (sideBets.sandies) trashItem('sandie', 'Sandies');
        if (sideBets.snake) trashItem('snake', 'Snake');

        settlementItems = items;
        settlementTotal = items.reduce((sum, i) => sum + i.amount, 0);
    }

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-y-auto overflow-x-hidden momentum-scroll pb-20 safe-bottom">
            <header className="flex flex-col border-b border-borderColor bg-surface/90 backdrop-blur sticky top-0 z-30 flex-shrink-0">
                <div className="flex items-center p-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 ml-2 min-w-0">
                        <h2 className="text-xl font-black text-white tracking-tighter truncate">{data.courseName}</h2>
                        <span className="text-xs font-bold text-bloodRed uppercase tracking-widest">{data.format}</span>
                    </div>
                </div>
                <div className="px-4 pb-3 flex items-center justify-between text-[11px] font-bold text-secondaryText uppercase tracking-wider">
                    <span>{new Date(data.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span>${data.wagerAmount} {data.wagerType === 'NASSAU' ? 'Nassau' : 'Per Hole'}</span>
                </div>
            </header>

            <div className="flex-1 w-full flex flex-col pt-4">
                <div className="px-4 mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-secondaryText">
                    <div className="flex items-center gap-2">
                        <Flag className="w-4 h-4 text-bloodRed" />
                        <span>Scorecard Overview</span>
                    </div>
                </div>

                {/* Scorecard Scrollable Container */}
                <div className="w-full overflow-x-auto no-scrollbar pb-8 relative">
                    <div className="px-4 inline-flex flex-col min-w-max gap-6">
                        {/* Table 1: Hole & Par Information */}
                        <div className="flex flex-col border border-borderColor shadow-lg overflow-hidden rounded-xl bg-surface/20">
                            {/* Header Row (Hole) */}
                            <div className="flex flex-row bg-surface border-b border-borderColor">
                                <div className="sticky left-0 z-20 bg-surface border-r border-borderColor min-w-[80px] max-w-[80px] h-10 flex items-center justify-start px-3 font-black uppercase tracking-widest text-[10px] text-secondaryText shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                                    HOLE
                                </div>
                                {headers.map((h, i) => {
                                    const baseClass = "h-10 border-r border-borderColor last:border-r-0 flex items-center justify-center font-black text-[10px] flex-shrink-0";
                                    if (h.type === 'hole') return <div key={i} className={`${baseClass} min-w-[40px] text-white/90`}>{h.val}</div>;
                                    if (h.type === 'divider') return <div key={i} className={`${baseClass} min-w-[44px] bg-bloodRed/20 text-bloodRed tracking-widest`}>{h.val}</div>;
                                    if (h.val === 'GROSS') return <div key={i} className={`${baseClass} min-w-[44px] bg-bloodRed text-white tracking-widest uppercase`}>{h.val}</div>;
                                    return <div key={i} className={`${baseClass} min-w-[44px] bg-black/40 text-secondaryText`}>{h.val}</div>;
                                })}
                            </div>

                            {/* Par Row */}
                            {renderRowTracker({
                                title: 'PAR',
                                titleColor: 'text-secondaryText/80',
                                frontNineSum: outPar,
                                backNineSum: inPar,
                                extHCP: '-',
                                extGROSS: totPar,
                                cellRenderer: (hNum) => sortedHoles.find(h => h.number === hNum)?.par || 4,
                                dividerClass: 'bg-black/20 text-secondaryText font-bold',
                                totClass: 'bg-bloodRed/10 text-bloodRed font-black',
                                height: 'h-10',
                                stickyWidth: 'min-w-[80px] max-w-[80px]'
                            })}
                        </div>

                        {/* Table 2: Player Information */}
                        <div className="flex flex-col border border-borderColor shadow-2xl overflow-hidden rounded-xl bg-surface/10">
                            {players.map((p) => {
                                const outGross = getPlayerBlockSum(p, 'gross', outIndices);
                                const inGross = getPlayerBlockSum(p, 'gross', inIndices);
                                const totGross = outGross + inGross;
                                return renderRowTracker({
                                    rowKey: p.id,
                                    title: p.fullName.split(' ')[0],
                                    titleColor: 'text-white',
                                    frontNineSum: outGross || '—',
                                    backNineSum: inGross || '—',
                                    extHCP: p.handicap,
                                    extGROSS: totGross || '—',
                                    height: 'h-12',
                                    stickyWidth: 'min-w-[80px] max-w-[80px]',
                                    cellRenderer: (hNum) => {
                                        const raw = getPlayerScore(p, 'gross', hNum);
                                        if (!raw) return <span className="text-borderColor/30">—</span>;
                                        const par = sortedHoles.find(h => h.number === hNum)?.par || 4;
                                        if (raw < par) return <div className="border border-neonGreen w-7 h-7 flex items-center justify-center rounded-full text-neonGreen font-bold bg-neonGreen/10">{raw}</div>;
                                        if (raw === par + 1) return <div className="border border-bloodRed w-7 h-7 flex items-center justify-center text-bloodRed font-bold bg-bloodRed/10">{raw}</div>;
                                        if (raw >= par + 2) return <div className="border border-bloodRed ring-1 ring-bloodRed ring-offset-1 ring-offset-[#1C1C1E] w-7 h-7 flex items-center justify-center text-bloodRed font-bold bg-bloodRed/10">{raw}</div>;
                                        return <span className="font-black text-white">{raw}</span>;
                                    }
                                });
                            })}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="px-4 mt-2">
                    <div className="bg-surface rounded-xl border border-borderColor p-4 flex gap-4 text-[10px] text-secondaryText uppercase font-bold tracking-widest">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border border-bloodRed flex items-center justify-center text-bloodRed leading-none pt-0.5">3</div>
                            <span>Under Par</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border border-secondaryText bg-surface/50 flex items-center justify-center text-secondaryText leading-none pt-0.5">5</div>
                            <span>Over Par</span>
                        </div>
                    </div>
                </div>

                {/* Settlement Card */}
                {settlementItems && settlementItems.length > 0 && (
                    <div className="px-4 mt-4 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Receipt className="w-4 h-4 text-secondaryText" />
                            <span className="text-xs font-bold uppercase tracking-widest text-secondaryText">
                                Match Settlement · vs {oppName}
                            </span>
                        </div>
                        <div className="bg-surface rounded-xl border border-borderColor overflow-hidden">
                            {settlementItems.map((item, i) => (
                                <div
                                    key={i}
                                    className={`px-4 py-3 flex items-center justify-between border-b border-borderColor/50 last:border-b-0 ${item.isPress ? 'bg-bloodRed/5 border-l-2 border-l-bloodRed' : ''}`}
                                >
                                    <div>
                                        <span className={`font-bold text-sm block ${item.isPress ? 'text-bloodRed' : 'text-white'}`}>{item.label}</span>
                                        <span className="text-xs text-secondaryText">{item.sublabel}</span>
                                    </div>
                                    <span className={`font-bold text-base ${item.amount > 0 ? 'text-neonGreen' : item.amount < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                        {item.amount > 0 ? '+' : ''}${item.amount}
                                    </span>
                                </div>
                            ))}

                            {/* Total row */}
                            <div className="px-4 py-4 flex items-center justify-between bg-background/60 border-t-2 border-t-borderColor">
                                <span className="font-black uppercase tracking-wider text-sm text-white">Total</span>
                                <span className={`font-black text-2xl ${settlementTotal > 0 ? 'text-neonGreen drop-shadow-[0_0_12px_rgba(0,255,102,0.4)]' : settlementTotal < 0 ? 'text-bloodRed drop-shadow-[0_0_12px_rgba(255,0,63,0.4)]' : 'text-secondaryText'}`}>
                                    {settlementTotal > 0 ? '+' : ''}${settlementTotal}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* No settlement message for non-Nassau or guest viewers */}
                {!myTeam && data.wagerType === 'NASSAU' && (
                    <div className="px-4 mt-4 mb-4">
                        <div className="bg-surface rounded-xl border border-borderColor p-4 text-center text-secondaryText text-sm">
                            Sign in to see your settlement breakdown.
                        </div>
                    </div>
                )}

                {/* Delete Match */}
                <div className="px-4 pt-2 pb-6">
                    <Button
                        size="lg"
                        className="w-full bg-bloodRed hover:bg-bloodRed/80 border-bloodRed"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Match
                    </Button>
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
                    <div className="bg-surface border border-borderColor rounded-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-xl font-black text-center">Delete Match?</h3>
                        <p className="text-sm text-secondaryText text-center">
                            This will permanently delete all scores, presses, and betting data for this match.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" size="lg" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </Button>
                            <Button size="lg" className="flex-1 bg-bloodRed hover:bg-bloodRed/80 border-bloodRed" onClick={handleDelete}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
