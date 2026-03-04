import React from 'react';
import { motion } from 'framer-motion';
import { usePresenceStore } from '../../store/usePresenceStore';

interface PresenceIndicatorProps {
    userId: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    showLabel?: boolean;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
    userId,
    size = 'md',
    className = '',
    showLabel = false
}) => {
    const isOnline = usePresenceStore((state: any) => state.isUserOnline(userId));

    if (!isOnline && !showLabel) return null;

    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4'
    };

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            <div className="relative">
                {isOnline && (
                    <motion.div
                        animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.5, 0, 0.5],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className={`absolute inset-0 rounded-full bg-neonGreen/40 ${sizeClasses[size]}`}
                    />
                )}
                <div
                    className={`rounded-full border border-black/20 ${sizeClasses[size]} ${isOnline ? 'bg-neonGreen shadow-[0_0_8px_rgba(0,255,102,0.6)]' : 'bg-secondaryText/30'
                        }`}
                />
            </div>
            {showLabel && (
                <span className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-neonGreen' : 'text-secondaryText'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            )}
        </div>
    );
};
