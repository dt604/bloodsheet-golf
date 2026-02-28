import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Camera, Loader } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Toggle } from '../components/ui/Toggle';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
    const navigate = useNavigate();
    const { user, profile, signOut, updateProfile } = useAuth();

    const [autoTrash, setAutoTrash] = useState(true);
    const [matchInvites, setMatchInvites] = useState(true);
    const [midRoundPress, setMidRoundPress] = useState(true);
    const [finalSettlement, setFinalSettlement] = useState(true);

    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(profile?.fullName ?? '');
    const [savingName, setSavingName] = useState(false);

    const [editingHandicap, setEditingHandicap] = useState(false);
    const [handicapInput, setHandicapInput] = useState(String(profile?.handicap ?? '0.0'));
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        if (!e.target.files || e.target.files.length === 0 || !user) return;
        const file = e.target.files[0];
        setUploadingImage(true);

        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}-${Math.random()}.${fileExt}`;

        try {
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            await updateProfile({ avatarUrl: data.publicUrl });
        } catch (error: any) {
            console.error('Error uploading avatar:', error.message);
            alert('Failed to upload image. Did you run the SQL script?');
        } finally {
            setUploadingImage(false);
        }
    }

    async function handleSaveName() {
        const val = nameInput.trim();
        if (!val) return;
        setSavingName(true);
        await updateProfile({ fullName: val });
        setSavingName(false);
        setEditingName(false);
    }

    async function handleSaveHandicap() {
        const val = parseFloat(handicapInput);
        if (isNaN(val)) return;
        setSaving(true);
        await updateProfile({ handicap: val });
        setSaving(false);
        setEditingHandicap(false);
    }

    async function handleLogOut() {
        await signOut();
        navigate('/');
    }

    async function handleDeleteAccount() {
        if (!window.confirm('Are you sure you want to permanently delete your account and all associated data? This action cannot be undone.')) return;
        setDeleting(true);
        try {
            const { error } = await supabase.rpc('delete_user_account');
            if (error) throw error;

            // Because the user no longer exists in the DB, supabase.auth.signOut() 
            // will actually throw an error here ("User not found"). We just need to 
            // forcefully clear the local session instead.
            localStorage.clear();
            window.location.href = '/';
        } catch (err: any) {
            console.error('Failed to delete account:', err);
            alert('Could not delete account. Please try again.');
            setDeleting(false);
        }
    }

    const maskedEmail = user?.email
        ? user.email.replace(/(.{2}).+(@.+)/, '$1***$2')
        : '—';

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            {/* Header - Stationary */}
            <header className="flex items-center justify-between p-4 border-b border-borderColor bg-background/95 backdrop-blur shrink-0 z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <span className="font-bold text-lg tracking-wide uppercase">Settings & Prefs</span>
                <button onClick={() => navigate(-1)} className="p-2 -mr-2 text-secondaryText hover:text-white transition-colors text-sm font-bold">
                    Save
                </button>
            </header>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto momentum-scroll p-5 space-y-8 pb-12 pb-safe">

                {/* Account Info */}
                <section>
                    <div className="text-secondaryText text-xs font-bold uppercase tracking-widest pl-2 mb-2">Account Information</div>
                    <Card className="divide-y divide-borderColor/50">
                        <div className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors">
                            <span className="font-semibold text-white">Profile Photo</span>
                            <div className="relative group">
                                {profile?.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover border border-borderColor" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center overflow-hidden">
                                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=Golfer" alt="Default Golfer" className="w-full h-full object-cover opacity-80" />
                                    </div>
                                )}
                                <label className="absolute inset-0 bg-background/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity border border-dashed border-bloodRed/50">
                                    {uploadingImage ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 text-bloodRed" />}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingImage} />
                                </label>
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer" onClick={() => setEditingName(!editingName)}>
                            <span className="font-semibold text-white">Name</span>
                            <div className="flex items-center gap-2">
                                {editingName ? (
                                    <input
                                        type="text"
                                        className="w-40 text-right font-bold text-white bg-background border border-bloodRed px-3 py-1 rounded focus:outline-none"
                                        value={nameInput}
                                        onChange={(e) => setNameInput(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                    />
                                ) : (
                                    <span className="text-secondaryText">{profile?.fullName ?? '—'}</span>
                                )}
                                {editingName ? (
                                    <Button size="sm" className="h-8 px-3 text-xs" onClick={(e) => { e.stopPropagation(); handleSaveName(); }} disabled={savingName}>
                                        {savingName ? '…' : 'Save'}
                                    </Button>
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-secondaryText" />
                                )}
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors">
                            <span className="font-semibold text-white">Linked Email</span>
                            <span className="text-secondaryText">{maskedEmail}</span>
                        </div>
                        <div className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer" onClick={() => setEditingHandicap(!editingHandicap)}>
                            <span className="font-semibold text-white">Baseline Handicap Index</span>
                            <div className="flex items-center gap-2">
                                {editingHandicap ? (
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="54"
                                        className="w-20 text-right font-bold text-white bg-background border border-bloodRed px-3 py-1 rounded focus:outline-none"
                                        value={handicapInput}
                                        onChange={(e) => setHandicapInput(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveHandicap()}
                                    />
                                ) : (
                                    <span className="font-bold text-white bg-background border border-borderColor px-3 py-1 rounded">
                                        {profile?.handicap ?? '0.0'}
                                    </span>
                                )}
                                {editingHandicap ? (
                                    <Button size="sm" className="h-8 px-3 text-xs" onClick={(e) => { e.stopPropagation(); handleSaveHandicap(); }} disabled={saving}>
                                        {saving ? '…' : 'Save'}
                                    </Button>
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-secondaryText" />
                                )}
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Betting Defaults */}
                <section>
                    <div className="text-secondaryText text-xs font-bold uppercase tracking-widest pl-2 mb-2">Match Defaults</div>
                    <Card className="divide-y divide-borderColor/50">
                        <div className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer">
                            <span className="font-semibold text-white">Default Format</span>
                            <div className="flex items-center gap-2">
                                <span className="text-secondaryText">1v1 Match Play</span>
                                <ChevronRight className="w-4 h-4 text-secondaryText" />
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-between hover:bg-surfaceHover transition-colors cursor-pointer">
                            <span className="font-semibold text-white">Default Wager</span>
                            <div className="flex items-center gap-2">
                                <span className="text-secondaryText">$10 Nassau</span>
                                <ChevronRight className="w-4 h-4 text-secondaryText" />
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                            <span className="font-semibold text-white">Auto-enable Trash Bets</span>
                            <Toggle checked={autoTrash} onCheckedChange={setAutoTrash} />
                        </div>
                    </Card>
                </section>

                {/* Notifications */}
                <section>
                    <div className="text-secondaryText text-xs font-bold uppercase tracking-widest pl-2 mb-2">Push Notifications</div>
                    <Card className="divide-y divide-borderColor/50">
                        <div className="p-4 flex items-center justify-between">
                            <span className="font-semibold text-white">Match Invites</span>
                            <Toggle checked={matchInvites} onCheckedChange={setMatchInvites} />
                        </div>
                        <div className="p-4 flex items-center justify-between">
                            <span className="font-semibold text-white">Mid-Round Press Alerts</span>
                            <Toggle checked={midRoundPress} onCheckedChange={setMidRoundPress} />
                        </div>
                        <div className="p-4 flex items-center justify-between">
                            <span className="font-semibold text-white">Final Settlement Owed</span>
                            <Toggle checked={finalSettlement} onCheckedChange={setFinalSettlement} />
                        </div>
                    </Card>
                </section>

                {/* Danger Zone */}
                <section className="space-y-2 mt-12 px-2">
                    <div className="py-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleLogOut}>
                        <span className="font-bold text-bloodRed uppercase tracking-widest text-sm">Log Out</span>
                    </div>

                    <div className="py-3 cursor-pointer hover:opacity-80 transition-opacity mt-4" onClick={handleDeleteAccount}>
                        <span className="font-bold text-bloodRed/60 uppercase tracking-widest text-xs">
                            {deleting ? 'Deleting...' : 'Delete Account'}
                        </span>
                    </div>
                </section>

            </main>
        </div>
    );
}
