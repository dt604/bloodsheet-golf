import { Course } from '../types';

/**
 * Calculates net score for a hole based on gross score, adjusted handicap, and hole stroke index.
 */
export function calcNet(gross: number, adjustedHandicap: number, strokeIndex: number): number {
    if (adjustedHandicap <= 0) return gross;
    const fullStrokes = Math.floor(adjustedHandicap / 18);
    const extra = (adjustedHandicap % 18) >= strokeIndex ? 1 : 0;
    return gross - fullStrokes - extra;
}

/**
 * Returns stroke differential from Team A's perspective.
 * Negative = Team A leads (has fewer strokes).
 */
export function calcStrokeDiff(
    teamAIds: string[],
    teamBIds: string[],
    scores: { holeNumber: number; playerId: string; net: number; adjustedNet?: number }[],
    startHole: number = 1,
    endHole: number = 18
): { aDiff: number; holesPlayed: number } {
    let aTotal = 0, bTotal = 0, holesPlayed = 0;
    const holes = [...new Set(scores.map(s => s.holeNumber))].filter(h => h >= startHole && h <= endHole);
    for (const h of holes) {
        const aScore = scores.find(s => teamAIds.includes(s.playerId) && s.holeNumber === h);
        const bScore = scores.find(s => teamBIds.includes(s.playerId) && s.holeNumber === h);
        if (!aScore || !bScore) continue;
        aTotal += aScore.adjustedNet ?? aScore.net;
        bTotal += bScore.adjustedNet ?? bScore.net;
        holesPlayed++;
    }
    return { aDiff: aTotal - bTotal, holesPlayed };
}

/**
 * Returns holesUp from Team A's perspective (positive = Team A leads).
 */
export function calcHolesUp(
    teamAIds: string[],
    teamBIds: string[],
    scores: { holeNumber: number; playerId: string; gross?: number; net: number; adjustedNet?: number; trashDots?: string[] }[],
    format: '1v1' | '2v2',
    course: Course | null = null,
    birdiesDouble?: boolean,
    sideBets?: { greenies?: boolean },
    teamHandicapDiff?: { diff: number; spottedTeam: 'A' | 'B' | null }
): number {
    const holes = [...new Set(scores.map((s) => s.holeNumber))];
    let aWins = 0, bWins = 0;
    for (const hole of holes) {
        const par = course?.holes?.find((h) => h.number === hole)?.par ?? 4;
        const aScores = scores.filter((s) => teamAIds.includes(s.playerId) && s.holeNumber === hole);
        const bScores = scores.filter((s) => teamBIds.includes(s.playerId) && s.holeNumber === hole);

        if (aScores.length === 0 || bScores.length === 0) continue;

        const aNets = aScores.map((s) => s.adjustedNet ?? s.net);
        const bNets = bScores.map((s) => s.adjustedNet ?? s.net);

        if (format === '2v2') {
            const aNetsAdj = [...aNets];
            const bNetsAdj = [...bNets];
            if (teamHandicapDiff && teamHandicapDiff.spottedTeam) {
                const holeStrokeIdx = course?.holes?.find((h) => h.number === hole)?.strokeIndex ?? 18;
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

            if (birdiesDouble) {
                aWins += aScores.filter(s => s.gross !== undefined && s.gross < par).length;
                bWins += bScores.filter(s => s.gross !== undefined && s.gross < par).length;
            }

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

/**
 * Returns breakdown of front 9, back 9, and overall match play standings.
 */
export function calcMatchPlaySplits(
    teamAIds: string[],
    teamBIds: string[],
    scores: { holeNumber: number; playerId: string; gross?: number; net: number; adjustedNet?: number; trashDots?: string[] }[],
    format: '1v1' | '2v2',
    course: Course | null = null,
    birdiesDouble?: boolean,
    sideBets?: { greenies?: boolean },
    teamHandicapDiff?: { diff: number; spottedTeam: 'A' | 'B' | null }
) {
    const stats = {
        front9: { aWins: 0, bWins: 0, holesPlayed: 0 },
        back9: { aWins: 0, bWins: 0, holesPlayed: 0 },
        overall: { aWins: 0, bWins: 0, holesPlayed: 0 }
    };

    const holeNumbers = [...new Set(scores.map((s) => s.holeNumber))].sort((a, b) => a - b);

    for (const hole of holeNumbers) {
        const isFront = hole <= 9;
        const segment = isFront ? stats.front9 : stats.back9;
        const par = course?.holes?.find((h) => h.number === hole)?.par ?? 4;
        const aScores = scores.filter((s) => teamAIds.includes(s.playerId) && s.holeNumber === hole);
        const bScores = scores.filter((s) => teamBIds.includes(s.playerId) && s.holeNumber === hole);

        if (aScores.length === 0 || bScores.length === 0) continue;

        const aNets = aScores.map((s) => s.adjustedNet ?? s.net);
        const bNets = bScores.map((s) => s.adjustedNet ?? s.net);

        let holeAWins = 0;
        let holeBWins = 0;

        if (format === '2v2') {
            const aNetsAdj = [...aNets];
            const bNetsAdj = [...bNets];
            if (teamHandicapDiff && teamHandicapDiff.spottedTeam) {
                const holeStrokeIdx = course?.holes?.find((h) => h.number === hole)?.strokeIndex ?? 18;
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

            if (birdiesDouble) {
                holeAWins += aScores.filter(s => s.gross !== undefined && s.gross < par).length;
                holeBWins += bScores.filter(s => s.gross !== undefined && s.gross < par).length;
            }
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

export function calcSkinsStandings(
    players: { userId: string; team?: 'A' | 'B' }[],
    scores: { holeNumber: number; playerId: string; net: number; gross?: number; trashDots?: string[] }[],
    skinValue: number,
    sideBets?: { bonusSkins?: boolean; teamSkins?: boolean; potMode?: boolean },
    course?: any
) {
    const numPlayers = players.length;
    const isTeamSkins = sideBets?.teamSkins ?? false;
    const isPotMode = sideBets?.potMode ?? false;
    let carry = 0;
    const earned: Record<string, number> = {};
    const skinsWon: Record<string, number> = {};
    const holeResults: { hole: number; winnerId: string | null; winTeam?: 'A' | 'B' | null; holesInPot: number; pot: number }[] = [];

    function playerTeam(playerId: string): 'A' | 'B' {
        return players.find(p => p.userId === playerId)?.team ?? 'A';
    }

    for (let h = 1; h <= 18; h++) {
        const hScores = scores.filter(s => s.holeNumber === h);
        if (hScores.length < numPlayers) continue;
        const holesInPot = 1 + carry;
        const potPerPlayer = holesInPot * skinValue;

        if (isTeamSkins) {
            const teamAScores = hScores.filter(s => playerTeam(s.playerId) === 'A');
            const teamBScores = hScores.filter(s => playerTeam(s.playerId) === 'B');
            if (teamAScores.length === 0 || teamBScores.length === 0) continue;
            const teamANet = Math.min(...teamAScores.map(s => s.net));
            const teamBNet = Math.min(...teamBScores.map(s => s.net));

            if (teamANet !== teamBNet) {
                const winTeam: 'A' | 'B' = teamANet < teamBNet ? 'A' : 'B';
                const loseTeam: 'A' | 'B' = winTeam === 'A' ? 'B' : 'A';
                const winPlayers = hScores.filter(s => playerTeam(s.playerId) === winTeam);
                const losePlayers = hScores.filter(s => playerTeam(s.playerId) === loseTeam);
                const numWin = winPlayers.length;
                const numLose = losePlayers.length;
                for (const w of winPlayers) {
                    earned[w.playerId] = (earned[w.playerId] ?? 0) + (potPerPlayer * numLose) / (numWin || 1);
                    skinsWon[w.playerId] = (skinsWon[w.playerId] ?? 0) + holesInPot;
                }
                for (const l of losePlayers) {
                    earned[l.playerId] = (earned[l.playerId] ?? 0) - (potPerPlayer * numWin) / (numLose || 1);
                }
                holeResults.push({ hole: h, winnerId: null, winTeam, holesInPot, pot: potPerPlayer * numPlayers });
                carry = 0;
            } else {
                holeResults.push({ hole: h, winnerId: null, winTeam: null, holesInPot, pot: potPerPlayer * numPlayers });
                carry += 1;
            }
        } else {
            const minNet = Math.min(...hScores.map(s => s.net));
            const winners = hScores.filter(s => s.net === minNet);
            if (winners.length === 1) {
                const wId = winners[0].playerId;
                earned[wId] = (earned[wId] ?? 0) + potPerPlayer * (numPlayers - 1);
                hScores.filter(s => s.playerId !== wId).forEach(s => {
                    earned[s.playerId] = (earned[s.playerId] ?? 0) - potPerPlayer;
                });
                skinsWon[wId] = (skinsWon[wId] ?? 0) + holesInPot;
                holeResults.push({ hole: h, winnerId: wId, holesInPot, pot: potPerPlayer * numPlayers });
                carry = 0;
            } else {
                holeResults.push({ hole: h, winnerId: null, holesInPot, pot: potPerPlayer * numPlayers });
                carry += 1;
            }
        }
    }

    if (sideBets?.bonusSkins) {
        for (let h = 1; h <= 18; h++) {
            const hScores = scores.filter(s => s.holeNumber === h);
            if (hScores.length < numPlayers) continue;
            const par = course?.holes?.find((hole: any) => hole.number === h)?.par ?? 4;
            for (const s of hScores) {
                const pinBonus = s.trashDots?.includes('pin') ? 1 : 0;
                const birdieBonus = s.gross === par - 1 ? 1 : 0;
                const eagleBonus = s.gross !== undefined && s.gross <= par - 2 ? 2 : 0;
                const bonusCount = pinBonus + birdieBonus + eagleBonus;
                if (bonusCount === 0) continue;
                const sTeam = playerTeam(s.playerId);
                const oppPlayers = hScores.filter(x => playerTeam(x.playerId) !== sTeam);
                const numOpponents = oppPlayers.length;

                earned[s.playerId] = (earned[s.playerId] ?? 0) + bonusCount * skinValue * numOpponents;
                oppPlayers.forEach(x => {
                    earned[x.playerId] = (earned[x.playerId] ?? 0) - bonusCount * skinValue;
                });
                skinsWon[s.playerId] = (skinsWon[s.playerId] ?? 0) + bonusCount;
            }
        }
    }

    let potWinnerLabel: string | null = null;
    if (isPotMode) {
        const pot = skinValue * numPlayers;
        const maxSkins = Math.max(0, ...Object.values(skinsWon));
        const potWinnerIds = maxSkins > 0 ? players.filter(p => (skinsWon[p.userId] ?? 0) === maxSkins).map(p => p.userId) : [];
        const isTie = potWinnerIds.length > 1;
        const potShare = isTie ? pot / potWinnerIds.length : pot;
        for (const p of players) {
            const isWinner = potWinnerIds.includes(p.userId);
            earned[p.userId] = isWinner ? potShare - skinValue : -skinValue;
        }
        potWinnerLabel = potWinnerIds.length === 0 ? null : isTie ? 'Tied' : potWinnerIds[0];
    }

    return { earned, skinsWon, holeResults, currentCarry: carry, currentPot: (1 + carry) * skinValue, potWinnerLabel, isPotMode };
}

/**
 * Convenience wrapper for calcSkinsStandings to return only the earned amounts.
 */
export function calcSkinsPayouts(
    match: { bloodCoinWager: number; sideBets?: { bonusSkins?: boolean; teamSkins?: boolean; potMode?: boolean } },
    players: { userId: string; team?: 'A' | 'B' }[],
    scores: { holeNumber: number; playerId: string; net: number; gross?: number; trashDots?: string[] }[]
): Record<string, number> {
    const standings = calcSkinsStandings(players, scores, match.bloodCoinWager, match.sideBets);
    return standings.earned;
}

export function calcStrokePlay(
    teamAIds: string[],
    teamBIds: string[],
    scores: { holeNumber: number; playerId: string; net: number; adjustedNet?: number }[]
) {
    const stats = {
        front9: { aDiff: 0, holesPlayed: 0 },
        back9: { aDiff: 0, holesPlayed: 0 },
        overall: { aDiff: 0, holesPlayed: 0 }
    };
    const holes = [...new Set(scores.map(s => s.holeNumber))].sort((a, b) => a - b);
    for (const hole of holes) {
        const aScore = scores.find(s => teamAIds.includes(s.playerId) && s.holeNumber === hole);
        const bScore = scores.find(s => teamBIds.includes(s.playerId) && s.holeNumber === hole);
        if (!aScore || !bScore) continue;
        const aN = aScore.adjustedNet ?? aScore.net;
        const bN = bScore.adjustedNet ?? bScore.net;
        const diff = aN - bN;
        const seg = hole <= 9 ? stats.front9 : stats.back9;
        seg.aDiff += diff;
        seg.holesPlayed++;
        stats.overall.aDiff += diff;
        stats.overall.holesPlayed++;
    }
    return {
        overall: { holesUp: stats.overall.aDiff, holesPlayed: stats.overall.holesPlayed },
        front9: { holesUp: stats.front9.aDiff, holesPlayed: stats.front9.holesPlayed },
        back9: { holesUp: stats.back9.aDiff, holesPlayed: stats.back9.holesPlayed }
    };
}
/**
 * Calculates Nassau points (Front, Back, Total) for a 1v1 or 2v2 match.
 */
export function calcNassauPoints(
    scores: { holeNumber: number; playerId: string; net: number }[],
    teamAIds: string[],
    teamBIds: string[],
    holes: number[]
): number {
    let aWins = 0, bWins = 0;
    for (const h of holes) {
        const aHole = scores.filter(s => s.holeNumber === h && teamAIds.includes(s.playerId));
        const bHole = scores.filter(s => s.holeNumber === h && teamBIds.includes(s.playerId));
        if (aHole.length === 0 || bHole.length === 0) continue;

        const aNet = Math.min(...aHole.map(s => s.net));
        const bNet = Math.min(...bHole.map(s => s.net));

        if (aNet < bNet) aWins++;
        else if (bNet < aNet) bWins++;
    }
    if (aWins > bWins) return 1;
    if (bWins > aWins) return -1;
    return 0;
}
