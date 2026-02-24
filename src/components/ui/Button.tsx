import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

        const variants = {
            primary: 'bg-bloodRed text-white hover:bg-bloodRed/90',
            secondary: 'bg-surface text-white hover:bg-surfaceHover',
            outline: 'border border-borderColor bg-transparent hover:bg-surface text-white',
            ghost: 'hover:bg-surface text-white',
            danger: 'bg-transparent text-bloodRed hover:bg-bloodRed/10',
        };

        const sizes = {
            sm: 'h-9 px-3 text-sm',
            md: 'h-11 px-6 text-base',
            lg: 'h-14 px-8 text-lg w-full',
            icon: 'h-10 w-10',
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
