import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { FeedComment, FeedItemSocialData, ReactionType } from '../types';

interface SocialStoreState {
  socialData: Record<string, FeedItemSocialData>;
  comments: Record<string, FeedComment[]>;
  hasUnseenActivity: boolean;

  loadSocialData: (feedItemIds: string[], currentUserId: string) => Promise<void>;
  toggleReaction: (feedItemId: string, currentUserId: string, reactionType: ReactionType) => Promise<void>;
  loadComments: (feedItemId: string) => Promise<void>;
  addComment: (feedItemId: string, currentUserId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string, feedItemId: string) => Promise<void>;
  checkUnseenActivity: (currentUserId: string) => Promise<void>;
  clearUnseenActivity: () => void;
}

export const useSocialStore = create<SocialStoreState>((set, get) => ({
  socialData: {},
  comments: {},
  hasUnseenActivity: false,

  async checkUnseenActivity(currentUserId: string) {
    // Check if there are any reactions or comments on the user's feed items since last seen
    const { data } = await supabase
      .from('feed_likes')
      .select('id')
      .neq('user_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(1);

    set({ hasUnseenActivity: (data ?? []).length > 0 });
  },

  clearUnseenActivity() {
    set({ hasUnseenActivity: false });
  },

  async loadSocialData(feedItemIds, currentUserId) {
    if (feedItemIds.length === 0) return;

    const { data: likes } = await supabase
      .from('feed_likes')
      .select('feed_item_id, user_id, reaction_type')
      .in('feed_item_id', feedItemIds);

    const { data: commentRows } = await supabase
      .from('feed_comments')
      .select('feed_item_id')
      .in('feed_item_id', feedItemIds);

    // Fetch reactor profile names for "Liked by X and Y" text
    const allReactorIds = [...new Set((likes ?? []).map(l => l.user_id).filter(id => id !== currentUserId))];
    const { data: reactorProfiles } = allReactorIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', allReactorIds)
      : { data: [] };
    const reactorNameMap = new Map((reactorProfiles ?? []).map(p => [p.id, (p.full_name || 'Someone').split(' ')[0]]));

    const newData: Record<string, FeedItemSocialData> = {};

    for (const itemId of feedItemIds) {
      const itemLikes = (likes ?? []).filter(l => l.feed_item_id === itemId);
      const itemComments = (commentRows ?? []).filter(c => c.feed_item_id === itemId);

      const reactions: Partial<Record<ReactionType, number>> = {};
      let userReaction: ReactionType | null = null;
      const otherNames: string[] = [];

      for (const like of itemLikes) {
        const rt = (like.reaction_type || 'heart') as ReactionType;
        reactions[rt] = (reactions[rt] ?? 0) + 1;
        if (like.user_id === currentUserId) {
          userReaction = rt;
        } else {
          const name = reactorNameMap.get(like.user_id);
          if (name && otherNames.length < 2) otherNames.push(name);
        }
      }

      newData[itemId] = {
        reactions,
        userReaction,
        commentCount: itemComments.length,
        reactorNames: otherNames,
      };
    }

    set(state => ({ socialData: { ...state.socialData, ...newData } }));
  },

  async toggleReaction(feedItemId, currentUserId, reactionType) {
    const current = get().socialData[feedItemId];
    const prevReaction = current?.userReaction ?? null;
    const prevReactions = { ...(current?.reactions ?? {}) };

    // Determine action
    if (prevReaction === reactionType) {
      // Same reaction — remove it
      const newReactions = { ...prevReactions };
      newReactions[reactionType] = Math.max(0, (newReactions[reactionType] ?? 1) - 1);
      if (newReactions[reactionType] === 0) delete newReactions[reactionType];

      set(state => ({
        socialData: {
          ...state.socialData,
          [feedItemId]: {
            reactions: newReactions,
            userReaction: null,
            commentCount: current?.commentCount ?? 0,
            reactorNames: current?.reactorNames ?? [],
          },
        },
      }));

      await supabase
        .from('feed_likes')
        .delete()
        .eq('feed_item_id', feedItemId)
        .eq('user_id', currentUserId);
    } else if (prevReaction === null) {
      // No existing reaction — insert
      const newReactions = { ...prevReactions };
      newReactions[reactionType] = (newReactions[reactionType] ?? 0) + 1;

      set(state => ({
        socialData: {
          ...state.socialData,
          [feedItemId]: {
            reactions: newReactions,
            userReaction: reactionType,
            commentCount: current?.commentCount ?? 0,
            reactorNames: current?.reactorNames ?? [],
          },
        },
      }));

      await supabase
        .from('feed_likes')
        .insert({ feed_item_id: feedItemId, user_id: currentUserId, reaction_type: reactionType });
    } else {
      // Different reaction — update
      const newReactions = { ...prevReactions };
      newReactions[prevReaction] = Math.max(0, (newReactions[prevReaction] ?? 1) - 1);
      if (newReactions[prevReaction] === 0) delete newReactions[prevReaction];
      newReactions[reactionType] = (newReactions[reactionType] ?? 0) + 1;

      set(state => ({
        socialData: {
          ...state.socialData,
          [feedItemId]: {
            reactions: newReactions,
            userReaction: reactionType,
            commentCount: current?.commentCount ?? 0,
            reactorNames: current?.reactorNames ?? [],
          },
        },
      }));

      await supabase
        .from('feed_likes')
        .update({ reaction_type: reactionType })
        .eq('feed_item_id', feedItemId)
        .eq('user_id', currentUserId);
    }
  },

  async loadComments(feedItemId) {
    const { data } = await supabase
      .from('feed_comments')
      .select('id, feed_item_id, user_id, body, created_at')
      .eq('feed_item_id', feedItemId)
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) {
      set(state => ({ comments: { ...state.comments, [feedItemId]: [] } }));
      return;
    }

    const userIds = [...new Set(data.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const comments: FeedComment[] = data.map(row => {
      const prof = profileMap.get(row.user_id);
      return {
        id: row.id,
        feedItemId: row.feed_item_id,
        userId: row.user_id,
        body: row.body,
        createdAt: row.created_at,
        author: prof
          ? { id: prof.id, fullName: prof.full_name, avatarUrl: prof.avatar_url }
          : undefined,
      };
    });

    set(state => ({ comments: { ...state.comments, [feedItemId]: comments } }));
  },

  async addComment(feedItemId, currentUserId, body) {
    const { data, error } = await supabase
      .from('feed_comments')
      .insert({ feed_item_id: feedItemId, user_id: currentUserId, body })
      .select()
      .single();

    if (error || !data) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', currentUserId)
      .single();

    const newComment: FeedComment = {
      id: data.id,
      feedItemId: data.feed_item_id,
      userId: data.user_id,
      body: data.body,
      createdAt: data.created_at,
      author: prof
        ? { id: prof.id, fullName: prof.full_name, avatarUrl: prof.avatar_url }
        : undefined,
    };

    set(state => ({
      comments: {
        ...state.comments,
        [feedItemId]: [...(state.comments[feedItemId] ?? []), newComment],
      },
      socialData: {
        ...state.socialData,
        [feedItemId]: {
          ...(state.socialData[feedItemId] ?? { reactions: {}, userReaction: null, reactorNames: [] }),
          commentCount: (state.socialData[feedItemId]?.commentCount ?? 0) + 1,
        },
      },
    }));
  },

  async deleteComment(commentId, feedItemId) {
    await supabase.from('feed_comments').delete().eq('id', commentId);

    set(state => ({
      comments: {
        ...state.comments,
        [feedItemId]: (state.comments[feedItemId] ?? []).filter(c => c.id !== commentId),
      },
      socialData: {
        ...state.socialData,
        [feedItemId]: {
          ...(state.socialData[feedItemId] ?? { reactions: {}, userReaction: null, reactorNames: [] }),
          commentCount: Math.max(0, (state.socialData[feedItemId]?.commentCount ?? 1) - 1),
        },
      },
    }));
  },
}));
