import { supabase } from './supabase';
import { Match, MatchPlayer, HoleScore } from '../types';
import { calcNassauPoints, calcSkinsPayouts } from './golf-engine';

export async function autoSettleBloodCoins(
    match: Match,
    players: MatchPlayer[],
    scores: HoleScore[],
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
                    const front9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    const back9 = [10, 11, 12, 13, 14, 15, 16, 17, 18];
                    const allHolesPlayed = entry.scores.map((s: HoleScore) => s.holeNumber);

                    if (front9.every(h => allHolesPlayed.includes(h))) {
                        amt += calcNassauPoints(entry.scores, [p1.userId], [p2.userId], front9) * bcWager;
                    }
                    if (back9.every(h => allHolesPlayed.includes(h))) {
                        amt += calcNassauPoints(entry.scores, [p1.userId], [p2.userId], back9) * bcWager;
                    }
                    if (allHolesPlayed.length >= 18) {
                        amt += calcNassauPoints(entry.scores, [p1.userId], [p2.userId], [...front9, ...back9]) * bcWager;
                    }
                } else {
                    let myPts = 0, oppPts = 0;
                    for (let h = 1; h <= 18; h++) {
                        const myS = entry.scores.find((s: HoleScore) => s.holeNumber === h && s.playerId === p1.userId)?.net;
                        const oppS = entry.scores.find((s: HoleScore) => s.holeNumber === h && s.playerId === p2.userId)?.net;
                        if (myS == null || oppS == null) continue;
                        if (myS < oppS) myPts++;
                        else if (oppS < myS) oppPts++;
                    }
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
                    const f9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    const b9 = [10, 11, 12, 13, 14, 15, 16, 17, 18];
                    const played = [...new Set(scores.map(s => s.holeNumber))];

                    if (f9.every(h => played.includes(h))) {
                        amt += calcNassauPoints(scores, realTeamA, realTeamB, f9) * bcWager;
                    }
                    if (b9.every(h => played.includes(h))) {
                        amt += calcNassauPoints(scores, realTeamA, realTeamB, b9) * bcWager;
                    }
                    if (played.length >= 18) {
                        amt += calcNassauPoints(scores, realTeamA, realTeamB, [...f9, ...b9]) * bcWager;
                    }
                } else {
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
                    amt = (aPts - bPts) * bcWager;
                }

                console.log(`[AutoSettle] Settlement Calculation: TeamA pts ${amt / bcWager} (scaled) = ${amt} BC`);
                if (amt !== 0) {
                    realTeamA.forEach(id => payouts.push({ userId: id, amount: amt }));
                    realTeamB.forEach(id => payouts.push({ userId: id, amount: -amt }));
                }
                const skinPayouts = calcSkinsPayouts({ ...match, bloodCoinWager: bcWager }, players, scores);
                Object.entries(skinPayouts).forEach(([uid, amt]) => {
                    const p = players.find(x => x.userId === uid);
                    if (p && !p.guestName) {
                        payouts.push({ userId: uid, amount: amt });
                    }
                });
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
