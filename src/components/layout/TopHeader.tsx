import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, ShieldCheck, QrCode, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatchStore } from '../../store/useMatchStore';
import { supabase } from '../../lib/supabase';

export default function TopHeader() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { activeMatchIds } = useMatchStore();
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        async function checkPending() {
            try {
                // Find matches where user is player
                const { data: userMatches } = await supabase
                    .from('match_players')
                    .select('match_id')
                    .eq('user_id', user!.id);

                const mIds = (userMatches ?? []).map((m: any) => m.match_id);
                if (mIds.length === 0) { setPendingCount(0); return; }

                // Matches in pending_attestation not created by user
                const { data: pending } = await supabase
                    .from('matches')
                    .select('id')
                    .in('id', mIds)
                    .eq('status', 'pending_attestation')
                    .neq('created_by', user!.id);

                if (!pending || pending.length === 0) { setPendingCount(0); return; }

                const pIds = pending.map((m: any) => m.id);

                // Filter already attested
                const { data: attested } = await supabase
                    .from('match_attestations')
                    .select('match_id')
                    .eq('user_id', user!.id)
                    .in('match_id', pIds);

                const attestedIds = new Set((attested ?? []).map((a: any) => a.match_id));
                const finalCount = pending.filter((m: any) => !attestedIds.has(m.id)).length;
                setPendingCount(finalCount);
            } catch (e) {
                console.error('Error checking pending attestations:', e);
            }
        }
        checkPending();
    }, [user]);

    const hasNotifications = pendingCount > 0 || activeMatchIds.length > 0;

    return (
        <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-white/5 px-6 h-16 flex items-center justify-between">
            {/* Left Action: Quick Add Friend / QR */}
            <div className="flex items-center">
                <Link
                    to="/qr"
                    className="group p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                    title="QR Code"
                >
                    <QrCode className="w-5 h-5 text-secondaryText group-hover:text-white transition-colors" />
                </Link>
            </div>

            {/* Center: Stylized Logo */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
                <Link to="/home" className="flex items-center group active:scale-95 transition-transform">
                    <span className="font-black text-2xl tracking-tighter uppercase italic flex items-baseline">
                        <span className="text-bloodRed drop-shadow-[0_0_12px_rgba(255,0,63,0.5)]">BLOOD</span>
                        <span className="text-white ml-0.5 opacity-90">SHEET</span>
                    </span>
                </Link>
            </div>

            {/* Right Actions: Admin, Notifications/Settings */}
            <div className="flex items-center gap-2">
                {profile?.is_admin && (
                    <button
                        onClick={() => navigate('/admin')}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-bloodRed/10 border border-bloodRed/20 text-bloodRed hover:bg-bloodRed hover:text-white transition-all duration-300 group"
                        title="Admin Dashboard"
                    >
                        <ShieldCheck className="w-5 h-5 drop-shadow-[0_0_8px_rgba(255,0,63,0.4)] group-hover:scale-110 transition-transform" />
                    </button>
                )}



                <Link
                    to={pendingCount > 0 ? "/notifications" : "/settings"}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-secondaryText hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 relative group"
                    title={pendingCount > 0 ? "Notifications" : "Settings"}
                >
                    {pendingCount > 0 ? (
                        <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    ) : (
                        <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-500" />
                    )}
                    {hasNotifications && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-neonGreen rounded-full ring-2 ring-background ring-offset-0 shadow-[0_0_10px_rgba(0,255,102,0.6)] animate-pulse" />
                    )}
                </Link>
            </div>
        </header>
    );
}
