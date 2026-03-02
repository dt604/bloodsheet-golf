import { LucideIcon, Flag } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: LucideIcon;
    actionLabel?: string;
    onAction?: () => void;
    accentColor?: 'bloodRed' | 'neonGreen' | 'secondaryText';
    className?: string;
}

export function EmptyState({
    icon: Icon = Flag,
    title,
    description,
    actionLabel,
    onAction,
    accentColor = 'bloodRed'
}: EmptyStateProps) {
    const colorClass = {
        bloodRed: 'text-bloodRed border-bloodRed/20 bg-bloodRed/10',
        neonGreen: 'text-neonGreen border-neonGreen/20 bg-neonGreen/10',
        secondaryText: 'text-secondaryText border-secondaryText/20 bg-secondaryText/10'
    }[accentColor];

    const shadowClass = {
        bloodRed: 'shadow-[0_0_30px_rgba(255,0,63,0.2)]',
        neonGreen: 'shadow-[0_0_30px_rgba(0,255,102,0.2)]',
        secondaryText: 'shadow-[0_0_30px_rgba(161,161,170,0.2)]'
    }[accentColor];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center p-8 text-center"
        >
            <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 border ${colorClass} ${shadowClass} transition-transform hover:scale-110 duration-500`}>
                <Icon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2 italic">
                {title}
            </h3>
            <p className="text-sm text-secondaryText max-w-[240px] leading-relaxed mb-6">
                {description}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className={`text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all active:scale-95`}
                >
                    {actionLabel}
                </button>
            )}
        </motion.div>
    );
}
