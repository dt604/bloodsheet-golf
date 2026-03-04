import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Coins, Star, Zap } from 'lucide-react';
import { BloodCoin } from './BloodCoin';
import confetti from 'canvas-confetti';

interface RewardEvent {
    userId: string;
    rewardType: string;
    amount: number;
    holeNumber: number | null;
}

export function RewardToast() {
    const [reward, setReward] = useState<RewardEvent | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            const detail = e.detail as RewardEvent;
            setReward(detail);
            setVisible(true);

            // ── Celebration ─────────────────────────────────────────
            if (detail.rewardType === 'eagle' || detail.rewardType === 'round_completion') {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.7 },
                    colors: ['#FF003F', '#00FF66', '#FFFFFF'],
                    zIndex: 200,
                    disableForReducedMotion: true
                });
            } else if (detail.rewardType === 'birdie' || detail.rewardType === 'sandie') {
                confetti({
                    particleCount: 50,
                    spread: 40,
                    origin: { y: 0.8 },
                    colors: ['#00FF66', '#FFFFFF'],
                    zIndex: 200,
                    disableForReducedMotion: true
                });
            }

            // Auto-hide after 5 seconds
            const timer = setTimeout(() => {
                setVisible(false);
            }, 5000);

            return () => clearTimeout(timer);
        };

        window.addEventListener('blood-coin-reward', handler);
        return () => window.removeEventListener('blood-coin-reward', handler);
    }, []);

    const getRewardLabel = (type: string) => {
        switch (type) {
            case 'birdie': return 'BIRDIE BONUS';
            case 'eagle': return 'EAGLE BONUS';
            case 'sandie': return 'SANDY SAVE';
            case 'round_completion': return 'LOYALTY REWARD';
            default: return 'REWARD EARNED';
        }
    };

    const getRewardIcon = (type: string) => {
        switch (type) {
            case 'birdie': return <Zap className="w-5 h-5 text-[#00FF66]" />;
            case 'eagle': return <Trophy className="w-5 h-5 text-[#FFD700]" />;
            case 'sandie': return <Star className="w-5 h-5 text-[#00FF66]" />;
            case 'round_completion': return <Coins className="w-5 h-5 text-bloodRed" />;
            default: return <Coins className="w-5 h-5 text-white" />;
        }
    };

    return (
        <AnimatePresence>
            {visible && reward && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="fixed bottom-24 left-4 right-4 z-[100] flex justify-center pointer-events-none"
                >
                    <div className="bg-[#1C1C1E]/90 backdrop-blur-xl border-2 border-bloodRed/30 rounded-2xl p-4 shadow-[0_10px_40px_rgba(255,0,63,0.2)] flex items-center gap-4 max-w-sm w-full pointer-events-auto overflow-hidden relative group">
                        {/* Animated background glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-bloodRed/10 via-transparent to-bloodRed/10 animate-pulse" />

                        <div className="relative z-10 w-12 h-12 rounded-xl bg-surfaceHover border border-white/5 flex items-center justify-center shrink-0 shadow-inner">
                            {getRewardIcon(reward.rewardType)}
                        </div>

                        <div className="relative z-10 flex-1 flex flex-col">
                            <span className="text-[10px] font-black tracking-[0.2em] text-bloodRed uppercase mb-0.5">
                                {getRewardLabel(reward.rewardType)}
                            </span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-xl font-black text-white italic tracking-tight uppercase">
                                    +{reward.amount}
                                </span>
                                <BloodCoin className="w-4 h-4" />
                            </div>
                            {reward.holeNumber && (
                                <span className="text-[9px] font-bold text-secondaryText uppercase tracking-widest mt-0.5">
                                    Hole {reward.holeNumber} Performance
                                </span>
                            )}
                        </div>

                        <div className="relative z-10 pr-2">
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            >
                                <Zap className="w-4 h-4 text-[#00FF66] opacity-50" />
                            </motion.div>
                        </div>

                        {/* Close button */}
                        <button
                            onClick={() => setVisible(false)}
                            className="absolute top-2 right-2 text-secondaryText hover:text-white transition-colors"
                        >
                            <span className="sr-only">Close</span>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
