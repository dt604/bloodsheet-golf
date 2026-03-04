import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Shield, History, Wallet as WalletIcon, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { BloodCoin } from '../components/ui/BloodCoin';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { getBloodCoinBalance, fetchRecentTransactions, WalletTransaction } from '../lib/walletApi';

export default function BloodBankPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [balance, setBalance] = useState<number>(0);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

        async function loadWallet() {
            try {
                const bal = await getBloodCoinBalance(user!.id);
                setBalance(bal);

                const txs = await fetchRecentTransactions(user!.id);
                setTransactions(txs);
            } catch (error) {
                console.error("Failed to load wallet data", error);
            } finally {
                setIsLoading(false);
            }
        }

        loadWallet();
    }, [user?.id]);

    return (
        <div className="flex flex-col h-[100dvh] bg-background font-sans overflow-x-hidden safe-bottom relative">
            <SEO title="Blood Bank | Virtual Currency" />

            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[400px] bg-bloodRed/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute -top-32 -right-32 w-[300px] h-[300px] bg-[#00FF66]/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <header className="flex flex-col sticky top-0 z-30 pt-safe bg-[#0B0B0C]/80 backdrop-blur-xl border-b border-white/[0.05]">
                <div className="flex items-center p-4">
                    <button onClick={() => navigate('/home')} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors relative z-10 w-10 h-10 flex items-center justify-center">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="absolute inset-x-0 flex justify-center pointer-events-none">
                        <h2 className="text-[10px] font-black text-white/50 tracking-[0.3em] uppercase mt-1">Player Wallet</h2>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-24 relative z-10 pt-8">
                {/* Balance Display */}
                <div className="flex flex-col items-center justify-center mb-12 relative">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
                        className="relative z-10 flex flex-col items-center"
                    >
                        {/* THE CENTERPIECE */}
                        <div className="relative mb-8">
                            <BloodCoin size="giant" className="drop-shadow-[0_0_50px_rgba(255,0,63,0.3)]" />
                            {/* Reflection on floor */}
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-48 h-6 bg-bloodRed/20 blur-2xl rounded-[100%] scale-x-150" />
                        </div>

                        <div className="flex flex-col items-center text-center">
                            <h3 className="text-secondaryText font-black uppercase tracking-[0.4em] text-[9px] mb-2 opacity-40">Personal Credit Balance</h3>
                            <h1 className="text-7xl md:text-8xl font-black text-white italic tracking-tighter drop-shadow-[0_0_35px_rgba(255,0,63,0.3)] leading-none">
                                {isLoading ? '...' : balance.toLocaleString()}
                            </h1>
                            <div className="mt-6 px-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-full flex items-center gap-2 backdrop-blur-md shadow-2xl">
                                <Shield className="w-3 h-3 text-neonGreen shadow-[0_0_10px_rgba(0,255,102,0.5)]" />
                                <span className="text-[8px] text-white/60 uppercase font-black tracking-[0.2em]">End-to-End Encrypted Vault</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                    <Button
                        className="h-14 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-md transition-all shadow-lg text-white"
                        onClick={() => alert("Send Coins logic coming soon!")}
                    >
                        <ArrowUpRight className="w-5 h-5 text-bloodRed mb-0.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Send</span>
                    </Button>
                    <Button
                        className="h-14 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-md transition-all shadow-lg text-white"
                        onClick={() => alert("Request Coins logic coming soon!")}
                    >
                        <ArrowDownLeft className="w-5 h-5 text-neonGreen mb-0.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Request</span>
                    </Button>
                </div>

                {/* Cash Balances Link */}
                <button
                    onClick={() => navigate('/balances')}
                    className="w-full mb-8 bg-surface/80 hover:bg-surface border border-borderColor hover:border-white/20 rounded-2xl p-4 flex items-center justify-between transition-all group backdrop-blur-xl shadow-xl"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-neonGreen/10 border border-neonGreen/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <WalletIcon className="w-5 h-5 text-neonGreen shadow-[0_0_15px_rgba(0,255,102,0.5)]" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-white font-bold text-lg leading-tight uppercase tracking-tight">Real Cash Debts</span>
                            <span className="text-[10px] text-secondaryText uppercase tracking-widest font-bold">Venmo, Zelle, E-Transfer</span>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-secondaryText group-hover:text-white transition-colors" />
                </button>

                {/* Ledger / History Placeholder */}
                <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-bloodRed" />
                            <h3 className="text-sm font-black text-white italic uppercase tracking-wider">Recent Transactions</h3>
                        </div>
                    </div>

                    {isLoading ? (
                        <Card className="border border-white/5 bg-surface/50 backdrop-blur-xl p-6 flex flex-col items-center justify-center text-center overflow-hidden relative min-h-[200px]">
                            <div className="w-12 h-12 mx-auto bg-surfaceHover border border-white/10 rounded-full flex items-center justify-center mb-2 animate-pulse">
                                <BloodCoin className="w-6 h-6 grayscale opacity-50" />
                            </div>
                            <h4 className="text-white font-black uppercase tracking-wide">Securely Loading</h4>
                            <p className="text-xs text-secondaryText">Connecting to the Vault...</p>
                        </Card>
                    ) : transactions.length > 0 ? (
                        <div className="space-y-3">
                            {transactions.map(tx => {
                                const isPositive = tx.amount > 0;
                                let txIcon = <BloodCoin className="w-5 h-5" />;
                                let txTitle = "Transaction";

                                switch (tx.type) {
                                    case 'grant':
                                        txTitle = "Initial Grant";
                                        break;
                                    case 'wager_win':
                                        txTitle = "Match Win";
                                        break;
                                    case 'wager_deduction':
                                        txTitle = "Match Deduction";
                                        break;
                                    case 'transfer_received':
                                        txTitle = "Received Transfer";
                                        break;
                                    case 'transfer_sent':
                                        txTitle = "Sent Transfer";
                                        break;
                                    case 'redemption':
                                        txTitle = "Redeemed Coins";
                                        break;
                                }

                                return (
                                    <div key={tx.id} className={`flex items-center justify-between p-4 rounded-xl border ${isPositive ? 'bg-surface/60 border-neonGreen/10' : 'bg-surface/60 border-bloodRed/10'} backdrop-blur-sm group`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? 'bg-neonGreen/10 shadow-[0_0_10px_rgba(0,255,102,0.2)]' : 'bg-bloodRed/10 shadow-[0_0_10px_rgba(255,0,63,0.2)]'}`}>
                                                {txIcon}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white text-sm block tracking-wide">{txTitle}</span>
                                                <span className="text-xs text-secondaryText">{new Date(tx.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className={`font-black tracking-widest text-lg ${isPositive ? 'text-neonGreen drop-shadow-[0_0_10px_rgba(0,255,102,0.3)]' : 'text-bloodRed'}`}>
                                                {isPositive ? '+' : ''}{tx.amount}
                                            </span>
                                            <span className="text-[10px] text-secondaryText uppercase tracking-widest">{tx.type.split('_').join(' ')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <Card className="border border-white/5 bg-surface/50 backdrop-blur-xl p-6 flex flex-col items-center justify-center text-center overflow-hidden relative min-h-[200px]">
                            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10 pointer-events-none" />
                            <div className="relative z-20 space-y-3">
                                <div className="w-12 h-12 mx-auto bg-surfaceHover border border-white/10 rounded-full flex items-center justify-center mb-2 animate-pulse">
                                    <BloodCoin className="w-6 h-6 grayscale opacity-50" />
                                </div>
                                <h4 className="text-white font-black uppercase tracking-wide">No Transactions Yet</h4>
                                <p className="text-xs text-secondaryText max-w-[200px] mx-auto leading-relaxed">
                                    Win matches or claim your initial grant to populate your ledger.
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
