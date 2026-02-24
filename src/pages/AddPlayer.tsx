import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Search, Loader, UserPlus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';
import { useFriendsStore } from '../store/useFriendsStore';

interface ProfileRow {
    id: string;
    fullName: string;
    handicap: number;
    avatarUrl?: string;
    isGrint?: boolean;
    username?: string;
}

// generateUUID() requires iOS 15.4+ — use a safe fallback for older iPhones
function generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export default function AddPlayerPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const team = (searchParams.get('team') ?? 'B') as 'A' | 'B';
    const { user } = useAuth();
    const { stagedPlayers, stagePlayer } = useMatchStore();
    const { friendships, loadFriendships, sendFriendRequest } = useFriendsStore();

    const [mode, setMode] = useState<'search' | 'guest'>('search');

    // Search state
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<ProfileRow[]>([]);
    const [recentPartners, setRecentPartners] = useState<ProfileRow[]>([]);
    const [allPlayers, setAllPlayers] = useState<ProfileRow[]>([]);
    const [searching, setSearching] = useState(false);

    // Guest state
    const [guestName, setGuestName] = useState('');
    const [guestHandicap, setGuestHandicap] = useState(0);

    // Load recent playing partners and friends on mount
    useEffect(() => {
        if (!user) return;

        loadFriendships(user.id);

        async function loadInitialList() {
            const { data: myMatches } = await supabase
                .from('match_players')
                .select('match_id')
                .eq('user_id', user!.id)
                .limit(20);

            const seen = new Set<string>();
            const rows: ProfileRow[] = [];

            if (myMatches && myMatches.length > 0) {
                const matchIds = myMatches.map((m: { match_id: string }) => m.match_id);

                const { data: partners } = await supabase
                    .from('match_players')
                    .select('user_id, profiles(id, full_name, handicap, avatar_url)')
                    .in('match_id', matchIds)
                    .neq('user_id', user!.id)
                    .limit(10);

                if (partners) {
                    for (const p of partners as unknown as { user_id: string; profiles: { id: string; full_name: string; handicap: number; avatar_url: string | null } | null }[]) {
                        if (p.profiles && p.profiles.full_name && p.profiles.full_name.trim() !== '' && !seen.has(p.user_id)) {
                            seen.add(p.user_id);
                            rows.push({ id: p.user_id, fullName: p.profiles.full_name, handicap: p.profiles.handicap, avatarUrl: p.profiles.avatar_url ?? undefined });
                        }
                    }
                    setRecentPartners(rows);
                }
            }

            // Also fetch some random/all users for general browsing
            const { data: globalUsers } = await supabase
                .from('profiles')
                .select('id, full_name, handicap, avatar_url')
                .neq('id', user!.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (globalUsers) {
                const globals: ProfileRow[] = [];
                for (const row of globalUsers as { id: string; full_name: string; handicap: number; avatar_url: string | null }[]) {
                    // Don't duplicate if they are already in recents
                    if (!seen.has(row.id) && row.full_name && row.full_name.trim() !== '') {
                        globals.push({ id: row.id, fullName: row.full_name, handicap: row.handicap, avatarUrl: row.avatar_url ?? undefined });
                    }
                }
                setAllPlayers(globals);
            }
        }
        loadInitialList();
    }, [user]);

    async function handleSearch() {
        if (!search.trim()) return;
        setSearching(true);
        setResults([]); // clear early

        const searchTerm = search.trim();

        // 1. Search Local Profiles
        const { data: localData } = await supabase
            .from('profiles')
            .select('id, full_name, handicap, avatar_url')
            .ilike('full_name', `%${searchTerm}%`)
            .neq('id', user?.id ?? '')
            .limit(10);

        const localProfiles: ProfileRow[] = [];
        for (const row of localData ?? []) {
            if (row.full_name && row.full_name.trim() !== '') {
                localProfiles.push({
                    id: row.id,
                    fullName: row.full_name,
                    handicap: row.handicap,
                    avatarUrl: row.avatar_url ?? undefined,
                });
            }
        }

        // 2. Search The Grint Network via Edge Function
        let grintProfiles: ProfileRow[] = [];
        try {
            const { data: grintRes, error } = await supabase.functions.invoke('grint-search', {
                body: { search: searchTerm }
            });
            if (grintRes && grintRes.data) {
                grintProfiles = grintRes.data.map((grintUser: any) => ({
                    id: `grint-${grintUser.id}`,
                    fullName: grintUser.name.trim(),
                    handicap: parseFloat(grintUser.handicap) || 0,
                    avatarUrl: `https://profile.static.thegrint.com/thumb_${grintUser.image}`,
                    isGrint: true,
                    username: grintUser.username,
                }));
            }
        } catch (err) {
            console.error('Grint search failed', err);
        }

        setSearching(false);
        setResults([...localProfiles, ...grintProfiles]);
    }

    function handleSelectRegistered(p: ProfileRow) {
        if (p.isGrint) {
            // Treat Grint players as ghosts/guests so we don't trip foreign key constraints on the backend
            stagePlayer({ userId: generateUUID(), fullName: p.fullName, handicap: p.handicap, team, avatarUrl: p.avatarUrl, isGuest: true });
        } else {
            stagePlayer({ userId: p.id, fullName: p.fullName, handicap: p.handicap, team, avatarUrl: p.avatarUrl });
        }
        navigate('/setup');
    }

    function handleAddGuest() {
        if (!guestName.trim()) return;
        const guestId = generateUUID();
        stagePlayer({ userId: guestId, fullName: guestName.trim(), handicap: guestHandicap, team, isGuest: true });
        navigate('/setup');
    }

    function PlayerRow({ p }: { p: ProfileRow }) {
        const isStaged = stagedPlayers.some((sp) => sp.userId === p.id);
        return (
            <div className="p-3.5 flex items-center justify-between hover:bg-surfaceHover transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold text-white text-sm overflow-hidden shrink-0">
                        {p.avatarUrl && !p.avatarUrl.includes('profile_default.jpg') ? (
                            <img src={p.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            p.fullName.slice(0, 1).toUpperCase()
                        )}
                    </div>
                    <div>
                        <span className="font-bold text-sm flex items-center gap-2">
                            {p.fullName}
                            {p.isGrint && (
                                <span className="bg-[#4277b9] text-white text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase">Grint</span>
                            )}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-secondaryText uppercase tracking-widest font-bold">HCP {p.handicap.toFixed(1)}</span>
                            {p.username && <span className="text-[10px] text-secondaryText italic border-l border-borderColor pl-2">@{p.username.split('@')[0]}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!p.isGrint && user?.id !== p.id && !friendships.some(f => f.requesterId === p.id || f.addresseeId === p.id) && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (user) sendFriendRequest(user.id, p.id);
                            }}
                            className="w-8 h-8 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors"
                            title="Add Friend"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleSelectRegistered(p)} disabled={isStaged} className="text-xs h-8 px-3 shrink-0 w-16">
                        {isStaged ? 'Added' : 'Add'}
                    </Button>
                </div>
            </div>
        );
    }

    const acceptedFriends: ProfileRow[] = friendships
        .filter(f => f.status === 'accepted' && f.friendProfile)
        .map(f => ({
            id: f.friendProfile!.id,
            fullName: f.friendProfile!.fullName,
            handicap: f.friendProfile!.handicap,
            avatarUrl: f.friendProfile!.avatarUrl
        }));

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header - Stationary */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor shrink-0 bg-background z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg tracking-wide uppercase">Add Player to Team {team}</span>
                <div className="w-10" />
            </header>

            {/* Mode toggle - Stationary */}
            <div className="flex border-b border-borderColor bg-background shrink-0 z-10">
                <button
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'search' ? 'text-white border-b-2 border-bloodRed' : 'text-secondaryText'}`}
                    onClick={() => setMode('search')}
                >
                    Search Players
                </button>
                <button
                    className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${mode === 'guest' ? 'text-white border-b-2 border-bloodRed' : 'text-secondaryText'}`}
                    onClick={() => setMode('guest')}
                >
                    <UserPlus className="w-4 h-4" /> Add as Guest
                </button>
            </div>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto momentum-scroll">

                {mode === 'search' && (
                    <>
                        {/* Search Input - Stationary in the scroll view or moving? Let's make it moving for more space */}
                        <div className="bg-background px-4 py-3 border-b border-borderColor/50">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-5 w-5 text-secondaryText" />
                                    </div>
                                    <input
                                        type="text"
                                        className="block w-full pl-10 pr-3 py-3 border border-borderColor rounded-xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-1 focus:ring-bloodRed focus:border-bloodRed sm:text-sm transition-all"
                                        placeholder="Name, Email, or Username"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>
                                <Button variant="outline" onClick={handleSearch} disabled={searching} className="px-4">
                                    {searching ? <Loader className="w-4 h-4 animate-spin" /> : 'Search'}
                                </Button>
                            </div>
                        </div>

                        <main className="p-4 space-y-8 mt-2 pb-12">
                            {results.length > 0 && (
                                <section>
                                    <h3 className="text-secondaryText text-xs font-bold uppercase tracking-widest pl-2 mb-3">Search Results</h3>
                                    <Card className="divide-y divide-borderColor/50">
                                        {results.map((p) => <PlayerRow key={p.id} p={p} />)}
                                    </Card>
                                </section>
                            )}

                            {acceptedFriends.length > 0 && results.length === 0 && search.trim() === '' && (
                                <section>
                                    <h3 className="text-secondaryText text-xs font-bold uppercase tracking-widest pl-2 mb-3">My Friends</h3>
                                    <Card className="divide-y divide-borderColor/50">
                                        {acceptedFriends.map((p) => <PlayerRow key={`friend-${p.id}`} p={p} />)}
                                    </Card>
                                </section>
                            )}

                            {recentPartners.length > 0 && results.length === 0 && search.trim() === '' && (
                                <section>
                                    <h3 className="text-secondaryText text-xs font-bold uppercase tracking-widest pl-2 mb-3">Recent Playing Partners</h3>
                                    <Card className="divide-y divide-borderColor/50">
                                        {recentPartners.filter(p => !acceptedFriends.some(f => f.id === p.id)).map((p) => <PlayerRow key={`recent-${p.id}`} p={p} />)}
                                    </Card>
                                </section>
                            )}

                            {allPlayers.length > 0 && results.length === 0 && search.trim() === '' && (
                                <section>
                                    <h3 className="text-secondaryText text-xs font-bold uppercase tracking-widest pl-2 mb-3">Community Players</h3>
                                    <Card className="divide-y divide-borderColor/50">
                                        {allPlayers.map((p) => <PlayerRow key={p.id} p={p} />)}
                                    </Card>
                                </section>
                            )}

                            {recentPartners.length === 0 && allPlayers.length === 0 && results.length === 0 && search.trim() === '' && (
                                <div className="text-secondaryText text-sm px-2 mt-4 text-center space-y-2">
                                    <p>Search BloodSheet or The Grint by Name, Email, or Username to add them to Team {team}.</p>
                                    <p>If they don't have an account, add them as a Guest!</p>
                                </div>
                            )}
                        </main>
                    </>
                )}

                {mode === 'guest' && (
                    <main className="p-4 space-y-6 mt-2">
                        <Card className="p-4 space-y-5">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-secondaryText block mb-2">Guest Name</label>
                                <input
                                    type="text"
                                    className="block w-full px-4 py-3 border border-borderColor rounded-xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-1 focus:ring-bloodRed focus:border-bloodRed text-sm transition-all"
                                    placeholder="Enter name…"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-secondaryText block mb-2">Handicap</label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setGuestHandicap((h) => Math.max(0, parseFloat((h - 0.5).toFixed(1))))}
                                        className="w-12 h-12 rounded-full bg-surfaceHover flex items-center justify-center text-xl hover:text-bloodRed transition-colors"
                                    >
                                        −
                                    </button>
                                    <span className="text-4xl font-black font-sans w-20 text-center">{guestHandicap.toFixed(1)}</span>
                                    <button
                                        onClick={() => setGuestHandicap((h) => parseFloat((h + 0.5).toFixed(1)))}
                                        className="w-12 h-12 rounded-full bg-surfaceHover flex items-center justify-center text-xl hover:text-neonGreen transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </Card>

                        <Button
                            size="lg"
                            className="w-full font-bold uppercase tracking-wider"
                            onClick={handleAddGuest}
                            disabled={!guestName.trim()}
                        >
                            Add {guestName.trim() || 'Guest'} to Team {team}
                        </Button>
                    </main>
                )}
            </div>
        </div>
    );
}
