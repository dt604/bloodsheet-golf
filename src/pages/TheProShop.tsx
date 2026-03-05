import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ShoppingBag, Loader, AlertCircle, HelpCircle } from 'lucide-react';
import { BloodCoin } from '../components/ui/BloodCoin';
import { Card } from '../components/ui/Card';
import { VaultProtocolModal } from '../components/ui/VaultProtocolModal';
import SEO from '../components/SEO';
import { useAuth } from '../contexts/AuthContext';
import { getBloodCoinBalance, getStoreItems, redeemBloodCoins, StoreItem } from '../lib/walletApi';

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
                    setSelectedItem(null);
                    setRedemptionSuccess(false);
                    setIsRedeeming(false);
                }, 2500);
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
                        className="p-2 -ml-2 hover:bg-white/5 rounded-xl text-white transition-colors active:scale-95 group"
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
                                            <img
                                                src={item.image_url}
                                                alt={item.name}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
                                                <ShoppingBag className="w-12 h-12 text-white/5" />
                                            </div>
                                        )}

                                        {/* Overlays & Badges */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                                        {/* Category Badge */}
                                        <div className="absolute top-4 left-4">
                                            <span className="px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-[9px] font-black text-neonGreen uppercase tracking-[0.2em] italic">
                                                {item.category}
                                            </span>
                                        </div>

                                        {/* Price Overlay - High End Glass */}
                                        <div className="absolute bottom-4 right-4 text-right">
                                            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl backdrop-blur-xl border shadow-lg transition-all ${canAfford ? 'bg-white/10 border-white/20' : 'bg-bloodRed/20 border-bloodRed/40'}`}>
                                                <BloodCoin animated={false} size="xs" className={!canAfford ? 'grayscale opacity-50' : ''} />
                                                <span className={`font-black tracking-tight text-lg italic ${canAfford ? 'text-white' : 'text-bloodRed'}`}>
                                                    {item.blood_coin_price.toLocaleString()}
                                                </span>
                                            </div>
                                            {!canAfford && (
                                                <div className="mt-2 pr-1">
                                                    <span className="text-[8px] font-black text-bloodRed uppercase tracking-widest italic drop-shadow-sm">Insufficient Scrip</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Stock Status */}
                                        <div className="absolute top-4 right-4">
                                            {isOutOfStock ? (
                                                <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-secondaryText/50" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-secondaryText">Sold Out</span>
                                                </div>
                                            ) : item.stock_count > 0 && item.stock_count <= 5 ? (
                                                <div className="px-3 py-1 bg-bloodRed/20 backdrop-blur-md rounded-full border border-bloodRed/50 flex items-center gap-2 shadow-[0_0_15px_rgba(255,0,63,0.3)]">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-bloodRed animate-pulse shadow-[0_0_8px_rgba(255,0,63,1)]" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-bloodRed">Only {item.stock_count} Left</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>

                                    {/* Item Details - Balanced & Consistent */}
                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="font-black text-white text-xl leading-tight uppercase italic tracking-tight mb-3 group-hover:text-bloodRed transition-colors">
                                            {item.name}
                                        </h3>

                                        <p className="text-xs text-secondaryText leading-relaxed line-clamp-3 mb-6 flex-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                            {item.description}
                                        </p>

                                        {/* Interaction Hint */}
                                        <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                                            <span className="text-[9px] font-black text-secondaryText uppercase tracking-[0.3em] italic">Redeem Item</span>
                                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${canAfford && !isOutOfStock ? 'border-white/10 bg-white/5 group-hover:bg-bloodRed group-hover:border-bloodRed shadow-sm' : 'border-white/5 opacity-30'}`}>
                                                <ShoppingBag className={`w-3.5 h-3.5 ${canAfford && !isOutOfStock ? 'text-white' : 'text-secondaryText'}`} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Locked State Overlay */}
                                    {!canAfford && !isOutOfStock && (
                                        <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] pointer-events-none opacity-40" />
                                    )}
                                </motion.div>
                            );
                        })}
                    </motion.div>
                ) : (
                    <Card className="border border-white/5 bg-surface/50 backdrop-blur-xl p-8 flex flex-col items-center justify-center text-center">
                        <ShoppingBag className="w-12 h-12 text-white/20 mb-4" />
                        <h3 className="text-white font-black uppercase tracking-wide mb-2">Shop is Empty</h3>
                        <p className="text-xs text-secondaryText max-w-[250px]">The Pro Shop is currently restocking new premium gear check back soon.</p>
                    </Card>
                )}
            </main>

            {/* Redemption Modal/Drawer */}
            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !isRedeeming && !redemptionSuccess && setSelectedItem(null)}
                        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md bg-surface border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl relative"
                        >
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-bloodRed/50 to-transparent" />

                            {redemptionSuccess ? (
                                <div className="p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", bounce: 0.5 }}
                                        className="w-20 h-20 bg-neonGreen/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,102,0.3)] relative"
                                    >
                                        <CheckCircle2 className="w-10 h-10 text-neonGreen" />
                                        <motion.div
                                            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="absolute inset-0 rounded-full border border-neonGreen/50"
                                        />
                                    </motion.div>
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">Secured the Bag</h2>
                                    <p className="text-secondaryText text-sm mb-1">You've successfully redeemed</p>
                                    <p className="text-white font-bold text-lg mb-6">{selectedItem.name}</p>
                                    <p className="text-[10px] text-secondaryText uppercase tracking-widest font-bold">Check your email for details.</p>
                                </div>
                            ) : (
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <h2 className="text-xl font-black italic uppercase text-white tracking-tight">Confirm Order</h2>
                                        <button
                                            onClick={() => setSelectedItem(null)}
                                            className="p-2 bg-white/5 rounded-full text-secondaryText hover:text-white transition-colors"
                                            disabled={isRedeeming}
                                        >
                                            <AlertCircle className="w-5 h-5 rotate-45" />
                                        </button>
                                    </div>

                                    <div className="flex gap-4 mb-6 bg-background/50 p-3 rounded-xl border border-white/5">
                                        <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-surface">
                                            {selectedItem.image_url ? (
                                                <img src={selectedItem.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <ShoppingBag className="w-8 h-8 text-white/10" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col flex-1 justify-center">
                                            <span className="text-[10px] text-neonGreen font-bold uppercase tracking-widest mb-1">{selectedItem.category}</span>
                                            <h3 className="font-bold text-white leading-tight">{selectedItem.name}</h3>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-8">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-secondaryText font-medium">Current Balance</span>
                                            <div className="flex items-center gap-1.5">
                                                <BloodCoin animated={false} size="xs" />
                                                <span className="text-white font-bold">{balance.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-b border-white/10 pb-3">
                                            <span className="text-secondaryText font-medium">Item Cost</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-bloodRed font-bold">-</span>
                                                <BloodCoin animated={false} size="xs" />
                                                <span className="text-bloodRed font-bold">{selectedItem.blood_coin_price.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-lg mt-3">
                                            <span className="text-white font-black italic uppercase tracking-wider">Remaining</span>
                                            <div className="flex items-center gap-1.5">
                                                <BloodCoin animated={false} size="sm" />
                                                <span className="text-white font-black">{(balance - selectedItem.blood_coin_price).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {errorMsg && (
                                        <div className="mb-6 p-3 bg-bloodRed/10 border border-bloodRed/30 rounded-xl flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-bloodRed shrink-0 mt-0.5" />
                                            <p className="text-xs text-bloodRed font-medium leading-relaxed">{errorMsg}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleRedeem}
                                        disabled={isRedeeming}
                                        className="w-full relative py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] overflow-hidden group transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                                    >
                                        <div className="absolute inset-0 bg-bloodRed" />
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent mix-blend-overlay" />

                                        <div className="relative z-10 flex items-center justify-center gap-2 text-white">
                                            {isRedeeming ? (
                                                <>
                                                    <Loader className="w-5 h-5 animate-spin" />
                                                    <span>Processing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Swipe</span>
                                                    <BloodCoin animated={false} size="xs" className="grayscale contrast-200 invert" />
                                                    <span>{selectedItem.blood_coin_price.toLocaleString()}</span>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                    <p className="text-center mt-4 text-[10px] text-secondaryText uppercase tracking-widest font-bold">All redemptions are final.</p>
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
