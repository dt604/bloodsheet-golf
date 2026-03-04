import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Wallet, MessageSquare, Play, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMatchStore } from '../../store/useMatchStore';
import { useSocialStore } from '../../store/useSocialStore';
import { useAuth } from '../../contexts/AuthContext';

export default function BottomNavigation() {
    const location = useLocation();
    const navigate = useNavigate();
    const resetSetup = useMatchStore((s) => s.resetSetup);
    const { user } = useAuth();
    const { hasUnseenActivity, checkUnseenActivity, clearUnseenActivity } = useSocialStore();

    // Check for unseen social activity on mount
    useEffect(() => {
        if (user) checkUnseenActivity(user.id);
    }, [user]);

    // Clear notification dot when user navigates to Home
    useEffect(() => {
        if (location.pathname === '/home' && hasUnseenActivity) {
            clearUnseenActivity();
        }
    }, [location.pathname, hasUnseenActivity, clearUnseenActivity]);

    // Check if path is active
    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { icon: Home, label: 'Home', path: '/home', showDot: hasUnseenActivity },
        { icon: Wallet, label: 'Wallet', path: '/blood-bank' },
        { icon: MessageSquare, label: 'Chat', path: '/messages' },
        { icon: Users, label: 'Friends', path: '/friends' }
    ];

    const handleStartMatch = () => {
        resetSetup();
        navigate('/setup');
    };

    return (
        <div className="fixed bottom-0 left-0 w-full z-50 pb-safe pointer-events-none">
            {/* The Ultra-Premium Dark Glass Dock */}
            <nav className="relative bg-[#0B0B0C]/95 backdrop-blur-3xl border-t border-white/[0.05] shadow-[0_-20px_40px_rgba(0,0,0,0.8)] px-2 h-[72px] pointer-events-auto">
                <div className="grid grid-cols-5 h-full relative max-w-md mx-auto items-center">

                    {/* Left Items */}
                    <div className="contents">
                        {navItems.slice(0, 2).map((item) => {
                            const active = isActive(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`relative flex flex-col items-center justify-center h-full w-full group transition-all duration-300 ${active ? 'text-white' : 'text-secondaryText hover:text-white/80'}`}
                                >
                                    {/* Active Top Border Glow */}
                                    {active && (
                                        <motion.div
                                            layoutId="nav-top-border"
                                            className="absolute top-0 left-[20%] right-[20%] h-[3px] bg-bloodRed rounded-b-full shadow-[0_2px_15px_rgba(255,0,63,1)]"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <div className={`relative transition-all duration-500 flex flex-col items-center gap-1.5 ${active ? '-translate-y-1' : ''}`}>
                                        <item.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                                        {'showDot' in item && item.showDot && !active && (
                                            <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-bloodRed rounded-full ring-2 ring-[#0B0B0C] shadow-[0_0_8px_rgba(255,0,63,0.6)] animate-pulse" />
                                        )}
                                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${active ? 'text-bloodRed' : ''}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    {/* Ambient bottom glow for active tab */}
                                    {active && (
                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bloodRed/10 to-transparent pointer-events-none" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Center Premium Start Button (Engine Start Style) */}
                    <div className="flex justify-center relative h-full">
                        {/* Housing / Cutout base */}
                        <div className="absolute -top-7 w-20 h-20 bg-[#0B0B0C] rounded-full flex items-center justify-center p-[6px] border border-white/[0.05] shadow-[0_-15px_25px_rgba(0,0,0,0.6)]">
                            <button
                                onClick={handleStartMatch}
                                className="w-full h-full rounded-full relative group overflow-hidden shadow-[inset_0_-4px_10px_rgba(0,0,0,0.7),0_10px_20px_rgba(255,0,63,0.3)] hover:shadow-[inset_0_-4px_10px_rgba(0,0,0,0.7),0_10px_35px_rgba(255,0,63,0.6)] transition-all duration-500 active:scale-95 flex items-center justify-center"
                                style={{
                                    background: 'radial-gradient(circle at 35% 25%, #FF1A4A 0%, #CC0029 45%, #660014 100%)'
                                }}
                            >
                                {/* Metallic/Glass Reflection Ring */}
                                <div className="absolute inset-0 rounded-full border-[1.5px] border-white/20 shadow-[inset_0_3px_6px_rgba(255,255,255,0.4)] pointer-events-none mix-blend-overlay" />

                                {/* Depth shadow inside the button */}
                                <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_12px_rgba(0,0,0,0.4)] pointer-events-none" />

                                {/* Glowing center play icon */}
                                <Play className="w-8 h-8 text-white ml-0.5 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] transition-all duration-500" fill="currentColor" />

                                {/* Engine heartbeat glow on hover */}
                                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                            </button>
                        </div>
                    </div>

                    {/* Right Items */}
                    <div className="contents">
                        {navItems.slice(2, 4).map((item) => {
                            const active = isActive(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`relative flex flex-col items-center justify-center h-full w-full group transition-all duration-300 ${active ? 'text-white' : 'text-secondaryText hover:text-white/80'}`}
                                >
                                    {/* Active Top Border Glow */}
                                    {active && (
                                        <motion.div
                                            layoutId="nav-top-border"
                                            className="absolute top-0 left-[20%] right-[20%] h-[3px] bg-bloodRed rounded-b-full shadow-[0_2px_15px_rgba(255,0,63,1)]"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <div className={`relative transition-all duration-500 flex flex-col items-center gap-1.5 ${active ? '-translate-y-1' : ''}`}>
                                        <item.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                                        {'showDot' in item && item.showDot && !active && (
                                            <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-bloodRed rounded-full ring-2 ring-[#0B0B0C] shadow-[0_0_8px_rgba(255,0,63,0.6)] animate-pulse" />
                                        )}
                                        <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${active ? 'text-bloodRed' : ''}`}>
                                            {item.label}
                                        </span>
                                    </div>
                                    {/* Ambient bottom glow for active tab */}
                                    {active && (
                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bloodRed/10 to-transparent pointer-events-none" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>

                </div>
            </nav>
        </div>
    );
}
