import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, Trash2, Share2 } from 'lucide-react';
import { useState } from 'react';

export interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'video';
    context?: string | null;
    uploaderId: string;
    playerId: string;
    holeNumber: number;
}

interface MediaLightboxProps {
    items: MediaItem[];
    initialIndex: number;
    onClose: () => void;
    onDelete?: (mediaId: string) => void;
}

export function MediaLightbox({ items, initialIndex, onClose, onDelete }: MediaLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % items.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    };

    const currentItem = items[currentIndex];

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentItem) return;

        const shareData = {
            title: 'BloodSheet Golf Moment',
            text: `Check out this moment from Hole ${currentItem.holeNumber}!`,
            url: currentItem.url
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err instanceof Error && err.name !== 'AbortError') console.error(err);
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(currentItem.url);
                alert('Link copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy link:', err);
            }
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentItem || !onDelete || isDeleting) return;

        if (confirm('Are you sure you want to delete this moment?')) {
            setIsDeleting(true);
            try {
                await onDelete(currentItem.id);
                if (items.length === 1) {
                    onClose();
                } else {
                    const nextIndex = currentIndex === items.length - 1 ? currentIndex - 1 : currentIndex;
                    setCurrentIndex(Math.max(0, nextIndex));
                }
            } finally {
                setIsDeleting(false);
            }
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl"
                onClick={onClose}
            >
                {/* Header Actions */}
                <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10 safe-top">
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md text-white hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    {currentItem?.context && (
                        <div className="px-3 py-1.5 rounded-full bg-bloodRed/20 border border-bloodRed/50 backdrop-blur-md">
                            <span className="text-[10px] font-black uppercase tracking-widest text-bloodRed">
                                {currentItem.context}
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleShare}
                            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg active:scale-95"
                        >
                            <Share2 className="w-4 h-4" />
                        </button>
                        <a
                            href={currentItem.url}
                            download
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg active:scale-95"
                        >
                            <Download className="w-4 h-4" />
                        </a>
                        {onDelete && (
                            <button
                                onClick={handleDelete}
                                className="w-10 h-10 rounded-full bg-bloodRed flex items-center justify-center text-white hover:bg-bloodRed/80 transition-all shadow-[0_0_15px_rgba(255,0,63,0.4)] active:scale-90"
                                title="Delete moment"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Media Container */}
                <div className="w-full h-full flex items-center justify-center p-4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {currentItem.type === 'video' ? (
                                <video
                                    src={currentItem.url}
                                    controls
                                    autoPlay
                                    playsInline
                                    loop
                                    className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
                                />
                            ) : (
                                <img
                                    src={currentItem.url}
                                    alt="Match moment"
                                    className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation Controls */}
                {items.length > 1 && (
                    <>
                        <button
                            onClick={handlePrev}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 border border-white/10 flex items-center justify-center backdrop-blur-md text-white hover:bg-white/10 transition-colors z-10"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                            onClick={handleNext}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 border border-white/10 flex items-center justify-center backdrop-blur-md text-white hover:bg-white/10 transition-colors z-10"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </>
                )}

                {/* Footer Info */}
                <div className="absolute bottom-0 inset-x-0 p-6 flex flex-col items-center justify-end bg-gradient-to-t from-black/90 to-transparent safe-bottom pointer-events-none">
                    <p className="text-white font-black text-lg drop-shadow-md">
                        Hole {currentItem.holeNumber}
                    </p>
                    {items.length > 1 && (
                        <div className="flex gap-1.5 mt-4">
                            {items.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-white w-6' : 'bg-white/30 w-1.5'
                                        }`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
