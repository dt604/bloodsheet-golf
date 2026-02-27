import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {

    // Lock body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <>
            <style>{`
                @keyframes bsBackdropIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes bsSlideUp {
                    from { transform: translate(-50%, 100%); }
                    to { transform: translate(-50%, 0); }
                }
            `}</style>

            {/* Full-screen overlay — portaled to body */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
            }}>
                {/* Backdrop */}
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(4px)',
                        WebkitBackdropFilter: 'blur(4px)',
                        animation: 'bsBackdropIn 0.2s ease-out forwards',
                    }}
                />

                {/* Sheet — pinned to bottom of viewport */}
                <div
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        left: '50%',
                        width: '100%',
                        maxWidth: 480,
                        maxHeight: '80vh',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#2C2C2E',
                        borderTop: '1px solid #3A3A3C',
                        borderRadius: '16px 16px 0 0',
                        animation: 'bsSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards',
                        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                    }}
                >
                    {/* Drag handle */}
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                    </div>

                    {/* Header with Done button */}
                    {title && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 20px 12px',
                            borderBottom: '1px solid #3A3A3C',
                            flexShrink: 0,
                        }}>
                            <h3 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fff', margin: 0 }}>
                                {title}
                            </h3>
                            <button
                                onClick={onClose}
                                style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: '#FF003F',
                                    background: 'none',
                                    border: 'none',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    borderRadius: 8,
                                }}
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {/* Scrollable content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
                    }}>
                        {children}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
