import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Trophy, Trash2, ExternalLink, Loader2, Users, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

interface AdminMatch {
    id: string;
    join_code: string;
    format: string;
    wager_amount: number;
    wager_type: string;
    status: string;
    created_at: string;
    courses: { name: string } | null;
    profiles: { full_name: string } | null;
}

export default function MatchManagement() {
    const [matches, setMatches] = useState<AdminMatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchMatches();
    }, []);

    async function fetchMatches() {
        setLoading(true);
        const { data, error } = await supabase
            .from('matches')
            .select(`
                id,
                join_code,
                format,
                wager_amount,
                wager_type,
                status,
                created_at,
                courses:course_id ( name ),
                profiles:created_by ( full_name )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching matches:', error);
        } else if (data) {
            setMatches(data as any[]);
        }
        setLoading(false);
    }

    async function deleteMatch(id: string) {
        if (!window.confirm('Are you sure you want to delete this match? This will remove all scores and presses associated with it.')) return;

        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', id);

        if (!error) {
            setMatches((prev: AdminMatch[]) => prev.filter((m: AdminMatch) => m.id !== id));
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!window.confirm(`⚠️ WARNING: You are about to delete ${count} matches. This action is permanent and will remove all associated scoring data. Proceed?`)) return;

        const { error } = await supabase
            .from('matches')
            .delete()
            .in('id', Array.from(selectedIds));

        if (error) {
            console.error('Error bulk deleting matches:', error);
            alert('Failed to delete some matches: ' + error.message);
        } else {
            setMatches(prev => prev.filter(m => !selectedIds.has(m.id)));
            setSelectedIds(new Set());
        }
    }

    function toggleSelect(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    }

    function toggleSelectAll() {
        if (selectedIds.size === matches.length && matches.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(matches.map(m => m.id)));
        }
    }

    return (
        <div className="space-y-6">
            <header className="px-2 flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">Match Oversight</h2>
                    <p className="text-xs text-secondaryText font-bold uppercase tracking-wider">Monitor and manage all active rounds</p>
                </div>
                {matches.length > 0 && (
                    <button
                        onClick={toggleSelectAll}
                        className="text-[10px] font-black uppercase tracking-widest text-bloodRed hover:text-white transition-colors px-2 py-1"
                    >
                        {selectedIds.size === matches.length ? 'Deselect All' : 'Select All'}
                    </button>
                )}
            </header>

            <section className="space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-secondaryText">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Loading Matches...</span>
                    </div>
                ) : matches.length > 0 ? (
                    matches.map((match: AdminMatch) => (
                        <Card key={match.id} className={`p-4 group transition-all ${selectedIds.has(match.id) ? 'border-bloodRed bg-bloodRed/5' : 'hover:border-bloodRed/50'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleSelect(match.id)}
                                        className={`transition-colors ${selectedIds.has(match.id) ? 'text-bloodRed' : 'text-secondaryText hover:text-white'}`}
                                    >
                                        {selectedIds.has(match.id) ? <CheckCircle2 className="w-5 h-5 shadow-[0_0_10px_rgba(255,0,63,0.3)]" /> : <Circle className="w-5 h-5 opacity-20" />}
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <Trophy className={`w-4 h-4 ${match.status === 'in_progress' ? 'text-neonGreen' : 'text-secondaryText'}`} />
                                        <span className="text-sm font-black text-white">{match.courses?.name ?? 'Unknown Course'}</span>
                                    </div>
                                </div>
                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${match.status === 'in_progress'
                                    ? 'bg-neonGreen/10 text-neonGreen border-neonGreen/20'
                                    : match.status === 'completed'
                                        ? 'bg-white/10 text-white border-white/20'
                                        : 'bg-surfaceHover text-secondaryText border-borderColor'
                                    }`}>
                                    {match.status}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-secondaryText font-bold uppercase tracking-wider mb-4">
                                <Users className="w-3 h-3" />
                                Created by {match.profiles?.full_name ?? 'Unknown'} • {new Date(match.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-borderColor/30">
                                <div className="flex gap-4">
                                    <div className="text-left">
                                        <span className="block text-[8px] text-secondaryText font-black uppercase tracking-widest">Join Code</span>
                                        <span className="text-xs font-bold text-bloodRed">{match.join_code}</span>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-[8px] text-secondaryText font-black uppercase tracking-widest">Wager</span>
                                        <span className="text-xs font-bold text-white">${match.wager_amount}</span>
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-[8px] text-secondaryText font-black uppercase tracking-widest">Format</span>
                                        <span className="text-xs font-bold text-white">{match.format.toUpperCase()}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => window.open(`/history/${match.id}`, '_blank')}
                                        className="p-2 text-secondaryText hover:text-white transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteMatch(match.id)}
                                        className="p-2 text-secondaryText hover:text-bloodRed transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-12 bg-surface rounded-2xl border border-borderColor border-dashed">
                        <p className="text-sm text-secondaryText font-bold">No matches found in the system</p>
                    </div>
                )}
            </section>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface border-t border-bloodRed shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-4 z-[100] animate-in slide-in-from-bottom-full duration-300 flex items-center justify-between backdrop-blur-md bg-opacity-95">
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm uppercase tracking-tight">{selectedIds.size} Matches Selected</span>
                        <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">Bulk Management</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] py-1 h-8"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="bg-bloodRed hover:bg-bloodRed/80 text-[10px] py-1 h-8 flex items-center gap-2"
                            onClick={handleBulkDelete}
                        >
                            <Trash2 className="w-3 h-3" />
                            Delete
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
