import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { History, PenLine, Clock, Camera, Loader, Check, X, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { StatBox } from '../components/ui/StatBox';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useMatchStore } from '../store/useMatchStore';
import SEO from '../components/SEO';
import { useUIStore } from '../store/useUIStore';
import { RecentMedia } from '../components/dashboard/RecentMedia';
import { startDashboardTour } from '../lib/tour';
import { COUNTRIES } from '../constants/countries';

// Import avatars
import juniorAvatar from '../assets/avatars/junior.png';
import oldFemaleAvatar from '../assets/avatars/old_female.png';
import oldMaleAvatar from '../assets/avatars/old_male.png';
import youngFemaleAvatar from '../assets/avatars/young_female.png';
import youngMaleAvatar from '../assets/avatars/young_male.png';

const AVATARS = [
    { id: 'old_male', url: oldMaleAvatar, label: 'Old Male' },
    { id: 'old_female', url: oldFemaleAvatar, label: 'Old Female' },
    { id: 'young_male', url: youngMaleAvatar, label: 'Young Male' },
    { id: 'young_female', url: youngFemaleAvatar, label: 'Young Female' },
    { id: 'junior', url: juniorAvatar, label: 'Junior' },
];

interface MatchHistoryItem {
    id: string;
    courseName: string;
    playerLabel: string;
    format: string;
    wagerType: string;
    createdAt: string;
    payout: number;
    holesUp: number;
    status: string;
}

interface PendingAttestItem {
    matchId: string;
    courseName: string;
}

interface Stats {
    totalMatches: number;
    wins: number;
    lifetimePayout: number;
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user, profile, updateProfile } = useAuth();
    const { hasSeenDashboardTour, setSeenDashboardTour } = useUIStore();

    useEffect(() => {
        if (!hasSeenDashboardTour) {
            const timer = setTimeout(() => {
                startDashboardTour(() => setSeenDashboardTour(true));
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [hasSeenDashboardTour, setSeenDashboardTour]);

    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [history, setHistory] = useState<MatchHistoryItem[]>([]);
    const [needsAttestation, setNeedsAttestation] = useState<PendingAttestItem[]>([]);
    const [stats, setStats] = useState<Stats>({
        totalMatches: 0,
        wins: 0,
        lifetimePayout: 0,
    });

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];
        setUploadingImage(true);

        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}-${Math.random()}.${fileExt}`;

        try {
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            await updateProfile({ avatarUrl: data.publicUrl });
            setShowAvatarPicker(false);
        } catch (error: any) {
            console.error('Error uploading avatar:', error.message);
            alert('Failed to upload image. Please try again.');
        } finally {
            setUploadingImage(false);
        }
    }

    async function handleSelectAvatar(url: string) {
        if (!user) return;
        setUploadingImage(true);
        setShowAvatarPicker(false);

        try {
            await updateProfile({ avatarUrl: url });
            setShowAvatarPicker(false);
        } catch (error: any) {
            console.error('Error selecting avatar:', error.message);
        } finally {
            setUploadingImage(false);
        }
    }

    useEffect(() => {
        if (!profile) return;

        async function load() {
            const userId = profile!.id;

            // 1. All match participations (for real total count + match IDs)
            const { data: userMatchPlayers } = await supabase
                .from('match_players')
                .select('match_id, team')
                .eq('user_id', userId);

            const allMatchIds = (userMatchPlayers ?? []).map((mp) => mp.match_id as string);

            // 1. Auto-Resume Check: Find the MOST RECENT active match (Build Trigger)
            // We join match_players with matches to find active rounds in a single shot
            const { data: activeJoin, error: activeError } = await supabase
                .from('match_players')
                .select('match_id, matches!inner(id, status, created_at, side_bets)')
                .eq('user_id', userId)
                .eq('matches.status', 'in_progress')
                .order('matches(created_at)', { ascending: false })
                .limit(1);

            if (activeError) console.error("Auto-Resume Query Error:", activeError);

            const activeMatchWrap = activeJoin?.[0] as any;
            const activeMatch = activeMatchWrap?.matches;

            if (activeMatch && activeMatch.id !== sessionStorage.getItem('dismissedMatchId')) {
                console.log("Auto-Resume: Found active match:", activeMatch.id);
                try {
                    await useMatchStore.getState().loadMatch(activeMatch.id);
                    const state = useMatchStore.getState();
                    const startHole = (activeMatch.side_bets as any)?.startingHole ?? 1;
                    const scoredHoles = state.scores.map(s => s.holeNumber);
                    const lastHole = scoredHoles.length > 0 ? Math.max(...scoredHoles) : startHole;

                    console.log(`Auto-Resume: Redirecting to Hole ${lastHole}`);
                    navigate(`/play/${lastHole}`);
                    return;
                } catch (e) {
                    console.error("Auto-Resume Load Error:", e);
                }
            }

            // 2. Recent match history for display (last 10) — includes pending_attestation
            let recentMatches: any[] = [];
            if (allMatchIds.length > 0) {
                const { data } = await supabase
                    .from('matches')
                    .select('id, format, wager_type, wager_amount, status, created_at, created_by, side_bets, courses(name)')
                    .in('id', allMatchIds)
                    .in('status', ['completed', 'pending_attestation', 'in_progress'])
                    .order('created_at', { ascending: false })
                    .limit(10);
                if (data) recentMatches = data;
            }

            // 2b. Find matches where user needs to attest (pending, not creator, not yet attested)
            const pendingMatchIds = recentMatches
                .filter((m) => (m as Record<string, unknown>).status === 'pending_attestation'
                    && (m as Record<string, unknown>).created_by !== userId)
                .map((m) => (m as Record<string, unknown>).id as string);

            if (pendingMatchIds.length > 0) {
                const { data: myAttestations } = await supabase
                    .from('match_attestations')
                    .select('match_id')
                    .eq('user_id', userId)
                    .in('match_id', pendingMatchIds);
                const alreadyAttested = new Set((myAttestations ?? []).map((a: any) => a.match_id as string));
                const unattested = recentMatches
                    .filter((m) => {
                        const row = m as Record<string, unknown>;
                        return pendingMatchIds.includes(row.id as string) && !alreadyAttested.has(row.id as string);
                    })
                    .map((m) => {
                        const row = m as Record<string, unknown>;
                        const course = row.courses as Record<string, unknown> | null;
                        return { matchId: row.id as string, courseName: course?.name as string ?? 'Unknown Course' };
                    });
                setNeedsAttestation(unattested);
            }

            if (recentMatches && recentMatches.length > 0) {
                const recentMatchIds = (recentMatches as Record<string, unknown>[]).map((m) => m.id as string);

                // Fetch all players for these recent matches
                let recentPlayers: any[] = [];
                if (recentMatchIds.length > 0) {
                    const { data } = await supabase
                        .from('match_players')
                        .select('match_id, user_id, team, guest_name')
                        .in('match_id', recentMatchIds);
                    if (data) recentPlayers = data;
                }

                // Fetch profile names for all non-guest players
                const playerUserIds = [...new Set(
                    recentPlayers.map((p) => (p as Record<string, unknown>).user_id as string).filter(Boolean)
                )];
                const profileNameMap: Record<string, string> = {};
                if (playerUserIds.length > 0) {
                    const { data: profilesData } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', playerUserIds);
                    for (const prof of (profilesData ?? []) as { id: string; full_name: string }[]) {
                        profileNameMap[prof.id] = prof.full_name;
                    }
                }

                const items: MatchHistoryItem[] = (recentMatches as Record<string, unknown>[]).map((m) => {
                    const matchId = m.id as string;
                    const matchPlayers = recentPlayers.filter(
                        (p) => (p as Record<string, unknown>).match_id === matchId
                    );
                    const myEntry = (userMatchPlayers ?? []).find((mp) => mp.match_id === matchId);
                    const myTeam = myEntry?.team as 'A' | 'B' | undefined;
                    const oppTeam: 'A' | 'B' | undefined = myTeam === 'A' ? 'B' : myTeam === 'B' ? 'A' : undefined;

                    function firstName(p: Record<string, unknown>): string {
                        if (p.guest_name) return (p.guest_name as string).split(' ')[0];
                        const fullName = profileNameMap[p.user_id as string] ?? 'Player';
                        return fullName.split(' ')[0];
                    }

                    let playerLabel = 'Match';
                    if (myTeam && oppTeam) {
                        const myNames = matchPlayers
                            .filter((p) => (p as Record<string, unknown>).team === myTeam)
                            .map((p) => firstName(p as Record<string, unknown>))
                            .join(' & ');
                        const oppPlayers = matchPlayers.filter((p) => (p as Record<string, unknown>).team === oppTeam);
                        if (oppPlayers.length > 0) {
                            const oppNames = oppPlayers.map((p) => firstName(p as Record<string, unknown>)).join(' & ');
                            playerLabel = `${myNames} vs ${oppNames}`;
                        } else {
                            // Individual mode: everyone on one team. Find others on the same team.
                            const otherNames = matchPlayers
                                .filter((p) => (p as Record<string, unknown>).user_id !== userId && (p as Record<string, unknown>).team === myTeam)
                                .map((p) => firstName(p as Record<string, unknown>))
                                .join(', ');
                            playerLabel = `You vs ${otherNames || 'Others'}`;
                        }
                    }

                    const course = m.courses as Record<string, unknown> | null;
                    return {
                        id: matchId,
                        courseName: course?.name as string ?? 'Unknown Course',
                        playerLabel,
                        format: m.format as string,
                        wagerType: (m.format as string)?.toLowerCase() === 'skins' ? ((m as any).side_bets?.teamSkins ? '2V2 SKINS' : 'SKINS') : ((m as any).side_bets?.scoringType === 'stroke_play' ? 'STROKE PLAY' : m.wager_type === 'NASSAU' ? 'MATCH PLAY' : m.wager_type as string),
                        createdAt: m.created_at as string,
                        payout: 0,
                        holesUp: 0,
                        status: m.status as string,
                    };
                });
                setHistory(items);
            }

            // 3. Completed matches — compute wins, lifetime payout, snakes avoided
            let completedMatches: any[] = [];
            if (allMatchIds.length > 0) {
                const { data } = await supabase
                    .from('matches')
                    .select('id, format, wager_amount, side_bets, courses(holes)')
                    .in('id', allMatchIds)
                    .eq('status', 'completed');
                if (data) completedMatches = data;
            }

            const completedIds = completedMatches.map((m) => (m as Record<string, unknown>).id as string);
            setStats((prev) => ({ ...prev, totalMatches: completedIds.length }));

            let wins = 0;
            let lifetimePayout = 0;
            const payoutMap: Record<string, { payout: number; holesUp: number }> = {};

            if (completedMatches && completedMatches.length > 0) {

                const [{ data: allPlayers }, { data: allScores }] = await Promise.all([
                    supabase.from('match_players').select('match_id, user_id, team').in('match_id', completedIds),
                    supabase.from('hole_scores').select('match_id, hole_number, player_id, gross, net, trash_dots').in('match_id', completedIds),
                ]);

                for (const matchRow of completedMatches as Record<string, unknown>[]) {
                    const matchId = matchRow.id as string;
                    const format = matchRow.format as string;
                    const wagerAmount = matchRow.wager_amount as number;
                    const sideBets = matchRow.side_bets as { snake?: boolean; trashValue?: number; birdiesDouble?: boolean; teamSkins?: boolean; potMode?: boolean; scoringType?: 'match_play' | 'stroke_play' } | null;
                    const courseData = matchRow.courses as { holes: { number: number; par: number }[] } | null;

                    const myEntry = (userMatchPlayers ?? []).find((mp) => mp.match_id === matchId);
                    if (!myEntry) continue;
                    const myTeam = myEntry.team as 'A' | 'B';
                    const oppTeam: 'A' | 'B' = myTeam === 'A' ? 'B' : 'A';

                    const matchPlayers = (allPlayers ?? []).filter(
                        (p) => (p as Record<string, unknown>).match_id === matchId
                    );
                    const matchScores = (allScores ?? []).filter(
                        (s) => (s as Record<string, unknown>).match_id === matchId
                    );

                    const myTeamPlayers = matchPlayers.filter((p) => (p as Record<string, unknown>).team === myTeam);
                    const oppTeamPlayers = matchPlayers.filter((p) => (p as Record<string, unknown>).team === oppTeam);

                    function teamScores(teamPlayers: typeof myTeamPlayers, hole: number): { net: number, gross: number }[] {
                        return teamPlayers
                            .map((p) => {
                                const pRow = p as Record<string, unknown>;
                                const s = matchScores.find(
                                    (sc) => {
                                        const scRow = sc as Record<string, unknown>;
                                        return scRow.hole_number === hole && scRow.player_id === pRow.user_id;
                                    }
                                );
                                if (!s) return undefined;
                                const scRow = s as Record<string, unknown>;
                                return { net: scRow.net as number, gross: scRow.gross as number };
                            })
                            .filter((obj): obj is { net: number, gross: number } => obj !== undefined);
                    }

                    function holePoints(hole: number): { my: number; opp: number } {
                        const myScores = teamScores(myTeamPlayers, hole);
                        const oppScores = teamScores(oppTeamPlayers, hole);
                        if (!myScores.length || !oppScores.length) return { my: 0, opp: 0 };

                        const myNets = myScores.map(s => s.net);
                        const oppNets = oppScores.map(s => s.net);

                        const par = courseData?.holes?.find((h) => h.number === hole)?.par ?? 4;
                        const birdiesDouble = sideBets?.birdiesDouble ?? false;

                        const myHasBirdie = myScores.some((s) => s.gross < par);
                        const oppHasBirdie = oppScores.some((s) => s.gross < par);

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

                    const holesPlayed: number[] = [];
                    for (let h = 1; h <= 18; h++) {
                        if (teamScores(myTeamPlayers, h).length > 0 && teamScores(oppTeamPlayers, h).length > 0) {
                            holesPlayed.push(h);
                        }
                    }

                    function nassauResult(holes: number[]): number {
                        let myPts = 0, oppPts = 0;
                        for (const h of holes) {
                            const { my, opp } = holePoints(h);
                            myPts += my; oppPts += opp;
                        }
                        if (myPts > oppPts) return wagerAmount;
                        if (oppPts > myPts) return -wagerAmount;
                        return 0;
                    }

                    const front9 = holesPlayed.filter((h) => h <= 9);
                    const back9 = holesPlayed.filter((h) => h > 9);
                    const matchPayout =
                        (front9.length >= 9 ? nassauResult(front9) : 0) +
                        (back9.length >= 9 ? nassauResult(back9) : 0) +
                        (holesPlayed.length >= 18 ? nassauResult(holesPlayed) : 0);

                    // Compute total holes up/down for this match
                    let totalMyPts = 0, totalOppPts = 0;
                    for (const h of holesPlayed) {
                        const { my, opp } = holePoints(h);
                        totalMyPts += my; totalOppPts += opp;
                    }
                    if (format === 'skins') {
                        const numPlayers = matchPlayers.length;
                        const isTeamSkins = sideBets?.teamSkins ?? false;
                        const isPotMode = sideBets?.potMode ?? false;
                        const skinCounts: Record<string, number> = {};
                        let carry = 0;
                        let skinsPayout = 0;

                        function hScoresForHole(h: number) {
                            return matchScores
                                .filter(s => (s as any).hole_number === h)
                                .map(s => ({
                                    playerId: (s as any).player_id as string,
                                    net: (s as any).net as number,
                                    team: ((matchPlayers.find(p => (p as any).user_id === (s as any).player_id) as any)?.team ?? 'A') as 'A' | 'B',
                                }));
                        }

                        // First pass: compute skins won per player/team
                        for (let h = 1; h <= 18; h++) {
                            const hScores = hScoresForHole(h);
                            if (hScores.length < numPlayers) continue;
                            const holesInPot = 1 + carry;
                            if (isTeamSkins) {
                                const aNet = Math.min(...hScores.filter(s => s.team === 'A').map(s => s.net));
                                const bNet = Math.min(...hScores.filter(s => s.team === 'B').map(s => s.net));
                                if (aNet !== bNet) {
                                    const winTeam = aNet < bNet ? 'A' : 'B';
                                    hScores.filter(s => s.team === winTeam).forEach(s => {
                                        skinCounts[s.playerId] = (skinCounts[s.playerId] ?? 0) + holesInPot;
                                    });
                                    carry = 0;
                                } else carry += 1;
                            } else {
                                const minNet = Math.min(...hScores.map(s => s.net));
                                const winners = hScores.filter(s => s.net === minNet);
                                if (winners.length === 1) {
                                    skinCounts[winners[0].playerId] = (skinCounts[winners[0].playerId] ?? 0) + holesInPot;
                                    carry = 0;
                                } else carry += 1;
                            }
                        }

                        if (isPotMode) {
                            const pot = wagerAmount * numPlayers;
                            const maxSkins = Math.max(0, ...Object.values(skinCounts));
                            const potWinners = maxSkins > 0 ? Object.keys(skinCounts).filter(id => skinCounts[id] === maxSkins) : [];
                            const potShare = potWinners.length > 1 ? pot / potWinners.length : pot;
                            skinsPayout = potWinners.includes(userId) ? potShare - wagerAmount : -wagerAmount;
                        } else {
                            // Per-skin payout: re-run loop computing net amounts
                            let carry2 = 0;
                            for (let h = 1; h <= 18; h++) {
                                const hScores = hScoresForHole(h);
                                if (hScores.length < numPlayers) continue;
                                const holesInPot = 1 + carry2;
                                const potVal = holesInPot * wagerAmount;
                                if (isTeamSkins) {
                                    const aNet = Math.min(...hScores.filter(s => s.team === 'A').map(s => s.net));
                                    const bNet = Math.min(...hScores.filter(s => s.team === 'B').map(s => s.net));
                                    if (aNet !== bNet) {
                                        const winTeam = aNet < bNet ? 'A' : 'B';
                                        const myScore = hScores.find(s => s.playerId === userId);
                                        const numOppTotal = matchPlayers.filter(p => (p as any).team !== winTeam).length;
                                        const numWinTotal = matchPlayers.filter(p => (p as any).team === winTeam).length;
                                        if (myScore?.team === winTeam) skinsPayout += (potVal * numOppTotal) / (numWinTotal || 1);
                                        else skinsPayout -= (potVal * numWinTotal) / (numOppTotal || 1);
                                        carry2 = 0;
                                    } else carry2 += 1;
                                } else {
                                    const minNet = Math.min(...hScores.map(s => s.net));
                                    const winners = hScores.filter(s => s.net === minNet);
                                    if (winners.length === 1) {
                                        skinsPayout += winners[0].playerId === userId ? potVal * (numPlayers - 1) : -potVal;
                                        carry2 = 0;
                                    } else carry2 += 1;
                                }
                            }
                        }

                        payoutMap[matchId] = { payout: skinsPayout, holesUp: 0 };
                        lifetimePayout += skinsPayout;
                        if (skinsPayout > 0) wins++;
                    } else if (sideBets?.scoringType === 'stroke_play') {
                        // Stroke play: compare net stroke totals per segment
                        function strokeSegResult(holes: number[]): number {
                            let myTotal = 0, oppTotal = 0;
                            for (const h of holes) {
                                const myS = teamScores(myTeamPlayers, h);
                                const oppS = teamScores(oppTeamPlayers, h);
                                if (!myS.length || !oppS.length) continue;
                                myTotal += myS[0].net;
                                oppTotal += oppS[0].net;
                            }
                            if (myTotal < oppTotal) return wagerAmount;
                            if (oppTotal < myTotal) return -wagerAmount;
                            return 0;
                        }
                        const strokePayout =
                            (front9.length >= 9 ? strokeSegResult(front9) : 0) +
                            (back9.length >= 9 ? strokeSegResult(back9) : 0) +
                            (holesPlayed.length >= 18 ? strokeSegResult(holesPlayed) : 0);
                        // holesUp = net stroke differential (negative = I'm winning)
                        let myNetTotal = 0, oppNetTotal = 0;
                        for (const h of holesPlayed) {
                            const myS = teamScores(myTeamPlayers, h);
                            const oppS = teamScores(oppTeamPlayers, h);
                            if (!myS.length || !oppS.length) continue;
                            myNetTotal += myS[0].net;
                            oppNetTotal += oppS[0].net;
                        }
                        payoutMap[matchId] = { payout: strokePayout, holesUp: myNetTotal - oppNetTotal };
                        lifetimePayout += strokePayout;
                        if (strokePayout > 0) wins++;
                    } else {
                        payoutMap[matchId] = { payout: matchPayout, holesUp: totalMyPts - totalOppPts };
                        lifetimePayout += matchPayout;
                        if (matchPayout > 0) wins++;
                    }

                }
            }

            setStats((prev) => ({ ...prev, wins, lifetimePayout }));

            // Back-fill payout/holesUp into history items
            setHistory((prev) => prev.map((item) => ({
                ...item,
                payout: payoutMap[item.id]?.payout ?? 0,
                holesUp: payoutMap[item.id]?.holesUp ?? 0,
            })));
        }

        load();
    }, [profile]);

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const memberYear = profile?.createdAt
        ? new Date(profile.createdAt).getFullYear()
        : '—';

    const winRate = stats.totalMatches > 0
        ? Math.round((stats.wins / stats.totalMatches) * 100) + '%'
        : '—';



    function formatDate(iso: string) {
        const d = new Date(iso);
        const today = new Date();
        // Normalize both to midnight so we compare calendar days, not raw timestamps
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const matchMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((todayMidnight.getTime() - matchMidnight.getTime()) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return (
        <div className="space-y-12">
            <SEO title="Dashboard" />
            {/* Scrollable Content */}
            {/* Profile Completion Nudge */}
            {profile && (!profile.nickname || !profile.countryCode) && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-2 mb-6 p-4 rounded-2xl bg-gradient-to-r from-bloodRed/20 to-transparent border border-bloodRed/30 flex items-center justify-between group cursor-pointer hover:bg-bloodRed/10 transition-all shadow-[0_0_20px_rgba(255,0,63,0.1)]"
                    onClick={() => navigate('/settings')}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-bloodRed/20 flex items-center justify-center border border-bloodRed/40 animate-pulse">
                            <PenLine className="w-5 h-5 text-bloodRed" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black uppercase tracking-tight text-white group-hover:text-bloodRed transition-colors">Complete Your Tour Profile</h4>
                            <p className="text-[10px] font-bold text-secondaryText uppercase tracking-widest leading-tight">Add a nickname & country to unlock your legend status</p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-secondaryText group-hover:text-white group-hover:translate-x-1 transition-all" />
                </motion.div>
            )}

            {/* Ident & Ledger Bal */}
            <AnimatePresence mode="wait">
                {!showAvatarPicker ? (
                    <motion.section
                        key="ident"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative overflow-hidden bg-surface rounded-[2rem] p-8 border border-borderColor/50 shadow-2xl"
                    >
                        {/* Background Spotlight Decor */}
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-bloodRed/10 rounded-full blur-[100px] pointer-events-none" />
                        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-neonGreen/5 rounded-full blur-[100px] pointer-events-none" />

                        <div className="relative flex flex-col items-center">
                            {/* Avatar with Status Ring */}
                            <div className="relative mb-6">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-bloodRed via-bloodRed/50 to-transparent shadow-[0_0_30px_rgba(255,0,63,0.2)] cursor-pointer overflow-hidden"
                                    onClick={() => setShowAvatarPicker(true)}
                                >
                                    <div className="w-full h-full rounded-full bg-surface border-4 border-surface overflow-hidden relative group">
                                        {profile?.avatarUrl ? (
                                            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center font-black text-3xl text-secondaryText bg-surfaceHover">
                                                {initials}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-bloodRed/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Camera className="w-6 h-6 text-white drop-shadow-md" />
                                        </div>
                                    </div>
                                </motion.div>

                                {profile?.countryCode && (
                                    <div className="absolute -bottom-1 -right-1 bg-surface border border-borderColor p-1.5 rounded-xl shadow-lg flex items-center justify-center backdrop-blur-md">
                                        <span className="text-xl leading-none">
                                            {COUNTRIES.find(c => c.code === profile.countryCode)?.flag}
                                        </span>
                                    </div>
                                )}
                            </div>


                            {/* Moniker Section (Full Name Only) */}
                            <div className="text-center mb-6 w-full px-10 flex flex-col items-center">
                                <h2 className="text-3xl sm:text-5xl font-black italic tracking-tighter uppercase leading-tight drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent pr-2">
                                    {profile?.fullName || 'TOUR PRO'}
                                </h2>
                            </div>

                        </div>

                        {/* Leaderboard Stats Section */}
                        <div className="w-full grid grid-cols-2 gap-px bg-borderColor/30 rounded-2xl border border-borderColor/30 overflow-hidden backdrop-blur-sm mb-6">
                            <div className="bg-surface/50 p-4 flex flex-col items-center">
                                <span className="text-[9px] font-black text-secondaryText/60 uppercase tracking-[0.2em] mb-1">Hdcp Index</span>
                                <span className="text-3xl font-black text-white font-mono">{profile?.handicap ?? '—'}</span>
                            </div>
                            <div className="bg-surface/50 p-4 flex flex-col items-center">
                                <span className="text-[9px] font-black text-secondaryText/60 uppercase tracking-[0.2em] mb-1">Career Earnings</span>
                                <span className={`text-2xl font-black font-mono ${stats.lifetimePayout >= 0 ? 'text-neonGreen' : 'text-bloodRed'}`}>
                                    {stats.lifetimePayout >= 0 ? '+' : ''}${stats.lifetimePayout}
                                </span>
                            </div>
                        </div>

                        <div className="w-full text-center">
                            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-secondaryText/30 block">
                                Est. {memberYear} • Player ID: {profile?.id.slice(0, 8)}
                            </span>
                        </div>
                    </motion.section>
                ) : (
                    <motion.section
                        key="picker"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-surface rounded-2xl p-6 border border-borderColor space-y-6"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black italic uppercase tracking-tight text-white">Choose Your Look</h3>
                                <p className="text-secondaryText text-[10px] font-bold uppercase tracking-widest mt-0.5">Pick your presence</p>
                            </div>
                            <button
                                onClick={() => setShowAvatarPicker(false)}
                                className="w-10 h-10 rounded-xl bg-background border border-borderColor flex items-center justify-center text-secondaryText hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {/* Large Upload Button */}
                            <motion.button
                                whileHover={{ scale: 1.02, borderColor: '#FF003F' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => document.getElementById('dashboardProfileUpload')?.click()}
                                className="relative aspect-square rounded-2xl border-2 border-dashed border-borderColor bg-background/50 flex flex-col items-center justify-center gap-2 group transition-all"
                            >
                                {uploadingImage ? (
                                    <Loader className="w-6 h-6 animate-spin text-bloodRed" />
                                ) : (
                                    <>
                                        <div className="w-10 h-10 rounded-full bg-bloodRed/10 flex items-center justify-center group-hover:bg-bloodRed/20 transition-colors">
                                            <Camera className="w-5 h-5 text-bloodRed" />
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-[8px] font-black uppercase tracking-widest text-white">Upload</span>
                                            <span className="block text-[6px] font-bold uppercase tracking-widest text-secondaryText group-hover:text-bloodRed transition-colors">Photo</span>
                                        </div>
                                    </>
                                )}
                                <input
                                    id="dashboardProfileUpload"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                />
                            </motion.button>

                            {AVATARS.map((avatar) => (
                                <button
                                    key={avatar.id}
                                    onClick={() => handleSelectAvatar(avatar.url)}
                                    className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group ${profile?.avatarUrl === avatar.url ? 'border-bloodRed scale-105 shadow-[0_0_15px_rgba(255,0,63,0.4)]' : 'border-borderColor hover:border-bloodRed/50'
                                        }`}
                                >
                                    <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    {profile?.avatarUrl === avatar.url && (
                                        <div className="absolute inset-0 bg-bloodRed/10 flex items-center justify-center">
                                            <Check className="w-8 h-8 text-white drop-shadow-lg" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>


            {/* 2x2 Stats Grid */}
            <section className="grid grid-cols-2 gap-2 sm:gap-3">
                <StatBox label="Total Matches" value={String(stats.totalMatches)} className="px-1" />
                <StatBox label="Win Rate" value={winRate} className="px-1" />
            </section>



            {/* Action Required — matches needing the current user's attestation */}
            {
                needsAttestation.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-3 px-2">
                            <PenLine className="w-5 h-5 text-yellow-400" />
                            <h3 className="text-sm font-bold tracking-widest uppercase text-yellow-400">Action Required</h3>
                        </div>
                        <Card className="divide-y divide-borderColor/50">
                            {needsAttestation.map((item) => (
                                <div
                                    key={item.matchId}
                                    className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer"
                                    onClick={async () => {
                                        useMatchStore.setState({ matchId: item.matchId, match: null });
                                        localStorage.setItem('activeMatchId', item.matchId);
                                        navigate('/ledger');
                                    }}
                                >
                                    <div>
                                        <span className="font-bold text-white block">{item.courseName}</span>
                                        <span className="text-xs text-yellow-400 font-bold uppercase tracking-wider">Your signature is needed</span>
                                    </div>
                                    <Clock className="w-5 h-5 text-yellow-400 shrink-0 ml-3" />
                                </div>
                            ))}
                        </Card>
                    </section>
                )
            }

            {/* Recent Media (The Vault preview) */}
            <RecentMedia />

            {/* Recent Matches */}
            <section>
                <div className="flex items-center justify-between mb-3 px-2 mt-4">
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-secondaryText" />
                        <h3 className="text-sm font-bold tracking-widest uppercase text-secondaryText">Recent History</h3>
                    </div>
                    <button onClick={() => navigate('/history')} className="text-xs font-bold text-bloodRed uppercase tracking-widest hover:opacity-70 transition-opacity">View All</button>
                </div>
                {history.length === 0 ? (
                    <div className="mt-4 flex justify-center w-full">
                        <div className="relative inline-block">
                            <EmptyState
                                title="No Rounds Recorded"
                                description="Your status isn't built in a day. Tee off to start your legacy."
                                actionLabel="Tee It Up"
                                onAction={() => navigate('/setup')}
                                accentColor="bloodRed"
                            />

                        </div>
                    </div>
                ) : (
                    <Card className="divide-y divide-borderColor/50">
                        {history.slice(0, 5).map((item) => (
                            <div
                                key={item.id}
                                className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer"
                                onClick={() => {
                                    if (item.status === 'in_progress') {
                                        navigate(`/play/1`);
                                    } else {
                                        navigate(`/history/${item.id}`);
                                    }
                                }}
                            >
                                <div>
                                    <span className="font-bold text-white block">{item.courseName} • {item.format}</span>
                                    <span className="text-xs text-secondaryText block mt-0.5">{item.playerLabel}</span>
                                    <span className="text-xs text-secondaryText uppercase tracking-wider">
                                        {formatDate(item.createdAt)} • {item.wagerType === 'NASSAU' ? 'Match Play' : item.wagerType}
                                    </span>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    {item.status === 'pending_attestation' ? (
                                        <div className="flex flex-col items-end gap-1">
                                            <Clock className="w-4 h-4 text-yellow-400" />
                                            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Unattested</span>
                                        </div>
                                    ) : item.status === 'in_progress' ? (
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="w-2 h-2 rounded-full bg-neonGreen animate-pulse shadow-[0_0_8px_rgba(0,255,102,0.8)]" />
                                            <span className="text-[10px] font-bold text-neonGreen uppercase tracking-widest">Live Round</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`font-black text-base leading-tight ${item.payout > 0 ? 'text-neonGreen' : item.payout < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                {item.payout > 0 ? `+$${item.payout}` : item.payout < 0 ? `-$${Math.abs(item.payout)}` : 'PUSH'}
                                            </div>
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${item.format === 'skins' ? 'text-secondaryText' : item.wagerType === 'STROKE PLAY' ? (item.holesUp < 0 ? 'text-neonGreen' : item.holesUp > 0 ? 'text-bloodRed' : 'text-secondaryText') : (item.holesUp > 0 ? 'text-neonGreen' : item.holesUp < 0 ? 'text-bloodRed' : 'text-secondaryText')}`}>
                                                {item.format === 'skins' ? 'SKINS' : item.wagerType === 'STROKE PLAY' ? (item.holesUp === 0 ? 'EVEN' : item.holesUp < 0 ? `${item.holesUp}` : `+${item.holesUp}`) : (item.holesUp > 0 ? `${item.holesUp} UP` : item.holesUp < 0 ? `${Math.abs(item.holesUp)} DN` : 'A/S')}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </Card>
                )}
            </section>
        </div >
    );
}
