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
    giant: 240
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
                    className="absolute inset-0 rounded-full backface-hidden"
                    style={{ transform: 'translateZ(3px)' }}
                >
                    <CoinFace />
                </div>

                {/* Back Face (Mirrored) */}
                <div
                    className="absolute inset-0 rounded-full backface-hidden"
                    style={{ transform: 'translateZ(-3px) rotateY(180deg)' }}
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
            className="w-full h-full drop-shadow-[0_0_12px_rgba(255,0,63,0.4)]"
        >
            {/* Outer Deep Metal Rim */}
            <circle cx="50" cy="50" r="48" fill="url(#coin-metal-outer)" stroke="#000" strokeWidth="1" />

            {/* Inner Ridges (Coin texture) */}
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="1 2" />

            {/* Main Metal Face */}
            <circle cx="50" cy="50" r="42" fill="url(#coin-metal-inner)" stroke="#1a1a1c" strokeWidth="2" />

            {/* Beveled Edge highlight */}
            <circle cx="50" cy="50" r="41.5" fill="none" stroke="url(#rim-light)" strokeWidth="1" />

            {/* Glowing Blood Core Foundation */}
            <circle cx="50" cy="50" r="32" fill="#050505" />
            <circle cx="50" cy="50" r="30" fill="url(#blood-liquid-core)" filter="url(#fluid-glow)" />

            {/* The "B" BloodSheet Icon (High Polish Chrome) */}
            <g filter="url(#logo-shadow)">
                <path
                    d="M40 30 L55 30 C63 30 65 35 65 42.5 C65 48 60 50 55 50 L40 50 Z"
                    fill="url(#logo-chrome)"
                />
                <path
                    d="M40 50 L58 50 C66 50 68 55 68 62.5 C68 69 64 72 55 72 L40 72 Z"
                    fill="url(#logo-chrome)"
                />
                {/* Slashes */}
                <rect x="38" y="25" width="4" height="50" rx="2" fill="url(#logo-chrome)" />
                <rect x="46" y="25" width="4" height="50" rx="2" fill="url(#logo-chrome)" />
            </g>

            {/* Surface Glass Reflection */}
            <path
                d="M 25 35 Q 50 20 75 35"
                fill="none"
                stroke="white"
                strokeOpacity="0.15"
                strokeWidth="2"
                strokeLinecap="round"
            />

            <defs>
                <linearGradient id="coin-metal-outer" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3a3a3e" />
                    <stop offset="50%" stopColor="#1a1a1c" />
                    <stop offset="100%" stopColor="#0a0a0b" />
                </linearGradient>

                <linearGradient id="coin-metal-inner" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#2c2c31" />
                    <stop offset="50%" stopColor="#1a1a1c" />
                    <stop offset="100%" stopColor="#121214" />
                </linearGradient>

                <linearGradient id="rim-light" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
                    <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
                </linearGradient>

                <radialGradient id="blood-liquid-core" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
                    <stop offset="0%" stopColor="#FF003F" />
                    <stop offset="60%" stopColor="#8B0000" />
                    <stop offset="100%" stopColor="#300000" />
                </radialGradient>

                <linearGradient id="logo-chrome" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="20%" stopColor="#9a9a9a" />
                    <stop offset="50%" stopColor="#ffffff" />
                    <stop offset="80%" stopColor="#7a7a7a" />
                    <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>

                <filter id="fluid-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <filter id="logo-shadow">
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.5" />
                </filter>
            </defs>
        </svg>
    );
}
