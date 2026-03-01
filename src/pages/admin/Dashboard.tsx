import { Card } from '../../components/ui/Card';
import { StatBox } from '../../components/ui/StatBox';

export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            <section>
                <h3 className="text-sm font-bold tracking-widest uppercase text-secondaryText mb-4 px-2">System Overview</h3>
                <div className="grid grid-cols-2 gap-3">
                    <StatBox label="Total Users" value="24" />
                    <StatBox label="Live Matches" value="3" valueColor="neonGreen" />
                    <StatBox label="Total Rounds" value="142" />
                    <StatBox label="Cached Courses" value="27" />
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-3 px-2">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-secondaryText">System Health</h3>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-neonGreen uppercase tracking-widest">
                        <span className="w-2 h-2 rounded-full bg-neonGreen animate-pulse" />
                        Operational
                    </span>
                </div>
                <Card className="p-4 bg-surface border-borderColor">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-secondaryText font-bold uppercase">Supabase API</span>
                            <span className="text-xs text-neonGreen font-black">STABLE</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div className="bg-neonGreen h-full w-[98%]" />
                        </div>

                        <div className="flex justify-between items-center">
                            <span className="text-xs text-secondaryText font-bold uppercase">The Grint Bridge</span>
                            <span className="text-xs text-neonGreen font-black">CONNECTED</span>
                        </div>
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                            <div className="bg-neonGreen h-full w-[100%]" />
                        </div>
                    </div>
                </Card>
            </section>

            <section>
                <h3 className="text-sm font-bold tracking-widest uppercase text-secondaryText mb-3 px-2">Admin Tasks</h3>
                <div className="space-y-2">
                    <button className="w-full p-4 bg-surface hover:bg-surfaceHover border border-borderColor rounded-xl text-left transition-colors flex items-center justify-between group">
                        <div>
                            <span className="block text-white font-bold text-sm">Verify Unlinked Players</span>
                            <span className="text-[10px] text-secondaryText uppercase font-bold">5 pending approvals</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-bloodRed/20 flex items-center justify-center group-hover:bg-bloodRed/30 transition-colors">
                            <ShieldAlert className="w-4 h-4 text-bloodRed" />
                        </div>
                    </button>
                </div>
            </section>
        </div>
    );
}

function ShieldAlert({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
        </svg>
    );
}
