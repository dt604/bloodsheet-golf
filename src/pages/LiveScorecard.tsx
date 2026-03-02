import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Share2, Plus, Minus, Target, Droplets, Flame, Loader, Worm, X, Pencil, Check, Settings } from 'lucide-react';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

function calcNet(gross: number, adjustedHandicap: number, strokeIndex: number): number {
    if (adjustedHandicap <= 0) return gross;
    const fullStrokes = Math.floor(adjustedHandicap / 18);
    const extra = (adjustedHandicap % 18) >= strokeIndex ? 1 : 0;
    return gross - fullStrokes - extra;
}

// Returns holesUp from Team A's perspective (positive = A leads)
function calcHolesUp(
    teamAIds: string[],
    teamBIds: string[],
    scores: { holeNumber: number; playerId: string; gross?: number; net: number; adjustedNet?: number; trashDots?: string[] }[],
    format: '1v1' | '2v2',
    course: any = null,
    birdiesDouble?: boolean,
    sideBets?: { greenies?: boolean },
    teamHandicapDiff?: { diff: number; spottedTeam: 'A' | 'B' | null }
): number {
    const holes = [...new Set(scores.map((s) => s.holeNumber))];
    let aWins = 0, bWins = 0;
    for (const hole of holes) {
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
            if (aLow < bLow) aWins += 1;
            else if (bLow < aLow) bWins += 1;

            const aSum = aNetsAdj.reduce((s, n) => s + n, 0);
            const bSum = bNetsAdj.reduce((s, n) => s + n, 0);
            if (aSum < bSum) aWins += 1;
            else if (bSum < aSum) bWins += 1;

            // Birdie bonus: +1 per player with a real gross birdie
            if (birdiesDouble) {
                aWins += aScores.filter(s => s.gross !== undefined && s.gross < par).length;
                bWins += bScores.filter(s => s.gross !== undefined && s.gross < par).length;
            }

            // Greenie bonus: +1 per team with a greenie on par 3 holes
            if (sideBets?.greenies && par === 3) {
                if (aScores.some(s => s.trashDots?.includes('greenie'))) aWins += 1;
                if (bScores.some(s => s.trashDots?.includes('greenie'))) bWins += 1;
            }
        } else {
            const aHasBirdie = aScores.some(s => s.gross !== undefined && s.gross < par);
            const bHasBirdie = bScores.some(s => s.gross !== undefined && s.gross < par);
            if (aNets[0] < bNets[0]) aWins += (birdiesDouble && aHasBirdie) ? 2 : 1;
            else if (bNets[0] < aNets[0]) bWins += (birdiesDouble && bHasBirdie) ? 2 : 1;

            if (sideBets?.greenies && par === 3) {
                if (aScores.some(s => s.trashDots?.includes('greenie'))) aWins += 1;
                if (bScores.some(s => s.trashDots?.includes('greenie'))) bWins += 1;
            }
        }
    }
    return aWins - bWins;
}

export default function LiveScorecardPage() {
    const { hole } = useParams<{ hole: string }>();
    const navigate = useNavigate();
    const currentHole = parseInt(hole || '1', 10);

    const { user, profile } = useAuth();
    const { matchId, match, course, players, scores, lastScoreUpdate, saveScore, initiatePress, loadMatch, refreshScores, refreshGroupScores, clearMatch, deleteMatch, updateMatchSettings, groupState, activeMatchIds } = useMatchStore();
    const [saving, setSaving] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);
    const [showEditSettings, setShowEditSettings] = useState(false);
    const [editWager, setEditWager] = useState(0);
    const [editWagerType, setEditWagerType] = useState<'PER_HOLE' | 'NASSAU'>('NASSAU');
    const [editGreenies, setEditGreenies] = useState(false);
    const [editSandies, setEditSandies] = useState(false);
    const [editSnake, setEditSnake] = useState(false);
    const [editAutoPress, setEditAutoPress] = useState(false);
    const [editBirdiesDouble, setEditBirdiesDouble] = useState(false);
    const [editTrashValue, setEditTrashValue] = useState(5);
    const [editBonusSkins, setEditBonusSkins] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [editingStrokeIdx, setEditingStrokeIdx] = useState(false);
    const [strokeIdxInput, setStrokeIdxInput] = useState(1);
    const [pingMessage, setPingMessage] = useState<{ message: string; timestamp: number } | null>(null);
    const [focusedMatchIdx, setFocusedMatchIdx] = useState(0);
    const isGroupMode = activeMatchIds.length > 1;
    const isScorekeeper = match?.createdBy === user?.id;

    async function handleShare() {
        const code = match?.joinCode ?? '';
        if (!code) return;
        const shareData = {
            title: 'BloodSheet Golf',
            text: `Join my BloodSheet Golf match! Code: ${code}`,
            url: window.location.href,
        };
        if (typeof navigator.share === 'function') {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return;
            }
        }
        // Fallback: copy to clipboard
        try {
            await navigator.clipboard.writeText(code);
        } catch {
            const el = document.createElement('textarea');
            el.value = code;
            el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    }

    // Local per-player score state keyed by userId
    const [localScores, setLocalScores] = useState<Record<string, number>>({});
    const [activeTrash, setActiveTrash] = useState<Record<string, string[]>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Load player profiles for display names
    const [playerProfiles, setPlayerProfiles] = useState<Record<string, { fullName: string; handicap: number; avatarUrl?: string }>>({});

    // Watch for Real-time Score Updates (Ping)
    useEffect(() => {
        if (!lastScoreUpdate || !user) return;

        // Ensure we don't ping infinitely or for ourselves. 
        // We know ALL scores for a hole are saved simultaneously, so we just debounce the generic alert.
        if (lastScoreUpdate.playerId === user.id) return;

        // Trigger Haptic
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);

        setPingMessage({
            message: `Scores updated for Hole ${lastScoreUpdate.holeNumber}`,
            timestamp: Date.now()
        });

        // Clear ping after 3 seconds
        const t = setTimeout(() => setPingMessage(null), 3000);
        return () => clearTimeout(t);
    }, [lastScoreUpdate, user?.id]);

    // Full load if match not in store yet; otherwise refresh scores only
    useEffect(() => {
        const storedMatchId = matchId || localStorage.getItem('activeMatchId');
        if (!storedMatchId) return;

        if (!match || match.id !== storedMatchId) {
            loadMatch(storedMatchId);
        } else {
            refreshScores(storedMatchId);
        }
    }, [matchId, match, loadMatch, refreshScores]);

    // Polling fallback to guarantee score updates even if realtime events drop
    useEffect(() => {
        const storedMatchId = matchId || localStorage.getItem('activeMatchId');
        if (!storedMatchId) return;
        const interval = setInterval(() => {
            if (isGroupMode) refreshGroupScores();
            else refreshScores(storedMatchId);
        }, 3000);
        return () => clearInterval(interval);
    }, [matchId, isGroupMode, refreshScores, refreshGroupScores]);

    // Load profiles for all players in the match
    useEffect(() => {
        if (players.length === 0) return;

        async function fetchProfiles() {
            const ids = isGroupMode && groupState
                ? [...new Set(groupState.matches.flatMap(m => m.players.map(p => p.userId)))]
                : players.map((p) => p.userId);

            if (ids.length === 0) return;

            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, handicap, avatar_url')
                .in('id', ids);

            const map: Record<string, { fullName: string; handicap: number; avatarUrl?: string }> = {};

            // Seed map from store first — covers Grint/guest players who have no DB profile
            for (const p of players) {
                if (p.guestName || p.avatarUrl) {
                    map[p.userId] = {
                        fullName: p.guestName ?? p.userId,
                        handicap: p.initialHandicap,
                        avatarUrl: p.avatarUrl,
                    };
                }
            }

            // DB profiles overwrite where they exist (registered users)
            for (const row of (data ?? []) as { id: string; full_name: string; handicap: number; avatar_url: string | null }[]) {
                map[row.id] = { fullName: row.full_name, handicap: row.handicap, avatarUrl: row.avatar_url ?? undefined };
            }

            setPlayerProfiles(map);
        }
        fetchProfiles();
    }, [players, isGroupMode, groupState]);

    // Initialise local score state from existing DB scores for this hole
    const _foundHole = course?.holes.find((h) => h.number === currentHole);
    const holeData = {
        number: currentHole,
        par: _foundHole?.par ?? 4,
        strokeIndex: _foundHole?.strokeIndex || currentHole,
        yardage: _foundHole?.yardage ?? 400,
    };

    useEffect(() => {
        setIsDirty(false);
    }, [currentHole]);

    // Debounced Auto-save
    useEffect(() => {
        if (!isDirty || !isScorekeeper) return;

        const timer = setTimeout(() => {
            saveCurrentHoleScores();
        }, 1500); // Save 1.5s after last change

        return () => clearTimeout(timer);
    }, [localScores, activeTrash, isDirty, isScorekeeper]);

    useEffect(() => {
        if (isDirty) return;

        const init: Record<string, number> = {};
        const initTrash: Record<string, string[]> = {};

        // Use all available scores from the group state if available, otherwise fallback to primary match scores
        const allRelevantScores = isGroupMode && groupState
            ? groupState.matches.flatMap(m => m.scores)
            : scores;

        for (const p of players) {
            const existing = allRelevantScores.find(
                (s) => s.holeNumber === currentHole && s.playerId === p.userId
            );
            init[p.userId] = existing?.gross ?? holeData.par;
            initTrash[p.userId] = existing?.trashDots ?? [];
        }
        setLocalScores(init);
        setActiveTrash(initTrash);
    }, [currentHole, players, scores, holeData.par, isDirty, isGroupMode, groupState]);

    function toggleTrash(userId: string, type: string) {
        setIsDirty(true);
        setActiveTrash((prev) => {
            const current = prev[userId] ?? [];
            const updated = current.includes(type)
                ? current.filter((t) => t !== type)
                : [...current, type];
            return { ...prev, [userId]: updated };
        });
    }

    function adjustScore(userId: string, delta: number) {
        setIsDirty(true);
        setLocalScores((prev) => ({
            ...prev,
            [userId]: Math.max(1, (prev[userId] ?? holeData.par) + delta),
        }));
    }

    // Starting hole support (shotgun / back nine)
    const startingHole = match?.sideBets?.startingHole ?? 1;
    // Last hole played = the hole just before the starting hole (wrapping around 18)
    const lastHole = ((startingHole - 2 + 18) % 18) + 1;

    // Calculate base handicaps to figure out who plays off whom
    const allHcps = players.map(p => Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap));
    const lowestHcp = Math.min(...allHcps); // lowest HCP in the match — everyone plays off this player

    const [lastSaved, setLastSaved] = useState<number | null>(null);

    async function saveCurrentHoleScores() {
        if (!match || !matchId) return;
        setSaving(true);

        try {
            if (isGroupMode && groupState) {
                // Save scores per match, using that match's handicap differential
                await Promise.all(
                    groupState.matches.flatMap((entry) => {
                        const matchLowestHcp = Math.min(
                            ...entry.players.map((p) =>
                                Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap ?? 0)
                            )
                        );
                        return entry.players.map((p) => {
                            const gross = localScores[p.userId] ?? holeData.par;
                            const baseHcp = Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap ?? 0);
                            const adjustedHcp = Math.max(0, baseHcp - Math.max(0, matchLowestHcp));
                            const net = calcNet(gross, adjustedHcp, holeData.strokeIndex);
                            return saveScore({
                                matchId: entry.matchId,
                                holeNumber: currentHole,
                                playerId: p.userId,
                                gross,
                                net,
                                trashDots: activeTrash[p.userId] ?? [],
                            });
                        });
                    })
                );
            } else {
                const matchHcps = players.map(p => Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap ?? 0));
                const lowestHcp = matchHcps.length > 0 ? Math.min(...matchHcps) : 0;

                await Promise.all(
                    players.map((p) => {
                        const gross = localScores[p.userId] ?? holeData.par;
                        const baseHcp = Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap ?? 0);
                        const adjustedHcp = match?.format === '2v2' ? 0 : Math.max(0, baseHcp - Math.max(0, lowestHcp));
                        const net = calcNet(gross, adjustedHcp, holeData.strokeIndex);
                        return saveScore({
                            matchId: matchId!,
                            holeNumber: currentHole,
                            playerId: p.userId,
                            gross,
                            net,
                            trashDots: activeTrash[p.userId] ?? [],
                        });
                    })
                );
            }
            setLastSaved(Date.now());
            setIsDirty(false);
        } finally {
            setSaving(false);
        }
    }

    // Check if the DB already has a score for every player for this specific hole
    const allPlayersSaved = isGroupMode && groupState
        ? groupState.matches.every((entry) =>
            entry.players.every((p) =>
                entry.scores.some((s) => s.holeNumber === currentHole && s.playerId === p.userId)
            )
        )
        : players.length > 0 && players.every((p) =>
            scores.some((s) => s.holeNumber === currentHole && s.playerId === p.userId)
        );
    const needsSave = isScorekeeper && (isDirty || !allPlayersSaved);

    async function handleNextHole() {
        if (needsSave) {
            setSaving(true);
            await saveCurrentHoleScores();
            setSaving(false);
            setIsDirty(false);
        }

        if (currentHole !== lastHole) {
            navigate(`/play/${currentHole === 18 ? 1 : currentHole + 1}`);
        } else {
            if (isGroupMode) {
                await Promise.all(activeMatchIds.map((id) => useMatchStore.getState().submitForAttestation(id)));
            } else {
                await useMatchStore.getState().submitForAttestation(matchId!);
            }
            navigate('/ledger');
        }
    }

    function handleViewLeaderboard() {
        navigate('/leaderboard');
    }

    async function saveStrokeIndex() {
        if (!course) return;
        const newIdx = Math.max(1, Math.min(18, strokeIdxInput));
        const updatedHoles = course.holes.map(h =>
            h.number === currentHole ? { ...h, strokeIndex: newIdx } : h
        );
        await supabase.from('courses').update({ holes: updatedHoles }).eq('id', course.id);
        useMatchStore.setState(state => ({
            course: state.course ? { ...state.course, holes: updatedHoles } : null,
        }));
        setEditingStrokeIdx(false);
    }

    async function handleInitiatePress(team: 'A' | 'B') {
        if (!matchId) return;
        await initiatePress({
            matchId,
            startHole: currentHole,
            pressedByTeam: team,
            status: 'active',
        });
    }

    if (!match) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader className="w-8 h-8 text-bloodRed animate-spin" />
            </div>
        );
    }

    const courseName = course?.name ?? 'Live Match';

    // For live leaderboard updating, we need to pass adjusted nets down to calcHolesUp
    const scoresWithAdjusted = scores.map(s => {
        const p = players.find(x => x.userId === s.playerId);
        const baseHcp = p ? Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap) : 0;
        // 2v2: no individual handicap (team differential only); 1v1: differential (play off lowest)
        const adjustedHcp = match.format === '2v2' ? 0 : Math.max(0, baseHcp - Math.max(0, lowestHcp));
        const holeStrokeIdx = course?.holes.find(h => h.number === s.holeNumber)?.strokeIndex ?? 18;
        return {
            ...s,
            adjustedNet: calcNet(s.gross, adjustedHcp, holeStrokeIdx)
        };
    });

    const teamAIds = players.filter((p) => p.team === 'A').map((p) => p.userId);
    const teamBIds = players.filter((p) => p.team === 'B').map((p) => p.userId);

    // Team handicap differential for 2v2 spotted strokes
    let teamHandicapDiff: { diff: number; spottedTeam: 'A' | 'B' | null } | undefined;
    if (match.format === '2v2') {
        const teamAHcp = players.filter(p => p.team === 'A').reduce((sum, p) => sum + Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap), 0);
        const teamBHcp = players.filter(p => p.team === 'B').reduce((sum, p) => sum + Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap), 0);
        const diff = Math.abs(teamAHcp - teamBHcp);
        const spottedTeam = teamAHcp > teamBHcp ? 'A' : teamBHcp > teamAHcp ? 'B' : null;
        teamHandicapDiff = { diff, spottedTeam };
    }

    const holesUp = match.format === 'skins' ? 0 : calcHolesUp(teamAIds, teamBIds, scoresWithAdjusted, match.format as '1v1' | '2v2', course, match.sideBets?.birdiesDouble, match.sideBets, teamHandicapDiff);

    // ── Skins: current accumulated pot value ──────────────────
    const currentSkinPot = useMemo(() => {
        if (match?.format !== 'skins') return 0;
        if (match.sideBets?.potMode) return match.wagerAmount * players.length; // fixed pot
        const skinValue = match.wagerAmount;
        const isTeamSkins = match.sideBets?.teamSkins ?? false;
        let carry = 0;
        for (let h = 1; h < currentHole; h++) {
            const hScores = scores.filter(s => s.holeNumber === h);
            if (hScores.length < players.length) break;
            if (isTeamSkins) {
                // Best ball per team
                const teamANet = Math.min(...hScores.filter(s => players.find(p => p.userId === s.playerId)?.team === 'A').map(s => s.net));
                const teamBNet = Math.min(...hScores.filter(s => players.find(p => p.userId === s.playerId)?.team === 'B').map(s => s.net));
                if (teamANet !== teamBNet) carry = 0;
                else carry += 1;
            } else {
                const minNet = Math.min(...hScores.map(s => s.net));
                const winners = hScores.filter(s => s.net === minNet);
                if (winners.length === 1) carry = 0;
                else carry += 1;
            }
        }
        return (1 + carry) * skinValue;
    }, [match, scores, players, currentHole]);

    // ── Group mode: per-match holes-up calculation ────────────
    function calcGroupMatchHolesUp(entry: typeof groupState extends null ? never : NonNullable<typeof groupState>['matches'][0]): number {
        const mTeamAIds = entry.players.filter((p) => p.team === 'A').map((p) => p.userId);
        const mTeamBIds = entry.players.filter((p) => p.team === 'B').map((p) => p.userId);
        const mLowestHcp = Math.min(
            ...entry.players.map((p) => Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap))
        );
        const mScoresAdj = entry.scores.map((s) => {
            const p = entry.players.find((x) => x.userId === s.playerId);
            const baseHcp = p ? Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap) : 0;
            const adjHcp = Math.max(0, baseHcp - Math.max(0, mLowestHcp));
            const holeStrokeIdx = course?.holes.find((h) => h.number === s.holeNumber)?.strokeIndex ?? 18;
            return { ...s, adjustedNet: calcNet(s.gross, adjHcp, holeStrokeIdx) };
        });
        return calcHolesUp(mTeamAIds, mTeamBIds, mScoresAdj, '1v1', course, entry.match.sideBets?.birdiesDouble, entry.match.sideBets);
    }

    // Focused match for press button logic in group mode
    const focusedEntry = isGroupMode && groupState ? groupState.matches[Math.min(focusedMatchIdx, groupState.matches.length - 1)] : null;
    const focusedHolesUp = focusedEntry ? calcGroupMatchHolesUp(focusedEntry) : holesUp;

    // Team A is down when holesUp < 0; Team B is down when holesUp > 0
    const downTeam: 'A' | 'B' | null = isGroupMode
        ? (focusedHolesUp < 0 ? 'A' : focusedHolesUp > 0 ? 'B' : null)
        : (holesUp < 0 ? 'A' : holesUp > 0 ? 'B' : null);

    let isStrokeHole = false;
    if (match.format === '2v2') {
        if (teamHandicapDiff) {
            isStrokeHole = Math.floor(teamHandicapDiff.diff / 18) > 0 || (teamHandicapDiff.diff % 18) >= holeData.strokeIndex;
        }
    } else {
        const maxAdjustedHcp = Math.max(0, ...players.map(p => {
            const baseHcp = Math.round(playerProfiles[p.userId]?.handicap ?? p.initialHandicap);
            return Math.max(0, baseHcp - Math.max(0, lowestHcp));
        }));
        isStrokeHole = Math.floor(maxAdjustedHcp / 18) > 0 || (maxAdjustedHcp % 18) >= holeData.strokeIndex;
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            {/* Realtime Ping Toast */}
            {pingMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
                    <div className="bg-surface/90 backdrop-blur-md border border-neonGreen/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-[0_0_20px_rgba(0,255,102,0.2)]">
                        <div className="w-2 h-2 rounded-full bg-neonGreen animate-pulse shadow-[0_0_8px_rgba(0,255,102,1)]" />
                        <span className="text-[10px] font-bold tracking-widest uppercase text-neonGreen">{pingMessage.message}</span>
                    </div>
                </div>
            )}

            {/* Header - Stationary */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-background shrink-0 z-10">
                <button
                    onClick={() => currentHole !== startingHole ? navigate(`/play/${currentHole === 1 ? 18 : currentHole - 1}`) : navigate('/leaderboard')}
                    className="p-2 -ml-2 text-secondaryText hover:text-white"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-0.5">
                        <span className="font-bold text-[10px] tracking-widest uppercase text-bloodRed drop-shadow-[0_0_8px_rgba(255,0,63,0.5)]">LIVE MATCH</span>
                        <div className="h-1 w-1 rounded-full bg-secondaryText/30" />
                        {saving ? (
                            <span className="text-[10px] font-bold text-neonGreen animate-pulse uppercase tracking-wider">Saving...</span>
                        ) : isDirty ? (
                            <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Unsaved</span>
                        ) : (
                            <div className="flex items-center gap-1">
                                <Check className="w-3 h-3 text-neonGreen" />
                                <span className="text-[10px] font-bold text-neonGreen/70 uppercase tracking-wider">
                                    Synced {lastSaved ? new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-baseline justify-center gap-1.5 leading-none mt-0.5">
                        <span className="text-4xl font-black text-white tracking-tight">HOLE {currentHole}</span>
                    </div>
                    <span className="block text-[10px] font-semibold text-secondaryText/70 tracking-wider uppercase mt-1">{courseName}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handleShare} className="p-2 text-secondaryText hover:text-white relative">
                        <Share2 className="w-5 h-5" />
                        {codeCopied && (
                            <span className="absolute -bottom-7 right-0 text-[10px] font-bold bg-surface border border-borderColor rounded px-2 py-1 text-neonGreen whitespace-nowrap">
                                Copied!
                            </span>
                        )}
                    </button>
                    <button onClick={() => {
                        setEditWager(match?.wagerAmount ?? 0);
                        setEditWagerType(match?.wagerType ?? 'NASSAU');
                        setEditGreenies(match?.sideBets?.greenies ?? false);
                        setEditSandies(match?.sideBets?.sandies ?? false);
                        setEditSnake(match?.sideBets?.snake ?? false);
                        setEditAutoPress(match?.sideBets?.autoPress ?? false);
                        setEditBirdiesDouble(match?.sideBets?.birdiesDouble ?? false);
                        setEditTrashValue(match?.sideBets?.trashValue ?? 5);
                        setEditBonusSkins(match?.sideBets?.bonusSkins ?? false);
                        setShowEditSettings(true);
                    }} className="p-2 text-secondaryText hover:text-white transition-colors">
                        <Settings className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowQuitConfirm(true)} className="p-2 -mr-2 text-secondaryText hover:text-bloodRed transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-6 pb-20 relative">
                {/* Hole Data Strip */}
                <div className="flex bg-surface rounded-xl overflow-hidden border border-borderColor divide-x divide-borderColor shadow-sm">
                    <div className="flex-1 p-2 sm:p-3 text-center">
                        <span className="block text-[10px] sm:text-xs text-secondaryText uppercase tracking-wider font-semibold">Par</span>
                        <span className="block text-lg sm:text-xl font-bold font-sans">{holeData.par}</span>
                    </div>
                    {/* Stroke Index Column - Glows if it's an active stroke hole */}
                    <div className={`flex-1 p-2 sm:p-3 text-center relative transition-colors ${isStrokeHole ? 'bg-neonGreen/10' : ''}`}>
                        {isStrokeHole && (
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4/5 h-[1px] bg-neonGreen/50 shadow-[0_0_8px_rgba(0,255,102,1)]" />
                        )}
                        <span className={`block text-[10px] sm:text-xs uppercase tracking-wider font-semibold whitespace-nowrap ${isStrokeHole ? 'text-neonGreen drop-shadow-[0_0_2px_rgba(0,255,102,0.8)]' : 'text-secondaryText'}`}>
                            {isStrokeHole ? 'Stroke Hole' : 'Stroke Idx'}
                        </span>
                        {editingStrokeIdx ? (
                            <div className="flex items-center justify-center gap-1 mt-0.5">
                                <input
                                    type="number"
                                    min={1}
                                    max={18}
                                    value={strokeIdxInput}
                                    onChange={e => setStrokeIdxInput(parseInt(e.target.value) || 1)}
                                    className="w-10 text-center text-lg font-bold bg-surfaceHover border border-borderColor rounded text-white"
                                    autoFocus
                                />
                                <button onClick={saveStrokeIndex} className="text-neonGreen">
                                    <Check className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-1">
                                <span className={`block text-lg sm:text-xl font-bold font-sans ${isStrokeHole ? 'text-neonGreen drop-shadow-[0_0_5px_rgba(0,255,102,0.5)]' : ''}`}>{holeData.strokeIndex}</span>
                                <button onClick={() => { setStrokeIdxInput(holeData.strokeIndex); setEditingStrokeIdx(true); }} className="text-secondaryText hover:text-white">
                                    <Pencil className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 p-2 sm:p-3 text-center">
                        <span className="block text-[10px] sm:text-xs text-secondaryText uppercase tracking-wider font-semibold whitespace-nowrap">Yards</span>
                        <span className="block text-lg sm:text-xl font-bold font-sans">{holeData.yardage}</span>
                    </div>
                </div>

                {/* Skin Pot Chip — pot mode shows fixed pot; carryover mode shows when skin carries */}
                {match.format === 'skins' && match.sideBets?.potMode && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-bloodRed/10 border border-bloodRed/30 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-bloodRed">Total Pot</span>
                        <span className="text-sm font-black text-white">${currentSkinPot}</span>
                    </div>
                )}
                {match.format === 'skins' && !match.sideBets?.potMode && currentSkinPot > match.wagerAmount && (
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-bloodRed/10 border border-bloodRed/30 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-bloodRed">Carried Skin Pot</span>
                        <span className="text-sm font-black text-white">${currentSkinPot}</span>
                    </div>
                )}

                {/* Match Ticker Strip — shown only in multi-match mode */}
                {isGroupMode && groupState && (
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                        {groupState.matches.map((entry, i) => {
                            const mHolesUp = calcGroupMatchHolesUp(entry);
                            const pA = entry.players.find(p => p.team === 'A');
                            const pB = entry.players.find(p => p.team === 'B');
                            const nameA = pA?.guestName ?? playerProfiles[pA?.userId ?? '']?.fullName.split(' ')[0] ?? 'P1';
                            const nameB = pB?.guestName ?? playerProfiles[pB?.userId ?? '']?.fullName.split(' ')[0] ?? 'P2';

                            const abbr = (s: string) => s.length > 3 ? s.slice(0, 3).toUpperCase() : s.toUpperCase();
                            const isFocused = focusedMatchIdx === i;

                            return (
                                <button
                                    key={entry.matchId}
                                    onClick={() => setFocusedMatchIdx(i)}
                                    className={`shrink-0 px-4 py-2.5 rounded-xl border transition-all flex flex-col items-center gap-1 min-w-[90px] ${isFocused
                                        ? 'bg-surface border-neonGreen/40 shadow-[0_0_15px_rgba(0,255,102,0.1)] ring-1 ring-neonGreen/10'
                                        : 'bg-surface/30 border-borderColor/20 text-secondaryText/60 hover:border-borderColor/40'
                                        }`}
                                >
                                    <div className="flex items-center gap-1 text-[8px] font-black tracking-tighter uppercase">
                                        <span className={isFocused ? 'text-white' : ''}>{abbr(nameA)}</span>
                                        <span className="text-bloodRed/60 font-serif italic lowercase">v</span>
                                        <span className={isFocused ? 'text-white' : ''}>{abbr(nameB)}</span>
                                    </div>
                                    <div className={`font-black text-sm leading-none ${mHolesUp > 0 ? 'text-neonGreen' : mHolesUp < 0 ? 'text-bloodRed' : 'text-white'}`}>
                                        {mHolesUp === 0 ? 'AS' : `${Math.abs(mHolesUp)} ${mHolesUp > 0 ? 'UP' : 'DN'}`}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Scoring Engine */}
                <div className="space-y-4">
                    <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider">Gross Score Input</div>

                    {players.map((player) => {
                        const isMe = player.userId === user?.id;
                        const displayName = player.guestName ?? playerProfiles[player.userId]?.fullName ?? (isMe ? profile?.fullName : 'Player') ?? 'Player';
                        const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                        const score = localScores[player.userId] ?? holeData.par;
                        const trash = activeTrash[player.userId] ?? [];
                        const isUnder = score < holeData.par;
                        const isOver = score > holeData.par;

                        return (
                            <motion.div
                                layout
                                key={player.userId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <Card
                                    className={`p-4 transition-all duration-300 relative overflow-hidden ${isUnder ? 'border-neonGreen/40 bg-neonGreen/5 shadow-[0_0_20px_rgba(0,255,102,0.05)]' : 'border-borderColor/50'} ${!isMe ? (isUnder ? 'opacity-90' : 'opacity-70') : ''}`}
                                >
                                    {isUnder && (
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-neonGreen/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                                    )}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-surfaceHover flex items-center justify-center font-bold text-white border border-borderColor overflow-hidden shrink-0">
                                                {playerProfiles[player.userId]?.avatarUrl ? (
                                                    <img src={playerProfiles[player.userId].avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    initials
                                                )}
                                            </div>
                                            <div>
                                                <span className="font-bold block text-sm">{displayName}{isMe ? ' (You)' : ''}</span>
                                                <span className={`text-[10px] uppercase tracking-widest font-bold ${player.team === 'B' ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                    {(match.format !== 'skins' || match.sideBets?.teamSkins) && `Team ${player.team} • `}HCP {(playerProfiles[player.userId]?.handicap ?? player.initialHandicap).toFixed(1)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                                            {isScorekeeper && (
                                                <button
                                                    onClick={() => {
                                                        if (navigator.vibrate) navigator.vibrate(20);
                                                        adjustScore(player.userId, -1);
                                                    }}
                                                    className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-secondaryText active:bg-neonGreen/20 active:text-neonGreen transition-colors active:scale-90"
                                                >
                                                    <Minus className="w-5 h-5" />
                                                </button>
                                            )}
                                            <div className="w-12 text-center relative flex justify-center items-center h-12 overflow-hidden">
                                                <AnimatePresence mode="popLayout" initial={false}>
                                                    <motion.span
                                                        key={score}
                                                        initial={{ opacity: 0, y: -20, scale: 0.8 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                        className={`absolute text-4xl font-black ${isUnder ? 'text-neonGreen drop-shadow-[0_0_8px_rgba(0,255,102,0.8)]' : isOver ? 'text-white' : 'text-white/90'}`}
                                                    >
                                                        {score}
                                                    </motion.span>
                                                </AnimatePresence>

                                                {/* Handicap dot: 1v1 only — 2v2 uses team differential instead */}
                                                {match.format !== '2v2' && (() => {
                                                    const baseHcp = Math.round(playerProfiles[player.userId]?.handicap ?? player.initialHandicap);
                                                    const adjustedHcp = Math.max(0, baseHcp - Math.max(0, lowestHcp));
                                                    const extraStrokes = Math.floor(adjustedHcp / 18) + ((adjustedHcp % 18) >= holeData.strokeIndex ? 1 : 0);

                                                    if (extraStrokes > 0) {
                                                        return (
                                                            <div className="absolute -top-1 -right-1 flex gap-0.5">
                                                                {Array.from({ length: extraStrokes }).map((_, i) => (
                                                                    <div key={i} className="w-2 h-2 rounded-full bg-bloodRed shadow-[0_0_8px_rgba(255,0,63,0.8)]" />
                                                                ))}
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            {isScorekeeper && (
                                                <button
                                                    onClick={() => {
                                                        if (navigator.vibrate) navigator.vibrate(20);
                                                        adjustScore(player.userId, 1);
                                                    }}
                                                    className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-secondaryText active:bg-bloodRed/20 active:text-bloodRed transition-colors active:scale-90"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Trash selectors — available for all players */}
                                    {match.sideBets && ((match.sideBets.greenies && holeData.par === 3) || match.sideBets.sandies || match.sideBets.snake || (match.sideBets.bonusSkins && match.format === 'skins' && holeData.par === 3)) && (
                                        <div className="mt-4 pt-4 border-t border-borderColor/50 flex gap-2">
                                            {match.sideBets.bonusSkins && match.format === 'skins' && holeData.par === 3 && (
                                                <button
                                                    onClick={() => isScorekeeper && toggleTrash(player.userId, 'pin')}
                                                    disabled={!isScorekeeper}
                                                    className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${trash.includes('pin') ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-surfaceHover text-secondaryText border border-transparent'} ${!isScorekeeper ? 'opacity-70 cursor-default' : ''}`}
                                                >
                                                    <Target className="w-3.5 h-3.5" /> Pin
                                                </button>
                                            )}
                                            {match.sideBets.greenies && holeData.par === 3 && (
                                                <button
                                                    onClick={() => isScorekeeper && toggleTrash(player.userId, 'greenie')}
                                                    disabled={!isScorekeeper}
                                                    className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${trash.includes('greenie') ? 'bg-neonGreen/20 text-neonGreen border border-neonGreen/50' : 'bg-surfaceHover text-secondaryText border border-transparent'} ${!isScorekeeper ? 'opacity-70 cursor-default' : ''}`}
                                                >
                                                    <Target className="w-3.5 h-3.5" /> Greenie
                                                </button>
                                            )}
                                            {match.sideBets.sandies && (
                                                <button
                                                    onClick={() => isScorekeeper && toggleTrash(player.userId, 'sandie')}
                                                    disabled={!isScorekeeper}
                                                    className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${trash.includes('sandie') ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-surfaceHover text-secondaryText border border-transparent'} ${!isScorekeeper ? 'opacity-70 cursor-default' : ''}`}
                                                >
                                                    <Droplets className="w-3.5 h-3.5" /> Sandie
                                                </button>
                                            )}
                                            {match.sideBets.snake && (
                                                <button
                                                    onClick={() => isScorekeeper && toggleTrash(player.userId, 'snake')}
                                                    disabled={!isScorekeeper}
                                                    className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${trash.includes('snake') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-surfaceHover text-secondaryText border border-transparent'} ${!isScorekeeper ? 'opacity-70 cursor-default' : ''}`}
                                                >
                                                    <Worm className="w-3.5 h-3.5" /> Snake
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Press button — only show on the DOWN team's card (not for skins) */}
                                    {match.format !== 'skins' && isScorekeeper && downTeam !== null && player.team === downTeam && (
                                        <div className="mt-4 pt-4 border-t border-borderColor/50 flex justify-between items-center px-1">
                                            <span className="text-xs text-secondaryText uppercase tracking-wider font-semibold">Team {player.team}</span>
                                            <button
                                                onClick={() => handleInitiatePress(player.team)}
                                                className="text-xs text-bloodRed uppercase tracking-wider font-bold flex items-center gap-1 hover:text-white transition-colors"
                                            >
                                                <Flame className="w-3.5 h-3.5" /> Initiate Press
                                            </button>
                                        </div>
                                    )}
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            </main>

            {/* Edit Match Settings */}
            {showEditSettings && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
                    <div className="bg-surface border border-borderColor rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-borderColor shrink-0">
                            <h3 className="text-lg font-black uppercase italic">Match Settings</h3>
                            <button onClick={() => setShowEditSettings(false)} className="p-1 text-secondaryText hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        {/* Scrollable body */}
                        <div className="overflow-y-auto flex-1 p-5 space-y-6">
                            {/* Wager */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-secondaryText">Wager</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-white">Amount</span>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setEditWager(v => Math.max(0, v - 5))} className="w-8 h-8 rounded-full border border-borderColor flex items-center justify-center text-white"><Minus className="w-3 h-3" /></button>
                                        <span className="text-base font-black w-10 text-center tabular-nums">${editWager}</span>
                                        <button onClick={() => setEditWager(v => v + 5)} className="w-8 h-8 rounded-full border border-borderColor flex items-center justify-center text-white"><Plus className="w-3 h-3" /></button>
                                    </div>
                                </div>
                                {match?.format !== 'skins' && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold text-white">Type</span>
                                        <div className="flex gap-2">
                                            {(['NASSAU', 'PER_HOLE'] as const).map(t => (
                                                <button key={t} onClick={() => setEditWagerType(t)} className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${editWagerType === t ? 'bg-bloodRed border-bloodRed text-white' : 'border-borderColor text-secondaryText'}`}>
                                                    {t === 'NASSAU' ? 'Nassau' : 'Per Hole'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Side Bets */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-secondaryText mb-2">Side Bets</p>
                                {[
                                    { label: 'Greenies', sub: 'Closest to pin on par 3', val: editGreenies, set: setEditGreenies },
                                    { label: 'Sandies', sub: 'Par+ from bunker', val: editSandies, set: setEditSandies },
                                    { label: 'Snake', sub: '3-putt penalty', val: editSnake, set: setEditSnake },
                                    ...(match?.format !== 'skins' ? [
                                        { label: 'Auto Press', sub: 'Press when 2 down', val: editAutoPress, set: setEditAutoPress },
                                        { label: 'Birdies Double', sub: 'Net birdie = 2 pts', val: editBirdiesDouble, set: setEditBirdiesDouble },
                                    ] : []),
                                    ...(match?.format === 'skins' ? [
                                        { label: 'Bonus Skins', sub: 'Pin (+1) · Birdie (+1) · Eagle (+2)', val: editBonusSkins, set: setEditBonusSkins },
                                    ] : []),
                                ].map(({ label, sub, val, set }) => (
                                    <div key={label} className="flex items-center justify-between py-2.5 border-b border-borderColor/50">
                                        <div>
                                            <p className="text-sm font-bold text-white">{label}</p>
                                            <p className="text-[10px] text-secondaryText">{sub}</p>
                                        </div>
                                        <button onClick={() => set(!val)} className={`w-11 h-6 rounded-full border transition-colors relative ${val ? 'bg-bloodRed border-bloodRed' : 'bg-surfaceHover border-borderColor'}`}>
                                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                ))}
                                {/* Trash Value */}
                                <div className="flex items-center justify-between py-2.5">
                                    <div>
                                        <p className="text-sm font-bold text-white">Trash Value</p>
                                        <p className="text-[10px] text-secondaryText">Payout per dot</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setEditTrashValue(v => Math.max(0, v - 5))} className="w-7 h-7 rounded-full border border-borderColor flex items-center justify-center text-white"><Minus className="w-3 h-3" /></button>
                                        <span className="text-sm font-black w-8 text-center tabular-nums">${editTrashValue}</span>
                                        <button onClick={() => setEditTrashValue(v => v + 5)} className="w-7 h-7 rounded-full border border-borderColor flex items-center justify-center text-white"><Plus className="w-3 h-3" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Save */}
                        <div className="p-5 border-t border-borderColor shrink-0">
                            <Button size="lg" className="w-full" disabled={settingsSaving} onClick={async () => {
                                if (!matchId) return;
                                setSettingsSaving(true);
                                await updateMatchSettings(matchId, {
                                    wagerAmount: editWager,
                                    wagerType: editWagerType,
                                    sideBets: {
                                        ...(match?.sideBets ?? {}),
                                        greenies: editGreenies,
                                        sandies: editSandies,
                                        snake: editSnake,
                                        autoPress: editAutoPress,
                                        birdiesDouble: editBirdiesDouble,
                                        trashValue: editTrashValue,
                                        bonusSkins: editBonusSkins,
                                    },
                                });
                                setSettingsSaving(false);
                                setShowEditSettings(false);
                            }}>
                                {settingsSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quit Confirmation Dialog */}
            {showQuitConfirm && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
                    <div className="bg-surface border border-borderColor rounded-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black">Abandon Round?</h3>
                            <button onClick={() => setShowQuitConfirm(false)} className="p-1 text-secondaryText hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-secondaryText text-center">Quit saves your scores so far. Quit & Delete permanently removes this match.</p>
                        <div className="flex flex-col gap-3 pt-2">
                            <Button size="lg" className="w-full bg-bloodRed hover:bg-bloodRed/80 border-bloodRed" onClick={() => { if (matchId) sessionStorage.setItem('dismissedMatchId', matchId); clearMatch(); navigate('/dashboard'); }}>
                                Quit Round
                            </Button>
                            <Button variant="outline" size="lg" className="w-full border-bloodRed text-bloodRed hover:bg-bloodRed/10" onClick={async () => { if (matchId) { await deleteMatch(matchId); } clearMatch(); navigate('/dashboard'); }}>
                                Quit & Delete Round
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Actions - Stationary */}
            <div className="bg-background border-t border-borderColor p-3 sm:p-4 shrink-0 pb-safe">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Button variant="outline" size="sm" className="flex-1 h-12 sm:h-14 uppercase font-bold tracking-wider text-xs sm:text-sm" onClick={handleViewLeaderboard} disabled={saving}>
                        Leaderboard
                    </Button>
                    <Button
                        size="lg"
                        className={`flex-[2] h-12 sm:h-14 uppercase font-bold tracking-wider gap-2 text-xs sm:text-sm ${needsSave ? 'shadow-[0_0_15px_rgba(255,0,63,0.3)]' : 'bg-surface hover:bg-surfaceHover border border-borderColor'}`}
                        onClick={handleNextHole}
                        disabled={saving}
                    >
                        {saving ? <Loader className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : null}
                        {needsSave
                            ? (currentHole === lastHole ? 'Save & Finish' : `Save Hole ${currentHole}`)
                            : (currentHole === lastHole ? 'View Ledger' : 'Next Hole')
                        }
                        {!saving && <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
