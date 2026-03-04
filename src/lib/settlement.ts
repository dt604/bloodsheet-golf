import { supabase } from './supabase';
import { Match, MatchPlayer, HoleScore } from '../types';

export async function autoSettleBloodCoins(
    match: Match,
    players: MatchPlayer[],
    scores: HoleScore[],
    groupSettlements?: any[],
    groupState?: any
) {
    if (match.bloodCoinsSettled) return;
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    console.log(`[AutoSettle] Checking match ${match.id} (Status: ${match.status})`);

    try {
        if (match.groupId && groupState) {
            console.log(`[AutoSettle] Processing Group Mode matches...`);
            for (const entry of groupState.matches) {
                const subMatch = entry.match;
                if (subMatch.bloodCoinsSettled || !subMatch.bloodCoinWager) continue;

                const p1 = entry.players[0];
                const p2 = entry.players[1];

                let myPts = 0, oppPts = 0;
                for (let h = 1; h <= 18; h++) {
                    const myS = entry.scores.find((s: HoleScore) => s.holeNumber === h && s.playerId === p1.userId)?.net;
                    const oppS = entry.scores.find((s: HoleScore) => s.holeNumber === h && s.playerId === p2.userId)?.net;
                    if (myS == null || oppS == null) continue;
                    if (myS < oppS) myPts++;
                    else if (oppS < myS) oppPts++;
                }

                let amt = 0;
                const bcWager = Number(subMatch.bloodCoinWager);
                if (subMatch.wagerType === 'NASSAU') {
                    const score9 = (holes: number[]) => {
                        let m = 0, o = 0;
                        holes.forEach(h => {
                            const ms = entry.scores.find((s: HoleScore) => s.holeNumber === h && s.playerId === p1.userId)?.net;
                            const os = entry.scores.find((s: HoleScore) => s.holeNumber === h && s.playerId === p2.userId)?.net;
                            if (ms != null && os != null) { if (ms < os) m++; else if (os < ms) o++; }
                        });
                        if (m > o) return bcWager;
                        if (o > m) return -bcWager;
                        return 0;
                    };
                    const front9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    const back9 = [10, 11, 12, 13, 14, 15, 16, 17, 18];
                    const allHolesPlayed = entry.scores.map((s: HoleScore) => s.holeNumber);
                    if (front9.every(h => allHolesPlayed.includes(h))) amt += score9(front9);
                    if (back9.every(h => allHolesPlayed.includes(h))) amt += score9(back9);
                    if (allHolesPlayed.length >= 18) amt += score9([...front9, ...back9]);
                } else {
                    amt = (myPts - oppPts) * bcWager;
                }

                if (amt !== 0) {
                    const payouts = [];
                    if (!p1.guestName) payouts.push({ userId: p1.userId, amount: amt });
                    if (!p2.guestName) payouts.push({ userId: p2.userId, amount: -amt });

                    if (payouts.length === 2) {
                        console.log(`[AutoSettle] Submatch ${subMatch.id} results: ${amt} BC`);
                        await supabase.rpc('settle_match_blood_coins', { match_id: subMatch.id, payouts });
                    }
                }
            }
        } else {
            if (!match.bloodCoinWager || Number(match.bloodCoinWager) === 0) {
                console.log(`[AutoSettle] No BC wager found for match ${match.id}`);
                return;
            }

            const bcWager = Number(match.bloodCoinWager);
            const payouts: { userId: string, amount: number }[] = [];

            if (match.format === '1v1' || match.format === '2v2') {
                const teamA = players.filter(p => p.team === 'A');
                const teamB = players.filter(p => p.team === 'B');
                const realTeamA = teamA.filter(p => !p.guestName).map(p => p.userId);
                const realTeamB = teamB.filter(p => !p.guestName).map(p => p.userId);

                // For perfectly balanced payout, we need real users on both sides
                if (realTeamA.length === 0 || realTeamB.length === 0) {
                    console.log(`[AutoSettle] Skipping match ${match.id}: Both teams must have real users for zero-sum settlement.`);
                    return;
                }

                let aPts = 0, bPts = 0;
                for (let h = 1; h <= 18; h++) {
                    const aHoleScores = scores.filter(s => s.holeNumber === h && teamA.some(p => p.userId === s.playerId));
                    const bHoleScores = scores.filter(s => s.holeNumber === h && teamB.some(p => p.userId === s.playerId));
                    if (aHoleScores.length === 0 || bHoleScores.length === 0) continue;
                    const aNet = Math.min(...aHoleScores.map(s => s.net));
                    const bNet = Math.min(...bHoleScores.map(s => s.net));
                    if (aNet < bNet) aPts++;
                    else if (bNet < aNet) bPts++;
                }

                let amt = 0;
                if (match.wagerType === 'NASSAU') {
                    const score9 = (holes: number[]) => {
                        let a = 0, b = 0;
                        holes.forEach(h => {
                            const as = scores.filter(s => s.holeNumber === h && teamA.some(p => p.userId === s.playerId));
                            const bs = scores.filter(s => s.holeNumber === h && teamB.some(p => p.userId === s.playerId));
                            if (as.length > 0 && bs.length > 0) {
                                const an = Math.min(...as.map(x => x.net));
                                const bn = Math.min(...bs.map(x => x.net));
                                if (an < bn) a++; else if (bn < an) b++;
                            }
                        });
                        if (a > b) return bcWager;
                        if (b > a) return -bcWager;
                        return 0;
                    };
                    const f9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    const b9 = [10, 11, 12, 13, 14, 15, 16, 17, 18];
                    const played = [...new Set(scores.map(s => s.holeNumber))];
                    if (f9.every(h => played.includes(h))) amt += score9(f9);
                    if (b9.every(h => played.includes(h))) amt += score9(b9);
                    if (played.length >= 18) amt += score9([...f9, ...b9]);
                } else {
                    amt = (aPts - bPts) * bcWager;
                }

                console.log(`[AutoSettle] Settlement Calculation: TeamA pts ${aPts} - TeamB pts ${bPts} = ${amt} BC`);
                if (amt !== 0) {
                    realTeamA.forEach(id => payouts.push({ userId: id, amount: amt }));
                    realTeamB.forEach(id => payouts.push({ userId: id, amount: -amt }));
                }
            } else if (match.format === 'skins') {
                const numPlayers = players.length;
                const isTeamSkins = match.sideBets?.teamSkins ?? false;
                const isPotMode = match.sideBets?.potMode ?? false;
                const skinCounts: Record<string, number> = {};
                let carry = 0;

                for (let h = 1; h <= 18; h++) {
                    const hScores = scores.filter(s => s.holeNumber === h);
                    if (hScores.length < numPlayers) continue;
                    const holesInPot = 1 + carry;
                    if (isTeamSkins) {
                        const aHoles = hScores.filter(s => players.find(p => p.userId === s.playerId)?.team === 'A');
                        const bHoles = hScores.filter(s => players.find(p => p.userId === s.playerId)?.team === 'B');
                        if (aHoles.length > 0 && bHoles.length > 0) {
                            const aNet = Math.min(...aHoles.map(s => s.net));
                            const bNet = Math.min(...bHoles.map(s => s.net));
                            if (aNet !== bNet) {
                                const winTeam = aNet < bNet ? 'A' : 'B';
                                hScores.filter(s => players.find(p => p.userId === s.playerId)?.team === winTeam).forEach(s => {
                                    skinCounts[s.playerId] = (skinCounts[s.playerId] ?? 0) + holesInPot;
                                });
                                carry = 0;
                            } else carry++;
                        }
                    } else {
                        const minNet = Math.min(...hScores.map(s => s.net));
                        const winners = hScores.filter(s => s.net === minNet);
                        if (winners.length === 1) {
                            skinCounts[winners[0].playerId] = (skinCounts[winners[0].playerId] ?? 0) + holesInPot;
                            carry = 0;
                        } else carry++;
                    }
                }

                if (isPotMode) {
                    const potBC = bcWager * numPlayers;
                    const skinValues = Object.values(skinCounts);
                    const maxSkins = skinValues.length > 0 ? Math.max(...skinValues) : 0;
                    const potWinners = maxSkins > 0 ? Object.keys(skinCounts).filter(id => skinCounts[id] === maxSkins) : [];
                    const share = potWinners.length > 1 ? Math.floor(potBC / potWinners.length) : potBC;
                    players.forEach(p => {
                        if (!p.guestName) {
                            const a = potWinners.includes(p.userId) ? share - bcWager : -bcWager;
                            payouts.push({ userId: p.userId, amount: a });
                        }
                    });
                } else {
                    let carry2 = 0;
                    const map: Record<string, number> = {};
                    players.forEach(p => map[p.userId] = 0);

                    for (let h = 1; h <= 18; h++) {
                        const hScores = scores.filter(s => s.holeNumber === h);
                        if (hScores.length < numPlayers) continue;
                        const holesInPot = 1 + carry2;
                        const pv = holesInPot * bcWager;

                        if (isTeamSkins) {
                            const aH = hScores.filter(s => players.find(p => p.userId === s.playerId)?.team === 'A');
                            const bH = hScores.filter(s => players.find(p => p.userId === s.playerId)?.team === 'B');
                            if (aH.length > 0 && bH.length > 0) {
                                const aNet = Math.min(...aH.map(s => s.net));
                                const bNet = Math.min(...bH.map(s => s.net));
                                if (aNet !== bNet) {
                                    const winTeam = aNet < bNet ? 'A' : 'B';
                                    hScores.forEach(s => {
                                        const t = players.find(p => p.userId === s.playerId)?.team;
                                        if (t === winTeam) map[s.playerId] += pv * hScores.filter(x => players.find(p => p.userId === x.playerId)?.team !== winTeam).length;
                                        else map[s.playerId] -= pv * hScores.filter(x => players.find(p => p.userId === x.playerId)?.team === winTeam).length;
                                    });
                                    carry2 = 0;
                                } else carry2++;
                            }
                        } else {
                            const minNet = Math.min(...hScores.map(s => s.net));
                            const winners = hScores.filter(s => s.net === minNet);
                            if (winners.length === 1) {
                                hScores.forEach(s => {
                                    map[s.playerId] += s.playerId === winners[0].playerId ? pv * (numPlayers - 1) : -pv;
                                });
                                carry2 = 0;
                            } else carry2++;
                        }
                    }
                    Object.entries(map).forEach(([uid, amt]) => {
                        if (!players.find(p => p.userId === uid)?.guestName) {
                            payouts.push({ userId: uid, amount: amt });
                        }
                    });
                }
            }

            if (payouts.length > 1) {
                const sum = payouts.reduce((a, b) => a + Number(b.amount), 0);
                if (Math.abs(sum) < 0.1) {
                    console.log(`[AutoSettle] Sending ${payouts.length} payouts to RPC...`);
                    const { data, error } = await supabase.rpc('settle_match_blood_coins', { match_id: match.id, payouts });
                    if (error) console.error("[AutoSettle] RPC Error:", error);
                    else console.log("[AutoSettle] Settlement successful:", data);
                } else {
                    console.warn(`[AutoSettle] Sum mismatch: ${sum}. Settle aborted to prevent wallet corruption.`);
                }
            } else {
                console.log(`[AutoSettle] No payouts generated for match ${match.id}`);
            }
        }
    } catch (err) {
        console.error("[AutoSettle] Crashed:", err);
    }
}
