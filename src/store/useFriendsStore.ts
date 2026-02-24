import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface FriendProfile {
    id: string;
    fullName: string;
    avatarUrl?: string;
    handicap: number;
}

export interface Friendship {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: 'pending' | 'accepted' | 'blocked';
    createdAt: string;
    // Hydrated full profile of the *other* person in the relationship
    friendProfile?: FriendProfile;
}

interface FriendsStoreState {
    friendships: Friendship[];
    loading: boolean;
    error: string | null;
    _channel: RealtimeChannel | null;

    loadFriendships: (currentUserId: string) => Promise<void>;
    sendFriendRequest: (currentUserId: string, targetUserId: string) => Promise<void>;
    acceptFriendRequest: (friendshipId: string) => Promise<void>;
    declineOrRemoveFriend: (friendshipId: string) => Promise<void>;
    subscribeToFriendships: (currentUserId: string) => void;
    unsubscribe: () => void;
}

// Helper to hydrate the other user's profile
async function fetchProfilesForFriendships(currentUserId: string, items: any[]): Promise<Friendship[]> {
    if (!items.length) return [];
    const otherUserIds = items.map(f => f.requester_id === currentUserId ? f.addressee_id : f.requester_id);

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, handicap')
        .in('id', otherUserIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    return items.map(f => {
        const otherId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
        const dbProfile = profileMap.get(otherId) as any;

        return {
            id: f.id,
            requesterId: f.requester_id,
            addresseeId: f.addressee_id,
            status: f.status,
            createdAt: f.created_at,
            friendProfile: dbProfile ? {
                id: dbProfile.id,
                fullName: dbProfile.full_name,
                avatarUrl: dbProfile.avatar_url,
                handicap: dbProfile.handicap
            } : undefined
        };
    });
}

export const useFriendsStore = create<FriendsStoreState>((set, get) => ({
    friendships: [],
    loading: false,
    error: null,
    _channel: null,

    loadFriendships: async (currentUserId: string) => {
        set({ loading: true, error: null });
        const { data, error } = await supabase
            .from('friendships')
            .select('*')
            .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

        if (error) {
            set({ loading: false, error: error.message });
            return;
        }

        const hydrated = await fetchProfilesForFriendships(currentUserId, data || []);
        set({ friendships: hydrated, loading: false });
    },

    sendFriendRequest: async (currentUserId: string, targetUserId: string) => {
        // Check if one already exists
        const existing = get().friendships.find(f =>
            (f.requesterId === targetUserId && f.addresseeId === currentUserId) ||
            (f.requesterId === currentUserId && f.addresseeId === targetUserId)
        );
        if (existing) return;

        const { data, error } = await supabase
            .from('friendships')
            .insert({
                requester_id: currentUserId,
                addressee_id: targetUserId,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            set({ error: error.message });
            return;
        }

        // Hydrate the single new record immediately
        const hydrated = await fetchProfilesForFriendships(currentUserId, [data]);
        set(state => ({ friendships: [...state.friendships, ...hydrated] }));
    },

    acceptFriendRequest: async (friendshipId: string) => {
        const { error } = await supabase
            .from('friendships')
            .update({ status: 'accepted' })
            .eq('id', friendshipId);

        if (error) {
            set({ error: error.message });
            return;
        }

        set(state => ({
            friendships: state.friendships.map(f => f.id === friendshipId ? { ...f, status: 'accepted' } : f)
        }));
    },

    declineOrRemoveFriend: async (friendshipId: string) => {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipId);

        if (error) {
            set({ error: error.message });
            return;
        }

        set(state => ({
            friendships: state.friendships.filter(f => f.id !== friendshipId)
        }));
    },

    subscribeToFriendships: (currentUserId: string) => {
        const existing = get()._channel;
        if (existing) existing.unsubscribe();

        const channel = supabase.channel(`friendships-${currentUserId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `requester_id=eq.${currentUserId}`
            }, () => {
                get().loadFriendships(currentUserId);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `addressee_id=eq.${currentUserId}`
            }, () => {
                get().loadFriendships(currentUserId);
            })
            .subscribe();

        set({ _channel: channel });
    },

    unsubscribe: () => {
        const channel = get()._channel;
        if (channel) {
            channel.unsubscribe();
            set({ _channel: null });
        }
    }
}));
