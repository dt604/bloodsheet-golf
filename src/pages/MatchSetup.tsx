import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MapPin, Settings2, Plus, X, Search, Loader, Swords, ArrowRight, ArrowLeft } from 'lucide-react';
import { StepTracker } from '../components/ui/StepTracker';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';
import { searchCourses, searchNearbyCourses } from '../lib/courseApi';
import { Course } from '../types';

export default function MatchSetupPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const createMatch = useMatchStore((s) => s.createMatch);
    const createMatchGroup = useMatchStore((s) => s.createMatchGroup);
    const createSkinsMatch = useMatchStore((s) => s.createSkinsMatch);
    const stagedPlayers = useMatchStore((s) => s.stagedPlayers);
    const removeStagedPlayer = useMatchStore((s) => s.removeStagedPlayer);
    const updateStagedPlayerHandicap = useMatchStore((s) => s.updateStagedPlayerHandicap);
    const poolPlayers = useMatchStore((s) => s.poolPlayers);
    const removePoolPlayer = useMatchStore((s) => s.removePoolPlayer);
    const updatePoolPlayerHandicap = useMatchStore((s) => s.updatePoolPlayerHandicap);
    const matchSlots = useMatchStore((s) => s.matchSlots);
    const addMatchSlot = useMatchStore((s) => s.addMatchSlot);
    const removeMatchSlot = useMatchStore((s) => s.removeMatchSlot);
    const setSlotPlayer1 = useMatchStore((s) => s.setSlotPlayer1);
    const setSlotOpponent = useMatchStore((s) => s.setSlotOpponent);
    const setSlotWager = useMatchStore((s) => s.setSlotWager);
    const updateStagedPlayerTeam = useMatchStore((s) => s.updateStagedPlayerTeam);
    const format = useMatchStore((s) => s.pendingFormat);
    const setFormat = useMatchStore((s) => s.setPendingFormat);
    const currentStep = useMatchStore((s) => s.currentStep);
    const setCurrentStep = useMatchStore((s) => s.setCurrentStep);
    const teamSkins = useMatchStore((s) => s.pendingTeamSkins);
    const setPendingTeamSkins = useMatchStore((s) => s.setPendingTeamSkins);

    const [wager, setWager] = useState(10);
    const [creatorHcp, setCreatorHcp] = useState<number>(0);
    useEffect(() => {
        if (profile?.handicap !== undefined) setCreatorHcp(profile.handicap);
    }, [profile?.handicap]);

    // Course search
    const [courseQuery, setCourseQuery] = useState('');
    const [courseResults, setCourseResults] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [courseSearching, setCourseSearching] = useState(false);
    const [courseError, setCourseError] = useState('');

    // Side bets / trash (shared across all matches in a group)
    const [greenies, setGreenies] = useState(true);
    const [sandies, setSandies] = useState(true);
    const [snake, setSnake] = useState(true);
    const [autoPress, setAutoPress] = useState(false);
    const [birdiesDouble, setBirdiesDouble] = useState(false);
    const [trashValue, setTrashValue] = useState(5);
    const [trashOpen, setTrashOpen] = useState(false);
    const [startingHole, setStartingHole] = useState(1);
    const [par3Contest, setPar3Contest] = useState(false);
    const [par3Pot, setPar3Pot] = useState(5);
    const [par5Contest, setPar5Contest] = useState(false);
    const [par5Pot, setPar5Pot] = useState(5);
    const [bonusSkins, setBonusSkins] = useState(false);
    const [potMode, setPotMode] = useState(false);

    // When toggling team skins mode, clear the conflicting player list
    function handleTeamSkinsToggle(enabled: boolean) {
        if (enabled) {
            [...poolPlayers].forEach(p => removePoolPlayer(p.userId));
        } else {
            [...stagedPlayers].forEach(p => removeStagedPlayer(p.userId));
        }
        setPendingTeamSkins(enabled);
    }

    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const steps = format === 'skins'
        ? [{ id: 1, label: 'Format' }, { id: 2, label: 'Players' }, { id: 4, label: 'Course', display: 3 }]
        : [{ id: 1, label: 'Format' }, { id: 2, label: 'Players' }, { id: 3, label: 'Matches' }, { id: 4, label: 'Course' }];

    const canAdvance = () => {
        if (currentStep === 1) return true;
        if (currentStep === 2) {
            if (format === 'skins') {
                if (teamSkins) {
                    // Team skins: need at least 1 player on Team A (besides creator) and 1 on Team B
                    return stagedPlayers.filter(p => p.team === 'B').length >= 1;
                }
                return poolPlayers.length >= 1; // Need at least 1 other player
            }
            if (format === '1v1') return true;
            return stagedPlayers.filter(p => p.team === 'A').length >= 1;
        }
        if (currentStep === 3) {
            if (format === '1v1') return matchSlots.some(s => s.opponentId !== null);
            return stagedPlayers.filter(p => p.team === 'B').length >= 1;
        }
        if (currentStep === 4) return selectedCourse !== null;
        return false;
    };

    const nextStep = () => {
        if (currentStep === 2 && format === 'skins') { setCurrentStep(4); return; } // skip Matches step
        if (currentStep < 4) setCurrentStep(currentStep + 1);
        else handleStartMatch();
    };

    const prevStep = () => {
        if (currentStep === 4 && format === 'skins') { setCurrentStep(2); return; } // skip back over Matches
        if (currentStep > 1) setCurrentStep(currentStep - 1);
        else navigate(-1);
    };

    // Auto-search with 400ms debounce
    useEffect(() => {
        if (courseQuery.trim().length < 2) { setCourseResults([]); setCourseError(''); return; }
        const timer = setTimeout(() => { handleCourseSearch(); }, 400);
        return () => clearTimeout(timer);
    }, [courseQuery]);

    async function handleCourseSearch() {
        if (!courseQuery.trim()) return;
        setCourseSearching(true);
        setCourseError('');
        try {
            const results = await searchCourses(courseQuery.trim());
            setCourseResults(results);
            if (results.length === 0) setCourseError('No courses found. Try a different name.');
        } catch {
            setCourseError('Course search failed. Check your connection.');
        } finally {
            setCourseSearching(false);
        }
    }

    async function handleNearbySearch() {
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            setCourseError('GPS requires a secure (HTTPS) connection on mobile. Try searching by city name instead.');
            return;
        }
        if (!navigator.geolocation) { setCourseError('Geolocation is not supported by your browser.'); return; }
        setCourseSearching(true);
        setCourseError('Getting your location...');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                setCourseError('Finding nearby courses...');
                try {
                    const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`);
                    const revData = await revRes.json();
                    const cityName = revData.address?.city || revData.address?.town || revData.address?.county || '';
                    if (cityName) {
                        setCourseQuery(cityName);
                        const results = await searchCourses(cityName);
                        setCourseResults(results);
                        if (results.length === 0) setCourseError(`No courses found near ${cityName}.`);
                    } else {
                        const results = await searchNearbyCourses(position.coords.latitude, position.coords.longitude);
                        setCourseResults(results);
                    }
                } catch {
                    try {
                        const results = await searchNearbyCourses(position.coords.latitude, position.coords.longitude);
                        setCourseResults(results);
                    } catch {
                        setCourseError('Could not identify courses near you. Please search by name.');
                    }
                } finally {
                    setCourseSearching(false);
                }
            },
            (err) => {
                setCourseSearching(false);
                if (err.code === 1) setCourseError('Location access was denied. Check your browser settings.');
                else if (err.code === 3) setCourseError('Location request timed out. Try again or search by name.');
                else setCourseError('Failed to get your location.');
            },
            { timeout: 15000, enableHighAccuracy: true }
        );
    }

    async function handleStartMatch() {
        if (!user) return;
        if (!selectedCourse) { setError('Please select a course first.'); return; }

        const sideBets = { greenies, sandies, snake, autoPress, birdiesDouble, trashValue, startingHole, par3Contest, par3Pot, par5Contest, par5Pot, bonusSkins, teamSkins, potMode };

        setCreating(true);
        setError('');
        try {
            if (format === 'skins') {
                if (teamSkins) {
                    if (stagedPlayers.filter(p => p.team === 'B').length < 1) { setError('Add at least one player to Team B.'); setCreating(false); return; }
                } else {
                    if (poolPlayers.length < 1) { setError('Add at least one other player.'); setCreating(false); return; }
                }
                await createSkinsMatch(
                    { courseId: selectedCourse.id, wagerAmount: wager, status: 'in_progress', sideBets, createdBy: user.id },
                    selectedCourse,
                    user.id,
                    creatorHcp
                );
            } else if (format === '1v1') {
                const validSlots = matchSlots.filter((s) => s.opponentId !== null && (s.player1Id ?? user.id) !== s.opponentId);
                if (validSlots.length === 0) { setError('Select at least one opponent.'); setCreating(false); return; }
                await createMatchGroup(
                    { courseId: selectedCourse.id, wagerType: 'NASSAU', status: 'in_progress', sideBets, createdBy: user.id },
                    selectedCourse,
                    user.id,
                    creatorHcp
                );
            } else {
                await createMatch(
                    { courseId: selectedCourse.id, format, wagerAmount: wager, wagerType: 'NASSAU', status: 'in_progress', sideBets, createdBy: user.id },
                    selectedCourse,
                    user.id,
                    creatorHcp
                );
            }
            navigate(`/play/${startingHole}`);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to start match');
        } finally {
            setCreating(false);
        }
    }

    const initials = profile?.fullName
        ? profile.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';



    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            {/* Header */}
            <header className="flex flex-col border-b border-borderColor shrink-0 bg-background/95 backdrop-blur-sm z-30">
                <div className="flex items-center justify-between p-4">
                    <button onClick={prevStep} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="text-center">
                        <span className="font-bold text-lg tracking-wide uppercase">
                            {steps.find(s => s.id === currentStep)?.label ?? 'Setup Match'}
                        </span>
                        <span className="block text-[10px] text-bloodRed font-black tracking-[0.2em] uppercase -mt-1">BLOODSHEET GOLF</span>
                    </div>
                    <div className="w-10" />
                </div>

                {/* Progress Tracker */}
                <div className="px-4 pb-2">
                    <StepTracker
                        steps={steps}
                        currentStep={currentStep}
                        onStepClick={(id) => id < currentStep && setCurrentStep(id)}
                    />
                </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6">
                <AnimatePresence mode="wait">
                    {/* STEP 1: FORMAT */}
                    {currentStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="text-sm font-black text-white uppercase tracking-wider mb-4">Choose Match Format</div>
                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${format === '1v1' ? 'border-bloodRed bg-bloodRed/5 shadow-[0_0_30px_rgba(255,0,63,0.1)]' : 'border-borderColor bg-surface hover:border-secondaryText'}`}
                                    onClick={() => { setFormat('1v1'); nextStep(); }}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${format === '1v1' ? 'bg-bloodRed text-white' : 'bg-surfaceHover text-secondaryText'}`}>
                                            <Swords className="w-6 h-6" />
                                        </div>
                                        {format === '1v1' && (
                                            <div className="w-6 h-6 rounded-full bg-bloodRed flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight mb-1">1v1 Matches</h3>
                                    <p className="text-sm text-secondaryText font-medium">Create one or multiple individual matches. Standard Nassau scoring.</p>

                                    {format === '1v1' && (
                                        <div className="absolute right-0 bottom-0 p-4 opacity-20">
                                            <Swords className="w-16 h-16" />
                                        </div>
                                    )}
                                </button>

                                <button
                                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${format === '2v2' ? 'border-bloodRed bg-bloodRed/5 shadow-[0_0_30px_rgba(255,0,63,0.1)]' : 'border-borderColor bg-surface hover:border-secondaryText'}`}
                                    onClick={() => { setFormat('2v2'); nextStep(); }}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${format === '2v2' ? 'bg-bloodRed text-white' : 'bg-surfaceHover text-secondaryText'}`}>
                                            <div className="flex -space-x-2">
                                                <Swords className="w-5 h-5" />
                                                <Swords className="w-5 h-5" />
                                            </div>
                                        </div>
                                        {format === '2v2' && (
                                            <div className="w-6 h-6 rounded-full bg-bloodRed flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight mb-1">2v2 Team Match</h3>
                                    <p className="text-sm text-secondaryText font-medium">Four players, two teams. High-Low or Aggregate scoring options.</p>

                                    {format === '2v2' && (
                                        <div className="absolute right-0 bottom-0 p-4 opacity-20">
                                            <Swords className="w-16 h-16 rotate-45" />
                                        </div>
                                    )}
                                </button>

                                <button
                                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${format === 'skins' ? 'border-bloodRed bg-bloodRed/5 shadow-[0_0_30px_rgba(255,0,63,0.1)]' : 'border-borderColor bg-surface hover:border-secondaryText'}`}
                                    onClick={() => { setFormat('skins'); nextStep(); }}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${format === 'skins' ? 'bg-bloodRed text-white' : 'bg-surfaceHover text-secondaryText'}`}>
                                            <span className="text-base font-black leading-none">💀</span>
                                        </div>
                                        {format === 'skins' && (
                                            <div className="w-6 h-6 rounded-full bg-bloodRed flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight mb-1">Skins Game</h3>
                                    <p className="text-sm text-secondaryText font-medium">2–4 individual players. Each hole is a skin. Ties carry over.</p>

                                    {format === 'skins' && (
                                        <div className="absolute right-0 bottom-0 p-4 opacity-20">
                                            <Swords className="w-16 h-16 -rotate-12" />
                                        </div>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: PLAYERS */}
                    {currentStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-black text-white uppercase tracking-wider italic">Who's playing today?</div>
                                <span className="text-[10px] font-bold text-secondaryText uppercase tracking-widest bg-surface px-2 py-0.5 rounded-full border border-borderColor">
                                    {(format === '2v2' || (format === 'skins' && teamSkins)) ? stagedPlayers.length + 1 : poolPlayers.length + 1} Total
                                </span>
                            </div>

                            {/* Team Skins toggle — shown at top of player step for skins format */}
                            {format === 'skins' && (
                                <div className="flex items-center justify-between p-4 rounded-xl border border-borderColor/50 bg-surface/50">
                                    <div>
                                        <span className="font-black text-xs uppercase tracking-tight block text-white">Team Skins</span>
                                        <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Team A vs Team B · Best ball</span>
                                    </div>
                                    <Toggle checked={teamSkins} onCheckedChange={handleTeamSkinsToggle} />
                                </div>
                            )}

                            <div className="space-y-3">


                                {(format === '1v1' || format === 'skins') && !teamSkins ? (
                                    <>
                                        <Card className="p-4 border-neonGreen/30 bg-neonGreen/5 mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-neonGreen/20 flex items-center justify-center text-neonGreen font-bold overflow-hidden shrink-0">
                                                    {profile?.avatarUrl ? (
                                                        <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : initials}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="font-bold text-sm tracking-tight block">{profile?.fullName || 'Me'}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-secondaryText font-medium">HCP:</span>
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={creatorHcp}
                                                            onChange={(e) => setCreatorHcp(parseFloat(e.target.value) || 0)}
                                                            className="w-12 bg-transparent text-xs font-bold text-white focus:outline-none focus:text-neonGreen border-b border-borderColor/30"
                                                            onFocus={(e) => e.target.select()}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                        {poolPlayers.map((p) => (
                                            <Card key={p.userId} className="p-4 border-borderColor/50 bg-surface/50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-secondaryText font-bold overflow-hidden shrink-0">
                                                            {p.avatarUrl && !p.avatarUrl.includes('profile_default.jpg') ? (
                                                                <img src={p.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                            ) : (
                                                                p.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-sm tracking-tight block">{p.fullName}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-secondaryText font-medium">HCP:</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={p.handicap}
                                                                    onChange={(e) => updatePoolPlayerHandicap(p.userId, parseFloat(e.target.value) || 0)}
                                                                    className="w-12 bg-transparent text-xs font-bold text-white focus:outline-none focus:text-neonGreen border-b border-borderColor/30"
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removePoolPlayer(p.userId)} className="p-2 text-secondaryText hover:text-bloodRed transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </Card>
                                        ))}

                                        {(format !== 'skins' || poolPlayers.length < 3) && (
                                            <button
                                                onClick={() => navigate('/add-player?pool=1')}
                                                className="w-full p-4 rounded-xl border-2 border-dashed border-borderColor hover:border-neonGreen/50 transition-all flex items-center justify-center gap-2 group bg-surface/30"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-secondaryText group-hover:text-neonGreen transition-colors">
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-secondaryText italic uppercase tracking-tight group-hover:text-white transition-colors">
                                                    {format === 'skins' ? 'Add player' : 'Add someone else'}
                                                </span>
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        {/* Team A Bucket */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-neonGreen uppercase tracking-[0.2em]">Team A (Green)</span>
                                                <span className="text-[10px] font-bold text-secondaryText uppercase tracking-widest">{stagedPlayers.filter(p => p.team === 'A').length + 1}/2</span>
                                            </div>
                                            <div className="space-y-3">
                                                <Card className="p-4 border-neonGreen/30 bg-neonGreen/5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-neonGreen/20 flex items-center justify-center text-neonGreen font-bold overflow-hidden shrink-0">
                                                            {profile?.avatarUrl ? (
                                                                <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                            ) : initials}
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="font-bold text-sm tracking-tight block">{profile?.fullName || 'Me'}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-secondaryText font-medium">HCP:</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={creatorHcp}
                                                                    onChange={(e) => setCreatorHcp(parseFloat(e.target.value) || 0)}
                                                                    className="w-12 bg-transparent text-xs font-bold text-white focus:outline-none focus:text-neonGreen border-b border-borderColor/30"
                                                                    onFocus={(e) => e.target.select()}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Card>

                                                {stagedPlayers.filter(p => p.team === 'A').map((p) => (
                                                    <Card key={p.userId} className="p-4 border-l-4 border-l-neonGreen bg-neonGreen/5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-neonGreen/20 flex items-center justify-center text-neonGreen font-bold">
                                                                    {p.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-sm tracking-tight block">{p.fullName}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-secondaryText">HCP:</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            value={p.handicap}
                                                                            onChange={(e) => updateStagedPlayerHandicap(p.userId, parseFloat(e.target.value) || 0)}
                                                                            className="w-12 bg-transparent text-xs font-bold text-white focus:outline-none border-b border-borderColor/30"
                                                                            onFocus={(e) => e.target.select()}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => updateStagedPlayerTeam(p.userId, 'B')}
                                                                    className="p-2 text-secondaryText hover:text-bloodRed transition-colors"
                                                                    title="Move to Team B"
                                                                >
                                                                    <ArrowRight className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => removeStagedPlayer(p.userId)} className="p-2 text-secondaryText hover:text-bloodRed transition-colors">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                                {stagedPlayers.filter(p => p.team === 'A').length < 1 && (
                                                    <button
                                                        onClick={() => navigate('/add-player?team=A')}
                                                        className="w-full h-14 rounded-xl border-2 border-dashed border-borderColor hover:border-neonGreen/50 transition-all flex items-center justify-center gap-2 group bg-surface/30"
                                                    >
                                                        <Plus className="w-4 h-4 text-secondaryText group-hover:text-neonGreen" />
                                                        <span className="text-xs font-black text-secondaryText uppercase tracking-widest group-hover:text-white">Teammate</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* VS Divider */}
                                        <div className="flex items-center gap-4 px-2">
                                            <div className="h-[1px] flex-1 bg-borderColor/30" />
                                            <span className="text-[10px] font-black text-bloodRed italic tracking-[0.2em]">VERSUS</span>
                                            <div className="h-[1px] flex-1 bg-borderColor/30" />
                                        </div>

                                        {/* Team B Bucket */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center px-1">
                                                <span className="text-[10px] font-black text-bloodRed uppercase tracking-[0.2em]">Team B (Blood)</span>
                                                <span className="text-[10px] font-bold text-secondaryText uppercase tracking-widest">{stagedPlayers.filter(p => p.team === 'B').length}/2</span>
                                            </div>
                                            <div className="space-y-3">
                                                {stagedPlayers.filter(p => p.team === 'B').map((p) => (
                                                    <Card key={p.userId} className="p-4 border-l-4 border-l-bloodRed bg-bloodRed/5">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-bloodRed/20 flex items-center justify-center text-bloodRed font-bold">
                                                                    {p.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-sm tracking-tight block">{p.fullName}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-secondaryText">HCP:</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            value={p.handicap}
                                                                            onChange={(e) => updateStagedPlayerHandicap(p.userId, parseFloat(e.target.value) || 0)}
                                                                            className="w-12 bg-transparent text-xs font-bold text-white focus:outline-none border-b border-borderColor/30"
                                                                            onFocus={(e) => e.target.select()}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => updateStagedPlayerTeam(p.userId, 'A')}
                                                                    className="p-2 text-secondaryText hover:text-neonGreen transition-colors"
                                                                    title="Move to Team A"
                                                                >
                                                                    <ArrowLeft className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => removeStagedPlayer(p.userId)} className="p-2 text-secondaryText hover:text-bloodRed transition-colors">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                                {stagedPlayers.filter(p => p.team === 'B').length < 2 && (
                                                    <button
                                                        onClick={() => navigate('/add-player?team=B')}
                                                        className="w-full h-14 rounded-xl border-2 border-dashed border-borderColor hover:border-bloodRed/50 transition-all flex items-center justify-center gap-2 group bg-surface/30"
                                                    >
                                                        <Plus className="w-4 h-4 text-secondaryText group-hover:text-bloodRed" />
                                                        <span className="text-xs font-black text-secondaryText uppercase tracking-widest group-hover:text-white">Opponent</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: MATCHES */}
                    {currentStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            {format === '1v1' ? (
                                <section>
                                    <div className="flex items-end justify-between mb-4">
                                        <div className="flex items-end gap-2">
                                            <div className="text-sm font-black text-white uppercase tracking-wider">Match Configuration</div>
                                            <div className="text-[10px] text-bloodRed font-bold uppercase tracking-widest pb-0.5">Live Odds</div>
                                        </div>
                                        <button onClick={() => addMatchSlot(10)} className="flex items-center gap-1.5 text-xs font-black text-neonGreen uppercase tracking-tighter hover:opacity-80 transition-opacity p-1 px-2 border border-neonGreen/20 rounded-lg bg-neonGreen/5">
                                            <Plus className="w-3 h-3" />
                                            <span>Add Match</span>
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {matchSlots.map((slot, idx) => (
                                            <div key={slot.id} className="relative group">
                                                <Card className={`overflow-hidden border-2 transition-all duration-300 ${slot.opponentId ? 'border-bloodRed/30 shadow-[0_0_20px_rgba(255,0,63,0.1)] bg-gradient-to-br from-surface to-bloodRed/[0.03]' : 'border-borderColor'}`}>
                                                    {/* Slot Header */}
                                                    <div className="flex items-center justify-between p-3 border-b border-borderColor/50 bg-background/50">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded bg-bloodRed/20 flex items-center justify-center">
                                                                <span className="text-[10px] font-black text-bloodRed">M{idx + 1}</span>
                                                            </div>
                                                            <span className="text-[10px] font-black text-secondaryText uppercase tracking-[0.2em]">Matchup</span>
                                                        </div>
                                                        <button onClick={() => removeMatchSlot(slot.id)} className="p-1 text-secondaryText hover:text-bloodRed transition-colors">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="p-4 flex flex-col gap-4">
                                                        <div className="flex items-center justify-between gap-3">
                                                            {/* Player 1 Selection */}
                                                            <div className="flex-1 flex flex-col items-center gap-2">
                                                                <select
                                                                    className={`w-full h-12 px-4 rounded-xl bg-background border transition-colors text-center text-sm font-bold appearance-none ${slot.player1Id ? 'border-neonGreen/50 text-white' : 'border-borderColor text-secondaryText'}`}
                                                                    value={slot.player1Id || user?.id || ''}
                                                                    onChange={(e) => setSlotPlayer1(slot.id, e.target.value)}
                                                                >
                                                                    <option value={user?.id || ''}>{profile?.fullName || 'Me'}</option>
                                                                    {poolPlayers.map((p) => (
                                                                        <option key={p.userId} value={p.userId}>{p.fullName}</option>
                                                                    ))}
                                                                </select>
                                                                <span className="text-xs font-bold text-secondaryText uppercase truncate w-full text-center">Player 1</span>
                                                            </div>

                                                            <div className="flex flex-col items-center justify-center px-4">
                                                                <div className="text-bloodRed italic font-black text-xl tracking-tighter transform skew-x-[-10deg]">VS</div>
                                                                <div className="h-[1px] w-8 bg-borderColor/50 mt-1" />
                                                            </div>

                                                            {/* Opponent Selection */}
                                                            <div className="flex-1 flex flex-col items-center gap-2">
                                                                <select
                                                                    className={`w-full h-12 px-4 rounded-xl bg-background border transition-colors text-center text-sm font-bold appearance-none ${slot.opponentId ? 'border-bloodRed/50 text-white' : 'border-borderColor text-secondaryText'}`}
                                                                    value={slot.opponentId || ''}
                                                                    onChange={(e) => setSlotOpponent(slot.id, e.target.value)}
                                                                >
                                                                    <option value="">Select Opponent</option>
                                                                    {poolPlayers.map((p) => (
                                                                        <option key={p.userId} value={p.userId}>{p.fullName}</option>
                                                                    ))}
                                                                </select>
                                                                <span className="text-xs font-bold text-secondaryText uppercase">Opponent</span>
                                                            </div>
                                                        </div>

                                                        {/* Wager Grid */}
                                                        {slot.opponentId && (
                                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                                <div className="bg-background/50 p-3 rounded-xl border border-borderColor/30">
                                                                    <div className="text-[10px] font-black text-secondaryText uppercase tracking-widest mb-1">Strokes</div>
                                                                    <div className="text-lg font-black text-neonGreen">
                                                                        {(() => {
                                                                            const p1Id = slot.player1Id || user?.id;
                                                                            const p1 = p1Id === user?.id ? { handicap: creatorHcp } : poolPlayers.find(p => p.userId === p1Id);
                                                                            const opp = poolPlayers.find((p) => p.userId === slot.opponentId);
                                                                            if (!p1 || !opp) return '0';
                                                                            const diff = p1.handicap - opp.handicap;
                                                                            return diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? `${diff.toFixed(1)}` : 'Even';
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                                <div className="bg-background/50 p-3 rounded-xl border border-borderColor/30">
                                                                    <div className="text-[10px] font-black text-secondaryText uppercase tracking-widest mb-1">Nassau Wager</div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-lg font-black text-white">${slot.wager}</span>
                                                                        <div className="flex gap-1">
                                                                            <button onClick={() => setSlotWager(slot.id, Math.max(5, (slot.wager || 10) - 5))} className="w-5 h-5 rounded bg-surfaceHover flex items-center justify-center text-xs hover:text-bloodRed">-</button>
                                                                            <button onClick={() => setSlotWager(slot.id, (slot.wager || 10) + 5)} className="w-5 h-5 rounded bg-surfaceHover flex items-center justify-center text-xs hover:text-neonGreen">+</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ) : (
                                <section>
                                    <div className="text-sm font-black text-white uppercase tracking-wider mb-4">Team Breakdown</div>
                                    <Card className="overflow-hidden border-2 border-borderColor bg-surface/30">
                                        <div className="grid grid-cols-2 divide-x divide-borderColor/50">
                                            <div className="p-4 space-y-3">
                                                <div className="text-[10px] font-black text-neonGreen uppercase tracking-[0.2em] mb-1">Team A (Green)</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-neonGreen/10 border border-neonGreen/20 flex items-center justify-center text-neonGreen font-bold text-xs overflow-hidden shrink-0">
                                                        {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : initials}
                                                    </div>
                                                    <span className="text-xs font-bold truncate">{profile?.fullName.split(' ')[0] || 'Me'}</span>
                                                </div>
                                                {stagedPlayers.filter((p) => p.team === 'A').map((p) => (
                                                    <div key={p.userId} className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-neonGreen/10 border border-neonGreen/20 flex items-center justify-center text-neonGreen font-bold text-xs">
                                                            {p.fullName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-bold truncate">{p.fullName.split(' ')[0]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="text-[10px] font-black text-bloodRed uppercase tracking-[0.2em] mb-1">Team B (Blood)</div>
                                                {stagedPlayers.filter((p) => p.team === 'B').length === 0 ? (
                                                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-borderColor/30 rounded-lg">
                                                        <span className="text-[10px] font-bold text-secondaryText uppercase">No Opponents</span>
                                                    </div>
                                                ) : (
                                                    stagedPlayers.filter((p) => p.team === 'B').map((p) => (
                                                        <div key={p.userId} className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-bloodRed/10 border border-bloodRed/20 flex items-center justify-center text-bloodRed font-bold text-xs">
                                                                {p.fullName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                                                            </div>
                                                            <span className="text-xs font-bold truncate">{p.fullName.split(' ')[0]}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Handicap differential callout for 2v2 */}
                                        {(() => {
                                            const partnerA = stagedPlayers.find((p) => p.team === 'A');
                                            const teamB = stagedPlayers.filter((p) => p.team === 'B');
                                            if (teamB.length === 0) return null;
                                            const teamAHcp = Math.round(creatorHcp + (partnerA?.handicap ?? 0));
                                            const teamBHcp = Math.round(teamB.reduce((sum, p) => sum + p.handicap, 0));
                                            const diff = Math.abs(teamAHcp - teamBHcp);
                                            const nameA = 'Team A';
                                            const nameB = 'Team B';
                                            if (diff === 0) return (
                                                <div className="p-3 border-t border-borderColor/50 text-center bg-surfaceHover/10">
                                                    <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest">Scratch Match • No Strokes Given</span>
                                                </div>
                                            );
                                            const spottedName = teamAHcp > teamBHcp ? nameA : nameB;
                                            const spottingName = teamAHcp > teamBHcp ? nameB : nameA;
                                            return (
                                                <div className="p-4 bg-gradient-to-b from-transparent to-bloodRed/[0.03] border-t border-borderColor/50">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <div className="text-center flex-1">
                                                            <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest block">Combined HCP</span>
                                                            <span className="text-sm font-black text-neonGreen">{teamAHcp}</span>
                                                        </div>
                                                        <div className="w-[1px] h-6 bg-borderColor/50" />
                                                        <div className="text-center flex-1">
                                                            <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest block">Combined HCP</span>
                                                            <span className="text-sm font-black text-bloodRed">{teamBHcp}</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-background/80 rounded-xl p-3 border border-bloodRed/20 flex items-center justify-center shadow-[0_4px_12px_rgba(255,0,63,0.1)]">
                                                        <p className="text-xs font-black uppercase tracking-widest text-white text-center">
                                                            {spottingName} spots {spottedName} <span className="text-sm text-bloodRed px-1">{diff}</span> stroke{diff !== 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </Card>
                                </section>
                            )}
                        </motion.div>
                    )}

                    {/* STEP 4: SETUP */}
                    {currentStep === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8 pb-10"
                        >
                            {/* ── Course Selection ─────────────────────────── */}
                            <section>
                                <div className="flex items-end gap-2 mb-3">
                                    <div className="text-sm font-black text-white uppercase tracking-wider">Course Selection</div>
                                    <div className="text-[10px] text-bloodRed font-bold uppercase tracking-widest pb-0.5">Top Rated</div>
                                </div>
                                {selectedCourse ? (
                                    <Card className="p-4 border-2 border-bloodRed/30 bg-bloodRed/5 shadow-[0_4px_20px_rgba(255,0,63,0.1)] transition-all flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-bloodRed/20 flex items-center justify-center shrink-0">
                                            <MapPin className="w-6 h-6 text-bloodRed" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-black uppercase tracking-tight text-white mb-0.5">{selectedCourse.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black bg-white/10 px-1.5 py-0.5 rounded text-secondaryText uppercase">{selectedCourse.holes.length} Holes</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedCourse(null); setCourseResults([]); }}
                                            className="p-2 text-bloodRed hover:bg-bloodRed/10 rounded-lg transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </Card>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondaryText pointer-events-none" />
                                            <input
                                                type="text"
                                                className="block w-full pl-11 pr-24 py-4 border-2 border-borderColor rounded-2xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:border-bloodRed/50 focus:shadow-[0_0_15px_rgba(255,0,63,0.1)] text-sm font-bold transition-all"
                                                placeholder="Find Your Course…"
                                                value={courseQuery}
                                                onChange={(e) => setCourseQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleCourseSearch()}
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                {courseSearching ? (
                                                    <Loader className="w-5 h-5 text-bloodRed animate-spin" />
                                                ) : (
                                                    <button onClick={handleNearbySearch} className="px-3 py-1.5 bg-bloodRed/10 rounded-xl text-bloodRed hover:bg-bloodRed/20 transition-colors flex items-center gap-1.5 border border-bloodRed/20">
                                                        <MapPin className="w-3 h-3" />
                                                        <span className="text-[10px] font-black uppercase tracking-tighter">Near Me</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {courseError && (
                                            <div className="p-3 rounded-xl bg-bloodRed/10 border border-bloodRed/20">
                                                <p className="text-bloodRed text-xs font-bold uppercase tracking-tight text-center">{courseError}</p>
                                            </div>
                                        )}
                                        {courseResults.length > 0 && (
                                            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1 momentum-scroll">
                                                {courseResults.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        className="w-full p-4 flex items-center gap-4 bg-surface/50 border border-borderColor hover:border-bloodRed/50 hover:bg-surface transition-all rounded-2xl group text-left"
                                                        onClick={() => { setSelectedCourse(c); setCourseResults([]); }}
                                                    >
                                                        <div className="w-10 h-10 rounded-xl bg-surfaceHover flex items-center justify-center group-hover:bg-bloodRed/10 group-hover:text-bloodRed transition-colors">
                                                            <MapPin className="w-5 h-5 text-secondaryText group-hover:text-bloodRed" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <span className="font-bold text-sm text-white block truncate">{c.name}</span>
                                                            <span className="text-[10px] text-secondaryText font-medium uppercase tracking-widest">{c.holes.length} Holes</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* ── Match Basics (Hole & Stakes) ─────────────────────────── */}
                            <div className="grid grid-cols-1 gap-4">
                                <section>
                                    <div className="text-[10px] font-black text-secondaryText uppercase tracking-[0.2em] mb-3 ml-1">Tee Time Details</div>
                                    <Card className="p-4 border-borderColor/50 bg-background/30">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-surfaceHover flex items-center justify-center">
                                                    <ArrowRight className="w-5 h-5 text-secondaryText" />
                                                </div>
                                                <div>
                                                    <span className="font-black text-xs uppercase tracking-tight block">Starting Hole</span>
                                                    <span className="text-[10px] text-neonGreen font-bold uppercase tracking-widest">
                                                        {startingHole === 1 ? 'Front 9' : startingHole === 10 ? 'Back 9' : `Hole ${startingHole}`}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => setStartingHole((h) => Math.max(1, h - 1))} className="w-8 h-8 rounded-full border border-borderColor hover:border-bloodRed hover:text-bloodRed flex items-center justify-center transition-all">-</button>
                                                <span className="text-xl font-black w-8 text-center tabular-nums">{startingHole}</span>
                                                <button onClick={() => setStartingHole((h) => Math.min(18, h + 1))} className="w-8 h-8 rounded-full border border-borderColor hover:border-neonGreen hover:text-neonGreen flex items-center justify-center transition-all">+</button>
                                            </div>
                                        </div>
                                    </Card>
                                </section>

                                <section>
                                    <div className="text-[10px] font-black text-secondaryText uppercase tracking-[0.2em] mb-3 ml-1">The Stakes</div>
                                    <Card className="p-0 border-borderColor/50 overflow-hidden bg-background/30">
                                        {format === '2v2' && (
                                            <div className="p-4 border-b border-borderColor/30 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-neonGreen/10 flex items-center justify-center">
                                                        <span className="text-neonGreen font-black">$</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-xs uppercase tracking-tight block">Team Wager</span>
                                                        <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Standard Nassau</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => setWager(Math.max(5, wager - 5))} className="w-8 h-8 rounded-full border border-borderColor hover:border-bloodRed hover:text-bloodRed flex items-center justify-center transition-all">-</button>
                                                    <span className="text-xl font-black w-10 text-center tabular-nums">${wager}</span>
                                                    <button onClick={() => setWager(wager + 5)} className="w-8 h-8 rounded-full border border-borderColor hover:border-neonGreen hover:text-neonGreen flex items-center justify-center transition-all">+</button>
                                                </div>
                                            </div>
                                        )}
                                        {format === 'skins' && (
                                            <>
                                                <div className="p-4 border-b border-borderColor/30 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-neonGreen/10 flex items-center justify-center">
                                                            <span className="text-neonGreen font-black">$</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-black text-xs uppercase tracking-tight block">
                                                                {potMode ? 'Buy-in Per Player' : 'Skin Value'}
                                                            </span>
                                                            <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">
                                                                {potMode
                                                                    ? `Total Pot: $${wager * ((teamSkins ? stagedPlayers.length : poolPlayers.length) + 1)}`
                                                                    : '$ per skin'
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => setWager(Math.max(5, wager - 5))} className="w-8 h-8 rounded-full border border-borderColor hover:border-bloodRed hover:text-bloodRed flex items-center justify-center transition-all">-</button>
                                                        <span className="text-xl font-black w-10 text-center tabular-nums">${wager}</span>
                                                        <button onClick={() => setWager(wager + 5)} className="w-8 h-8 rounded-full border border-borderColor hover:border-neonGreen hover:text-neonGreen flex items-center justify-center transition-all">+</button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between p-4 border-b border-borderColor/30">
                                                    <div>
                                                        <span className="font-black text-xs uppercase tracking-tight block text-white">Pot Skins</span>
                                                        <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Most skins wins the pot</span>
                                                    </div>
                                                    <Toggle checked={potMode} onCheckedChange={setPotMode} />
                                                </div>
                                            </>
                                        )}

                                        {/* Trash Bets Trigger */}
                                        <button
                                            onClick={() => setTrashOpen(true)}
                                            className="w-full flex justify-between items-center p-4 hover:bg-surfaceHover/50 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-bloodRed/10 flex items-center justify-center group-hover:bg-bloodRed/20 transition-colors">
                                                    <Settings2 className="w-5 h-5 text-bloodRed" />
                                                </div>
                                                <div className="text-left">
                                                    <span className="font-black text-xs uppercase tracking-tight block">Trash & Side Bets</span>
                                                    <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Configure Rewards</span>
                                                </div>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-secondaryText group-hover:text-white transition-all transform group-hover:translate-x-1" />
                                        </button>
                                    </Card>

                                    {/* Trash Bets Bottom Sheet */}
                                    <BottomSheet open={trashOpen} onClose={() => setTrashOpen(false)} title="Trash & Side Bets">
                                        <div className="divide-y divide-borderColor/50 px-2">
                                            {[
                                                { id: 'greenies', label: 'Greenies', sub: 'Closest to pin, par+', state: greenies, set: setGreenies, skinsOnly: false },
                                                { id: 'sandies', label: 'Sandies', sub: 'Par+ from bunker', state: sandies, set: setSandies, skinsOnly: false },
                                                { id: 'snake', label: 'Snake', sub: '3-putt penalty', state: snake, set: setSnake, skinsOnly: false },
                                                { id: 'autopress', label: 'Auto Press', sub: 'Press when 2 down', state: autoPress, set: setAutoPress, nassauOnly: true },
                                                { id: 'birdies', label: 'Birdies Double', sub: 'Net Birdie = 2 pts', state: birdiesDouble, set: setBirdiesDouble, nassauOnly: true },
                                                { id: 'bonusSkins', label: 'Bonus Skins', sub: 'Pin (+1) · Birdie (+1) · Eagle (+2)', state: bonusSkins, set: setBonusSkins, skinsOnly: true },
                                            ].filter(item => {
                                                if ((item as any).skinsOnly) return format === 'skins';
                                                if ((item as any).nassauOnly) return format !== 'skins';
                                                return true;
                                            }).map((item) => (
                                                <div key={item.id} className="flex items-center justify-between p-4">
                                                    <div>
                                                        <span className="font-bold text-sm block text-white uppercase tracking-tight">{item.label}</span>
                                                        <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">{item.sub}</span>
                                                    </div>
                                                    <Toggle checked={item.state} onCheckedChange={item.set} />
                                                </div>
                                            ))}

                                            <div className="flex items-center justify-between p-4 bg-bloodRed/5 mt-2 rounded-2xl border border-bloodRed/10">
                                                <div>
                                                    <span className="font-bold text-sm block text-white uppercase tracking-tight">Trash Value</span>
                                                    <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">Payout per dot</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => setTrashValue((v) => Math.max(5, v - 5))} className="w-8 h-8 rounded-full border border-borderColor flex items-center justify-center">-</button>
                                                    <span className="text-lg font-black w-10 text-center tabular-nums">${trashValue}</span>
                                                    <button onClick={() => setTrashValue((v) => v + 5)} className="w-8 h-8 rounded-full border border-borderColor flex items-center justify-center">+</button>
                                                </div>
                                            </div>

                                            <div className="pt-6 pb-2">
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-bloodRed px-4">Side Contests</span>
                                            </div>

                                            {[
                                                { id: 'par3', label: 'Par 3 Contest', sub: 'Lowest gross on par 3s', state: par3Contest, set: setPar3Contest, pot: par3Pot, setPot: setPar3Pot },
                                                { id: 'par5', label: 'Par 5 Contest', sub: 'Lowest gross on par 5s', state: par5Contest, set: setPar5Contest, pot: par5Pot, setPot: setPar5Pot }
                                            ].map(item => (
                                                <div key={item.id} className="space-y-0 text-white">
                                                    <div className="flex items-center justify-between p-4">
                                                        <div>
                                                            <span className="font-bold text-sm block text-white uppercase tracking-tight">{item.label}</span>
                                                            <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">{item.sub}</span>
                                                        </div>
                                                        <Toggle checked={item.state} onCheckedChange={item.set} />
                                                    </div>
                                                    {item.state && (
                                                        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                                                            <div className="bg-background/50 p-3 rounded-xl border border-borderColor/30 flex justify-between items-center">
                                                                <span className="text-[10px] font-black text-bloodRed uppercase tracking-widest">Ante Amount</span>
                                                                <div className="flex items-center gap-3">
                                                                    <button onClick={() => item.setPot(Math.max(5, item.pot - 5))} className="w-6 h-6 rounded-full border border-borderColor flex items-center justify-center text-xs">-</button>
                                                                    <span className="text-sm font-black tabular-nums">${item.pot}</span>
                                                                    <button onClick={() => item.setPot(item.pot + 5)} className="w-6 h-6 rounded-full border border-borderColor flex items-center justify-center text-xs">+</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="p-4 pt-0">
                                            <Button className="w-full uppercase font-black tracking-widest" onClick={() => setTrashOpen(false)}>Done</Button>
                                        </div>
                                    </BottomSheet>
                                </section>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Navigation Footer */}
            <footer className="p-4 bg-gradient-to-t from-background via-background to-transparent pt-10 z-20 shrink-0">
                <div className="max-w-md mx-auto flex gap-3">
                    {currentStep > 1 && (
                        <button
                            onClick={prevStep}
                            className="h-14 px-6 rounded-2xl border-2 border-borderColor bg-surface hover:bg-surfaceHover transition-all flex items-center justify-center"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    <Button
                        size="lg"
                        className={`flex-1 h-14 text-lg uppercase tracking-wider font-black shadow-[0_8px_30px_rgba(255,0,63,0.3)] transition-all transform active:scale-[0.98] ${!canAdvance() ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-[0_8px_40px_rgba(255,0,63,0.5)]'}`}
                        onClick={nextStep}
                        disabled={creating || (!canAdvance() && currentStep !== 1)} // Step 1 can always advance if format selected
                    >
                        {currentStep === 4 ? (creating ? 'Starting...' : 'Tee Off') : 'Continue'}
                    </Button>
                </div>
                {error && <p className="text-bloodRed text-[10px] font-black uppercase tracking-widest text-center mt-2 animate-bounce">{error}</p>}
            </footer>
        </div>
    );
}
