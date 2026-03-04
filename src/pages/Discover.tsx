import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Compass, RefreshCw, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaLightbox } from '../components/ui/MediaLightbox';
import SEO from '../components/SEO';
import { EmptyState } from '../components/ui/EmptyState';
import { useNavigate } from 'react-router-dom';

export default function DiscoverPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    const fetchDiscover = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Fetch global media - no friend filter.
            // Join with profiles to get the player's name.
            const { data, error } = await supabase
                .from('match_media')
                .select(`
                    id, 
                    media_url, 
                    media_type, 
                    hole_number, 
                    player_id, 
                    uploader_id, 
                    created_at, 
                    matches(id, courses(name)),
                    profiles:player_id (full_name)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) console.error("Discover Query Error:", error);

            if (data) {
                setMediaItems(data);
            }
        } catch (error) {
            console.error('Failed to load discover feed', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMedia = async (mediaId: string) => {
        const media = mediaItems.find(m => m.id === mediaId);
        // Only allow deleting own media if they somehow open it in the lightbox here.
        if (!media || media.uploader_id !== user?.id) return;

        try {
            const path = media.media_url.split('/public/match-media/')[1];
            if (path) {
                await supabase.storage.from('match-media').remove([path]);
            }

            const { error } = await supabase
                .from('match_media')
                .delete()
                .eq('id', mediaId);

            if (error) throw error;

            setMediaItems(prev => prev.filter(m => m.id !== mediaId));

            if (lightboxMedia.length <= 1) {
                setIsLightboxOpen(false);
            } else {
                setLightboxMedia(prev => prev.filter(m => m.id !== mediaId));
                setLightboxIndex(prev => Math.min(prev, lightboxMedia.length - 2));
            }
        } catch (err) {
            console.error('Failed to delete media:', err);
            alert('Failed to delete media.');
        }
    };

    useEffect(() => {
        fetchDiscover();
    }, [user]);

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <SEO title="Discover Highlights" />

            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Compass className="w-64 h-64 text-white" />
            </div>

            <div className="shrink-0 p-4 border-b border-white/10 bg-surface/50 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full text-secondaryText hover:text-white hover:bg-white/5 transition-all"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#00FF66]/10 flex items-center justify-center border border-[#00FF66]/20 shadow-[0_0_15px_rgba(0,255,102,0.2)]">
                        <Compass className="w-4 h-4 text-[#00FF66]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black italic uppercase tracking-wider text-white leading-none">Discover</h1>
                        <p className="text-[10px] text-neonGreen font-black uppercase tracking-widest mt-0.5">Global Highlights</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchDiscover}
                        disabled={loading}
                        className="p-2 rounded-full bg-surfaceHover border border-borderColor text-white hover:text-neonGreen transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <div className="p-4 sm:p-6 pb-24 max-w-lg mx-auto w-full">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-neonGreen border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(0,255,102,0.5)]" />
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <EmptyState
                            title="Nothing to Discover Yet"
                            description="Be the first to share a legendary moment with the BloodSheet community."
                            actionLabel="Go to Dashboard"
                            onAction={() => navigate('/dashboard')}
                            accentColor="neonGreen"
                        />
                    ) : (
                        <div className="columns-2 gap-4 space-y-4">
                            <AnimatePresence>
                                {mediaItems.map((item, idx) => {
                                    const isMe = item.player_id === user?.id;
                                    let playerName = 'Someone';
                                    if (isMe) {
                                        playerName = 'Me';
                                    } else if (item.profiles && item.profiles.full_name) {
                                        playerName = item.profiles.full_name;
                                    }

                                    return (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="relative break-inside-avoid shadow-lg group cursor-pointer"
                                            onClick={() => {
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
                                            <div className="rounded-2xl overflow-hidden relative bg-surface transition-all border border-borderColor/50 group-hover:border-neonGreen/30 group-hover:shadow-[0_0_15px_rgba(0,255,102,0.15)]">
                                                {item.media_type === 'video' ? (
                                                    <>
                                                        <video src={item.media_url} className="w-full object-cover transition-all duration-300 pointer-events-none grayscale-[0.2] group-hover:grayscale-0" />
                                                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 z-10 shadow-lg">
                                                            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-white border-b-[4px] border-b-transparent ml-0.5" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <img src={item.media_url} alt="Match Moment" className="w-full object-cover transition-all duration-300 grayscale-[0.2] group-hover:grayscale-0" />
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
