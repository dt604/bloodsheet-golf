import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Search, Camera, Check, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '../components/ui/Button';

// Import avatars
import juniorAvatar from '../assets/avatars/junior.png';
import oldFemaleAvatar from '../assets/avatars/old_female.png';
import oldMaleAvatar from '../assets/avatars/old_male.png';
import youngFemaleAvatar from '../assets/avatars/young_female.png';
import youngMaleAvatar from '../assets/avatars/young_male.png';

const DEFAULT_AVATAR = '/logo-final.png';

const AVATARS = [
    { id: 'old_male', url: oldMaleAvatar, label: 'Old Male' },
    { id: 'old_female', url: oldFemaleAvatar, label: 'Old Female' },
    { id: 'young_male', url: youngMaleAvatar, label: 'Young Male' },
    { id: 'young_female', url: youngFemaleAvatar, label: 'Young Female' },
    { id: 'junior', url: juniorAvatar, label: 'Junior' },
];

export default function OnboardingPage() {
    const navigate = useNavigate();
    const { user, updateProfile } = useAuth();

    const [step, setStep] = useState<'search' | 'manual'>('manual');
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    // Manual Setup State
    const [handicap, setHandicap] = useState<string>('');
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [customAvatar, setCustomAvatar] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const inputClass =
        'block w-full px-4 py-3 border border-borderColor rounded-xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-1 focus:ring-bloodRed focus:border-bloodRed text-sm transition-all';

    // Auto-search by Google email on mount
    useEffect(() => {
        if (user?.email) {
            setSearch(user.email);
            runSearch(user.email);
        }
    }, [user?.email]);

    async function runSearch(term: string) {
        if (!term) return;
        setSearching(true);
        setResults([]);
        try {
            const { data } = await supabase.functions.invoke('grint-search', {
                body: { search: term }
            });
            if (data?.data) {
                setResults(data.data.map((u: any) => ({
                    grintId: `grint-${u.id}`,
                    fullName: u.name,
                    handicap: parseFloat(u.handicap) || 0,
                    avatarUrl: `https://profile.static.thegrint.com/thumb_${u.image}`,
                    username: u.username,
                })));
            }
        } catch (e) {
            console.error(e);
        }
        setSearching(false);
    }

    async function handleSelect(res: any) {
        setSaving(true);
        await updateProfile({
            handicap: res.handicap,
            avatarUrl: res.avatarUrl,
        });
        triggerCelebration();
        setSaving(false);
        navigate('/dashboard', { replace: true });
    }

    async function handleManualSubmit() {
        setSaving(true);
        const finalAvatar = customAvatar || (selectedAvatar ? AVATARS.find(a => a.id === selectedAvatar)?.url : DEFAULT_AVATAR);

        await updateProfile({
            handicap: parseFloat(handicap) || 0,
            avatarUrl: finalAvatar || undefined,
        });

        triggerCelebration();
        setSaving(false);
        navigate('/dashboard', { replace: true });
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];
        setUploadingImage(true);

        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}-${Math.random()}.${fileExt}`;

        try {
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            setCustomAvatar(data.publicUrl);
            setSelectedAvatar(null);
        } catch (error: any) {
            console.error('Error uploading avatar:', error.message);
            alert('Failed to upload image. Please try again.');
        } finally {
            setUploadingImage(false);
        }
    }

    function triggerCelebration() {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FF003F', '#00FF66', '#FFFFFF']
        });
    }

    return (
        <div className="flex-1 flex flex-col bg-background p-6 overflow-y-auto min-h-screen">
            <AnimatePresence mode="wait">
                {step === 'search' ? (
                    <motion.div
                        key="search-step"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-6 mt-8"
                    >
                        <div className="space-y-4 bg-surface/90 backdrop-blur-xl p-6 rounded-2xl border border-borderColor shadow-2xl text-left">
                            <div className="flex flex-col mb-2">
                                <span className="text-[10px] text-bloodRed font-bold tracking-[0.2em] mb-1">STEP 1</span>
                                <h3 className="text-white font-black tracking-tight text-2xl mb-1 uppercase italic">Find Your Handicap</h3>
                                <p className="text-secondaryText text-sm font-medium">Search The Grint to instantly link your verified index and profile picture.</p>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    className={`${inputClass} pl-11 shadow-inner placeholder:text-secondaryText/50`}
                                    placeholder="Name, Email, or Username"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && runSearch(search)}
                                />
                                <Search className="w-5 h-5 text-secondaryText absolute left-4 top-3.5" />
                            </div>

                            <div className="max-h-64 overflow-y-auto space-y-2 mt-4 custom-scrollbar pr-1">
                                {searching && (
                                    <div className="flex justify-center py-6">
                                        <Loader className="w-8 h-8 animate-spin text-bloodRed" />
                                    </div>
                                )}
                                {!searching && results.length === 0 && search && (
                                    <p className="text-secondaryText text-center py-4 font-semibold text-sm">No results found.</p>
                                )}
                                {!searching && results.map((res) => (
                                    <button
                                        key={res.grintId}
                                        onClick={() => handleSelect(res)}
                                        disabled={saving}
                                        className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-background hover:bg-surfaceHover border border-borderColor transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {res.avatarUrl && !res.avatarUrl.includes('profile_default') ? (
                                                <img src={res.avatarUrl} alt={res.fullName} className="w-10 h-10 rounded-full object-cover border border-borderColor shadow-lg" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-white font-bold">
                                                    {res.fullName.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-white font-bold text-sm tracking-wide group-hover:text-bloodRed transition-colors">
                                                    {res.fullName}
                                                </div>
                                                <div className="text-[10px] text-secondaryText font-mono uppercase tracking-widest mt-0.5">
                                                    {res.username}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-secondaryText uppercase tracking-widest font-bold mb-0.5">Index</div>
                                            <div className="text-base font-black text-neonGreen leading-none">{res.handicap}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-borderColor mt-4 flex items-center justify-between">
                                <button
                                    className="text-secondaryText text-xs font-bold hover:text-white transition-colors uppercase tracking-widest"
                                    onClick={() => setStep('manual')}
                                >
                                    Set up manually
                                </button>
                                <button
                                    className="text-white text-sm font-bold bg-surfaceHover px-6 py-2.5 rounded-xl border border-borderColor hover:bg-white hover:text-black transition-all shadow-lg active:scale-95"
                                    onClick={() => setStep('manual')}
                                    disabled={saving}
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="manual-step"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6 mt-8"
                    >
                        <div className="bg-surface/90 backdrop-blur-xl p-6 rounded-2xl border border-borderColor shadow-2xl space-y-8">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-bloodRed font-bold tracking-[0.2em] mb-1">STEP 2</span>
                                <h3 className="text-white font-black tracking-tight text-2xl mb-1 uppercase italic">Complete Your Profile</h3>
                                <p className="text-secondaryText text-sm font-medium">Tell us your game and pick your look.</p>
                            </div>

                            {/* Handicap Input */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondaryText">Handicap Index</label>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="0.0"
                                        className="block w-full px-6 py-5 border-2 border-borderColor rounded-2xl bg-background text-4xl font-black text-white focus:outline-none focus:ring-2 focus:ring-bloodRed focus:border-bloodRed transition-all text-center tracking-tighter shadow-inner"
                                        value={handicap}
                                        onChange={(e) => setHandicap(e.target.value)}
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-secondaryText/30 font-black text-xl italic select-none">INDEX</div>
                                </div>
                            </div>

                            {/* Avatar Selection */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondaryText">Choose Your Look</label>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    {/* Large Upload Button */}
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02, borderColor: '#FF003F' }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="relative aspect-square rounded-2xl border-2 border-dashed border-borderColor bg-surface/30 flex flex-col items-center justify-center gap-3 group transition-all"
                                    >
                                        {uploadingImage ? (
                                            <Loader className="w-8 h-8 animate-spin text-bloodRed" />
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-full bg-bloodRed/10 flex items-center justify-center group-hover:bg-bloodRed/20 transition-colors">
                                                    <Camera className="w-6 h-6 text-bloodRed" />
                                                </div>
                                                <div className="text-center">
                                                    <span className="block text-[10px] font-black uppercase tracking-widest text-white">Upload</span>
                                                    <span className="block text-[8px] font-bold uppercase tracking-widest text-secondaryText group-hover:text-bloodRed transition-colors">Photo</span>
                                                </div>
                                            </>
                                        )}
                                    </motion.button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                    />


                                    {AVATARS.map((avatar) => (
                                        <button
                                            key={avatar.id}
                                            onClick={() => {
                                                setSelectedAvatar(avatar.id);
                                                setCustomAvatar(null);
                                            }}
                                            className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group ${selectedAvatar === avatar.id ? 'border-bloodRed scale-105 shadow-[0_0_15px_rgba(255,0,63,0.4)]' : 'border-borderColor hover:border-bloodRed/50'
                                                }`}
                                        >
                                            <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                            {selectedAvatar === avatar.id && (
                                                <div className="absolute inset-0 bg-bloodRed/10 flex items-center justify-center">
                                                    <Check className="w-8 h-8 text-white drop-shadow-lg" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {customAvatar && (
                                    <div className="flex items-center gap-4 p-4 bg-background border border-bloodRed/30 rounded-2xl shadow-inner">
                                        <img src={customAvatar} className="w-16 h-16 rounded-full object-cover border-2 border-bloodRed shadow-lg" alt="Custom" />
                                        <div className="flex-1">
                                            <p className="text-white font-bold text-sm">Custom Photo Ready!</p>
                                            <p className="text-secondaryText text-[10px] uppercase font-bold tracking-wider">Tap below to finish</p>
                                        </div>
                                        <Check className="w-6 h-6 text-neonGreen" />
                                    </div>
                                )}
                            </div>

                            {/* Founder Intro */}
                            <div className="p-4 bg-bloodRed/5 border border-bloodRed/20 rounded-2xl flex gap-4 items-center">
                                <div className="w-12 h-12 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center shrink-0">
                                    <User className="w-6 h-6 text-secondaryText" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-xs font-black text-white">Danny Tran</span>
                                        <span className="px-1.5 py-0.5 rounded bg-bloodRed/20 text-[8px] font-black text-bloodRed uppercase tracking-widest">Founder</span>
                                    </div>
                                    <p className="text-[11px] text-secondaryText leading-tight">I've added myself as your first friend! Check your inbox for a welcome message once you're in.</p>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Button
                                    className="w-full py-6 text-lg tracking-wider"
                                    onClick={handleManualSubmit}
                                    disabled={saving || uploadingImage}
                                >
                                    {saving ? 'FINISHING...' : 'TEE IT UP'}
                                </Button>
                                <button
                                    className="w-full py-2 text-[10px] font-black text-secondaryText uppercase tracking-[0.2em] hover:text-white transition-colors"
                                    onClick={handleManualSubmit}
                                >
                                    Skip & Finish
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
