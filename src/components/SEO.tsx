import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    type?: string;
    url?: string;
    image?: string;
}

export default function SEO({
    title = 'BloodSheet Golf',
    description = 'The ultimate golf scorecard and side-bet tracking app. Automatically track Snakes, Sandies, Dots, and handicaps effortlessly.',
    type = 'website',
    url,
    image = '/favicon.png', // Assuming favicon or opengraph image
}: SEOProps) {
    const fullTitle = title === 'BloodSheet Golf' ? title : `${title} | BloodSheet Golf`;
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://bloodsheet.golf';
    const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : siteUrl);
    const imageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`;

    return (
        <Helmet>
            {/* Primary Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="title" content={fullTitle} />
            <meta name="description" content={description} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={imageUrl} />

            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={currentUrl} />
            <meta property="twitter:title" content={fullTitle} />
            <meta property="twitter:description" content={description} />
            <meta property="twitter:image" content={imageUrl} />
        </Helmet>
    );
}
