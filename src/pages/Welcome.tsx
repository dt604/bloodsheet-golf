import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader, Search } from 'lucide-react';

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

type AuthMode = 'welcome' | 'login' | 'signup' | 'grint' | 'forgot';

export default function WelcomePage() {
    const navigate = useNavigate();
    const { signIn, signUp, signInAsGuest, sendPasswordReset, signInWithGoogle } = useAuth();

    const [authMode, setAuthMode] = useState<AuthMode>('welcome');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [grintSearch, setGrintSearch] = useState('');
    const [searchingGrint, setSearchingGrint] = useState(false);
    const [grintResults, setGrintResults] = useState<any[]>([]);

    const inputClass =
        'block w-full px-4 py-3 border border-borderColor rounded-xl bg-surface text-white placeholder-secondaryText focus:outline-none focus:ring-1 focus:ring-bloodRed focus:border-bloodRed text-sm transition-all';

    function handleContinueToGrint() {
        setError('');
        if (!fullName.trim() || !email.trim() || !password.trim()) { setError('All fields are required.'); return; }
        setAuthMode('grint');
        setGrintSearch(email.trim());
        executeGrintSearch(email.trim());
    }

    async function executeGrintSearch(term: string) {
        if (!term) return;
        setSearchingGrint(true);
        setGrintResults([]);
        try {
            const { data } = await supabase.functions.invoke('grint-search', {
                body: { search: term }
            });
            if (data && data.data) {
                setGrintResults(data.data.map((u: any) => ({
                    grintId: `grint-${u.id}`,
                    fullName: u.name,
                    handicap: parseFloat(u.handicap) || 0,
                    avatarUrl: `https://profile.static.thegrint.com/thumb_${u.image}`,
                    username: u.username
                })));
            }
        } catch (e) {
            console.error(e);
        }
        setSearchingGrint(false);
    }

    async function handleSignUp(selectedGrintProfile?: any) {
        setError('');
        setLoading(true);
        const hcp = selectedGrintProfile?.handicap ?? 0;
        const avatar = selectedGrintProfile?.avatarUrl;
        const grintId = selectedGrintProfile?.grintId;

        const err = await signUp(email, password, fullName.trim(), hcp, avatar, grintId);
        setLoading(false);
        if (err) {
            setError(err);
            setAuthMode('signup'); // Go back to correct info
            return;
        }
        navigate('/home');
    }

    async function handleSignIn() {
        setError('');
        setLoading(true);
        const err = await signIn(email, password);
        setLoading(false);
        if (err) { setError(err); return; }
        navigate('/home');
    }

    async function handleGuestAccess() {
        setError('');
        setLoading(true);
        const err = await signInAsGuest();
        setLoading(false);
        if (err) { setError(err); return; }
        navigate('/join');
    }

    const [resetSent, setResetSent] = useState(false);

    async function handleForgotPassword() {
        setError('');
        if (!email.trim()) { setError('Enter your email address.'); return; }
        setLoading(true);
        const err = await sendPasswordReset(email.trim());
        setLoading(false);
        if (err) { setError(err); return; }
        setResetSent(true);
    }

    return (
        <div
            className="flex-1 flex flex-col bg-background p-6 relative overflow-hidden"
            style={{ backgroundImage: 'url("/welcome-bg.png")' }}
        >
            {/* Dark overlay to ensure text remains readable */}
            <div className="absolute inset-0 bg-background/85 z-0"></div>

            <div className="flex-1 flex flex-col items-center justify-center text-center -mt-8 sm:-mt-16 z-10 relative">
                <div className="w-80 h-80 sm:w-96 sm:h-96 mb-2 sm:mb-4 flex items-center justify-center relative overflow-hidden scale-110">
                    <img
                        src="/logo-final.png"
                        alt="BloodSheet Golf Logo"
                        className="w-full h-full object-contain filter drop-shadow-[0_10px_25px_rgba(255,0,63,0.4)]"
                    />
                </div>

                <p className="text-base sm:text-lg text-white/90 font-semibold mt-2 sm:mt-4 max-w-[280px] sm:max-w-[320px] drop-shadow-md tracking-wide">
                    The ultimate high-stakes match play and Nassau betting ledger.
                </p>
            </div>

            <div className="space-y-4 pb-8 z-10 relative">
                {authMode === 'welcome' && (
                    <>
                        <Button size="lg" className="h-12 sm:h-14 uppercase font-bold tracking-wider text-base sm:text-lg shadow-[0_0_20px_rgba(255,0,63,0.3)]" onClick={() => setAuthMode('signup')}>
                            Create Account
                        </Button>
                        <Button size="lg" variant="secondary" className="uppercase font-bold tracking-wider" onClick={() => setAuthMode('login')}>
                            Log In
                        </Button>
                        <button
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-gray-800 font-bold text-sm hover:bg-gray-100 transition-colors shadow"
                            onClick={signInWithGoogle}
                            disabled={loading}
                        >
                            <GoogleIcon />
                            Continue with Google
                        </button>
                        <button
                            className="w-full text-secondaryText text-sm font-semibold py-2 hover:text-white transition-colors"
                            onClick={handleGuestAccess}
                            disabled={loading}
                        >
                            Watch a Live Match →
                        </button>
                    </>
                )}

                {authMode === 'grint' && (
                    <div className="space-y-4 bg-surface/90 backdrop-blur-xl p-5 sm:p-6 rounded-2xl border border-borderColor shadow-2xl relative z-10 text-left">
                        <div className="flex flex-col mb-2">
                            <span className="text-[10px] text-bloodRed font-bold tracking-[0.2em] mb-1">OPTIONAL</span>
                            <h3 className="text-white font-black tracking-tight text-xl mb-1">Find Your Handicap</h3>
                            <p className="text-secondaryText text-sm">Search The Grint to instantly link your verified index and profile picture.</p>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                className={`${inputClass} pl-11 shadow-inner`}
                                placeholder="Name, Email, or Username"
                                value={grintSearch}
                                onChange={(e) => setGrintSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && executeGrintSearch(grintSearch)}
                            />
                            <Search className="w-5 h-5 text-secondaryText absolute left-4 top-3.5" />
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-2 mt-4 custom-scrollbar">
                            {searchingGrint && (
                                <div className="flex justify-center py-6"><Loader className="w-8 h-8 animate-spin text-bloodRed" /></div>
                            )}
                            {!searchingGrint && grintResults.length === 0 && grintSearch && (
                                <p className="text-secondaryText text-center py-4 font-semibold text-sm">No results found.</p>
                            )}
                            {!searchingGrint && grintResults.map((res: any) => (
                                <button
                                    key={res.grintId}
                                    onClick={() => handleSignUp(res)}
                                    className="w-full text-left flex items-center justify-between p-3 rounded-lg bg-background hover:bg-surfaceHover border border-borderColor transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        {res.avatarUrl && !res.avatarUrl.includes('profile_default') ? (
                                            <img src={res.avatarUrl} alt={res.fullName} className="w-10 h-10 rounded-full object-cover border border-borderColor" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-surfaceHover border border-borderColor flex items-center justify-center text-white font-bold">
                                                {res.fullName.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-white font-bold text-sm tracking-wide group-hover:text-bloodRed transition-colors">
                                                {res.fullName}
                                            </div>
                                            <div className="text-[10px] text-secondaryText font-mono uppercase tracking-widest mt-0.5">
                                                {res.username}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-secondaryText uppercase tracking-widest font-bold mb-0.5">Index</div>
                                        <div className="text-base font-black text-neonGreen leading-none">{res.handicap}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-borderColor mt-4 flex justify-between items-center">
                            <button
                                className="text-secondaryText text-sm font-semibold hover:text-white transition-colors py-2 px-1"
                                onClick={() => setAuthMode('signup')}
                                disabled={loading}
                            >
                                ← Back
                            </button>
                            <button
                                className="text-white text-sm font-bold bg-surfaceHover px-5 py-2.5 rounded-xl border border-borderColor hover:bg-white hover:text-black transition-colors"
                                onClick={() => handleSignUp()}
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Skip for now'}
                            </button>
                        </div>
                    </div>
                )}

                {(authMode === 'signup' || authMode === 'login') && (
                    <div className="space-y-3">
                        {authMode === 'signup' && (
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Full Name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        )}
                        <input
                            type="email"
                            className={inputClass}
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            className={inputClass}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        {error && (
                            <p className="text-bloodRed text-xs font-semibold px-1">{error}</p>
                        )}

                        <Button
                            size="lg"
                            className="uppercase font-bold tracking-wider text-lg shadow-[0_0_20px_rgba(255,0,63,0.3)]"
                            onClick={authMode === 'signup' ? handleContinueToGrint : handleSignIn}
                            disabled={loading}
                        >
                            {loading ? 'Please wait…' : authMode === 'signup' ? 'Next' : 'Log In'}
                        </Button>

                        {authMode === 'login' && (
                            <button
                                className="w-full text-secondaryText text-xs font-semibold py-1 hover:text-white transition-colors text-center"
                                onClick={() => { setAuthMode('forgot'); setError(''); setResetSent(false); }}
                            >
                                Forgot password?
                            </button>
                        )}

                        <div className="flex items-center gap-3 py-1">
                            <div className="flex-1 h-px bg-borderColor" />
                            <span className="text-secondaryText text-xs font-semibold">or</span>
                            <div className="flex-1 h-px bg-borderColor" />
                        </div>

                        <button
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white text-gray-800 font-bold text-sm hover:bg-gray-100 transition-colors shadow"
                            onClick={signInWithGoogle}
                            disabled={loading}
                        >
                            <GoogleIcon />
                            Continue with Google
                        </button>

                        <button
                            className="w-full text-secondaryText text-sm font-semibold py-1 hover:text-white transition-colors"
                            onClick={() => { setAuthMode('welcome'); setError(''); }}
                        >
                            ← Back
                        </button>
                    </div>
                )}

                {authMode === 'forgot' && (
                    <div className="space-y-3">
                        {resetSent ? (
                            <p className="text-neonGreen text-sm font-semibold text-center px-2">
                                Check your email for a reset link.
                            </p>
                        ) : (
                            <>
                                <input
                                    type="email"
                                    className={inputClass}
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                {error && (
                                    <p className="text-bloodRed text-xs font-semibold px-1">{error}</p>
                                )}
                                <Button
                                    size="lg"
                                    className="uppercase font-bold tracking-wider text-lg shadow-[0_0_20px_rgba(255,0,63,0.3)]"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                >
                                    {loading ? 'Sending…' : 'Send Reset Link'}
                                </Button>
                            </>
                        )}
                        <button
                            className="w-full text-secondaryText text-sm font-semibold py-1 hover:text-white transition-colors"
                            onClick={() => { setAuthMode('login'); setError(''); setResetSent(false); }}
                        >
                            ← Back to Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
