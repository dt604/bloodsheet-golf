import React from 'react';
import { motion } from 'framer-motion';

interface BloodCoinProps {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'giant';
    className?: string;
    animated?: boolean;
}

const sizeMap = {
    xs: 16,
    sm: 24,
    md: 44,
    lg: 80,
    xl: 120,
    giant: 200
};

export function BloodCoin({ size = "md", className = "", animated = true }: BloodCoinProps) {
    const dimension = sizeMap[size];

    // The "wow" factor: A 3D spinning coin container
    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            style={{
                width: dimension,
                height: dimension,
                perspective: '1000px'
            }}
        >
            <motion.div
                className="relative w-full h-full"
                animate={animated ? {
                    rotateY: 360
                } : {}}
                transition={animated ? {
                    duration: 4,
                    repeat: Infinity,
                    ease: "linear"
                } : {}}
                style={{
                    transformStyle: 'preserve-3d'
                }}
            >
                {/* Simulated Thickness (Edge of the coin) */}
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute inset-0 rounded-full"
                        style={{
                            transform: `translateZ(${i - 3}px)`,
                            background: i === 3 ? 'transparent' : '#1a1a1c',
                            border: i === 3 ? 'none' : '1px solid #2a2a2e',
                            boxShadow: i === 3 ? 'none' : 'inset 0 0 10px rgba(255,0,63,0.1)'
                        }}
                    />
                ))}

                {/* Front Face */}
                <div
                    className="absolute inset-0 rounded-full overflow-hidden backface-hidden"
                    style={{ transform: 'translateZ(3px)', clipPath: 'circle(50% at 50% 50%)' }}
                >
                    <CoinFace />
                </div>

                {/* Back Face (Mirrored) */}
                <div
                    className="absolute inset-0 rounded-full overflow-hidden backface-hidden"
                    style={{ transform: 'translateZ(-3px) rotateY(180deg)', clipPath: 'circle(50% at 50% 50%)' }}
                >
                    <CoinFace />
                </div>
            </motion.div>

            {/* Ambient Glow - Fixed in background to prevent spinning glow (looks more natural) */}
            <div
                className="absolute inset-0 rounded-full opacity-20 blur-xl bg-bloodRed pointer-events-none"
                style={{
                    transform: 'scale(1.2) translateZ(-10px)',
                    zIndex: -1
                }}
            />
        </div>
    );
}

function CoinFace() {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-[0_0_15px_rgba(255,0,63,0.5)]"
        >
            <defs>
                {/* Golf Ball Dimple Pattern */}
                <pattern id="dimples" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                    <circle cx="5" cy="5" r="3.5" fill="#1c1c1e" />
                    <circle cx="5.2" cy="5.2" r="3.5" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
                    <circle cx="4.8" cy="4.8" r="3.5" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                </pattern>

                {/* Carbon Fiber Rim Texture */}
                <pattern id="carbon" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
                    <rect width="2" height="2" fill="#111" />
                    <rect x="2" y="2" width="2" height="2" fill="#111" />
                    <rect x="2" width="2" height="2" fill="#1a1a1c" />
                    <rect y="2" width="2" height="2" fill="#1a1a1c" />
                </pattern>

                <linearGradient id="rim-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#333" />
                    <stop offset="50%" stopColor="#111" />
                    <stop offset="100%" stopColor="#222" />
                </linearGradient>

                <radialGradient id="blood-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FF003F" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#FF003F" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="logo-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FF003F" />
                    <stop offset="50%" stopColor="#B2002C" />
                    <stop offset="100%" stopColor="#660014" />
                </linearGradient>

                <filter id="inner-shadow">
                    <feOffset dx="0" dy="2" />
                    <feGaussianBlur stdDeviation="1.5" result="offset-blur" />
                    <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                    <feFlood floodColor="black" floodOpacity="0.8" result="color" />
                    <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                    <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                </filter>
            </defs>

            {/* Outer Rim (Carbon Fiber / Metal) */}
            <circle cx="50" cy="50" r="48" fill="url(#rim-gradient)" stroke="#000" strokeWidth="1" />
            <circle cx="50" cy="50" r="48" fill="url(#carbon)" opacity="0.4" />

            {/* Inner Face with Golf Ball Texture */}
            <circle cx="50" cy="50" r="40" fill="#1c1c1e" stroke="#2a2a2e" strokeWidth="1" />
            <circle cx="50" cy="50" r="39" fill="url(#dimples)" />

            {/* Ambient Red Glow in Center */}
            <circle cx="50" cy="50" r="25" fill="url(#blood-glow)" />

            {/* Refined "B" Logo - Combining a Drop and a Golf Flag/Path */}
            <g filter="url(#inner-shadow)">
                <path
                    d="M38 28 
                       C 38 28, 38 72, 38 72
                       L 55 72 
                       C 68 72, 72 65, 72 58
                       C 72 52, 68 50, 58 50
                       C 65 50, 68 45, 68 40
                       C 68 32, 62 28, 52 28
                       Z
                       M 44 35
                       L 52 35
                       C 58 35, 62 38, 62 42
                       C 62 48, 58 49, 52 49
                       L 44 49
                       Z
                       M 44 55
                       L 55 55
                       C 62 55, 66 58, 66 64
                       C 66 70, 62 70, 55 70
                       L 44 70
                       Z"
                    fill="url(#logo-liquid)"
                    stroke="#FF003F"
                    strokeWidth="0.5"
                    style={{ filter: 'drop-shadow(0 0 5px rgba(255,0,63,0.8))' }}
                />
            </g>

            {/* High Shine Polish */}
            <path
                d="M 30 30 Q 50 15 70 30"
                stroke="white"
                strokeWidth="1.5"
                strokeOpacity="0.2"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    );
}
