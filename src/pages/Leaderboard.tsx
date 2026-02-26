import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share, Activity, Users, LayoutGrid, User, Target, Zap, Droplets } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useMatchStore } from '../store/useMatchStore';
import { supabase } from '../lib/supabase';
import { MatchPlayer, HoleScore } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

function calcNet(gross: number, adjustedHandicap: number, strokeIndex: number): number {
    if (adjustedHandicap <= 0) return gross;
    const fullStrokes = Math.floor(adjustedHandicap / 18);
    const extra = (adjustedHandicap % 18) >= strokeIndex ? 1 : 0;
    return gross - fullStrokes - extra;
}

// Returns breakdown of front 9, back 9, and overall match play standings
function calcMatchPlay(
    teamAIds: string[],
    teamBIds: string[],
    scores: { holeNumber: number; playerId: string; gross?: number; net: number; adjustedNet?: number; trashDots?: string[] }[],
    format: '1v1' | '2v2',
    course: any = null,
    birdiesDouble?: boolean,
    sideBets?: { greenies?: boolean },
    teamHandicapDiff?: { diff: number; spottedTeam: 'A' | 'B' | null }
) {
    const holeNumbers = [...new Set(scores.map((s) => s.holeNumber))].sort((a, b) => a - b);

    const stats = {
        front9: { aWins: 0, bWins: 0, holesPlayed: 0 },
        back9: { aWins: 0, bWins: 0, holesPlayed: 0 },
        overall: { aWins: 0, bWins: 0, holesPlayed: 0 }
    };

    for (const hole of holeNumbers) {
        const isFront = hole <= 9;
        const segment = isFront ? stats.front9 : stats.back9;

        const par = course?.holes?.find((h: any) => h.number === hole)?.par ?? 4;
        const aScores = scores.filter((s) => teamAIds.includes(s.playerId) && s.holeNumber === hole);
        const bScores = scores.filter((s) => teamBIds.includes(s.playerId) && s.holeNumber === hole);

        if (aScores.length === 0 || bScores.length === 0) continue;

        const aNets = aScores.map((s) => s.adjustedNet ?? s.net);
        const bNets = bScores.map((s) => s.adjustedNet ?? s.net);

        let holeAWins = 0;
        let holeBWins = 0;

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
            if (aLow < bLow) holeAWins += 1;
            else if (bLow < aLow) holeBWins += 1;

            const aSum = aNetsAdj.reduce((s, n) => s + n, 0);
            const bSum = bNetsAdj.reduce((s, n) => s + n, 0);
            if (aSum < bSum) holeAWins += 1;
            else if (bSum < aSum) holeBWins += 1;

            // Birdie bonus: +1 per player with a real gross birdie
            if (birdiesDouble) {
                holeAWins += aScores.filter(s => s.gross !== undefined && s.gross < par).length;
                holeBWins += bScores.filter(s => s.gross !== undefined && s.gross < par).length;
            }

            // Greenie bonus: +1 per team with a greenie on par 3 holes
            if (sideBets?.greenies && par === 3) {
                if (aScores.some(s => s.trashDots?.includes('greenie'))) holeAWins += 1;
                if (bScores.some(s => s.trashDots?.includes('greenie'))) holeBWins += 1;
            }
        } else {
            const aHasBirdie = aScores.some(s => s.gross !== undefined && s.gross < par);
            const bHasBirdie = bScores.some(s => s.gross !== undefined && s.gross < par);
            if (aNets[0] < bNets[0]) holeAWins += (birdiesDouble && aHasBirdie) ? 2 : 1;
            else if (bNets[0] < aNets[0]) holeBWins += (birdiesDouble && bHasBirdie) ? 2 : 1;

            if (sideBets?.greenies && par === 3) {
                if (aScores.some(s => s.trashDots?.includes('greenie'))) holeAWins += 1;
                if (bScores.some(s => s.trashDots?.includes('greenie'))) holeBWins += 1;
            }
        }

        segment.aWins += holeAWins;
        segment.bWins += holeBWins;
        segment.holesPlayed++;

        stats.overall.aWins += holeAWins;
        stats.overall.bWins += holeBWins;
        stats.overall.holesPlayed++;
    }

    return {
        overall: { holesUp: stats.overall.aWins - stats.overall.bWins, holesPlayed: stats.overall.holesPlayed },
        front9: { holesUp: stats.front9.aWins - stats.front9.bWins, holesPlayed: stats.front9.holesPlayed },
        back9: { holesUp: stats.back9.aWins - stats.back9.bWins, holesPlayed: stats.back9.holesPlayed }
    };
}

function matchLabel(holesUp: number, holesPlayed: number = 0): string {
    if (holesPlayed === 0) return 'AS';
    const holesRemaining = 18 - holesPlayed;
    const absUp = Math.abs(holesUp);

    // Dormie/Final checks
    if (absUp > holesRemaining) return 'FINAL';
    if (absUp === 0) return 'AS';
    if (absUp === holesRemaining) return 'DORMIE';

    return `${absUp} ${holesUp > 0 ? 'UP' : 'DN'}`;
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
    const {
        matchId: primaryMatchId,
        match: primaryMatch,
        course,
        players: primaryPlayers,
        scores: primaryScores,
        presses: primaryPresses,
        loadMatch,
        refreshScores,
        groupState,
        activeMatchIds,
        refreshGroupScores,
        lastScoreUpdate
    } = useMatchStore();

    const { user } = useAuth();
    const [pingMessage, setPingMessage] = useState<{ message: string; timestamp: number } | null>(null);

    const [focusedMatchIdx, setFocusedMatchIdx] = useState(0);
    const [showAllPlayers, setShowAllPlayers] = useState(false);
    const isGroupMode = activeMatchIds.length > 1;

    // Resolve which data to show for the "Detailed" view (Scorecard/Stats)
    const focusedEntry = isGroupMode && groupState ? groupState.matches[focusedMatchIdx] : null;

    // All unique players if in overview mode
    const allGroupPlayers = useMemo<MatchPlayer[]>(() => {
        if (!isGroupMode || !groupState) return primaryPlayers;
        const seen = new Set<string>();
        const unique: MatchPlayer[] = [];
        for (const entry of groupState.matches) {
            for (const p of entry.players) {
                if (!seen.has(p.userId)) {
                    seen.add(p.userId);
                    unique.push(p);
                }
            }
        }
        return unique;
    }, [isGroupMode, groupState, primaryPlayers]);

    const allGroupScores = useMemo<HoleScore[]>(() => {
        if (!isGroupMode || !groupState) return primaryScores;
        const merged: HoleScore[] = [];
        const seen = new Set<string>();
        for (const entry of groupState.matches) {
            for (const s of entry.scores) {
                const key = `${s.playerId}-${s.holeNumber}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(s);
                }
            }
        }
        return merged;
    }, [isGroupMode, groupState, primaryScores]);

    const currentMatch = focusedEntry ? focusedEntry.match : primaryMatch;
    const currentPlayers = showAllPlayers ? allGroupPlayers : (focusedEntry ? focusedEntry.players : primaryPlayers);
    const currentScores = showAllPlayers ? allGroupScores : (focusedEntry ? focusedEntry.scores : primaryScores);

    const [playerRows, setPlayerRows] = useState<PlayerRow[]>([]);
    const [playerProfiles, setPlayerProfiles] = useState<Record<string, { fullName: string; handicap: number; avatarUrl?: string }>>({});

    // Watch for Real-time Score Updates (Ping)
    useEffect(() => {
        if (!lastScoreUpdate || !user) return;

        // Skip if update was from self
        if (lastScoreUpdate.playerId === user.id) return;

        // Trigger Haptic if supported
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

        // Find the player's name who updated the score
        const pName = playerProfiles[lastScoreUpdate.playerId]?.fullName.split(' ')[0] ?? 'Someone';

        setPingMessage({
            message: `${pName} updated Hole ${lastScoreUpdate.holeNumber}`,
            timestamp: Date.now()
        });

        // Clear ping after 3 seconds
        const t = setTimeout(() => setPingMessage(null), 3000);
        return () => clearTimeout(t);
    }, [lastScoreUpdate, user?.id, playerProfiles]);

    // Full load if match not in store yet; otherwise sync scores from DB on mount
    useEffect(() => {
        if (!primaryMatchId) return;
        if (!primaryMatch) {
            loadMatch(primaryMatchId);
        } else {
            if (isGroupMode) refreshGroupScores();
            else refreshScores(primaryMatchId);
        }
    }, [primaryMatchId]);

    // Polling fallback
    useEffect(() => {
        if (!primaryMatchId) return;
        const interval = setInterval(() => {
            if (isGroupMode) refreshGroupScores();
            else refreshScores(primaryMatchId);
        }, 5000);
        return () => clearInterval(interval);
    }, [primaryMatchId, isGroupMode]);

    useEffect(() => {
        const allPlayerIds = isGroupMode && groupState
            ? [...new Set(groupState.matches.flatMap(m => m.players.map(p => p.userId)))]
            : primaryPlayers.map(p => p.userId);

        if (allPlayerIds.length === 0) return;

        async function loadProfiles() {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, handicap, avatar_url')
                .in('id', allPlayerIds);

            const map: Record<string, { fullName: string; handicap: number; avatarUrl?: string }> = {};
            for (const row of (profiles ?? []) as { id: string; full_name: string; handicap: number; avatar_url: string | null }[]) {
                map[row.id] = { fullName: row.full_name, handicap: row.handicap, avatarUrl: row.avatar_url ?? undefined };
            }
            setPlayerProfiles(map);
        }
        loadProfiles();
    }, [primaryPlayers, isGroupMode, groupState]);

    useEffect(() => {
        if (primaryPlayers.length === 0) return;

        // Build player rows for the scorecard view
        const rows: PlayerRow[] = currentPlayers.map((p) => {
            const playerScores = currentScores.filter((s) => s.playerId === p.userId);
            const scoreToPar = playerScores.reduce((sum, s) => {
                const holePar = course?.holes.find((h: any) => h.number === s.holeNumber)?.par ?? 4;
                return sum + (s.gross - holePar);
            }, 0);

            return {
                userId: p.userId,
                fullName: p.guestName ?? playerProfiles[p.userId]?.fullName ?? 'Player',
                handicap: playerProfiles[p.userId]?.handicap ?? p.initialHandicap,
                team: p.team,
                holesPlayed: playerScores.length,
                scoreToPar,
                avatarUrl: playerProfiles[p.userId]?.avatarUrl ?? p.avatarUrl,
                isGuest: !!p.guestName,
            };
        });

        rows.sort((a, b) => a.team.localeCompare(b.team));
        setPlayerRows(rows);
    }, [currentPlayers, currentScores, playerProfiles, course]);

    const teamAIds = currentPlayers.filter((p) => p.team === 'A').map((p) => p.userId);
    const teamBIds = currentPlayers.filter((p) => p.team === 'B').map((p) => p.userId);
    const format = currentMatch?.format ?? '1v1';

    const matchHcps = currentPlayers.map(p => Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap));
    const lowestMatchHcp = matchHcps.length > 0 ? Math.min(...matchHcps) : 0;

    const groupHcps = allGroupPlayers.map(p => Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap));
    const globalLowestHcp = groupHcps.length > 0 ? Math.min(...groupHcps) : 0;
    const globalMaxDiff = groupHcps.length > 0 ? (Math.max(...groupHcps) - globalLowestHcp) : 0;

    const scoresWithAdjusted = currentScores.map(s => {
        const p = currentPlayers.find(x => x.userId === s.playerId);
        const baseHcp = p ? Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap) : 0;
        const adjustedHcp = format === '2v2' ? 0 : Math.max(0, baseHcp - Math.max(0, lowestMatchHcp));
        const holeStrokeIdx = course?.holes.find((h: any) => h.number === s.holeNumber)?.strokeIndex ?? 18;
        return {
            ...s,
            adjustedNet: calcNet(s.gross, adjustedHcp, holeStrokeIdx)
        };
    });

    let teamHandicapDiff: { diff: number; spottedTeam: 'A' | 'B' | null } | undefined;
    if (format === '2v2') {
        const teamAHcp = currentPlayers.filter(p => p.team === 'A').reduce((sum: number, p: MatchPlayer) => sum + Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap), 0);
        const teamBHcp = currentPlayers.filter(p => p.team === 'B').reduce((sum: number, p: MatchPlayer) => sum + Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap), 0);
        const diff = Math.abs(teamAHcp - teamBHcp);
        const spottedTeam = teamAHcp > teamBHcp ? 'A' : teamBHcp > teamAHcp ? 'B' : null;
        teamHandicapDiff = { diff, spottedTeam };
    }

    const matchPlaySplits = calcMatchPlay(teamAIds, teamBIds, scoresWithAdjusted, format, course, currentMatch?.sideBets?.birdiesDouble, currentMatch?.sideBets, teamHandicapDiff);
    const { holesUp, holesPlayed } = matchPlaySplits.overall;


    const heroLabel = matchLabel(holesUp, holesPlayed);
    const heroLeader = holesUp > 0 ? 'A' : holesUp < 0 ? 'B' : null;

    const hcpDiffForDots = showAllPlayers ? globalMaxDiff : (format === '2v2' ? (teamHandicapDiff?.diff ?? 0) : (Math.max(0, ...matchHcps) - lowestMatchHcp));

    // Activity feed aggregated from all matches in group
    const activityEvents: ActivityEvent[] = [];

    // 1. Scan for Presses (Match-specific)
    const entriesToScan = isGroupMode && groupState ? groupState.matches : [{
        matchId: primaryMatchId!,
        match: primaryMatch!,
        players: primaryPlayers,
        scores: primaryScores,
        presses: primaryPresses
    }];

    for (const entry of entriesToScan) {
        if (!entry.match) continue;
        const opponent = entry.players.find(p => p.team === 'B');
        const oppName = opponent?.guestName ?? playerProfiles[opponent?.userId ?? '']?.fullName.split(' ')[0] ?? 'Opp';

        for (const press of entry.presses) {
            activityEvents.push({
                id: `press-${press.id}`, // DB ID is already global
                message: (
                    <>
                        <strong className="text-white">Team {press.pressedByTeam}</strong> pressed <strong className="text-bloodRed">{oppName}</strong> on Hole {press.startHole}.
                    </>
                ),
                color: 'bg-bloodRed/80',
            });
        }
    }

    // 2. Scan for Scores/Trophies (Global to group)
    // Using allGroupScores prevents duplicates if a player is in multiple match pairings
    for (const score of allGroupScores) {
        const player = allGroupPlayers.find((r) => r.userId === score.playerId);
        const pName = player?.guestName ?? playerProfiles[score.playerId]?.fullName ?? 'Player';

        for (const dot of score.trashDots) {
            activityEvents.push({
                // Global ID: hole + player + trophy type
                id: `trophy-${score.holeNumber}-${score.playerId}-${dot}`,
                message: (
                    <>
                        <strong className="text-white">{pName}</strong> earned a <strong className="text-neonGreen capitalize">{dot}</strong> on Hole {score.holeNumber}.
                    </>
                ),
                color: 'bg-neonGreen/80',
            });
        }
    }

    // Filter by ID just to be safe and reverse for chronological (newest first)
    const uniqueEvents = activityEvents.filter((ev, idx, self) =>
        self.findIndex(t => t.id === ev.id) === idx
    );
    uniqueEvents.reverse();

    const startingHole = currentMatch?.sideBets?.startingHole ?? 1;
    const lastHole = ((startingHole - 2 + 18) % 18) + 1;
    const uniqueHolesScored = new Set(currentScores.map((s) => s.holeNumber)).size;
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
    const headers: { type: 'hole' | 'divider' | 'header'; val: number | string; splitData?: { holesUp: number; holesPlayed: number } }[] = [
        ...frontNine.map(h => ({ type: 'hole' as const, val: h.number })),
        { type: 'divider' as const, val: 'OUT', splitData: matchPlaySplits.front9 },
        ...backNine.map(h => ({ type: 'hole' as const, val: h.number })),
        { type: 'divider' as const, val: 'IN', splitData: matchPlaySplits.back9 },
        { type: 'header' as const, val: 'GROSS' },
        { type: 'header' as const, val: 'NET' }
    ];

    function getPlayerScore(pId: string, hNum: number) {
        return currentScores.find(s => s.playerId === pId && s.holeNumber === hNum)?.gross || 0;
    }

    function getPlayerNetScore(pId: string, hNum: number) {
        return scoresWithAdjusted.find(s => s.playerId === pId && s.holeNumber === hNum)?.adjustedNet || 0;
    }

    function getPlayerSum(pId: string, range: number[]) {
        return range.reduce((sum, h) => sum + getPlayerScore(pId, h), 0);
    }

    function getPlayerNetSum(pId: string, range: number[]) {
        return range.reduce((sum, h) => sum + getPlayerNetScore(pId, h), 0);
    }

    function renderScoreCell(pId: string, hNum: number) {
        const scoreEntry = currentScores.find(s => s.playerId === pId && s.holeNumber === hNum);
        const val = scoreEntry?.gross || 0;
        if (val === 0) return <span className="text-secondaryText/30">—</span>;

        const par = sortedHoles.find(h => h.number === hNum)?.par ?? 4;
        const trash = scoreEntry?.trashDots ?? [];

        // --- Premium Score Visualization ---
        let shape;

        if (val <= par - 2) {
            shape = (
                <div className="w-8 h-8 rounded-full border border-[0.5px] border-cyan-400 ring-1 ring-cyan-400 ring-offset-1 ring-offset-background flex items-center justify-center text-cyan-400 text-[11px] font-black bg-cyan-400/5 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                    {val}
                </div>
            );
        } else if (val === par - 1) {
            shape = (
                <div className="w-8 h-8 rounded-full border border-neonGreen flex items-center justify-center text-neonGreen text-[11px] font-black bg-neonGreen/10 shadow-[0_0_8px_rgba(0,255,102,0.1)]">
                    {val}
                </div>
            );
        } else if (val === par + 1) {
            shape = (
                <div className="w-8 h-8 border border-amber-400 flex items-center justify-center text-amber-400 text-[11px] font-black bg-amber-400/5">
                    {val}
                </div>
            );
        } else if (val === par + 2) {
            shape = (
                <div className="w-8 h-8 border border-bloodRed flex items-center justify-center text-bloodRed text-[11px] font-black bg-bloodRed/10">
                    {val}
                </div>
            );
        } else if (val >= par + 3) {
            shape = (
                <div className="w-8 h-8 border border-[0.5px] border-[#FF00FF] ring-1 ring-[#FF00FF] ring-offset-1 ring-offset-background flex items-center justify-center text-[#FF00FF] text-[11px] font-black bg-[#FF00FF]/5 shadow-[0_0_10px_rgba(255,0,255,0.2)]">
                    {val}
                </div>
            );
        } else {
            shape = <span className="font-black text-white text-xs">{val}</span>;
        }

        return (
            <div className="relative flex items-center justify-center w-8 h-8">
                {shape}
                {/* Side Bet Trophies */}
                {trash.includes('greenie') && (
                    <Target className="absolute -top-0.5 -right-0.5 w-[9px] h-[9px] text-neonGreen drop-shadow-[0_0_3px_rgba(0,255,102,0.6)]" />
                )}
                {trash.includes('snake') && (
                    <Zap className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] text-[#FF00FF] fill-[#FF00FF] drop-shadow-[0_0_3px_rgba(255,0,255,0.6)]" />
                )}
                {trash.includes('sandie') && (
                    <Droplets className="absolute -top-0.5 -left-0.5 w-[9px] h-[9px] text-cyan-400 fill-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.6)]" />
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            {/* Realtime Score Update Ping */}
            <AnimatePresence>
                {pingMessage && (
                    <motion.div
                        initial={{ y: -50, opacity: 0, x: '-50%' }}
                        animate={{ y: 0, opacity: 1, x: '-50%' }}
                        exit={{ y: -50, opacity: 0, x: '-50%' }}
                        className="absolute top-4 left-1/2 z-50 pointer-events-none"
                    >
                        <div className="bg-surface/90 backdrop-blur-md border border-neonGreen/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-[0_0_20px_rgba(0,255,102,0.2)]">
                            <div className="w-2 h-2 rounded-full bg-neonGreen animate-pulse shadow-[0_0_8px_rgba(0,255,102,1)]" />
                            <span className="text-[10px] font-black tracking-widest uppercase text-neonGreen">{pingMessage.message}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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
                {/* Multi-Match Group Overview */}
                {isGroupMode && groupState && (
                    <section>
                        <div className="text-secondaryText text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 pl-1">
                            <LayoutGrid className="w-3.5 h-3.5" /> Pairing Summaries
                        </div>
                        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                            {groupState.matches.map((entry, i) => {
                                const splits = calcMatchPlay(
                                    entry.players.filter((p: MatchPlayer) => p.team === 'A').map((p: MatchPlayer) => p.userId),
                                    entry.players.filter((p: MatchPlayer) => p.team === 'B').map((p: MatchPlayer) => p.userId),
                                    entry.scores.map((s: HoleScore) => {
                                        const p = entry.players.find(x => x.userId === s.playerId);
                                        const pData = playerProfiles[s.playerId] || { handicap: p?.initialHandicap ?? 0 };
                                        const mHcps = entry.players.map(x => Math.round(playerProfiles[x.userId]?.handicap ?? x.initialHandicap));
                                        const mLHcp = Math.min(...mHcps);
                                        const adj = Math.max(0, Math.round(pData.handicap) - Math.max(0, mLHcp));
                                        return { ...s, adjustedNet: calcNet(s.gross, adj, course?.holes.find((h: any) => h.number === s.holeNumber)?.strokeIndex ?? 18) };
                                    }),
                                    '1v1',
                                    course,
                                    entry.match.sideBets?.birdiesDouble,
                                    entry.match.sideBets
                                );
                                const mHolesUp = splits.overall.holesUp;
                                const mHolesPlayed = splits.overall.holesPlayed;
                                const pA = entry.players.find(p => p.team === 'A');
                                const pB = entry.players.find(p => p.team === 'B');
                                const nameA = pA?.guestName ?? playerProfiles[pA?.userId ?? '']?.fullName.split(' ')[0] ?? 'P1';
                                const nameB = pB?.guestName ?? playerProfiles[pB?.userId ?? '']?.fullName.split(' ')[0] ?? 'P2';

                                // Clean abbreviations (e.g., Danny -> DAN, Diddy -> DID)
                                const abbr = (s: string) => s.length > 3 ? s.slice(0, 3).toUpperCase() : s.toUpperCase();
                                const isFocused = focusedMatchIdx === i;

                                return (
                                    <button
                                        key={entry.matchId}
                                        onClick={() => setFocusedMatchIdx(i)}
                                        className={`shrink-0 w-32 p-3 rounded-xl border transition-all flex flex-col items-center justify-between text-center ${isFocused ? 'bg-surface border-neonGreen/50 shadow-[0_0_15px_rgba(0,255,102,0.15)] ring-1 ring-neonGreen/20' : 'bg-surface/40 border-borderColor/30 hover:border-borderColor/60'}`}
                                    >
                                        <div className="flex items-center gap-1 text-[9px] font-black tracking-tighter mb-2 w-full justify-center">
                                            <span className={isFocused ? 'text-white' : 'text-secondaryText/80'}>{abbr(nameA)}</span>
                                            <span className="text-bloodRed/60 font-serif italic lowercase px-0.5">v</span>
                                            <span className={isFocused ? 'text-white' : 'text-secondaryText/80'}>{abbr(nameB)}</span>
                                        </div>
                                        <div className={`text-xl font-black leading-none ${mHolesUp > 0 ? 'text-neonGreen drop-shadow-[0_0_8px_rgba(0,255,102,0.3)]' : mHolesUp < 0 ? 'text-bloodRed drop-shadow-[0_0_8px_rgba(255,0,63,0.3)]' : 'text-white/80'}`}>
                                            {matchLabel(mHolesUp, mHolesPlayed)}
                                        </div>
                                        <div className="text-[8px] font-black text-secondaryText/50 uppercase mt-2 tracking-[0.2em]">THRU {mHolesPlayed}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Hero Match Score Card */}
                <section>
                    <div className="text-secondaryText text-xs font-bold uppercase tracking-widest mb-2 pl-1 flex items-center justify-between">
                        <span>
                            {focusedEntry ? (() => {
                                const pA = focusedEntry.players.find(p => p.team === 'A');
                                const pB = focusedEntry.players.find(p => p.team === 'B');
                                const nameA = pA?.guestName ?? playerProfiles[pA?.userId ?? '']?.fullName.split(' ')[0] ?? 'P1';
                                const nameB = pB?.guestName ?? playerProfiles[pB?.userId ?? '']?.fullName.split(' ')[0] ?? 'P2';
                                return `${nameA} vs ${nameB}`;
                            })() : 'Match Score'}
                        </span>
                        {isGroupMode && <span className="text-[10px] bg-bloodRed/20 text-bloodRed px-2 py-0.5 rounded-full font-black">MATCH {focusedMatchIdx + 1}</span>}
                    </div>
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

                    {/* Nassau Splits Tracker */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                            { label: 'FRONT', data: matchPlaySplits.front9, isComplete: matchPlaySplits.front9.holesPlayed === 9 },
                            { label: 'BACK', data: matchPlaySplits.back9, isComplete: matchPlaySplits.back9.holesPlayed === 9 },
                            { label: 'OVERALL', data: matchPlaySplits.overall, isComplete: matchPlaySplits.overall.holesPlayed === 18 }
                        ].map((split, i) => {
                            const leaderLabel = matchLabel(split.data.holesUp, split.data.holesPlayed).replace(' UP', '').replace(' DN', '');
                            const isAS = split.data.holesUp === 0;
                            const tALeads = split.data.holesUp > 0;

                            const leaderName = tALeads
                                ? playerRows.filter(r => r.team === 'A').map(r => r.fullName.split(' ')[0]).join(' & ') || 'Team A'
                                : playerRows.filter(r => r.team === 'B').map(r => r.fullName.split(' ')[0]).join(' & ') || 'Team B';

                            return (
                                <div key={i} className="flex flex-col items-center justify-center p-2 rounded-lg border bg-surface/40 border-borderColor/30 transition-all">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-secondaryText/80 mb-0.5">{split.label}</span>
                                    {split.data.holesPlayed === 0 ? (
                                        <span className="text-xs font-bold text-secondaryText/40">—</span>
                                    ) : isAS ? (
                                        <span className="text-sm font-black text-secondaryText">AS</span>
                                    ) : (
                                        <div className="flex flex-col items-center leading-none mt-0.5">
                                            <span className="text-[10px] font-bold text-white truncate max-w-full block mb-0.5">
                                                {leaderName}
                                            </span>
                                            <span className={`text-xs font-black ${split.isComplete && tALeads ? 'text-neonGreen drop-shadow-[0_0_5px_rgba(0,255,102,0.5)]' : split.isComplete && !tALeads ? 'text-bloodRed drop-shadow-[0_0_5px_rgba(255,0,63,0.5)]' : tALeads ? 'text-neonGreen/80' : 'text-bloodRed/80'}`}>
                                                {leaderLabel} UP
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Scorecard Overview */}
                <section>
                    <div className="flex items-center justify-between mb-4 pl-1">
                        <div className="text-secondaryText text-xs font-bold uppercase tracking-widest">Scorecard Overview</div>

                        {isGroupMode && (
                            <div className="flex bg-surface/40 p-1 rounded-lg border border-borderColor/20">
                                <button
                                    onClick={() => setShowAllPlayers(false)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight transition-all ${!showAllPlayers ? 'bg-bloodRed text-white shadow-[0_0_10px_rgba(255,0,63,0.3)]' : 'text-secondaryText hover:text-white'}`}
                                >
                                    <User className="w-3 h-3" /> Match
                                </button>
                                <button
                                    onClick={() => setShowAllPlayers(true)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight transition-all ${showAllPlayers ? 'bg-bloodRed text-white shadow-[0_0_10px_rgba(255,0,63,0.3)]' : 'text-secondaryText hover:text-white'}`}
                                >
                                    <Users className="w-3 h-3" /> Everyone
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto scrollbar-hide pb-8 -mx-4">
                        <div className="px-4 inline-flex flex-col min-w-max gap-6">
                            {/* Table 1: Hole & Par Information */}
                            <div className="flex flex-col bg-surface/20 mb-2">
                                {/* Hole Headers */}
                                <div className="flex flex-row bg-surface">
                                    <div className="sticky left-0 z-20 bg-surface min-w-[80px] max-w-[80px] h-12 flex items-center px-3 font-black text-[10px] uppercase tracking-widest text-secondaryText shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                                        HOLE
                                    </div>
                                    {headers.map((h, i) => (
                                        <div
                                            key={i}
                                            className={`h-12 flex items-center justify-center flex-shrink-0 font-black text-[10px] tracking-tighter ${h.type === 'divider' ? 'min-w-[44px] bg-black/40 text-white' :
                                                h.type === 'header' ? 'min-w-[50px] bg-bloodRed text-white' :
                                                    'min-w-[52px] text-white/90'
                                                }`}
                                        >
                                            {h.val}
                                        </div>
                                    ))}
                                </div>

                                {/* Par Headers */}
                                <div className="flex flex-row bg-surface/40 border-b border-borderColor/10">
                                    <div className="sticky left-0 z-20 bg-surface min-w-[80px] h-10 flex items-center px-3 font-black text-[10px] uppercase tracking-widest text-secondaryText/80 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                                        PAR
                                    </div>
                                    {headers.map((h, i) => {
                                        if (h.type === 'divider') {
                                            const range = h.val === 'OUT' ? frontNine : backNine;
                                            const sum = range.reduce((s, hole) => s + hole.par, 0);
                                            return <div key={i} className="h-10 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[44px] bg-black/40 text-secondaryText/60">{sum}</div>;
                                        }
                                        if (h.type === 'header') {
                                            const total = sortedHoles.reduce((s, hole) => s + hole.par, 0);
                                            const isNet = h.val === 'NET';
                                            return (
                                                <div key={i} className={`h-10 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[50px] ${isNet ? 'bg-neonGreen/10 text-neonGreen/60' : 'bg-bloodRed/10 text-bloodRed/60'}`}>
                                                    {total}
                                                </div>
                                            );
                                        }
                                        const holePar = sortedHoles.find(x => x.number === h.val)?.par ?? 4;
                                        return (
                                            <div key={i} className="h-10 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[52px] text-secondaryText/60">
                                                {holePar}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Index Headers */}
                                <div className="flex flex-row bg-surface/20">
                                    <div className="sticky left-0 z-20 bg-surface min-w-[80px] h-9 flex items-center px-3 font-black text-[9px] uppercase tracking-[0.2em] text-secondaryText/50 shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                                        INDEX
                                    </div>
                                    {headers.map((h, i) => {
                                        if (h.type === 'divider') {
                                            return <div key={i} className="h-9 flex items-center justify-center flex-shrink-0 min-w-[44px] bg-black/20" />;
                                        }
                                        if (h.type === 'header') {
                                            return <div key={i} className="h-9 flex items-center justify-center flex-shrink-0 min-w-[50px] bg-black/20" />;
                                        }
                                        const hIdx = sortedHoles.find(x => x.number === h.val)?.strokeIndex ?? 99;
                                        const dotsCount = Math.floor(hcpDiffForDots / 18) + (hcpDiffForDots % 18 >= hIdx ? 1 : 0);
                                        const isStrokeHole = dotsCount > 0;

                                        return (
                                            <div key={i} className="h-9 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[52px] relative">
                                                {isStrokeHole ? (
                                                    <div className="w-5 h-5 rounded-full bg-bloodRed/20 border border-bloodRed/40 flex items-center justify-center shadow-[0_0_8px_rgba(255,0,63,0.2)]">
                                                        <span className="text-bloodRed text-[9px] font-black leading-none">
                                                            {hIdx === 99 ? '—' : hIdx}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-secondaryText/40">
                                                        {hIdx === 99 ? '—' : hIdx}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Table 2: Player Information */}
                            <div className="flex flex-col gap-2">
                                {playerRows.map((row) => (
                                    <div key={row.userId} className="flex flex-row group h-16 bg-surface/30 shadow-md">
                                        <div className="sticky left-0 z-20 bg-background group-hover:bg-surfaceHover min-w-[80px] max-w-[80px] h-full flex flex-col items-center justify-center gap-0.5 py-1.5 shadow-[4px_0_10px_rgba(0,0,0,0.5)] transition-colors">
                                            <div className="w-7 h-7 rounded-full bg-surface border border-borderColor flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0">
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
                                            const baseClass = "h-full flex items-center justify-center flex-shrink-0";
                                            if (h.type === 'divider') {
                                                const range = h.val === 'OUT' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [10, 11, 12, 13, 14, 15, 16, 17, 18];
                                                const sum = getPlayerSum(row.userId, range);

                                                // Dynamic Coloring for Splits winning column
                                                let splitBgClass = 'bg-black/20';
                                                let splitTextClass = 'text-white';

                                                if (h.splitData && h.splitData.holesPlayed === 9) {
                                                    const tALeads = h.splitData.holesUp > 0;
                                                    const tBLeads = h.splitData.holesUp < 0;

                                                    if (tALeads && row.team === 'A') {
                                                        splitBgClass = 'bg-neonGreen/20';
                                                        splitTextClass = 'text-neonGreen drop-shadow-[0_0_5px_rgba(0,255,102,0.5)]';
                                                    } else if (tBLeads && row.team === 'B') {
                                                        splitBgClass = 'bg-bloodRed/20';
                                                        splitTextClass = 'text-bloodRed drop-shadow-[0_0_5px_rgba(255,0,63,0.5)]';
                                                    }
                                                }

                                                return <div key={i} className={`${baseClass} min-w-[44px] ${splitBgClass} font-black text-xs ${splitTextClass} transition-colors`}>{sum || '—'}</div>;
                                            } else if (h.type === 'header') {
                                                const isNet = h.val === 'NET';
                                                const total = isNet
                                                    ? getPlayerNetSum(row.userId, Array.from({ length: 18 }, (_, i) => i + 1))
                                                    : getPlayerSum(row.userId, Array.from({ length: 18 }, (_, i) => i + 1));

                                                return (
                                                    <div key={i} className={`${baseClass} min-w-[50px] ${isNet ? 'bg-neonGreen/10 text-neonGreen' : 'bg-bloodRed/10 text-bloodRed'} font-black text-sm`}>
                                                        {total || '—'}
                                                    </div>
                                                );
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

                    {/* Scorecard Legend - Refined Guidance Card */}
                    <div className="mt-6 mx-1 p-3 rounded-xl bg-surface/20 border border-borderColor/20 backdrop-blur-md relative overflow-hidden group">
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-bloodRed/5 blur-3xl -mr-12 -mt-12 transition-colors group-hover:bg-bloodRed/10" />

                        <div className="flex items-center gap-2 mb-3 px-0.5">
                            <Activity className="w-3 h-3 text-secondaryText" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondaryText/80">Scorecard Key</span>
                        </div>

                        <div className="flex flex-col gap-4">
                            {/* Scoring Logic */}
                            <div className="flex flex-wrap gap-x-5 gap-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full border border-[0.5px] border-cyan-400 ring-1 ring-cyan-400 ring-offset-1 ring-offset-background/40" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Eagle+</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full border border-neonGreen bg-neonGreen/5" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Birdie</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 border border-amber-400 bg-amber-400/5" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Bogey</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 border border-bloodRed bg-bloodRed/5" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Double</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 border border-[0.5px] border-[#FF00FF] ring-1 ring-[#FF00FF] ring-offset-1 ring-offset-background/40" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Triple+</span>
                                </div>
                            </div>

                            {/* Trophies Logic */}
                            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5 text-neonGreen drop-shadow-[0_0_5px_rgba(0,255,102,0.4)]" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Greenie</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Zap className="w-3.5 h-3.5 text-[#FF00FF] fill-[#FF00FF] drop-shadow-[0_0_5px_rgba(255,0,255,0.4)]" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Snake</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Droplets className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]" />
                                    <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Sandie</span>
                                </div>
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
                            const standing = matchLabel(playerHolesUp, row.holesPlayed);
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
                {uniqueEvents.length > 0 && (
                    <section>
                        <div className="text-secondaryText text-xs font-bold uppercase tracking-widest flex items-center justify-between px-1 mb-3">
                            <span>Live Activity Feed</span>
                            <Activity className="w-4 h-4 text-bloodRed animate-pulse" />
                        </div>
                        <Card className="divide-y divide-borderColor/50">
                            {uniqueEvents.slice(0, 8).map((ev) => (
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
