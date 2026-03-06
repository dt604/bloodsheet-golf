import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface TrashTalkDrawerProps {
    matchId: string;
    isOpen: boolean;
    onClose: () => void;
    onNewMessage?: (msg: any) => void;
}

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

export function TrashTalkDrawer({ matchId, isOpen, onClose, onNewMessage }: TrashTalkDrawerProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [chatId, setChatId] = useState<string | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const isOpenRef = useRef(isOpen);
    const onNewMessageRef = useRef(onNewMessage);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        onNewMessageRef.current = onNewMessage;
    }, [onNewMessage]);

    useEffect(() => {
        if (!user || !matchId) return;

        const initializeChat = async () => {
            setLoading(true);
            try {
                // Find or create the match chat universally 
                const { data: existingChat } = await supabase
                    .from('chats')
                    .select('id')
                    .eq('match_id', matchId)
                    .eq('type', 'match')
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .maybeSingle();

                let currentChatId = existingChat?.id;

                if (!currentChatId) {
                    await supabase.from('chats').insert({ type: 'match', match_id: matchId });

                    const { data: definitiveChats } = await supabase
                        .from('chats')
                        .select('id')
                        .eq('match_id', matchId)
                        .eq('type', 'match')
                        .order('created_at', { ascending: true })
                        .limit(1);

                    currentChatId = definitiveChats?.[0]?.id;

                    if (currentChatId) {
                        const { data: matchPlayers } = await supabase.from('match_players').select('user_id').eq('match_id', matchId);
                        if (matchPlayers) {
                            const participants = matchPlayers.map(mp => ({ chat_id: currentChatId, user_id: mp.user_id }));
                            await supabase.from('chat_participants').upsert(participants, { onConflict: 'chat_id, user_id' });
                        }
                    }
                }

                if (!currentChatId) return;
                setChatId(currentChatId);

                // Ensure current user is a participant if somehow missing
                await supabase.from('chat_participants').upsert(
                    { chat_id: currentChatId, user_id: user.id, last_read_at: new Date().toISOString() },
                    { onConflict: 'chat_id, user_id' }
                );

                // Fetch historic messages
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('*, profiles:user_id(full_name, avatar_url)')
                    .eq('chat_id', currentChatId)
                    .order('created_at', { ascending: true });

                if (msgs) {
                    setMessages(msgs as any);
                    setTimeout(scrollToBottom, 100);
                }

            } catch (error) {
                console.error("Failed to initialize match chat", error);
            } finally {
                setLoading(false);
            }
        };

        if (!chatId) {
            initializeChat();
        }
    }, [matchId, user?.id, chatId]);

    // Independent useEffect for subscriptions so we don't resubscribe on every re-render
    useEffect(() => {
        if (!chatId || !user) return;

        const channel = supabase
            .channel(`match_chat_${chatId}`)
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

                if (isOpenRef.current) {
                    setTimeout(scrollToBottom, 50);
                    if (newMsg.user_id !== user.id) {
                        supabase.from('chat_participants').update({ last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', user.id);
                    }
                } else if (newMsg.user_id !== user.id) {
                    onNewMessageRef.current?.(completeMsg);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [chatId, user?.id]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || !user || !chatId) return;

        setNewMessage(''); // optimistic clear
        setTimeout(scrollToBottom, 50);

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

    return (
        <BottomSheet
            open={isOpen}
            onClose={onClose}
            title="Trash Talk"
            noPadding
            className="h-[80vh]"
            footer={
                <form onSubmit={handleSend} className="flex gap-2 relative mt-1">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Talk some trash..."
                        className="flex-1 bg-background border border-borderColor rounded-full pl-5 pr-12 py-3 text-sm text-white focus:outline-none focus:border-bloodRed/50 transition-colors shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-bloodRed text-white flex items-center justify-center shadow-[0_0_15px_rgba(255,0,63,0.4)] disabled:opacity-50 disabled:bg-surfaceHover disabled:shadow-none disabled:text-secondaryText transition-all"
                    >
                        <Send className="w-4 h-4 ml-0.5" />
                    </button>
                </form>
            }
        >
            <div className="flex-1 p-4 space-y-4 bg-background min-h-full">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-bloodRed border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(255,0,63,0.5)]" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-secondaryText text-center px-6">
                        <div className="w-16 h-16 rounded-full bg-surface border border-borderColor mb-4 flex items-center justify-center">
                            <Send className="w-6 h-6 opacity-30" />
                        </div>
                        <p className="font-bold tracking-widest uppercase text-sm mb-2">No Chatter</p>
                        <p className="text-xs">Be the first to talk some trash.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.user_id === user?.id;
                        const showAvatar = !isMe && (idx === 0 || messages[idx - 1].user_id !== msg.user_id);

                        return (
                            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                {(() => {
                                    const profilesAny = msg.profiles as any;
                                    return (
                                        <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            {!isMe && (
                                                <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 border border-white/5 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                                                    {profilesAny?.avatar_url ? (
                                                        <img src={profilesAny.avatar_url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-surfaceHover flex items-center justify-center text-[8px] font-bold text-white">
                                                            {profilesAny?.full_name?.slice(0, 2).toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-col max-w-[75%]">
                                                {!isMe && showAvatar && (
                                                    <span className="text-[10px] font-bold text-secondaryText ml-1 mb-1">
                                                        {profilesAny?.full_name}
                                                    </span>
                                                )}
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    className={`px-4 py-2.5 rounded-2xl ${isMe
                                                        ? 'bg-bloodRed text-white rounded-br-sm shadow-[0_2px_10px_rgba(255,0,63,0.2)]'
                                                        : 'bg-surfaceHover border border-white/5 text-white rounded-bl-sm shadow-sm'
                                                        }`}
                                                >
                                                    <p className="text-sm leading-snug">{msg.content}</p>
                                                </motion.div>
                                                <span className={`text-[9px] font-medium opacity-40 mt-1 ${isMe ? 'text-right mr-1' : 'text-left ml-1'}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div >
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>
        </BottomSheet>
    );
}
