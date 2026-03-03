import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, BookOpen, Play, Plus, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BottomNavigation() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            {/* Play Menu Overlay & Drawer */}
            <AnimatePresence>
                {isMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
                        />
                        <motion.div
                            initial={{ y: '100%', scale: 0.95 }}
                            animate={{ y: 0, scale: 1 }}
                            exit={{ y: '100%', scale: 0.95 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-[100px] left-4 right-4 z-50 bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] safe-bottom"
                        >
                            <div className="flex flex-col items-center gap-6">
                                <div className="text-center">
                                    <h3 className="font-black text-2xl text-white uppercase italic tracking-tighter mb-1">
                                        Match Center
                                    </h3>
                                    <p className="text-[10px] text-secondaryText font-black uppercase tracking-[0.2em]">Start Your Legend</p>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        navigate('/setup');
                                    }}
                                    className="w-full flex items-center justify-between p-6 bg-surfaceHover/50 rounded-3xl border border-bloodRed/20 hover:border-bloodRed transition-all group relative overflow-hidden active:scale-[0.98]"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-bloodRed/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-12 h-12 rounded-2xl bg-bloodRed/20 flex items-center justify-center text-bloodRed group-hover:scale-110 transition-transform">
                                            <Plus className="w-7 h-7" strokeWidth={3} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-black text-lg text-white uppercase italic leading-none group-hover:text-bloodRed transition-colors">
                                                Host Match
                                            </span>
                                            <span className="text-[10px] text-secondaryText font-black uppercase tracking-[0.1em] mt-1">Create a new ledger</span>
                                        </div>
                                    </div>
                                    <Play className="w-5 h-5 text-bloodRed/40 group-hover:text-bloodRed group-hover:translate-x-1 transition-all" fill="currentColor" />
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

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
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`w-16 h-16 rounded-full bg-[#1C1C1E] border-4 border-[#121214] flex items-center justify-center shadow-[0_8px_25px_rgba(255,0,63,0.3)] transition-all duration-500 active:scale-90 group relative overflow-hidden ${isMenuOpen ? 'rotate-45 scale-110 border-bloodRed/20' : 'hover:scale-105'}`}
                            >
                                <div className={`absolute inset-0 bg-bloodRed transition-all duration-500 ${isMenuOpen ? 'opacity-20' : 'opacity-100 group-hover:bg-bloodRed/90'}`} />
                                <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent opacity-50" />

                                {isMenuOpen ? (
                                    <Plus className="w-8 h-8 text-bloodRed relative z-10" strokeWidth={3} />
                                ) : (
                                    <Play className="w-7 h-7 text-white ml-0.5 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" fill="currentColor" />
                                )}

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
