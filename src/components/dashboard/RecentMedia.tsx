import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { MediaLightbox } from '../ui/MediaLightbox';
import { useNavigate } from 'react-router-dom';

export function RecentMedia() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [media, setMedia] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    useEffect(() => {
        if (!user || !user.id) return;

        async function fetchMedia() {
            setLoading(true);
            try {
                // Fetch media where the user is tagged or uploaded it
                const { data } = await supabase
                    .from('match_media')
                    .select('id, media_url, media_type, hole_number, player_id, uploader_id, matches(courses(name))')
                    .or(`player_id.eq.${user!.id},uploader_id.eq.${user!.id}`)
                    .order('created_at', { ascending: false })
                    .limit(8);

                if (data) {
                    setMedia(data);
                }
            } catch (error) {
                console.error("Failed to load recent media", error);
            } finally {
                setLoading(false);
            }
        }

        fetchMedia();
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (media.length === 0) return null;

    return (
        <section className="mb-8">
            <div className="flex items-center justify-between mb-3 px-2">
                <div className="flex items-center gap-2">
                    <Camera className="w-5 h-5 text-secondaryText" />
                    <h3 className="text-sm font-bold tracking-widest uppercase text-secondaryText">Recent Media</h3>
                </div>
                <button onClick={() => navigate('/moments')} className="text-[10px] font-black text-bloodRed uppercase tracking-widest hover:underline flex items-center gap-1 group">
                    The Vault
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            <div className="flex gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-4 snap-x">
                {media.map((item, idx) => (
                    <motion.button
                        key={item.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            setLightboxMedia(media.map(m => ({
                                id: m.id,
                                url: m.media_url,
                                type: m.media_type,
                                playerId: m.player_id,
                                uploaderId: m.uploader_id,
                                holeNumber: m.hole_number,
                            })));
                            setLightboxIndex(idx);
                            setIsLightboxOpen(true);
                        }}
                        className="relative flex-shrink-0 w-32 h-44 rounded-2xl overflow-hidden border border-borderColor/50 shadow-lg group snap-start bg-surface"
                    >
                        {item.media_type === 'video' ? (
                            <video src={item.media_url} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                        ) : (
                            <img src={item.media_url} alt="Media" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-2 left-2 right-2 text-left">
                            <span className="block text-[10px] font-black text-neonGreen uppercase tracking-widest drop-shadow-sm">Hole {item.hole_number}</span>
                            <span className="block text-[9px] font-bold text-white/80 line-clamp-1">
                                {item.matches?.courses?.name || 'Unknown Course'}
                            </span>
                        </div>
                        {item.media_type === 'video' && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/20">
                                <div className="w-0 h-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-white border-b-[3px] border-b-transparent ml-0.5" />
                            </div>
                        )}
                    </motion.button>
                ))}
            </div>

            {isLightboxOpen && (
                <MediaLightbox
                    items={lightboxMedia}
                    initialIndex={lightboxIndex}
                    onClose={() => setIsLightboxOpen(false)}
                />
            )}
        </section>
    );
}
