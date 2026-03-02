import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
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
}

export function MediaLightbox({ items, initialIndex, onClose }: MediaLightboxProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % items.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    };

    const currentItem = items[currentIndex];

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
                    <a
                        href={currentItem.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md text-white hover:bg-white/20 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                    </a>
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
