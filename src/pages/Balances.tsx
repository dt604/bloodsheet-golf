import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Check, Loader, ChevronRight, Banknote, History as HistoryIcon, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useLedgerStore } from '../store/useLedgerStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabase';
import { Debt } from '../types';
import { BloodCoin } from '../components/ui/BloodCoin';
import { BottomSheet } from '../components/ui/BottomSheet';

type Tab = 'owed_by_me' | 'owed_to_me' | 'history';

export default function BalancesPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const {
        debtsOwedByMe,
        debtsOwedToMe,
        payments,
        paymentHistory,
        loadDebts,
        isLoading,
        confirmPayment,
        settleWithCash,
        deletePayments
    } = useLedgerStore();

    const [activeTab, setActiveTab] = useState<Tab>('owed_by_me');

    // UI state for modals
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
    const [sheetMode, setSheetMode] = useState<'settle_options' | null>(null);

    const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const renderAmount = (amount: number, currency?: 'USD' | 'BLOOD_COINS', colorClass?: string) => {
        const isUSD = currency === 'USD' || !currency;
        if (isUSD) {
            return (
                <span className={colorClass}>
                    ${amount.toFixed(2)}
                </span>
            );
        }
        return (
            <span className={`flex items-center gap-1.5 ${colorClass}`}>
                <BloodCoin size="xs" className="mb-0.5" />
                {amount}
            </span>
        );
    };

    // Initial load
    useEffect(() => {
        if (user) {
            loadDebts(user.id);
        }
    }, [user, loadDebts]);

    // Realtime listener
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('balances-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'payments' },
                () => {
                    loadDebts(user.id);
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'debts' },
                () => {
                    loadDebts(user.id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, loadDebts]);

    const handleRefresh = async () => {
        if (!user) return;
        setIsRefreshing(true);
        await loadDebts(user.id);
        setTimeout(() => setIsRefreshing(false), 500);
    };


    const handleSettleUpClick = async (debt: Debt) => {
        setSelectedDebt(debt);
        setSheetMode('settle_options');
    };

    const onSelectSettleCash = async () => {
        if (!selectedDebt) return;
        const confirmed = window.confirm(`Mark $${selectedDebt.remainingAmount.toFixed(2)} as paid in cash? This will notify ${selectedDebt.creditor?.fullName}.`);
        if (!confirmed) return;
        await settleWithCash(selectedDebt.id, selectedDebt.remainingAmount);
        setSheetMode(null);
        setSelectedDebt(null);
        alert('Cash payment recorded. Pending confirmation.');
    };

    const handleConfirmReceipt = async (paymentId: string) => {
        if (window.confirm("Confirm you received this payment?")) {
            await confirmPayment(paymentId);
        }
    };

    const handleToggleHistorySelect = (id: string) => {
        setSelectedHistoryIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAllHistory = () => {
        if (selectedHistoryIds.length === paymentHistory.length) {
            setSelectedHistoryIds([]);
        } else {
            setSelectedHistoryIds(paymentHistory.map(p => p.id));
        }
    };

    const handleDeleteSelectedHistory = async () => {
        if (selectedHistoryIds.length === 0) return;
        if (window.confirm(`Delete ${selectedHistoryIds.length} hidden history records? This will NOT affect your current balances.`)) {
            await deletePayments(selectedHistoryIds);
            setSelectedHistoryIds([]);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    const renderOwesMe = () => {
        if (debtsOwedToMe.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-surfaceHover rounded-full flex items-center justify-center mb-4 border border-white/5">
                        <ArrowDownLeft className="w-8 h-8 text-secondaryText/30" />
                    </div>
                    <h3 className="text-white font-black uppercase tracking-wide mb-2 italic">Clean Ledger</h3>
                    <p className="text-xs text-secondaryText max-w-[200px]">No one owes you money right now. Time for another round?</p>
                </div>
            );
        }

        return (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                {debtsOwedToMe.map(debt => {
                    const debtor = debt.debtor;
                    const payment = payments.find(p => p.debtId === debt.id && !['confirmed', 'rejected'].includes(p.status));

                    return (
                        <motion.div key={debt.id} variants={itemVariants}>
                            <Card className="p-4 relative group overflow-hidden border border-white/5 bg-surface/40 backdrop-blur-md hover:border-neonGreen/30 transition-all duration-300">
                                <div className="absolute inset-0 bg-gradient-to-r from-neonGreen/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div
                                            className="w-12 h-12 rounded-2xl bg-surfaceHover border border-white/10 overflow-hidden shrink-0 cursor-pointer hover:border-neonGreen/50 transition-colors"
                                            onClick={() => navigate(`/history/${debt.matchId}`)}
                                        >
                                            {debtor?.avatarUrl ? (
                                                <img src={debtor.avatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                    <span className="text-lg font-black text-secondaryText uppercase tracking-tighter">
                                                        {debtor?.fullName?.charAt(0) || '?'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-white text-base leading-tight uppercase italic tracking-tight truncate">{debtor?.fullName}</h3>
                                            <span className="text-[10px] text-neonGreen font-bold uppercase tracking-[0.2em] mt-1 block">Owes You</span>
                                        </div>
                                    </div>

                                    <div className="text-right flex flex-col items-end gap-3 shrink-0">
                                        <span className="font-black text-2xl text-neonGreen leading-none italic tracking-tighter drop-shadow-[0_0_15px_rgba(0,255,102,0.3)]">
                                            {renderAmount(debt.remainingAmount, debt.currency)}
                                        </span>

                                        {/* External payment info request removed - only Cash settlement supported */}
                                        {payment?.status === 'requested_info' && payment.paymentAddress && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded border border-amber-500/30">
                                                <Loader className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                                                <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest italic">Awaiting Payment</span>
                                            </div>
                                        )}
                                        {payment?.status === 'pending_confirmation' && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleConfirmReceipt(payment.id)}
                                                className="h-8 text-[10px] px-4 font-black uppercase tracking-widest bg-white text-neonGreen hover:bg-white/90 border-0"
                                            >
                                                Confirm Receipt
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </motion.div>
        );
    };

    const renderIOwe = () => {
        if (debtsOwedByMe.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-surfaceHover rounded-full flex items-center justify-center mb-4 border border-white/5">
                        <ArrowUpRight className="w-8 h-8 text-secondaryText/30" />
                    </div>
                    <h3 className="text-white font-black uppercase tracking-wide mb-2 italic">Debt Free</h3>
                    <p className="text-xs text-secondaryText max-w-[200px]">You don't owe any money. That's how it's done.</p>
                </div>
            );
        }

        return (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                {debtsOwedByMe.map(debt => {
                    const creditor = debt.creditor;
                    const payment = payments.find(p => p.debtId === debt.id && !['confirmed', 'rejected'].includes(p.status));

                    return (
                        <motion.div key={debt.id} variants={itemVariants}>
                            <Card className="p-4 relative group overflow-hidden border border-white/5 bg-surface/40 backdrop-blur-md hover:border-bloodRed/30 transition-all duration-300">
                                <div className="absolute inset-0 bg-gradient-to-r from-bloodRed/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div
                                            className="w-12 h-12 rounded-2xl bg-surfaceHover border border-white/10 overflow-hidden shrink-0 cursor-pointer hover:border-bloodRed/50 transition-colors"
                                            onClick={() => navigate(`/history/${debt.matchId}`)}
                                        >
                                            {creditor?.avatarUrl ? (
                                                <img src={creditor.avatarUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                    <span className="text-lg font-black text-secondaryText uppercase tracking-tighter">
                                                        {creditor?.fullName?.charAt(0) || '?'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-white text-base leading-tight uppercase italic tracking-tight truncate">{creditor?.fullName}</h3>
                                            <span className="text-[10px] text-bloodRed font-bold uppercase tracking-[0.2em] mt-1 block">You Owe</span>
                                        </div>
                                    </div>

                                    <div className="text-right flex flex-col items-end gap-3 shrink-0">
                                        <span className="font-black text-2xl text-bloodRed leading-none italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,0,63,0.3)]">
                                            {renderAmount(debt.remainingAmount, debt.currency)}
                                        </span>

                                        {!payment ? (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSettleUpClick(debt)}
                                                className="h-8 text-[10px] px-4 font-black uppercase tracking-widest bg-bloodRed text-white hover:bg-bloodRed/90 border-0"
                                            >
                                                Settle Up
                                            </Button>
                                        ) : payment.status === 'requested_info' && !payment.paymentAddress ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded border border-amber-500/30">
                                                <Loader className="w-2.5 h-2.5 text-amber-500 animate-spin" />
                                                <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest italic">Awaiting Info</span>
                                            </div>
                                        ) : payment.status === 'requested_info' && payment.paymentAddress ? (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSettleUpClick(debt)}
                                                className="h-8 text-[10px] px-4 font-black uppercase tracking-widest bg-white text-bloodRed hover:bg-white/90 border-0"
                                            >
                                                Pay Now
                                            </Button>
                                        ) : payment.status === 'pending_confirmation' ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded border border-white/10">
                                                <Loader className="w-2.5 h-2.5 text-secondaryText animate-spin" />
                                                <span className="text-[9px] text-secondaryText font-bold uppercase tracking-widest italic">Awaiting Receipt</span>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </motion.div>
        );
    };

    const renderHistory = () => {
        if (!paymentHistory || paymentHistory.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-surfaceHover rounded-full flex items-center justify-center mb-4 border border-white/5">
                        <HistoryIcon className="w-8 h-8 text-secondaryText/30" />
                    </div>
                    <h3 className="text-white font-black uppercase tracking-wide mb-2 italic">No History</h3>
                    <p className="text-xs text-secondaryText max-w-[200px]">Settled debts will appear here.</p>
                </div>
            );
        }

        return (
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                {/* Bulk Actions Bar */}
                <motion.div variants={itemVariants} className="flex items-center justify-between mb-2 bg-surface/50 backdrop-blur-md p-3 rounded-2xl border border-white/5">
                    <button
                        onClick={handleSelectAllHistory}
                        className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-secondaryText hover:text-white transition-colors"
                    >
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${selectedHistoryIds.length === paymentHistory.length ? 'bg-white border-white scale-110' : 'border-white/10 bg-white/5'}`}>
                            {selectedHistoryIds.length === paymentHistory.length && <Check className="w-3.5 h-3.5 text-black" />}
                        </div>
                        {selectedHistoryIds.length === paymentHistory.length ? 'Deselect All' : 'Select All'}
                    </button>

                    <AnimatePresence>
                        {selectedHistoryIds.length > 0 && (
                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                onClick={handleDeleteSelectedHistory}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-bloodRed bg-bloodRed/10 px-4 py-2 rounded-xl border border-bloodRed/20 hover:bg-bloodRed/20 transition-all shadow-[0_4px_12px_rgba(255,0,63,0.15)]"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete ({selectedHistoryIds.length})
                            </motion.button>
                        )}
                    </AnimatePresence>
                </motion.div>

                {paymentHistory.map(payment => {
                    const isPayer = payment.payerId === user?.id;
                    const otherPerson = isPayer ? payment.receiver : payment.payer;
                    const isSelected = selectedHistoryIds.includes(payment.id);

                    return (
                        <motion.div key={payment.id} variants={itemVariants}>
                            <Card
                                onClick={() => handleToggleHistorySelect(payment.id)}
                                className={`p-4 relative group overflow-hidden border transition-all duration-300 cursor-pointer ${isSelected ? 'border-bloodRed/50 bg-bloodRed/10 shadow-[0_0_20px_rgba(255,0,63,0.15)]' : 'border-white/5 bg-surface/40 opacity-80 backdrop-blur-md hover:opacity-100 hover:border-white/20'}`}
                            >
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="relative shrink-0">
                                            <div className="w-12 h-12 rounded-2xl bg-surfaceHover border border-white/10 flex items-center justify-center overflow-hidden">
                                                {otherPerson?.avatarUrl ? (
                                                    <img src={otherPerson.avatarUrl} alt="" className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 transition-opacity" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                                                        <span className="text-lg font-black text-secondaryText uppercase tracking-tighter">
                                                            {otherPerson?.fullName?.charAt(0) || '?'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center transition-all ${isSelected ? 'bg-bloodRed border-bloodRed scale-110 shadow-[0_0_10px_rgba(255,0,63,0.5)]' : 'bg-surface border-white/10'}`}>
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-black text-base leading-tight uppercase italic tracking-tight truncate transition-colors ${isSelected ? 'text-white' : 'text-secondaryText'}`}>{otherPerson?.fullName}</h3>
                                            <p className="text-[10px] text-secondaryText/50 uppercase font-bold tracking-[0.2em] mt-1">
                                                {isPayer ? 'You Paid' : 'Paid You'} • {new Date(payment.updatedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-2 shrink-0">
                                        <span className={`font-black text-xl leading-none italic tracking-tighter transition-colors ${isSelected ? 'text-white' : 'text-secondaryText'}`}>
                                            {renderAmount(payment.amount, payment.currency)}
                                        </span>
                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-secondaryText uppercase font-bold tracking-widest italic">
                                            Settled
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </motion.div>
        );
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-background font-sans overflow-x-hidden safe-bottom relative">
            <SEO title="Cash Ledger | Balances" />

            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-neonGreen/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-bloodRed/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Header / Navigation */}
            <div className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 pt-safe">
                <div className="flex items-center justify-between px-4 h-16">
                    <button
                        onClick={() => navigate('/blood-bank')}
                        className="p-2 -ml-2 hover:bg-white/5 rounded-xl text-white transition-colors active:scale-95 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>

                    <div className="flex flex-col items-center">
                        <h1 className="text-white font-black italic tracking-wider text-base uppercase">Cash Ledger</h1>
                        <span className="text-[9px] text-secondaryText uppercase tracking-[0.2em] font-bold">Settle Your Debts</span>
                    </div>

                    <button
                        onClick={handleRefresh}
                        className="p-2 hover:bg-white/5 rounded-xl text-secondaryText hover:text-white transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-bloodRed' : ''}`} />
                    </button>
                </div>

                {/* Segmented Control Tabs */}
                <div className="mx-4 mb-4 p-1 bg-white/[0.02] border border-white/5 rounded-2xl relative flex items-center">
                    {/* Sliding Pill */}
                    <motion.div
                        className="absolute h-[calc(100%-8px)] bg-surface shadow-[0_8px_25px_rgba(0,0,0,0.6)] border border-white/10 rounded-xl pointer-events-none overflow-hidden"
                        initial={false}
                        animate={{
                            left: activeTab === 'owed_by_me' ? '4px' : activeTab === 'owed_to_me' ? 'calc(33.33% + 2px)' : 'calc(66.66% + 0px)',
                            width: 'calc(33.33% - 6px)'
                        }}
                        transition={{ type: "spring", damping: 28, stiffness: 300 }}
                    >
                        {/* Internal Thematic Glow */}
                        <div className={`absolute inset-0 opacity-20 blur-xl transition-colors duration-500 ${activeTab === 'owed_by_me' ? 'bg-bloodRed' : activeTab === 'owed_to_me' ? 'bg-neonGreen' : 'bg-white'}`} />

                        {/* Top Accent "Light Beam" for depth */}
                        <div className={`absolute top-0 left-2 right-2 h-[1px] transition-colors duration-500 ${activeTab === 'owed_by_me' ? 'bg-bloodRed' : activeTab === 'owed_to_me' ? 'bg-neonGreen' : 'bg-white/40'}`} />
                    </motion.div>

                    {/* Tab Buttons */}
                    {[
                        { id: 'owed_by_me', label: 'You Owe', icon: ArrowUpRight, activeColor: 'text-bloodRed', glow: 'rgba(255,0,63,0.6)' },
                        { id: 'owed_to_me', label: 'Owed To You', icon: ArrowDownLeft, activeColor: 'text-neonGreen', glow: 'rgba(0,255,102,0.6)' },
                        { id: 'history', label: 'History', icon: HistoryIcon, activeColor: 'text-white', glow: 'rgba(255,255,255,0.4)' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex-1 flex flex-col items-center justify-center py-2.5 relative z-10 transition-all duration-400`}
                        >
                            <tab.icon className={`w-3.5 h-3.5 mb-1 transition-all duration-300 ${activeTab === tab.id ? `${tab.activeColor} scale-110 drop-shadow-[0_0_5px_${tab.glow}]` : 'text-secondaryText scale-100'}`} />
                            <span
                                className={`text-[9px] font-black uppercase tracking-[0.15em] italic transition-all duration-300 ${activeTab === tab.id ? 'text-white' : 'text-secondaryText hover:text-white/60'}`}
                                style={activeTab === tab.id ? { textShadow: `0 0 8px ${tab.glow}` } : {}}
                            >
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 pb-24 relative z-10 pt-[calc(env(safe-area-inset-top)+140px)]">

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader className="w-8 h-8 text-bloodRed animate-spin mb-4" />
                        <span className="text-secondaryText text-sm font-bold uppercase tracking-widest">Auditing the Vault...</span>
                    </div>
                ) : (
                    <div className="pb-10">
                        {/* Tab Intro (Optional, but adds to the Pro Shop feel) */}
                        <div className="mb-6 px-1">
                            <h2 className="text-xl font-black text-white italic tracking-tight uppercase">
                                {activeTab === 'owed_by_me' ? 'Debts to Settle' : activeTab === 'owed_to_me' ? 'Outstanding Gains' : 'Record of Service'}
                            </h2>
                            <p className="text-[10px] text-secondaryText font-bold uppercase tracking-widest mt-1 opacity-70">
                                {activeTab === 'owed_by_me' ? 'Do not let the sun go down on your debt.' : activeTab === 'owed_to_me' ? 'The fruits of your labor.' : 'The full trail of your transactions.'}
                            </p>
                        </div>

                        {activeTab === 'owed_by_me' ? renderIOwe() :
                            activeTab === 'owed_to_me' ? renderOwesMe() :
                                renderHistory()}
                    </div>
                )}
            </main>

            {/* Settle Options Sheet */}
            <BottomSheet
                open={sheetMode === 'settle_options' && !!selectedDebt}
                onClose={() => { setSheetMode(null); setSelectedDebt(null); }}
                title="Settle Up"
            >
                {selectedDebt && (
                    <div className="space-y-6 pb-6">
                        <p className="text-sm text-secondaryText font-bold uppercase tracking-widest px-1">
                            Payment for {selectedDebt.creditor?.fullName}
                        </p>

                        <button
                            onClick={onSelectSettleCash}
                            className="w-full flex items-center justify-between p-4 bg-background/50 border border-white/5 rounded-2xl group hover:border-neonGreen/30 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-neonGreen/10 flex items-center justify-center group-hover:bg-neonGreen/20 transition-colors">
                                    <Banknote className="w-5 h-5 text-neonGreen" />
                                </div>
                                <span className="font-black text-white uppercase italic tracking-tight">Settle with Cash</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-neonGreen transition-colors" />
                        </button>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
}
