import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useFriendsStore } from '../../store/useFriendsStore';
import { useSocialStore } from '../../store/useSocialStore';
import { Card } from '../ui/Card';
import { Target, Zap, Droplets, Camera, Trophy, ChevronRight, Heart, MessageCircle, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../ui/EmptyState';
import { CommentsSheet } from '../social/CommentsSheet';
import type { ReactionType } from '../../types';

const REACTIONS: { type: ReactionType; emoji: string }[] = [
    { type: 'heart', emoji: '❤️' },
    { type: 'fire', emoji: '🔥' },
    { type: 'clap', emoji: '👏' },
    { type: 'flag', emoji: '⛳' },
    { type: 'skull', emoji: '💀' },
    { type: 'laugh', emoji: '😂' },
];

interface BaseFeedItem {
    id: string;
    timestamp: number;
    courseName: string;
    playerId: string; // the primary subject
}

interface MatchFeedItem extends BaseFeedItem {
    type: 'match';
    format: string;
    payoutText?: string;
    payoutValue?: number;
    matchId: string;
}

interface MediaFeedItem extends BaseFeedItem {
    type: 'media';
    mediaUrl: string;
    mediaType: string;
    holeNumber: number;
}

interface TrophyFeedItem extends BaseFeedItem {
    type: 'trophy';
    holeNumber: number;
    trash: string; // 'greenie', 'snake', 'sandie'
    matchId: string;
}

type FeedItem = MatchFeedItem | MediaFeedItem | TrophyFeedItem;

export function ActivityFeed({ isGlobal = false }: { isGlobal?: boolean }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { friendships } = useFriendsStore();
    const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<Record<string, { fullName: string; avatarUrl?: string }>>({});

    useEffect(() => {
        if (!user) return;

        const activeFriends = friendships.filter(f => f.status === 'accepted' && !f.isSystemFriend);
        const friendIds = activeFriends.map(f => f.requesterId === user.id ? f.addresseeId : f.requesterId);
        const targetUserIds = [user.id, ...friendIds];

        async function fetchFeed() {
            setLoading(true);
            try {
                const items: FeedItem[] = [];
                const profileIdsToFetch = new Set<string>();

                // 1. Fetch Completed Matches
                let matchQuery = supabase.from('match_players')
                    .select('match_id, user_id, matches!inner(id, status, created_at, format, side_bets, courses(name))')
                    .eq('matches.status', 'completed')
                    .order('matches(created_at)', { ascending: false })
                    .limit(isGlobal ? 20 : 10);

                if (!isGlobal) {
                    matchQuery = matchQuery.in('user_id', targetUserIds);
                }

                const { data: mps } = await matchQuery;

                if (mps && mps.length > 0) {
                    // Deduplicate matches (since multiple friends could be in the same match)
                    const uniqueMatches = new Map();
                    for (const mp of mps as any[]) {
                        const m = mp.matches;
                        if (!uniqueMatches.has(m.id)) {
                            uniqueMatches.set(m.id, m);
                            // We associate this match with the primary user found for it
                            const pId = mp.user_id;
                            profileIdsToFetch.add(pId);

                            const formatStr = m.format === 'skins' ? (m.side_bets?.teamSkins ? '2v2 Skins' : 'Skins') : m.format;
                            items.push({
                                id: `match-${m.id}`,
                                type: 'match',
                                timestamp: new Date(m.created_at).getTime(),
                                courseName: m.courses?.name ?? 'Unknown Course',
                                playerId: pId,
                                format: formatStr,
                                matchId: m.id
                            });
                        }
                    }

                    // For the unique matches, let's fetch trophies (hole scores with trash dots)
                    const matchIds = Array.from(uniqueMatches.keys());
                    let trophyQuery = supabase.from('hole_scores')
                        .select('match_id, hole_number, player_id, trash_dots')
                        .in('match_id', matchIds);

                    if (!isGlobal) {
                        trophyQuery = trophyQuery.in('player_id', targetUserIds);
                    }

                    const { data: scores } = await trophyQuery;

                    if (scores) {
                        for (const score of scores as any[]) {
                            if (score.trash_dots && score.trash_dots.length > 0) {
                                const m = uniqueMatches.get(score.match_id);
                                profileIdsToFetch.add(score.player_id);
                                for (const t of score.trash_dots) {
                                    items.push({
                                        id: `trophy-${score.match_id}-${score.hole_number}-${score.player_id}-${t}`,
                                        type: 'trophy',
                                        // add slight offset so trophies appear after the match started
                                        timestamp: new Date(m.created_at).getTime() + (score.hole_number * 10 * 60000),
                                        courseName: m.courses?.name ?? 'Unknown Course',
                                        playerId: score.player_id,
                                        holeNumber: score.hole_number,
                                        trash: t,
                                        matchId: score.match_id
                                    });
                                }
                            }
                        }
                    }
                }

                // 2. Fetch Media
                let mediaQuery = supabase.from('match_media')
                    .select('id, created_at, media_url, media_type, hole_number, player_id, uploader_id, matches!inner(id, courses(name))')
                    .order('created_at', { ascending: false })
                    .limit(isGlobal ? 30 : 15);

                if (!isGlobal) {
                    mediaQuery = mediaQuery.in('player_id', targetUserIds);
                }

                const { data: media } = await mediaQuery;

                if (media) {
                    for (const m of media as any[]) {
                        // Use player_id (the one tagged) or fallback to uploader if not specified
                        const pId = m.player_id || m.uploader_id;
                        profileIdsToFetch.add(pId);
                        items.push({
                            id: `media-${m.id}`,
                            type: 'media',
                            timestamp: new Date(m.created_at).getTime(),
                            courseName: m.matches?.courses?.name ?? 'Unknown Course',
                            playerId: pId,
                            mediaUrl: m.media_url,
                            mediaType: m.media_type,
                            holeNumber: m.hole_number
                        });
                    }
                }

                // 3. Fetch missing profiles
                if (profileIdsToFetch.size > 0) {
                    const { data: profs } = await supabase.from('profiles')
                        .select('id, full_name, avatar_url')
                        .in('id', Array.from(profileIdsToFetch));

                    if (profs) {
                        const pm: Record<string, any> = {};
                        for (const p of profs) pm[p.id] = { fullName: p.full_name, avatarUrl: p.avatar_url };
                        setProfiles(prev => ({ ...prev, ...pm }));
                    }
                }

                // Sort descending by timestamp
                items.sort((a, b) => b.timestamp - a.timestamp);
                setFeedItems(items);

                // Batch-load social data (likes + comment counts)
                const itemIds = items.map(i => i.id);
                useSocialStore.getState().loadSocialData(itemIds, user.id);

            } catch (err) {
                console.error("Failed to fetch feed", err);
            } finally {
                setLoading(false);
            }
        }

        fetchFeed();
    }, [user, friendships]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (feedItems.length === 0) {
        return (
            <EmptyState
                title="No Activity Yet"
                description="Add friends and start playing to see the feed come alive."
                actionLabel="Find Friends"
                onAction={() => navigate('/friends')}
                accentColor="bloodRed"
            />
        );
    }

    return (
        <div className="space-y-4 pb-4">
            {feedItems.map(item => {
                const p = profiles[item.playerId] || { fullName: 'Someone' };
                const pName = p.fullName.split(' ')[0];
                const initials = p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                const Avatar = () => (
                    <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-black text-white shrink-0 overflow-hidden shadow-inner">
                        {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt={pName} className="w-full h-full object-cover" />
                        ) : (
                            initials
                        )}
                    </div>
                );

                if (item.type === 'match') {
                    return (
                        <Card
                            key={item.id}
                            className="p-4 bg-surface border-white/5 flex flex-col gap-3 group hover:border-bloodRed/30 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                            onClick={() => navigate(`/history/${item.matchId}`)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <Avatar />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-white text-sm"><span className="text-bloodRed">{pName}</span> played a match</h4>
                                    <span className="text-[10px] text-secondaryText font-bold block opacity-80 mt-0.5">
                                        <TimeAgo timestamp={item.timestamp} />
                                    </span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center shrink-0">
                                    <Trophy className="w-4 h-4 text-bloodRed/70" />
                                </div>
                            </div>
                            <div className="bg-background/50 rounded-xl p-3 border border-white/5 flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-white uppercase italic text-sm">{item.courseName}</span>
                                    <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest block">{item.format}</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-secondaryText group-hover:text-bloodRed group-hover:translate-x-1 transition-all" />
                            </div>
                            <SocialBar feedItemId={item.id} item={item} />
                        </Card>
                    );
                }

                if (item.type === 'trophy') {
                    let Icon = Trophy;
                    let color = 'text-white';
                    let glow = '';

                    if (item.trash === 'greenie') {
                        Icon = Target;
                        color = 'text-neonGreen';
                        glow = 'drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]';
                    } else if (item.trash === 'snake') {
                        Icon = Zap;
                        color = 'text-[#FF00FF] fill-[#FF00FF]';
                        glow = 'drop-shadow-[0_0_8px_rgba(255,0,255,0.4)]';
                    } else if (item.trash === 'sandie') {
                        Icon = Droplets;
                        color = 'text-cyan-400 fill-cyan-400';
                        glow = 'drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]';
                    }

                    return (
                        <Card
                            key={item.id}
                            className="p-4 bg-surface/50 border-white/5 flex flex-col group hover:bg-surface transition-all cursor-pointer shadow-sm"
                            onClick={() => navigate(`/history/${item.matchId}`)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar />
                                    <div>
                                        <h4 className="text-sm font-bold text-white">
                                            <span className="text-bloodRed">{pName}</span> earned a <span className={`${color} capitalize font-black`}>{item.trash}</span>
                                        </h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">
                                                {item.courseName} • Hole {item.holeNumber}
                                            </span>
                                            <span className="text-white/20 text-[10px]">•</span>
                                            <span className="text-[10px] text-secondaryText/60 font-bold"><TimeAgo timestamp={item.timestamp} /></span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full bg-background border border-white/5 flex items-center justify-center shrink-0 ${glow}`}>
                                    <Icon className={`w-4 h-4 ${color}`} />
                                </div>
                            </div>
                            <SocialBar feedItemId={item.id} item={item} />
                        </Card>
                    );
                }

                if (item.type === 'media') {
                    return (
                        <Card
                            key={item.id}
                            className="bg-surface border-white/5 overflow-hidden group shadow-lg"
                        >
                            <div className="p-4 flex items-center gap-3">
                                <Avatar />
                                <div>
                                    <h4 className="text-sm font-bold text-white">
                                        <span className="text-bloodRed">{pName}</span>'s Moment
                                    </h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">
                                            {item.courseName} • Hole {item.holeNumber}
                                        </span>
                                        <span className="text-white/20 text-[10px]">•</span>
                                        <span className="text-[10px] text-secondaryText/60 font-bold"><TimeAgo timestamp={item.timestamp} /></span>
                                    </div>
                                </div>
                                <div className="ml-auto w-8 h-8 rounded-full bg-background border border-white/5 flex items-center justify-center">
                                    <Camera className="w-3.5 h-3.5 text-white/70" />
                                </div>
                            </div>
                            <div className="relative w-full aspect-[4/3] bg-background">
                                {item.mediaType.includes('video') ? (
                                    <video src={item.mediaUrl} className="absolute inset-0 w-full h-full object-cover" muted loop playsInline autoPlay />
                                ) : (
                                    <img src={item.mediaUrl} alt="Moment" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </div>
                            <div className="px-4 pb-3">
                                <SocialBar feedItemId={item.id} item={item} />
                            </div>
                        </Card>
                    );
                }

                return null;
            })}
        </div>
    );
}

function SocialBar({ feedItemId, item }: { feedItemId: string; item: FeedItem }) {
    const { user } = useAuth();
    const { socialData, toggleReaction } = useSocialStore();
    const data = socialData[feedItemId] ?? { reactions: {}, userReaction: null, commentCount: 0 };
    const [commentsOpen, setCommentsOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);
    const hasHover = useRef(typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches);

    const totalReactions = Object.values(data.reactions).reduce((sum, n) => sum + (n ?? 0), 0);
    const activeEmojis = REACTIONS.filter(r => (data.reactions[r.type] ?? 0) > 0);
    const userEmoji = data.userReaction ? REACTIONS.find(r => r.type === data.userReaction)?.emoji : null;

    // Desktop: open picker on hover after short delay
    const handleMouseEnter = useCallback(() => {
        if (!hasHover.current) return;
        hoverTimer.current = setTimeout(() => setPickerOpen(true), 300);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }
        setPickerOpen(false);
    }, []);

    // Mobile: long-press to open picker
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        if (hasHover.current) return; // desktop uses hover instead
        didLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            didLongPress.current = true;
            setPickerOpen(true);
        }, 500);
    }, []);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        e.stopPropagation();
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        // Short tap → toggle heart (works on both desktop and mobile)
        if (!didLongPress.current && user) {
            toggleReaction(feedItemId, user.id, 'heart');
        }
    }, [feedItemId, user, toggleReaction]);

    const handlePointerLeave = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    const pickReaction = (type: ReactionType, e: React.MouseEvent) => {
        e.stopPropagation();
        if (user) toggleReaction(feedItemId, user.id, type);
        setPickerOpen(false);
    };

    const handleComment = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCommentsOpen(true);
    };

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        let url = window.location.origin;
        if (item.type === 'match' || item.type === 'trophy') {
            url += `/history/${item.matchId}`;
        }

        const text = item.type === 'match'
            ? 'Check out this match on BloodSheet Golf'
            : item.type === 'trophy'
            ? 'Check out this achievement on BloodSheet Golf'
            : 'Check out this moment on BloodSheet Golf';

        if (navigator.share) {
            try {
                await navigator.share({ title: 'BloodSheet Golf', text, url });
            } catch {
                // User cancelled
            }
        } else {
            await navigator.clipboard.writeText(url);
        }
    };

    return (
        <>
            {/* Reaction summary pills */}
            {activeEmojis.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1.5 mt-1.5">
                    {activeEmojis.map(r => (
                        <span key={r.type} className="inline-flex items-center gap-0.5 bg-white/5 rounded-full px-1.5 py-0.5 text-[11px]">
                            <span>{r.emoji}</span>
                            <span className="text-secondaryText font-bold">{data.reactions[r.type]}</span>
                        </span>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-4 pt-2 mt-1 border-t border-white/5">
                {/* Reaction button — tap for heart, hover (desktop) or long-press (mobile) for picker */}
                <div
                    className="relative"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <button
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerLeave}
                        className={`flex items-center gap-1.5 transition-colors select-none touch-none ${data.userReaction ? 'text-bloodRed' : 'text-secondaryText hover:text-bloodRed'}`}
                    >
                        {userEmoji ? (
                            <span className="text-base leading-none">{userEmoji}</span>
                        ) : (
                            <Heart className="w-4 h-4" />
                        )}
                        {totalReactions > 0 && <span className="text-[11px] font-bold">{totalReactions}</span>}
                    </button>

                    {/* Reaction picker — positioned with a bridge zone so hover doesn't break when moving from button to picker */}
                    {pickerOpen && (
                        <>
                            {/* Backdrop only on touch devices (desktop closes via mouseLeave) */}
                            {!hasHover.current && (
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setPickerOpen(false); }} />
                            )}
                            <div className="absolute bottom-full left-0 z-50 pb-2">
                                <div
                                    className="flex items-center gap-1 bg-[#2C2C2E] border border-white/10 rounded-full px-2 py-1.5 shadow-xl"
                                    style={{ animation: 'pickerIn 0.2s ease-out' }}
                                >
                                    <style>{`@keyframes pickerIn { from { opacity: 0; transform: scale(0.8) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
                                    {REACTIONS.map(r => (
                                        <button
                                            key={r.type}
                                            onClick={(e) => pickReaction(r.type, e)}
                                            className={`text-xl p-1 rounded-full transition-transform hover:scale-125 ${data.userReaction === r.type ? 'bg-white/10 scale-110' : ''}`}
                                        >
                                            {r.emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <button onClick={handleComment} className="flex items-center gap-1.5 text-secondaryText hover:text-white transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    {data.commentCount > 0 && <span className="text-[11px] font-bold">{data.commentCount}</span>}
                </button>
                <button onClick={handleShare} className="flex items-center gap-1.5 text-secondaryText hover:text-white transition-colors ml-auto">
                    <Share2 className="w-4 h-4" />
                </button>
            </div>
            <CommentsSheet feedItemId={feedItemId} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
        </>
    );
}

// Simple helper component to format timestamps beautifully
function TimeAgo({ timestamp }: { timestamp: number }) {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return <span>Just now</span>;
    if (diffMin < 60) return <span>{diffMin}m ago</span>;
    if (diffHr < 24) return <span>{diffHr}h ago</span>;
    if (diffDays === 1) return <span>Yesterday</span>;
    return <span>{diffDays}d ago</span>;
}
