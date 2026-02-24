import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, UserPlus, Check, X, Search, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFriendsStore } from '../store/useFriendsStore';
import { supabase } from '../lib/supabase';

export default function FriendsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        friendships,
        loading,
        loadFriendships,
        sendFriendRequest,
        acceptFriendRequest,
        declineOrRemoveFriend,
        subscribeToFriendships,
        unsubscribe
    } = useFriendsStore();

    const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>('friends');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (!user) return;
        loadFriendships(user.id);
        subscribeToFriendships(user.id);

        return () => {
            unsubscribe();
        };
    }, [user]);

    const acceptedFriends = friendships.filter(f => f.status === 'accepted');
    const pendingRequests = friendships.filter(f => f.status === 'pending' && f.addresseeId === user?.id);
    const sentRequests = friendships.filter(f => f.status === 'pending' && f.requesterId === user?.id);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!searchTerm.trim() || !user) return;

        setSearching(true);
        // Search local bloodsheet users matching email or name (exclude self)
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, handicap')
            .ilike('full_name', `%${searchTerm.trim()}%`)
            .neq('id', user.id)
            .limit(10);

        setSearchResults(data || []);
        setSearching(false);
    }

    const renderProfileAvatar = (url?: string, name?: string) => {
        if (url) return <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover border border-borderColor" />;
        const initials = name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';
        return (
            <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold text-white text-sm">
                {initials}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-background/95 backdrop-blur shrink-0 z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg tracking-wide uppercase">Friends Hub</span>
                <div className="w-10" /> {/* Spacer */}
            </header>

            {/* Tabs */}
            <div className="flex p-2 bg-background border-b border-borderColor/50 shrink-0">
                <button
                    className={`flex-1 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === 'friends' ? 'bg-surfaceHover text-white' : 'text-secondaryText hover:text-white/70'}`}
                    onClick={() => setActiveTab('friends')}
                >
                    My Friends ({acceptedFriends.length})
                </button>
                <button
                    className={`flex-1 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest rounded-lg transition-colors relative ${activeTab === 'requests' ? 'bg-surfaceHover text-white' : 'text-secondaryText hover:text-white/70'}`}
                    onClick={() => setActiveTab('requests')}
                >
                    Requests
                    {pendingRequests.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-bloodRed text-white text-[10px] flex items-center justify-center">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    className={`flex-1 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest rounded-lg transition-colors ${activeTab === 'add' ? 'bg-surfaceHover text-white' : 'text-secondaryText hover:text-white/70'}`}
                    onClick={() => setActiveTab('add')}
                >
                    Find
                </button>
            </div>

            <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-4">
                {loading && <div className="flex justify-center p-8"><Loader className="w-8 h-8 animate-spin text-bloodRed" /></div>}

                {!loading && activeTab === 'friends' && (
                    <div className="space-y-2">
                        {acceptedFriends.length === 0 ? (
                            <div className="text-center py-12 text-secondaryText">
                                <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p className="font-bold tracking-wider uppercase">No friends yet</p>
                                <p className="text-sm mt-2">Go to Find to add some players.</p>
                            </div>
                        ) : (
                            acceptedFriends.map(f => (
                                <div key={f.id} className="flex items-center justify-between p-3 sm:p-4 bg-surface rounded-xl border border-borderColor">
                                    <div className="flex items-center gap-3">
                                        {renderProfileAvatar(f.friendProfile?.avatarUrl, f.friendProfile?.fullName)}
                                        <div>
                                            <div className="font-bold text-white text-sm sm:text-base">{f.friendProfile?.fullName}</div>
                                            <div className="text-xs text-neonGreen font-black tracking-widest uppercase">IDX: {f.friendProfile?.handicap}</div>
                                        </div>
                                    </div>
                                    <button
                                        className="text-xs font-bold text-bloodRed/70 hover:text-bloodRed tracking-widest uppercase px-3 py-2 bg-surfaceHover rounded-lg"
                                        onClick={() => {
                                            if (window.confirm('Remove this friend?')) declineOrRemoveFriend(f.id);
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!loading && activeTab === 'requests' && (
                    <div className="space-y-6">
                        {/* INBOX */}
                        <section>
                            <h3 className="text-xs font-bold tracking-widest text-secondaryText uppercase mb-3 pl-1">Incoming ({pendingRequests.length})</h3>
                            {pendingRequests.length === 0 ? (
                                <p className="text-sm text-secondaryText/50 pl-1 italic">No pending requests</p>
                            ) : (
                                <div className="space-y-2">
                                    {pendingRequests.map(f => (
                                        <div key={f.id} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-borderColor">
                                            <div className="flex items-center gap-3">
                                                {renderProfileAvatar(f.friendProfile?.avatarUrl, f.friendProfile?.fullName)}
                                                <div className="font-bold text-white text-sm sm:text-base">{f.friendProfile?.fullName}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => declineOrRemoveFriend(f.id)}
                                                    className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center hover:bg-bloodRed/20 hover:text-bloodRed transition-colors text-secondaryText"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => acceptFriendRequest(f.id)}
                                                    className="w-10 h-10 rounded-full bg-surfaceHover border border-neonGreen/30 flex items-center justify-center bg-neonGreen/10 text-neonGreen hover:bg-neonGreen hover:text-black transition-colors"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* OUTBOX */}
                        <section>
                            <h3 className="text-xs font-bold tracking-widest text-secondaryText uppercase mb-3 pl-1">Sent</h3>
                            {sentRequests.length === 0 ? (
                                <p className="text-sm text-secondaryText/50 pl-1 italic">No sent requests</p>
                            ) : (
                                <div className="space-y-2">
                                    {sentRequests.map(f => (
                                        <div key={f.id} className="flex items-center justify-between p-3 border border-borderColor/30 rounded-xl opacity-75">
                                            <div className="flex items-center gap-3">
                                                {renderProfileAvatar(f.friendProfile?.avatarUrl, f.friendProfile?.fullName)}
                                                <div className="font-bold text-white text-sm sm:text-base">{f.friendProfile?.fullName}</div>
                                            </div>
                                            <div className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Pending</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {!loading && activeTab === 'add' && (
                    <div className="space-y-4">
                        <form onSubmit={handleSearch} className="relative">
                            <input
                                type="text"
                                placeholder="Search BloodSheet users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-surface border border-borderColor rounded-xl pl-12 pr-4 py-4 text-white placeholder-secondaryText focus:outline-none focus:border-bloodRed transition-colors"
                            />
                            <Search className="w-5 h-5 text-secondaryText absolute left-4 top-4" />
                            <button type="submit" className="hidden" />
                        </form>

                        {searching ? (
                            <div className="flex justify-center p-8"><Loader className="w-8 h-8 animate-spin text-bloodRed" /></div>
                        ) : (
                            <div className="space-y-2 mt-4">
                                {searchResults.map(res => {
                                    // Check if we are already friends or pending with this user
                                    const existingRel = friendships.find(f => f.requesterId === res.id || f.addresseeId === res.id);

                                    return (
                                        <div key={res.id} className="flex items-center justify-between p-3 bg-surface rounded-xl border border-borderColor">
                                            <div className="flex items-center gap-3">
                                                {renderProfileAvatar(res.avatar_url, res.full_name)}
                                                <div>
                                                    <div className="font-bold text-white text-sm sm:text-base">{res.full_name}</div>
                                                    <div className="text-xs text-neonGreen font-black tracking-widest uppercase">IDX: {res.handicap}</div>
                                                </div>
                                            </div>

                                            {existingRel ? (
                                                <div className="text-[10px] font-bold text-secondaryText tracking-widest uppercase px-3 py-2 bg-background rounded-lg">
                                                    {existingRel.status === 'accepted' ? 'Friends' : 'Pending'}
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        if (user) sendFriendRequest(user.id, res.id);
                                                    }}
                                                    className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors"
                                                >
                                                    <UserPlus className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {!searching && searchResults.length === 0 && searchTerm && (
                                    <p className="text-secondaryText text-center py-8">No matching players found.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
