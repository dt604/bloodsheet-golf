import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, BookOpen, Play, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BottomNavigation() {
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path: string) => location.pathname === path;

    const navItems = [
        { icon: Home, label: 'Home', path: '/home' },
        { icon: Trophy, label: 'Leaders', path: '/money-leaders' },
        // The center FAB occupies index 2 visually, but logically we push it to the middle
        { icon: BookOpen, label: 'History', path: '/history' },
        { icon: Users, label: 'Friends', path: '/friends' }
    ];

    return (
        <>
            {/* Bottom Navigation Bar - Floating Design */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-40">
                <nav className="bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-2 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between h-14 relative">

                        {/* Left Items */}
                        <div className="flex items-center gap-8">
                            {navItems.slice(0, 2).map((item) => {
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group ${active ? 'text-bloodRed scale-110' : 'text-secondaryText hover:text-white'}`}
                                    >
                                        <item.icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                                        {active && (
                                            <motion.div
                                                layoutId="active-nav"
                                                className="absolute -bottom-1.5 w-1 h-1 bg-bloodRed rounded-full"
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Center FAB - Polished */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-10">
                            <button
                                onClick={() => navigate('/setup')}
                                className="w-16 h-16 rounded-full bg-[#1C1C1E] border-4 border-[#121214] flex items-center justify-center shadow-[0_8px_25px_rgba(255,0,63,0.3)] transition-all duration-500 active:scale-90 group relative overflow-hidden hover:scale-105"
                            >
                                <div className="absolute inset-0 bg-bloodRed transition-all duration-500 opacity-100 group-hover:bg-bloodRed/90" />
                                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent opacity-50" />

                                <Play className="w-7 h-7 text-white ml-0.5 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" fill="currentColor" />

                                {/* Subtle Pulse Effect */}
                                <div className="absolute inset-0 rounded-full border border-white/20 scale-110 opacity-0 group-hover:animate-ping" />
                            </button>
                        </div>

                        {/* Right Items */}
                        <div className="flex items-center gap-8">
                            {navItems.slice(2, 4).map((item) => {
                                const active = isActive(item.path);
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group ${active ? 'text-bloodRed scale-110' : 'text-secondaryText hover:text-white'}`}
                                    >
                                        <item.icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
                                        {active && (
                                            <motion.div
                                                layoutId="active-nav"
                                                className="absolute -bottom-1.5 w-1 h-1 bg-bloodRed rounded-full"
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                    </div>
                </nav>
            </div>
        </>
    );
}
