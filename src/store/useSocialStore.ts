import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { FeedComment, FeedItemSocialData, ReactionType } from '../types';

interface SocialStoreState {
  socialData: Record<string, FeedItemSocialData>;
  comments: Record<string, FeedComment[]>;

  loadSocialData: (feedItemIds: string[], currentUserId: string) => Promise<void>;
  toggleReaction: (feedItemId: string, currentUserId: string, reactionType: ReactionType) => Promise<void>;
  loadComments: (feedItemId: string) => Promise<void>;
  addComment: (feedItemId: string, currentUserId: string, body: string) => Promise<void>;
  deleteComment: (commentId: string, feedItemId: string) => Promise<void>;
}

export const useSocialStore = create<SocialStoreState>((set, get) => ({
  socialData: {},
  comments: {},

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

    const newData: Record<string, FeedItemSocialData> = {};

    for (const itemId of feedItemIds) {
      const itemLikes = (likes ?? []).filter(l => l.feed_item_id === itemId);
      const itemComments = (commentRows ?? []).filter(c => c.feed_item_id === itemId);

      const reactions: Partial<Record<ReactionType, number>> = {};
      let userReaction: ReactionType | null = null;

      for (const like of itemLikes) {
        const rt = (like.reaction_type || 'heart') as ReactionType;
        reactions[rt] = (reactions[rt] ?? 0) + 1;
        if (like.user_id === currentUserId) userReaction = rt;
      }

      newData[itemId] = {
        reactions,
        userReaction,
        commentCount: itemComments.length,
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
          ...(state.socialData[feedItemId] ?? { reactions: {}, userReaction: null }),
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
          ...(state.socialData[feedItemId] ?? { reactions: {}, userReaction: null }),
          commentCount: Math.max(0, (state.socialData[feedItemId]?.commentCount ?? 1) - 1),
        },
      },
    }));
  },
}));
