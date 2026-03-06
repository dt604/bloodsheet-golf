import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ArrowRight, ArrowLeft, Info } from 'lucide-react';
import { Card } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import { useState } from 'react';

interface PlayerStepProps {
    format: string;
    teamSkins: boolean;
    profile: any;
    initials: string;
    creatorHcp: number;
    setCreatorHcp: (hcp: number) => void;
    stagedPlayers: any[];
    poolPlayers: any[];
    removeStagedPlayer: (id: string) => void;
    updateStagedPlayerHandicap: (id: string, hcp: number) => void;
    updateStagedPlayerTeam: (id: string, team: 'A' | 'B') => void;
    removePoolPlayer: (id: string) => void;
    updatePoolPlayerHandicap: (id: string, hcp: number) => void;
    handleTeamSkinsToggle: (enabled: boolean) => void;
    onAddPlayer: (type: 'pool' | 'teamA' | 'teamB') => void;
    killTour: () => void;
}

export function PlayerStep({
    format,
    teamSkins,
    profile,
    initials,
    creatorHcp,
    setCreatorHcp,
    stagedPlayers,
    poolPlayers,
    removeStagedPlayer,
    updateStagedPlayerHandicap,
    updateStagedPlayerTeam,
    removePoolPlayer,
    updatePoolPlayerHandicap,
    handleTeamSkinsToggle,
    onAddPlayer,
    killTour
}: PlayerStepProps) {
    const [showTeamSkinsHelp, setShowTeamSkinsHelp] = useState(false);

    const isPoolBased = (format === '1v1' || format === 'skins') && !teamSkins;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-black text-white uppercase tracking-wider italic">Who's playing today?</div>
                <span className="text-[10px] font-bold text-secondaryText uppercase tracking-widest bg-surface px-2 py-0.5 rounded-full border border-borderColor">
                    {isPoolBased ? poolPlayers.length + 1 : stagedPlayers.length + 1} Total
                </span>
            </div>

            {/* Team Skins toggle — shown at top of player step for skins format */}
            {format === 'skins' && (
                <div id="team-skins-toggle" className="p-4 rounded-xl border border-borderColor/50 bg-surface/50">
                    <div className="flex items-center justify-between mb-1">
                        <div
                            className="flex flex-col cursor-pointer group"
                            onClick={() => setShowTeamSkinsHelp(!showTeamSkinsHelp)}
                        >
                            <div className="flex items-center gap-2">
                                <span className="font-black text-xs uppercase tracking-tight block text-white group-hover:text-bloodRed transition-colors">Team Skins</span>
                                <Info className="w-3.5 h-3.5 text-secondaryText group-hover:text-bloodRed transition-colors" />
                            </div>
                            <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest">Team A vs Team B · Best ball</span>
                        </div>
                        <Toggle checked={teamSkins} onCheckedChange={handleTeamSkinsToggle} />
                    </div>

                    <AnimatePresence>
                        {showTeamSkinsHelp && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-[10px] text-secondaryText/90 font-medium leading-relaxed overflow-hidden pt-1 italic"
                            >
                                Combines 2v2 team play with Skins rules. Team A and Team B compare their best individual score on each hole. If the hole is tied, the skin carries over to the next hole.
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            <div className="space-y-3">
                {isPoolBased ? (
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
                                            onFocus={(e) => { e.target.select(); killTour(); }}
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
                                                p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
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
                                                    onFocus={(e) => { e.target.select(); killTour(); }}
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

                        {poolPlayers.length < 3 && (
                            <button
                                id="add-players-btn"
                                onClick={() => { killTour(); onAddPlayer('pool'); }}
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
                                                    onFocus={(e) => { e.target.select(); killTour(); }}
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
                                                    {p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
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
                                                            onFocus={(e) => { e.target.select(); killTour(); }}
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
                                        id="add-teammate-btn"
                                        onClick={() => { killTour(); onAddPlayer('teamA'); }}
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
                                                    {p.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
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
                                                            onFocus={(e) => { e.target.select(); killTour(); }}
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
                                        id="add-opponent-btn"
                                        onClick={() => { killTour(); onAddPlayer('teamB'); }}
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
    );
}
