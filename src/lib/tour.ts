import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const baseDriverConfig = {
    showProgress: false,
    animate: true,
    overlayColor: 'rgba(0, 0, 0, 0.8)',
    allowClose: true,
    stagePadding: 4,
    stageRadius: 10,
};

let activeDriver: any = null;
let isKilledExplicitly = false;

export const killTour = () => {
    if (activeDriver) {
        isKilledExplicitly = true;
        activeDriver.destroy();
        activeDriver = null;
        // resetting it immediately after might cause race conditions if destroy() is async, 
        // but driver.js destroy is synchronous. Still, safest to reset it to false right after.
        isKilledExplicitly = false;
    }
};

export const startDashboardTour = (onComplete: () => void) => {
    const driverObj = driver({
        ...baseDriverConfig,
        steps: [
            {
                element: '#new-match-btn',
                popover: {
                    title: 'Start Your Legacy',
                    description: 'Tee off and dominate the course. This is where your journey begins.',
                    side: 'bottom',
                    align: 'center',
                }
            }
        ],
        onDestroyed: () => {
            if (!isKilledExplicitly) {
                onComplete();
            }
            activeDriver = null;
        },
        popoverClass: 'bloodsheet-tour-theme'
    });

    activeDriver = driverObj;

    // Handle auto-close when clicking the button
    const btn = document.querySelector('#new-match-btn');
    if (btn) {
        const handleClick = () => {
            driverObj.destroy();
            btn.removeEventListener('click', handleClick);
        };
        btn.addEventListener('click', handleClick);
    }

    driverObj.drive();
};

export const startMatchFormatTour = (onComplete: () => void, stepIndex: number = 0) => {
    const driverObj = driver({
        ...baseDriverConfig,
        steps: [
            {
                element: '#format-1v1-btn',
                popover: {
                    title: 'Individual Glory',
                    description: 'The classic 1v1 match play. Track gross scores and skin differences.',
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#format-2v2-btn',
                popover: {
                    title: 'Team Warfare',
                    description: 'Four players, two teams. Coordinate with your partner to crush the opposition.',
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#format-skins-btn',
                popover: {
                    title: 'The Skins Game',
                    description: 'Every hole is a separate battle for a skin. No partner? No problem.',
                    side: 'bottom',
                    align: 'center',
                }
            }
        ],
        onDestroyed: () => {
            if (!isKilledExplicitly) {
                onComplete();
            }
            activeDriver = null;
        },
        popoverClass: 'bloodsheet-tour-theme'
    });

    activeDriver = driverObj;
    driverObj.drive(stepIndex);
};

export const startMatchSetupTour = (onComplete: () => void, stepIdx: number = 0, isSkins: boolean = false) => {
    const steps: any[] = [
        {
            element: '#add-players-btn',
            popover: {
                title: 'Add Your Rivals',
                description: "Add all the golfers in your group here. You can pick up to four players for your round pool.",
                side: 'bottom',
                align: 'center',
            }
        }
    ];

    if (isSkins) {
        steps.push({
            element: '#team-skins-toggle',
            popover: {
                title: 'Team Skins?',
                description: "Toggle this to play 2v2 Team Skins instead of individual. Best ball format with skin carry-overs!",
                side: 'bottom',
                align: 'center',
            }
        });
    }

    steps.push({
        element: '#tee-off-btn',
        popover: {
            title: 'Ready to Roll?',
            description: "Your group is full! Hit Continue to set up the matches.",
            side: 'top',
            align: 'center',
        }
    });

    const driverObj = driver({
        ...baseDriverConfig,
        steps,
        onDestroyed: () => {
            if (!isKilledExplicitly) {
                onComplete();
            }
            activeDriver = null;
        },
        popoverClass: 'bloodsheet-tour-theme'
    });

    activeDriver = driverObj;
    if (stepIdx > 0) {
        driverObj.drive(stepIdx);
    } else {
        driverObj.drive();
    }
};

export const startMatch2v2SetupTour = (onComplete: () => void, stepIdx: number = 0) => {
    const driverObj = driver({
        ...baseDriverConfig,
        steps: [
            {
                element: '#add-teammate-btn',
                popover: {
                    title: 'Pick a Partner',
                    description: "Select a teammate for your 2v2 match.",
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#add-opponent-btn',
                popover: {
                    title: 'The Opposition',
                    description: "Add two opponents to complete your foursome.",
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#tee-off-btn',
                popover: {
                    title: 'Ready to Roll?',
                    description: "Teams are full! Hit Continue to set up the matches.",
                    side: 'top',
                    align: 'center',
                }
            }
        ],
        onDestroyed: () => {
            if (!isKilledExplicitly) {
                onComplete();
            }
            activeDriver = null;
        },
        popoverClass: 'bloodsheet-tour-theme'
    });

    activeDriver = driverObj;
    if (stepIdx > 0) {
        driverObj.drive(stepIdx);
    } else {
        driverObj.drive();
    }
};

export const startMatchStrokesTour = (onComplete: () => void, isMultiMatch: boolean = true) => {
    const steps: any[] = [
        {
            element: '.tour-strokes-section',
            popover: {
                title: 'Handicap & Strokes',
                description: isMultiMatch
                    ? "This is where you adjust the strokes for the match. We've auto-populated a default opponent, but you can change it or add more matches."
                    : "This is where you adjust the strokes for your 2v2 match. We've calculated the differential based on your handicaps.",
                side: 'bottom',
                align: 'center',
            }
        }
    ];

    if (isMultiMatch) {
        steps.push({
            element: '#add-match-btn',
            popover: {
                title: 'Multi-Match Setup',
                description: "Want to play multiple 1v1s at once? Use this button to add another match against a different opponent in your group.",
                side: 'bottom',
                align: 'end',
            }
        });
    }

    const driverObj = driver({
        ...baseDriverConfig,
        steps,
        onDestroyed: () => {
            if (!isKilledExplicitly) {
                onComplete();
            }
            activeDriver = null;
        },
        popoverClass: 'bloodsheet-tour-theme'
    });

    activeDriver = driverObj;
    driverObj.drive();
};

export const startMatchConfigTour = (onComplete: () => void, stepIndex: number = 0) => {
    const driverObj = driver({
        ...baseDriverConfig,
        steps: [
            {
                element: '#course-search-box',
                popover: {
                    title: 'Select the Battlefield',
                    description: "Search for your course. We support over 40,000 courses worldwide.",
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#real-money-wager',
                popover: {
                    title: 'Real Money Stakes',
                    description: "Set the wager for the match. Match play is split across Front, Back, and Overall.",
                    side: 'top',
                    align: 'center',
                }
            },
            {
                element: '#blood-coins-wager',
                popover: {
                    title: 'Blood Coins',
                    description: "Wager virtual currency for extra bragging rights. No wallet required.",
                    side: 'top',
                    align: 'center',
                }
            },
            {
                element: '#trash-bets-btn',
                popover: {
                    title: 'Trash & Side Bets',
                    description: "The spice of life. Tweak your Greenies, Sandies, and Snakes here.",
                    side: 'top',
                    align: 'center',
                }
            },
            {
                element: '#tee-off-btn',
                popover: {
                    title: 'Final Reckoning',
                    description: "Everything set? Hit Tee Off to start the carnage.",
                    side: 'top',
                    align: 'center',
                }
            }
        ],
        onDestroyed: () => {
            if (!isKilledExplicitly) {
                onComplete();
            }
            activeDriver = null;
        },
        popoverClass: 'bloodsheet-tour-theme'
    });

    activeDriver = driverObj;
    driverObj.drive(stepIndex);
};

export const startOnboardingTour = (onComplete: () => void, stepIndex: number = 0) => {
    const driverObj = driver({
        ...baseDriverConfig,
        steps: [
            {
                element: '#nickname-input',
                popover: {
                    title: 'Your Legend Starts Here',
                    description: "Pick a nickname that will strike fear into your opponents on the leaderboard.",
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#country-select',
                popover: {
                    title: 'Represent Your Nation',
                    description: "Stand tall behind your flag. This will show up next to your name in every match.",
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#handicap-input',
                popover: {
                    title: 'Establish Your Index',
                    description: "Enter your current handicap. This ensures fair matches through our 'Red Dot' system.",
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#avatar-picker',
                popover: {
                    title: 'Pick Your Look',
                    description: "Select one of our premium avatars or upload your own to be recognized on the leaderboard.",
                    side: 'bottom',
                    align: 'center',
                }
            },
            {
                element: '#founder-callout',
                popover: {
                    title: 'The BloodSheet Community',
                    description: "I've added myself as your first friend. We're competitive but fair here.",
                    side: 'top',
                    align: 'center',
                }
            },
            {
                element: '#tee-it-up-btn',
                popover: {
                    title: 'Enter the Arena',
                    description: "Everything set? Let's get you to the dashboard.",
                    side: 'top',
                    align: 'center',
                }
            }
        ],
        onDestroyed: () => {
            if (!isKilledExplicitly) {
                onComplete();
            }
            activeDriver = null;
        },
        popoverClass: 'bloodsheet-tour-theme'
    });

    activeDriver = driverObj;
    driverObj.drive(stepIndex);
};
