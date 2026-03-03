import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Send, Trash2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import SEO from '../components/SEO';
import { motion } from 'framer-motion';

interface Message {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles?: {
        full_name: string;
        avatar_url: string;
    };
}

export default function ChatRoomPage() {
    const { chatId } = useParams<{ chatId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [chatDetails, setChatDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!user || !chatId) return;

        const loadChat = async () => {
            setLoading(true);
            try {
                // Fetch other participant profile if direct chat
                const { data: participants } = await supabase
                    .from('chat_participants')
                    .select('user_id, profiles(full_name, avatar_url)')
                    .eq('chat_id', chatId);

                if (participants) {
                    const otherPerson = participants.find(p => p.user_id !== user.id);
                    if (otherPerson) {
                        const profiles = otherPerson.profiles as any;
                        setChatDetails({
                            name: profiles?.full_name || 'Chat',
                            avatar: profiles?.avatar_url,
                            type: 'direct' // Assuming a chat room routed by chatId is direct if loaded via MessagesInbox
                        });
                    }
                }

                // Fetch historic messages
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('*, profiles:user_id(full_name, avatar_url)')
                    .eq('chat_id', chatId)
                    .order('created_at', { ascending: true });

                if (msgs) {
                    setMessages(msgs as any);
                    setTimeout(scrollToBottom, 100);
                }

                // Update last read
                await supabase
                    .from('chat_participants')
                    .update({ last_read_at: new Date().toISOString() })
                    .eq('chat_id', chatId)
                    .eq('user_id', user.id);
            } catch (error) {
                console.error("Failed to load chat", error);
            } finally {
                setLoading(false);
            }
        };

        loadChat();

        // Subscribe to new messages
        const channel = supabase
            .channel(`chat_${chatId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `chat_id=eq.${chatId}`
            }, async (payload) => {
                const newMsg = payload.new as any;
                // Fetch the profile for the new message
                const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', newMsg.user_id).single();

                const completeMsg: Message = {
                    ...newMsg,
                    profiles: profile || undefined
                };

                setMessages(prev => [...prev, completeMsg]);
                setTimeout(scrollToBottom, 100);

                // Update last read
                if (newMsg.user_id !== user.id) {
                    supabase.from('chat_participants').update({ last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', user.id);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId, user]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || !user || !chatId) return;

        setNewMessage(''); // optimistic clear

        try {
            const { error } = await supabase.from('messages').insert({
                chat_id: chatId,
                user_id: user.id,
                content: text
            });
            if (error) throw error;
        } catch (error) {
            console.error("Failed to send message", error);
            alert("Failed to send message.");
        }
    };

    const handleDeleteChat = async () => {
        if (!chatId) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from('chats').delete().eq('id', chatId);
            if (error) throw error;
            navigate('/messages', { replace: true });
        } catch (err) {
            console.error("Failed to delete chat", err);
            alert("Failed to delete chat: " + (err as any).message);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] w-full max-w-md landscape:max-w-none lg:landscape:max-w-md mx-auto bg-background relative overflow-hidden">
            <SEO title={chatDetails?.name || 'Chat'} />

            {/* Header */}
            <div className="shrink-0 h-16 px-4 border-b border-white/10 bg-surface/80 backdrop-blur-md flex items-center justify-between z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full text-secondaryText hover:text-white hover:bg-white/5 transition-all"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    {chatDetails && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-black text-white shrink-0 overflow-hidden shadow-inner">
                                {chatDetails.avatar ? (
                                    <img src={chatDetails.avatar} alt={chatDetails.name} className="w-full h-full object-cover" />
                                ) : (
                                    chatDetails.name.slice(0, 2).toUpperCase()
                                )}
                            </div>
                            <h1 className="text-lg font-black uppercase italic tracking-wider text-white">
                                {chatDetails.name}
                            </h1>
                        </div>
                    )}
                </div>
                {chatDetails?.type === 'direct' && (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 -mr-2 rounded-full text-secondaryText hover:text-bloodRed overflow-hidden transition-all"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface border border-bloodRed/30 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-[0_0_40px_rgba(255,0,63,0.15)]">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-bloodRed">Delete Chat?</h3>
                            <button onClick={() => setShowDeleteConfirm(false)} className="p-1 rounded-full text-secondaryText hover:text-white hover:bg-white/5 transition-all"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-secondaryText font-medium leading-relaxed">
                            This will <span className="font-bold text-bloodRed uppercase italic">permanently erase</span> this conversation for both participants. This action cannot be undone.
                        </p>
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                onClick={handleDeleteChat}
                                disabled={deleting}
                                className="w-full bg-bloodRed hover:bg-bloodRed/80 rounded-lg py-3.5 text-white uppercase font-black italic tracking-widest text-xs shadow-[0_0_20px_rgba(255,0,63,0.3)] disabled:opacity-50 transition-all flex justify-center items-center"
                            >
                                {deleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                                className="w-full bg-transparent border border-borderColor rounded-lg py-3.5 text-secondaryText uppercase font-black italic tracking-widest text-xs disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-4 no-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-bloodRed border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(255,0,63,0.5)]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-secondaryText text-center px-6">
                        <div className="w-16 h-16 rounded-full bg-surface border border-borderColor mb-4 flex items-center justify-center">
                            <Send className="w-6 h-6 opacity-30" />
                        </div>
                        <p className="font-bold tracking-widest uppercase text-sm mb-2">Start the banter</p>
                        <p className="text-xs">No messages yet. Send a message to get started.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.user_id === user?.id;
                        const showAvatar = !isMe && (idx === 0 || messages[idx - 1].user_id !== msg.user_id);

                        return (
                            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {!isMe && (
                                    <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 border border-white/5 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                                        {msg.profiles?.avatar_url ? (
                                            <img src={msg.profiles.avatar_url} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-surface flex items-center justify-center text-[8px] font-bold text-white">
                                                {msg.profiles?.full_name?.slice(0, 2).toUpperCase() || '?'}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className={`relative max-w-[75%] px-4 py-2.5 rounded-2xl ${isMe
                                        ? 'bg-bloodRed text-white rounded-br-sm'
                                        : 'bg-surface border border-white/5 text-white rounded-bl-sm'
                                        }`}
                                >
                                    <p className="text-sm leading-snug">{msg.content}</p>
                                    <span className="text-[9px] font-medium opacity-50 block mt-1 text-right">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </motion.div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="shrink-0 p-4 bg-background border-t border-white/5">
                <form onSubmit={handleSend} className="flex gap-2 relative">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Message..."
                        className="flex-1 bg-surface border border-borderColor rounded-full pl-5 pr-12 py-3 text-sm text-white focus:outline-none focus:border-bloodRed/50 transition-colors shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-bloodRed text-white flex items-center justify-center shadow-lg disabled:opacity-50 disabled:bg-surface disabled:text-secondaryText transition-all"
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
