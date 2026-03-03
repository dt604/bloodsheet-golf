import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Trash2, Check, ExternalLink, User, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SEO from '../../components/SEO';
import { EmptyState } from '../../components/ui/EmptyState';

export default function MediaManagement() {
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
    const [deleting, setDeleting] = useState(false);

    const fetchAllMedia = async () => {
        setLoading(true);
        try {
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
                    match_id,
                    matches(id, courses(name)),
                    player_profile:player_id(full_name, avatar_url),
                    uploader_profile:uploader_id(full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setMediaItems(data);
        } catch (error) {
            console.error('Failed to load all media', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllMedia();
    }, []);

    const handleBulkDelete = async () => {
        if (selectedMediaIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedMediaIds.length} items? This cannot be undone.`)) return;

        setDeleting(true);
        try {
            const mediaToDelete = mediaItems.filter(m => selectedMediaIds.includes(m.id));

            // 1. Delete from Storage
            const paths = mediaToDelete.map(m => {
                const parts = m.media_url.split('/public/match-media/');
                return parts.length > 1 ? parts[1] : null;
            }).filter(Boolean) as string[];

            if (paths.length > 0) {
                const { error: storageError } = await supabase.storage.from('match-media').remove(paths);
                if (storageError) console.error('Storage deletion error:', storageError);
            }

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from('match_media')
                .delete()
                .in('id', selectedMediaIds);

            if (dbError) throw dbError;

            // 3. Update local state
            setMediaItems(prev => prev.filter(m => !selectedMediaIds.includes(m.id)));
            setIsSelectionMode(false);
            setSelectedMediaIds([]);
        } catch (err) {
            console.error('Failed to bulk delete media:', err);
            alert('Failed to delete selected media.');
        } finally {
            setDeleting(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedMediaIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-6">
            <SEO title="Admin - Media Management" />

            {/* Header / Stats */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                    <div>
                        <h3 className="text-sm font-bold tracking-widest uppercase text-secondaryText">Global Vault</h3>
                        <p className="text-[10px] text-bloodRed font-black uppercase tracking-widest mt-0.5">Control Panel</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isSelectionMode ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setIsSelectionMode(false); setSelectedMediaIds([]); }}
                                    className="px-4 py-2 rounded-full border border-borderColor text-secondaryText hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={selectedMediaIds.length === 0 || deleting}
                                    className="px-4 py-2 rounded-full bg-bloodRed text-white hover:bg-bloodRed/80 transition-colors text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1 shadow-[0_0_15px_rgba(255,0,63,0.3)]"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete {selectedMediaIds.length > 0 ? `(${selectedMediaIds.length})` : ''}
                                </button>
                            </div>
                        ) : (
                            <>
                                {mediaItems.length > 0 && (
                                    <button
                                        onClick={() => setIsSelectionMode(true)}
                                        className="px-4 py-2 rounded-full bg-surface/50 border border-borderColor text-white hover:border-bloodRed transition-colors text-xs font-bold uppercase tracking-wider"
                                    >
                                        Bulk Edit
                                    </button>
                                )}
                                <button
                                    onClick={fetchAllMedia}
                                    disabled={loading}
                                    className="p-2 rounded-full bg-surface/50 border border-borderColor text-white hover:text-neonGreen transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface/50 border border-borderColor rounded-2xl p-3 text-center">
                        <span className="block text-[10px] font-bold text-secondaryText uppercase tracking-widest mb-1">Total Items</span>
                        <span className="text-xl font-black text-white italic">{mediaItems.length}</span>
                    </div>
                    <div className="bg-surface/50 border border-borderColor rounded-2xl p-3 text-center">
                        <span className="block text-[10px] font-bold text-secondaryText uppercase tracking-widest mb-1">Photos</span>
                        <span className="text-xl font-black text-white italic">{mediaItems.filter(m => m.media_type === 'image').length}</span>
                    </div>
                    <div className="bg-surface/50 border border-borderColor rounded-2xl p-3 text-center">
                        <span className="block text-[10px] font-bold text-secondaryText uppercase tracking-widest mb-1">Videos</span>
                        <span className="text-xl font-black text-white italic">{mediaItems.filter(m => m.media_type === 'video').length}</span>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="px-2">
                {loading && mediaItems.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-bloodRed border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(255,0,63,0.5)]" />
                    </div>
                ) : mediaItems.length === 0 ? (
                    <EmptyState
                        title="No Media Found"
                        description="There is no media content currently uploaded to the system."
                        accentColor="bloodRed"
                    />
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <AnimatePresence>
                            {mediaItems.map((item) => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className={`relative rounded-2xl overflow-hidden border transition-all cursor-pointer group ${selectedMediaIds.includes(item.id)
                                        ? 'border-bloodRed ring-2 ring-bloodRed/20'
                                        : 'border-borderColor hover:border-white/20'
                                        }`}
                                    onClick={() => isSelectionMode ? toggleSelect(item.id) : window.open(item.media_url, '_blank')}
                                >
                                    {/* Selection Overlay */}
                                    <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedMediaIds.includes(item.id)
                                        ? 'bg-bloodRed border-bloodRed'
                                        : 'bg-black/40 border-white/40'
                                        } ${isSelectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                        {selectedMediaIds.includes(item.id) && <Check className="w-3 h-3 text-white" />}
                                    </div>

                                    {/* Type icon */}
                                    <div className="absolute top-2 right-2 z-10 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className={`w-1.5 h-1.5 rounded-full ${item.media_type === 'video' ? 'bg-bloodRed' : 'bg-neonGreen'}`} />
                                        <span className="text-[8px] font-black text-white uppercase tracking-widest">{item.media_type}</span>
                                    </div>

                                    <div className="aspect-[4/5] bg-surface relative">
                                        {item.media_type === 'video' ? (
                                            <video src={item.media_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <img src={item.media_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="" />
                                        )}

                                        {/* Meta info footer */}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-6">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-4 h-4 rounded-full bg-surface border border-white/10 shrink-0 overflow-hidden">
                                                        {item.player_profile?.avatar_url ? (
                                                            <img src={item.player_profile.avatar_url} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User className="w-full h-full p-0.5 text-secondaryText" />
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-white truncate">{item.player_profile?.full_name || 'System'}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-secondaryText">
                                                    <Trophy className="w-3 h-3" />
                                                    <span className="text-[9px] font-bold uppercase truncate">{item.matches?.courses?.name || 'Match Content'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {!isSelectionMode && (
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ExternalLink className="w-6 h-6 text-white drop-shadow-lg" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
