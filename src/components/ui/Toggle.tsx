import React from 'react';
import { cn } from '../../lib/utils';

interface ToggleProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    className?: string;
    disabled?: boolean;
}

export function Toggle({ checked, onCheckedChange, disabled = false, className }: ToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            disabled={disabled}
            className={cn(
                'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                checked ? 'bg-bloodRed' : 'bg-surfaceHover',
                className
            )}
        >
            <span
                className={cn(
                    'pointer-events-none block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition-transform',
                    checked ? 'translate-x-5' : 'translate-x-0'
                )}
            />
        </button>
    );
}
