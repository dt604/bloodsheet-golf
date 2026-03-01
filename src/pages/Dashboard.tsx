import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, History, Users, Camera, Loader, ShieldCheck, Home, Clock, PenLine } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatBox } from '../components/ui/StatBox';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useMatchStore } from '../store/useMatchStore';

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
    greenies: number;
    snakesAvoided: number;
    lifetimePayout: number;
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const { user, profile, updateProfile } = useAuth();

    const [uploadingImage, setUploadingImage] = useState(false);

    const [history, setHistory] = useState<MatchHistoryItem[]>([]);
    const [needsAttestation, setNeedsAttestation] = useState<PendingAttestItem[]>([]);
    const [stats, setStats] = useState<Stats>({
        totalMatches: 0,
        wins: 0,
        greenies: 0,
        snakesAvoided: 0,
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
        } catch (error: any) {
            console.error('Error uploading avatar:', error.message);
            alert('Failed to upload image. Please try again.');
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
            const { data: recentMatches } = await supabase
                .from('matches')
                .select('id, format, wager_type, wager_amount, status, created_at, created_by, courses(name)')
                .in('id', allMatchIds)
                .in('status', ['completed', 'pending_attestation'])
                .order('created_at', { ascending: false })
                .limit(10);

            // 2b. Find matches where user needs to attest (pending, not creator, not yet attested)
            const pendingMatchIds = (recentMatches ?? [])
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
                const unattested = (recentMatches ?? [])
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

            if (recentMatches) {
                const recentMatchIds = (recentMatches as Record<string, unknown>[]).map((m) => m.id as string);

                // Fetch all players for these recent matches
                const { data: recentPlayers } = await supabase
                    .from('match_players')
                    .select('match_id, user_id, team, guest_name')
                    .in('match_id', recentMatchIds);

                // Fetch profile names for all non-guest players
                const playerUserIds = [...new Set(
                    (recentPlayers ?? []).map((p) => (p as Record<string, unknown>).user_id as string).filter(Boolean)
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
                    const matchPlayers = (recentPlayers ?? []).filter(
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
                        const oppNames = matchPlayers
                            .filter((p) => (p as Record<string, unknown>).team === oppTeam)
                            .map((p) => firstName(p as Record<string, unknown>))
                            .join(' & ');
                        playerLabel = `${myNames} vs ${oppNames}`;
                    }

                    const course = m.courses as Record<string, unknown> | null;
                    return {
                        id: matchId,
                        courseName: course?.name as string ?? 'Unknown Course',
                        playerLabel,
                        format: m.format as string,
                        wagerType: m.wager_type as string,
                        createdAt: m.created_at as string,
                        payout: 0,
                        holesUp: 0,
                        status: m.status as string,
                    };
                });
                setHistory(items);
            }

            // 3. Completed matches — compute wins, lifetime payout, snakes avoided
            const { data: completedMatches } = await supabase
                .from('matches')
                .select('id, format, wager_amount, side_bets, courses(holes)')
                .in('id', allMatchIds)
                .eq('status', 'completed');

            const completedIds = (completedMatches as Record<string, unknown>[] ?? []).map((m) => m.id as string);
            setStats((prev) => ({ ...prev, totalMatches: completedIds.length }));

            if (completedMatches && completedMatches.length > 0) {

                const [{ data: allPlayers }, { data: allScores }] = await Promise.all([
                    supabase.from('match_players').select('match_id, user_id, team').in('match_id', completedIds),
                    supabase.from('hole_scores').select('match_id, hole_number, player_id, gross, net, trash_dots').in('match_id', completedIds),
                ]);

                let wins = 0;
                let lifetimePayout = 0;
                let snakesAvoided = 0;
                const payoutMap: Record<string, { payout: number; holesUp: number }> = {};

                for (const matchRow of completedMatches as Record<string, unknown>[]) {
                    const matchId = matchRow.id as string;
                    const format = matchRow.format as string;
                    const wagerAmount = matchRow.wager_amount as number;
                    const sideBets = matchRow.side_bets as { snake?: boolean; trashValue?: number; birdiesDouble?: boolean } | null;
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
                        // Skins payout: lowest net wins the hole (+ carry)
                        const numPlayers = matchPlayers.length;
                        let carry = 0;
                        let skinsPayout = 0;
                        for (let h = 1; h <= 18; h++) {
                            const hScores = matchScores
                                .filter(s => (s as any).hole_number === h)
                                .map(s => ({ playerId: (s as any).player_id as string, net: (s as any).net as number }));
                            if (hScores.length < numPlayers) continue;
                            const holesInPot = 1 + carry;
                            const pot = holesInPot * wagerAmount;
                            const minNet = Math.min(...hScores.map(s => s.net));
                            const winners = hScores.filter(s => s.net === minNet);
                            if (winners.length === 1) {
                                skinsPayout += winners[0].playerId === userId ? pot * (numPlayers - 1) : -pot;
                                carry = 0;
                            } else {
                                carry += 1;
                            }
                        }
                        payoutMap[matchId] = { payout: skinsPayout, holesUp: 0 };
                        lifetimePayout += skinsPayout;
                        if (skinsPayout > 0) wins++;
                    } else {
                        payoutMap[matchId] = { payout: matchPayout, holesUp: totalMyPts - totalOppPts };
                        lifetimePayout += matchPayout;
                        if (matchPayout > 0) wins++;
                    }

                    // Snake avoided: snake was enabled and user's team never picked up a snake dot
                    if (sideBets?.snake) {
                        const mySnakeDots = matchScores.filter((s) => {
                            const sc = s as Record<string, unknown>;
                            const onMyTeam = myTeamPlayers.find(
                                (p) => (p as Record<string, unknown>).user_id === sc.player_id
                            );
                            return onMyTeam && (sc.trash_dots as string[]).includes('snake');
                        }).length;
                        if (mySnakeDots === 0) snakesAvoided++;
                    }
                }

                setStats((prev) => ({ ...prev, wins, lifetimePayout, snakesAvoided }));

                // Back-fill payout/holesUp into history items
                setHistory((prev) => prev.map((item) => ({
                    ...item,
                    payout: payoutMap[item.id]?.payout ?? 0,
                    holesUp: payoutMap[item.id]?.holesUp ?? 0,
                })));
            }

            // 4. Greenies count — completed matches only
            const { count: greeniesCount } = completedIds.length > 0
                ? await supabase
                    .from('hole_scores')
                    .select('*', { count: 'exact', head: true })
                    .eq('player_id', userId)
                    .contains('trash_dots', ['greenie'])
                    .in('match_id', completedIds)
                : { count: 0 };

            if (greeniesCount !== null) {
                setStats((prev) => ({ ...prev, greenies: greeniesCount }));
            }
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
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* Header - Stationary */}
            <header className="flex items-center justify-between p-4 px-6 border-b border-borderColor bg-background/95 backdrop-blur z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/home')} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors" title="Home Hub">
                        <Home className="w-5 h-5" />
                    </button>
                    <span className="text-secondaryText text-[10px] font-black uppercase tracking-widest pt-0.5">PLAYER PROFILE</span>
                </div>
                <div className="flex items-center gap-2 -mr-2">
                    {profile?.is_admin && (
                        <button onClick={() => navigate('/admin')} className="p-2 text-bloodRed hover:text-white transition-colors" title="Admin Dashboard">
                            <ShieldCheck className="w-6 h-6" />
                        </button>
                    )}
                    <button onClick={() => navigate('/friends')} className="p-2 text-secondaryText hover:text-white transition-colors">
                        <Users className="w-6 h-6" />
                    </button>
                    <button onClick={() => navigate('/settings')} className="p-2 text-secondaryText hover:text-white transition-colors">
                        <Settings className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-6">
                {/* Ident & Ledger Bal */}
                <section className="bg-surface rounded-2xl p-4 sm:p-6 border border-borderColor flex flex-col items-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-surfaceHover border-2 border-bloodRed rounded-full flex items-center justify-center font-bold text-2xl sm:text-3xl mb-3 sm:mb-4 relative shadow-[0_0_15px_rgba(255,0,63,0.3)] overflow-hidden group cursor-pointer transition-transform hover:scale-105">
                        {profile?.avatarUrl ? (
                            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            initials
                        )}
                        <label className="absolute inset-0 bg-background/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity z-10 w-full h-full">
                            {uploadingImage ? <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-bloodRed" />}
                            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingImage} />
                        </label>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-0.5 sm:mb-1 truncate max-w-full px-2">{profile?.fullName ?? '…'}</h2>
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-secondaryText mb-6 sm:mb-8">Member since {memberYear}</span>

                    <div className="w-full flex">
                        <div className="flex-1 border-r border-borderColor flex flex-col items-center justify-center py-1 sm:py-2 px-1">
                            <span className="text-[10px] sm:text-xs uppercase font-bold text-secondaryText tracking-widest mb-1 sm:mb-1.5 leading-tight">Index</span>
                            <span className="text-3xl sm:text-4xl font-black font-sans">{profile?.handicap ?? '—'}</span>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center py-1 sm:py-2 px-1">
                            <span className="text-[10px] sm:text-xs uppercase font-bold text-secondaryText tracking-widest mb-1 sm:mb-1.5 whitespace-nowrap leading-tight text-center">BloodSheet Total</span>
                            <span className={`text-2xl sm:text-4xl font-black font-sans ${stats.lifetimePayout >= 0 ? 'text-neonGreen' : 'text-bloodRed'}`}>
                                {stats.lifetimePayout >= 0 ? '+' : ''}${stats.lifetimePayout}
                            </span>
                        </div>
                    </div>
                </section>


                {/* 2x2 Stats Grid */}
                <section className="grid grid-cols-2 gap-2 sm:gap-3">
                    <StatBox label="Total Matches" value={String(stats.totalMatches)} className="px-1" />
                    <StatBox label="Win Rate" value={winRate} className="px-1" />
                    <StatBox label="Greenies" value={String(stats.greenies)} valueColor="bloodRed" className="px-1" />
                    <StatBox label="Snakes Avoided" value={String(stats.snakesAvoided)} valueColor="neonGreen" className="px-1" />
                </section>

                {/* Action Required — matches needing the current user's attestation */}
                {needsAttestation.length > 0 && (
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
                )}

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
                        <p className="text-secondaryText text-sm px-2">No matches yet. Start your first one!</p>
                    ) : (
                        <Card className="divide-y divide-borderColor/50">
                            {history.slice(0, 5).map((item) => (
                                <div
                                    key={item.id}
                                    className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer"
                                    onClick={() => {
                                        if (item.status === 'pending_attestation') {
                                            useMatchStore.setState({ matchId: item.id, match: null });
                                            localStorage.setItem('activeMatchId', item.id);
                                            navigate('/ledger');
                                        } else {
                                            navigate(`/history/${item.id}`);
                                        }
                                    }}
                                >
                                    <div>
                                        <span className="font-bold text-white block">{item.courseName} • {item.format}</span>
                                        <span className="text-xs text-secondaryText block mt-0.5">{item.playerLabel}</span>
                                        <span className="text-xs text-secondaryText uppercase tracking-wider">
                                            {formatDate(item.createdAt)} • {item.wagerType}
                                        </span>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        {item.status === 'pending_attestation' ? (
                                            <div className="flex flex-col items-end gap-1">
                                                <Clock className="w-4 h-4 text-yellow-400" />
                                                <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Unattested</span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className={`font-black text-base leading-tight ${item.payout > 0 ? 'text-neonGreen' : item.payout < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                    {item.payout > 0 ? `+$${item.payout}` : item.payout < 0 ? `-$${Math.abs(item.payout)}` : 'PUSH'}
                                                </div>
                                                <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${item.holesUp > 0 ? 'text-neonGreen' : item.holesUp < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                    {item.format === 'skins' ? 'SKINS' : item.holesUp > 0 ? `${item.holesUp} UP` : item.holesUp < 0 ? `${Math.abs(item.holesUp)} DN` : 'A/S'}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </Card>
                    )}
                </section>
            </main>

            {/* Primary Action Buttons - Stationary */}
            <div className="bg-background border-t border-borderColor p-3 sm:p-4 flex gap-2 sm:gap-3 z-20 shrink-0 pb-safe">
                <Button variant="outline" size="sm" className="flex-1 h-12 sm:h-14 font-bold uppercase tracking-wider text-sm sm:text-base" onClick={() => navigate('/join')}>
                    Join Match
                </Button>
                <Button size="lg" className="flex-[2] h-12 sm:h-14 text-sm sm:text-base uppercase tracking-widest font-black shadow-[0_0_20px_rgba(255,0,63,0.4)]" onClick={() => navigate('/setup')}>
                    Start New Match
                </Button>
            </div>
        </div>
    );
}
