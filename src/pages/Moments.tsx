import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useFriendsStore } from '../store/useFriendsStore';
import { Camera, RefreshCw, ChevronLeft, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaLightbox } from '../components/ui/MediaLightbox';
import SEO from '../components/SEO';
import { EmptyState } from '../components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';

export default function MomentsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { friendships } = useFriendsStore();
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    // Bulk selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);

    const fetchMoments = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Get user's active friends
            const friendIds = friendships
                .filter(f => f.status === 'accepted')
                .map(f => (f.requesterId === user.id ? f.addresseeId : f.requesterId));

            // Include current user
            const targetIds = [user.id, ...friendIds];

            if (targetIds.length === 0) {
                setMediaItems([]);
                return;
            }

            // We fetch media where any of the targetIds were tagged as player_id or uploader_id
            const orQuery = targetIds.map(id => `player_id.eq.${id},uploader_id.eq.${id}`).join(',');

            const { data, error } = await supabase
                .from('match_media')
                .select('id, media_url, media_type, hole_number, player_id, uploader_id, created_at, matches(id, courses(name))')
                .or(orQuery)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) console.error("Vault Query Error:", error);

            if (data) {
                setMediaItems(data);
            }
        } catch (error) {
            console.error('Failed to load moments', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMedia = async (mediaId: string) => {
        const media = mediaItems.find(m => m.id === mediaId);
        if (!media) return;

        try {
            // 1. Delete from Storage
            const path = media.media_url.split('/public/match-media/')[1];
            if (path) {
                await supabase.storage.from('match-media').remove([path]);
            }

            // 2. Delete from DB
            const { error } = await supabase
                .from('match_media')
                .delete()
                .eq('id', mediaId);

            if (error) throw error;

            // 3. Update local state
            setMediaItems(prev => prev.filter(m => m.id !== mediaId));

            // If the lightbox is empty after deletion, close it
            if (lightboxMedia.length <= 1) {
                setIsLightboxOpen(false);
            } else {
                // Update lightbox media state so the deleted item is removed
                setLightboxMedia(prev => prev.filter(m => m.id !== mediaId));
                // Ensure index stays valid
                setLightboxIndex(prev => Math.min(prev, lightboxMedia.length - 2));
            }
        } catch (err) {
            console.error('Failed to delete media:', err);
            alert('Failed to delete media.');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedMediaIds.length === 0) return;
        setLoading(true);
        try {
            const mediaToDelete = mediaItems.filter(m => selectedMediaIds.includes(m.id));
            if (mediaToDelete.length === 0) {
                setIsSelectionMode(false);
                setSelectedMediaIds([]);
                return;
            }

            // 1. Delete from Storage
            const paths = mediaToDelete.map(m => m.media_url.split('/public/match-media/')[1]).filter(Boolean);
            if (paths.length > 0) {
                await supabase.storage.from('match-media').remove(paths);
            }

            // 2. Delete from DB
            const { error } = await supabase
                .from('match_media')
                .delete()
                .in('id', selectedMediaIds);

            if (error) throw error;

            // 3. Update local state
            setMediaItems(prev => prev.filter(m => !selectedMediaIds.includes(m.id)));
            setIsSelectionMode(false);
            setSelectedMediaIds([]);
        } catch (err) {
            console.error('Failed to bulk delete media:', err);
            alert('Failed to delete selected media.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMoments();
    }, [user, friendships]);

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <SEO title="The Vault" />

            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Camera className="w-64 h-64 text-white" />
            </div>

            <div className="shrink-0 p-4 border-b border-white/10 bg-surface/50 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {!isSelectionMode ? (
                        <>
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 -ml-2 rounded-full text-secondaryText hover:text-white hover:bg-white/5 transition-all"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-bloodRed/20 flex items-center justify-center border border-bloodRed/30 shadow-[0_0_15px_rgba(255,0,63,0.3)]">
                                <Camera className="w-4 h-4 text-bloodRed" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black italic uppercase tracking-wider text-white leading-none">The Vault</h1>
                                <p className="text-[10px] text-neonGreen font-black uppercase tracking-widest mt-0.5">Moments & Highlights</p>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={() => { setIsSelectionMode(false); setSelectedMediaIds([]); }}
                            className="px-4 py-2 rounded-full border border-borderColor text-secondaryText hover:text-white hover:bg-white/5 transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {isSelectionMode ? (
                        <button
                            onClick={handleBulkDelete}
                            disabled={selectedMediaIds.length === 0 || loading}
                            className="px-4 py-2 rounded-full bg-bloodRed text-white hover:bg-bloodRed/80 transition-colors text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1 shadow-[0_0_15px_rgba(255,0,63,0.3)]"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete ({selectedMediaIds.length})
                        </button>
                    ) : (
                        <>
                            {mediaItems.length > 0 && (
                                <button
                                    onClick={() => setIsSelectionMode(true)}
                                    className="px-4 py-2 rounded-full bg-surfaceHover border border-borderColor text-white hover:text-neonGreen transition-colors text-xs font-bold uppercase tracking-wider"
                                >
                                    Select
                                </button>
                            )}
                            <button
                                onClick={fetchMoments}
                                disabled={loading}
                                className="p-2 rounded-full bg-surfaceHover border border-borderColor text-white hover:text-neonGreen transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <div className="p-4 sm:p-6 pb-24 max-w-lg mx-auto w-full">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-bloodRed border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(255,0,63,0.5)]" />
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <EmptyState
                            title="The Vault Is Empty"
                            description="Take photos and videos on the course to fill your vault with legendary moments."
                            actionLabel="Record Now"
                            onAction={() => navigate('/home')}
                            accentColor="bloodRed"
                        />
                    ) : (
                        <div className="columns-2 gap-4 space-y-4">
                            <AnimatePresence>
                                {mediaItems.map((item, idx) => {
                                    const isMe = item.player_id === user?.id;
                                    let playerName = 'Someone';
                                    if (isMe) {
                                        playerName = 'Me';
                                    } else {
                                        const f = friendships.find(f => f.requesterId === item.player_id || f.addresseeId === item.player_id);
                                        if (f && f.friendProfile) playerName = f.friendProfile.fullName;
                                    }

                                    return (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="relative break-inside-avoid shadow-lg group cursor-pointer"
                                            onClick={() => {
                                                if (isSelectionMode) {
                                                    setSelectedMediaIds(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]);
                                                    return;
                                                }
                                                setLightboxMedia(mediaItems.map(m => ({
                                                    id: m.id,
                                                    url: m.media_url,
                                                    type: m.media_type,
                                                    playerId: m.player_id,
                                                    uploaderId: m.uploader_id,
                                                    holeNumber: m.hole_number,
                                                    context: m.matches?.courses?.name
                                                })));
                                                setLightboxIndex(idx);
                                                setIsLightboxOpen(true);
                                            }}
                                        >
                                            <div className={`rounded-2xl overflow-hidden relative bg-surface transition-all ${isSelectionMode && selectedMediaIds.includes(item.id) ? 'border-2 border-bloodRed shadow-[0_0_20px_rgba(255,0,63,0.3)] scale-[0.97]' : 'border border-borderColor/50'}`}>

                                                {/* Selection indicator overlay */}
                                                {isSelectionMode && (
                                                    <div className="absolute top-3 left-3 z-30 pointer-events-none">
                                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedMediaIds.includes(item.id) ? 'bg-bloodRed border-bloodRed shadow-lg' : 'bg-black/50 border-white/70'}`}>
                                                            {selectedMediaIds.includes(item.id) && <Check className="w-3.5 h-3.5 text-white" />}
                                                        </div>
                                                    </div>
                                                )}

                                                {item.media_type === 'video' ? (
                                                    <>
                                                        <video src={item.media_url} className={`w-full object-cover transition-all duration-300 pointer-events-none ${isSelectionMode ? 'grayscale-[0.5]' : 'grayscale-[0.2] group-hover:grayscale-0'}`} />
                                                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 z-10 shadow-lg">
                                                            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <img src={item.media_url} alt="Match Moment" className={`w-full object-cover transition-all duration-300 ${isSelectionMode ? 'grayscale-[0.5]' : 'grayscale-[0.2] group-hover:grayscale-0'}`} />
                                                )}

                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

                                                <div className="absolute bottom-3 left-3 right-3 text-left">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-black text-neonGreen uppercase tracking-widest drop-shadow-sm px-1.5 py-0.5 bg-neonGreen/10 rounded backdrop-blur">
                                                            Hole {item.hole_number}
                                                        </span>
                                                    </div>
                                                    <span className="block text-xs font-bold text-white line-clamp-1 drop-shadow-md">
                                                        {item.matches?.courses?.name || 'Unknown Course'}
                                                    </span>
                                                    <span className="block text-[9px] font-medium text-white/70 mt-0.5">
                                                        {playerName}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            {isLightboxOpen && (
                <MediaLightbox
                    items={lightboxMedia}
                    initialIndex={lightboxIndex}
                    onClose={() => setIsLightboxOpen(false)}
                    onDelete={handleDeleteMedia}
                />
            )}
        </div>
    );
}
