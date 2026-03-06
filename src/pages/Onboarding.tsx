import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Camera, Check, User, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Button } from '../components/ui/Button';
import { useUIStore } from '../store/useUIStore';
import { startOnboardingTour, killTour } from '../lib/tour';
import { COUNTRIES } from '../constants/countries';
import { Globe, ChevronRight } from 'lucide-react';
import { BottomSheet } from '../components/ui/BottomSheet';

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
    const { user, profile, updateProfile } = useAuth();
    const { hasSeenOnboardingTour, setSeenOnboardingTour } = useUIStore();



    // Pre-populate from profile (e.g. Grint data saved during signup)
    const [handicapInit, setHandicapInit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [nickname, setNickname] = useState(profile?.nickname || '');

    // Manual Setup State
    const [handicap, setHandicap] = useState<string>(
        (profile?.handicap && profile.handicap > 0) ? profile.handicap.toString() : ''
    );
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(
        profile?.avatarUrl && !profile.avatarUrl.includes('logo-final') && !profile.avatarUrl.includes('profile_default') && !profile.avatarUrl.includes('thumb_undefined')
            ? 'custom' : null
    );
    const [customAvatar, setCustomAvatar] = useState<string | null>(
        profile?.avatarUrl && !profile.avatarUrl.includes('logo-final') && !profile.avatarUrl.includes('profile_default') && !profile.avatarUrl.includes('thumb_undefined')
            ? profile.avatarUrl : null
    );
    const [uploadingImage, setUploadingImage] = useState(false);
    const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(profile?.countryCode || null);
    const [countrySearch, setCountrySearch] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase())
    );

    const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);

    const fileInputRef = useRef<HTMLInputElement>(null);



    const resumeTour = (stepIdx: number) => {
        if (!hasSeenOnboardingTour) {
            startOnboardingTour(() => setSeenOnboardingTour(true), stepIdx);
        }
    };

    // If profile loads after initial render with Grint data, update local state
    useEffect(() => {
        if (profile && !handicapInit) {
            if (profile.handicap && profile.handicap > 0 && handicap === '') {
                setHandicap(profile.handicap.toString());
            }
            const av = profile.avatarUrl;
            if (av && !av.includes('logo-final') && !av.includes('profile_default') && !av.includes('thumb_undefined') && !customAvatar) {
                setCustomAvatar(av);
                setSelectedAvatar('custom');
            }
            setHandicapInit(true);
        }
    }, [profile]);

    // Use refs so evalTourStep always reads the latest values
    const nicknameRef = useRef(nickname);
    nicknameRef.current = nickname;
    const countryRef = useRef(selectedCountryCode);
    countryRef.current = selectedCountryCode;
    const handicapRef = useRef(handicap);
    handicapRef.current = handicap;
    const avatarRef = useRef(selectedAvatar);
    avatarRef.current = selectedAvatar;
    const customAvatarRef = useRef(customAvatar);
    customAvatarRef.current = customAvatar;

    const evalTourStep = () => {
        if (hasSeenOnboardingTour) return;

        // Nickname and Country are now optional. We only FORCE the tour back to 
        // the fields that are essential for the game logic (Handicap & Avatar).
        // Note: '0' is a valid handicap (Scratch), so we only force if it's strictly empty.
        if (nicknameRef.current === '' && handicapRef.current === '') {
            resumeTour(0);
        } else if (!countryRef.current && handicapRef.current === '') {
            resumeTour(1);
        } else if (handicapRef.current === '') {
            resumeTour(2);
        } else if (!avatarRef.current && !customAvatarRef.current) {
            resumeTour(3);
        } else {
            resumeTour(4);
        }
    };

    // Initial Tour Trigger
    useEffect(() => {
        if (!hasSeenOnboardingTour) {
            const timer = setTimeout(() => {
                // On first load, start at the very beginning (Optional fields included)
                // but evalTourStep (called on blur) will only enforce the mandatory ones.
                if (nicknameRef.current === '') {
                    resumeTour(0);
                } else if (!countryRef.current) {
                    resumeTour(1);
                } else {
                    evalTourStep();
                }
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [hasSeenOnboardingTour]);

    // Grint search is handled on the Welcome page before navigating here.
    // The profile already has handicap + avatar data from signUp().



    async function handleManualSubmit() {
        setSaving(true);
        let finalAvatar = DEFAULT_AVATAR;

        if (selectedAvatar === 'custom' && customAvatar) {
            finalAvatar = customAvatar;
        } else if (selectedAvatar) {
            finalAvatar = AVATARS.find(a => a.id === selectedAvatar)?.url || DEFAULT_AVATAR;
        }

        await updateProfile({
            nickname: nickname || undefined,
            handicap: parseFloat(handicap) || 0,
            avatarUrl: finalAvatar || undefined,
            countryCode: selectedCountryCode || undefined,
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
        <div className="flex-1 flex flex-col bg-background p-6 overflow-y-auto min-h-[100dvh] pb-24">
            <AnimatePresence mode="wait">
                {
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
                                <p className="text-secondaryText text-sm font-medium">Tell us your name and pick your look.</p>
                            </div>

                            {/* Nickname Input */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondaryText">Your Nickname</label>
                                </div>
                                <div className="relative">
                                    <input
                                        id="nickname-input"
                                        type="text"
                                        placeholder="The Shark"
                                        className="block w-full px-4 py-4 border-2 border-borderColor rounded-2xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:border-bloodRed/50 focus:shadow-[0_0_15px_rgba(255,0,63,0.1)] text-sm font-bold transition-all"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        onFocus={killTour}
                                        onBlur={evalTourStep}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-secondaryText/30 flex items-center">
                                        <User className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>

                            {/* Country Selection */}
                            <div id="country-select" className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondaryText">Representation</label>
                                </div>
                                <button
                                    onClick={() => {
                                        killTour();
                                        setShowCountryPicker(true);
                                    }}
                                    className="w-full h-14 bg-surface rounded-2xl border-2 border-borderColor flex items-center justify-between px-4 hover:border-bloodRed/30 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        {selectedCountry ? (
                                            <>
                                                <span className="text-2xl">{selectedCountry.flag}</span>
                                                <span className="text-sm font-bold text-white italic uppercase tracking-tight">{selectedCountry.name}</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-8 h-8 rounded-full bg-bloodRed/10 flex items-center justify-center">
                                                    <Globe className="w-4 h-4 text-bloodRed" />
                                                </div>
                                                <span className="text-sm font-bold text-secondaryText italic uppercase tracking-tight">Select Country</span>
                                            </>
                                        )}
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-secondaryText group-hover:text-bloodRed transition-colors" />
                                </button>
                            </div>

                            {/* Handicap Input */}
                            <div id="handicap-input" className="space-y-3">
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
                                        onFocus={killTour}
                                        onBlur={evalTourStep}
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end pointer-events-none">
                                        <div className="text-secondaryText/30 font-black text-xl italic select-none">INDEX</div>
                                        {(handicap === '0' || handicap === '0.0') && (
                                            <span className="text-[10px] font-black text-neonGreen tracking-[0.2em] italic">SCRATCH</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Avatar Selection */}
                            <div id="avatar-picker" className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-secondaryText">Choose Your Look</label>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    {/* Grint / Uploaded Avatar Option */}
                                    {customAvatar && (
                                        <button
                                            onClick={() => {
                                                setSelectedAvatar('custom');
                                                killTour();
                                                setTimeout(evalTourStep, 300);
                                            }}
                                            className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group ${selectedAvatar === 'custom' ? 'border-bloodRed scale-105 shadow-[0_0_15px_rgba(255,0,63,0.4)]' : 'border-borderColor hover:border-bloodRed/50'}`}
                                        >
                                            <img src={customAvatar} alt="Custom" className="w-full h-full object-cover" />
                                            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-[6px] font-black text-white uppercase tracking-widest border border-white/10">Photo</div>
                                            {selectedAvatar === 'custom' && (
                                                <div className="absolute inset-0 bg-bloodRed/10 flex items-center justify-center">
                                                    <Check className="w-8 h-8 text-white drop-shadow-lg" />
                                                </div>
                                            )}
                                        </button>
                                    )}

                                    {/* Large Upload Button */}
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.02, borderColor: '#FF003F' }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            killTour();
                                            fileInputRef.current?.click();
                                        }}
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
                                                killTour();
                                                setTimeout(evalTourStep, 300);
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
                            </div>

                            {/* Founder Intro */}
                            <div id="founder-callout" className="p-4 bg-bloodRed/5 border border-bloodRed/20 rounded-2xl flex gap-4 items-center">
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
                                    id="tee-it-up-btn"
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

                            {/* Country Picker Modal */}
                            <BottomSheet
                                open={showCountryPicker}
                                onClose={() => {
                                    setShowCountryPicker(false);
                                    setTimeout(evalTourStep, 300); // 300ms delay to wait for bottom sheet closing animation
                                }}
                                title="Represent Your Nation"
                                className="z-[10001]"
                            >
                                <div className="p-4">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-secondaryText absolute left-3 top-3.5" />
                                        <input
                                            type="text"
                                            placeholder="Search your country..."
                                            className="w-full bg-background border border-borderColor rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-bloodRed/50 placeholder:text-secondaryText/40"
                                            value={countrySearch}
                                            onChange={e => setCountrySearch(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-2 pb-6 custom-scrollbar">
                                    <div className="space-y-1">
                                        {filteredCountries.map(country => (
                                            <button
                                                key={country.code}
                                                onClick={() => {
                                                    setSelectedCountryCode(country.code);
                                                    countryRef.current = country.code; // update ref immediately
                                                    setShowCountryPicker(false);
                                                    setTimeout(evalTourStep, 400);
                                                }}
                                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedCountryCode === country.code ? 'bg-bloodRed/10 border border-bloodRed/30' : 'hover:bg-white/5 border border-transparent hover:border-borderColor'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className="text-2xl">{country.flag}</span>
                                                    <span className={`text-sm font-bold uppercase italic tracking-tight ${selectedCountryCode === country.code ? 'text-bloodRed' : 'text-white'
                                                        }`}>
                                                        {country.name}
                                                    </span>
                                                </div>
                                                {selectedCountryCode === country.code && <Check className="w-5 h-5 text-bloodRed" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </BottomSheet>
                        </div>
                    </motion.div>
                }
            </AnimatePresence>
        </div>
    );
}
