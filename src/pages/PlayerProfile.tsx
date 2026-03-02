import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, History, UserPlus, Check, Loader, Crown, Home, Users, Settings, Camera } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatBox } from '../components/ui/StatBox';
import { useAuth } from '../contexts/AuthContext';
import { useFriendsStore } from '../store/useFriendsStore';
import { supabase } from '../lib/supabase';

interface ProfileData {
    id: string;
    fullName: string;
    avatarUrl?: string;
    handicap: number;
    createdAt: string;
}

interface MatchHistoryItem {
    id: string;
    courseName: string;
    playerLabel: string;
    format: string;
    wagerType: string;
    createdAt: string;
    payout: number;
    holesUp: number;
}

interface Stats {
    totalMatches: number;
    wins: number;
    lifetimePayout: number;
}

export default function PlayerProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isOwnProfile = user?.id === userId;

    const {
        friendships,
        loadFriendships,
        sendFriendRequest,
    } = useFriendsStore();

    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [history, setHistory] = useState<MatchHistoryItem[]>([]);
    const [stats, setStats] = useState<Stats>({
        totalMatches: 0,
        wins: 0,
        lifetimePayout: 0,
    });

    const [uploadingImage, setUploadingImage] = useState(false);

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0 || !user || !isOwnProfile) return;
        const file = e.target.files[0];
        setUploadingImage(true);

        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}-${Math.random()}.${fileExt}`;

        try {
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            // Re-fetch profile data to update UI
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: data.publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setProfileData(prev => prev ? { ...prev, avatarUrl: data.publicUrl } : null);
        } catch (error: any) {
            console.error('Error uploading avatar:', error.message);
            alert('Failed to upload image. Please try again.');
        } finally {
            setUploadingImage(false);
        }
    }

    // Load friendships so the Add Friend button reflects current state
    useEffect(() => {
        if (user && !isOwnProfile) {
            loadFriendships(user.id);
        }
    }, [user, isOwnProfile]);

    // Load profile + stats
    useEffect(() => {
        if (!userId) return;

        async function load() {
            setLoadingProfile(true);

            // 1. Fetch profile row
            const { data: prof } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, handicap, created_at')
                .eq('id', userId!)
                .single();

            if (!prof) {
                setLoadingProfile(false);
                return; // Guest/Grint player — no profile row
            }

            setProfileData({
                id: prof.id,
                fullName: prof.full_name,
                avatarUrl: prof.avatar_url ?? undefined,
                handicap: prof.handicap ?? 0,
                createdAt: prof.created_at,
            });
            setLoadingProfile(false);

            // 2. All match participations
            const { data: userMatchPlayers } = await supabase
                .from('match_players')
                .select('match_id, team')
                .eq('user_id', userId!);

            const allMatchIds = (userMatchPlayers ?? []).map((mp) => mp.match_id as string);
            if (allMatchIds.length === 0) return;

            // 3. Recent 5 completed matches for history display
            const { data: recentMatches } = await supabase
                .from('matches')
                .select('id, format, wager_type, wager_amount, status, created_at, courses(name)')
                .in('id', allMatchIds)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentMatches && recentMatches.length > 0) {
                const recentMatchIds = (recentMatches as Record<string, unknown>[]).map((m) => m.id as string);

                const { data: recentPlayers } = await supabase
                    .from('match_players')
                    .select('match_id, user_id, team, guest_name')
                    .in('match_id', recentMatchIds);

                const playerUserIds = [...new Set(
                    (recentPlayers ?? []).map((p) => (p as Record<string, unknown>).user_id as string).filter(Boolean)
                )];
                const profileNameMap: Record<string, string> = {};
                if (playerUserIds.length > 0) {
                    const { data: profilesData } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', playerUserIds);
                    for (const p of (profilesData ?? []) as { id: string; full_name: string }[]) {
                        profileNameMap[p.id] = p.full_name;
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
                        courseName: (course?.name as string) ?? 'Unknown Course',
                        playerLabel,
                        format: m.format as string,
                        wagerType: m.wager_type as string,
                        createdAt: m.created_at as string,
                        payout: 0,
                        holesUp: 0,
                    };
                });
                setHistory(items);
            }

            // 4. Completed matches for payout / wins / snakes stats
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
                const payoutMap: Record<string, { payout: number; holesUp: number }> = {};

                for (const matchRow of completedMatches as Record<string, unknown>[]) {
                    const matchId = matchRow.id as string;
                    const format = matchRow.format as string;
                    const wagerAmount = matchRow.wager_amount as number;
                    const sideBets = matchRow.side_bets as {
                        snake?: boolean;
                        trashValue?: number;
                        birdiesDouble?: boolean;
                        teamSkins?: boolean;
                        potMode?: boolean;
                    } | null;
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

                    function teamScores(teamPlayers: typeof myTeamPlayers, hole: number): { net: number; gross: number }[] {
                        return teamPlayers
                            .map((p) => {
                                const pRow = p as Record<string, unknown>;
                                const s = matchScores.find((sc) => {
                                    const scRow = sc as Record<string, unknown>;
                                    return scRow.hole_number === hole && scRow.player_id === pRow.user_id;
                                });
                                if (!s) return undefined;
                                const scRow = s as Record<string, unknown>;
                                return { net: scRow.net as number, gross: scRow.gross as number };
                            })
                            .filter((obj): obj is { net: number; gross: number } => obj !== undefined);
                    }

                    function holePoints(hole: number): { my: number; opp: number } {
                        const myScores = teamScores(myTeamPlayers, hole);
                        const oppScores = teamScores(oppTeamPlayers, hole);
                        if (!myScores.length || !oppScores.length) return { my: 0, opp: 0 };

                        const myNets = myScores.map((s) => s.net);
                        const oppNets = oppScores.map((s) => s.net);

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
                            skinsPayout = potWinners.includes(userId!) ? potShare - wagerAmount : -wagerAmount;
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
                                        const myScore = hScores.find(s => s.playerId === userId!);
                                        const numOpp = hScores.filter(s => s.team !== winTeam).length;
                                        const numWin = hScores.filter(s => s.team === winTeam).length;
                                        if (myScore?.team === winTeam) skinsPayout += potVal * numOpp;
                                        else skinsPayout -= potVal * numWin;
                                        carry2 = 0;
                                    } else carry2 += 1;
                                } else {
                                    const minNet = Math.min(...hScores.map(s => s.net));
                                    const winners = hScores.filter(s => s.net === minNet);
                                    if (winners.length === 1) {
                                        skinsPayout += winners[0].playerId === userId! ? potVal * (numPlayers - 1) : -potVal;
                                        carry2 = 0;
                                    } else carry2 += 1;
                                }
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

                    // Back-fill payout/holesUp into history items
                    setHistory((prev) => prev.map((item) => ({
                        ...item,
                        payout: payoutMap[item.id]?.payout ?? 0,
                        holesUp: payoutMap[item.id]?.holesUp ?? 0,
                    })));
                }

                setStats((prev) => ({ ...prev, wins, lifetimePayout }));
            }
        }

        load();
    }, [userId]);

    const friendship = friendships.find(
        (f) => f.requesterId === userId || f.addresseeId === userId
    );

    function formatDate(iso: string) {
        const d = new Date(iso);
        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const matchMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diff = Math.round((todayMidnight.getTime() - matchMidnight.getTime()) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    const initials = profileData?.fullName
        ? profileData.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const memberYear = profileData?.createdAt
        ? new Date(profileData.createdAt).getFullYear()
        : '—';

    const winRate = stats.totalMatches > 0
        ? Math.round((stats.wins / stats.totalMatches) * 100) + '%'
        : '—';

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* Header */}
            <header className="flex items-center justify-between p-4 px-6 border-b border-borderColor bg-background/95 backdrop-blur z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <span className="text-secondaryText text-[10px] font-black uppercase tracking-widest pt-0.5 whitespace-nowrap">
                        {isOwnProfile ? 'MY PROFILE' : 'PLAYER PROFILE'}
                    </span>
                </div>
                {isOwnProfile && (
                    <div className="flex items-center gap-2 -mr-2">
                        <button onClick={() => navigate('/home')} className="p-2 text-secondaryText hover:text-white transition-colors" title="Home Hub">
                            <Home className="w-5 h-5" />
                        </button>
                        <button onClick={() => navigate('/friends')} className="p-2 text-secondaryText hover:text-white transition-colors">
                            <Users className="w-6 h-6" />
                        </button>
                        <button onClick={() => navigate('/settings')} className="p-2 text-secondaryText hover:text-white transition-colors">
                            <Settings className="w-6 h-6" />
                        </button>
                    </div>
                )}
                {!isOwnProfile && <div className="w-10" />}
            </header>

            {loadingProfile ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader className="w-8 h-8 animate-spin text-bloodRed" />
                </div>
            ) : !profileData ? (
                /* Guest player — no profile row */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-surfaceHover border-2 border-borderColor flex items-center justify-center text-3xl font-black text-secondaryText">?</div>
                    <p className="font-bold text-white text-lg">Guest Player</p>
                    <p className="text-secondaryText text-sm">This player doesn't have a BloodSheet account.</p>
                </div>
            ) : (
                <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-6">
                    {/* Identity card */}
                    <section className="bg-surface rounded-2xl p-4 sm:p-6 border border-borderColor flex flex-col items-center">
                        <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-surfaceHover border-2 border-bloodRed rounded-full flex items-center justify-center font-bold text-2xl sm:text-3xl mb-3 sm:mb-4 relative shadow-[0_0_15px_rgba(255,0,63,0.3)] overflow-hidden transition-transform ${isOwnProfile ? 'group cursor-pointer hover:scale-105' : ''}`}>
                            {profileData.avatarUrl ? (
                                <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                initials
                            )}
                            {isOwnProfile && (
                                <label className="absolute inset-0 bg-background/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity z-10 w-full h-full">
                                    {uploadingImage ? <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-bloodRed" />}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingImage} />
                                </label>
                            )}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-0.5 sm:mb-1 truncate max-w-full px-2">{profileData.fullName}</h2>
                        {stats.lifetimePayout > 0 && stats.totalMatches > 0 && (
                            <div className="flex items-center justify-center gap-1.5 mt-1 mb-2 px-3 py-1 rounded-full bg-bloodRed/10 border border-bloodRed/30 shadow-[0_0_10px_rgba(255,0,63,0.15)]">
                                <Crown className="w-4 h-4 text-bloodRed" />
                                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-bloodRed">BloodSheet Legend</span>
                            </div>
                        )}
                        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-secondaryText mb-6 sm:mb-8 mt-1 block">
                            Member since {memberYear}
                        </span>

                        <div className="w-full flex">
                            <div className="flex-1 border-r border-borderColor flex flex-col items-center justify-center py-1 sm:py-2 px-1">
                                <span className="text-[10px] sm:text-xs uppercase font-bold text-secondaryText tracking-widest mb-1 sm:mb-1.5 leading-tight">Index</span>
                                <span className="text-3xl sm:text-4xl font-black font-sans">{profileData.handicap}</span>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center py-1 sm:py-2 px-1">
                                <span className="text-[10px] sm:text-xs uppercase font-bold text-secondaryText tracking-widest mb-1 sm:mb-1.5 whitespace-nowrap leading-tight text-center">BloodSheet Total</span>
                                <span className={`text-2xl sm:text-4xl font-black font-sans ${stats.lifetimePayout >= 0 ? 'text-neonGreen' : 'text-bloodRed'}`}>
                                    {stats.lifetimePayout >= 0 ? '+' : ''}${stats.lifetimePayout}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Stats grid */}
                    <section className="grid grid-cols-2 gap-2 sm:gap-3">
                        <StatBox label="Total Matches" value={String(stats.totalMatches)} className="px-1" />
                        <StatBox label="Win Rate" value={winRate} className="px-1" />
                    </section>

                    {/* Recent history */}
                    <section>
                        <div className="flex items-center gap-2 mb-3 px-2 mt-4">
                            <History className="w-5 h-5 text-secondaryText" />
                            <h3 className="text-sm font-bold tracking-widest uppercase text-secondaryText">Recent History</h3>
                        </div>
                        {history.length === 0 ? (
                            <p className="text-secondaryText text-sm px-2">No completed matches yet.</p>
                        ) : (
                            <Card className="divide-y divide-borderColor/50">
                                {history.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer"
                                        onClick={() => navigate(`/history/${item.id}`)}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <span className="font-bold text-white block">{item.courseName} • {item.format}</span>
                                            <span className="text-xs text-secondaryText block mt-0.5">{item.playerLabel}</span>
                                            <span className="text-xs text-secondaryText uppercase tracking-wider">
                                                {formatDate(item.createdAt)} • {item.wagerType}
                                            </span>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <div className={`font-black text-base leading-tight ${item.payout > 0 ? 'text-neonGreen' : item.payout < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                {item.payout > 0 ? `+$${item.payout}` : item.payout < 0 ? `-$${Math.abs(item.payout)}` : 'PUSH'}
                                            </div>
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${item.holesUp > 0 ? 'text-neonGreen' : item.holesUp < 0 ? 'text-bloodRed' : 'text-secondaryText'}`}>
                                                {item.holesUp > 0 ? `${item.holesUp} UP` : item.holesUp < 0 ? `${Math.abs(item.holesUp)} DN` : 'A/S'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </Card>
                        )}
                    </section>

                    {/* CTA: other → friend, own → dashboard-style footer */}
                    {!isOwnProfile && (
                        <div className="pb-4 mt-6">
                            {!friendship ? (
                                <Button
                                    className="w-full"
                                    onClick={() => { if (user && userId) sendFriendRequest(user.id, userId); }}
                                >
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Add Friend
                                </Button>
                            ) : friendship.status === 'accepted' ? (
                                <div className="flex items-center justify-center gap-2 py-3 rounded-xl border border-neonGreen/30 bg-neonGreen/5 text-neonGreen font-bold tracking-wider uppercase text-sm">
                                    <Check className="w-4 h-4" />
                                    Friends
                                </div>
                            ) : (
                                <div className="flex items-center justify-center py-3 rounded-xl border border-borderColor text-secondaryText font-bold tracking-wider uppercase text-sm">
                                    Request Sent
                                </div>
                            )}
                        </div>
                    )}
                </main>
            )}

            {isOwnProfile && profileData && (
                <div className="bg-background border-t border-borderColor p-3 sm:p-4 flex gap-2 sm:gap-3 z-20 shrink-0 pb-safe mt-6">
                    <Button variant="outline" size="sm" className="flex-1 h-12 sm:h-14 font-bold uppercase tracking-wider text-sm sm:text-base" onClick={() => navigate('/join')}>
                        Join Match
                    </Button>
                    <Button size="lg" className="flex-[2] h-12 sm:h-14 text-sm sm:text-base uppercase tracking-widest font-black shadow-[0_0_20px_rgba(255,0,63,0.4)]" onClick={() => navigate('/setup')}>
                        Start New Match
                    </Button>
                </div>
            )}
        </div>
    );
}
