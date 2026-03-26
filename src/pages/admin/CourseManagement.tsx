import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Map, Database, RefreshCcw, Trash2, Loader2, CheckCircle2, Circle, Pencil, X, Save, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

interface HoleData {
    number: number;
    par: number;
    strokeIndex: number;
    yardage: number;
}

interface AdminCourse {
    id: string;
    name: string;
    holes: HoleData[];
    cached_at: string;
}

interface ConfirmState {
    message: string;
    onConfirm: () => void;
}

export default function CourseManagement() {
    const [courses, setCourses] = useState<AdminCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncId, setSyncId] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editHoles, setEditHoles] = useState<HoleData[]>([]);
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

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

    function confirmDelete(id: string) {
        setConfirm({
            message: 'Delete this course? Any matches using it will keep their history but lose the course link.',
            onConfirm: () => executeDeleteCourse(id),
        });
    }

    async function executeDeleteCourse(id: string) {
        setConfirm(null);
        setDeleting(true);
        const { error } = await supabase.rpc('force_delete_course', { p_course_id: id });
        setDeleting(false);
        if (error) {
            setErrorMsg('Failed to delete course: ' + error.message);
        } else {
            setCourses(prev => prev.filter(c => c.id !== id));
            if (editingId === id) setEditingId(null);
        }
    }

    function confirmBulkDelete() {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        setConfirm({
            message: `Delete ${count} course${count > 1 ? 's' : ''}? Any matches using them will keep their history but lose the course link.`,
            onConfirm: executeBulkDelete,
        });
    }

    async function executeBulkDelete() {
        setConfirm(null);
        setDeleting(true);
        const { error } = await supabase.rpc('force_delete_courses_bulk', { p_course_ids: Array.from(selectedIds) });
        setDeleting(false);
        if (error) {
            setErrorMsg('Failed to delete courses: ' + error.message);
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

    function startEditing(course: AdminCourse) {
        const holes: HoleData[] = Array.from({ length: 18 }, (_, i) => {
            const existing = course.holes?.find(h => h.number === i + 1);
            return existing ?? { number: i + 1, par: 4, strokeIndex: i + 1, yardage: 400 };
        });
        setEditHoles(holes);
        setEditingId(course.id);
    }

    function updateHoleField(holeNumber: number, field: keyof Omit<HoleData, 'number'>, raw: string) {
        const value = parseInt(raw, 10);
        if (isNaN(value)) return;
        setEditHoles(prev => prev.map(h => h.number === holeNumber ? { ...h, [field]: value } : h));
    }

    async function saveHoles() {
        if (!editingId) return;
        setSaving(true);
        const { error } = await supabase
            .from('courses')
            .update({ holes: editHoles })
            .eq('id', editingId);

        if (error) {
            setErrorMsg('Failed to save: ' + error.message);
        } else {
            setCourses(prev => prev.map(c => c.id === editingId ? { ...c, holes: editHoles } : c));
            setEditingId(null);
        }
        setSaving(false);
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto momentum-scroll p-4 space-y-6">
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
                            <div key={course.id}>
                                <Card className={`p-4 flex items-center justify-between group transition-all ${selectedIds.has(course.id) ? 'border-bloodRed bg-bloodRed/5' : 'hover:border-bloodRed/50'}`}>
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

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => editingId === course.id ? setEditingId(null) : startEditing(course)}
                                            className="p-2 text-secondaryText hover:text-neonGreen transition-colors"
                                        >
                                            {editingId === course.id ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(course.id)}
                                            disabled={deleting}
                                            className="p-2 text-secondaryText hover:text-bloodRed transition-colors disabled:opacity-40"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Card>

                                {editingId === course.id && (
                                    <div className="mt-1 bg-surface border border-borderColor rounded-2xl overflow-hidden">
                                        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-widest text-neonGreen">Edit Hole Data</span>
                                            <button
                                                onClick={saveHoles}
                                                disabled={saving}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-neonGreen/10 text-neonGreen rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-neonGreen/20 transition-colors disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-borderColor">
                                                        <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-secondaryText w-12">Hole</th>
                                                        <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-secondaryText">Par</th>
                                                        <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-secondaryText">HCP</th>
                                                        <th className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest text-secondaryText">Yards</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {editHoles.map((hole) => (
                                                        <tr key={hole.number} className="border-b border-borderColor/40 last:border-0">
                                                            <td className="px-4 py-1.5 font-black text-white">{hole.number}</td>
                                                            <td className="px-3 py-1.5">
                                                                <input
                                                                    type="number"
                                                                    min={3}
                                                                    max={5}
                                                                    value={hole.par}
                                                                    onChange={e => updateHoleField(hole.number, 'par', e.target.value)}
                                                                    className="w-12 bg-surfaceHover border border-borderColor rounded-lg px-2 py-1 text-center text-white font-bold focus:outline-none focus:ring-1 focus:ring-neonGreen"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    max={18}
                                                                    value={hole.strokeIndex}
                                                                    onChange={e => updateHoleField(hole.number, 'strokeIndex', e.target.value)}
                                                                    className="w-12 bg-surfaceHover border border-borderColor rounded-lg px-2 py-1 text-center text-white font-bold focus:outline-none focus:ring-1 focus:ring-neonGreen"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input
                                                                    type="number"
                                                                    min={50}
                                                                    max={700}
                                                                    value={hole.yardage}
                                                                    onChange={e => updateHoleField(hole.number, 'yardage', e.target.value)}
                                                                    className="w-16 bg-surfaceHover border border-borderColor rounded-lg px-2 py-1 text-center text-white font-bold focus:outline-none focus:ring-1 focus:ring-neonGreen"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="px-4 py-3 border-t border-borderColor/40">
                                            <p className="text-[10px] text-secondaryText font-bold uppercase tracking-wider">
                                                HCP = Stroke Index (handicap hole order, 1 = hardest)
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
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
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="absolute bottom-0 left-0 right-0 w-full bg-surface border-t border-bloodRed shadow-[0_-12px_40px_rgba(0,0,0,0.6)] p-4 pb-safe z-50 animate-in slide-in-from-bottom-full duration-300 flex items-center justify-between backdrop-blur-md bg-opacity-95">
                    <div className="flex flex-col">
                        <span className="text-neonGreen font-black text-sm uppercase tracking-tight">{selectedIds.size} Courses Selected</span>
                        <span className="text-[10px] text-secondaryText uppercase font-bold tracking-widest">Bulk Management</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="text-[10px] py-1 h-8 px-4" onClick={() => setSelectedIds(new Set())}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-bloodRed hover:bg-bloodRed/80 text-white text-[10px] py-1 h-8 px-4 flex items-center gap-2 font-black uppercase tracking-widest"
                            onClick={confirmBulkDelete}
                            disabled={deleting}
                        >
                            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Delete
                        </Button>
                    </div>
                </div>
            )}

            {/* In-app Confirm Dialog */}
            {confirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirm(null)} />
                    <div className="relative w-full max-w-sm bg-surface border border-borderColor rounded-2xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-bloodRed/10 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-bloodRed" />
                            </div>
                            <p className="text-sm text-white font-bold leading-snug pt-1">{confirm.message}</p>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <Button variant="outline" className="flex-1" onClick={() => setConfirm(null)}>Cancel</Button>
                            <Button className="flex-1 bg-bloodRed hover:bg-bloodRed/80 font-black" onClick={confirm.onConfirm}>Delete</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* In-app Error Dialog */}
            {errorMsg && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setErrorMsg(null)} />
                    <div className="relative w-full max-w-sm bg-surface border border-bloodRed/40 rounded-2xl p-6 shadow-2xl space-y-4">
                        <p className="text-sm text-bloodRed font-bold">{errorMsg}</p>
                        <Button className="w-full" onClick={() => setErrorMsg(null)}>OK</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
