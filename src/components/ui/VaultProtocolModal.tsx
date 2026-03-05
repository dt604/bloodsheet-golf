import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Trophy, Swords, Gift } from 'lucide-react';
import { BloodCoin } from './BloodCoin';

interface VaultProtocolModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function VaultProtocolModal({ isOpen, onClose }: VaultProtocolModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full sm:w-[500px] bg-surface rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                    >
                        {/* Header Image / Glow */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-bloodRed/20 to-transparent pointer-events-none" />

                        <div className="relative shrink-0 flex items-center justify-between p-6 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <BloodCoin animated={true} size="sm" className="drop-shadow-[0_0_10px_rgba(255,0,63,0.5)]" />
                                <h2 className="text-xl font-black text-white italic tracking-wider uppercase">The House Rules</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 -mr-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-secondaryText group-hover:text-white" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto p-6 space-y-8 pb-12">

                            {/* Section 1: The Asset */}
                            <section>
                                <h3 className="text-[10px] text-bloodRed font-black uppercase tracking-[0.3em] mb-3">The Asset</h3>
                                <p className="text-sm text-secondaryText leading-relaxed">
                                    Blood Coins are the underground currency of the circuit. They represent your reputation, dominance, and engagement within the league. They cannot be bought with cash—they must be earned.
                                </p>
                            </section>

                            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* Section 2: The Grind */}
                            <section>
                                <h3 className="text-[10px] text-neonGreen font-black uppercase tracking-[0.3em] mb-4">The Grind (Earning)</h3>

                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-neonGreen/10 flex items-center justify-center border border-neonGreen/20 shrink-0">
                                            <Swords className="w-5 h-5 text-neonGreen" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm mb-1">Match Wagers</h4>
                                            <p className="text-xs text-secondaryText leading-relaxed">Putt your Blood Coins on the line. Beat your opponents and take their share. The higher the stakes, the bigger the payout.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-surfaceHover flex items-center justify-center border border-white/10 shrink-0">
                                            <Target className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm mb-1">Skill Bonuses</h4>
                                            <p className="text-xs text-secondaryText leading-relaxed">Log Greenies, Sandies, Snakes, and Eagles. Exceptional play commands additional respect from The Vault.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shrink-0">
                                            <Trophy className="w-5 h-5 text-yellow-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold text-sm mb-1">League Titles</h4>
                                            <p className="text-xs text-secondaryText leading-relaxed">Winning an official tournament grants a massive infusion of Blood Coins directly from the league reserve.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            {/* Section 3: The Spoils */}
                            <section>
                                <h3 className="text-[10px] text-white font-black uppercase tracking-[0.3em] mb-4 opacity-70">The Spoils (Spending)</h3>

                                <div className="bg-gradient-to-br from-bloodRed/10 to-background border border-bloodRed/20 rounded-2xl p-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-bloodRed/20 blur-3xl rounded-full" />

                                    <div className="relative z-10 flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-bloodRed/20 flex items-center justify-center border border-bloodRed/30 shrink-0 shadow-[0_0_15px_rgba(255,0,63,0.3)]">
                                            <Gift className="w-5 h-5 text-bloodRed" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-black italic tracking-wide text-sm mb-1">The Pro Shop</h4>
                                            <p className="text-xs text-secondaryText leading-relaxed mb-3">
                                                Redeem your Blood Coins for premium physical gear, exclusive drops, and high-value digital gift cards. Stock is limited. Only the dominant survive.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                        </div>

                        {/* Footer Action */}
                        <div className="shrink-0 p-6 pt-2 border-t border-white/5 bg-surface/50 backdrop-blur-md">
                            <button
                                onClick={onClose}
                                className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-[0.98]"
                            >
                                Understood
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
