
import { cn } from '../../lib/utils';
import { Card } from './Card';

interface StatBoxProps {
    label: string;
    value: string | number;
    valueColor?: 'white' | 'neonGreen' | 'bloodRed';
    className?: string;
}

export function StatBox({ label, value, valueColor = 'white', className }: StatBoxProps) {
    const colorClasses = {
        white: 'text-primaryText',
        neonGreen: 'text-neonGreen',
        bloodRed: 'text-bloodRed',
    };

    return (
        <Card className={cn('p-3 sm:p-4 flex flex-col items-center justify-center text-center overflow-hidden', className)}>
            <div className="text-secondaryText text-[10px] sm:text-xs font-semibold mb-1 uppercase tracking-wider truncate w-full">{label}</div>
            <div className={cn('text-2xl sm:text-3xl font-black font-sans leading-none', colorClasses[valueColor])}>{value}</div>
        </Card>
    );
}
