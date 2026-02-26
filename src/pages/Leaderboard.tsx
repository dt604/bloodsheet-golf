import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share, Activity, Users } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useMatchStore } from '../store/useMatchStore';
import { supabase } from '../lib/supabase';

function calcNet(gross: number, adjustedHandicap: number, strokeIndex: number): number {
    if (adjustedHandicap <= 0) return gross;
    const fullStrokes = Math.floor(adjustedHandicap / 18);
    const extra = (adjustedHandicap % 18) >= strokeIndex ? 1 : 0;
    return gross - fullStrokes - extra;
}

// Returns holes up from Team A's perspective (positive = A leads)
function calcMatchPlay(
    teamAIds: string[],
    teamBIds: string[],
    scores: { holeNumber: number; playerId: string; gross?: number; net: number; adjustedNet?: number; trashDots?: string[] }[],
    format: '1v1' | '2v2',
    course: any = null,
    birdiesDouble?: boolean,
    sideBets?: { greenies?: boolean },
    teamHandicapDiff?: { diff: number; spottedTeam: 'A' | 'B' | null }
): { holesUp: number; holesPlayed: number } {
    const holeNumbers = [...new Set(scores.map((s) => s.holeNumber))].sort((a, b) => a - b);

    let teamAWins = 0;
    let teamBWins = 0;
    let holesPlayed = 0;

    for (const hole of holeNumbers) {
        const par = course?.holes?.find((h: any) => h.number === hole)?.par ?? 4;
        const aScores = scores.filter((s) => teamAIds.includes(s.playerId) && s.holeNumber === hole);
        const bScores = scores.filter((s) => teamBIds.includes(s.playerId) && s.holeNumber === hole);

        if (aScores.length === 0 || bScores.length === 0) continue;

        const aNets = aScores.map((s) => s.adjustedNet ?? s.net);
        const bNets = bScores.map((s) => s.adjustedNet ?? s.net);

        if (format === '2v2') {
            // Apply team handicap stroke to spotted team's low scorer
            const aNetsAdj = [...aNets];
            const bNetsAdj = [...bNets];
            if (teamHandicapDiff && teamHandicapDiff.spottedTeam) {
                const holeStrokeIdx = course?.holes?.find((h: any) => h.number === hole)?.strokeIndex ?? 18;
                if (holeStrokeIdx <= teamHandicapDiff.diff) {
                    if (teamHandicapDiff.spottedTeam === 'A') {
                        const minIdx = aNetsAdj[0] <= (aNetsAdj[1] ?? Infinity) ? 0 : 1;
                        aNetsAdj[minIdx] -= 1;
                    } else {
                        const minIdx = bNetsAdj[0] <= (bNetsAdj[1] ?? Infinity) ? 0 : 1;
                        bNetsAdj[minIdx] -= 1;
                    }
                }
            }

            const aLow = Math.min(...aNetsAdj), bLow = Math.min(...bNetsAdj);
            if (aLow < bLow) teamAWins += 1;
            else if (bLow < aLow) teamBWins += 1;

            const aSum = aNetsAdj.reduce((s, n) => s + n, 0);
            const bSum = bNetsAdj.reduce((s, n) => s + n, 0);
            if (aSum < bSum) teamAWins += 1;
            else if (bSum < aSum) teamBWins += 1;

            // Birdie bonus: +1 per player with a real gross birdie
            if (birdiesDouble) {
                teamAWins += aScores.filter(s => s.gross !== undefined && s.gross < par).length;
                teamBWins += bScores.filter(s => s.gross !== undefined && s.gross < par).length;
            }

            // Greenie bonus: +1 per team with a greenie on par 3 holes
            if (sideBets?.greenies && par === 3) {
                if (aScores.some(s => s.trashDots?.includes('greenie'))) teamAWins += 1;
                if (bScores.some(s => s.trashDots?.includes('greenie'))) teamBWins += 1;
            }
        } else {
            const aHasBirdie = aScores.some(s => s.net < par);
            const bHasBirdie = bScores.some(s => s.net < par);
            if (aNets[0] < bNets[0]) teamAWins += (birdiesDouble && aHasBirdie) ? 2 : 1;
            else if (bNets[0] < aNets[0]) teamBWins += (birdiesDouble && bHasBirdie) ? 2 : 1;
        }
        holesPlayed++;
    }

    return { holesUp: teamAWins - teamBWins, holesPlayed };
}

function matchLabel(holesUp: number): string {
    if (holesUp === 0) return 'AS';
    return `${Math.abs(holesUp)} ${holesUp > 0 ? 'UP' : 'DN'}`;
}

// ─── Component ────────────────────────────────────────────────

interface PlayerRow {
    userId: string;
    fullName: string;
    handicap: number;
    team: 'A' | 'B';
    holesPlayed: number;
    scoreToPar: number;
    avatarUrl?: string;
    isGuest: boolean;
}

interface ActivityEvent {
    id: string;
    message: React.ReactNode;
    color: string;
}

export default function LeaderboardPage() {
    const navigate = useNavigate();
    const { matchId, match, course, players, scores, presses, loadMatch, refreshScores } = useMatchStore();

    const [playerRows, setPlayerRows] = useState<PlayerRow[]>([]);

    // Full load if match not in store yet; otherwise sync scores from DB on mount
    useEffect(() => {
        if (!matchId) return;
        if (!match) {
            loadMatch(matchId);
        } else {
            refreshScores(matchId);
        }
    }, [matchId]);

    // Polling fallback — refreshes every 5s in case Realtime events are missed
    useEffect(() => {
        if (!matchId) return;
        const interval = setInterval(() => refreshScores(matchId), 5000);
        return () => clearInterval(interval);
    }, [matchId]);

    useEffect(() => {
        if (players.length === 0) return;

        async function buildRows() {
            const ids = players.map((p) => p.userId);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, handicap, avatar_url')
                .in('id', ids);

            const profileMap: Record<string, { fullName: string; handicap: number; avatarUrl?: string }> = {};
            for (const row of (profiles ?? []) as { id: string; full_name: string; handicap: number; avatar_url: string | null }[]) {
                profileMap[row.id] = { fullName: row.full_name, handicap: row.handicap, avatarUrl: row.avatar_url ?? undefined };
            }

            const rows: PlayerRow[] = players.map((p) => {
                const playerScores = scores.filter((s) => s.playerId === p.userId);
                const scoreToPar = playerScores.reduce((sum, s) => {
                    const holePar = course?.holes.find((h) => h.number === s.holeNumber)?.par ?? 4;
                    return sum + (s.gross - holePar);
                }, 0);

                return {
                    userId: p.userId,
                    fullName: p.guestName ?? profileMap[p.userId]?.fullName ?? 'Player',
                    handicap: profileMap[p.userId]?.handicap ?? p.initialHandicap,
                    team: p.team,
                    holesPlayed: playerScores.length,
                    scoreToPar,
                    avatarUrl: profileMap[p.userId]?.avatarUrl ?? p.avatarUrl,
                    isGuest: !!p.guestName,
                };
            });

            // Team A first, then Team B
            rows.sort((a, b) => a.team.localeCompare(b.team));
            setPlayerRows(rows);
        }

        buildRows();
    }, [players, scores]);

    const teamAIds = players.filter((p) => p.team === 'A').map((p) => p.userId);
    const teamBIds = players.filter((p) => p.team === 'B').map((p) => p.userId);
    const format = match?.format ?? '1v1';

    // Calculate lowest handicap to adjust relative net scores for match display
    const allHcps = playerRows.map(p => p.handicap);
    const lowestHcp = Math.min(0, ...allHcps); // Find lowest, floor at 0

    const scoresWithAdjusted = scores.map(s => {
        const p = playerRows.find(x => x.userId === s.playerId);
        const baseHcp = p ? p.handicap : 0;
        // 2v2: no individual handicap (team differential only); 1v1: differential (play off lowest)
        const adjustedHcp = format === '2v2' ? 0 : Math.max(0, baseHcp - Math.max(0, lowestHcp));
        const holeStrokeIdx = course?.holes.find(h => h.number === s.holeNumber)?.strokeIndex ?? 18;
        return {
            ...s,
            adjustedNet: calcNet(s.gross, adjustedHcp, holeStrokeIdx)
        };
    });

    // Team handicap differential for 2v2 spotted strokes
    let teamHandicapDiff: { diff: number; spottedTeam: 'A' | 'B' | null } | undefined;
    if (format === '2v2') {
        const teamAHcp = playerRows.filter(p => p.team === 'A').reduce((sum, p) => sum + p.handicap, 0);
        const teamBHcp = playerRows.filter(p => p.team === 'B').reduce((sum, p) => sum + p.handicap, 0);
        const diff = Math.abs(teamAHcp - teamBHcp);
        const spottedTeam = teamAHcp > teamBHcp ? 'A' : teamBHcp > teamAHcp ? 'B' : null;
        teamHandicapDiff = { diff, spottedTeam };
    }

    const { holesUp, holesPlayed } = calcMatchPlay(teamAIds, teamBIds, scoresWithAdjusted, format, course, match?.sideBets?.birdiesDouble, match?.sideBets, teamHandicapDiff);

    console.log('[Leaderboard]', {
        matchId,
        matchLoaded: !!match,
        players: players.map(p => ({ id: p.userId.slice(-4), team: p.team })),
        scores: scores.map(s => ({ hole: s.holeNumber, player: s.playerId.slice(-4), gross: s.gross, net: s.net })),
        teamAIds: teamAIds.map(id => id.slice(-4)),
        teamBIds: teamBIds.map(id => id.slice(-4)),
        holesUp,
        holesPlayed,
    });

    // Hero label: from Team A's perspective
    const hasOpponent = teamAIds.length > 0 && teamBIds.length > 0;
    const heroLabel = matchLabel(holesUp);
    const heroLeader = holesUp > 0 ? 'A' : holesUp < 0 ? 'B' : null;

    // Activity feed
    const activityEvents: ActivityEvent[] = [];
    for (const press of presses) {
        activityEvents.push({
            id: press.id,
            message: (
                <>
                    <strong className="text-white">Team {press.pressedByTeam}</strong> initiated a{' '}
                    <strong className="text-bloodRed uppercase tracking-wider">Press</strong> on Hole {press.startHole}.
                </>
            ),
            color: 'bg-bloodRed/80',
        });
    }
    for (const score of scores) {
        for (const dot of score.trashDots) {
            const player = playerRows.find((r) => r.userId === score.playerId);
            activityEvents.push({
                id: `${score.matchId}-${score.holeNumber}-${score.playerId}-${dot}`,
                message: (
                    <>
                        <strong className="text-white">{player?.fullName ?? 'A player'}</strong> earned a{' '}
                        <strong className="text-neonGreen capitalize">{dot}</strong> on Hole {score.holeNumber}.
                    </>
                ),
                color: 'bg-neonGreen/80',
            });
        }
    }
    activityEvents.reverse();

    const startingHole = match?.sideBets?.startingHole ?? 1;
    const lastHole = ((startingHole - 2 + 18) % 18) + 1;
    const uniqueHolesScored = new Set(scores.map((s) => s.holeNumber)).size;
    // Next hole to play = startingHole offset by how many holes are already scored (wraps at 18)
    const holeNum = uniqueHolesScored === 0
        ? startingHole
        : uniqueHolesScored >= 18
        ? lastHole
        : ((startingHole - 1 + uniqueHolesScored) % 18) + 1;

    // --- Scorecard Headers & Helpers ---
    const sortedHoles = [...(course?.holes ?? [])].sort((a, b) => a.number - b.number);
    while (sortedHoles.length < 18) {
        sortedHoles.push({ number: sortedHoles.length + 1, par: 4, yardage: 0, strokeIndex: 0 });
    }
    const frontNine = sortedHoles.slice(0, 9);
    const backNine = sortedHoles.slice(9, 18);
    const headers = [
        ...frontNine.map(h => ({ type: 'hole', val: h.number })),
        { type: 'divider', val: 'OUT' },
        ...backNine.map(h => ({ type: 'hole', val: h.number })),
        { type: 'divider', val: 'IN' },
        { type: 'header', val: 'GROSS' }
    ];

    function getPlayerScore(pId: string, hNum: number) {
        return scores.find(s => s.playerId === pId && s.holeNumber === hNum)?.gross || 0;
    }

    function getPlayerSum(pId: string, range: number[]) {
        return range.reduce((sum, h) => sum + getPlayerScore(pId, h), 0);
    }

    function renderScoreCell(pId: string, hNum: number) {
        const val = getPlayerScore(pId, hNum);
        if (val === 0) return <span className="text-secondaryText/30">—</span>;

        const par = sortedHoles.find(h => h.number === hNum)?.par ?? 4;
        if (val <= par - 2) {
            return (
                <div className="w-10 h-10 rounded-full border border-neonOrange flex items-center justify-center text-neonOrange font-bold bg-neonOrange/10">
                    {val}
                </div>
            );
        }
        if (val === par - 1) {
            return (
                <div className="w-10 h-10 rounded-full border border-neonGreen flex items-center justify-center text-neonGreen font-bold bg-neonGreen/10">
                    {val}
                </div>
            );
        }
        if (val === par + 1) {
            return (
                <div className="w-10 h-10 border border-bloodRed flex items-center justify-center text-bloodRed font-bold bg-bloodRed/10">
                    {val}
                </div>
            );
        }
        if (val === par + 2) {
            return (
                <div className="w-10 h-10 border border-bloodRed ring-1 ring-bloodRed ring-offset-1 ring-offset-[#1C1C1E] flex items-center justify-center text-bloodRed font-bold bg-bloodRed/10">
                    {val}
                </div>
            );
        }
        if (val >= par + 3) {
            return (
                <div className="w-10 h-10 border border-neonOrange ring-1 ring-neonOrange ring-offset-1 ring-offset-[#1C1C1E] flex items-center justify-center text-neonOrange font-bold bg-neonOrange/10">
                    {val}
                </div>
            );
        }
        return <span className="font-bold text-white">{val}</span>;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            {/* Header - Stationary */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-background/95 backdrop-blur shrink-0 z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <span className="font-bold text-lg tracking-wide uppercase text-bloodRed drop-shadow-[0_0_10px_rgba(255,0,63,0.5)]">LIVE MATCH</span>
                    <span className="block text-xs font-semibold text-secondaryText mt-0.5 tracking-widest uppercase">
                        {course?.name ?? 'Course'} • Hole {holeNum}
                    </span>
                </div>
                <button className="p-2 -mr-2 text-secondaryText hover:text-white transition-colors">
                    <Share className="w-5 h-5" />
                </button>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-6 pb-20">
                {/* Hero Match Score Card */}
                <section>
                    <div className="text-secondaryText text-xs font-bold uppercase tracking-widest mb-2 pl-1">Match Score</div>
                    {!hasOpponent && (
                        <div className="mb-3 px-1 py-2 rounded-lg bg-surface border border-borderColor/50">
                            <p className="text-xs text-secondaryText text-center">No opponent in this match yet — add one from Match Setup to see head-to-head scoring.</p>
                        </div>
                    )}
                    <Card className="flex items-center justify-between p-5 py-8 border border-borderColor shadow-lg relative overflow-hidden bg-gradient-to-br from-surface to-background">
                        {/* Team A */}
                        <div className={`text-center z-10 transition-opacity ${heroLeader === 'B' ? 'opacity-40' : ''}`}>
                            <span className="text-sm font-bold uppercase tracking-widest text-white">Team A</span>
                            <span className="block text-xs text-secondaryText mt-1">
                                {playerRows.filter((r) => r.team === 'A').map((r) => r.fullName.split(' ')[0]).join(' & ') || '—'}
                            </span>
                        </div>

                        {/* Centre score */}
                        <div className="flex flex-col items-center z-10 scale-125 mx-2">
                            <span className={`text-5xl font-black font-sans tracking-tighter leading-none ${holesUp > 0 ? 'text-neonGreen drop-shadow-[0_0_15px_rgba(0,255,102,0.4)]'
                                : holesUp < 0 ? 'text-bloodRed drop-shadow-[0_0_15px_rgba(255,0,63,0.4)]'
                                    : 'text-secondaryText'
                                }`}>
                                {heroLabel}
                            </span>
                            <span className="text-[10px] text-secondaryText uppercase tracking-widest mt-1">
                                {holesPlayed === 0 ? 'No holes yet' : `Thru ${holesPlayed}`}
                            </span>
                        </div>

                        {/* Team B */}
                        <div className={`text-center z-10 transition-opacity ${heroLeader === 'A' ? 'opacity-40' : ''}`}>
                            <span className="text-sm font-bold uppercase tracking-widest text-white">Team B</span>
                            <span className="block text-xs text-secondaryText mt-1">
                                {playerRows.filter((r) => r.team === 'B').map((r) => r.fullName.split(' ')[0]).join(' & ') || '—'}
                            </span>
                        </div>
                    </Card>
                </section>

                {/* Scorecard Overview */}
                <section>
                    <div className="text-secondaryText text-xs font-bold uppercase tracking-widest mb-2 pl-1">Scorecard Overview</div>
                    <div className="overflow-x-auto scrollbar-hide pb-8">
                        <div className="px-4 inline-flex flex-col min-w-max gap-6">
                            {/* Table 1: Hole & Par Information */}
                            <div className="flex flex-col border border-borderColor shadow-lg overflow-hidden rounded-xl bg-surface/20">
                                {/* Hole Headers */}
                                <div className="flex flex-row bg-surface border-b border-borderColor">
                                    <div className="sticky left-0 z-20 bg-surface border-r border-borderColor min-w-[80px] max-w-[80px] h-12 flex items-center px-3 font-black text-[10px] uppercase tracking-widest text-secondaryText shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                        HOLE
                                    </div>
                                    {headers.map((h, i) => (
                                        <div
                                            key={i}
                                            className={`h-12 border-r border-borderColor last:border-r-0 flex items-center justify-center flex-shrink-0 font-black text-[10px] tracking-tighter ${h.type === 'divider' ? 'min-w-[44px] bg-black/40 text-white' :
                                                h.type === 'header' ? 'min-w-[50px] bg-bloodRed text-white' :
                                                    'min-w-[52px] text-white/90'
                                                }`}
                                        >
                                            {h.val}
                                        </div>
                                    ))}
                                </div>

                                {/* Par Headers */}
                                <div className="flex flex-row bg-surface">
                                    <div className="sticky left-0 z-20 bg-surface border-r border-borderColor min-w-[80px] h-10 flex items-center px-3 font-black text-[10px] uppercase tracking-widest text-secondaryText/60 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                        PAR
                                    </div>
                                    {headers.map((h, i) => {
                                        if (h.type === 'divider') {
                                            const range = h.val === 'OUT' ? frontNine : backNine;
                                            const sum = range.reduce((s, hole) => s + hole.par, 0);
                                            return <div key={i} className="h-10 border-r border-borderColor last:border-r-0 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[44px] bg-black/40 text-secondaryText/60">{sum}</div>;
                                        }
                                        if (h.type === 'header') {
                                            const total = sortedHoles.reduce((s, hole) => s + hole.par, 0);
                                            return <div key={i} className="h-10 border-r border-borderColor last:border-r-0 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[50px] bg-bloodRed/10 text-bloodRed/60">{total}</div>;
                                        }
                                        const holePar = sortedHoles.find(x => x.number === h.val)?.par ?? 4;
                                        return (
                                            <div key={i} className="h-10 border-r border-borderColor last:border-r-0 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[52px] text-secondaryText/60">
                                                {holePar}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Table 2: Player Information */}
                            <div className="flex flex-col border border-borderColor shadow-2xl overflow-hidden rounded-xl bg-surface/10">
                                {playerRows.map((row) => (
                                    <div key={row.userId} className="flex flex-row border-b border-borderColor last:border-b-0 group h-16">
                                        <div className="sticky left-0 z-20 bg-background group-hover:bg-surfaceHover border-r border-borderColor min-w-[80px] max-w-[80px] h-full flex flex-col items-center justify-center gap-0.5 py-1.5 shadow-[2px_0_5px_rgba(0,0,0,0.3)] transition-colors">
                                            <div className="w-7 h-7 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0">
                                                {row.avatarUrl
                                                    ? <img src={row.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                    : row.fullName.slice(0, 1).toUpperCase()
                                                }
                                            </div>
                                            <span className="font-bold text-[9px] text-white truncate uppercase tracking-tighter w-full text-center px-1">
                                                {row.fullName.split(' ')[0]}
                                            </span>
                                        </div>
                                        {headers.map((h, i) => {
                                            const baseClass = "h-full border-r border-borderColor last:border-r-0 flex items-center justify-center flex-shrink-0";
                                            if (h.type === 'divider') {
                                                const range = h.val === 'OUT' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [10, 11, 12, 13, 14, 15, 16, 17, 18];
                                                const sum = getPlayerSum(row.userId, range);
                                                return <div key={i} className={`${baseClass} min-w-[44px] bg-black/20 font-black text-xs text-white`}>{sum || '—'}</div>;
                                            } else if (h.type === 'header') {
                                                const total = getPlayerSum(row.userId, Array.from({ length: 18 }, (_, i) => i + 1));
                                                return <div key={i} className={`${baseClass} min-w-[50px] bg-bloodRed/10 font-black text-sm text-bloodRed`}>{total || '—'}</div>;
                                            }
                                            return (
                                                <div key={i} className={`${baseClass} min-w-[52px] text-xs font-black`}>
                                                    {renderScoreCell(row.userId, h.val as number)}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Player Rows */}
                <section>
                    <div className="text-secondaryText text-xs font-bold uppercase tracking-widest flex items-center justify-between px-1 mb-3">
                        <span>Players</span>
                        <Users className="w-4 h-4" />
                    </div>

                    <div className="space-y-3">
                        {playerRows.map((row) => {
                            // Each player sees the score from their team's perspective
                            const playerHolesUp = row.team === 'A' ? holesUp : -holesUp;
                            const standing = matchLabel(playerHolesUp);
                            const isUp = playerHolesUp > 0;
                            const isDown = playerHolesUp < 0;

                            const toParStr = row.holesPlayed === 0 ? '—' : row.scoreToPar === 0 ? 'E' : row.scoreToPar > 0 ? `+${row.scoreToPar}` : `${row.scoreToPar}`;

                            return (
                                <Card
                                    key={row.userId}
                                    className="p-3 flex items-center justify-between border-borderColor/50 hover:bg-surfaceHover transition-colors"
                                    onClick={() => { if (!row.isGuest) navigate(`/player/${row.userId}`); }}
                                    style={!row.isGuest ? { cursor: 'pointer' } : undefined}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-[38px] h-[38px] rounded-full bg-surfaceHover border flex items-center justify-center font-bold text-white text-sm overflow-hidden shrink-0 ${row.team === 'A' ? 'border-secondaryText' : 'border-bloodRed/60'
                                            }`}>
                                            {row.avatarUrl ? (
                                                <img src={row.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                row.fullName.slice(0, 1).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm block">{row.fullName}</span>
                                            <span className={`text-[10px] uppercase tracking-widest font-bold ${row.team === 'B' ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                Team {row.team} • HCP {row.handicap.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-center font-sans">
                                        <div>
                                            <div className="text-[10px] text-secondaryText font-bold uppercase tracking-wider mb-0.5">Status</div>
                                            <div className={`font-black text-lg leading-none ${isUp ? 'text-neonGreen' : isDown ? 'text-bloodRed' : 'text-secondaryText'
                                                }`}>
                                                {standing}
                                            </div>
                                        </div>
                                        <div className="border-l border-borderColor pl-4">
                                            <div className="text-[10px] text-secondaryText font-bold uppercase tracking-wider mb-0.5">To Par</div>
                                            <div className="font-bold">{toParStr}</div>
                                        </div>
                                        <div className="border-l border-borderColor pl-4">
                                            <div className="text-[10px] text-secondaryText font-bold uppercase tracking-wider mb-0.5">Thru</div>
                                            <div className="font-bold">{row.holesPlayed}</div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                        {playerRows.length === 0 && (
                            <p className="text-secondaryText text-sm px-2">No scores yet.</p>
                        )}
                    </div>
                </section>

                {/* Live Activity Feed */}
                {activityEvents.length > 0 && (
                    <section>
                        <div className="text-secondaryText text-xs font-bold uppercase tracking-widest flex items-center justify-between px-1 mb-3">
                            <span>Live Activity Feed</span>
                            <Activity className="w-4 h-4 text-bloodRed animate-pulse" />
                        </div>
                        <Card className="divide-y divide-borderColor/50">
                            {activityEvents.slice(0, 5).map((ev) => (
                                <div key={ev.id} className="p-3.5 flex items-start gap-3">
                                    <div className={`w-2 h-2 rounded-full ${ev.color} mt-1.5 shrink-0`} />
                                    <p className="text-sm font-medium text-secondaryText leading-relaxed">{ev.message}</p>
                                </div>
                            ))}
                        </Card>
                    </section>
                )}
            </main>

            {/* Bottom action - Stationary */}
            <div className="p-4 bg-background border-t border-borderColor shrink-0 z-10 pb-safe">
                <Button variant="outline" size="lg" className="w-full text-sm font-bold tracking-widest uppercase border-dashed" onClick={() => navigate(`/play/${holeNum}`)}>
                    Back to Scorecard
                </Button>
            </div>
        </div>
    );
}
