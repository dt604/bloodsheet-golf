import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ShoppingBag, Loader, AlertCircle, HelpCircle } from 'lucide-react';
import { BloodCoin } from '../components/ui/BloodCoin';
import { VaultProtocolModal } from '../components/ui/VaultProtocolModal';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { getBloodCoinBalance, getStoreItems, redeemBloodCoins, StoreItem } from '../lib/walletApi';

function ShopItemImage({ src, alt, children }: { src: string; alt: string; children?: React.ReactNode }) {
    const [isLoaded, setIsLoaded] = useState(false);
    return (
        <div className="w-full h-full relative">
            {/* Image Layer */}
            <img
                src={src}
                alt={alt}
                onLoad={() => setIsLoaded(true)}
                className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
            />

            {/* Darkening Gradient - Synchronized with load */}
            <div className={`absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} />

            {/* Placeholder / Skeleton - Fades out as image fades in */}
            <div className={`absolute inset-0 bg-white/5 flex items-center justify-center transition-opacity duration-300 ${isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-pulse'}`}>
                <ShoppingBag className="w-8 h-8 text-white/10" />
            </div>

            {children}
        </div>
    );
}

export default function TheProShopPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [balance, setBalance] = useState<number>(0);
    const [items, setItems] = useState<StoreItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [redemptionSuccess, setRedemptionSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);

    useEffect(() => {
        if (!user?.id) return;

        async function loadShop() {
            try {
                const [bal, storeItems] = await Promise.all([
                    getBloodCoinBalance(user!.id),
                    getStoreItems()
                ]);
                setBalance(bal);
                setItems(storeItems);
            } catch (error) {
                console.error("Failed to load pro shop data", error);
            } finally {
                setIsLoading(false);
            }
        }

        loadShop();
    }, [user?.id]);

    const handleRedeem = async () => {
        if (!user?.id || !selectedItem) return;
        setIsRedeeming(true);
        setErrorMsg(null);

        try {
            const result = await redeemBloodCoins(user.id, selectedItem.id);
            if (result.success) {
                setBalance(result.new_balance || 0);
                setRedemptionSuccess(true);
                // After 2 seconds, refresh items (to update stock) and close modal
                setTimeout(async () => {
                    const freshItems = await getStoreItems();
                    setItems(freshItems);
                    setRedemptionSuccess(false);
                    setSelectedItem(null);
                    setIsRedeeming(false);
                }, 2000);
            } else {
                setErrorMsg(result.error || "Redemption failed. Please try again.");
                setIsRedeeming(false);
            }
        } catch (e: any) {
            setErrorMsg(e.message || "An unexpected error occurred.");
            setIsRedeeming(false);
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

    return (
        <div className="flex flex-col h-[100dvh] bg-background font-sans overflow-x-hidden safe-bottom relative">
            <SEO title="The Pro Shop" />

            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-bloodRed/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
            <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-[#00FF66]/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Header / Navigation */}
            <div className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 pt-safe">
                <div className="flex items-center justify-between px-4 h-16">
                    <button
                        onClick={() => navigate('/blood-bank')}
                        className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white transition-all active:scale-90 group"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    </button>

                    <div className="flex flex-col items-center">
                        <h1 className="text-white font-black italic tracking-wider text-base uppercase">The Pro Shop</h1>
                        <span className="text-[9px] text-secondaryText uppercase tracking-[0.2em] font-bold">Exclusive Drops</span>
                    </div>

                    <div className="flex items-center gap-3 group">
                        <div className="relative">
                            <BloodCoin animated={true} size="sm" className="drop-shadow-[0_0_10px_rgba(255,0,63,0.4)]" />
                            {/* Subtle Ambient Pulse */}
                            <div className="absolute inset-0 bg-bloodRed/20 rounded-full blur-md animate-pulse -z-10" />
                        </div>
                        <span className="text-white font-black text-sm tracking-widest italic leading-none">{balance.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-y-auto px-4 pb-24 relative z-10 pt-[calc(env(safe-area-inset-top)+80px)]">

                {/* Intro Section */}
                <div className="mb-8 mt-2 flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-white italic tracking-tight mb-2 uppercase">Your Vault</h2>
                        <p className="text-sm text-secondaryText font-medium leading-relaxed max-w-[280px]">
                            Redeem your hard-earned Blood Coins for premium gear, digital flex items, and exclusive experiences.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsVaultModalOpen(true)}
                        className="p-2 -mt-1 -mr-2 bg-white/5 hover:bg-white/10 rounded-full transition-all group"
                        title="What are Blood Coins?"
                    >
                        <HelpCircle className="w-5 h-5 text-secondaryText group-hover:text-bloodRed transition-colors" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader className="w-8 h-8 text-bloodRed animate-spin mb-4" />
                        <span className="text-secondaryText text-sm font-bold uppercase tracking-widest">Stocking Shelves...</span>
                    </div>
                ) : items.length > 0 ? (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                    >
                        {items.map(item => {
                            const canAfford = balance >= item.blood_coin_price;
                            const isOutOfStock = item.stock_count === 0;

                            return (
                                <motion.div
                                    key={item.id}
                                    variants={itemVariants}
                                    onClick={() => {
                                        if (!isOutOfStock) setSelectedItem(item);
                                    }}
                                    whileHover={!isOutOfStock ? { y: -5, transition: { duration: 0.2 } } : {}}
                                    className={`flex flex-col h-full relative rounded-3xl overflow-hidden border transition-all duration-300 backdrop-blur-md group ${canAfford && !isOutOfStock ? 'border-white/10 bg-surface/40 cursor-pointer hover:border-bloodRed/40 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(255,0,63,0.1)]' : 'border-white/5 bg-surface/20 grayscale-[40%] cursor-not-allowed'}`}
                                >
                                    {/* Item Image Area */}
                                    <div className="aspect-[4/3] w-full relative bg-surfaceHover overflow-hidden shrink-0">
                                        {item.image_url ? (
                                            <ShopItemImage src={item.image_url} alt={item.name}>
                                                {/* Category Badge - Inside the sync container */}
                                                <div className="absolute top-4 left-4 z-20">
                                                    <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[9px] font-black text-neonGreen uppercase tracking-[0.2em] italic">
                                                        {item.category}
                                                    </span>
                                                </div>

                                                {isOutOfStock && (
                                                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                                                        <span className="px-4 py-2 border-2 border-bloodRed text-bloodRed font-black uppercase text-xl italic tracking-tighter rotate-[-12deg] shadow-2xl">SOLDOUT</span>
                                                    </div>
                                                )}
                                            </ShopItemImage>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
                                                <ShoppingBag className="w-12 h-12 text-white/5" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Item Content Area */}
                                    <div className="p-5 flex flex-col flex-1">
                                        <div className="flex justify-between items-start gap-4 mb-3 text-left">
                                            <h3 className="text-white font-black italic uppercase tracking-tighter text-lg leading-tight flex-1">{item.name}</h3>
                                            <div className={`flex items-center gap-1.5 shrink-0 ${!canAfford ? 'text-secondaryText opacity-60' : 'text-white'}`}>
                                                <BloodCoin animated={false} size="xs" className={!canAfford ? 'grayscale opacity-50' : ''} />
                                                <span className="text-sm font-black italic">{item.blood_coin_price.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-secondaryText font-medium leading-relaxed mb-6 opacity-70 flex-1 text-left">
                                            {item.description}
                                        </p>

                                        <div className="mt-auto">
                                            {isOutOfStock ? (
                                                <button disabled className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-secondaryText text-[10px] font-black uppercase tracking-widest cursor-not-allowed">
                                                    Out of Stock
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedItem(item);
                                                    }}
                                                    className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${canAfford ? 'bg-bloodRed text-white hover:bg-red-600 shadow-[0_4px_15px_rgba(255,0,63,0.3)]' : 'bg-white/5 border border-white/10 text-secondaryText'}`}
                                                >
                                                    {canAfford ? 'Redeem Item' : 'Insufficient Coins'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <ShoppingBag className="w-12 h-12 text-white/10 mb-4" />
                        <h4 className="text-white font-black uppercase mb-1">Vault Empty</h4>
                        <p className="text-xs text-secondaryText uppercase tracking-widest">New items coming soon</p>
                    </div>
                )}
            </main>

            {/* Redemption Confirmation Modal */}
            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4"
                    >
                        <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={() => !isRedeeming && setSelectedItem(null)} />

                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="relative w-full max-w-sm bg-surface rounded-3xl border border-white/10 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
                        >
                            {redemptionSuccess ? (
                                <div className="p-8 text-center bg-gradient-to-b from-neonGreen/10 to-transparent">
                                    <div className="w-20 h-20 bg-neonGreen/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-neonGreen/30 shadow-[0_0_30px_rgba(0,255,102,0.3)]">
                                        <CheckCircle2 className="w-10 h-10 text-neonGreen" />
                                    </div>
                                    <h4 className="text-2xl font-black text-white italic uppercase mb-2 tracking-tight">Success</h4>
                                    <p className="text-secondaryText font-medium text-sm leading-relaxed mb-6">
                                        Your redemption is complete. Check your internal audit ledger for details.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setSelectedItem(null);
                                            setRedemptionSuccess(false);
                                        }}
                                        className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-black uppercase tracking-widest text-[10px]"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <div className="p-6">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 rounded-2xl bg-surfaceHover overflow-hidden shrink-0 border border-white/5">
                                            <ShopItemImage src={selectedItem.image_url || ''} alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white font-black italic uppercase text-base truncate">{selectedItem.name}</h4>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <BloodCoin animated={true} size="xs" />
                                                <span className="text-bloodRed font-black italic text-sm">{selectedItem.blood_coin_price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {errorMsg && (
                                        <div className="mb-4 p-3 rounded-xl bg-bloodRed/10 border border-bloodRed/20 flex items-center gap-3">
                                            <AlertCircle className="w-4 h-4 text-bloodRed shrink-0" />
                                            <p className="text-[11px] text-bloodRed font-bold leading-none">{errorMsg}</p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <button
                                            disabled={isRedeeming || (balance < selectedItem.blood_coin_price)}
                                            onClick={handleRedeem}
                                            className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all ${isRedeeming ? 'bg-white/5 opacity-50' : (balance >= selectedItem.blood_coin_price ? 'bg-bloodRed text-white hover:bg-red-600' : 'bg-white/5 text-secondaryText cursor-not-allowed')}`}
                                        >
                                            {isRedeeming ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                'Authorize Payout'
                                            )}
                                        </button>
                                        <button
                                            disabled={isRedeeming}
                                            onClick={() => setSelectedItem(null)}
                                            className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-[0.2em] text-xs transition-all"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <VaultProtocolModal
                isOpen={isVaultModalOpen}
                onClose={() => setIsVaultModalOpen(false)}
            />
        </div>
    );
}
