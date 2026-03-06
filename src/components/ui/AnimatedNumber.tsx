
import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';

interface AnimatedNumberProps {
    value: number;
    prefix?: string;
    suffix?: string;
    className?: string;
    duration?: number;
    precision?: number;
}

export function AnimatedNumber({
    value,
    prefix = '',
    suffix = '',
    className = '',
    duration = 1.5,
    precision = 0
}: AnimatedNumberProps) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const controls = animate(displayValue, value, {
            duration,
            onUpdate: (latest) => setDisplayValue(latest)
        });
        return () => controls.stop();
    }, [value, duration]);

    return (
        <span className={className}>
            {prefix}
            {displayValue.toFixed(precision)}
            {suffix}
        </span>
    );
}
