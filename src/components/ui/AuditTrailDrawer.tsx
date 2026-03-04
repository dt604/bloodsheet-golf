import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { ScoreEditLog } from '../../types';

interface AuditTrailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    logs: ScoreEditLog[];
}

export default function AuditTrailDrawer({ isOpen, onClose, logs }: AuditTrailDrawerProps) {
    if (!isOpen) return null;

    // Sort logs newest first
    const sortedLogs = [...logs].sort((a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime());

    const formatDateTime = (isoString: string) => {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-bloodRed/30 rounded-t-3xl shadow-[0_-10px_40px_rgba(255,0,63,0.15)] flex flex-col max-h-[85vh] safe-bottom"
                    >
                        {/* Drawer pull indicator */}
                        <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                        </div>

                        <div className="flex items-center justify-between px-6 pb-4 border-b border-borderColor">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-bloodRed/10 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-bloodRed drop-shadow-[0_0_8px_rgba(255,0,63,0.8)]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black italic uppercase tracking-tight text-white">Post-Round Edits</h2>
                                    <p className="text-[10px] font-bold text-bloodRed uppercase tracking-widest mt-0.5">Audit Trail Log</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-secondaryText hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60vh]">
                            {sortedLogs.length === 0 ? (
                                <div className="text-center py-10 text-secondaryText">
                                    <p>No edits recorded.</p>
                                </div>
                            ) : (
                                sortedLogs.map((log) => (
                                    <div key={log.id} className="bg-surface border border-borderColor rounded-xl p-4 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-bloodRed" />
                                        <div className="flex justify-between items-start mb-3 pl-2">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-secondaryText" />
                                                <span className="text-xs font-bold text-secondaryText uppercase tracking-wider">
                                                    {formatDateTime(log.editedAt)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pl-2">
                                            <p className="text-sm text-white leading-relaxed">
                                                <span className="font-bold text-bloodRed">{log.editor?.fullName || 'Someone'}</span> changed{' '}
                                                <span className="font-bold">{log.player?.fullName || 'a player'}'s</span> score on{' '}
                                                <span className="font-bold text-white">Hole {log.holeNumber}</span>.
                                            </p>

                                            <div className="mt-3 flex items-center gap-4 bg-background/50 rounded-lg p-3 border border-borderColor/50">
                                                <div className="flex-1 text-center">
                                                    <span className="block text-[10px] uppercase font-bold text-secondaryText tracking-widest mb-1">Original Gross</span>
                                                    <span className="text-2xl font-black text-white">{log.oldGross}</span>
                                                </div>
                                                <ArrowRight className="w-5 h-5 text-bloodRed/50" />
                                                <div className="flex-1 text-center">
                                                    <span className="block text-[10px] uppercase font-bold text-secondaryText tracking-widest mb-1">New Gross</span>
                                                    <span className="text-2xl font-black text-bloodRed drop-shadow-[0_0_5px_rgba(255,0,63,0.5)]">{log.newGross}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
