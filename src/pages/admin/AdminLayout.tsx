import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
    Users,
    Trophy,
    Map,
    ChevronLeft,
    LayoutDashboard,
    ShieldAlert
} from 'lucide-react';

const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/matches', label: 'Matches', icon: Trophy },
    { path: '/admin/courses', label: 'Courses', icon: Map },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* Admin Header */}
            <header className="flex items-center justify-between p-4 px-6 border-b border-borderColor bg-background/95 backdrop-blur z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-1 -ml-1 text-secondaryText hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-bloodRed" />
                        <span className="text-white text-sm font-black uppercase tracking-widest">
                            Admin Panel
                        </span>
                    </div>
                </div>
            </header>

            {/* Admin Quick Nav */}
            <nav className="flex items-center justify-around p-2 bg-surface/50 border-b border-borderColor shrink-0 overflow-x-auto no-scrollbar">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${isActive
                                ? 'text-bloodRed bg-bloodRed/10 ring-1 ring-bloodRed/20'
                                : 'text-secondaryText hover:text-white'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(255,0,63,0.5)]' : ''}`} />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </nav>

            {/* Admin Content View */}
            <main className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-6">
                <Outlet />
            </main>

            {/* Footer Info */}
            <div className="p-2 bg-black/20 border-t border-borderColor/30 text-center shrink-0">
                <span className="text-[10px] text-secondaryText font-bold uppercase tracking-widest opacity-50">
                    Superuser Access Restricted
                </span>
            </div>
        </div>
    );
}
