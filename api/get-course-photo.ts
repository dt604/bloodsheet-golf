import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    let { query } = req.query;
    // Prefer non-VITE prefix for server-side if it exists, but fall back to VITE_ version
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Google Maps API Key not configured on Vercel' });
    }

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
    }

    // Clean query: remove bullet points and everything after (city, state, etc)
    // Example: "Aguila Golf Course • Laveen, Arizona" -> "Aguila Golf Course"
    const cleanedQuery = query.split('•')[0].trim();

    try {
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(cleanedQuery + ' golf course')}&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.status === 'REQUEST_DENIED') {
            return res.status(403).json({ error: searchData.error_message || 'API Request Denied' });
        }

        if (searchData.results && searchData.results.length > 0) {
            const place = searchData.results[0];
            if (place.photos && place.photos.length > 0) {
                const photoRef = place.photos[0].photo_reference;
                const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${apiKey}`;
                return res.status(200).json({ imageUrl: photoUrl });
            }
        }

        return res.status(200).json({ imageUrl: null });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
