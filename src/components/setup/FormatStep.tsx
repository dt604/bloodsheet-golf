import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';

interface FormatStepProps {
    format: string;
    setFormat: (format: '1v1' | '2v2' | 'skins') => void;
    nextStep: () => void;
}

export function FormatStep({ format, setFormat, nextStep }: FormatStepProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
        >
            <div className="text-sm font-black text-white uppercase tracking-wider mb-4">Choose Match Format</div>
            <div className="grid grid-cols-1 gap-4">
                <button
                    id="format-1v1-btn"
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${format === '1v1' ? 'border-bloodRed bg-bloodRed/5 shadow-[0_0_30px_rgba(255,0,63,0.1)]' : 'border-borderColor bg-surface hover:border-secondaryText'}`}
                    onClick={() => { setFormat('1v1'); nextStep(); }}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${format === '1v1' ? 'bg-bloodRed text-white' : 'bg-surfaceHover text-secondaryText'}`}>
                            <Swords className="w-6 h-6" />
                        </div>
                        {format === '1v1' && (
                            <div className="w-6 h-6 rounded-full bg-bloodRed flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            </div>
                        )}
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-1">1v1 Matches</h3>
                    <p className="text-sm text-secondaryText font-medium">Create one or multiple individual matches. Standard match play scoring.</p>

                    {format === '1v1' && (
                        <div className="absolute right-0 bottom-0 p-4 opacity-20">
                            <Swords className="w-16 h-16" />
                        </div>
                    )}
                </button>

                <button
                    id="format-2v2-btn"
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${format === '2v2' ? 'border-bloodRed bg-bloodRed/5 shadow-[0_0_30px_rgba(255,0,63,0.1)]' : 'border-borderColor bg-surface hover:border-secondaryText'}`}
                    onClick={() => { setFormat('2v2'); nextStep(); }}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${format === '2v2' ? 'bg-bloodRed text-white' : 'bg-surfaceHover text-secondaryText'}`}>
                            <div className="flex -space-x-2">
                                <Swords className="w-5 h-5" />
                                <Swords className="w-5 h-5" />
                            </div>
                        </div>
                        {format === '2v2' && (
                            <div className="w-6 h-6 rounded-full bg-bloodRed flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            </div>
                        )}
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-1">2v2 Team Match</h3>
                    <p className="text-sm text-secondaryText font-medium">Four players, two teams. High-Low or Aggregate scoring options.</p>

                    {format === '2v2' && (
                        <div className="absolute right-0 bottom-0 p-4 opacity-20">
                            <Swords className="w-16 h-16 rotate-45" />
                        </div>
                    )}
                </button>

                <button
                    id="format-skins-btn"
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${format === 'skins' ? 'border-bloodRed bg-bloodRed/5 shadow-[0_0_30px_rgba(255,0,63,0.1)]' : 'border-borderColor bg-surface hover:border-secondaryText'}`}
                    onClick={() => { setFormat('skins'); nextStep(); }}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${format === 'skins' ? 'bg-bloodRed text-white' : 'bg-surfaceHover text-secondaryText'}`}>
                            <span className="text-base font-black leading-none">💀</span>
                        </div>
                        {format === 'skins' && (
                            <div className="w-6 h-6 rounded-full bg-bloodRed flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            </div>
                        )}
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-1">Skins Game</h3>
                    <p className="text-sm text-secondaryText font-medium">2–4 individual players. Each hole is a skin. Ties carry over.</p>

                    {format === 'skins' && (
                        <div className="absolute right-0 bottom-0 p-4 opacity-20">
                            <Swords className="w-16 h-16 -rotate-12" />
                        </div>
                    )}
                </button>
            </div>
        </motion.div>
    );
}
