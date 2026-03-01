import { Card } from '../../components/ui/Card';
import { Map, Edit3, Database, RefreshCcw } from 'lucide-react';

const mockCourses = [
    { id: '1', name: 'Torrey Pines South', holes: 18, cached: '2 days ago' },
    { id: '2', name: 'Pebble Beach Golf Links', holes: 18, cached: '1 week ago' },
    { id: '3', name: 'Riviera Country Club', holes: 18, cached: '3 hours ago' },
];

export default function CourseManagement() {
    return (
        <div className="space-y-6">
            <header className="px-2">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Course Library</h2>
                        <p className="text-xs text-secondaryText font-bold uppercase tracking-wider">Cached course data from The Grint</p>
                    </div>
                    <button className="p-2 bg-bloodRed/10 text-bloodRed rounded-lg hover:bg-bloodRed/20 transition-colors">
                        <RefreshCcw className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <section className="space-y-3">
                {mockCourses.map((course) => (
                    <Card key={course.id} className="p-4 flex items-center justify-between group hover:border-bloodRed/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-surfaceHover border border-borderColor flex items-center justify-center">
                                <Map className="w-6 h-6 text-bloodRed" />
                            </div>
                            <div>
                                <span className="font-bold text-white text-sm block">{course.name}</span>
                                <span className="text-[10px] text-secondaryText flex items-center gap-1 uppercase font-bold tracking-wider">
                                    <Database className="w-3 h-3" />
                                    {course.holes} Holes • Updated {course.cached}
                                </span>
                            </div>
                        </div>

                        <button className="p-2 text-secondaryText hover:text-white transition-colors">
                            <Edit3 className="w-5 h-5" />
                        </button>
                    </Card>
                ))}
            </section>

            <div className="px-2 pt-4">
                <div className="p-6 bg-bloodRed/5 border border-bloodRed/20 rounded-2xl flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 bg-bloodRed/10 text-bloodRed rounded-full flex items-center justify-center">
                        <RefreshCcw className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="block text-white font-bold text-sm mb-1 uppercase tracking-tight">Sync New Course</span>
                        <p className="text-[10px] text-secondaryText uppercase tracking-widest font-bold">Import scorecard from The Grint API</p>
                    </div>
                    <div className="flex w-full gap-2 pt-2">
                        <input
                            type="text"
                            placeholder="The Grint Course ID..."
                            className="flex-1 bg-surface border border-borderColor rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-bloodRed font-mono"
                        />
                        <button className="px-4 py-2 bg-bloodRed text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-bloodRed/80 transition-all">
                            Sync
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
