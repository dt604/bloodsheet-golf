import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FlipHorizontal } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import jsQR from 'jsqr';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'my-code' | 'scan';

export default function QRPage() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const [tab, setTab] = useState<Tab>('my-code');

    // ── Scanner state ───────────────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number>(0);
    const [scanning, setScanning] = useState(false);
    const [camError, setCamError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [detected, setDetected] = useState<string | null>(null);

    const profileUrl = `${window.location.origin}/player/${user?.id}`;

    // Start camera when scan tab is active
    useEffect(() => {
        if (tab !== 'scan') {
            stopCamera();
            return;
        }
        startCamera();
        return () => stopCamera();
    }, [tab, facingMode]);

    async function startCamera() {
        stopCamera();
        setCamError(null);
        setDetected(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setScanning(true);
                rafRef.current = requestAnimationFrame(tick);
            }
        } catch {
            setCamError('Camera access denied. Please allow camera permissions and try again.');
        }
    }

    function stopCamera() {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setScanning(false);
    }

    function tick() {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick);
            return;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
            handleDetected(code.data);
            return;
        }
        rafRef.current = requestAnimationFrame(tick);
    }

    function handleDetected(data: string) {
        stopCamera();
        setDetected(data);
        // If it's a /player/:id URL from this app, navigate there
        try {
            const url = new URL(data);
            if (url.pathname.startsWith('/player/')) {
                navigate(url.pathname);
                return;
            }
        } catch {
            // not a URL — ignore
        }
        // Not a recognised QR — show it and let user decide
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <header className="flex items-center gap-3 p-4 border-b border-borderColor shrink-0 bg-background z-20">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-secondaryText hover:text-white transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="font-black text-lg uppercase italic tracking-tight leading-none">QR Code</h1>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-borderColor shrink-0">
                {(['my-code', 'scan'] as Tab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-colors ${tab === t ? 'text-white border-b-2 border-bloodRed' : 'text-secondaryText'}`}
                    >
                        {t === 'my-code' ? 'My Code' : 'Scan'}
                    </button>
                ))}
            </div>

            {/* ── My Code ──────────────────────────────────────── */}
            {tab === 'my-code' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                    <div className="bg-white p-5 rounded-3xl shadow-[0_0_40px_rgba(255,0,63,0.15)]">
                        <QRCodeSVG
                            value={profileUrl}
                            size={220}
                            bgColor="#ffffff"
                            fgColor="#1C1C1E"
                            level="M"
                        />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="font-black text-white text-xl uppercase italic">{profile?.fullName ?? 'You'}</p>
                        <p className="text-[10px] text-secondaryText font-black uppercase tracking-widest">HCP {profile?.handicap?.toFixed(1) ?? '0.0'}</p>
                    </div>
                    <p className="text-[10px] text-secondaryText font-black uppercase tracking-widest text-center max-w-[240px]">
                        Have a friend scan this to view your profile and send a friend request
                    </p>
                </div>
            )}

            {/* ── Scan ─────────────────────────────────────────── */}
            {tab === 'scan' && (
                <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-black">
                    {camError ? (
                        <div className="p-8 text-center space-y-4">
                            <p className="text-bloodRed font-black uppercase text-sm tracking-wider">{camError}</p>
                            <button onClick={startCamera} className="text-[10px] font-black uppercase tracking-widest text-secondaryText hover:text-white transition-colors">
                                Try Again
                            </button>
                        </div>
                    ) : detected ? (
                        <div className="p-8 text-center space-y-4">
                            <p className="text-white font-black uppercase text-sm tracking-wider">QR code scanned!</p>
                            <p className="text-secondaryText text-xs break-all">{detected}</p>
                            <button onClick={() => { setDetected(null); startCamera(); }} className="text-[10px] font-black uppercase tracking-widest text-bloodRed hover:text-white transition-colors">
                                Scan Again
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Live viewfinder */}
                            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

                            {/* Scan frame overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="relative w-56 h-56">
                                    {/* Corner brackets */}
                                    {[
                                        'top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl',
                                        'top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl',
                                        'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl',
                                        'bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl',
                                    ].map((cls, i) => (
                                        <span key={i} className={`absolute w-8 h-8 border-bloodRed ${cls}`} />
                                    ))}
                                    {/* Scan line */}
                                    {scanning && (
                                        <div className="absolute inset-x-2 h-0.5 bg-bloodRed/70 top-1/2 animate-ping" />
                                    )}
                                </div>
                                <p className="absolute bottom-24 text-[10px] font-black uppercase tracking-widest text-white/60">
                                    Point at a BloodSheet QR code
                                </p>
                            </div>

                            {/* Flip camera */}
                            <button
                                onClick={() => setFacingMode(f => f === 'environment' ? 'user' : 'environment')}
                                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white"
                            >
                                <FlipHorizontal className="w-5 h-5" />
                            </button>
                        </>
                    )}
                    {/* Hidden canvas for jsQR processing */}
                    <canvas ref={canvasRef} className="hidden" />
                </div>
            )}
        </div>
    );
}
