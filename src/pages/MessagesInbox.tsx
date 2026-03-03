import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, ChevronLeft, Search, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import SEO from '../components/SEO';
import { EmptyState } from '../components/ui/EmptyState';
import { useFriendsStore } from '../store/useFriendsStore';

export default function MessagesInboxPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { friendships, loadFriendships } = useFriendsStore();
    const [chats, setChats] = useState<any[]>([]);

    useEffect(() => {
        if (user && friendships.length === 0) {
            loadFriendships(user.id);
        }
    }, [user, friendships.length, loadFriendships]);
    const [loading, setLoading] = useState(true);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!user) return;

        const fetchChats = async () => {
            setLoading(true);
            try {
                // Fetch chats the user is participating in
                const { data: participations } = await supabase
                    .from('chat_participants')
                    .select('chat_id, chats!inner(type, match_id, created_at, messages(content, created_at, user_id))')
                    .eq('user_id', user.id)
                    .eq('chats.type', 'direct')
                    .order('chats(created_at)', { ascending: false });

                if (!participations || participations.length === 0) {
                    setChats([]);
                    return;
                }

                const chatIds = participations.map(p => p.chat_id);

                // Fetch other participants for these chats to get names/avatars
                const { data: otherParticipants } = await supabase
                    .from('chat_participants')
                    .select('chat_id, user_id, profiles(full_name, avatar_url)')
                    .in('chat_id', chatIds)
                    .neq('user_id', user.id);

                const finalChats = participations.map(p => {
                    const chat = p.chats as any;
                    // Supabase nested queries might return arrays for messages if not limited, but let's grab the latest via a subquery or JS sort
                    // Since it's unstructured, we sort in JS for now (limit is better done in a view or rpc, but this works for small scale)
                    const latestMessage = chat.messages && chat.messages.length > 0
                        ? [...chat.messages].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                        : null;

                    const otherPerson = otherParticipants?.find(op => op.chat_id === p.chat_id);

                    const profiles = otherPerson?.profiles as any;

                    return {
                        id: p.chat_id,
                        type: chat.type,
                        created_at: chat.created_at,
                        latestMessage: latestMessage,
                        otherPerson: otherPerson ? {
                            id: otherPerson.user_id,
                            fullName: profiles?.full_name || 'Someone',
                            avatarUrl: profiles?.avatar_url
                        } : { fullName: 'Unknown User' }
                    };
                });

                // Sort by latest message time
                finalChats.sort((a, b) => {
                    const timeA = a.latestMessage ? new Date(a.latestMessage.created_at).getTime() : new Date(a.created_at).getTime();
                    const timeB = b.latestMessage ? new Date(b.latestMessage.created_at).getTime() : new Date(b.created_at).getTime();
                    return timeB - timeA;
                });

                setChats(finalChats);
            } catch (error) {
                console.error('Error fetching chats', error);
            } finally {
                setLoading(false);
            }
        };

        fetchChats();

        // Optional realtime subscription to refresh the inbox if a new message arrives
        const channel = supabase
            .channel('inbox-updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, _payload => {
                // For simplicity, just refetch everything, but you could optimistically update
                fetchChats();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const handleCreateChat = async (friendId: string) => {
        if (!user) return;

        try {
            // First check if a direct chat already exists between these two users
            // A bit complex in SQL without RPC, so we fetch chats for user, then see if friend is in it
            const { data: myChats } = await supabase.from('chat_participants').select('chat_id, chats!inner(type)').eq('user_id', user.id).eq('chats.type', 'direct');
            if (myChats && myChats.length > 0) {
                const myChatIds = myChats.map(c => c.chat_id);
                const { data: sharedChats } = await supabase.from('chat_participants').select('chat_id').in('chat_id', myChatIds).eq('user_id', friendId);

                if (sharedChats && sharedChats.length > 0) {
                    // Chat already exists! Navigate to it.
                    navigate(`/chat/${sharedChats[0].chat_id}`);
                    return;
                }
            }

            // Create new chat
            const { data: newChat, error: chatError } = await supabase.from('chats').insert({ type: 'direct' }).select('id').single();
            if (chatError) throw chatError;

            // Add participants
            const { error: partError } = await supabase.from('chat_participants').insert([
                { chat_id: newChat.id, user_id: user.id },
                { chat_id: newChat.id, user_id: friendId }
            ]);
            if (partError) throw partError;

            // Navigate to new chat
            navigate(`/chat/${newChat.id}`);
        } catch (error) {
            console.error('Error creating chat:', error);
            alert('Failed to start a new chat.');
        }
    };

    const activeFriends = friendships.filter(f => f.status === 'accepted');
    const filteredFriends = activeFriends.filter(f => f.friendProfile?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <SEO title="Locker Room" />

            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <MessageSquare className="w-64 h-64 text-white" />
            </div>

            <div className="shrink-0 p-4 border-b border-white/10 bg-surface/50 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full text-secondaryText hover:text-white hover:bg-white/5 transition-all"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-bloodRed/20 flex items-center justify-center border border-bloodRed/30 shadow-[0_0_15px_rgba(255,0,63,0.3)]">
                        <MessageSquare className="w-4 h-4 text-bloodRed" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black italic uppercase tracking-wider text-white leading-none">Locker Room</h1>
                        <p className="text-[10px] text-neonGreen font-black uppercase tracking-widest mt-0.5">Direct Messages</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowNewChatModal(true)}
                    className="p-2 rounded-full bg-surfaceHover border border-borderColor text-white hover:text-neonGreen transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <div className="px-4 py-6 max-w-lg mx-auto w-full">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-bloodRed border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(255,0,63,0.5)]" />
                        </div>
                    ) : chats.length === 0 ? (
                        <EmptyState
                            title="Quiet Locker Room"
                            description="Start some trash talk with your friends."
                            actionLabel="New Message"
                            onAction={() => setShowNewChatModal(true)}
                            accentColor="bloodRed"
                        />
                    ) : (
                        <div className="space-y-2">
                            {chats.map(chat => {
                                const p = chat.otherPerson;
                                const initials = p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => navigate(`/chat/${chat.id}`)}
                                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-all active:scale-[0.98] text-left"
                                    >
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-black text-white shrink-0 overflow-hidden shadow-inner">
                                                {p.avatarUrl ? (
                                                    <img src={p.avatarUrl} alt={p.fullName} className="w-full h-full object-cover" />
                                                ) : (
                                                    initials
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-white tracking-wide truncate">{p.fullName}</span>
                                                <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest shrink-0 ml-2">
                                                    {chat.latestMessage ? new Date(chat.latestMessage.created_at).toLocaleDateString() : ''}
                                                </span>
                                            </div>
                                            <p className="text-secondaryText text-sm line-clamp-1 italic">
                                                {chat.latestMessage
                                                    ? `${chat.latestMessage.user_id === user?.id ? 'You: ' : ''}${chat.latestMessage.content}`
                                                    : 'Start chatting...'}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* New Chat Modal */}
            <AnimatePresence>
                {showNewChatModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowNewChatModal(false)}
                        className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
                    >
                        <motion.div
                            initial={{ y: "100%", opacity: 0.5 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100%", opacity: 0.5 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full sm:max-w-md bg-background border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] h-[600px]"
                        >
                            <div className="shrink-0 p-4 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white italic">New Message</h2>
                                <button
                                    onClick={() => setShowNewChatModal(false)}
                                    className="p-2 rounded-full hover:bg-white/5 text-secondaryText transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="shrink-0 p-4 border-b border-borderColor bg-surface">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondaryText" />
                                    <input
                                        type="text"
                                        placeholder="Search friends..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-background border border-borderColor rounded-xl text-white placeholder:text-secondaryText font-medium focus:outline-none focus:border-bloodRed transition-colors"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {filteredFriends.length === 0 ? (
                                    <div className="text-center py-10 text-secondaryText font-bold">
                                        No friends found
                                    </div>
                                ) : (
                                    filteredFriends.map(friend => {
                                        const p = friend.friendProfile;
                                        if (!p) return null;
                                        const initials = p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                                        return (
                                            <button
                                                key={friend.id}
                                                onClick={() => handleCreateChat(p.id)}
                                                className="w-full flex items-center gap-4 p-3 rounded-xl bg-surfaceHover border border-white/5 hover:border-bloodRed/50 transition-all text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-background border border-borderColor flex items-center justify-center font-black text-white shrink-0 overflow-hidden shadow-inner">
                                                    {p.avatarUrl ? (
                                                        <img src={p.avatarUrl} alt={p.fullName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        initials
                                                    )}
                                                </div>
                                                <span className="font-bold text-white group-hover:text-bloodRed transition-colors">{p.fullName}</span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
