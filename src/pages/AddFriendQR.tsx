import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Status = 'loading' | 'success' | 'already_friends' | 'self' | 'error';

export default function AddFriendQR() {
    const { userId: targetId } = useParams<{ userId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [status, setStatus] = useState<Status>('loading');
    const [friendName, setFriendName] = useState('');

    useEffect(() => {
        if (!user || !targetId) return;

        async function autoAdd() {
            // Can't add yourself
            if (targetId === user!.id) {
                setStatus('self');
                setTimeout(() => navigate('/home'), 2000);
                return;
            }

            // Fetch their name for the success screen
            const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', targetId)
                .maybeSingle();
            setFriendName((profileData as any)?.full_name ?? 'them');

            // Check for existing friendship row
            const { data: existing } = await supabase
                .from('friendships')
                .select('id, status, requester_id, addressee_id')
                .or(`and(requester_id.eq.${user!.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user!.id})`)
                .maybeSingle();

            if (existing) {
                if ((existing as any).status === 'accepted') {
                    setStatus('already_friends');
                    setTimeout(() => navigate('/home'), 2000);
                    return;
                }
                // Accept whatever pending row exists (works if we are the addressee; also try if we're the requester)
                await supabase.from('friendships').update({ status: 'accepted' }).eq('id', (existing as any).id);
                setStatus('success');
                setTimeout(() => navigate('/home'), 2000);
                return;
            }

            // No existing row — insert directly as accepted
            const { error } = await supabase.from('friendships').insert({
                requester_id: user!.id,
                addressee_id: targetId,
                status: 'accepted',
            });

            setStatus(error ? 'error' : 'success');
            setTimeout(() => navigate('/home'), 2000);
        }

        autoAdd();
    }, [user, targetId]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-background text-center">
            {status === 'loading' && (
                <>
                    <div className="w-8 h-8 border-2 border-bloodRed border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-secondaryText">Adding friend…</p>
                </>
            )}
            {status === 'success' && (
                <>
                    <div className="text-5xl">🤝</div>
                    <div>
                        <p className="font-black text-xl text-white uppercase italic">You're friends!</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-secondaryText mt-1">{friendName} has been added</p>
                    </div>
                </>
            )}
            {status === 'already_friends' && (
                <>
                    <div className="text-5xl">✅</div>
                    <div>
                        <p className="font-black text-xl text-white uppercase italic">Already friends</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-secondaryText mt-1">You and {friendName} are already connected</p>
                    </div>
                </>
            )}
            {status === 'self' && (
                <>
                    <div className="text-5xl">🤦</div>
                    <p className="font-black text-xl text-white uppercase italic">That's your own code</p>
                </>
            )}
            {status === 'error' && (
                <>
                    <div className="text-5xl">⚠️</div>
                    <div>
                        <p className="font-black text-xl text-bloodRed uppercase italic">Something went wrong</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-secondaryText mt-1">The DB policy may need to allow accepted on insert — check Supabase RLS</p>
                    </div>
                    <button onClick={() => navigate('/home')} className="text-[10px] font-black uppercase tracking-widest text-secondaryText hover:text-white transition-colors mt-2">Go Home</button>
                </>
            )}
        </div>
    );
}
