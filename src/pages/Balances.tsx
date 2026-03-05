import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft, Check, Copy, Loader, Share2, ChevronRight, Banknote, History as HistoryIcon, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useLedgerStore } from '../store/useLedgerStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabase';
import { Debt } from '../types';
import { BloodCoin } from '../components/ui/BloodCoin';

type Tab = 'owed_by_me' | 'owed_to_me' | 'history';

export default function BalancesPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const {
        debtsOwedByMe,
        debtsOwedToMe,
        payments,
        paymentHistory,
        loadDebts,
        isLoading,
        requestPaymentInfo,
        providePaymentInfo,
        submitPayment,
        confirmPayment,
        settleWithCash,
        deletePayments
    } = useLedgerStore();

    const [activeTab, setActiveTab] = useState<Tab>('owed_by_me');

    // UI state for modals
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
    const [sheetMode, setSheetMode] = useState<'provide_info' | 'pay' | 'settle_options' | null>(null);

    // Form states
    const [paymentMethod, setPaymentMethod] = useState<'venmo' | 'etransfer'>('etransfer');
    const [paymentAddress, setPaymentAddress] = useState('');
    const [amountSent, setAmountSent] = useState('');
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
            <span className={`flex items-center gap-1 ${colorClass}`}>
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
        setTimeout(() => setIsRefreshing(false), 500); // Give the spin time to show
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard');
    };

    const handleSettleUpClick = async (debt: Debt) => {
        // If there's no payment request yet, open options first
        const payment = payments.find(p => p.debtId === debt.id && !['confirmed', 'rejected'].includes(p.status));
        if (!payment) {
            setSelectedDebt(debt);
            setSheetMode('settle_options');
        } else if (payment.status === 'requested_info' && payment.paymentAddress) {
            // Already provided info, ready to pay
            setSelectedDebt(debt);
            setAmountSent(debt.remainingAmount.toString());
            setSheetMode('pay');
        } else {
            alert('Waiting for creditor to provide payment details.');
        }
    };

    const onSelectSendTransfer = async () => {
        if (!selectedDebt) return;
        await requestPaymentInfo(selectedDebt.id);
        setSheetMode(null);
        setSelectedDebt(null);
        alert('Notification sent. Waiting for creditor to provide payment details.');
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

    const handleProvideInfoClick = (debt: Debt) => {
        const payment = payments.find(p => p.debtId === debt.id && p.status === 'requested_info');
        if (payment) {
            setSelectedDebt(debt);
            setPaymentAddress(profile?.email || '');
            setSheetMode('provide_info');
        }
    };

    const onSubmitProvideInfo = async () => {
        if (!selectedDebt) return;
        const payment = payments.find(p => p.debtId === selectedDebt.id && p.status === 'requested_info');
        if (!payment) return;

        if (!paymentAddress) return alert('Please provide an address');

        await providePaymentInfo(payment.id, paymentMethod, paymentAddress);
        setSheetMode(null);
        setSelectedDebt(null);
    };

    const onSubmitPayment = async () => {
        if (!selectedDebt) return;
        const payment = payments.find(p => p.debtId === selectedDebt.id && p.status === 'requested_info');
        if (!payment) return;

        const amount = parseFloat(amountSent);
        if (isNaN(amount) || amount <= 0 || amount > selectedDebt.remainingAmount) {
            return alert('Invalid amount');
        }

        await submitPayment(payment.id, amount);
        setSheetMode(null);
        setSelectedDebt(null);
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

    const renderOwesMe = () => {
        if (debtsOwedToMe.length === 0) {
            return (
                <div className="text-center p-8 text-secondaryText">
                    <p>No one owes you money right now.</p>
                </div>
            );
        }

        return debtsOwedToMe.map(debt => {
            const debtor = debt.debtor;
            const payment = payments.find(p => p.debtId === debt.id && !['confirmed', 'rejected'].includes(p.status));

            return (
                <Card key={debt.id} className="p-4 flex items-center justify-between mb-3 border border-borderColor">
                    <div className="flex items-stretch justify-between w-full">
                        <button
                            className="flex items-center gap-3 flex-1 text-left pr-4 cursor-pointer group focus:outline-none"
                            onClick={() => navigate(`/history/${debt.matchId}`)}
                            title="View Scorecard"
                        >
                            <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor group-hover:border-neonGreen/50 flex items-center justify-center overflow-hidden shrink-0 transition-colors">
                                {debtor?.avatarUrl ? (
                                    <img src={debtor.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-bold text-secondaryText uppercase">
                                        {debtor?.fullName?.charAt(0) || '?'}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-white truncate group-hover:text-neonGreen transition-colors">{debtor?.fullName}</h3>
                                    <p className="text-xs text-secondaryText uppercase tracking-widest mt-0.5">OwES YOU</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-secondaryText/50 group-hover:text-neonGreen transition-colors flex-shrink-0 ml-2" />
                            </div>
                        </button>
                        <div className="text-right flex flex-col items-end justify-center gap-2 shrink-0">
                            <span className="font-black text-xl text-neonGreen leading-none drop-shadow-[0_0_8px_rgba(0,255,102,0.3)]">
                                {renderAmount(debt.remainingAmount, debt.currency)}
                            </span>
                            {payment?.status === 'requested_info' && !payment.paymentAddress && (
                                <Button size="sm" onClick={() => handleProvideInfoClick(debt)} className="h-7 text-[10px] px-3">
                                    Add Payment Info
                                </Button>
                            )}
                            {payment?.status === 'requested_info' && payment.paymentAddress && (
                                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Waiting for payment</span>
                            )}
                            {payment?.status === 'pending_confirmation' && (
                                <Button size="sm" onClick={() => handleConfirmReceipt(payment.id)} className="h-7 text-[10px] px-3 bg-neonGreen/20 text-neonGreen hover:bg-neonGreen/30 border border-neonGreen/30">
                                    <Check className="w-3 h-3 mr-1" />
                                    Confirm Receipt
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
            );
        });
    };

    const renderIOwe = () => {
        if (debtsOwedByMe.length === 0) {
            return (
                <div className="text-center p-8 text-secondaryText">
                    <p>You don't owe any money. Nice!</p>
                </div>
            );
        }

        return debtsOwedByMe.map(debt => {
            const creditor = debt.creditor;
            const payment = payments.find(p => p.debtId === debt.id && !['confirmed', 'rejected'].includes(p.status));

            return (
                <Card key={debt.id} className="p-4 flex items-center justify-between mb-3 border border-borderColor">
                    <div className="flex items-stretch justify-between w-full">
                        <button
                            className="flex items-center gap-3 flex-1 text-left pr-4 cursor-pointer group focus:outline-none"
                            onClick={() => navigate(`/history/${debt.matchId}`)}
                            title="View Scorecard"
                        >
                            <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor group-hover:border-bloodRed/50 flex items-center justify-center overflow-hidden shrink-0 transition-colors">
                                {creditor?.avatarUrl ? (
                                    <img src={creditor.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-bold text-secondaryText uppercase">
                                        {creditor?.fullName?.charAt(0) || '?'}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-white truncate group-hover:text-bloodRed transition-colors">{creditor?.fullName}</h3>
                                    <p className="text-xs text-secondaryText uppercase tracking-widest mt-0.5">YOU OWE</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-secondaryText/50 group-hover:text-bloodRed transition-colors flex-shrink-0 ml-2" />
                            </div>
                        </button>
                        <div className="text-right flex flex-col items-end justify-center gap-2 shrink-0">
                            <span className="font-black text-xl text-bloodRed leading-none drop-shadow-[0_0_8px_rgba(255,0,63,0.3)]">
                                {renderAmount(debt.remainingAmount, debt.currency)}
                            </span>
                            {!payment ? (
                                <Button size="sm" variant="outline" onClick={() => handleSettleUpClick(debt)} className="h-7 text-[10px] px-3">
                                    Settle Up
                                </Button>
                            ) : payment.status === 'requested_info' && !payment.paymentAddress ? (
                                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Waiting for their info</span>
                            ) : payment.status === 'requested_info' && payment.paymentAddress ? (
                                <Button size="sm" onClick={() => handleSettleUpClick(debt)} className="h-7 text-[10px] px-3 bg-white text-bloodRed hover:bg-white/90">
                                    Pay Now
                                </Button>
                            ) : payment.status === 'pending_confirmation' ? (
                                <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Awaiting Receipt</span>
                            ) : null}
                        </div>
                    </div>
                </Card>
            );
        });
    };

    const renderHistory = () => {
        if (!paymentHistory || paymentHistory.length === 0) {
            return (
                <div className="text-center p-8 text-secondaryText">
                    <p>No settled payments yet.</p>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {/* Bulk Actions Bar */}
                {paymentHistory.length > 0 && (
                    <div className="flex items-center justify-between mb-4 bg-surface/50 p-3 rounded-2xl border border-white/5">
                        <button
                            onClick={handleSelectAllHistory}
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-secondaryText hover:text-white transition-colors"
                        >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedHistoryIds.length === paymentHistory.length ? 'bg-white border-white' : 'border-white/20'}`}>
                                {selectedHistoryIds.length === paymentHistory.length && <Check className="w-3 h-3 text-black" />}
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
                                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-bloodRed bg-bloodRed/10 px-3 py-1.5 rounded-lg border border-bloodRed/20 hover:bg-bloodRed/20 transition-all shadow-[0_4px_12px_rgba(255,0,63,0.15)]"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete ({selectedHistoryIds.length})
                                </motion.button>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {paymentHistory.map(payment => {
                    const isPayer = payment.payerId === user?.id;
                    const otherPerson = isPayer ? payment.receiver : payment.payer;
                    const isSelected = selectedHistoryIds.includes(payment.id);

                    return (
                        <Card
                            key={payment.id}
                            onClick={() => handleToggleHistorySelect(payment.id)}
                            className={`p-4 flex items-center justify-between border transition-all cursor-pointer ${isSelected ? 'border-bloodRed/50 bg-bloodRed/5 shadow-[0_0_15px_rgba(255,0,63,0.1)]' : 'border-borderColor/50 opacity-80 hover:opacity-100 hover:border-borderColor'}`}
                        >
                            <div className="flex items-stretch justify-between w-full">
                                <div className="flex items-center gap-3 flex-1 text-left pr-4">
                                    <div className="relative shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center overflow-hidden">
                                            {otherPerson?.avatarUrl ? (
                                                <img src={otherPerson.avatarUrl} alt="" className="w-full h-full object-cover grayscale" />
                                            ) : (
                                                <span className="text-sm font-bold text-secondaryText uppercase">
                                                    {otherPerson?.fullName?.charAt(0) || '?'}
                                                </span>
                                            )}
                                        </div>
                                        <div className={`absolute -top-1 -left-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center transition-all ${isSelected ? 'bg-bloodRed border-bloodRed scale-110' : 'bg-surface border-borderColor'}`}>
                                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div>
                                            <h3 className={`font-bold transition-colors truncate ${isSelected ? 'text-white' : 'text-secondaryText'}`}>{otherPerson?.fullName}</h3>
                                            <p className="text-[10px] text-secondaryText/70 uppercase tracking-widest mt-0.5">
                                                {isPayer ? 'You Paid' : 'Paid You'} • {new Date(payment.updatedAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end justify-center gap-2 shrink-0">
                                    <span className={`font-black text-xl leading-none transition-colors ${isSelected ? 'text-white' : 'text-secondaryText'}`}>
                                        {renderAmount(payment.amount, payment.currency)}
                                    </span>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-secondaryText uppercase font-bold tracking-widest">
                                        Settled
                                    </span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-x-hidden safe-bottom">
            <SEO title="Balances | Ledger" />
            <header className="flex flex-col border-b border-white/5 bg-surface/90 backdrop-blur-3xl sticky top-0 z-30">
                <div className="flex items-center p-4">
                    <button onClick={() => navigate('/wallet')} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 ml-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-bloodRed" />
                            <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">Balances</h2>
                        </div>
                        <button
                            onClick={handleRefresh}
                            className="p-2 text-secondaryText hover:text-white transition-colors focus:outline-none"
                            aria-label="Refresh Balances"
                        >
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-bloodRed' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-4 pb-0">
                    <button
                        className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-colors relative ${activeTab === 'owed_by_me' ? 'text-white' : 'text-secondaryText hover:text-white/80'}`}
                        onClick={() => setActiveTab('owed_by_me')}
                    >
                        <span className="flex items-center justify-center gap-1.5 flex-col">
                            <ArrowUpRight className={`w-4 h-4 ${activeTab === 'owed_by_me' ? 'text-bloodRed' : ''}`} />
                            You Owe
                        </span>
                        {activeTab === 'owed_by_me' && (
                            <motion.div layoutId="activetab" className="absolute bottom-0 left-0 right-0 h-1 bg-bloodRed shadow-[0_0_10px_rgba(255,0,63,0.5)]" />
                        )}
                    </button>
                    <button
                        className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-colors relative ${activeTab === 'owed_to_me' ? 'text-white' : 'text-secondaryText hover:text-white/80'}`}
                        onClick={() => setActiveTab('owed_to_me')}
                    >
                        <span className="flex items-center justify-center gap-1.5 flex-col">
                            <ArrowDownLeft className={`w-4 h-4 ${activeTab === 'owed_to_me' ? 'text-neonGreen' : ''}`} />
                            Owed To You
                        </span>
                        {activeTab === 'owed_to_me' && (
                            <motion.div layoutId="activetab" className="absolute bottom-0 left-0 right-0 h-1 bg-neonGreen shadow-[0_0_10px_rgba(0,255,102,0.5)]" />
                        )}
                    </button>
                    <button
                        className={`flex-1 pb-3 text-xs font-black uppercase tracking-widest transition-colors relative ${activeTab === 'history' ? 'text-white' : 'text-secondaryText hover:text-white/80'}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <span className="flex items-center justify-center gap-1.5 flex-col">
                            <HistoryIcon className={`w-4 h-4 ${activeTab === 'history' ? 'text-white' : ''}`} />
                            History
                        </span>
                        {activeTab === 'history' && (
                            <motion.div layoutId="activetab" className="absolute bottom-0 left-0 right-0 h-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                        )}
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader className="w-8 h-8 animate-spin text-bloodRed" />
                    </div>
                ) : (
                    <div className="space-y-4 pb-20">
                        {activeTab === 'owed_by_me' ? renderIOwe() :
                            activeTab === 'owed_to_me' ? renderOwesMe() :
                                renderHistory()}
                    </div>
                )}
            </main>

            {/* Settle Options Sheet */}
            <AnimatePresence>
                {sheetMode === 'settle_options' && selectedDebt && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-[env(safe-area-inset-top,4rem)]"
                        onClick={() => setSheetMode(null)}
                    >
                        <motion.div
                            initial={{ y: '-100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '-100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full bg-surface border border-borderColor rounded-3xl max-w-md p-6 shadow-2xl relative overflow-hidden mt-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-bloodRed/50 to-transparent" />
                            <h3 className="text-xl font-black text-white italic uppercase mb-2 text-center">Settle Up</h3>
                            <p className="text-sm text-secondaryText text-center mb-6">How do you want to pay {selectedDebt.creditor?.fullName}?</p>

                            <div className="space-y-3">
                                <Button
                                    onClick={onSelectSettleCash}
                                    variant="outline"
                                    className="w-full justify-between items-center h-14 bg-background/50 border-borderColor hover:bg-surfaceHover hover:border-bloodRed/50 group transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-neonGreen/10 flex items-center justify-center group-hover:bg-neonGreen/20 transition-colors">
                                            <Banknote className="w-4 h-4 text-neonGreen" />
                                        </div>
                                        <span className="font-bold text-white uppercase tracking-wide text-sm">Settle with Cash</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-secondaryText/50 group-hover:text-bloodRed transition-colors" />
                                </Button>
                                <Button
                                    onClick={onSelectSendTransfer}
                                    variant="outline"
                                    className="w-full justify-between items-center h-14 bg-background/50 border-borderColor hover:bg-surfaceHover hover:border-bloodRed/50 group transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-bloodRed/10 flex items-center justify-center group-hover:bg-bloodRed/20 transition-colors">
                                            <Share2 className="w-4 h-4 text-bloodRed" />
                                        </div>
                                        <div className="flex flex-col items-start px-1">
                                            <span className="font-bold text-white uppercase tracking-wide text-sm leading-none">Send Transfer</span>
                                            <span className="text-[9px] text-secondaryText uppercase font-bold tracking-widest mt-1">Venmo / E-Transfer</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-secondaryText/50 group-hover:text-bloodRed transition-colors" />
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Provide Info Sheet */}
            <AnimatePresence>
                {sheetMode === 'provide_info' && selectedDebt && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-[env(safe-area-inset-top,4rem)]"
                        onClick={() => setSheetMode(null)}
                    >
                        <motion.div
                            initial={{ y: '-100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '-100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full bg-surface border border-borderColor rounded-3xl max-w-md p-6 shadow-2xl mt-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-black text-white italic uppercase mb-2 text-center">How to get paid</h3>
                            <p className="text-sm text-secondaryText text-center mb-6">Provide your payment details for {selectedDebt.debtor?.fullName}.</p>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 p-1 bg-background rounded-xl">
                                    <button
                                        className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${paymentMethod === 'etransfer' ? 'bg-surface border-borderColor text-white shadow-md' : 'border-transparent text-secondaryText hover:text-white'}`}
                                        onClick={() => setPaymentMethod('etransfer')}
                                    >
                                        E-Transfer
                                    </button>
                                    <button
                                        className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${paymentMethod === 'venmo' ? 'bg-[#008CFF]/10 border-[#008CFF]/30 text-[#008CFF] shadow-md' : 'border-transparent text-secondaryText hover:text-white'}`}
                                        onClick={() => setPaymentMethod('venmo')}
                                    >
                                        Venmo
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-secondaryText ml-1">
                                        {paymentMethod === 'etransfer' ? 'Email Address' : 'Venmo Handle / Phone'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={paymentAddress}
                                            onChange={(e) => setPaymentAddress(e.target.value)}
                                            className="w-full bg-background border border-borderColor rounded-xl px-4 py-3 text-white font-bold placeholder-white/20 focus:outline-none focus:border-bloodRed transition-colors pr-24"
                                            placeholder={paymentMethod === 'etransfer' ? 'you@email.com' : '@your-handle'}
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={() => setPaymentAddress(profile?.email || '')}>
                                                Use Auth Email
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <Button className="w-full mt-4" onClick={onSubmitProvideInfo}>
                                    Send Details
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pay Sheet */}
            <AnimatePresence>
                {sheetMode === 'pay' && selectedDebt && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-[env(safe-area-inset-top,4rem)]"
                        onClick={() => setSheetMode(null)}
                    >
                        <motion.div
                            initial={{ y: '-100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '-100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="w-full bg-surface border border-borderColor rounded-3xl max-w-md p-6 shadow-2xl mt-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-xl font-black text-white italic uppercase mb-2 text-center">Settle Up</h3>
                            <p className="text-sm text-secondaryText text-center mb-6">Send money to {selectedDebt.creditor?.fullName}</p>

                            {(() => {
                                const payment = payments.find(p => p.debtId === selectedDebt.id && p.status === 'requested_info');
                                if (!payment) return null;
                                return (
                                    <div className="space-y-6">
                                        <div className="bg-background rounded-2xl p-4 border border-white/5 space-y-4">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-secondaryText font-bold uppercase tracking-wider text-xs">Method</span>
                                                <span className={`font-black uppercase tracking-widest text-[10px] px-2 py-0.5 rounded-full ${payment.method === 'venmo' ? 'bg-[#008CFF]/10 text-[#008CFF]' : 'bg-white/10 text-white'}`}>
                                                    {payment.method}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="min-w-0 pr-4">
                                                    <span className="text-secondaryText font-bold uppercase tracking-wider text-xs block mb-1">Send to</span>
                                                    <span className="text-white font-bold truncate block">{payment.paymentAddress}</span>
                                                </div>
                                                <Button size="icon" variant="outline" className="shrink-0 h-10 w-10 text-secondaryText hover:text-white" onClick={() => handleCopy(payment.paymentAddress || '')}>
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            {payment.method === 'venmo' && (
                                                <Button
                                                    className="w-full bg-[#008CFF] text-white hover:bg-[#0070CC] h-10 border-0"
                                                    onClick={() => window.open(`https://venmo.com/${payment.paymentAddress?.replace('@', '')}`, '_blank')}
                                                >
                                                    <Share2 className="w-4 h-4 mr-2" />
                                                    Open Venmo App
                                                </Button>
                                            )}
                                            {payment.method === 'etransfer' && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-10 text-white border-white/20 hover:bg-white/10"
                                                    onClick={() => handleCopy(`Amount: $${selectedDebt.remainingAmount.toFixed(2)}\nEmail: ${payment.paymentAddress}`)}
                                                >
                                                    <Copy className="w-4 h-4 mr-2" />
                                                    Copy Details for Bank
                                                </Button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-secondaryText ml-1">
                                                Amount Sent
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-white/50">$</span>
                                                <input
                                                    type="number"
                                                    value={amountSent}
                                                    onChange={(e) => setAmountSent(e.target.value)}
                                                    className="w-full bg-background border border-borderColor rounded-xl pl-8 pr-4 py-3 text-white font-black placeholder-white/20 focus:outline-none focus:border-bloodRed transition-colors"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </div>
                                            <p className="text-[10px] text-secondaryText ml-1">Total Owed: ${selectedDebt.remainingAmount.toFixed(2)}</p>
                                        </div>

                                        <Button className="w-full" onClick={onSubmitPayment}>
                                            Mark as Sent
                                        </Button>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
