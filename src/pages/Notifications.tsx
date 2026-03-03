import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Bell, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useMatchStore } from '../store/useMatchStore';
import SEO from '../components/SEO';

interface PendingAttestItem {
    matchId: string;
    courseName: string;
    createdAt: string;
}

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<PendingAttestItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        async function loadNotifications() {
            setLoading(true);
            try {
                // Find matches where user is a player, status is pending_attestation, and user hasn't attested yet
                const { data: userMatches } = await supabase
                    .from('match_players')
                    .select('match_id')
                    .eq('user_id', user!.id);

                const matchIds = (userMatches ?? []).map(m => m.match_id);
                if (matchIds.length === 0) {
                    setNotifications([]);
                    return;
                }

                // Get pending matches where user isn't the creator (scorekeeper auto-attests)
                const { data: pendingMatches } = await supabase
                    .from('matches')
                    .select('id, created_at, created_by, courses(name)')
                    .in('id', matchIds)
                    .eq('status', 'pending_attestation')
                    .neq('created_by', user!.id);

                if (!pendingMatches || pendingMatches.length === 0) {
                    setNotifications([]);
                    return;
                }

                const pendingIds = pendingMatches.map(m => m.id);

                // Filter out those already attested by this user
                const { data: attested } = await supabase
                    .from('match_attestations')
                    .select('match_id')
                    .eq('user_id', user!.id)
                    .in('match_id', pendingIds);

                const attestedIds = new Set((attested ?? []).map(a => a.match_id));
                const filtered = pendingMatches
                    .filter(m => !attestedIds.has(m.id))
                    .map(m => ({
                        matchId: m.id,
                        courseName: (m.courses as any)?.name ?? 'Unknown Course',
                        createdAt: m.created_at
                    }));

                setNotifications(filtered);
            } catch (err) {
                console.error('Failed to load notifications:', err);
            } finally {
                setLoading(false);
            }
        }

        loadNotifications();
    }, [user]);

    const handleAttest = (matchId: string) => {
        // Load the match into store and navigate to ledger
        useMatchStore.setState({ matchId, match: null });
        localStorage.setItem('activeMatchId', matchId);
        navigate('/ledger');
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
            <SEO title="Notifications" />
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-background/95 backdrop-blur shrink-0 z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                    <span className="font-bold text-lg tracking-wide uppercase">Notifications</span>
                    <span className="block text-[10px] text-bloodRed font-black tracking-[0.2em] uppercase -mt-1">Inbox</span>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="w-8 h-8 border-2 border-bloodRed border-t-transparent rounded-full animate-spin mb-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Checking Inbox...</span>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                        <div className="w-16 h-16 rounded-full bg-surface border border-borderColor flex items-center justify-center">
                            <Bell className="w-8 h-8 text-secondaryText" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">All Caught Up</h3>
                            <p className="text-xs text-secondaryText mt-1">No pending attestations or actions found.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-2 px-1">
                            <AlertCircle className="w-4 h-4 text-bloodRed" />
                            <span className="text-[10px] font-black text-bloodRed uppercase tracking-widest">Action Required ({notifications.length})</span>
                        </div>
                        {notifications.map((item) => (
                            <Card key={item.matchId} className="p-4 bg-surface hover:bg-surfaceHover border-borderColor/50 transition-all border-l-4 border-l-bloodRed">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-bloodRed/10 border border-bloodRed/20 flex items-center justify-center shrink-0">
                                        <Clock className="w-5 h-5 text-bloodRed" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-white block truncate pr-2">{item.courseName}</span>
                                            <span className="text-[8px] font-bold text-secondaryText uppercase shrink-0">
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-secondaryText mt-1">Match needs your final attestation to settle up.</p>
                                        <Button
                                            size="sm"
                                            className="mt-3 w-full bg-bloodRed/10 border border-bloodRed/30 text-bloodRed hover:bg-bloodRed hover:text-white text-[10px] font-black uppercase tracking-widest"
                                            onClick={() => handleAttest(item.matchId)}
                                        >
                                            Review & Attest
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                <section className="pt-8 opacity-50">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <CheckCircle2 className="w-4 h-4 text-secondaryText" />
                        <h3 className="text-[10px] font-black text-secondaryText uppercase tracking-widest">Completed</h3>
                    </div>
                    <p className="text-[10px] text-secondaryText italic text-center py-8 bg-surface/30 rounded-xl border border-dashed border-borderColor">
                        Past notifications are cleared after 7 days.
                    </p>
                </section>
            </main>
        </div>
    );
}
