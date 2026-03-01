import { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Search, UserCog, Shield, ShieldOff, Loader2, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

interface AdminProfile {
    id: string;
    full_name: string;
    handicap: number;
    avatar_url?: string;
    is_admin: boolean;
}

export default function UserManagement() {
    const [users, setUsers] = useState<AdminProfile[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<AdminProfile | null>(null);
    const [newHandicap, setNewHandicap] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, handicap, avatar_url, is_admin')
            .order('full_name');

        if (!error && data) {
            setUsers(data as AdminProfile[]);
        }
        setLoading(false);
    }

    const filteredUsers = users.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase())
    );

    async function handleUpdateHandicap() {
        if (!editingUser) return;
        const val = parseFloat(newHandicap);
        if (isNaN(val)) return;

        const { error } = await supabase
            .from('profiles')
            .update({ handicap: val })
            .eq('id', editingUser.id);

        if (!error) {
            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, handicap: val } : u));
            setEditingUser(null);
        }
    }

    async function toggleAdmin(user: AdminProfile) {
        if (!window.confirm(`Are you sure you want to ${user.is_admin ? 'remove' : 'grant'} admin rights for ${user.full_name}?`)) return;

        const { error } = await supabase
            .from('profiles')
            .update({ is_admin: !user.is_admin })
            .eq('id', user.id);

        if (!error) {
            setUsers(prev => prev.filter(u => u.id !== user.id));
        }
    }

    async function deleteUser(user: AdminProfile) {
        if (!window.confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY delete ${user.full_name}? This cannot be undone.`)) return;

        const { error } = await supabase.rpc('delete_user', { target_user_id: user.id });

        if (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user: ' + error.message);
        } else {
            setUsers(prev => prev.filter(u => u.id !== user.id));
        }
    }

    async function handleBulkDelete() {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        if (!window.confirm(`⚠️ DANGER: Are you sure you want to PERMANENTLY delete these ${count} users? This cannot be undone.`)) return;

        const idsArray = Array.from(selectedIds);
        const { error } = await supabase.rpc('delete_users_bulk', { target_user_ids: idsArray });

        if (error) {
            console.error('Error bulk deleting users:', error);
            alert('Failed to delete users: ' + error.message);
        } else {
            setUsers(prev => prev.filter(u => !selectedIds.has(u.id)));
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
        if (selectedIds.size === filteredUsers.length && filteredUsers.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredUsers.map(u => u.id)));
        }
    }

    return (
        <div className="space-y-6">
            <header className="px-2 flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">User Management</h2>
                    <p className="text-xs text-secondaryText font-bold uppercase tracking-wider">Manage player indices and permissions</p>
                </div>
                {filteredUsers.length > 0 && (
                    <button
                        onClick={toggleSelectAll}
                        className="text-[10px] font-black uppercase tracking-widest text-bloodRed hover:text-white transition-colors px-2 py-1"
                    >
                        {selectedIds.size === filteredUsers.length ? 'Deselect All' : 'Select All'}
                    </button>
                )}
            </header>

            <div className="px-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondaryText" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search users..."
                        className="w-full bg-surface border border-borderColor rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-bloodRed transition-all"
                    />
                </div>
            </div>

            <section className="space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-secondaryText">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Loading Profiles...</span>
                    </div>
                ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <Card key={user.id} className={`p-4 flex items-center justify-between group transition-all ${selectedIds.has(user.id) ? 'border-bloodRed bg-bloodRed/5' : 'hover:border-bloodRed/50'}`}>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleSelect(user.id)}
                                    className={`p-1 rounded-md transition-colors ${selectedIds.has(user.id) ? 'text-bloodRed' : 'text-secondaryText hover:text-white'}`}
                                >
                                    {selectedIds.has(user.id) ? <CheckCircle2 className="w-5 h-5 shadow-[0_0_10px_rgba(255,0,63,0.3)]" /> : <Circle className="w-5 h-5 opacity-20" />}
                                </button>
                                <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold text-bloodRed overflow-hidden ml-1">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        user.full_name.charAt(0)
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm">{user.full_name}</span>
                                        {user.is_admin && (
                                            <span className="text-[8px] bg-bloodRed/20 text-bloodRed px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-bloodRed/30">
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-secondaryText block">ID: {user.id.slice(0, 8)}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <span className="block text-[8px] text-secondaryText font-black uppercase tracking-widest">Index</span>
                                    <span className="text-sm font-black text-white">{user.handicap.toFixed(1)}</span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => toggleAdmin(user)}
                                        className={`p-2 transition-colors ${user.is_admin ? 'text-bloodRed hover:text-white' : 'text-secondaryText hover:text-bloodRed'}`}
                                        title={user.is_admin ? "Revoke Admin" : "Grant Admin"}
                                    >
                                        {user.is_admin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingUser(user);
                                            setNewHandicap(user.handicap.toString());
                                        }}
                                        className="p-2 text-secondaryText hover:text-white transition-colors"
                                        title="Edit Handicap"
                                    >
                                        <UserCog className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteUser(user)}
                                        className="p-2 text-secondaryText hover:text-bloodRed transition-colors"
                                        title="Delete User"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-12 bg-surface rounded-2xl border border-borderColor border-dashed">
                        <p className="text-sm text-secondaryText font-bold">No users found matching "{search}"</p>
                    </div>
                )}
            </section>

            {/* Edit Handicap Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
                    <Card className="relative w-full max-w-sm p-6 bg-surface border-borderColor shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-black text-white mb-1">Edit Handicap</h3>
                        <p className="text-xs text-secondaryText font-bold uppercase tracking-wider mb-6">Updating index for {editingUser.full_name}</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] text-secondaryText font-black uppercase tracking-widest mb-1.5">New Handicap Index</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={newHandicap}
                                    onChange={(e) => setNewHandicap(e.target.value)}
                                    className="w-full bg-background border border-borderColor rounded-xl px-4 py-3 text-white font-black focus:outline-none focus:ring-1 focus:ring-bloodRed"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>Cancel</Button>
                                <Button className="flex-1 font-black" onClick={handleUpdateHandicap}>Update</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface border-t border-bloodRed shadow-[0_-8px_32px_rgba(0,0,0,0.5)] p-4 z-[100] animate-in slide-in-from-bottom-full duration-300 flex items-center justify-between backdrop-blur-md bg-opacity-95">
                    <div className="flex flex-col">
                        <span className="text-white font-black text-sm uppercase tracking-tight">{selectedIds.size} Users Selected</span>
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
