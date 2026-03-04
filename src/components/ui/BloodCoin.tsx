import React from 'react';

interface BloodCoinProps extends React.SVGProps<SVGSVGElement> {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizeMap = {
    xs: 16,
    sm: 24,
    md: 40,
    lg: 64,
    xl: 100
};

export function BloodCoin({ size = "md", className = "", ...props }: BloodCoinProps) {
    const dimension = sizeMap[size];
    return (
        <svg
            width={dimension}
            height={dimension}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`drop-shadow-[0_8px_16px_rgba(255,0,63,0.3)] ${className}`}
            {...props}
        >
            {/* Outer Gunmetal Edge */}
            <circle cx="50" cy="50" r="48" fill="url(#gunmetal-gradient)" stroke="#111" strokeWidth="2" />

            {/* Top Light Reflection on Outer Edge */}
            <path d="M 6 50 A 44 44 0 0 1 94 50" fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="2" strokeLinecap="round" />

            {/* Inner Metallic Ring */}
            <circle cx="50" cy="50" r="38" fill="none" stroke="url(#metallic-ring)" strokeWidth="3" />

            {/* Deep well shadow before core */}
            <circle cx="50" cy="50" r="34" fill="#0A0A0B" fillOpacity="0.9" />
            <circle cx="50" cy="50" r="34" fill="none" stroke="black" strokeWidth="4" />

            {/* Glowing Blood Core */}
            <circle cx="50" cy="50" r="30" fill="url(#blood-core)" filter="url(#core-glow)" />

            {/* Inner jewel highlight (Glass reflection) */}
            <ellipse cx="50" cy="35" rx="15" ry="8" fill="white" fillOpacity="0.2" filter="blur(1px)" />

            {/* Diagonal slashed 'B' / BloodSheet Iconography */}
            <path
                d="M45 35 L55 35 Q62 35 62 42.5 Q62 48 56 49.5 Q64 51 64 58.5 Q64 65 55 65 L41 65 Z"
                fill="none"
                stroke="white"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.9"
            />
            {/* Double strike through */}
            <path d="M40 30 L40 70 M48 30 L48 70" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />

            <defs>
                <linearGradient id="gunmetal-gradient" x1="0" y1="0" x2="100" y2="100">
                    <stop offset="0%" stopColor="#4A4A4F" />
                    <stop offset="30%" stopColor="#2A2A2E" />
                    <stop offset="70%" stopColor="#1C1C1E" />
                    <stop offset="100%" stopColor="#0B0B0C" />
                </linearGradient>

                <linearGradient id="metallic-ring" x1="0" y1="100" x2="100" y2="0">
                    <stop offset="0%" stopColor="#111111" />
                    <stop offset="50%" stopColor="#555555" />
                    <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>

                <radialGradient id="blood-core" cx="45%" cy="30%" r="60%">
                    <stop offset="0%" stopColor="#FF1A4A" />
                    <stop offset="50%" stopColor="#CC0029" />
                    <stop offset="100%" stopColor="#4D000F" />
                </radialGradient>

                <filter id="core-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
        </svg>
    );
}
