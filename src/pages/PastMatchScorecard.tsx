import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flag, Receipt, Trash2, Edit2, Activity, Target, Zap, Droplets, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useMatchStore } from '../store/useMatchStore';
import { Button } from '../components/ui/Button';
import { MediaLightbox } from '../components/ui/MediaLightbox';

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
    avatarUrl?: string;
    isGuest?: boolean;
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
    isHeader?: boolean;
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
        bonusSkins?: boolean;
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

    // Match Media State
    const [matchMedia, setMatchMedia] = useState<any[]>([]);
    const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    async function handleDelete() {
        if (!matchId) return;
        await deleteMatch(matchId);
        navigate('/dashboard');
    }

    async function handleEditMatch() {
        if (!matchId) return;
        setLoading(true);
        // Switch match back to active status
        const { error } = await supabase.from('matches').update({ status: 'in_progress' }).eq('id', matchId);
        if (!error) {
            await useMatchStore.getState().loadMatch(matchId);
            navigate('/leaderboard');
        } else {
            setErrorMsg('Failed to reopen match for editing.');
            setLoading(false);
        }
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
                    .select('user_id, initial_handicap, guest_name, team, avatar_url')
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
                        .select('id, full_name, avatar_url')
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

                // Fetch match media
                const { data: mediaData } = await supabase
                    .from('match_media')
                    .select('*')
                    .eq('match_id', matchId)
                    .order('created_at', { ascending: true });

                if (mediaData) {
                    setMatchMedia(mediaData);
                }

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

                        const foundProfile = fetchedProfiles.find((p) => String(p.id).toLowerCase() === pId);
                        playersMap.set(pId, {
                            id: pId,
                            fullName: assignedName,
                            handicap: (mp.initial_handicap as number) || 0,
                            team: mp.team as 'A' | 'B',
                            avatarUrl: (mp.avatar_url as string | undefined) ?? (foundProfile?.avatar_url as string | undefined),
                            isGuest,
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
        { type: 'header', val: 'GROSS' },
        { type: 'header', val: 'NET' }
    ];

    const outIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const inIndices = [10, 11, 12, 13, 14, 15, 16, 17, 18];

    // --- Handicap Dots Logic (Relative to Lowest HCP) ---
    const matchHcps = players.map(p => Math.round(p.handicap));
    const lowestMatchHcp = matchHcps.length > 0 ? Math.min(...matchHcps) : 0;
    const highestMatchHcp = matchHcps.length > 0 ? Math.max(...matchHcps) : 0;
    const maxHcpDiffRel = highestMatchHcp - lowestMatchHcp;

    // ── Skins: compute per-hole winner for dot indicator ─────────────────────
    const isSkins = format === 'skins';
    // skinDotsMap[hole][playerId] = number of dots to render on that cell
    const skinDotsMap: Record<number, Record<string, number>> = {};
    if (isSkins) {
        let carry = 0;
        const holeResults: { hole: number; winnerId: string | null; holesInPot: number }[] = [];
        for (let h = 1; h <= 18; h++) {
            const scoredPlayers = players.filter(p => p.scores[h]?.gross);
            if (scoredPlayers.length < players.length) continue;
            const hScores = scoredPlayers.map(p => ({ playerId: p.id, net: p.scores[h].net }));
            const minNet = Math.min(...hScores.map(s => s.net));
            const winners = hScores.filter(s => s.net === minNet);
            const holesInPot = 1 + carry;
            if (winners.length === 1) {
                holeResults.push({ hole: h, winnerId: winners[0].playerId, holesInPot });
                carry = 0;
            } else {
                holeResults.push({ hole: h, winnerId: null, holesInPot });
                carry += 1;
            }
        }
        // 1 dot per hole in the carry run for the eventual winner
        for (const result of holeResults) {
            if (!result.winnerId) continue;
            for (let h = result.hole - result.holesInPot + 1; h <= result.hole; h++) {
                if (!skinDotsMap[h]) skinDotsMap[h] = {};
                skinDotsMap[h][result.winnerId] = (skinDotsMap[h][result.winnerId] ?? 0) + 1;
            }
        }
        // Bonus skins: birdie/eagle/pin add extra dots on that specific hole
        if (sideBets?.bonusSkins) {
            for (const p of players) {
                for (const [hStr, score] of Object.entries(p.scores)) {
                    const h = Number(hStr);
                    const par = holes.find(hole => hole.number === h)?.par ?? 4;
                    const pinBonus = score.dots?.includes('pin') ? 1 : 0;
                    const birdieBonus = score.gross === par - 1 ? 1 : 0;
                    const eagleBonus = score.gross <= par - 2 ? 2 : 0;
                    const bonusCount = pinBonus + birdieBonus + eagleBonus;
                    if (bonusCount === 0) continue;
                    if (!skinDotsMap[h]) skinDotsMap[h] = {};
                    skinDotsMap[h][p.id] = (skinDotsMap[h][p.id] ?? 0) + bonusCount;
                }
            }
        }
    }

    // ── Settlement Calculation ────────────────────────────────────────────────
    let settlementItems: SettlementLineItem[] | null = null;
    let settlementTotal = 0;
    let oppName = 'Opponent';
    let skinsPlayerSummary: { id: string; name: string; avatarUrl?: string; net: number; skins: number }[] | null = null;

    if (myTeam && data.wagerType === 'NASSAU' && !isSkins) {
        const oppTeam: 'A' | 'B' = myTeam === 'A' ? 'B' : 'A';
        const myTeamPlayers = players.filter(p => p.team === myTeam);
        const oppTeamPlayers = players.filter(p => p.team === oppTeam);

        // Build opponent display name
        const oppFirst = oppTeamPlayers[0]?.fullName?.split(' ')[0];
        const oppSecond = oppTeamPlayers[1]?.fullName?.split(' ')[0];
        oppName = oppSecond ? `${oppFirst} & ${oppSecond}` : (oppFirst ?? 'Opponent');

        function teamNetScoresOnHole(teamPlayers: MatchPlayer[], hole: number): { gross: number; net: number; dots: string[] }[] {
            return teamPlayers
                .map(p => {
                    const s = p.scores[hole];
                    return s ? { gross: s.gross, net: s.net, dots: s.dots } : undefined;
                })
                .filter((s): s is { gross: number; net: number; dots: string[] } => s !== undefined);
        }

        const holesPlayed: number[] = [];
        for (let h = 1; h <= 18; h++) {
            if (teamNetScoresOnHole(myTeamPlayers, h).length > 0 && teamNetScoresOnHole(oppTeamPlayers, h).length > 0) {
                holesPlayed.push(h);
            }
        }

        // Team handicap differential for 2v2 spotted strokes
        const myTeamHcp = myTeamPlayers.reduce((sum, p) => sum + Math.round(p.handicap), 0);
        const oppTeamHcp = oppTeamPlayers.reduce((sum, p) => sum + Math.round(p.handicap), 0);
        const teamDiff = Math.abs(myTeamHcp - oppTeamHcp);
        const spottedTeam: 'my' | 'opp' | null = myTeamHcp > oppTeamHcp ? 'my' : oppTeamHcp > myTeamHcp ? 'opp' : null;

        function holePoints(hole: number): { my: number; opp: number } {
            const myScores = teamNetScoresOnHole(myTeamPlayers, hole);
            const oppScores = teamNetScoresOnHole(oppTeamPlayers, hole);
            if (!myScores.length || !oppScores.length) return { my: 0, opp: 0 };

            const par = sortedHoles.find(h => h.number === hole)?.par ?? 4;
            const birdiesDouble = sideBets.birdiesDouble ?? false;
            const myNets = myScores.map(s => s.net);
            const oppNets = oppScores.map(s => s.net);

            if (format === '2v2') {
                let my = 0, opp = 0;

                // Apply team handicap stroke to spotted team's low scorer
                const myNetsAdj = [...myNets];
                const oppNetsAdj = [...oppNets];
                if (spottedTeam) {
                    const holeStrokeIdx = sortedHoles.find(h => h.number === hole)?.strokeIndex ?? 18;
                    if (holeStrokeIdx <= teamDiff) {
                        if (spottedTeam === 'my') {
                            const minIdx = myNetsAdj[0] <= (myNetsAdj[1] ?? Infinity) ? 0 : 1;
                            myNetsAdj[minIdx] -= 1;
                        } else {
                            const minIdx = oppNetsAdj[0] <= (oppNetsAdj[1] ?? Infinity) ? 0 : 1;
                            oppNetsAdj[minIdx] -= 1;
                        }
                    }
                }

                const myLow = Math.min(...myNetsAdj), oppLow = Math.min(...oppNetsAdj);
                if (myLow < oppLow) my += 1;
                else if (oppLow < myLow) opp += 1;

                const mySum = myNetsAdj.reduce((a, b) => a + b, 0);
                const oppSum = oppNetsAdj.reduce((a, b) => a + b, 0);
                if (mySum < oppSum) my += 1;
                else if (oppSum < mySum) opp += 1;

                // Birdie bonus: +1 per player with a real gross birdie
                if (birdiesDouble) {
                    my += myScores.filter(s => s.gross < par).length;
                    opp += oppScores.filter(s => s.gross < par).length;
                }

                // Greenie bonus: +1 per team with a greenie on par 3 holes
                if (sideBets.greenies && par === 3) {
                    if (myScores.some(s => s.dots.includes('greenie'))) my += 1;
                    if (oppScores.some(s => s.dots.includes('greenie'))) opp += 1;
                }

                return { my, opp };
            }
            let my = 0, opp = 0;
            const myHasBirdie = myScores.some(s => s.gross < par);
            const oppHasBirdie = oppScores.some(s => s.gross < par);

            if (myNets[0] < oppNets[0]) my += (birdiesDouble && myHasBirdie) ? 2 : 1;
            else if (oppNets[0] < myNets[0]) opp += (birdiesDouble && oppHasBirdie) ? 2 : 1;

            if (sideBets.greenies && par === 3) {
                if (myScores.some(s => s.dots.includes('greenie'))) my += 1;
                if (oppScores.some(s => s.dots.includes('greenie'))) opp += 1;
            }

            return { my, opp };
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

            const oppTeamSize = players.filter(p => p.team === oppTeam).length;
            const myTeamSize = players.filter(p => p.team === myTeam).length;

            if (dot === 'snake') {
                const netDots = oppDots - myDots;
                let sub = 'No snake penalty';
                if (myDots > oppDots) sub = 'You held the snake 🐍';
                else if (oppDots > myDots) sub = 'Opponent held the snake 🐍';

                items.push({
                    label,
                    sublabel: sub,
                    amount: netDots * trashVal * (oppTeamSize || 1),
                });
            } else {
                const netDots = myDots - oppDots;
                items.push({
                    label,
                    sublabel: `${myDots} won · ${oppDots} lost`,
                    amount: netDots * trashVal * (netDots > 0 ? oppTeamSize : myTeamSize) || netDots * trashVal,
                });
            }
        }

        if (sideBets.greenies) trashItem('greenie', 'Greenies');
        if (sideBets.sandies) trashItem('sandie', 'Sandies');
        if (sideBets.snake) trashItem('snake', 'Snake');

        settlementItems = items;
        settlementTotal = items.reduce((sum, i) => sum + i.amount, 0);
    } else if (isSkins) {
        const numPlayers = players.length;
        const skinValue = wagerAmount;
        const earned: Record<string, number> = {};
        const skinsWon: Record<string, number> = {};
        const holeItems: SettlementLineItem[] = [];
        let carry = 0;
        const myId = user?.id ?? '';

        for (let h = 1; h <= 18; h++) {
            const hScores = players
                .filter(p => p.scores[h]?.gross)
                .map(p => ({ playerId: p.id, net: p.scores[h].net, gross: p.scores[h].gross, dots: p.scores[h].dots }));
            if (hScores.length < numPlayers) continue;

            // Bonus skins for this hole
            const par = sideBets?.bonusSkins ? (holes.find(hole => hole.number === h)?.par ?? 4) : 4;
            let userBonusAmount = 0;
            const bonusNotes: string[] = [];
            if (sideBets?.bonusSkins) {
                for (const s of hScores) {
                    const pinBonus = s.dots?.includes('pin') ? 1 : 0;
                    const birdieBonus = s.gross === par - 1 ? 1 : 0;
                    const eagleBonus = s.gross <= par - 2 ? 2 : 0;
                    const bonusCount = pinBonus + birdieBonus + eagleBonus;
                    if (bonusCount === 0) continue;
                    const isMe = s.playerId === myId;
                    userBonusAmount += isMe ? bonusCount * skinValue * (numPlayers - 1) : -bonusCount * skinValue;
                    earned[s.playerId] = (earned[s.playerId] ?? 0) + (isMe ? bonusCount * skinValue * (numPlayers - 1) : -bonusCount * skinValue);
                    skinsWon[s.playerId] = (skinsWon[s.playerId] ?? 0) + bonusCount;
                    const pName = isMe ? 'You' : (players.find(p => p.id === s.playerId)?.fullName.split(' ')[0] ?? 'Player');
                    const bl = [pinBonus > 0 ? 'Pin' : '', birdieBonus > 0 ? 'Birdie' : '', eagleBonus > 0 ? 'Eagle' : ''].filter(Boolean).join('+');
                    bonusNotes.push(`${pName}: ${bl}`);
                }
            }

            const holesInPot = 1 + carry;
            const pot = holesInPot * skinValue;
            const minNet = Math.min(...hScores.map(s => s.net));
            const winners = hScores.filter(s => s.net === minNet);

            if (winners.length === 1) {
                const wId = winners[0].playerId;
                const isUserWinner = wId === myId;
                const baseAmount = isUserWinner ? pot * (numPlayers - 1) : -pot;
                earned[wId] = (earned[wId] ?? 0) + pot * (numPlayers - 1);
                hScores.filter(s => s.playerId !== wId).forEach(s => {
                    earned[s.playerId] = (earned[s.playerId] ?? 0) - pot;
                });
                skinsWon[wId] = (skinsWon[wId] ?? 0) + holesInPot;
                const winnerName = players.find(p => p.id === wId)?.fullName.split(' ')[0] ?? 'Player';
                const rangeLabel = holesInPot > 1 ? `Holes ${h - holesInPot + 1}–${h}` : `Hole ${h}`;
                const baseSublabel = isUserWinner ? `You win — $${pot} from each` : `${winnerName} wins — you pay $${pot}`;
                const sublabel = bonusNotes.length > 0 ? `${baseSublabel} · ${bonusNotes.join(', ')}` : baseSublabel;
                holeItems.push({ label: rangeLabel, sublabel, amount: baseAmount + userBonusAmount });
                carry = 0;
            } else {
                const baseSublabel = 'Tied — skin carries';
                const sublabel = bonusNotes.length > 0 ? `${baseSublabel} · ${bonusNotes.join(', ')}` : baseSublabel;
                holeItems.push({ label: `Hole ${h}`, sublabel, amount: userBonusAmount });
                carry += 1;
            }
        }

        if (carry > 0) {
            holeItems.push({ label: 'Final Carry', sublabel: `${carry} skin${carry > 1 ? 's' : ''} uncontested — returned`, amount: 0 });
        }

        const sortedPlayers = [...players].sort((a, b) => (earned[b.id] ?? 0) - (earned[a.id] ?? 0));
        const playerItems: SettlementLineItem[] = sortedPlayers.map(p => {
            const net = earned[p.id] ?? 0;
            const skins = skinsWon[p.id] ?? 0;
            const isMe = p.id === myId;
            return {
                label: isMe ? 'You' : p.fullName.split(' ')[0],
                sublabel: `${skins} skin${skins !== 1 ? 's' : ''} won`,
                amount: net,
            };
        });

        settlementItems = [
            ...holeItems,
            { label: 'Player Results', sublabel: '', amount: 0, isHeader: true },
            ...playerItems,
        ];
        settlementTotal = earned[myId] ?? 0;
        oppName = players.filter(p => p.id !== myId).map(p => p.fullName.split(' ')[0]).join(', ');
        skinsPlayerSummary = sortedPlayers.map(p => ({
            id: p.id,
            name: p.fullName.split(' ')[0],
            avatarUrl: p.avatarUrl,
            net: earned[p.id] ?? 0,
            skins: skinsWon[p.id] ?? 0,
        }));
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
                    <span>${data.wagerAmount} {format === 'skins' ? 'Skins' : data.wagerType === 'NASSAU' ? 'Nassau' : 'Per Hole'}</span>
                </div>
            </header>

            <div className="flex-1 w-full flex flex-col pt-4">
                {/* Skins Standings Hero */}
                {isSkins && skinsPlayerSummary && (
                    <div className="px-4 mb-4">
                        <div className="bg-surface rounded-xl border border-borderColor overflow-hidden">
                            {skinsPlayerSummary.map((p, idx) => {
                                const isLeading = idx === 0 && p.net > 0;
                                return (
                                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-borderColor/50 last:border-b-0">
                                        <span className="text-[10px] font-black text-secondaryText/50 w-4 text-right">{idx + 1}</span>
                                        <div className="w-7 h-7 rounded-full bg-surface border border-borderColor flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0">
                                            {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : p.name.slice(0, 1).toUpperCase()}
                                        </div>
                                        <span className="font-bold text-sm text-white flex-1">{p.name}</span>
                                        <span className="text-[10px] font-black text-secondaryText/60 uppercase tracking-wide mr-2">
                                            {p.skins} {p.skins === 1 ? 'skin' : 'skins'}
                                        </span>
                                        <span className={`font-black text-base leading-none ${isLeading ? 'text-neonGreen drop-shadow-[0_0_10px_rgba(0,255,102,0.4)]' : p.net < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                            {p.net === 0 ? 'E' : p.net > 0 ? `+$${p.net}` : `-$${Math.abs(p.net)}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="px-4 mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-secondaryText">
                    <div className="flex items-center gap-2">
                        <Flag className="w-4 h-4 text-bloodRed" />
                        <span>Scorecard Overview</span>
                    </div>
                </div>

                {/* Scorecard Scrollable Container */}
                <div className="w-full overflow-x-auto no-scrollbar pb-8 relative -mx-4">
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
                                            h.type === 'header' ? (h.val === 'NET' ? 'min-w-[50px] bg-neonGreen/10 text-neonGreen' : 'min-w-[50px] bg-bloodRed text-white') :
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
                                        const sum = h.val === 'OUT' ? outPar : inPar;
                                        return <div key={i} className="h-10 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[44px] bg-black/40 text-secondaryText/60">{sum}</div>;
                                    }
                                    if (h.type === 'header') {
                                        const isNet = h.val === 'NET';
                                        return (
                                            <div key={i} className={`h-10 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[50px] ${isNet ? 'bg-neonGreen/10 text-neonGreen/60' : 'bg-bloodRed/10 text-bloodRed/60'}`}>
                                                {totPar}
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
                                    if (h.type === 'divider') return <div key={i} className="h-9 flex items-center justify-center flex-shrink-0 min-w-[44px] bg-black/20" />;
                                    if (h.type === 'header') return <div key={i} className="h-9 flex items-center justify-center flex-shrink-0 min-w-[50px] bg-black/20" />;

                                    const hIdx = sortedHoles.find(x => x.number === h.val)?.strokeIndex ?? 18;
                                    const dotsCount = Math.floor(maxHcpDiffRel / 18) + (maxHcpDiffRel % 18 >= hIdx ? 1 : 0);
                                    const isStrokeHole = dotsCount > 0;

                                    return (
                                        <div key={i} className="h-9 flex items-center justify-center flex-shrink-0 font-bold text-[10px] min-w-[52px] relative">
                                            {isStrokeHole ? (
                                                <div className="w-5 h-5 rounded-full bg-bloodRed/20 border border-bloodRed/40 flex items-center justify-center shadow-[0_0_8px_rgba(255,0,63,0.2)]">
                                                    <span className="text-bloodRed text-[9px] font-black leading-none">
                                                        {hIdx}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-secondaryText/40">{hIdx}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Table 2: Player Information */}
                        <div className="flex flex-col gap-2">
                            {players.map((p) => {
                                const outGross = outIndices.reduce((sum, h) => sum + (p.scores[h]?.gross || 0), 0);
                                const inGross = inIndices.reduce((sum, h) => sum + (p.scores[h]?.gross || 0), 0);
                                const totGross = outGross + inGross;
                                const outNet = outIndices.reduce((sum, h) => sum + (p.scores[h]?.net || 0), 0);
                                const inNet = inIndices.reduce((sum, h) => sum + (p.scores[h]?.net || 0), 0);
                                const totNet = outNet + inNet;


                                return (
                                    <div key={p.id} className="flex flex-row group h-16 bg-surface/30 shadow-md">
                                        <div
                                            className="sticky left-0 z-20 bg-background group-hover:bg-surfaceHover min-w-[80px] max-w-[80px] h-full flex flex-col items-center justify-center gap-0.5 py-1.5 shadow-[4px_0_10px_rgba(0,0,0,0.5)] transition-colors cursor-pointer"
                                            onClick={() => { if (!p.isGuest) navigate(`/player/${p.id}`); }}
                                        >
                                            <div className="w-7 h-7 rounded-full bg-surface border border-borderColor flex items-center justify-center text-white text-[10px] font-bold overflow-hidden shrink-0">
                                                {p.avatarUrl
                                                    ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                    : p.fullName.slice(0, 1).toUpperCase()
                                                }
                                            </div>
                                            <span className="font-bold text-[9px] text-white truncate uppercase tracking-tighter w-full text-center px-1 leading-none pt-0.5">
                                                {p.fullName.split(' ')[0]}
                                            </span>
                                            <span className="text-[7px] font-black text-secondaryText/60 tracking-widest leading-none pb-0.5">
                                                HCP {Math.round(p.handicap)}
                                            </span>
                                        </div>

                                        {headers.map((h, i) => {
                                            const baseClass = "h-full flex items-center justify-center flex-shrink-0";
                                            if (h.type === 'divider') {
                                                const sum = h.val === 'OUT' ? outGross : inGross;
                                                return <div key={i} className={`${baseClass} min-w-[44px] bg-black/20 font-black text-xs text-white transition-colors`}>{sum || '—'}</div>;
                                            } else if (h.type === 'header') {
                                                const isNet = h.val === 'NET';
                                                const total = isNet ? totNet : totGross;
                                                return (
                                                    <div key={i} className={`${baseClass} min-w-[50px] ${isNet ? 'bg-neonGreen/10 text-neonGreen font-black' : 'bg-bloodRed/10 text-bloodRed font-black'} text-sm`}>
                                                        {total || '—'}
                                                    </div>
                                                );
                                            }

                                            // Score Cell
                                            const score = p.scores[h.val as number];
                                            if (!score || !score.gross) return <div key={i} className={`${baseClass} min-w-[52px] text-borderColor/30 text-xs font-black`}>—</div>;

                                            const val = score.gross;
                                            const par = sortedHoles.find(sh => sh.number === h.val)?.par || 4;
                                            const trash = score.dots || [];
                                            const holeMedia = matchMedia.find(m => m.hole_number === h.val && m.player_id === p.id);

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
                                                <div key={i} className={`${baseClass} min-w-[52px] text-xs font-black relative group/cell`}>
                                                    <div
                                                        className={`relative flex items-center justify-center w-8 h-8 transition-transform ${holeMedia ? 'cursor-pointer hover:scale-110 active:scale-95' : ''}`}
                                                        onClick={() => {
                                                            if (holeMedia) {
                                                                // Find all media for this player/hole to open in lightbox
                                                                const relevantMedia = matchMedia
                                                                    .filter(m => m.hole_number === h.val && m.player_id === p.id)
                                                                    .map(m => ({
                                                                        id: m.id,
                                                                        url: m.media_url,
                                                                        type: m.media_type,
                                                                        context: m.context,
                                                                        uploaderId: m.uploader_id,
                                                                        playerId: m.player_id,
                                                                        holeNumber: m.hole_number
                                                                    }));
                                                                if (relevantMedia.length > 0) {
                                                                    setLightboxMedia(relevantMedia);
                                                                    setLightboxIndex(0);
                                                                    setIsLightboxOpen(true);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {shape}
                                                        {isSkins && (skinDotsMap[h.val as number]?.[p.id] ?? 0) > 0 && (
                                                            <div className="absolute -top-0.5 -left-0.5 flex gap-px">
                                                                {Array.from({ length: skinDotsMap[h.val as number][p.id] }).map((_, i) => (
                                                                    <div key={i} className="w-2 h-2 rounded-full bg-bloodRed shadow-[0_0_4px_rgba(255,0,63,0.9)]" />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {trash.includes('greenie') && (
                                                            <Target className="absolute -top-0.5 -right-0.5 w-[9px] h-[9px] text-neonGreen drop-shadow-[0_0_3px_rgba(0,255,102,0.6)]" />
                                                        )}
                                                        {trash.includes('snake') && (
                                                            <Zap className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] text-[#FF00FF] fill-[#FF00FF] drop-shadow-[0_0_3px_rgba(255,0,255,0.6)]" />
                                                        )}
                                                        {trash.includes('sandie') && (
                                                            <Droplets className="absolute -top-0.5 -left-0.5 w-[9px] h-[9px] text-cyan-400 fill-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.6)]" />
                                                        )}
                                                        {/* Media Indicator */}
                                                        {holeMedia && (
                                                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-surface border border-borderColor flex items-center justify-center shadow-[0_0_5px_rgba(255,255,255,0.2)] z-10 transition-transform hover:scale-110">
                                                                <Camera className="w-[8px] h-[8px] text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Scorecard Legend - Refined Guidance Card */}
                <div className="px-4 mt-4">
                    <div className="p-3 rounded-xl bg-surface/40 border border-borderColor/30 backdrop-blur-md relative overflow-hidden group">
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
                                {isSkins && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-bloodRed shadow-[0_0_4px_rgba(255,0,63,0.9)]" />
                                        <span className="text-[9px] font-black text-secondaryText uppercase tracking-tight">Skin Won</span>
                                    </div>
                                )}
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
                                item.isHeader ? (
                                    <div key={i} className="px-4 py-2 bg-black/30 border-b border-borderColor/50">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-secondaryText">{item.label}</span>
                                    </div>
                                ) : (
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
                                )
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

                {/* No settlement message for guest viewers */}
                {!myTeam && (data.wagerType === 'NASSAU' || format === 'skins') && (
                    <div className="px-4 mt-4 mb-4">
                        <div className="bg-surface rounded-xl border border-borderColor p-4 text-center text-secondaryText text-sm">
                            Sign in to see your settlement breakdown.
                        </div>
                    </div>
                )}

                {/* Match Actions */}
                <div className="px-4 pt-2 pb-6 flex gap-3">
                    <Button
                        size="lg"
                        className="flex-1 bg-surface hover:bg-surfaceHover border border-borderColor text-white"
                        onClick={handleEditMatch}
                    >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit Round
                    </Button>
                    <Button
                        size="lg"
                        className="flex-1 bg-bloodRed/10 hover:bg-bloodRed/20 hover:text-white border-bloodRed/50 text-bloodRed transition-colors"
                        onClick={() => setShowDeleteConfirm(true)}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </Button>
                </div>
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Delete Confirmation Modal */}
            {
                showDeleteConfirm && (
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
                )
            }

            {/* Media Lightbox */}
            {isLightboxOpen && lightboxMedia.length > 0 && (
                <MediaLightbox
                    items={lightboxMedia}
                    initialIndex={lightboxIndex}
                    onClose={() => setIsLightboxOpen(false)}
                />
            )}
        </div >
    );
}
