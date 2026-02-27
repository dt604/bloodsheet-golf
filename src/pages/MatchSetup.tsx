import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Settings2, Plus, Minus, X, Search, Loader, Swords } from 'lucide-react';
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
    const format = useMatchStore((s) => s.pendingFormat);
    const setFormat = useMatchStore((s) => s.setPendingFormat);

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

    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

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

        const sideBets = { greenies, sandies, snake, autoPress, birdiesDouble, trashValue, startingHole, par3Contest, par3Pot, par5Contest, par5Pot };

        setCreating(true);
        setError('');
        try {
            if (format === '1v1') {
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

    // ── Tee Off button disabled logic ─────────────────────────
    const teeOffDisabled = creating || !selectedCourse || (
        format === '1v1'
            ? matchSlots.every((s) => s.opponentId === null || (s.player1Id ?? user?.id) === s.opponentId)
            : stagedPlayers.filter((p) => p.team === 'B').length === 0
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor shrink-0">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <span className="font-bold text-lg tracking-wide uppercase">Setup Match</span>
                    <span className="block text-[10px] text-bloodRed font-black tracking-[0.2em] uppercase -mt-1">BLOODSHEET GOLF</span>
                </div>
                <div className="w-10" />
            </header>

            <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-8">

                {/* ── Format Toggle ──────────────────────────── */}
                <section>
                    <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider mb-2">Format</div>
                    <div className="flex border border-borderColor rounded-xl overflow-hidden">
                        <button
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${format === '1v1' ? 'bg-bloodRed text-white' : 'text-secondaryText hover:bg-surfaceHover'}`}
                            onClick={() => setFormat('1v1')}
                        >
                            1v1 Match
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-bold transition-colors border-l border-borderColor ${format === '2v2' ? 'bg-bloodRed text-white' : 'text-secondaryText hover:bg-surfaceHover'}`}
                            onClick={() => setFormat('2v2')}
                        >
                            2v2 Match
                        </button>
                    </div>
                </section>

                {/* ════════════════════════════════════════════
                    1v1 MODE — Player Pool + Match Slots
                    ════════════════════════════════════════════ */}
                {format === '1v1' && (
                    <>
                        {/* Who's Playing Today */}
                        <section>
                            <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider mb-2">
                                Who's Playing Today?
                            </div>
                            <Card className="overflow-hidden">
                                {/* Creator row — always first */}
                                <div className="p-4 border-b border-borderColor/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-inner">
                                            {profile?.avatarUrl
                                                ? <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                : initials}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm block">{profile?.fullName ?? 'You'}</span>
                                            <span className="text-[9px] text-neonGreen tracking-widest font-black uppercase mt-0.5">You (Creator)</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center bg-surfaceHover/50 rounded-xl p-1 border border-borderColor/30 backdrop-blur-sm">
                                        <button
                                            className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-bloodRed transition-all rounded-lg active:bg-bloodRed/20 active:scale-95"
                                            onClick={() => setCreatorHcp(Number(Math.max(0, creatorHcp - 1).toFixed(1)))}
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <div className="w-10 flex flex-col items-center justify-center">
                                            <span className="text-sm font-black leading-none">{creatorHcp}</span>
                                            <span className="text-[8px] text-secondaryText font-bold uppercase tracking-wider mt-0.5">HCP</span>
                                        </div>
                                        <button
                                            className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-neonGreen transition-all rounded-lg active:bg-neonGreen/20 active:scale-95"
                                            onClick={() => setCreatorHcp(Number((creatorHcp + 1).toFixed(1)))}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Pool players */}
                                {poolPlayers.map((p) => (
                                    <div key={p.userId} className="p-4 border-b border-borderColor/50 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-inner">
                                                {p.avatarUrl
                                                    ? <img src={p.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                    : p.fullName.slice(0, 1).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="font-bold text-sm block">{p.fullName}</span>
                                                <span className="text-[9px] text-secondaryText tracking-widest font-black uppercase mt-0.5">Group</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-surfaceHover/50 rounded-xl p-1 border border-borderColor/30 backdrop-blur-sm">
                                                <button
                                                    className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-bloodRed transition-all rounded-lg active:bg-bloodRed/20 active:scale-95"
                                                    onClick={() => updatePoolPlayerHandicap(p.userId, Number(Math.max(0, p.handicap - 1).toFixed(1)))}
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </button>
                                                <div className="w-10 flex flex-col items-center justify-center">
                                                    <span className="text-sm font-black leading-none">{p.handicap}</span>
                                                    <span className="text-[8px] text-secondaryText font-bold uppercase tracking-wider mt-0.5">HCP</span>
                                                </div>
                                                <button
                                                    className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-neonGreen transition-all rounded-lg active:bg-neonGreen/20 active:scale-95"
                                                    onClick={() => updatePoolPlayerHandicap(p.userId, Number((p.handicap + 1).toFixed(1)))}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <button
                                                className="w-8 h-8 flex items-center justify-center rounded-full bg-bloodRed/10 text-bloodRed hover:bg-bloodRed hover:text-white transition-all border border-bloodRed/20"
                                                onClick={() => removePoolPlayer(p.userId)}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add to pool button */}
                                <button
                                    className="w-full p-4 flex items-center justify-center gap-2 hover:bg-surfaceHover transition-colors text-secondaryText hover:text-white group"
                                    onClick={() => navigate('/add-player?pool=1')}
                                >
                                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Add Player to Group</span>
                                </button>
                            </Card>
                        </section>

                        {/* Match Slots */}
                        <section>
                            <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider mb-2">Matches</div>
                            <div className="space-y-3">
                                {matchSlots.map((slot, idx) => {
                                    // All players available today: creator + pool
                                    const allPlayers = [
                                        { userId: user!.id, fullName: profile?.fullName ?? 'You', handicap: creatorHcp, isGuest: false as boolean | undefined },
                                        ...poolPlayers,
                                    ];

                                    // Effective player1 id (null = creator)
                                    const p1Id = slot.player1Id ?? user!.id;
                                    const player1 = allPlayers.find((p) => p.userId === p1Id);
                                    const opponent = allPlayers.find((p) => p.userId === slot.opponentId);

                                    // Only restriction: the two sides of a single match can't be the same player
                                    const availableForP1 = allPlayers.filter((p) => p.userId !== slot.opponentId);
                                    const availableForP2 = allPlayers.filter((p) => p.userId !== p1Id);

                                    const p1Hcp = player1?.handicap ?? creatorHcp;
                                    const p2Hcp = opponent?.handicap ?? 0;
                                    const diff = opponent ? Math.abs(Math.round(p1Hcp) - Math.round(p2Hcp)) : 0;
                                    const spottedName = opponent && Math.round(p1Hcp) > Math.round(p2Hcp)
                                        ? (player1?.fullName.split(' ')[0] ?? 'P1')
                                        : (opponent?.fullName.split(' ')[0] ?? '');
                                    const spottingName = opponent && Math.round(p1Hcp) > Math.round(p2Hcp)
                                        ? (opponent.fullName.split(' ')[0])
                                        : (player1?.fullName.split(' ')[0] ?? 'P1');

                                    return (
                                        <Card key={slot.id} className="overflow-hidden">
                                            <div className="p-3 border-b border-borderColor/50 flex items-center justify-between bg-surfaceHover/30">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-secondaryText">
                                                    Match {idx + 1}
                                                </span>
                                                {matchSlots.length > 1 && (
                                                    <button
                                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-bloodRed/10 text-bloodRed hover:bg-bloodRed hover:text-white transition-all"
                                                        onClick={() => removeMatchSlot(slot.id)}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="p-4 space-y-3">
                                                {/* Player 1 vs Player 2 picker — both dropdowns */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1">
                                                        {allPlayers.length < 2 ? (
                                                            <span className="text-xs text-secondaryText italic">Add players above first</span>
                                                        ) : (
                                                            <select
                                                                value={p1Id}
                                                                onChange={(e) => setSlotPlayer1(slot.id, e.target.value === user!.id ? null : e.target.value)}
                                                                className="w-full bg-surfaceHover border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-bloodRed"
                                                            >
                                                                {availableForP1.map((p) => (
                                                                    <option key={p.userId} value={p.userId}>
                                                                        {p.userId === user!.id ? `${p.fullName} (You)` : p.fullName}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                    <Swords className="w-4 h-4 text-bloodRed shrink-0" />
                                                    <div className="flex-1">
                                                        {allPlayers.length < 2 ? (
                                                            <span className="text-xs text-secondaryText italic"> </span>
                                                        ) : (
                                                            <select
                                                                value={slot.opponentId ?? ''}
                                                                onChange={(e) => setSlotOpponent(slot.id, e.target.value || null)}
                                                                className="w-full bg-surfaceHover border border-borderColor rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-bloodRed"
                                                            >
                                                                <option value="">Select opponent</option>
                                                                {availableForP2.map((p) => (
                                                                    <option key={p.userId} value={p.userId}>
                                                                        {p.userId === user!.id ? `${p.fullName} (You)` : p.fullName}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Handicap differential callout */}
                                                {opponent && (
                                                    <div className="bg-background/80 rounded-xl p-2.5 border border-borderColor/50">
                                                        {diff === 0 ? (
                                                            <p className="text-xs text-secondaryText font-semibold text-center">
                                                                Even — no strokes given
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs font-black uppercase tracking-wider text-neonGreen text-center drop-shadow-[0_0_8px_rgba(0,255,102,0.5)]">
                                                                {spottingName} spots {spottedName} <span className="text-sm px-1">{diff}</span> stroke{diff !== 1 ? 's' : ''}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Per-slot wager */}
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-xs font-semibold text-secondaryText uppercase tracking-wider">Wager</span>
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => setSlotWager(slot.id, Math.max(5, slot.wager - 5))}
                                                            className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-bloodRed transition-colors"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="text-xl font-bold w-12 text-center">${slot.wager}</span>
                                                        <button
                                                            onClick={() => setSlotWager(slot.id, slot.wager + 5)}
                                                            className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-xl hover:text-neonGreen transition-colors"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}

                                {matchSlots.length < 5 && poolPlayers.length > 0 && (
                                    <button
                                        className="w-full p-3 border border-dashed border-borderColor rounded-xl flex items-center justify-center gap-2 hover:border-bloodRed hover:text-white transition-colors text-secondaryText group"
                                        onClick={() => addMatchSlot(matchSlots[matchSlots.length - 1]?.wager ?? wager)}
                                    >
                                        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Add Another Match</span>
                                    </button>
                                )}
                            </div>
                        </section>
                    </>
                )}

                {/* ════════════════════════════════════════════
                    2v2 MODE — Existing team-based player setup
                    ════════════════════════════════════════════ */}
                {format === '2v2' && (
                    <section>
                        <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider mb-2">Players</div>
                        <Card className="overflow-hidden">
                            {/* Team A creator */}
                            <div className="p-4 border-b border-borderColor/50 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-inner">
                                            {profile?.avatarUrl
                                                ? <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                : initials}
                                        </div>
                                        <div>
                                            <span className="font-bold text-sm block">{profile?.fullName ?? 'You'}</span>
                                            <span className="text-[9px] text-secondaryText tracking-widest font-black uppercase mt-0.5">Team A</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center bg-surfaceHover/50 rounded-xl p-1 border border-borderColor/30 backdrop-blur-sm">
                                        <button
                                            className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-bloodRed transition-all rounded-lg active:bg-bloodRed/20 active:scale-95"
                                            onClick={() => setCreatorHcp(Number(Math.max(0, creatorHcp - 1).toFixed(1)))}
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <div className="w-10 flex flex-col items-center justify-center">
                                            <span className="text-sm font-black leading-none">{creatorHcp}</span>
                                            <span className="text-[8px] text-secondaryText font-bold uppercase tracking-wider mt-0.5">HCP</span>
                                        </div>
                                        <button
                                            className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-neonGreen transition-all rounded-lg active:bg-neonGreen/20 active:scale-95"
                                            onClick={() => setCreatorHcp(Number((creatorHcp + 1).toFixed(1)))}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Team A partner slot */}
                            {(() => {
                                const partner = stagedPlayers.find((p) => p.team === 'A');
                                return partner ? (
                                    <div className="p-4 border-b border-borderColor/50 flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-inner">
                                                    {partner.avatarUrl
                                                        ? <img src={partner.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                        : partner.fullName.slice(0, 1).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-sm block">{partner.fullName}</span>
                                                    <span className="text-[9px] text-secondaryText tracking-widest font-black uppercase mt-0.5">Team A</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center bg-surfaceHover/50 rounded-xl p-1 border border-borderColor/30 backdrop-blur-sm">
                                                    <button className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-bloodRed transition-all rounded-lg active:bg-bloodRed/20 active:scale-95" onClick={() => updateStagedPlayerHandicap(partner.userId, Number(Math.max(0, partner.handicap - 1).toFixed(1)))}><Minus className="w-4 h-4" /></button>
                                                    <div className="w-10 flex flex-col items-center justify-center">
                                                        <span className="text-sm font-black leading-none">{partner.handicap}</span>
                                                        <span className="text-[8px] text-secondaryText font-bold uppercase tracking-wider mt-0.5">HCP</span>
                                                    </div>
                                                    <button className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-neonGreen transition-all rounded-lg active:bg-neonGreen/20 active:scale-95" onClick={() => updateStagedPlayerHandicap(partner.userId, Number((partner.handicap + 1).toFixed(1)))}><Plus className="w-4 h-4" /></button>
                                                </div>
                                                <button className="w-8 h-8 flex items-center justify-center rounded-full bg-bloodRed/10 text-bloodRed hover:bg-bloodRed hover:text-white transition-all border border-bloodRed/20" onClick={() => removeStagedPlayer(partner.userId)}><X className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="w-full p-4 border-b border-borderColor/50 flex items-center justify-center gap-2 hover:bg-surfaceHover transition-colors text-secondaryText hover:text-white group" onClick={() => navigate('/add-player?team=A')}>
                                        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Add Teammate</span>
                                    </button>
                                );
                            })()}

                            {/* Team B slots */}
                            {(() => {
                                const teamB = stagedPlayers.filter((p) => p.team === 'B');
                                return (
                                    <>
                                        {teamB.map((opp) => (
                                            <div key={opp.userId} className="p-4 border-b border-borderColor/50 flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold overflow-hidden shrink-0 shadow-inner">
                                                            {opp.avatarUrl ? <img src={opp.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : opp.fullName.slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-sm block">{opp.fullName}</span>
                                                            <span className="text-[9px] text-bloodRed tracking-widest font-black uppercase mt-0.5">Team B</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center bg-surfaceHover/50 rounded-xl p-1 border border-borderColor/30 backdrop-blur-sm">
                                                            <button className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-bloodRed transition-all rounded-lg active:bg-bloodRed/20 active:scale-95" onClick={() => updateStagedPlayerHandicap(opp.userId, Number(Math.max(0, opp.handicap - 1).toFixed(1)))}><Minus className="w-4 h-4" /></button>
                                                            <div className="w-10 flex flex-col items-center justify-center">
                                                                <span className="text-sm font-black leading-none">{opp.handicap}</span>
                                                                <span className="text-[8px] text-secondaryText font-bold uppercase tracking-wider mt-0.5">HCP</span>
                                                            </div>
                                                            <button className="w-8 h-8 flex items-center justify-center text-secondaryText hover:text-neonGreen transition-all rounded-lg active:bg-neonGreen/20 active:scale-95" onClick={() => updateStagedPlayerHandicap(opp.userId, Number((opp.handicap + 1).toFixed(1)))}><Plus className="w-4 h-4" /></button>
                                                        </div>
                                                        <button className="w-8 h-8 flex items-center justify-center rounded-full bg-bloodRed/10 text-bloodRed hover:bg-bloodRed hover:text-white transition-all border border-bloodRed/20" onClick={() => removeStagedPlayer(opp.userId)}><X className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {teamB.length < 2 && (
                                            <button className="w-full p-4 border-b border-borderColor/50 flex items-center justify-center gap-2 hover:bg-surfaceHover transition-colors text-bloodRed hover:text-white group" onClick={() => navigate('/add-player?team=B')}>
                                                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                <span className="text-xs font-bold uppercase tracking-widest">
                                                    {teamB.length === 0 ? 'Add Opponent' : 'Add 2nd Opponent'}
                                                </span>
                                            </button>
                                        )}
                                    </>
                                );
                            })()}

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
                                    <div className="p-3 border-t border-borderColor/50 text-center">
                                        <span className="text-xs text-secondaryText font-semibold">Teams are even — no strokes given</span>
                                    </div>
                                );
                                const spottedName = teamAHcp > teamBHcp ? nameA : nameB;
                                const spottingName = teamAHcp > teamBHcp ? nameB : nameA;
                                return (
                                    <div className="p-4 bg-gradient-to-b from-transparent to-surfaceHover/30">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest text-center flex-1">{nameA} ({teamAHcp})</span>
                                            <span className="text-[10px] text-bloodRed font-black uppercase tracking-widest text-center flex-1">{nameB} ({teamBHcp})</span>
                                        </div>
                                        <div className="bg-background/80 rounded-xl p-3 border border-borderColor flex items-center justify-center">
                                            <p className="text-xs font-black uppercase tracking-widest text-neonGreen text-center drop-shadow-[0_0_8px_rgba(0,255,102,0.5)]">
                                                {spottingName} spots {spottedName} <span className="text-sm px-1">{diff}</span> stroke{diff !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </Card>
                    </section>
                )}

                {/* ── Course Search ─────────────────────────── */}
                <section>
                    <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider mb-2">Location</div>
                    {selectedCourse ? (
                        <Card className="flex items-center p-4 cursor-pointer hover:bg-surfaceHover transition-colors border-bloodRed/30" onClick={() => { setSelectedCourse(null); setCourseResults([]); }}>
                            <MapPin className="w-5 h-5 text-bloodRed mr-3 shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-bold">{selectedCourse.name}</h3>
                                <p className="text-secondaryText text-sm">{selectedCourse.holes.length} holes</p>
                            </div>
                            <span className="text-bloodRed text-sm">Change</span>
                        </Card>
                    ) : (
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondaryText pointer-events-none" />
                                <input
                                    type="text"
                                    className="block w-full pl-9 pr-10 py-3 border border-borderColor rounded-xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-1 focus:ring-bloodRed focus:border-bloodRed text-sm transition-all"
                                    placeholder="Search by course name…"
                                    value={courseQuery}
                                    onChange={(e) => setCourseQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCourseSearch()}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {courseSearching ? (
                                        <Loader className="w-4 h-4 text-bloodRed animate-spin" />
                                    ) : (
                                        <button onClick={handleNearbySearch} className="p-1 px-2 bg-bloodRed/10 rounded-lg text-bloodRed hover:bg-bloodRed/20 transition-colors flex items-center gap-1.5" title="Find courses near me">
                                            <MapPin className="w-3 h-3" />
                                            <span className="text-[10px] font-black uppercase tracking-tighter">Near Me</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {courseError && <p className="text-bloodRed text-xs font-semibold px-1">{courseError}</p>}
                            {courseResults.length > 0 && (
                                <Card className="divide-y divide-borderColor/50 max-h-52 overflow-y-auto">
                                    {courseResults.map((c) => (
                                        <button key={c.id} className="w-full p-3 flex items-center gap-3 hover:bg-surfaceHover transition-colors text-left" onClick={() => { setSelectedCourse(c); setCourseResults([]); }}>
                                            <MapPin className="w-4 h-4 text-bloodRed shrink-0" />
                                            <span className="font-semibold text-sm">{c.name}</span>
                                        </button>
                                    ))}
                                </Card>
                            )}
                        </div>
                    )}
                </section>

                {/* ── Starting Hole ─────────────────────────── */}
                <section>
                    <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider mb-2">Starting Hole</div>
                    <Card className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="font-bold text-sm block">Start Hole</span>
                                <span className="text-xs text-secondaryText">
                                    {startingHole === 1 ? 'Front nine start' : startingHole === 10 ? 'Back nine start' : `Shotgun — Hole ${startingHole}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setStartingHole((h) => Math.max(1, h - 1))} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-bloodRed transition-colors">-</button>
                                <span className="text-2xl font-bold w-10 text-center">{startingHole}</span>
                                <button onClick={() => setStartingHole((h) => Math.min(18, h + 1))} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-neonGreen transition-colors">+</button>
                            </div>
                        </div>
                    </Card>
                </section>

                {/* ── Stakes ───────────────────────────────── */}
                <section>
                    <div className="text-sm font-semibold text-secondaryText uppercase tracking-wider mb-2">The Stakes</div>
                    <Card className="p-4">
                        {/* Base Wager: shown for 2v2; for 1v1 it sets the default for new match slots */}
                        {format === '2v2' && (
                            <div className="flex justify-between items-center mb-4 sm:mb-6">
                                <span className="font-bold font-sans text-sm sm:text-base">Base Wager</span>
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <button onClick={() => setWager(Math.max(5, wager - 5))} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-bloodRed transition-colors">-</button>
                                    <span className="text-2xl sm:text-3xl font-bold w-12 sm:w-16 text-center">${wager}</span>
                                    <button onClick={() => setWager(wager + 5)} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surfaceHover flex items-center justify-center text-xl hover:text-neonGreen transition-colors">+</button>
                                </div>
                            </div>
                        )}

                        {/* Trash Bets — opens bottom sheet */}
                        <button
                            onClick={() => setTrashOpen(true)}
                            className="w-full flex justify-between items-center h-12 px-4 rounded-xl border border-borderColor bg-transparent text-white hover:bg-surfaceHover transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-bloodRed" />
                                <span className="font-semibold text-sm">Configure Trash & Side Bets</span>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-secondaryText rotate-180" />
                        </button>

                        {/* Trash Bets Bottom Sheet */}
                        <BottomSheet open={trashOpen} onClose={() => setTrashOpen(false)} title="Trash & Side Bets">
                            <div className="divide-y divide-borderColor/50">
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Greenies</span><span className="text-xs text-secondaryText">Closest to pin, must make par or better</span></div>
                                    <Toggle checked={greenies} onCheckedChange={setGreenies} />
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Sandies</span><span className="text-xs text-secondaryText">Par or better after being in a bunker</span></div>
                                    <Toggle checked={sandies} onCheckedChange={setSandies} />
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Snake</span><span className="text-xs text-secondaryText">3-putt penalty — last to 3-putt holds it</span></div>
                                    <Toggle checked={snake} onCheckedChange={setSnake} />
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Auto Press</span><span className="text-xs text-secondaryText">Automatically press when 2 down</span></div>
                                    <Toggle checked={autoPress} onCheckedChange={setAutoPress} />
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Birdies Double</span><span className="text-xs text-secondaryText">Net Birdie or better awards 2 points</span></div>
                                    <Toggle checked={birdiesDouble} onCheckedChange={setBirdiesDouble} />
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Trash Value</span><span className="text-xs text-secondaryText">Per-dot payout</span></div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setTrashValue((v) => Math.max(5, v - 5))} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-bloodRed transition-colors">-</button>
                                        <span className="text-lg font-bold w-10 text-center">${trashValue}</span>
                                        <button onClick={() => setTrashValue((v) => v + 5)} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-neonGreen transition-colors">+</button>
                                    </div>
                                </div>

                                {/* Mini Tournaments section */}
                                <div className="px-4 pt-4 pb-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-bloodRed">Mini Tournaments</span>
                                </div>
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Par 3 Contest</span><span className="text-xs text-secondaryText">Lowest gross on par 3s wins • 0 HCP</span></div>
                                    <Toggle checked={par3Contest} onCheckedChange={setPar3Contest} />
                                </div>
                                {par3Contest && (
                                    <div className="flex items-center justify-between p-4 bg-surfaceHover/30">
                                        <div><span className="font-semibold text-sm block text-white">Par 3 Pot</span><span className="text-xs text-secondaryText">Ante per player</span></div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setPar3Pot((v) => Math.max(5, v - 5))} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-bloodRed transition-colors">-</button>
                                            <span className="text-lg font-bold w-10 text-center">${par3Pot}</span>
                                            <button onClick={() => setPar3Pot((v) => v + 5)} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-neonGreen transition-colors">+</button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center justify-between p-4">
                                    <div><span className="font-semibold text-sm block text-white">Par 5 Contest</span><span className="text-xs text-secondaryText">Lowest gross on par 5s wins • 0 HCP</span></div>
                                    <Toggle checked={par5Contest} onCheckedChange={setPar5Contest} />
                                </div>
                                {par5Contest && (
                                    <div className="flex items-center justify-between p-4 bg-surfaceHover/30">
                                        <div><span className="font-semibold text-sm block text-white">Par 5 Pot</span><span className="text-xs text-secondaryText">Ante per player</span></div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setPar5Pot((v) => Math.max(5, v - 5))} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-bloodRed transition-colors">-</button>
                                            <span className="text-lg font-bold w-10 text-center">${par5Pot}</span>
                                            <button onClick={() => setPar5Pot((v) => v + 5)} className="w-8 h-8 rounded-full bg-surfaceHover flex items-center justify-center text-lg hover:text-neonGreen transition-colors">+</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </BottomSheet>
                    </Card>
                </section>

                {error && <p className="text-bloodRed text-sm font-semibold px-1">{error}</p>}
            </main>

            {/* Sticky Bottom Action */}
            <div className="p-3 sm:p-4 bg-background/80 backdrop-blur-md border-t border-borderColor shrink-0 pb-safe">
                <Button
                    size="lg"
                    className="w-full h-12 sm:h-14 text-base sm:text-lg uppercase tracking-wider font-bold shadow-[0_0_20px_rgba(255,0,63,0.3)]"
                    onClick={handleStartMatch}
                    disabled={teeOffDisabled}
                >
                    {creating ? 'Creating Match…' : 'Tee Off'}
                </Button>
            </div>
        </div>
    );
}
