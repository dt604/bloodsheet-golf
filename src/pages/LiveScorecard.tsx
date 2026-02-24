import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Share2, Plus, Minus, Target, Droplets, Flame, Loader, Worm, X } from 'lucide-react';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';

function calcNet(gross: number, adjustedHandicap: number, strokeIndex: number): number {
    if (adjustedHandicap <= 0) return gross;
    const fullStrokes = Math.floor(adjustedHandicap / 18);
    const extra = (adjustedHandicap % 18) >= strokeIndex ? 1 : 0;
    return gross - fullStrokes - extra;
}

// Returns holesUp from Team A's perspective (positive = A leads)
function calcHolesUp(teamAIds: string[], teamBIds: string[], scores: { holeNumber: number; playerId: string; gross?: number; net: number; adjustedNet?: number }[], format: '1v1' | '2v2', course: any = null, birdiesDouble?: boolean): number {
    const holes = [...new Set(scores.map((s) => s.holeNumber))];
    let aWins = 0, bWins = 0;
    for (const hole of holes) {
        const par = course?.holes?.find((h: any) => h.number === hole)?.par ?? 4;
        const aScores = scores.filter((s) => teamAIds.includes(s.playerId) && s.holeNumber === hole);
        const bScores = scores.filter((s) => teamBIds.includes(s.playerId) && s.holeNumber === hole);

        if (aScores.length === 0 || bScores.length === 0) continue;

        const aNets = aScores.map((s) => s.adjustedNet ?? s.net);
        const bNets = bScores.map((s) => s.adjustedNet ?? s.net);

        const aHasBirdie = aScores.some(s => s.net < par);
        const bHasBirdie = bScores.some(s => s.net < par);

        if (format === '2v2') {
            const aLow = Math.min(...aNets), bLow = Math.min(...bNets);
            if (aLow < bLow) aWins += (birdiesDouble && aHasBirdie) ? 2 : 1;
            else if (bLow < aLow) bWins += (birdiesDouble && bHasBirdie) ? 2 : 1;

            const aSum = aNets.reduce((s, n) => s + n, 0);
            const bSum = bNets.reduce((s, n) => s + n, 0);
            if (aSum < bSum) aWins += (birdiesDouble && aHasBirdie) ? 2 : 1;
            else if (bSum < aSum) bWins += (birdiesDouble && bHasBirdie) ? 2 : 1;
        } else {
            if (aNets[0] < bNets[0]) aWins += (birdiesDouble && aHasBirdie) ? 2 : 1;
            else if (bNets[0] < aNets[0]) bWins += (birdiesDouble && bHasBirdie) ? 2 : 1;
        }
    }
    return aWins - bWins;
}

export default function LiveScorecardPage() {
    const { hole } = useParams<{ hole: string }>();
    const navigate = useNavigate();
    const currentHole = parseInt(hole || '1', 10);

    const { user, profile } = useAuth();
    const { matchId, match, course, players, scores, saveScore, initiatePress, loadMatch, refreshScores, clearMatch } = useMatchStore();

    const [saving, setSaving] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [showQuitConfirm, setShowQuitConfirm] = useState(false);

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

    // Full load if match not in store yet; otherwise refresh scores only
    useEffect(() => {
        if (!matchId) return;
        if (!match) loadMatch(matchId);
        else refreshScores(matchId);
    }, [matchId]);

    // Polling fallback to guarantee score updates even if realtime events drop
    useEffect(() => {
        if (!matchId) return;
        const interval = setInterval(() => refreshScores(matchId), 3000);
        return () => clearInterval(interval);
    }, [matchId]);

    // Load profiles for all players in the match
    useEffect(() => {
        if (players.length === 0) return;
        async function fetchProfiles() {
            const ids = players.map((p) => p.userId);
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, handicap, avatar_url')
                .in('id', ids);
            if (data) {
                const map: Record<string, { fullName: string; handicap: number; avatarUrl?: string }> = {};
                for (const row of data as { id: string; full_name: string; handicap: number; avatar_url: string | null }[]) {
                    map[row.id] = { fullName: row.full_name, handicap: row.handicap, avatarUrl: row.avatar_url ?? undefined };
                }
                setPlayerProfiles(map);
            }
        }
        fetchProfiles();
    }, [players]);

    // Initialise local score state from existing DB scores for this hole
    const holeData = course?.holes.find((h) => h.number === currentHole) ?? {
        number: currentHole,
        par: 4,
        strokeIndex: currentHole,
        yardage: 400,
    };

    useEffect(() => {
        setIsDirty(false);
    }, [currentHole]);

    useEffect(() => {
        if (isDirty) return; // Don't wipe out local inputs if they are currently typing/tapping

        const init: Record<string, number> = {};
        const initTrash: Record<string, string[]> = {};
        for (const p of players) {
            const existing = scores.find(
                (s) => s.holeNumber === currentHole && s.playerId === p.userId
            );
            init[p.userId] = existing?.gross ?? holeData.par;
            initTrash[p.userId] = existing?.trashDots ?? [];
        }
        setLocalScores(init);
        setActiveTrash(initTrash);
    }, [currentHole, players, scores, holeData.par, isDirty]);

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

    // Calculate base handicaps to figure out who plays off whom
    const allHcps = players.map(p => playerProfiles[p.userId]?.handicap ?? p.initialHandicap);
    const lowestHcp = Math.min(0, ...allHcps); // Find lowest, floor at 0

    async function saveCurrentHoleScores() {
        if (!match || !matchId) return;

        await Promise.all(
            players.map((p) => {
                const gross = localScores[p.userId] ?? holeData.par;
                const baseHcp = playerProfiles[p.userId]?.handicap ?? p.initialHandicap;

                // Absolute net for standard record keeping
                const net = calcNet(gross, Math.max(0, baseHcp), holeData.strokeIndex);

                return saveScore({
                    matchId,
                    holeNumber: currentHole,
                    playerId: p.userId,
                    gross,
                    net,
                    trashDots: activeTrash[p.userId] ?? [],
                });
            })
        );
    }

    // Check if the DB already has a score for every player for this specific hole
    const allPlayersSaved = players.length > 0 && players.every(p =>
        scores.some(s => s.holeNumber === currentHole && s.playerId === p.userId)
    );
    const isScorekeeper = match?.createdBy === user?.id;
    const needsSave = isScorekeeper && (isDirty || !allPlayersSaved);

    async function handleNextHole() {
        if (needsSave) {
            setSaving(true);
            await saveCurrentHoleScores();
            setSaving(false);
            setIsDirty(false);
        }

        if (currentHole < 18) {
            navigate(`/play/${currentHole + 1}`);
        } else {
            await useMatchStore.getState().completeMatch(matchId!);
            navigate('/ledger');
        }
    }

    function handleViewLeaderboard() {
        navigate('/leaderboard');
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
        const baseHcp = p ? (playerProfiles[p.userId]?.handicap ?? p.initialHandicap) : 0;
        const adjustedHcp = Math.max(0, baseHcp - Math.max(0, lowestHcp)); // Adjusted vs lowest
        const holeStrokeIdx = course?.holes.find(h => h.number === s.holeNumber)?.strokeIndex ?? 18;
        return {
            ...s,
            adjustedNet: calcNet(s.gross, adjustedHcp, holeStrokeIdx)
        };
    });

    const teamAIds = players.filter((p) => p.team === 'A').map((p) => p.userId);
    const teamBIds = players.filter((p) => p.team === 'B').map((p) => p.userId);
    const holesUp = calcHolesUp(teamAIds, teamBIds, scoresWithAdjusted, match.format ?? '1v1', course, match.sideBets?.birdiesDouble);
    // Team A is down when holesUp < 0; Team B is down when holesUp > 0
    const downTeam: 'A' | 'B' | null = holesUp < 0 ? 'A' : holesUp > 0 ? 'B' : null;

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header - Stationary */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-background shrink-0 z-10">
                <button
                    onClick={() => currentHole > 1 ? navigate(`/play/${currentHole - 1}`) : navigate('/leaderboard')}
                    className="p-2 -ml-2 text-secondaryText hover:text-white"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <span className="font-bold text-lg tracking-wide uppercase text-bloodRed">LIVE MATCH</span>
                    <span className="block text-xs font-semibold text-secondaryText mt-0.5 tracking-wider uppercase">
                        {courseName} • HOLE {currentHole}
                    </span>
                    {match?.joinCode && (
                        <span className="block text-[10px] font-mono font-bold text-secondaryText/60 tracking-[0.2em] mt-0.5">
                            CODE: {match.joinCode}
                        </span>
                    )}
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
                    <div className="flex-1 p-2 sm:p-3 text-center">
                        <span className="block text-[10px] sm:text-xs text-secondaryText uppercase tracking-wider font-semibold whitespace-nowrap">Stroke Idx</span>
                        <span className="block text-lg sm:text-xl font-bold font-sans">{holeData.strokeIndex}</span>
                    </div>
                    <div className="flex-1 p-2 sm:p-3 text-center">
                        <span className="block text-[10px] sm:text-xs text-secondaryText uppercase tracking-wider font-semibold whitespace-nowrap">Yards</span>
                        <span className="block text-lg sm:text-xl font-bold font-sans">{holeData.yardage}</span>
                    </div>
                </div>

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
                            <Card
                                key={player.userId}
                                className={`p-4 transition-all duration-300 ${isUnder ? 'border-neonGreen/50 bg-neonGreen/5' : 'border-borderColor/50'
                                    } ${!isMe ? 'opacity-80' : ''}`}
                            >
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
                                            <span className={`text-xs font-semibold tracking-wider uppercase ${player.team === 'B' ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                Team {player.team}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {isScorekeeper && (
                                            <button
                                                onClick={() => adjustScore(player.userId, -1)}
                                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-secondaryText active:bg-bloodRed active:text-white transition-colors"
                                            >
                                                <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                        )}
                                        <div className="w-10 sm:w-12 text-center relative">
                                            <span className={`text-3xl sm:text-4xl font-bold ${isUnder ? 'text-neonGreen' : isOver ? 'text-white' : 'text-white'}`}>
                                                {score}
                                            </span>
                                            {/* Handicap dot: show if player gets an ADJUSTED stroke on this hole */}
                                            {(() => {
                                                const baseHcp = playerProfiles[player.userId]?.handicap ?? player.initialHandicap;
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
                                                onClick={() => adjustScore(player.userId, 1)}
                                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-secondaryText active:bg-bloodRed active:text-white transition-colors"
                                            >
                                                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Trash selectors — available for all players */}
                                {match.sideBets && (match.sideBets.greenies || match.sideBets.sandies || match.sideBets.snake) && (
                                    <div className="mt-4 pt-4 border-t border-borderColor/50 flex gap-2">
                                        {match.sideBets.greenies && (
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

                                {/* Press button — only show on the DOWN team's card */}
                                {isScorekeeper && downTeam !== null && player.team === downTeam && (
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
                        );
                    })}
                </div>
            </main>

            {/* Quit Confirmation Dialog */}
            {showQuitConfirm && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4">
                    <div className="bg-surface border border-borderColor rounded-2xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="text-xl font-black text-center">Abandon Round?</h3>
                        <p className="text-sm text-secondaryText text-center">Scores so far are saved. You can rejoin later with the match code.</p>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" size="lg" className="flex-1" onClick={() => setShowQuitConfirm(false)}>
                                Keep Playing
                            </Button>
                            <Button size="lg" className="flex-1 bg-bloodRed hover:bg-bloodRed/80 border-bloodRed" onClick={() => { clearMatch(); navigate('/dashboard'); }}>
                                Quit
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
                            ? (currentHole === 18 ? 'Save & Finish' : `Save Hole ${currentHole}`)
                            : (currentHole === 18 ? 'View Ledger' : 'Next Hole')
                        }
                        {!saving && <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
