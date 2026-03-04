import { useNavigate } from 'react-router-dom';
import { Compass, ChevronLeft } from 'lucide-react';
import SEO from '../components/SEO';
import { ActivityFeed } from '../components/home/ActivityFeed';

export default function DiscoverPage() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden relative">
            <SEO title="Discover Highlights" />

            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Compass className="w-64 h-64 text-white" />
            </div>

            <div className="shrink-0 p-4 border-b border-white/10 bg-surface/50 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 rounded-full text-secondaryText hover:text-white hover:bg-white/5 transition-all"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-neonGreen/10 flex items-center justify-center border border-neonGreen/20 shadow-[0_0_15px_rgba(0,255,102,0.2)]">
                        <Compass className="w-4 h-4 text-neonGreen" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black italic uppercase tracking-wider text-white leading-none">Discover</h1>
                        <p className="text-[10px] text-neonGreen font-black uppercase tracking-widest mt-0.5">Global Activity</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <div className="p-4 sm:p-6 pb-24 max-w-lg mx-auto w-full">
                    <ActivityFeed isGlobal={true} />
                </div>
            </div>
        </div>
    );
}

