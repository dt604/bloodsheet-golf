import { Link, useNavigate } from 'react-router-dom';
import { Settings, UserPlus, ShieldCheck, QrCode } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatchStore } from '../../store/useMatchStore';

export default function TopHeader() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { activeMatchIds } = useMatchStore();

    // In the future this could be expanded to include friend requests or other notifications
    const hasNotifications = activeMatchIds.length > 0;

    return (
        <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-borderColor px-4 py-3 flex items-center justify-between shadow-sm">
            {/* Left Action: Quick Add Friend / QR */}
            <div className="flex items-center">
                <Link
                    to="/qr"
                    className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors"
                    title="QR Code"
                >
                    <QrCode className="w-6 h-6" />
                </Link>
            </div>

            {/* Center: Stylized Logo */}
            <div className="flex-1 flex justify-center items-center">
                <Link to="/home" className="flex items-center gap-2">
                    <span className="font-black text-xl tracking-wider text-bloodRed uppercase drop-shadow-[0_0_10px_rgba(255,0,63,0.4)]">
                        BloodSheet
                    </span>
                </Link>
            </div>

            {/* Right Actions: Admin, Friends, Settings */}
            <div className="flex items-center gap-1 -mr-2">
                {profile?.is_admin && (
                    <button
                        onClick={() => navigate('/admin')}
                        className="p-2 text-bloodRed hover:text-white transition-colors"
                        title="Admin Dashboard"
                    >
                        <ShieldCheck className="w-5 h-5 drop-shadow-[0_0_8px_rgba(255,0,63,0.4)]" />
                    </button>
                )}
                <Link
                    to="/friends"
                    className="p-2 text-secondaryText hover:text-white transition-colors"
                    title="Friends"
                >
                    <UserPlus className="w-5 h-5" />
                </Link>
                <Link
                    to="/settings"
                    className="p-2 text-secondaryText hover:text-white transition-colors relative"
                    title="Settings"
                >
                    <Settings className="w-5 h-5" />
                    {hasNotifications && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-neonGreen rounded-full shadow-[0_0_5px_rgba(0,255,102,0.5)] animate-pulse" />
                    )}
                </Link>
            </div>
        </header>
    );
}
