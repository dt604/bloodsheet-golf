import { Link } from 'react-router-dom';
import { Settings, UserPlus } from 'lucide-react';
import { useMatchStore } from '../../store/useMatchStore';

export default function TopHeader() {
    const { activeMatchIds } = useMatchStore();

    // In the future this could be expanded to include friend requests or other notifications
    const hasNotifications = activeMatchIds.length > 0;

    return (
        <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-borderColor px-4 py-3 flex items-center justify-between shadow-sm">
            {/* Left Action: Quick Add Friend */}
            <Link
                to="/qr"
                className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors flex items-center justify-center shrink-0"
            >
                <UserPlus className="w-6 h-6" />
            </Link>

            {/* Center: Stylized Logo */}
            <div className="flex-1 flex justify-center items-center">
                <Link to="/dashboard" className="flex items-center gap-2">
                    <span className="font-black text-xl tracking-wider text-bloodRed uppercase drop-shadow-[0_0_10px_rgba(255,0,63,0.4)]">
                        BloodSheet
                    </span>
                </Link>
            </div>

            {/* Right Action: Settings / Notifications */}
            <div className="flex items-center gap-1 -mr-2 shrink-0">
                <Link
                    to="/settings"
                    className="p-2 text-secondaryText hover:text-white transition-colors relative flex items-center justify-center"
                >
                    <Settings className="w-6 h-6" />
                    {hasNotifications && (
                        <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-neonGreen rounded-full shadow-[0_0_8px_rgba(0,255,102,0.8)] border-2 border-surface animate-pulse" />
                    )}
                </Link>
            </div>
        </header>
    );
}
