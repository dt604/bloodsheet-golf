import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Share2, Receipt, CheckCircle2, Clock, Bell, Banknote } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';
import { useLedgerStore } from '../store/useLedgerStore';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';
import SEO from '../components/SEO';

interface LineItem {
    label: string;
    sublabel: string;
    amount: number;
    isPress?: boolean;
}

interface Settlement {
    opponentName: string;
    opponentIds: string[];
    total: number;
    items: LineItem[];
    userInMatch?: boolean;
}

export default function LedgerPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { matchId, match, players, scores, presses, course, loadMatch, refreshScores, groupState, activeMatchIds, attestations, loadAttestations, attestMatch, sendReminder } = useMatchStore();
    const { createDebt, settleImmediately, debtsOwedByMe, debtsOwedToMe, loadDebts } = useLedgerStore();

    const [settlement, setSettlement] = useState<Settlement | null>(null);
    const [groupSettlements, setGroupSettlements] = useState<Settlement[]>([]);
    const [attestPlayerNames, setAttestPlayerNames] = useState<Record<string, string>>({});
    const [attesting, setAttesting] = useState(false);
    const [creatingIOU, setCreatingIOU] = useState(false);
    const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());
    const isGroupMode = activeMatchIds.length > 1;
    const isPendingAttestation = match?.status === 'pending_attestation';
    const allDebts = [...debtsOwedByMe, ...debtsOwedToMe];
    const hasExistingDebt = allDebts.some(d => d.matchId === matchId);

    // On mount: full load if store is empty, otherwise refresh scores only
    useEffect(() => {
        if (!matchId) return;
        if (!match) loadMatch(matchId);
        else refreshScores(matchId);
        if (user) loadDebts(user.id);
    }, [matchId, user?.id]);

    // Load attestations and player names when match is pending attestation
    useEffect(() => {
        if (!matchId || !match || match.status !== 'pending_attestation') return;

        loadAttestations(matchId);

        // Also load for group matches
        if (isGroupMode && groupState) {
            groupState.matches.forEach((entry) => {
                if (entry.matchId !== matchId) loadAttestations(entry.matchId);
            });
        }

        // Fetch names for the attestation banner
        const nonGuestIds = players.filter((p) => !p.guestName).map((p) => p.userId);
        if (nonGuestIds.length > 0) {
            supabase.from('profiles').select('id, full_name').in('id', nonGuestIds).then(({ data }) => {
                const map: Record<string, string> = {};
                for (const row of (data ?? []) as { id: string; full_name: string }[]) {
                    map[row.id] = row.full_name;
                }
                setAttestPlayerNames(map);
            });
        }
    }, [matchId, match?.status]);

    useEffect(() => {
        if (!match || !user) return;
        let cancelled = false;

        async function calculate() {
            // Fetch names for ALL non-guest players (not just non-user)
            const allPlayerIds = players
                .filter((p) => !p.guestName)
                .map((p) => p.userId);

            const nameMap: Record<string, string> = {};
            if (allPlayerIds.length > 0) {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', allPlayerIds);
                for (const row of (data ?? []) as { id: string; full_name: string }[]) {
                    nameMap[row.id] = row.full_name;
                }
            }

            const teamAPlayer = players.find((p) => p.team === 'A');
            const teamBPlayer = players.find((p) => p.team === 'B');
            const teamAName = teamAPlayer?.guestName ?? nameMap[teamAPlayer?.userId ?? ''] ?? 'Player A';
            const teamBName = teamBPlayer?.guestName ?? nameMap[teamBPlayer?.userId ?? ''] ?? 'Player B';
            const oppName = match!.format === 'skins'
                ? players.map(p => (p.guestName ?? nameMap[p.userId] ?? 'Player').split(' ')[0]).join(' vs. ')
                : `${teamAName} vs ${teamBName}`;

            const myTeam = players.find((p) => p.userId === user!.id)?.team ?? 'A';
            const oppTeam: 'A' | 'B' = myTeam === 'A' ? 'B' : 'A';

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

            // Calculate team handicap diff for 2v2 stroke spotting
            const teamAHcp = players.filter(p => p.team === 'A').reduce((sum, p) => sum + Math.round(p.initialHandicap ?? 0), 0);
            const teamBHcp = players.filter(p => p.team === 'B').reduce((sum, p) => sum + Math.round(p.initialHandicap ?? 0), 0);
            const teamHcpDiff = Math.abs(teamAHcp - teamBHcp);
            const spottedTeam = teamAHcp > teamBHcp ? 'A' : teamAHcp < teamBHcp ? 'B' : null;

            // Points my team earned vs opp on a given hole (1v1: 0 or 1; 2v2 high-low: 0, 1, or 2)
            function holePoints(hole: number): { my: number; opp: number } {
                const myScores = teamScoresOnHole(myTeamPlayers, hole);
                const oppScores = teamScoresOnHole(oppTeamPlayers, hole);
                if (!myScores.length || !oppScores.length) return { my: 0, opp: 0 };

                const par = course?.holes?.find((h) => h.number === hole)?.par ?? 4;
                const birdiesDouble = match?.sideBets?.birdiesDouble ?? false;

                const myHasBirdie = myScores.some((s) => s.gross < par);
                const oppHasBirdie = oppScores.some((s) => s.gross < par);

                const myNets = myScores.map(s => s.gross); // start with gross for 2v2 team diff application
                const oppNets = oppScores.map(s => s.gross);

                if (match!.format === '2v2') {
                    if (spottedTeam && teamHcpDiff > 0) {
                        const holeStrokeIdx = course?.holes?.find((h: any) => h.number === hole)?.strokeIndex ?? 18;
                        if (holeStrokeIdx <= teamHcpDiff) {
                            if (spottedTeam === myTeam) {
                                const minIdx = myNets[0] <= (myNets[1] ?? Infinity) ? 0 : 1;
                                myNets[minIdx] -= 1;
                            } else if (spottedTeam === oppTeam) {
                                const minIdx = oppNets[0] <= (oppNets[1] ?? Infinity) ? 0 : 1;
                                oppNets[minIdx] -= 1;
                            }
                        }
                    }
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
                    const myRawNets = myScores.map(s => s.net);
                    const oppRawNets = oppScores.map(s => s.net);
                    if (myRawNets[0] < oppRawNets[0]) return { my: (birdiesDouble && myHasBirdie) ? 2 : 1, opp: 0 };
                    if (oppRawNets[0] < myRawNets[0]) return { my: 0, opp: (birdiesDouble && oppHasBirdie) ? 2 : 1 };
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
                const oppTeamSize = oppTeamPlayers.length > 0 ? oppTeamPlayers.length : 1;
                if (myPts > oppPts) return match!.wagerAmount * (match!.format === '2v2' ? oppTeamSize : 1);
                if (oppPts > myPts) return -match!.wagerAmount * (match!.format === '2v2' ? oppTeamSize : 1);
                return 0;
            }

            // ── Skins settlement (only when format === 'skins') ──────────
            function skinsSettlement(): LineItem[] {
                const skinValue = match!.wagerAmount;
                const numPlayers = players.length;
                const bonusSkins = match!.sideBets?.bonusSkins ?? false;
                const isTeamSkins = match!.sideBets?.teamSkins ?? false;
                const isPotMode = match!.sideBets?.potMode ?? false;

                // Helper: get player team
                function playerTeam(playerId: string): 'A' | 'B' {
                    return players.find(p => p.userId === playerId)?.team ?? 'A';
                }

                // Helper: compute bonus skin count for a score on a hole
                function bonusCount(s: typeof scores[0], par: number): number {
                    const pin = s.trashDots.includes('pin') ? 1 : 0;
                    const birdie = s.gross === par - 1 ? 1 : 0;
                    const eagle = s.gross <= par - 2 ? 2 : 0;
                    return pin + birdie + eagle;
                }

                // ── Path 2: Individual Pot Skins ──────────────────────────
                if (isPotMode && !isTeamSkins) {
                    const pot = skinValue * numPlayers;
                    const skinCounts: Record<string, number> = {};
                    let carry = 0;
                    for (let h = 1; h <= 18; h++) {
                        const hScores = scores.filter(s => s.holeNumber === h);
                        if (hScores.length < numPlayers) continue;
                        const par = bonusSkins ? (course?.holes?.find((hole: any) => hole.number === h)?.par ?? 4) : 4;
                        // Bonus skins per player
                        if (bonusSkins) {
                            for (const s of hScores) {
                                const bc = bonusCount(s, par);
                                if (bc > 0) skinCounts[s.playerId] = (skinCounts[s.playerId] ?? 0) + bc;
                            }
                        }
                        const holesInPot = 1 + carry;
                        const minNet = Math.min(...hScores.map(s => s.net));
                        const winners = hScores.filter(s => s.net === minNet);
                        if (winners.length === 1) {
                            const wId = winners[0].playerId;
                            skinCounts[wId] = (skinCounts[wId] ?? 0) + holesInPot;
                            carry = 0;
                        } else {
                            carry += 1;
                        }
                    }
                    const maxSkins = Math.max(0, ...Object.values(skinCounts));
                    const potWinners = maxSkins > 0 ? players.filter(p => (skinCounts[p.userId] ?? 0) === maxSkins) : [];
                    const isTie = potWinners.length > 1;
                    const potShare = isTie ? pot / potWinners.length : pot;
                    const isUserWinner = potWinners.some(p => p.userId === user!.id);
                    const userSkins = skinCounts[user!.id] ?? 0;

                    if (maxSkins === 0) {
                        return [{ label: 'Pot Skins', sublabel: 'No skins won — pot returned', amount: 0 }];
                    }

                    const winnerNames = potWinners.map(p => (p.guestName ?? nameMap[p.userId] ?? 'Player').split(' ')[0]).join(', ');
                    const netAmount = isUserWinner ? potShare - skinValue : -skinValue;
                    const sublabel = isUserWinner
                        ? isTie
                            ? `Tied ${maxSkins} skins — split $${pot} pot (${potWinners.length} ways)`
                            : `${maxSkins} skins — you win $${pot} pot`
                        : `You: ${userSkins} skin${userSkins !== 1 ? 's' : ''} — ${isTie ? `${winnerNames} split pot` : `${winnerNames} wins $${pot} pot`}`;
                    return [{ label: 'Pot Skins', sublabel, amount: netAmount }];
                }

                // ── Path 3: Team Per-Skin ─────────────────────────────────
                if (isTeamSkins && !isPotMode) {
                    const result: LineItem[] = [];
                    let carry = 0;
                    const myTeamArr = players.filter(p => p.team === myTeam);
                    const oppTeamArr = players.filter(p => p.team === oppTeam);
                    const numOpp = oppTeamArr.length;
                    const numMine = myTeamArr.length;

                    for (let h = 1; h <= 18; h++) {
                        const hScores = scores.filter(s => s.holeNumber === h);
                        if (hScores.length < numPlayers) continue;
                        const par = bonusSkins ? (course?.holes?.find((hole: any) => hole.number === h)?.par ?? 4) : 4;

                        // Bonus skins — individual, same as before
                        let userBonusAmount = 0;
                        const bonusNotes: string[] = [];
                        if (bonusSkins) {
                            for (const s of hScores) {
                                const bc = bonusCount(s, par);
                                if (bc === 0) continue;
                                const isUser = s.playerId === user!.id;
                                const numOpponents = isUser ? numOpp : (playerTeam(s.playerId) === myTeam ? numOpp : numMine);
                                userBonusAmount += isUser ? bc * skinValue * numOpponents : -bc * skinValue;
                                const pName = isUser ? 'You' : (players.find(p => p.userId === s.playerId)?.guestName ?? nameMap[s.playerId] ?? 'Player').split(' ')[0];
                                const bl = [s.trashDots.includes('pin') ? 'Pin' : '', s.gross === par - 1 ? 'Birdie' : '', s.gross <= par - 2 ? 'Eagle' : ''].filter(Boolean).join('+');
                                bonusNotes.push(`${pName}: ${bl}`);
                            }
                        }

                        const holesInPot = 1 + carry;
                        const potPerPlayer = holesInPot * skinValue;

                        // Best-ball net per team
                        const teamAScores = hScores.filter(s => playerTeam(s.playerId) === 'A');
                        const teamBScores = hScores.filter(s => playerTeam(s.playerId) === 'B');
                        if (teamAScores.length === 0 || teamBScores.length === 0) continue;
                        const teamANet = Math.min(...teamAScores.map(s => s.net));
                        const teamBNet = Math.min(...teamBScores.map(s => s.net));

                        const rangeLabel = holesInPot > 1 ? `Holes ${h - holesInPot + 1}–${h}` : `Hole ${h}`;

                        if (teamANet !== teamBNet) {
                            const winTeam: 'A' | 'B' = teamANet < teamBNet ? 'A' : 'B';
                            const loseTeam: 'A' | 'B' = winTeam === 'A' ? 'B' : 'A';
                            const isUserWinner = winTeam === myTeam;
                            const numWinners = players.filter(p => p.team === winTeam).length;
                            const numLosers = players.filter(p => p.team === loseTeam).length;
                            const individualReward = (potPerPlayer * numLosers) / (numWinners || 1);
                            const baseAmount = isUserWinner ? individualReward : -individualReward;
                            const baseSublabel = isUserWinner
                                ? `Team ${winTeam} wins — you collect $${individualReward} total per skin`
                                : `Team ${winTeam} wins — you pay $${individualReward} total per skin`;
                            const sublabel = bonusNotes.length > 0 ? `${baseSublabel} · ${bonusNotes.join(', ')}` : baseSublabel;
                            result.push({ label: rangeLabel, sublabel, amount: baseAmount + userBonusAmount });
                            carry = 0;
                        } else {
                            const baseSublabel = 'Tied — skin carries';
                            const sublabel = bonusNotes.length > 0 ? `${baseSublabel} · ${bonusNotes.join(', ')}` : baseSublabel;
                            result.push({ label: `Hole ${h}`, sublabel, amount: userBonusAmount });
                            carry += 1;
                        }
                    }

                    if (carry > 0) {
                        result.push({ label: 'Final Carry', sublabel: `${carry} skin${carry > 1 ? 's' : ''} uncontested — returned`, amount: 0 });
                    }
                    return result;
                }

                // ── Path 4: Team Pot Skins ────────────────────────────────
                if (isTeamSkins && isPotMode) {
                    const pot = skinValue * numPlayers;
                    const teamSkinCounts: Record<'A' | 'B', number> = { A: 0, B: 0 };
                    let carry = 0;
                    for (let h = 1; h <= 18; h++) {
                        const hScores = scores.filter(s => s.holeNumber === h);
                        if (hScores.length < numPlayers) continue;
                        const holesInPot = 1 + carry;
                        const teamAScores = hScores.filter(s => playerTeam(s.playerId) === 'A');
                        const teamBScores = hScores.filter(s => playerTeam(s.playerId) === 'B');
                        if (teamAScores.length === 0 || teamBScores.length === 0) continue;
                        const teamANet = Math.min(...teamAScores.map(s => s.net));
                        const teamBNet = Math.min(...teamBScores.map(s => s.net));
                        if (teamANet < teamBNet) { teamSkinCounts.A += holesInPot; carry = 0; }
                        else if (teamBNet < teamANet) { teamSkinCounts.B += holesInPot; carry = 0; }
                        else carry += 1;
                    }
                    const maxSkins = Math.max(teamSkinCounts.A, teamSkinCounts.B);
                    if (maxSkins === 0) {
                        return [{ label: 'Team Pot Skins', sublabel: 'No skins won — pot returned', amount: 0 }];
                    }
                    const winTeams: ('A' | 'B')[] = (['A', 'B'] as const).filter(t => teamSkinCounts[t] === maxSkins);
                    const isTie = winTeams.length > 1;
                    const myTeamWins = winTeams.includes(myTeam);
                    const myTeamSize = players.filter(p => p.team === myTeam).length;
                    const winningTeamSize = myTeamWins ? myTeamSize : players.filter(p => p.team === winTeams[0]).length;
                    const potToWinners = isTie ? pot / winTeams.length : pot;
                    const netAmount = myTeamWins ? (potToWinners / (isTie ? 1 : winningTeamSize)) - skinValue : -skinValue;
                    const userSkins = teamSkinCounts[myTeam];
                    const oppSkins = teamSkinCounts[oppTeam];
                    const sublabel = myTeamWins
                        ? isTie
                            ? `Tied — Team A:${teamSkinCounts.A} Team B:${teamSkinCounts.B} — split $${pot} pot`
                            : `Team ${myTeam} wins ${maxSkins} skins — $${pot} pot split among ${winningTeamSize} players`
                        : `Team ${winTeams[0]} wins ${maxSkins} skins — you: ${userSkins} vs opp: ${oppSkins}`;
                    return [{ label: 'Team Pot Skins', sublabel, amount: netAmount }];
                }

                // ── Path 1: Individual Per-Skin (existing) ────────────────
                const result: LineItem[] = [];
                let carry = 0;

                for (let h = 1; h <= 18; h++) {
                    const hScores = scores.filter(s => s.holeNumber === h);
                    if (hScores.length < numPlayers) continue;

                    // Compute bonus skins per player for this hole
                    const par = bonusSkins ? (course?.holes?.find((hole: any) => hole.number === h)?.par ?? 4) : 4;
                    let userBonusAmount = 0;
                    const bonusNotes: string[] = [];
                    if (bonusSkins) {
                        for (const s of hScores) {
                            const bc = bonusCount(s, par);
                            if (bc === 0) continue;
                            const isUser = s.playerId === user!.id;
                            userBonusAmount += isUser
                                ? bc * skinValue * (numPlayers - 1)
                                : -bc * skinValue;
                            const pName = isUser ? 'You' : (players.find(p => p.userId === s.playerId)?.guestName ?? nameMap[s.playerId] ?? 'Player').split(' ')[0];
                            const bonusLabel = [s.trashDots.includes('pin') ? 'Pin' : '', s.gross === par - 1 ? 'Birdie' : '', s.gross <= par - 2 ? 'Eagle' : ''].filter(Boolean).join('+');
                            bonusNotes.push(`${pName}: ${bonusLabel}`);
                        }
                    }

                    const holesInPot = 1 + carry;
                    const potPerPlayer = holesInPot * skinValue;
                    const minNet = Math.min(...hScores.map(s => s.net));
                    const winners = hScores.filter(s => s.net === minNet);

                    if (winners.length === 1) {
                        const winnerId = winners[0].playerId;
                        const winnerName = players.find(p => p.userId === winnerId)?.guestName ?? nameMap[winnerId] ?? 'Player';
                        const isUserWinner = winnerId === user!.id;
                        const baseAmount = isUserWinner
                            ? potPerPlayer * (numPlayers - 1)
                            : -potPerPlayer;
                        const rangeLabel = holesInPot > 1
                            ? `Holes ${h - holesInPot + 1}–${h}`
                            : `Hole ${h}`;
                        const baseSublabel = isUserWinner
                            ? `You win — $${potPerPlayer} from each player`
                            : `${winnerName.split(' ')[0]} wins — you pay $${potPerPlayer}`;
                        const sublabel = bonusNotes.length > 0 ? `${baseSublabel} · ${bonusNotes.join(', ')}` : baseSublabel;
                        result.push({ label: rangeLabel, sublabel, amount: baseAmount + userBonusAmount });
                        carry = 0;
                    } else {
                        const baseSublabel = 'Tied — skin carries';
                        const sublabel = bonusNotes.length > 0 ? `${baseSublabel} · ${bonusNotes.join(', ')}` : baseSublabel;
                        result.push({ label: `Hole ${h}`, sublabel, amount: userBonusAmount });
                        carry += 1;
                    }
                }

                if (carry > 0) {
                    result.push({ label: 'Final Carry', sublabel: `${carry} skin${carry > 1 ? 's' : ''} uncontested — returned`, amount: 0 });
                }

                return result;
            }

            function skinsTrashItems(): LineItem[] {
                const trashVal = match!.sideBets.trashValue ?? 5;
                const numPlayers = players.length;
                const result: LineItem[] = [];

                function skinsDot(dot: string, label: string) {
                    const myDots = scores.filter(s => s.playerId === user!.id && s.trashDots.includes(dot)).length;
                    const oppDots = scores.filter(s => s.playerId !== user!.id && s.trashDots.includes(dot)).length;
                    if (myDots === 0 && oppDots === 0) return;
                    // Greenie/Sandie: earn from opponents; Snake: pay to opponents
                    const sign = dot === 'snake' ? -1 : 1;
                    const amount = sign * (myDots * trashVal * (numPlayers - 1) - oppDots * trashVal);
                    result.push({
                        label,
                        sublabel: dot === 'snake'
                            ? (myDots > 0 ? `You held snake ${myDots}x 🐍` : 'Opponents held snake')
                            : `${myDots} won, ${oppDots} lost`,
                        amount,
                    });
                }

                if (match!.sideBets.greenies) skinsDot('greenie', 'Greenies');
                if (match!.sideBets.sandies) skinsDot('sandie', 'Sandies');
                if (match!.sideBets.snake) skinsDot('snake', 'Snake');
                return result;
            }

            // Build items based on format
            const items: LineItem[] = [];

            if (match!.format === 'skins') {
                items.push(...skinsSettlement(), ...skinsTrashItems());
            } else {
                // Nassau
                const front9Holes = holesPlayed.filter((h) => h <= 9);
                const back9Holes = holesPlayed.filter((h) => h > 9);
                const front9Amount = front9Holes.length > 0 ? nassauResult(front9Holes) : 0;
                const back9Amount = back9Holes.length > 0 ? nassauResult(back9Holes) : 0;
                const overallAmount = holesPlayed.length > 0 ? nassauResult(holesPlayed) : 0;

                items.push(
                    { label: 'Front 9 (Base)', sublabel: front9Amount > 0 ? 'Won' : front9Amount < 0 ? 'Lost' : 'Pushed', amount: front9Amount },
                    { label: 'Back 9 (Base)', sublabel: back9Amount > 0 ? 'Won' : back9Amount < 0 ? 'Lost' : 'Pushed', amount: back9Amount },
                    { label: 'Overall (18 Holes)', sublabel: overallAmount > 0 ? 'Won' : overallAmount < 0 ? 'Lost' : 'Pushed', amount: overallAmount },
                );

                for (const press of presses) {
                    const pressHoles = holesPlayed.filter((h) => h >= press.startHole);
                    const pressAmount = nassauResult(pressHoles);
                    items.push({ label: 'Press', sublabel: `Hole ${press.startHole} • Team ${press.pressedByTeam}`, amount: pressAmount, isPress: true });
                }

                // Trash / side bets
                const trashVal = match!.sideBets.trashValue ?? 5;

                function trashLineItem(dot: string, label: string) {
                    const myDots = scores.filter(
                        (s) => players.find((p) => p.userId === s.playerId && p.team === myTeam) && s.trashDots.includes(dot)
                    ).length;
                    const oppDots = scores.filter(
                        (s) => players.find((p) => p.userId === s.playerId && p.team === oppTeam) && s.trashDots.includes(dot)
                    ).length;

                    if (myDots === 0 && oppDots === 0) return;

                    if (dot === 'snake') {
                        const oppTeamSize = players.filter(p => p.team === oppTeam).length;
                        const netDots = oppDots - myDots;
                        let sub = 'No snake penalty';
                        if (myDots > oppDots) sub = 'You held the snake 🐍';
                        else if (oppDots > myDots) sub = 'Opponent held the snake 🐍';
                        items.push({ label, sublabel: sub, amount: netDots * trashVal * (oppTeamSize || 1) });
                    } else {
                        const oppTeamSize = players.filter(p => p.team === oppTeam).length;
                        const myTeamSize = players.filter(p => p.team === myTeam).length;
                        const netDots = myDots - oppDots;
                        items.push({ label, sublabel: `${myDots} won, ${oppDots} lost`, amount: netDots * trashVal * (netDots > 0 ? oppTeamSize : myTeamSize) || netDots * trashVal });
                    }
                }

                if (match!.sideBets.greenies) trashLineItem('greenie', 'Greenies');
                if (match!.sideBets.sandies) trashLineItem('sandie', 'Sandies');
                if (match!.sideBets.snake) trashLineItem('snake', 'Snake');
            }

            // Mini tourney contests — individual gross scoring, 0 handicap
            function calcMiniTourney(parFilter: 3 | 5, potPerPlayer: number): LineItem | null {
                const applicableHoleNums = (course?.holes ?? [])
                    .filter((h) => h.par === parFilter)
                    .map((h) => h.number);
                if (applicableHoleNums.length === 0) return null;
                const numPlayers = players.length;
                if (numPlayers < 2) return null;

                const totals: Record<string, number> = {};
                for (const p of players) {
                    const holesScored = applicableHoleNums.filter((hn) =>
                        scores.some((s) => s.holeNumber === hn && s.playerId === p.userId)
                    );
                    if (holesScored.length === 0) continue;
                    totals[p.userId] = holesScored.reduce((sum, hn) => {
                        const s = scores.find((sc) => sc.holeNumber === hn && sc.playerId === p.userId);
                        return sum + (s?.gross ?? 0);
                    }, 0);
                }
                const scoredEntries = Object.entries(totals);
                if (scoredEntries.length < 2) return null;

                const totalPar = applicableHoleNums.length * parFilter;
                const fmtRelPar = (gross: number) => { const r = gross - totalPar; return r === 0 ? 'E' : r > 0 ? `+${r}` : `${r}`; };

                const minGross = Math.min(...scoredEntries.map(([, g]) => g));
                const winners = scoredEntries.filter(([, g]) => g === minGross);
                const myTotal = totals[user!.id];

                if (winners.length > 1) {
                    return { label: `Par ${parFilter} Contest`, sublabel: `Tied at ${fmtRelPar(minGross)} — no payout`, amount: 0 };
                }
                const [winnerId] = winners[0];
                const winnerName = winnerId === user!.id
                    ? 'You'
                    : (nameMap[winnerId] ?? players.find((p) => p.userId === winnerId)?.guestName ?? 'Player');
                if (winnerId === user!.id) {
                    return { label: `Par ${parFilter} Contest`, sublabel: `You win at ${fmtRelPar(myTotal)}`, amount: potPerPlayer * (numPlayers - 1) };
                }
                return { label: `Par ${parFilter} Contest`, sublabel: `${winnerName.split(' ')[0]} wins at ${fmtRelPar(minGross)}${myTotal !== undefined ? ` (you: ${fmtRelPar(myTotal)})` : ''}`, amount: -potPerPlayer };
            }

            if (match!.sideBets.par3Contest) { const item = calcMiniTourney(3, match!.sideBets.par3Pot ?? 5); if (item) items.push(item); }
            if (match!.sideBets.par5Contest) { const item = calcMiniTourney(5, match!.sideBets.par5Pot ?? 5); if (item) items.push(item); }

            const total = items.reduce((sum, i) => sum + i.amount, 0);
            if (!cancelled) setSettlement({
                opponentName: oppName,
                opponentIds: oppTeamPlayers.map(p => p.userId).filter(Boolean) as string[],
                total,
                items
            });
        }

        calculate();
        return () => { cancelled = true; };
    }, [match, players, scores, presses, user]);

    // ── Group mode: compute settlement per match ─────────────
    useEffect(() => {
        if (!isGroupMode || !groupState || !user) return;
        let cancelled = false;

        async function calculateGroup() {
            // Fetch names for ALL non-guest players across all matches
            const allPlayerIds = [...new Set(
                groupState!.matches.flatMap((entry) =>
                    entry.players.filter((p) => !p.guestName).map((p) => p.userId)
                )
            )];
            const nameMap: Record<string, string> = {};
            if (allPlayerIds.length > 0) {
                const { data } = await supabase.from('profiles').select('id, full_name').in('id', allPlayerIds);
                for (const row of (data ?? []) as { id: string; full_name: string }[]) {
                    nameMap[row.id] = row.full_name;
                }
            }

            const settlements: Settlement[] = [];

            for (const entry of groupState!.matches) {
                // Default to Team A perspective if user isn't in this match
                const myTeam = entry.players.find((p) => p.userId === user!.id)?.team ?? 'A';
                const oppTeam: 'A' | 'B' = myTeam === 'A' ? 'B' : 'A';
                const oppPlayer = entry.players.find((p) => p.team === oppTeam);
                if (!oppPlayer) continue;

                const userInMatch = entry.players.some((p) => p.userId === user!.id);
                const teamAPlayer = entry.players.find((p) => p.team === 'A');
                const teamBPlayer = entry.players.find((p) => p.team === 'B');
                const teamAName = teamAPlayer?.guestName ?? nameMap[teamAPlayer?.userId ?? ''] ?? 'Player A';
                const teamBName = teamBPlayer?.guestName ?? nameMap[teamBPlayer?.userId ?? ''] ?? 'Player B';
                const oppName = `${teamAName} vs ${teamBName}`;
                const myTeamPlayers = entry.players.filter((p) => p.team === myTeam);
                const oppTeamPlayers = entry.players.filter((p) => p.team === oppTeam);

                function teamScoresOnHole(teamPlayers: typeof myTeamPlayers, hole: number) {
                    return teamPlayers
                        .map((p) => {
                            const s = entry.scores.find((sc) => sc.holeNumber === hole && sc.playerId === p.userId);
                            return s ? { net: s.net, gross: s.gross } : undefined;
                        })
                        .filter((s): s is { net: number; gross: number } => s !== undefined);
                }

                const holesPlayed: number[] = [];
                for (let h = 1; h <= 18; h++) {
                    if (teamScoresOnHole(myTeamPlayers, h).length > 0 && teamScoresOnHole(oppTeamPlayers, h).length > 0) {
                        holesPlayed.push(h);
                    }
                }

                function holePoints(hole: number): { my: number; opp: number } {
                    const myScores = teamScoresOnHole(myTeamPlayers, hole);
                    const oppScores = teamScoresOnHole(oppTeamPlayers, hole);
                    if (!myScores.length || !oppScores.length) return { my: 0, opp: 0 };
                    const par = course?.holes?.find((h) => h.number === hole)?.par ?? 4;
                    const birdiesDouble = entry.match.sideBets?.birdiesDouble ?? false;
                    const myHasBirdie = myScores.some((s) => s.gross < par);
                    const oppHasBirdie = oppScores.some((s) => s.gross < par);
                    if (myScores[0].net < oppScores[0].net) return { my: (birdiesDouble && myHasBirdie) ? 2 : 1, opp: 0 };
                    if (oppScores[0].net < myScores[0].net) return { my: 0, opp: (birdiesDouble && oppHasBirdie) ? 2 : 1 };
                    return { my: 0, opp: 0 };
                }

                function nassauResult(holes: number[]): number {
                    let myPts = 0, oppPts = 0;
                    for (const h of holes) {
                        const { my, opp } = holePoints(h);
                        myPts += my;
                        oppPts += opp;
                    }
                    const oppTeamSize = oppTeamPlayers.length > 0 ? oppTeamPlayers.length : 1;
                    if (myPts > oppPts) return entry.match.wagerAmount * (entry.match.format === '2v2' ? oppTeamSize : 1);
                    if (oppPts > myPts) return -entry.match.wagerAmount * (entry.match.format === '2v2' ? oppTeamSize : 1);
                    return 0;
                }

                const front9Holes = holesPlayed.filter((h) => h <= 9);
                const back9Holes = holesPlayed.filter((h) => h > 9);
                const front9Amount = front9Holes.length > 0 ? nassauResult(front9Holes) : 0;
                const back9Amount = back9Holes.length > 0 ? nassauResult(back9Holes) : 0;
                const overallAmount = holesPlayed.length > 0 ? nassauResult(holesPlayed) : 0;

                const items: LineItem[] = [
                    { label: 'Front 9', sublabel: front9Amount > 0 ? 'Won' : front9Amount < 0 ? 'Lost' : 'Pushed', amount: front9Amount },
                    { label: 'Back 9', sublabel: back9Amount > 0 ? 'Won' : back9Amount < 0 ? 'Lost' : 'Pushed', amount: back9Amount },
                    { label: 'Overall', sublabel: overallAmount > 0 ? 'Won' : overallAmount < 0 ? 'Lost' : 'Pushed', amount: overallAmount },
                ];

                for (const press of entry.presses) {
                    const pressHoles = holesPlayed.filter((h) => h >= press.startHole);
                    const pressAmount = nassauResult(pressHoles);
                    items.push({ label: 'Press', sublabel: `Hole ${press.startHole}`, amount: pressAmount, isPress: true });
                }

                const trashVal = entry.match.sideBets.trashValue ?? 5;
                function trashItem(dot: string, label: string) {
                    const myDots = entry.scores.filter(
                        (s) => myTeamPlayers.some((p) => p.userId === s.playerId) && s.trashDots.includes(dot)
                    ).length;
                    const oppDots = entry.scores.filter(
                        (s) => oppTeamPlayers.some((p) => p.userId === s.playerId) && s.trashDots.includes(dot)
                    ).length;
                    if (myDots === 0 && oppDots === 0) return;
                    if (dot === 'snake') {
                        const netDots = oppDots - myDots;
                        let sub = 'No snake penalty';
                        if (myDots > oppDots) sub = 'You held the snake 🐍';
                        else if (oppDots > myDots) sub = 'Opponent held the snake 🐍';

                        items.push({
                            label,
                            sublabel: sub,
                            amount: netDots * trashVal
                        });
                    } else {
                        items.push({ label, sublabel: `${myDots} won, ${oppDots} lost`, amount: (myDots - oppDots) * trashVal });
                    }
                }
                if (entry.match.sideBets.greenies) trashItem('greenie', 'Greenies');
                if (entry.match.sideBets.sandies) trashItem('sandie', 'Sandies');
                if (entry.match.sideBets.snake) trashItem('snake', 'Snake');

                const total = items.reduce((sum, i) => sum + i.amount, 0);
                settlements.push({ opponentName: oppName, opponentIds: oppTeamPlayers.map(p => p.userId).filter(Boolean) as string[], total, items, userInMatch });
            }

            // Mini tourney (group mode) — compare ALL unique players across all sub-matches
            const sharedSideBets = groupState!.matches[0]?.match.sideBets;
            if (sharedSideBets?.par3Contest || sharedSideBets?.par5Contest) {
                // Collect unique participants with gross scores keyed by hole number
                const participantMap = new Map<string, { name: string; grossByHole: Record<number, number> }>();
                for (const entry of groupState!.matches) {
                    for (const p of entry.players) {
                        if (!participantMap.has(p.userId)) {
                            participantMap.set(p.userId, {
                                name: p.guestName ?? nameMap[p.userId] ?? 'Player',
                                grossByHole: Object.fromEntries(
                                    entry.scores.filter((s) => s.playerId === p.userId).map((s) => [s.holeNumber, s.gross])
                                ),
                            });
                        }
                    }
                }
                const participants = Array.from(participantMap.entries());
                const numParticipants = participants.length;

                function calcGroupMiniTourney(parFilter: 3 | 5, potPerPlayer: number): LineItem | null {
                    const applicableHoleNums = (course?.holes ?? [])
                        .filter((h) => h.par === parFilter)
                        .map((h) => h.number);
                    if (applicableHoleNums.length === 0) return null;

                    const totals: Record<string, number> = {};
                    for (const [uid, pData] of participants) {
                        const scored = applicableHoleNums.filter((h) => pData.grossByHole[h] !== undefined);
                        if (scored.length === 0) continue;
                        totals[uid] = scored.reduce((sum, h) => sum + pData.grossByHole[h], 0);
                    }
                    const scoredEntries = Object.entries(totals);
                    if (scoredEntries.length < 2) return null;

                    const totalPar = applicableHoleNums.length * parFilter;
                    const fmtRelPar = (gross: number) => { const r = gross - totalPar; return r === 0 ? 'E' : r > 0 ? `+${r}` : `${r}`; };

                    const minGross = Math.min(...scoredEntries.map(([, g]) => g));
                    const winners = scoredEntries.filter(([, g]) => g === minGross);
                    const myTotal = totals[user!.id];

                    if (winners.length > 1) {
                        return { label: `Par ${parFilter} Contest`, sublabel: `Tied at ${fmtRelPar(minGross)} — no payout`, amount: 0 };
                    }
                    const [winnerId] = winners[0];
                    const winnerFirstName = (participantMap.get(winnerId)?.name ?? 'Player').split(' ')[0];
                    if (winnerId === user!.id) {
                        return { label: `Par ${parFilter} Contest`, sublabel: `You win at ${fmtRelPar(myTotal)}`, amount: potPerPlayer * (numParticipants - 1) };
                    }
                    return { label: `Par ${parFilter} Contest`, sublabel: `${winnerFirstName} wins at ${fmtRelPar(minGross)}${myTotal !== undefined ? ` (you: ${fmtRelPar(myTotal)})` : ''}`, amount: -potPerPlayer };
                }

                const miniItems: LineItem[] = [];
                if (sharedSideBets?.par3Contest) { const item = calcGroupMiniTourney(3, sharedSideBets.par3Pot ?? 5); if (item) miniItems.push(item); }
                if (sharedSideBets?.par5Contest) { const item = calcGroupMiniTourney(5, sharedSideBets.par5Pot ?? 5); if (item) miniItems.push(item); }

                if (miniItems.length > 0) {
                    const miniTotal = miniItems.reduce((sum, i) => sum + i.amount, 0);
                    settlements.push({ opponentName: 'Mini Tourney', opponentIds: [], total: miniTotal, items: miniItems, userInMatch: true });
                }
            }

            if (!cancelled) setGroupSettlements(settlements);
        }

        calculateGroup();
        return () => { cancelled = true; };
    }, [isGroupMode, groupState, user, course]);

    const total = isGroupMode
        ? groupSettlements.filter((s) => s.userInMatch !== false).reduce((sum, s) => sum + s.total, 0)
        : (settlement?.total ?? 0);
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

    const settlementLabel = isGroupMode
        ? (total > 0 ? 'Net Winnings' : total < 0 ? 'Net You Owe' : 'All Square')
        : (total > 0
            ? `Winnings: ${settlement?.opponentName}`
            : total < 0
                ? `Total Owed: ${settlement?.opponentName}`
                : 'All Square');

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            <SEO title="Final Ledger" />
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
                        {isGroupMode
                            ? `${activeMatchIds.length} Matches • ${match?.wagerType}`
                            : match?.format === 'skins'
                                ? `Skins Game • $${match.wagerAmount}/skin • ${players.length} players`
                                : `${match?.format} • $${match?.wagerAmount} ${match?.wagerType}: ${settlement?.opponentName ?? '…'}`
                        }
                    </p>
                </section>

                {/* ── Attestation Banner ────────────────────────── */}
                {isPendingAttestation && (
                    <section className="animate-in slide-in-from-top-4 fade-in duration-500">
                        <Card className="p-4 border-borderColor bg-surface space-y-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
                                <span className="font-bold text-white text-sm uppercase tracking-wider">Awaiting Attestation</span>
                                <span className="ml-auto text-xs text-secondaryText">1 player needed</span>
                            </div>
                            <div className="space-y-2">
                                {players.filter((p) => !p.guestName).map((p) => {
                                    const hasAttested = attestations.some((a) => a.userId === p.userId);
                                    const isScorekeeper = p.userId === match?.createdBy;
                                    const name = p.guestName ?? attestPlayerNames[p.userId] ?? 'Player';
                                    const firstName = name.split(' ')[0];
                                    return (
                                        <div key={p.userId} className="flex items-center gap-3">
                                            {hasAttested || isScorekeeper
                                                ? <CheckCircle2 className="w-4 h-4 text-neonGreen shrink-0" />
                                                : <Clock className="w-4 h-4 text-secondaryText shrink-0" />
                                            }
                                            <span className="text-sm text-white flex-1">
                                                {firstName}
                                                {isScorekeeper && <span className="text-secondaryText text-xs ml-1">(scorekeeper)</span>}
                                                {hasAttested && !isScorekeeper && <span className="text-neonGreen text-xs ml-1">attested</span>}
                                            </span>
                                            {/* Remind button: visible to scorekeeper for un-attested players */}
                                            {!hasAttested && !isScorekeeper && user?.id === match?.createdBy && (
                                                <button
                                                    onClick={() => {
                                                        sendReminder(matchId!, p.userId);
                                                        setReminderSent((prev) => new Set(prev).add(p.userId));
                                                    }}
                                                    className="flex items-center gap-1 text-xs text-secondaryText hover:text-white transition-colors"
                                                >
                                                    <Bell className="w-3 h-3" />
                                                    {reminderSent.has(p.userId) ? 'Sent!' : 'Remind'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Attest button: visible to non-scorekeeper who hasn't attested */}
                            {user?.id !== match?.createdBy &&
                                !attestations.some((a) => a.userId === user?.id) && (
                                    <Button
                                        size="sm"
                                        className="w-full mt-1"
                                        disabled={attesting}
                                        onClick={async () => {
                                            setAttesting(true);
                                            await attestMatch(matchId!);
                                            setAttesting(false);
                                        }}
                                    >
                                        {attesting ? 'Attesting…' : 'Attest Scores'}
                                    </Button>
                                )}
                        </Card>
                    </section>
                )}

                {/* ── Group Mode: per-match breakdown + net total ── */}
                {isGroupMode && groupSettlements.length > 0 && (
                    <section className="space-y-4 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-200">
                        {groupSettlements.map((s, idx) => (
                            <div key={idx}>
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-sm font-bold text-secondaryText uppercase tracking-wider">
                                        {s.opponentName}
                                    </span>
                                    <span className={`text-sm font-black ${s.total > 0 ? 'text-neonGreen' : s.total < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                        {s.total > 0 ? '+' : ''}${s.total}
                                    </span>
                                </div>
                                <Card className="divide-y divide-borderColor/50 font-sans border-borderColor">
                                    {s.items.map((item, i) => (
                                        <div
                                            key={i}
                                            className={`p-3.5 flex items-center justify-between hover:bg-surfaceHover transition-colors ${item.isPress ? 'bg-bloodRed/5 border-l-2 border-l-bloodRed' : ''}`}
                                        >
                                            <div>
                                                <span className={`font-bold text-sm block ${item.isPress ? 'text-bloodRed' : 'text-white'}`}>{item.label}</span>
                                                <span className="text-xs text-secondaryText">{item.sublabel}</span>
                                            </div>
                                            <span className={`font-bold ${item.amount > 0 ? 'text-neonGreen' : item.amount < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                {item.amount > 0 ? '+' : ''}${item.amount}
                                            </span>
                                        </div>
                                    ))}
                                </Card>
                            </div>
                        ))}

                        {/* Net total across all matches */}
                        <Card className="p-5 flex items-center justify-between bg-surface border-borderColor">
                            <span className="font-bold tracking-wider uppercase text-white">Net Settlement</span>
                            <span className={`font-black text-2xl ${isWinner ? 'text-neonGreen' : total < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                {total > 0 ? '+' : ''}${total}
                            </span>
                        </Card>

                        {/* Send to Ledger / IOU Actions for Group */}
                        {groupSettlements.some(s => s.total !== 0 && s.opponentIds && s.opponentIds.length > 0) && user?.id === match?.createdBy && (
                            <div className="mt-4 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-300">
                                {hasExistingDebt ? (
                                    <div className="w-full bg-surface border border-borderColor text-white p-3 rounded-xl flex items-center justify-center gap-2 opacity-50">
                                        <CheckCircle2 className="w-5 h-5 text-neonGreen" />
                                        <span>Results recorded as historical payments</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            className="bg-surface border border-borderColor text-white hover:bg-surfaceHover shadow-xl flex items-center justify-center gap-2 text-xs py-5 px-1"
                                            onClick={async () => {
                                                setCreatingIOU(true);
                                                try {
                                                    for (const s of groupSettlements) {
                                                        if (s.total === 0 || !s.opponentIds || s.opponentIds.length === 0) continue;
                                                        const amountPerOpponent = Math.abs(s.total) / s.opponentIds.length;
                                                        for (const oppId of s.opponentIds) {
                                                            const debtorId = s.total < 0 ? user!.id : oppId;
                                                            const creditorId = s.total > 0 ? user!.id : oppId;
                                                            await createDebt(matchId!, debtorId, creditorId, amountPerOpponent);
                                                        }
                                                    }
                                                    alert('Debts successfully recorded in your balances.');
                                                    if (user?.id) loadDebts(user.id);
                                                } catch (e: any) {
                                                    alert(e.message || 'Failed to create IOU');
                                                } finally {
                                                    setCreatingIOU(false);
                                                }
                                            }}
                                            disabled={creatingIOU}
                                        >
                                            <Receipt className="w-4 h-4 text-secondaryText" />
                                            {creatingIOU ? 'Adding...' : 'Unpaid (IOU)'}
                                        </Button>

                                        <Button
                                            className="bg-neonGreen/10 border border-neonGreen/30 text-neonGreen hover:bg-neonGreen/20 shadow-xl flex items-center justify-center gap-2 text-xs py-5 px-1 transition-all group"
                                            onClick={async () => {
                                                setCreatingIOU(true);
                                                try {
                                                    for (const s of groupSettlements) {
                                                        if (s.total === 0 || !s.opponentIds || s.opponentIds.length === 0) continue;
                                                        const amountPerOpponent = Math.abs(s.total) / s.opponentIds.length;
                                                        for (const oppId of s.opponentIds) {
                                                            const debtorId = s.total < 0 ? user!.id : oppId;
                                                            const creditorId = s.total > 0 ? user!.id : oppId;
                                                            await settleImmediately(matchId!, debtorId, creditorId, amountPerOpponent);
                                                        }
                                                    }
                                                    alert('Settlement recorded. Payment history updated.');
                                                    if (user?.id) loadDebts(user.id);
                                                } catch (e: any) {
                                                    alert(e.message || 'Failed to settle');
                                                } finally {
                                                    setCreatingIOU(false);
                                                }
                                            }}
                                            disabled={creatingIOU}
                                        >
                                            <Banknote className="w-4 h-4 text-neonGreen group-hover:scale-110 transition-transform" />
                                            {creatingIOU ? 'Saving...' : 'Settle Now (Cash)'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}

                {/* ── Single-match breakdown ────────────────── */}
                {!isGroupMode && settlement && (
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

                        {/* Send to Ledger / IOU Actions */}
                        {total !== 0 && settlement.opponentIds.length > 0 && user?.id === match?.createdBy && (
                            <div className="mt-4 animate-in slide-in-from-bottom-2 fade-in duration-500 delay-300">
                                {hasExistingDebt ? (
                                    <div className="w-full bg-surface border border-borderColor text-white p-3 rounded-xl flex items-center justify-center gap-2 opacity-50">
                                        <CheckCircle2 className="w-5 h-5 text-neonGreen" />
                                        <span>Results recorded as historical payments</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            className="bg-surface border border-borderColor text-white hover:bg-surfaceHover shadow-xl flex items-center justify-center gap-2 text-xs py-5"
                                            onClick={async () => {
                                                setCreatingIOU(true);
                                                try {
                                                    const amountPerOpponent = Math.abs(total) / settlement.opponentIds.length;
                                                    for (const oppId of settlement.opponentIds) {
                                                        const debtorId = total < 0 ? user!.id : oppId;
                                                        const creditorId = total > 0 ? user!.id : oppId;
                                                        await createDebt(matchId!, debtorId, creditorId, amountPerOpponent);
                                                    }
                                                    alert('Debts successfully recorded in your balances.');
                                                    if (user?.id) loadDebts(user.id);
                                                } catch (e: any) {
                                                    alert(e.message || 'Failed to create IOU');
                                                } finally {
                                                    setCreatingIOU(false);
                                                }
                                            }}
                                            disabled={creatingIOU}
                                        >
                                            <Receipt className="w-4 h-4 text-secondaryText" />
                                            {creatingIOU ? 'Adding...' : 'Unpaid (IOU)'}
                                        </Button>

                                        <Button
                                            className="bg-neonGreen/10 border border-neonGreen/30 text-neonGreen hover:bg-neonGreen/20 shadow-xl flex items-center justify-center gap-2 text-xs py-5 transition-all group"
                                            onClick={async () => {
                                                setCreatingIOU(true);
                                                try {
                                                    const amountPerOpponent = Math.abs(total) / settlement.opponentIds.length;
                                                    for (const oppId of settlement.opponentIds) {
                                                        const debtorId = total < 0 ? user!.id : oppId;
                                                        const creditorId = total > 0 ? user!.id : oppId;
                                                        await settleImmediately(matchId!, debtorId, creditorId, amountPerOpponent);
                                                    }
                                                    alert('Settlement recorded. Payment history updated.');
                                                    if (user?.id) loadDebts(user.id);
                                                } catch (e: any) {
                                                    alert(e.message || 'Failed to settle');
                                                } finally {
                                                    setCreatingIOU(false);
                                                }
                                            }}
                                            disabled={creatingIOU}
                                        >
                                            <Banknote className="w-4 h-4 text-neonGreen group-hover:scale-110 transition-transform" />
                                            {creatingIOU ? 'Saving...' : 'Settle Now (Cash)'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* Stationary Footer */}
            <footer className="p-4 bg-background border-t border-borderColor shrink-0 pb-safe">
                <Button size="lg" className="w-full font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,63,0.4)]" onClick={() => {
                    navigate('/dashboard');
                    setTimeout(() => useMatchStore.getState().clearMatch(), 100);
                }}>
                    Finish & Return to Dashboard
                </Button>
            </footer>
        </div>
    );
}
