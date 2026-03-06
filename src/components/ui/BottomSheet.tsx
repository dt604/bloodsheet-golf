import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    showCloseButton?: boolean;
    noPadding?: boolean;
}

export function BottomSheet({
    open,
    onClose,
    title,
    children,
    footer,
    className,
    showCloseButton = true,
    noPadding = false
}: BottomSheetProps) {
    // Lock body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
        } else {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
        };
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const sheetContent = (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[9999] flex flex-col justify-end pointer-events-none">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm pointer-events-auto"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className={`relative w-full max-w-lg mx-auto bg-surface border-t border-white/10 rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] pointer-events-auto ${className || ''}`}
                    >
                        {/* Top Accent "Light Beam" */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-bloodRed/50 to-transparent" />

                        {/* Drag handle */}
                        <div className="flex justify-center pt-3 pb-1 shrink-0">
                            <div className="w-12 h-1.5 rounded-full bg-white/10" />
                        </div>

                        {/* Header */}
                        {title && (
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                                <h3 className="text-xl font-black uppercase italic tracking-tight text-white">
                                    {title}
                                </h3>
                                {showCloseButton && (
                                    <button
                                        onClick={onClose}
                                        className="p-2 -mr-2 text-secondaryText hover:text-white transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Scrollable content */}
                        <div className={`flex-1 overflow-y-auto momentum-scroll no-scrollbar ${noPadding ? '' : 'px-6 py-4'}`}>
                            {children}
                        </div>

                        {/* Footer */}
                        {footer && (
                            <div className="shrink-0 p-4 border-t border-white/5 bg-surface/50 backdrop-blur-md">
                                {footer}
                            </div>
                        )}

                        {/* Safe area spacer */}
                        <div className="h-[env(safe-area-inset-bottom,20px)] shrink-0" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(sheetContent, document.body);
}
