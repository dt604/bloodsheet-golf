import { useState } from 'react';
import { Card } from '../../components/ui/Card';
import {
    Search,
    Loader2,
    User,
    Coins,
    ArrowUpCircle,
    ArrowDownCircle,
    ShieldCheck,
    History,
    AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { BloodCoin } from '../../components/ui/BloodCoin';

interface UserProfile {
    id: string;
    full_name: string;
    avatar_url?: string;
    balance?: number;
}

export default function BloodCoinManagement() {
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search users
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        setLoading(true);
        setSelectedUser(null);
        setError(null);

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .ilike('full_name', `%${searchTerm.trim()}%`)
                .limit(10);

            if (error) throw error;

            // Fetch balances for these users
            const userIds = data.map(u => u.id);
            const { data: balances } = await supabase
                .from('user_blood_coin_balances')
                .select('*')
                .in('user_id', userIds);

            const combinedData = data.map(u => ({
                ...u,
                balance: balances?.find(b => b.user_id === u.id)?.balance || 0
            }));

            setUsers(combinedData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAdjust = async (type: 'grant' | 'deduct') => {
        if (!selectedUser || !amount || !reason) return;

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Please enter a valid positive amount.');
            return;
        }

        const finalAmount = type === 'grant' ? numericAmount : -numericAmount;

        setProcessing(true);
        setError(null);

        try {
            const { error: rpcError } = await supabase.rpc('admin_adjust_blood_coins', {
                target_user_id: selectedUser.id,
                adjustment_amount: finalAmount,
                adjustment_reason: reason
            });

            if (rpcError) throw rpcError;

            setSuccess(true);
            // Update local balance
            setUsers(prev => prev.map(u =>
                u.id === selectedUser.id
                    ? { ...u, balance: (u.balance || 0) + finalAmount }
                    : u
            ));
            setSelectedUser(prev => prev ? { ...prev, balance: (prev.balance || 0) + finalAmount } : null);

            // Success animation timeout
            setTimeout(() => {
                setSuccess(false);
                setAmount('');
                setReason('');
            }, 3000);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 momentum-scroll">

                {/* Header */}
                <header className="px-2">
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                        <Coins className="text-bloodRed w-6 h-6" />
                        Blood Coin Console
                    </h2>
                    <p className="text-xs text-secondaryText font-bold uppercase tracking-wider">
                        Administrative Balance Adjustments
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Search Section */}
                    <div className="space-y-4">
                        <Card className="p-4 bg-background/40 border-borderColor/50">
                            <form onSubmit={handleSearch} className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondaryText" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search player by name..."
                                    className="w-full bg-surface border border-borderColor rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-bloodRed transition-all"
                                />
                            </form>
                        </Card>

                        <div className="space-y-2">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-secondaryText">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Searching Vaults...</span>
                                </div>
                            ) : users.length > 0 ? (
                                users.map((user) => (
                                    <Card
                                        key={user.id}
                                        onClick={() => setSelectedUser(user)}
                                        className={`p-3 cursor-pointer transition-all border-borderColor/50 hover:border-bloodRed/50 ${selectedUser?.id === user.id ? 'border-bloodRed bg-bloodRed/5' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-surfaceHover flex items-center justify-center overflow-hidden border border-borderColor">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User className="w-5 h-5 text-secondaryText" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-sm">{user.full_name}</div>
                                                    <div className="text-[10px] text-secondaryText uppercase font-bold tracking-tight">
                                                        ID: {user.id.slice(0, 8)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-secondaryText uppercase font-black tracking-widest mb-0.5">Current</div>
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <span className="font-black text-white text-base italic">{user.balance?.toLocaleString()}</span>
                                                    <div className="w-3 h-3 bg-bloodRed rounded-full shadow-[0_0_8px_rgba(255,0,63,0.5)]" />
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            ) : searchTerm && !loading ? (
                                <div className="text-center py-12 text-secondaryText italic text-sm">
                                    No players found matching "{searchTerm}"
                                </div>
                            ) : (
                                <div className="text-center py-12 text-secondaryText border border-dashed border-borderColor/30 rounded-2xl">
                                    <p className="text-xs font-bold uppercase tracking-widest opacity-30">Search for a player to adjust their vault</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Adjustment Section */}
                    <div className="space-y-4">
                        <AnimatePresence mode="wait">
                            {selectedUser ? (
                                <motion.div
                                    key={selectedUser.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <Card className="p-6 relative overflow-hidden bg-surface/50 border-borderColor backdrop-blur-sm">
                                        <div className="absolute top-0 right-0 p-4 opacity-5">
                                            <BloodCoin size="lg" />
                                        </div>

                                        <div className="relative z-10 space-y-6">
                                            <div>
                                                <h3 className="text-xs font-black text-bloodRed uppercase tracking-[0.3em] mb-4">Adjustment Console</h3>
                                                <div className="flex items-center gap-4 p-3 bg-black/20 rounded-2xl border border-white/5">
                                                    <div className="w-12 h-12 rounded-full bg-surfaceHover flex items-center justify-center overflow-hidden border border-borderColor">
                                                        {selectedUser.avatar_url ? (
                                                            <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User className="w-6 h-6 text-secondaryText" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-lg text-white leading-tight">{selectedUser.full_name}</div>
                                                        <div className="text-[10px] text-secondaryText font-bold uppercase tracking-widest italic">Target Subject</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-[10px] text-secondaryText font-black uppercase tracking-widest mb-1.5 ml-1">Magnitude</label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            value={amount}
                                                            onChange={(e) => setAmount(e.target.value)}
                                                            placeholder="0"
                                                            className="w-full bg-background border border-borderColor rounded-xl px-4 py-4 text-2xl font-black text-white italic focus:outline-none focus:ring-1 focus:ring-bloodRed transition-all"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                            <span className="text-xs font-black text-secondaryText uppercase tracking-widest">Coins</span>
                                                            <div className="w-5 h-5 bg-bloodRed rounded-full shadow-[0_0_12px_rgba(255,0,63,0.6)]" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] text-secondaryText font-black uppercase tracking-widest mb-1.5 ml-1">Justification</label>
                                                    <textarea
                                                        value={reason}
                                                        onChange={(e) => setReason(e.target.value)}
                                                        placeholder="Reason for adjustment..."
                                                        className="w-full bg-background border border-borderColor rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-bloodRed transition-all h-24 resize-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => handleAdjust('deduct')}
                                                    disabled={processing || success}
                                                    className="group flex flex-col items-center justify-center p-4 bg-surface rounded-2xl border border-borderColor hover:bg-bloodRed hover:border-bloodRed transition-all disabled:opacity-50"
                                                >
                                                    <ArrowDownCircle className="w-6 h-6 mb-2 text-bloodRed group-hover:text-white transition-colors" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-secondaryText group-hover:text-white">Deduct Coins</span>
                                                </button>
                                                <button
                                                    onClick={() => handleAdjust('grant')}
                                                    disabled={processing || success}
                                                    className="group flex flex-col items-center justify-center p-4 bg-surface rounded-2xl border border-borderColor hover:bg-neonGreen hover:border-neonGreen transition-all disabled:opacity-50"
                                                >
                                                    <ArrowUpCircle className="w-6 h-6 mb-2 text-neonGreen group-hover:text-black transition-colors" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-secondaryText group-hover:text-black">Grant Coins</span>
                                                </button>
                                            </div>

                                            {error && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex items-center gap-2 p-3 bg-bloodRed/10 border border-bloodRed/30 rounded-xl text-bloodRed text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                                    {error}
                                                </motion.div>
                                            )}

                                            {success && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex items-center gap-2 p-3 bg-neonGreen/10 border border-neonGreen/30 rounded-xl text-neonGreen text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    <ShieldCheck className="w-4 h-4 shrink-0" />
                                                    Vault updated successfully
                                                </motion.div>
                                            )}
                                        </div>

                                        {processing && (
                                            <div className="absolute inset-0 z-20 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                                                <div className="flex flex-col items-center">
                                                    <Loader2 className="w-10 h-10 animate-spin text-bloodRed mb-3" />
                                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Transmitting...</span>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                </motion.div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-center p-8 border-2 border-dashed border-borderColor/30 rounded-[2.5rem] opacity-20">
                                    <div className="space-y-4">
                                        <History className="w-16 h-16 mx-auto" />
                                        <p className="font-black uppercase tracking-[0.3em] text-sm">Awaiting Target Selection</p>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
