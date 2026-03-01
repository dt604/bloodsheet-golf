import React from 'react';

interface Step {
    id: number;
    label: string;
    description?: string;
    display?: number;
}

interface StepTrackerProps {
    steps: Step[];
    currentStep: number;
    onStepClick?: (stepId: number) => void;
}

export function StepTracker({ steps, currentStep, onStepClick }: StepTrackerProps) {
    return (
        <div className="flex items-center justify-between w-full px-2 py-4">
            {steps.map((step, idx) => {
                const isCompleted = currentStep > step.id;
                const isActive = currentStep === step.id;
                const isLast = idx === steps.length - 1;

                return (
                    <React.Fragment key={step.id}>
                        {/* Step Circle & Label */}
                        <button
                            onClick={() => onStepClick?.(step.id)}
                            disabled={!onStepClick || (!isCompleted && !isActive)}
                            className="flex flex-col items-center group relative outline-none focus:outline-none"
                        >
                            <div
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 font-black text-xs
                                    ${isActive
                                        ? 'border-bloodRed bg-bloodRed text-white shadow-[0_0_15px_rgba(255,0,63,0.5)] scale-110'
                                        : isCompleted
                                            ? 'border-neonGreen bg-neonGreen/10 text-neonGreen'
                                            : 'border-borderColor bg-surface text-secondaryText'
                                    }
                                `}
                            >
                                {isCompleted ? '✓' : (step.display ?? step.id)}
                            </div>
                            <span
                                className={`absolute -bottom-6 text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors duration-300
                                    ${isActive ? 'text-white' : 'text-secondaryText'}
                                `}
                            >
                                {step.label}
                            </span>
                        </button>

                        {/* Connector Line */}
                        {!isLast && (
                            <div className="flex-1 h-[2px] mx-2 -mt-6">
                                <div
                                    className={`h-full transition-all duration-500 rounded-full
                                        ${isCompleted ? 'bg-neonGreen/40' : 'bg-borderColor'}
                                    `}
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
