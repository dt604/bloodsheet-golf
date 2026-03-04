import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PresenceState {
    onlineUsers: Set<string>;
    channel: RealtimeChannel | null;
    initialize: (userId: string) => void;
    cleanup: () => void;
    isUserOnline: (userId: string) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
    onlineUsers: new Set<string>(),
    channel: null,

    initialize: (userId: string) => {
        if (get().channel) return;

        const channel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: userId,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const newState = channel.presenceState();
                const onlineIds = new Set<string>(Object.keys(newState));
                set({ onlineUsers: onlineIds });
            })
            .on('presence', { event: 'join' }, () => {
                // Optional: useful for notifications or specific logs
            })
            .on('presence', { event: 'leave' }, () => {
                // Optional
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        online_at: new Date().toISOString(),
                    });
                }
            });

        set({ channel });
    },

    cleanup: () => {
        const { channel } = get();
        if (channel) {
            channel.unsubscribe();
            set({ channel: null, onlineUsers: new Set() });
        }
    },

    isUserOnline: (userId: string) => {
        return get().onlineUsers.has(userId);
    }
}));
