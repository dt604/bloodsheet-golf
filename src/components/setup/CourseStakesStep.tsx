import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Search, Loader, X, ArrowRight, Info, Settings2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { BloodCoin } from '../ui/BloodCoin';
import { useState } from 'react';
import { Course } from '../../types';

interface CourseStakesStepProps {
    selectedCourse: Course | null;
    setSelectedCourse: (course: Course | null) => void;
    courseQuery: string;
    setCourseQuery: (val: string) => void;
    handleCourseSearch: () => void;
    courseSearching: boolean;
    handleNearbySearch: () => void;
    courseError: string;
    courseResults: Course[];
    handleCourseSelection: (course: Course) => void;
    startingHole: number;
    setStartingHole: (val: number | ((h: number) => number)) => void;
    format: string;
    potMode: boolean;
    setPotMode: (val: boolean) => void;
    wager: number;
    setWager: (val: number) => void;
    bloodCoinWager: number;
    setBloodCoinWager: (val: number) => void;
    scoringType: 'match_play' | 'stroke_play';
    setScoringType: (val: 'match_play' | 'stroke_play') => void;
    stagedPlayers: any[];
    poolPlayers: any[];
    teamSkins: boolean;
    greenies: boolean;
    setGreenies: (val: boolean) => void;
    sandies: boolean;
    setSandies: (val: boolean) => void;
    snake: boolean;
    setSnake: (val: boolean) => void;
    autoPress: boolean;
    setAutoPress: (val: boolean) => void;
    birdiesDouble: boolean;
    setBirdiesDouble: (val: boolean) => void;
    bonusSkins: boolean;
    setBonusSkins: (val: boolean) => void;
    trashValue: number;
    setTrashValue: (val: number | ((v: number) => number)) => void;
    trashOpen: boolean;
    setTrashOpen: (val: boolean) => void;
    par3Contest: boolean;
    setPar3Contest: (val: boolean) => void;
    par3Pot: number;
    setPar3Pot: (val: number | ((v: number) => number)) => void;
    par5Contest: boolean;
    setPar5Contest: (val: boolean) => void;
    par5Pot: number;
    setPar5Pot: (val: number | ((v: number) => number)) => void;
    selectedTee?: string | null;
    onTeeSelect?: (teeKey: string) => void;
    killTour: () => void;
}

export function CourseStakesStep({
    selectedCourse,
    setSelectedCourse,
    courseQuery,
    setCourseQuery,
    handleCourseSearch,
    courseSearching,
    handleNearbySearch,
    courseError,
    courseResults,
    handleCourseSelection,
    startingHole,
    setStartingHole,
    format,
    potMode,
    setPotMode,
    wager,
    setWager,
    bloodCoinWager,
    setBloodCoinWager,
    scoringType,
    setScoringType,
    stagedPlayers,
    poolPlayers,
    teamSkins,
    greenies,
    setGreenies,
    sandies,
    setSandies,
    snake,
    setSnake,
    autoPress,
    setAutoPress,
    birdiesDouble,
    setBirdiesDouble,
    bonusSkins,
    setBonusSkins,
    trashValue,
    setTrashValue,
    trashOpen,
    setTrashOpen,
    par3Contest,
    setPar3Contest,
    par3Pot,
    setPar3Pot,
    par5Contest,
    setPar5Contest,
    par5Pot,
    setPar5Pot,
    selectedTee,
    onTeeSelect,
    killTour
}: CourseStakesStepProps) {

    const TEE_COLORS: Record<string, string> = {
        black: '#1C1C1E',
        blue: '#3B82F6',
        white: '#F5F5F5',
        red: '#EF4444',
        gold: '#F59E0B',
        yellow: '#F59E0B',
        green: '#22C55E',
        silver: '#9CA3AF',
        gray: '#9CA3AF',
        grey: '#9CA3AF',
    };

    function teeColor(key: string, apiColor: string): string {
        const lower = (apiColor || key).toLowerCase();
        for (const [name, hex] of Object.entries(TEE_COLORS)) {
            if (lower.includes(name)) return hex;
        }
        return '#6B7280';
    }
    const [showPotSkinsHelp, setShowPotSkinsHelp] = useState(false);
    const [showTeamWagerHelp, setShowTeamWagerHelp] = useState(false);
    const [showSkinsWagerHelp, setShowSkinsWagerHelp] = useState(false);
    const [activeTrashTooltip, setActiveTrashTooltip] = useState<string | null>(null);

    const toggleTrashTooltip = (id: string) => {
        setActiveTrashTooltip(activeTrashTooltip === id ? null : id);
    };

    const playerCount = teamSkins ? stagedPlayers.length : poolPlayers.length;

    return (
        <motion.div
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
                    <>
                    <Card className="relative p-0 border-2 border-bloodRed/30 bg-surface shadow-[0_4px_30px_rgba(255,0,63,0.15)] transition-all overflow-hidden group">
                        {selectedCourse.imageUrl ? (
                            <div className="absolute inset-0 z-0">
                                <img
                                    src={selectedCourse.imageUrl}
                                    alt={selectedCourse.name}
                                    className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
                            </div>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-r from-bloodRed/10 to-transparent z-0" />
                        )}

                        <div className="relative z-10 p-5 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-bloodRed/20 backdrop-blur-md border border-white/10 flex items-center justify-center shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden">
                                {selectedCourse.imageUrl ? (
                                    <img src={selectedCourse.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                                ) : (
                                    <MapPin className="w-7 h-7 text-bloodRed" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-[10px] font-black text-bloodRed uppercase tracking-[0.2em] italic">Selected Course</span>
                                    <div className="h-[1px] w-4 bg-bloodRed/30" />
                                </div>
                                <h3 className="font-black uppercase tracking-tight text-xl text-white truncate leading-none mb-1.5">{selectedCourse.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black bg-white/10 backdrop-blur-md px-2 py-0.5 rounded text-secondaryText uppercase shrink-0 border border-white/5">{selectedCourse.holes.length} Holes</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCourse(null)}
                                className="p-2 text-white/50 hover:text-bloodRed hover:bg-bloodRed/10 rounded-xl transition-all duration-300 backdrop-blur-sm border border-transparent hover:border-bloodRed/20"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </Card>

                    {/* Tee Box Picker — only shown when API returned multiple tees */}
                    {selectedCourse?.availableTees && selectedCourse.availableTees.length > 1 && (
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondaryText">Select Tee Box</span>
                                {!selectedTee && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-bloodRed bg-bloodRed/10 border border-bloodRed/20 px-2 py-0.5 rounded-full">Required</span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedCourse.availableTees.map(({ key, color }) => {
                                    const hex = teeColor(key, color);
                                    const isSelected = selectedTee === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => onTeeSelect?.(key)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                                                isSelected
                                                    ? 'border-white/40 bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                                                    : 'border-borderColor bg-surface text-secondaryText hover:border-white/20 hover:text-white'
                                            }`}
                                        >
                                            <span
                                                className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                                                style={{ backgroundColor: hex }}
                                            />
                                            {key}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    </>
                ) : (
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondaryText pointer-events-none" />
                            <input
                                id="course-search-box"
                                type="text"
                                className="block w-full pl-11 pr-24 py-4 border-2 border-borderColor rounded-2xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:border-bloodRed/50 focus:shadow-[0_0_15px_rgba(255,0,63,0.1)] text-sm font-bold transition-all"
                                placeholder="Find Your Course…"
                                value={courseQuery}
                                onChange={(e) => setCourseQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCourseSearch()}
                                onFocus={killTour}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                {courseSearching ? (
                                    <Loader className="w-5 h-5 text-bloodRed animate-spin" />
                                ) : (
                                    <button onClick={handleNearbySearch} className="px-3 py-1.5 bg-bloodRed/10 rounded-xl text-bloodRed hover:bg-bloodRed/20 transition-colors flex items-center gap-1.5 border border-bloodRed/20 relative group">
                                        <MapPin className="w-3 h-3 group-hover:scale-110 transition-transform" />
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
                                        onClick={() => handleCourseSelection(c)}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-surfaceHover flex items-center justify-center group-hover:bg-bloodRed/10 group-hover:text-bloodRed transition-colors">
                                            <MapPin className="w-5 h-5 text-secondaryText group-hover:text-bloodRed" />
                                        </div>
                                        <div className="flex-1 min-w-0">
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
                    <Card id="starting-hole-section" className="p-4 border-borderColor/50 bg-background/30">
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
                                <button onClick={() => { killTour(); setStartingHole((h) => Math.max(1, h - 1)); }} className="w-8 h-8 rounded-full border border-borderColor hover:border-bloodRed hover:text-bloodRed flex items-center justify-center transition-all">-</button>
                                <span className="text-xl font-black w-8 text-center tabular-nums">{startingHole}</span>
                                <button onClick={() => { killTour(); setStartingHole((h) => Math.min(18, h + 1)); }} className="w-8 h-8 rounded-full border border-borderColor hover:border-neonGreen hover:text-neonGreen flex items-center justify-center transition-all">+</button>
                            </div>
                        </div>
                    </Card>
                </section>

                <section>
                    <div className="text-[10px] font-black text-secondaryText uppercase tracking-[0.2em] mb-3 ml-1">The Stakes</div>
                    <Card className="p-0 border-borderColor/50 overflow-hidden bg-background/30">
                        {format === 'skins' && (
                            <div className="p-4 border-b border-borderColor/30">
                                <div className="flex items-center justify-between mb-1">
                                    <div
                                        className="flex flex-col cursor-pointer group"
                                        onClick={() => setShowPotSkinsHelp(!showPotSkinsHelp)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-xs uppercase tracking-tight block text-white group-hover:text-bloodRed transition-colors">Pot Skins</span>
                                            <Info className="w-3.5 h-3.5 text-secondaryText group-hover:text-bloodRed transition-colors" />
                                        </div>
                                        <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Most skins wins the pot</span>
                                    </div>
                                    <Toggle checked={potMode} onCheckedChange={setPotMode} />
                                </div>

                                <AnimatePresence>
                                    {showPotSkinsHelp && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-[10px] text-secondaryText/90 font-medium leading-relaxed overflow-hidden pt-1"
                                        >
                                            Changes scoring from per-skin payouts to a winner-take-all pot based on total skins won.
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* ── USD Wager Panel ──────────────────── */}
                        <div id="real-money-wager" className="p-5 border-b border-borderColor/30 relative">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-neonGreen/10 border border-neonGreen/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,255,102,0.1)]">
                                        <span className="text-neonGreen font-black text-xl">$</span>
                                    </div>
                                    <div
                                        className="flex flex-col cursor-pointer group"
                                        onClick={() => format === '2v2' ? setShowTeamWagerHelp(!showTeamWagerHelp) : setShowSkinsWagerHelp(!showSkinsWagerHelp)}
                                    >
                                        <span className="font-black text-sm uppercase tracking-tight text-white group-hover:text-neonGreen transition-colors flex items-center gap-1.5">
                                            Real Money
                                            <Info className="w-3.5 h-3.5 text-secondaryText group-hover:text-neonGreen transition-colors" />
                                        </span>
                                        <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">
                                            {format === 'skins'
                                                ? (potMode ? `Buy-in · Total Pot: $${wager * (playerCount + 1)}` : '$ per skin')
                                                : scoringType === 'stroke_play' ? 'Stroke Play — Front · Back · Overall' : 'Match Play — Front · Back · Overall'
                                            }
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { killTour(); setWager(Math.max(0, wager - 5)); }}
                                        className="w-9 h-9 rounded-full border border-borderColor hover:border-bloodRed hover:text-bloodRed flex items-center justify-center transition-all text-lg font-bold active:scale-90"
                                    >−</button>
                                    <span className="text-2xl font-black min-w-[4rem] text-center tabular-nums text-white">
                                        ${wager}
                                    </span>
                                    <button
                                        onClick={() => { killTour(); setWager(wager + 5); }}
                                        className="w-9 h-9 rounded-full border border-borderColor hover:border-neonGreen hover:text-neonGreen flex items-center justify-center transition-all text-lg font-bold active:scale-90"
                                    >+</button>
                                </div>
                            </div>

                            {format !== 'skins' && (
                                <div className="flex items-center gap-2 mt-3">
                                    <button
                                        onClick={() => setScoringType('match_play')}
                                        className={`flex-1 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${scoringType === 'match_play' ? 'bg-bloodRed text-white' : 'border border-borderColor text-secondaryText'}`}
                                    >Match Play</button>
                                    <button
                                        onClick={() => setScoringType('stroke_play')}
                                        className={`flex-1 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${scoringType === 'stroke_play' ? 'bg-bloodRed text-white' : 'border border-borderColor text-secondaryText'}`}
                                    >Stroke Play</button>
                                </div>
                            )}

                            <AnimatePresence>
                                {(showTeamWagerHelp || showSkinsWagerHelp) && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="text-[10px] text-secondaryText/90 font-medium leading-relaxed overflow-hidden pt-3 pl-15"
                                    >
                                        {format === 'skins'
                                            ? (potMode
                                                ? "Every player contributes this amount to the final pot. The player with the most skins at the end wins it all."
                                                : "The cash value for each individual skin. At the end, losers pay winners based on the skin difference.")
                                            : (
                                                <>
                                                    <p className="mb-1.5 opacity-80 italic">This amount is wagered across three separate matches:</p>
                                                    <div className="grid grid-cols-1 gap-1 pl-2 border-l border-white/10">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-1 rounded-full bg-neonGreen/40" />
                                                            <span>Front 9: <span className="text-white font-bold">"${wager}"</span></span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-1 rounded-full bg-neonGreen/40" />
                                                            <span>Back 9: <span className="text-white font-bold">"${wager}"</span></span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1 h-1 rounded-full bg-neonGreen/40" />
                                                            <span>Overall 18: <span className="text-white font-bold">"${wager}"</span></span>
                                                        </div>
                                                    </div>
                                                </>
                                            )
                                        }
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* ── Blood Coin Wager Panel ──────────── */}
                        <div id="blood-coins-wager" className="p-5 border-b border-borderColor/30 relative overflow-hidden">
                            {bloodCoinWager > 0 && (
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-bloodRed/8 rounded-full blur-3xl pointer-events-none" />
                            )}
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all duration-300 ${bloodCoinWager > 0 ? 'bg-bloodRed/15 border-bloodRed/30 shadow-[0_0_20px_rgba(255,0,63,0.15)]' : 'bg-surface border-borderColor/30'}`}>
                                        <BloodCoin className="w-7 h-7" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`font-black text-sm uppercase tracking-tight transition-colors ${bloodCoinWager > 0 ? 'text-bloodRed' : 'text-white'}`}>
                                            Blood Coins
                                        </span>
                                        <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">
                                            {bloodCoinWager > 0
                                                ? (format === 'skins' && potMode
                                                    ? `Coin Pot: 🪙 ${bloodCoinWager * (playerCount + 1)}`
                                                    : 'Virtual Side Wager')
                                                : 'Tap + to Add Coin Wager'
                                            }
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { killTour(); setBloodCoinWager(Math.max(0, bloodCoinWager - 50)); }}
                                        className="w-9 h-9 rounded-full border border-borderColor hover:border-bloodRed hover:text-bloodRed flex items-center justify-center transition-all text-lg font-bold active:scale-90"
                                    >−</button>
                                    <span className={`text-2xl font-black min-w-[4rem] text-center tabular-nums flex items-center justify-center transition-colors ${bloodCoinWager > 0 ? 'text-bloodRed drop-shadow-[0_0_10px_rgba(255,0,63,0.3)]' : 'text-secondaryText'}`}>
                                        {bloodCoinWager}
                                    </span>
                                    <button
                                        onClick={() => { killTour(); setBloodCoinWager(bloodCoinWager + 50); }}
                                        className="w-9 h-9 rounded-full border border-borderColor hover:border-neonGreen hover:text-neonGreen flex items-center justify-center transition-all text-lg font-bold active:scale-90"
                                    >+</button>
                                </div>
                            </div>
                        </div>

                        {/* Trash Bets Trigger */}
                        <button
                            id="trash-bets-btn"
                            onClick={() => { killTour(); setTrashOpen(true); }}
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

                    <BottomSheet open={trashOpen} onClose={() => setTrashOpen(false)} title="Trash & Side Bets" className="z-[10001]">
                        <div className="divide-y divide-borderColor/50 px-2">
                            {[
                                { id: 'greenies', label: 'Greenies', sub: 'Closest to pin, par+', desc: 'Awarded to the player whose tee shot is closest to the pin on a Par 3, provided they make par or better.', state: greenies, set: setGreenies, skinsOnly: false },
                                { id: 'sandies', label: 'Sandies', sub: 'Par+ from bunker', desc: 'Awarded to a player who makes par or better on a hole where they hit into a sand bunker.', state: sandies, set: setSandies, skinsOnly: false },
                                { id: 'snake', label: 'Snake', sub: '3-putt penalty', desc: 'The last player to 3-putt holds the snake. They owe the other players the trash value at the end of the round.', state: snake, set: setSnake, skinsOnly: false },
                                { id: 'autopress', label: 'Auto Press', sub: 'Press when 2 down', desc: 'Automatically triggers a new parallel bet for the remaining holes whenever a team falls 2 points behind.', state: autoPress, set: setAutoPress, nassauOnly: true },
                                { id: 'birdies', label: 'Birdies Double', sub: 'Gross Birdie = 2 pts', desc: 'A gross birdie wins the hole outright by immediately granting 2 points instead of 1 in the Match Play score. Net birdies from handicap strokes do not qualify.', state: birdiesDouble, set: setBirdiesDouble, nassauOnly: true },
                                { id: 'bonusSkins', label: 'Bonus Skins', sub: 'Pin (+1) · Birdie (+1) · Eagle (+2)', desc: 'Adds extra skins to the pot for feats: closest to pin (+1), gross birdie (+1), gross eagle (+2).', state: bonusSkins, set: setBonusSkins, skinsOnly: true },
                            ].filter(item => {
                                if ((item as any).skinsOnly) return format === 'skins';
                                if ((item as any).nassauOnly) return format !== 'skins' && scoringType !== 'stroke_play';
                                return true;
                            }).map((item) => (
                                <div key={item.id} className="flex flex-col p-4">
                                    <div className="flex items-center justify-between">
                                        <div
                                            className="flex flex-col cursor-pointer group pr-4"
                                            onClick={() => toggleTrashTooltip(item.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm block text-white uppercase tracking-tight group-hover:text-bloodRed transition-colors">{item.label}</span>
                                                <Info className="w-3.5 h-3.5 text-secondaryText group-hover:text-bloodRed transition-colors" />
                                            </div>
                                            <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">{item.sub}</span>
                                        </div>
                                        <Toggle checked={item.state} onCheckedChange={item.set} />
                                    </div>
                                    <AnimatePresence>
                                        {activeTrashTooltip === item.id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="text-xs text-secondaryText/90 font-medium leading-relaxed overflow-hidden"
                                            >
                                                {item.desc}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}

                            <div className="flex items-center justify-between p-4 bg-bloodRed/5 mt-2 rounded-2xl border border-bloodRed/10">
                                <div>
                                    <span className="font-bold text-sm block text-white uppercase tracking-tight">Trash Value</span>
                                    <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">Payout per dot</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setTrashValue((v: number) => Math.max(5, v - 5))} className="w-8 h-8 rounded-full border border-borderColor flex items-center justify-center">-</button>
                                    <span className="text-lg font-black w-10 text-center tabular-nums">${trashValue}</span>
                                    <button onClick={() => setTrashValue((v: number) => v + 5)} className="w-8 h-8 rounded-full border border-borderColor flex items-center justify-center">+</button>
                                </div>
                            </div>

                            <div className="pt-6 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-bloodRed px-4">Side Contests</span>
                            </div>

                            {[
                                { id: 'par3', label: 'Par 3 Contest', sub: 'Lowest gross on par 3s', desc: 'The golfer with the lowest combined score for all Par 3 holes is the winner.', state: par3Contest, set: setPar3Contest, pot: par3Pot, setPot: setPar3Pot },
                                { id: 'par5', label: 'Par 5 Contest', sub: 'Lowest gross on par 5s', desc: 'The golfer with the lowest combined score for all Par 5 holes is the winner.', state: par5Contest, set: setPar5Contest, pot: par5Pot, setPot: setPar5Pot }
                            ].map(item => (
                                <div key={item.id} className="flex flex-col p-4">
                                    <div className="flex items-center justify-between">
                                        <div
                                            className="flex flex-col cursor-pointer group pr-4"
                                            onClick={() => toggleTrashTooltip(item.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm block text-white uppercase tracking-tight group-hover:text-bloodRed transition-colors">{item.label}</span>
                                                <Info className="w-3.5 h-3.5 text-secondaryText group-hover:text-bloodRed transition-colors" />
                                            </div>
                                            <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">{item.sub}</span>
                                        </div>
                                        <Toggle checked={item.state} onCheckedChange={(val) => item.set(val)} />
                                    </div>

                                    <AnimatePresence>
                                        {(activeTrashTooltip === item.id || item.state) && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                                className="text-xs text-secondaryText/90 font-medium leading-relaxed overflow-hidden"
                                            >
                                                {activeTrashTooltip === item.id && <p className="mb-3">{item.desc}</p>}
                                                {item.state && (
                                                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                                        <span className="text-[10px] font-black uppercase text-secondaryText">Pot Value</span>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => item.setPot((v: number) => Math.max(5, v - 5))} className="w-6 h-6 rounded-full border border-borderColor flex items-center justify-center text-xs">-</button>
                                                            <span className="text-sm font-black w-8 text-center tabular-nums">${item.pot}</span>
                                                            <button onClick={() => item.setPot((v: number) => v + 5)} className="w-6 h-6 rounded-full border border-borderColor flex items-center justify-center text-xs">+</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 pt-0 relative">
                            <Button className="w-full uppercase font-black tracking-widest relative" onClick={() => setTrashOpen(false)}>
                                Done
                            </Button>
                        </div>
                    </BottomSheet>
                </section>
            </div>
        </motion.div>
    );
}
