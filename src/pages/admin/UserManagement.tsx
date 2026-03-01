import { Card } from '../../components/ui/Card';
import { Search, UserCog } from 'lucide-react';

const mockUsers = [
    { id: '1', name: 'Dan', handicap: 6.6, email: 'dan@example.com', isAdmin: true },
    { id: '2', name: 'John Doe', handicap: 12.4, email: 'john@example.com', isAdmin: false },
    { id: '3', name: 'Sammie Sosa', handicap: 4.2, email: 'sammie@example.com', isAdmin: false },
    { id: '4', name: 'Tiger Woods', handicap: +3.0, email: 'tiger@example.com', isAdmin: false },
];

export default function UserManagement() {
    return (
        <div className="space-y-6">
            <header className="px-2">
                <h2 className="text-2xl font-black text-white tracking-tight">User Management</h2>
                <p className="text-xs text-secondaryText font-bold uppercase tracking-wider">Manage player indices and permissions</p>
            </header>

            <div className="px-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondaryText" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full bg-surface border border-borderColor rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-bloodRed transition-all"
                    />
                </div>
            </div>

            <section className="space-y-3">
                {mockUsers.map((user) => (
                    <Card key={user.id} className="p-4 flex items-center justify-between group hover:border-bloodRed/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center font-bold text-bloodRed">
                                {user.name.charAt(0)}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-sm">{user.name}</span>
                                    {user.isAdmin && (
                                        <span className="text-[8px] bg-bloodRed/20 text-bloodRed px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-bloodRed/30">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-secondaryText block">{user.email}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="block text-[8px] text-secondaryText font-black uppercase tracking-widest">Index</span>
                                <span className="text-sm font-black text-white">{user.handicap}</span>
                            </div>
                            <button className="p-2 text-secondaryText hover:text-white transition-colors">
                                <UserCog className="w-5 h-5" />
                            </button>
                        </div>
                    </Card>
                ))}
            </section>

            <button className="w-full py-4 border-2 border-dashed border-borderColor rounded-xl text-secondaryText hover:border-bloodRed hover:text-bloodRed transition-all text-xs font-bold uppercase tracking-widest">
                Add Manual Player Entry
            </button>
        </div>
    );
}
