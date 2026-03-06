import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

interface UIStore {
    hasSeenDashboardPulse: boolean;
    hasSeenJoinPulse: boolean;
    hasSeenDashboardTour: boolean;
    hasSeenMatchFormatTour: boolean;
    hasSeenMatchSetupTour: boolean;
    hasSeenMatchStrokesTour: boolean;
    hasSeenMatchConfigTour: boolean;
    hasSeenOnboardingTour: boolean;
    setSeenDashboardPulse: (seen: boolean) => void;
    setSeenJoinPulse: (seen: boolean) => void;
    setSeenDashboardTour: (seen: boolean) => void;
    setSeenMatchFormatTour: (seen: boolean) => void;
    setSeenMatchSetupTour: (seen: boolean) => void;
    setSeenMatchStrokesTour: (seen: boolean) => void;
    setSeenMatchConfigTour: (seen: boolean) => void;
    setSeenOnboardingTour: (seen: boolean) => void;
    resetAllTours: () => void;
}

export const useUIStore = create<UIStore>()(
    subscribeWithSelector(
        persist(
            (set) => ({
                hasSeenDashboardPulse: false,
                hasSeenJoinPulse: false,
                hasSeenDashboardTour: false,
                hasSeenMatchFormatTour: false,
                hasSeenMatchSetupTour: false,
                hasSeenMatchStrokesTour: false,
                hasSeenMatchConfigTour: false,
                hasSeenOnboardingTour: false,
                setSeenDashboardPulse: (seen) => set({ hasSeenDashboardPulse: seen }),
                setSeenJoinPulse: (seen) => set({ hasSeenJoinPulse: seen }),
                setSeenDashboardTour: (seen) => set({ hasSeenDashboardTour: seen }),
                setSeenMatchFormatTour: (seen) => set({ hasSeenMatchFormatTour: seen }),
                setSeenMatchSetupTour: (seen) => set({ hasSeenMatchSetupTour: seen }),
                setSeenMatchStrokesTour: (seen) => set({ hasSeenMatchStrokesTour: seen }),
                setSeenMatchConfigTour: (seen) => set({ hasSeenMatchConfigTour: seen }),
                setSeenOnboardingTour: (seen) => set({ hasSeenOnboardingTour: seen }),
                resetAllTours: () => set({
                    hasSeenDashboardTour: false,
                    hasSeenMatchFormatTour: false,
                    hasSeenMatchSetupTour: false,
                    hasSeenMatchStrokesTour: false,
                    hasSeenMatchConfigTour: false,
                    hasSeenOnboardingTour: false,
                    hasSeenDashboardPulse: false,
                    hasSeenJoinPulse: false,
                }),
            }),
            {
                name: 'bloodsheet-ui-storage',
            }
        )
    )
);
