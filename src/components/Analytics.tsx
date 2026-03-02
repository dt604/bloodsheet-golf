import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
    }
}

interface AnalyticsProps {
    trackingId?: string;
}

export default function Analytics({ trackingId }: AnalyticsProps) {
    const location = useLocation();

    useEffect(() => {
        if (!trackingId) return;

        // Guard against multiple initializations
        if (document.getElementById('ga-script')) return;

        // Inject GA script
        const script = document.createElement('script');
        script.id = 'ga-script';
        script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
        script.async = true;

        // Use requestIdleCallback or setTimeout to defer non-critical analytics loading
        // to ensure it doesn't block the main thread during initial hydration 
        // or affect First Contentful Paint.
        const loadScript = () => document.head.appendChild(script);

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(loadScript);
        } else {
            setTimeout(loadScript, 1000);
        }

        // Initialize dataLayer and gtag function
        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() {
            // eslint-disable-next-line prefer-rest-params
            window.dataLayer.push(arguments);
        };

        window.gtag('js', new Date());
        window.gtag('config', trackingId, {
            page_path: window.location.pathname,
        });
    }, [trackingId]);

    // Track page views on route configuration change
    useEffect(() => {
        if (!trackingId) return;

        if (typeof window.gtag === 'function') {
            window.gtag('config', trackingId, {
                page_path: location.pathname + location.search,
            });
        }
    }, [location, trackingId]);

    return null;
}
