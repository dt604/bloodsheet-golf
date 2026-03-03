import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { History, UserPlus, Check, Loader, Crown, Camera } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatBox } from '../components/ui/StatBox';
import { useAuth } from '../contexts/AuthContext';
import { useFriendsStore } from '../store/useFriendsStore';
import { supabase } from '../lib/supabase';
import SEO from '../components/SEO';

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

    useEffect(() => {
        if (user && !isOwnProfile) {
            loadFriendships(user.id);
        }
    }, [user, isOwnProfile]);

    useEffect(() => {
        if (!userId) return;

        async function load() {
            setLoadingProfile(true);

            const { data: prof } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, handicap, created_at')
                .eq('id', userId!)
                .single();

            if (!prof) {
                setLoadingProfile(false);
                return;
            }

            setProfileData({
                id: prof.id,
                fullName: prof.full_name,
                avatarUrl: prof.avatar_url ?? undefined,
                handicap: prof.handicap ?? 0,
                createdAt: prof.created_at,
            });
            setLoadingProfile(false);

            const { data: userMatchPlayers } = await supabase
                .from('match_players')
                .select('match_id, team')
                .eq('user_id', userId!);

            const allMatchIds = (userMatchPlayers ?? []).map((mp) => mp.match_id as string);
            if (allMatchIds.length === 0) return;

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
                    const sideBets = matchRow.side_bets as any;
                    const courseData = matchRow.courses as any;

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
                                const s = matchScores.find(sc => (sc as any).hole_number === hole && (sc as any).player_id === pRow.user_id);
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
                        const par = courseData?.holes?.find((h: any) => h.number === hole)?.par ?? 4;
                        const birdsDouble = sideBets?.birdiesDouble ?? false;
                        const myBird = myScores.some(s => s.gross < par);
                        const oppBird = oppScores.some(s => s.gross < par);

                        if (format === '2v2') {
                            let my = 0, opp = 0;
                            const myLow = Math.min(...myNets), oppLow = Math.min(...oppNets);
                            if (myLow < oppLow) my += (birdsDouble && myBird) ? 2 : 1;
                            else if (oppLow < myLow) opp += (birdsDouble && oppBird) ? 2 : 1;
                            const mySum = myNets.reduce((a, b) => a + b, 0);
                            const oppSum = oppNets.reduce((a, b) => a + b, 0);
                            if (mySum < oppSum) my += (birdsDouble && myBird) ? 2 : 1;
                            else if (oppSum < mySum) opp += (birdsDouble && oppBird) ? 2 : 1;
                            return { my, opp };
                        }
                        if (myNets[0] < oppNets[0]) return { my: (birdsDouble && myBird) ? 2 : 1, opp: 0 };
                        if (oppNets[0] < myNets[0]) return { my: 0, opp: (birdsDouble && oppBird) ? 2 : 1 };
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
                        return myPts > oppPts ? wagerAmount : (oppPts > myPts ? -wagerAmount : 0);
                    }

                    const front9 = holesPlayed.filter(h => h <= 9);
                    const back9 = holesPlayed.filter(h => h > 9);
                    const matchPayout = (front9.length >= 9 ? nassauResult(front9) : 0) + (back9.length >= 9 ? nassauResult(back9) : 0) + (holesPlayed.length >= 18 ? nassauResult(holesPlayed) : 0);

                    let totalMyPts = 0, totalOppPts = 0;
                    for (const h of holesPlayed) {
                        const { my, opp } = holePoints(h);
                        totalMyPts += my; totalOppPts += opp;
                    }

                    if (format === 'skins') {
                        // Skins omitted for profile summary simplicity/performance
                        payoutMap[matchId] = { payout: 0, holesUp: 0 };
                    } else {
                        payoutMap[matchId] = { payout: matchPayout, holesUp: totalMyPts - totalOppPts };
                        lifetimePayout += matchPayout;
                        if (matchPayout > 0) wins++;
                    }
                }

                setHistory(prev => prev.map(item => ({
                    ...item,
                    payout: payoutMap[item.id]?.payout ?? 0,
                    holesUp: payoutMap[item.id]?.holesUp ?? 0,
                })));
                setStats(prev => ({ ...prev, wins, lifetimePayout }));
            }
        }
        load();
    }, [userId]);

    const friendship = friendships.find(f => f.requesterId === userId || f.addresseeId === userId);



    const initials = profileData?.fullName
        ? profileData.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const memberYear = profileData?.createdAt ? new Date(profileData.createdAt).getFullYear() : '—';
    const winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) + '%' : '—';

    return (
        <div className="space-y-12">
            <SEO title={profileData?.fullName ? `${profileData.fullName} | Player Profile` : "Player Profile"} />

            {loadingProfile ? (
                <div className="flex items-center justify-center py-20">
                    <Loader className="w-8 h-8 animate-spin text-bloodRed" />
                </div>
            ) : !profileData ? (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-surfaceHover border-2 border-borderColor flex items-center justify-center text-3xl font-black text-secondaryText">?</div>
                    <p className="font-bold text-white text-lg">Guest Player</p>
                    <p className="text-secondaryText text-sm">This player doesn't have a BloodSheet account.</p>
                </div>
            ) : (
                <div className="space-y-10">
                    {/* Identity card */}
                    <section className="bg-surface rounded-2xl p-6 border border-borderColor flex flex-col items-center relative overflow-hidden">
                        <div className={`w-20 h-20 bg-surfaceHover border-2 border-bloodRed rounded-full flex items-center justify-center font-bold text-3xl mb-4 relative shadow-[0_0_15px_rgba(255,0,63,0.3)] overflow-hidden transition-transform ${isOwnProfile ? 'group cursor-pointer hover:scale-105' : ''}`}>
                            {profileData.avatarUrl ? (
                                <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                initials
                            )}
                            {isOwnProfile && (
                                <label className="absolute inset-0 bg-background/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity z-10 w-full h-full">
                                    {uploadingImage ? <Loader className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6 text-bloodRed" />}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingImage} />
                                </label>
                            )}
                        </div>
                        <h2 className="text-3xl font-black tracking-tight mb-1 truncate max-w-full px-2">{profileData.fullName}</h2>
                        {stats.lifetimePayout > 0 && stats.totalMatches > 0 && (
                            <div className="flex items-center justify-center gap-1.5 mt-1 mb-2 px-3 py-1 rounded-full bg-bloodRed/10 border border-bloodRed/30 shadow-[0_0_10px_rgba(255,0,63,0.15)]">
                                <Crown className="w-4 h-4 text-bloodRed" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-bloodRed">BloodSheet Legend</span>
                            </div>
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-secondaryText mb-8 mt-1 block">
                            Member since {memberYear}
                        </span>

                        <div className="w-full flex">
                            <div className="flex-1 border-r border-borderColor flex flex-col items-center justify-center py-2 px-1">
                                <span className="text-xs uppercase font-bold text-secondaryText tracking-widest mb-1 leading-tight">Index</span>
                                <span className="text-4xl font-black font-sans">{profileData.handicap}</span>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center py-2 px-1">
                                <span className="text-xs uppercase font-bold text-secondaryText tracking-widest mb-1 whitespace-nowrap leading-tight text-center">Total Payout</span>
                                <span className={`text-4xl font-black font-sans ${stats.lifetimePayout >= 0 ? 'text-neonGreen' : 'text-bloodRed'}`}>
                                    {stats.lifetimePayout >= 0 ? '+' : ''}${stats.lifetimePayout}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* Stats grid */}
                    <section className="grid grid-cols-2 gap-3">
                        <StatBox label="Total Matches" value={String(stats.totalMatches)} />
                        <StatBox label="Win Rate" value={winRate} />
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
                                            <span className="font-bold text-white block truncate">{item.courseName}</span>
                                            <span className="text-xs text-secondaryText block mt-0.5">{item.playerLabel} • {item.format}</span>
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

                    {!isOwnProfile && (
                        <div className="pb-4 mt-6">
                            {!friendship ? (
                                <Button className="w-full" onClick={() => { if (user && userId) sendFriendRequest(user.id, userId); }}>
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
                            )
                            }
                        </div>
                    )}

                    {isOwnProfile && (
                        <div className="flex gap-3 pb-8">
                            <Button variant="outline" className="flex-1" onClick={() => navigate('/join')}>Join Match</Button>
                            <Button className="flex-[2] shadow-[0_0_20px_rgba(255,0,63,0.4)]" onClick={() => navigate('/setup')}>Start Match</Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
