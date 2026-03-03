import { ReactNode } from 'react';
import TopHeader from './TopHeader';
import BottomNavigation from './BottomNavigation';

interface MainLayoutProps {
    children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="flex flex-col h-full w-full bg-background relative overflow-hidden text-primaryText font-sans">
            <TopHeader />
            {/* The main scrollable content area */}
            <main className="flex-1 w-full overflow-y-auto no-scrollbar momentum-scroll pb-[100px] px-4 pt-6 space-y-10">
                {children}
            </main>
            <BottomNavigation />
        </div>
    );
}
