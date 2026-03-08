import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { useState } from 'react';

interface MatchStrokesStepProps {
    format: string;
    matchSlots: any[];
    poolPlayers: any[];
    user: any;
    profile: any;
    creatorHcp: number;
    addMatchSlot: (wager: number) => void;
    removeMatchSlot: (id: string) => void;
    setSlotPlayer1: (slotId: string, id: string) => void;
    setSlotOpponent: (slotId: string, id: string) => void;
    setSlotStrokes: (slotId: string, strokes: number) => void;
    stagedPlayers: any[];
    initials: string;
    teamStrokeOverride: number | undefined;
    setTeamStrokeOverride: (val: number | undefined) => void;
    killTour: () => void;
}

export function MatchStrokesStep({
    format,
    matchSlots,
    poolPlayers,
    user,
    profile,
    creatorHcp,
    addMatchSlot,
    removeMatchSlot,
    setSlotPlayer1,
    setSlotOpponent,
    setSlotStrokes,
    stagedPlayers,
    initials,
    teamStrokeOverride,
    setTeamStrokeOverride,
    killTour
}: MatchStrokesStepProps) {
    const [tooltips, setTooltips] = useState<Record<string, { strokes?: boolean }>>({});

    const toggleTooltip = (slotId: string) => {
        setTooltips(prev => ({
            ...prev,
            [slotId]: { strokes: !prev[slotId]?.strokes }
        }));
    };

    return (
        <motion.div
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
                        {poolPlayers.length > 1 && matchSlots.length < poolPlayers.length && (
                            <button
                                id="add-match-btn"
                                onClick={() => addMatchSlot(10)}
                                className="flex items-center gap-1.5 text-xs font-black text-neonGreen uppercase tracking-tighter hover:opacity-80 transition-opacity p-1 px-2 border border-neonGreen/20 rounded-lg bg-neonGreen/5"
                            >
                                <Plus className="w-3 h-3" />
                                <span>Add Match</span>
                            </button>
                        )}
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
                                        {matchSlots.length > 1 && (
                                            <button onClick={() => removeMatchSlot(slot.id)} className="p-1 text-secondaryText hover:text-bloodRed transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="p-4 flex flex-col gap-4">
                                        <div className="flex items-center justify-between gap-3">
                                            {/* Player 1 Selection */}
                                            <div className="flex-1 flex flex-col items-center gap-2">
                                                <select
                                                    className={`w-full h-12 px-4 rounded-xl bg-background border transition-colors text-center text-sm font-bold appearance-none ${slot.player1Id ? 'border-neonGreen/50 text-white' : 'border-borderColor text-secondaryText'}`}
                                                    value={slot.player1Id || user?.id || ''}
                                                    onChange={(e) => setSlotPlayer1(slot.id, e.target.value)}
                                                    onFocus={killTour}
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
                                                    onFocus={killTour}
                                                >
                                                    <option value="">Select Opponent</option>
                                                    {poolPlayers.map((p) => (
                                                        <option key={p.userId} value={p.userId}>{p.fullName}</option>
                                                    ))}
                                                </select>
                                                <span className="text-xs font-bold text-secondaryText uppercase text-center w-full truncate">Opponent</span>
                                            </div>
                                        </div>

                                        {/* Strokes Badge */}
                                        {slot.opponentId && (
                                            <div className="pt-3 flex flex-col items-center gap-1.5">
                                                {(() => {
                                                    const p1Id = slot.player1Id || user?.id;
                                                    const p1 = p1Id === user?.id ? { handicap: creatorHcp } : poolPlayers.find(p => p.userId === p1Id);
                                                    const opp = poolPlayers.find((p) => p.userId === slot.opponentId);
                                                    const calcStrokes = (p1 && opp) ? Math.round(p1.handicap - opp.handicap) : 0;
                                                    const strokes = slot.strokeOverride !== undefined ? slot.strokeOverride : calcStrokes;
                                                    const label = strokes > 0 ? `+ ${strokes} ` : strokes < 0 ? `${strokes} ` : 'Even';
                                                    const isEven = strokes === 0;
                                                    return (
                                                        <>
                                                            <div id="strokes-adjustment" className="tour-strokes-section flex items-center gap-3">
                                                                <button
                                                                    onClick={() => { killTour(); setSlotStrokes(slot.id, strokes - 1); }}
                                                                    className="w-8 h-8 rounded-full border border-borderColor/50 hover:border-bloodRed hover:text-bloodRed flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                                                                >−</button>
                                                                <div className={`px-5 py-2 rounded-full border-2 flex items-center gap-2 transition-all ${isEven ? 'border-borderColor/50 bg-surface' : 'border-neonGreen/40 bg-neonGreen/5 shadow-[0_0_12px_rgba(0,255,102,0.15)]'}`}>
                                                                    <span className={`text-2xl font-black tabular-nums tracking-tight transition-colors ${isEven ? 'text-secondaryText' : 'text-neonGreen'}`}>{label}</span>
                                                                    <span className="text-[9px] font-bold text-secondaryText uppercase tracking-wider">strokes</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => { killTour(); setSlotStrokes(slot.id, strokes + 1); }}
                                                                    className="w-8 h-8 rounded-full border border-borderColor/50 hover:border-neonGreen hover:text-neonGreen flex items-center justify-center text-sm font-bold transition-all active:scale-90"
                                                                >+</button>
                                                            </div>
                                                            <button
                                                                onClick={() => toggleTooltip(slot.id)}
                                                                className="flex items-center gap-1 text-[9px] text-secondaryText/60 hover:text-secondaryText transition-colors"
                                                            >
                                                                <Info className="w-3 h-3" />
                                                                <span>Based on handicap differential</span>
                                                            </button>
                                                            <AnimatePresence>
                                                                {tooltips[slot.id]?.strokes && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, height: 0 }}
                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        className="text-[9px] text-secondaryText/70 font-medium leading-relaxed text-center max-w-[200px] overflow-hidden"
                                                                    >
                                                                        Strokes spotted to the higher handicap player based on the exact Course Handicap differential.
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </>
                                                    );
                                                })()}
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
                                    <span className="text-[10px] font-black text-neonGreen/60">({creatorHcp})</span>
                                </div>
                                {stagedPlayers.filter((p) => p.team === 'A').map((p) => (
                                    <div key={p.userId} className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-neonGreen/10 border border-neonGreen/20 flex items-center justify-center text-neonGreen font-bold text-xs">
                                            {p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                        </div>
                                        <span className="text-xs font-bold truncate">{p.fullName.split(' ')[0]}</span>
                                        <span className="text-[10px] font-black text-neonGreen/60">({p.handicap})</span>
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
                                                {p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                            </div>
                                            <span className="text-xs font-bold truncate">{p.fullName.split(' ')[0]}</span>
                                            <span className="text-[10px] font-black text-bloodRed/60">({p.handicap})</span>
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
                            const teamAExact = creatorHcp + (partnerA?.handicap ?? 0);
                            const teamBExact = teamB.reduce((sum, p) => sum + p.handicap, 0);
                            const calcDiff = Math.round(teamAExact - teamBExact); // signed: positive = Team A has higher hcp
                            const effectiveDiff = teamStrokeOverride !== undefined ? teamStrokeOverride : calcDiff;
                            const absDiff = Math.abs(effectiveDiff);
                            const nameA = 'Team A';
                            const nameB = 'Team B';
                            if (absDiff === 0) return (
                                <div className="p-3 border-t border-borderColor/50 text-center bg-surfaceHover/10">
                                    <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest flex items-center justify-center gap-1">
                                        Scratch Match •
                                        <button onClick={() => { killTour(); setTeamStrokeOverride(effectiveDiff - 1); }} className="w-5 h-5 rounded bg-surfaceHover flex items-center justify-center text-xs hover:text-bloodRed">−</button>
                                        <span className="text-sm text-bloodRed">{absDiff}</span>
                                        <button onClick={() => { killTour(); setTeamStrokeOverride(effectiveDiff + 1); }} className="w-5 h-5 rounded bg-surfaceHover flex items-center justify-center text-xs hover:text-neonGreen">+</button>
                                        Strokes Given
                                    </span>
                                </div>
                            );
                            const spottedName = effectiveDiff > 0 ? nameA : nameB;
                            const spottingName = effectiveDiff > 0 ? nameB : nameA;
                            return (
                                <div className="p-4 bg-gradient-to-b from-transparent to-bloodRed/[0.03] border-t border-borderColor/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="text-center flex-1">
                                            <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest block">Combined HCP</span>
                                            <span className="text-sm font-black text-neonGreen">{teamAExact.toFixed(1)}</span>
                                        </div>
                                        <div className="w-[1px] h-6 bg-borderColor/50" />
                                        <div className="text-center flex-1">
                                            <span className="text-[10px] text-secondaryText font-black uppercase tracking-widest block">Combined HCP</span>
                                            <span className="text-sm font-black text-bloodRed">{teamBExact.toFixed(1)}</span>
                                        </div>
                                    </div>
                                    <div id="team-strokes-adjustment" className="tour-strokes-section bg-background/80 rounded-xl p-3 border border-bloodRed/20 flex items-center justify-center shadow-[0_4px_12px_rgba(255,0,63,0.1)]">
                                        <p className="text-xs font-black uppercase tracking-widest text-white text-center flex items-center justify-center gap-1">
                                            {spottingName} spots {spottedName}
                                            <button onClick={() => { killTour(); setTeamStrokeOverride(effectiveDiff > 0 ? effectiveDiff - 1 : effectiveDiff + 1); }} className="w-5 h-5 rounded bg-surfaceHover flex items-center justify-center text-xs hover:text-bloodRed shrink-0">−</button>
                                            <span className="text-sm text-bloodRed px-1">{absDiff}</span>
                                            <button onClick={() => { killTour(); setTeamStrokeOverride(effectiveDiff > 0 ? effectiveDiff + 1 : effectiveDiff - 1); }} className="w-5 h-5 rounded bg-surfaceHover flex items-center justify-center text-xs hover:text-neonGreen shrink-0">+</button>
                                            stroke{absDiff !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>
                </section>
            )}
        </motion.div>
    );
}
