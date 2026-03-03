import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, BookOpen, Play, Plus, Users, LayoutGrid } from 'lucide-react';
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
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed bottom-[90px] left-4 right-4 z-50 bg-surface border border-borderColor rounded-3xl p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] safe-bottom"
                        >
                            <h3 className="font-black text-xl text-white uppercase tracking-widest mb-6 text-center">
                                Start Round
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        navigate('/setup');
                                    }}
                                    className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-bloodRed/30 hover:border-bloodRed transition-colors group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-bloodRed/5 group-hover:bg-bloodRed/10 transition-colors" />
                                    <Plus className="w-10 h-10 text-white mb-3 relative z-10" />
                                    <span className="font-black text-sm text-bloodRed uppercase tracking-widest relative z-10 text-center">
                                        Host Match
                                    </span>
                                </button>

                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        navigate('/join');
                                    }}
                                    className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-neonGreen/30 hover:border-neonGreen transition-colors group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-neonGreen/5 group-hover:bg-neonGreen/10 transition-colors" />
                                    <LayoutGrid className="w-10 h-10 text-white mb-3 relative z-10" />
                                    <span className="font-black text-sm text-neonGreen uppercase tracking-widest relative z-10 text-center">
                                        Join Match
                                    </span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-borderColor/50 px-2 pb-safe shadow-[0_-5px_30px_rgba(0,0,0,0.3)] safe-x max-w-md landscape:max-w-none lg:landscape:max-w-md mx-auto">
                <div className="flex items-center justify-between h-[72px] relative">

                    {/* Left Items */}
                    <div className="flex-1 flex justify-around">
                        {navItems.slice(0, 2).map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive(item.path) ? 'text-neonGreen' : 'text-secondaryText hover:text-white'
                                    }`}
                            >
                                <item.icon className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Center FAB Space */}
                    <div className="flex-shrink-0 w-[80px] flex items-center justify-center -mt-8 relative z-50">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="w-[68px] h-[68px] rounded-full bg-surface border-4 border-background flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-transform active:scale-95 group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-bloodRed transition-colors group-hover:bg-bloodRed/90" />
                            <Play className="w-8 h-8 text-white ml-1 relative z-10" fill="currentColor" />
                        </button>
                    </div>

                    {/* Right Items */}
                    <div className="flex-1 flex justify-around">
                        {navItems.slice(2, 4).map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive(item.path) ? 'text-neonGreen' : 'text-secondaryText hover:text-white'
                                    }`}
                            >
                                <item.icon className="w-6 h-6" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                            </Link>
                        ))}
                    </div>

                </div>
            </nav>
        </>
    );
}
