import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { StepTracker } from '../components/ui/StepTracker';
import { Button } from '../components/ui/Button';
import { useMatchStore } from '../store/useMatchStore';
import { useAuth } from '../contexts/AuthContext';
import { searchCourses, searchNearbyCourses, fetchCourseImage } from '../lib/courseApi';
import { Course } from '../types';
import SEO from '../components/SEO';
import { useUIStore } from '../store/useUIStore';
import { startMatchSetupTour, startMatch2v2SetupTour, startMatchConfigTour, startMatchFormatTour, startMatchStrokesTour, killTour } from '../lib/tour';

// Sub-components for Match Setup
import { FormatStep } from '../components/setup/FormatStep';
import { PlayerStep } from '../components/setup/PlayerStep';
import { MatchStrokesStep } from '../components/setup/MatchStrokesStep';
import { CourseStakesStep } from '../components/setup/CourseStakesStep';

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
    const setSlotStrokes = useMatchStore((s) => s.setSlotStrokes);
    const updateStagedPlayerTeam = useMatchStore((s) => s.updateStagedPlayerTeam);
    const format = useMatchStore((s) => s.pendingFormat);
    const setFormat = useMatchStore((s) => s.setPendingFormat);
    const currentStep = useMatchStore((s) => s.currentStep);
    const setCurrentStep = useMatchStore((s) => s.setCurrentStep);
    const teamSkins = useMatchStore((s) => s.pendingTeamSkins);
    const setPendingTeamSkins = useMatchStore((s) => s.setPendingTeamSkins);
    const {
        hasSeenMatchFormatTour,
        setSeenMatchFormatTour,
        hasSeenMatchSetupTour,
        setSeenMatchSetupTour,
        hasSeenMatchStrokesTour,
        setSeenMatchStrokesTour,
        hasSeenMatchConfigTour,
        setSeenMatchConfigTour
    } = useUIStore();

    // Tour tracking
    const [currentConfigStep, setCurrentConfigStep] = useState(0);

    const [wager, setWager] = useState(10);
    const [bloodCoinWager, setBloodCoinWager] = useState(0);
    const [creatorHcp, setCreatorHcp] = useState<number>(0);

    useEffect(() => {
        if (profile?.handicap !== undefined) setCreatorHcp(profile.handicap);
    }, [profile?.handicap]);

    // 2v2 team stroke override (signed: positive = Team A spotted)
    const [teamStrokeOverride, setTeamStrokeOverride] = useState<number | undefined>(undefined);
    // Reset when players change
    useEffect(() => { setTeamStrokeOverride(undefined); }, [stagedPlayers]);

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
    const [scoringType, setScoringType] = useState<'match_play' | 'stroke_play'>('match_play');

    const resumeFormatTour = (stepIdx: number) => {
        if (currentStep === 1 && !hasSeenMatchFormatTour) {
            startMatchFormatTour(() => setSeenMatchFormatTour(true), stepIdx);
        }
    };

    const resumeConfigTour = (stepIdx: number) => {
        if (currentStep === 4 && !hasSeenMatchConfigTour) {
            startMatchConfigTour(() => setSeenMatchConfigTour(true), stepIdx);
            setCurrentConfigStep(stepIdx);
        }
    };

    // Tour for Step 1: Format Selection
    useEffect(() => {
        if (currentStep === 1 && !hasSeenMatchFormatTour) {
            const timer = setTimeout(() => {
                resumeFormatTour(0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentStep, hasSeenMatchFormatTour]);

    // Tour for Step 2: Add Players
    useEffect(() => {
        if (currentStep === 2 && !hasSeenMatchSetupTour) {
            const timer = setTimeout(() => {
                if (format === '2v2') {
                    const teamAFull = stagedPlayers.filter(p => p.team === 'A').length >= 1; // You + 1
                    const teamBFull = stagedPlayers.filter(p => p.team === 'B').length >= 2;
                    let stepIdx = 0;
                    if (teamAFull && !teamBFull) stepIdx = 1;
                    else if (teamAFull && teamBFull) stepIdx = 2;
                    startMatch2v2SetupTour(() => setSeenMatchSetupTour(true), stepIdx);
                } else {
                    const isSkins = format === 'skins';
                    const poolCount = poolPlayers.length; // Only counts guests
                    const isFull = poolCount >= 3; // 3 added + creator = 4

                    // The user only wants to be guided to Team Skins if there are 4 players (balanced teams)
                    const shouldShowTeamSkinsTour = isSkins && poolCount === 3;

                    let stepIdx = 0;
                    if (shouldShowTeamSkinsTour) {
                        stepIdx = 1; // Start at Team Skins Step
                    } else if (isFull) {
                        // If full but not showing Team Skins (e.g. 1v1), step 1 is the Continue button
                        stepIdx = 1;
                    }

                    startMatchSetupTour(() => setSeenMatchSetupTour(true), stepIdx, shouldShowTeamSkinsTour);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentStep, hasSeenMatchSetupTour, poolPlayers.length, stagedPlayers.length, format]);

    // Advance setup tour if players added
    useEffect(() => {
        if (currentStep === 2 && !hasSeenMatchSetupTour) {
            const totalPlayers = format === 'skins' ? poolPlayers.length : stagedPlayers.length;
            if (totalPlayers >= 1) {
                // In Step 2, once a player is added, the tour is mostly done
            }
        }
    }, [currentStep, poolPlayers.length, stagedPlayers.length, hasSeenMatchSetupTour]);

    // Tour for Step 3: Matches (Strokes/Handicaps)
    useEffect(() => {
        if (currentStep === 3 && !hasSeenMatchStrokesTour && format !== 'skins') {
            const timer = setTimeout(() => {
                // Only show multi-match tour if it's 1v1 AND there's more than one opponent to even play against
                const isMultiMatch = format === '1v1' && poolPlayers.length > 1;
                startMatchStrokesTour(() => setSeenMatchStrokesTour(true), isMultiMatch);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentStep, hasSeenMatchStrokesTour, format, poolPlayers.length]);

    // Tour for Step 4: Setup (Course, Stakes, Trash)
    useEffect(() => {
        if (currentStep === 4 && !hasSeenMatchConfigTour) {
            const timer = setTimeout(() => {
                resumeConfigTour(0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentStep, hasSeenMatchConfigTour]);

    // Reactive Advancing for Step 4 Tour
    useEffect(() => {
        if (currentStep === 4 && !hasSeenMatchConfigTour) {
            if (selectedCourse && currentConfigStep === 0) resumeConfigTour(1);
        }
    }, [selectedCourse, currentStep, currentConfigStep, hasSeenMatchConfigTour]);

    // Note: We don't auto-advance for wager or bloodCoinWager because 
    // USD wager has a default value (10) which causes an immediate skip.
    // Users will use the tour's "Next" button to move through the stakes.

    useEffect(() => {
        if (currentStep === 4 && !hasSeenMatchConfigTour) {
            if (trashOpen && currentConfigStep === 4) resumeConfigTour(5);
        }
    }, [trashOpen, currentStep, currentConfigStep, hasSeenMatchConfigTour]);

    async function handleCourseSelection(course: Course) {
        setCourseSearching(true);
        try {
            const imageUrl = await fetchCourseImage(course.name || '');
            setSelectedCourse({ ...course, imageUrl });
            setCourseResults([]);
        } catch (err) {
            console.error('Failed to fetch image:', err);
            setSelectedCourse(course);
            setCourseResults([]);
        } finally {
            setCourseSearching(false);
        }
    }

    const onAddPlayer = (type: 'pool' | 'teamA' | 'teamB') => {
        const query = type === 'pool' ? 'pool=1' : `team=${type.replace('team', '')}`;
        navigate(`/add-player?${query}`);
    };

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
            if ((format === 'skins' || format === '1v1') && !teamSkins) {
                return poolPlayers.length >= 1; // Need at least 1 other player
            }
            if (format === 'skins' && teamSkins) {
                return stagedPlayers.filter(p => p.team === 'B').length >= 1;
            }
            // For 2v2 or standard matches, require at least one teammate/partner
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
        if (currentStep === 2 && format === '1v1') {
            // Auto-configure the match slot to default to the first available pool player
            const slot = matchSlots[0];
            if (slot && !slot.opponentId && poolPlayers.length > 0) {
                // Find a player that isn't the current user to be the default opponent
                const potentialOpponent = poolPlayers.find(p => p.userId !== user?.id) || poolPlayers[0];
                if (potentialOpponent) {
                    setSlotOpponent(slot.id, potentialOpponent.userId);
                }
            }
            setCurrentStep(3);
            return;
        }
        if (currentStep < 4) setCurrentStep(currentStep + 1);
        else handleStartMatch();
    };

    const prevStep = () => {
        if (currentStep === 4 && format === 'skins') { setCurrentStep(2); return; } // skip back over Matches
        if (currentStep > 1) setCurrentStep(currentStep - 1);
        else navigate(-1);
    };

    const handleTourFinish = () => {
        nextStep();
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

        const sideBets = { greenies, sandies, snake, autoPress, birdiesDouble: scoringType === 'stroke_play' ? false : birdiesDouble, trashValue, startingHole, par3Contest, par3Pot, par5Contest, par5Pot, bonusSkins, teamSkins, potMode, scoringType: format === 'skins' ? undefined : scoringType };

        setCreating(true);
        setError('');
        const effectiveCurrency: 'USD' | 'BLOOD_COINS' = bloodCoinWager > 0 && wager === 0 ? 'BLOOD_COINS' : 'USD';
        try {
            if (format === 'skins') {
                if (teamSkins) {
                    if (stagedPlayers.filter(p => p.team === 'B').length < 1) { setError('Add at least one player to Team B.'); setCreating(false); return; }
                } else {
                    if (poolPlayers.length < 1) { setError('Add at least one other player.'); setCreating(false); return; }
                }
                await createSkinsMatch(
                    { courseId: selectedCourse.id, wagerAmount: wager, bloodCoinWager, wagerCurrency: effectiveCurrency, status: 'in_progress', sideBets, createdBy: user.id },
                    selectedCourse,
                    user.id,
                    creatorHcp
                );
            } else if (format === '1v1') {
                const validSlots = matchSlots.filter((s) => s.opponentId !== null && (s.player1Id ?? user.id) !== s.opponentId);
                if (validSlots.length === 0) { setError('Select at least one opponent.'); setCreating(false); return; }
                await createMatchGroup(
                    { courseId: selectedCourse.id, wagerType: 'NASSAU', status: 'in_progress', sideBets, createdBy: user.id, wagerCurrency: effectiveCurrency, wagerAmount: wager, bloodCoinWager },
                    selectedCourse,
                    user.id,
                    creatorHcp
                );
            } else {
                await createMatch(
                    { courseId: selectedCourse.id, format, wagerAmount: wager, bloodCoinWager, wagerCurrency: effectiveCurrency, wagerType: 'NASSAU', status: 'in_progress', sideBets, createdBy: user.id },
                    selectedCourse,
                    user.id,
                    creatorHcp,
                    teamStrokeOverride
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
            <SEO title="Setup Match" />
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
                    <button onClick={() => navigate('/dashboard')} className="p-2 -mr-2 text-secondaryText hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Tracker */}
                <div className="px-4 pb-6">
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
                        <FormatStep
                            format={format}
                            setFormat={setFormat}
                            nextStep={nextStep}
                        />
                    )}

                    {/* STEP 2: PLAYERS */}
                    {currentStep === 2 && (
                        <PlayerStep
                            format={format}
                            teamSkins={teamSkins}
                            profile={profile}
                            initials={initials}
                            creatorHcp={creatorHcp}
                            setCreatorHcp={setCreatorHcp}
                            stagedPlayers={stagedPlayers}
                            poolPlayers={poolPlayers}
                            removeStagedPlayer={removeStagedPlayer}
                            updateStagedPlayerHandicap={updateStagedPlayerHandicap}
                            updateStagedPlayerTeam={updateStagedPlayerTeam}
                            removePoolPlayer={removePoolPlayer}
                            updatePoolPlayerHandicap={updatePoolPlayerHandicap}
                            handleTeamSkinsToggle={handleTeamSkinsToggle}
                            onAddPlayer={onAddPlayer}
                            killTour={killTour}
                        />
                    )}

                    {/* STEP 3: MATCHES */}
                    {currentStep === 3 && (
                        <MatchStrokesStep
                            format={format}
                            matchSlots={matchSlots}
                            poolPlayers={poolPlayers}
                            user={user}
                            profile={profile}
                            creatorHcp={creatorHcp}
                            addMatchSlot={addMatchSlot}
                            removeMatchSlot={removeMatchSlot}
                            setSlotPlayer1={setSlotPlayer1}
                            setSlotOpponent={setSlotOpponent}
                            setSlotStrokes={setSlotStrokes}
                            stagedPlayers={stagedPlayers}
                            initials={initials}
                            teamStrokeOverride={teamStrokeOverride}
                            setTeamStrokeOverride={setTeamStrokeOverride}
                            killTour={killTour}
                        />
                    )}

                    {/* STEP 4: SETUP */}
                    {currentStep === 4 && (
                        <CourseStakesStep
                            selectedCourse={selectedCourse}
                            setSelectedCourse={setSelectedCourse}
                            courseQuery={courseQuery}
                            setCourseQuery={setCourseQuery}
                            handleCourseSearch={handleCourseSearch}
                            courseSearching={courseSearching}
                            handleNearbySearch={handleNearbySearch}
                            courseError={courseError}
                            courseResults={courseResults}
                            handleCourseSelection={handleCourseSelection}
                            startingHole={startingHole}
                            setStartingHole={setStartingHole}
                            format={format}
                            potMode={potMode}
                            setPotMode={setPotMode}
                            wager={wager}
                            setWager={setWager}
                            bloodCoinWager={bloodCoinWager}
                            setBloodCoinWager={setBloodCoinWager}
                            scoringType={scoringType}
                            setScoringType={setScoringType}
                            stagedPlayers={stagedPlayers}
                            poolPlayers={poolPlayers}
                            teamSkins={teamSkins}
                            greenies={greenies}
                            setGreenies={setGreenies}
                            sandies={sandies}
                            setSandies={setSandies}
                            snake={snake}
                            setSnake={setSnake}
                            autoPress={autoPress}
                            setAutoPress={setAutoPress}
                            birdiesDouble={birdiesDouble}
                            setBirdiesDouble={setBirdiesDouble}
                            bonusSkins={bonusSkins}
                            setBonusSkins={setBonusSkins}
                            trashValue={trashValue}
                            setTrashValue={setTrashValue}
                            trashOpen={trashOpen}
                            setTrashOpen={setTrashOpen}
                            par3Contest={par3Contest}
                            setPar3Contest={setPar3Contest}
                            par5Contest={par5Contest}
                            setPar5Contest={setPar5Contest}
                            par3Pot={par3Pot}
                            setPar3Pot={setPar3Pot}
                            par5Pot={par5Pot}
                            setPar5Pot={setPar5Pot}
                            killTour={killTour}
                        />
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
                        id="tee-off-btn"
                        size="lg"
                        className={`flex-1 h-14 text-lg uppercase tracking-wider font-black shadow-[0_8px_30px_rgba(255,0,63,0.3)] transition-all transform active:scale-[0.98] relative ${!canAdvance() ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-[0_8px_40px_rgba(255,0,63,0.5)]'}`}
                        onClick={handleTourFinish}
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
