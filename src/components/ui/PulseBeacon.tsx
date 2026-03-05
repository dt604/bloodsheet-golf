import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface PulseBeaconProps {
    className?: string;
    color?: 'bloodRed' | 'neonGreen' | 'white';
    size?: 'sm' | 'md' | 'lg';
}

export const PulseBeacon: React.FC<PulseBeaconProps> = ({
    className,
    color = 'neonGreen',
    size = 'md'
}) => {
    const colorMap = {
        bloodRed: 'bg-bloodRed shadow-[0_0_12px_rgba(255,0,63,0.6)]',
        neonGreen: 'bg-neonGreen shadow-[0_0_12px_rgba(0,255,102,0.6)]',
        white: 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]',
    };

    const pingColorMap = {
        bloodRed: 'bg-bloodRed',
        neonGreen: 'bg-neonGreen',
        white: 'bg-white',
    };

    const sizeMap = {
        sm: 'w-1.5 h-1.5',
        md: 'w-2.5 h-2.5',
        lg: 'w-3.5 h-3.5',
    };

    return (
        <div className={cn("relative flex items-center justify-center", sizeMap[size], className)}>
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className={cn(
                    "relative z-10 w-full h-full rounded-full transition-colors",
                    colorMap[color]
                )}
            />
            <div className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-75",
                pingColorMap[color]
            )} />
        </div>
    );
};
