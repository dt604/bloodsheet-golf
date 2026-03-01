import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Map, Database, RefreshCcw, Trash2, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

interface AdminCourse {
    id: string;
    name: string;
    holes: any[];
    cached_at: string;
}

export default function CourseManagement() {
    const [courses, setCourses] = useState<AdminCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncId, setSyncId] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchCourses();
    }, []);

    async function fetchCourses() {
        setLoading(true);
        const { data, error } = await supabase
            .from('courses')
            .select('id, name, holes, cached_at')
            .order('name');

        if (!error && data) {
            setCourses(data as AdminCourse[]);
        }
        setLoading(false);
    }

    async function deleteCourse(id: string) {
        if (!window.confirm('Are you sure you want to delete this course from the cache? Matches using this course may show missing data.')) return;

        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', id);

        if (!error) {
            setCourses(prev => prev.filter(c => c.id !== id));
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!window.confirm(`⚠️ WARNING: Deleting ${count} courses will also affect historical data for matches played at these courses. Proceed?`)) return;

        const { error } = await supabase
            .from('courses')
            .delete()
            .in('id', Array.from(selectedIds));

        if (error) {
            console.error('Error bulk deleting courses:', error);
            alert('Failed to delete some courses: ' + error.message);
        } else {
            setCourses(prev => prev.filter(c => !selectedIds.has(c.id)));
            setSelectedIds(new Set());
        }
    }

    function toggleSelect(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    }

    function toggleSelectAll() {
        if (selectedIds.size === courses.length && courses.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(courses.map(c => c.id)));
        }
    }

    return (
        <div className="space-y-6">
            <header className="px-2">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Course Library</h2>
                        <p className="text-xs text-secondaryText font-bold uppercase tracking-wider">Cached course data from The Grint</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {courses.length > 0 && (
                            <button
                                onClick={toggleSelectAll}
                                className="text-[10px] font-black uppercase tracking-widest text-bloodRed hover:text-white transition-colors px-2 py-1"
                            >
                                {selectedIds.size === courses.length ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        <button
                            onClick={fetchCourses}
                            className="p-2 bg-bloodRed/10 text-bloodRed rounded-lg hover:bg-bloodRed/20 transition-colors"
                        >
                            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            <section className="space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-secondaryText">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Loading Library...</span>
                    </div>
                ) : courses.length > 0 ? (
                    courses.map((course) => (
                        <Card key={course.id} className={`p-4 flex items-center justify-between group transition-all ${selectedIds.has(course.id) ? 'border-bloodRed bg-bloodRed/5' : 'hover:border-bloodRed/50'}`}>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => toggleSelect(course.id)}
                                    className={`transition-colors ${selectedIds.has(course.id) ? 'text-bloodRed' : 'text-secondaryText hover:text-white'}`}
                                >
                                    {selectedIds.has(course.id) ? <CheckCircle2 className="w-5 h-5 shadow-[0_0_10px_rgba(255,0,63,0.3)]" /> : <Circle className="w-5 h-5 opacity-20" />}
                                </button>
                                <div className="w-12 h-12 rounded-xl bg-surfaceHover border border-borderColor flex items-center justify-center">
                                    <Map className="w-6 h-6 text-bloodRed" />
                                </div>
                                <div>
                                    <span className="font-bold text-white text-sm block">{course.name}</span>
                                    <span className="text-[10px] text-secondaryText flex items-center gap-1 uppercase font-bold tracking-wider">
                                        <Database className="w-3 h-3" />
                                        {course.holes?.length || 0} Holes • Updated {new Date(course.cached_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => deleteCourse(course.id)}
                                className="p-2 text-secondaryText hover:text-bloodRed transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-12 bg-surface rounded-2xl border border-borderColor border-dashed">
                        <p className="text-sm text-secondaryText font-bold">No courses currently cached</p>
                    </div>
                )}
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
                            value={syncId}
                            onChange={(e) => setSyncId(e.target.value)}
                            placeholder="The Grint Course ID..."
                            className="flex-1 bg-surface border border-borderColor rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-bloodRed font-mono"
                        />
                        <button
                            disabled={!syncId}
                            className="px-4 py-2 bg-bloodRed text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-bloodRed/80 transition-all disabled:opacity-50"
                        >
                            Sync
                        </button>
                    </div>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md bg-surface border border-bloodRed/30 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-4 z-[50] animate-in slide-in-from-bottom-4 duration-300 flex items-center justify-between backdrop-blur-md bg-opacity-90">
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm uppercase tracking-tight">{selectedIds.size} Courses Selected</span>
                        <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">Bulk Management</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] py-1 h-8"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            className="bg-bloodRed hover:bg-bloodRed/80 text-[10px] py-1 h-8 flex items-center gap-2"
                            onClick={handleBulkDelete}
                        >
                            <Trash2 className="w-3 h-3" />
                            Delete
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
