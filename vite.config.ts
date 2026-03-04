import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'course-photo-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/get-course-photo')) {
              const url = new URL(req.url, `http://${req.headers.host}`);
              const query = url.searchParams.get('query');
              const apiKey = env.VITE_GOOGLE_MAPS_API_KEY;

              if (!apiKey) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'VITE_GOOGLE_MAPS_API_KEY missing in .env' }));
                return;
              }

              if (!query) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Query is required' }));
                return;
              }

              const cleanedQuery = query.split('•')[0].trim();

              try {
                const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(cleanedQuery + ' golf course')}&key=${apiKey}`;
                const searchRes = await fetch(searchUrl);
                const searchData = await searchRes.json();

                if (searchData.results && searchData.results.length > 0) {
                  const place = searchData.results[0];
                  if (place.photos && place.photos.length > 0) {
                    const photoRef = place.photos[0].photo_reference;
                    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${apiKey}`;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ imageUrl: photoUrl }));
                    return;
                  }
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ imageUrl: null }));
              } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
              }
              return;
            }
            next();
          });
        }
      }
    ],
    server: {
      host: true,
    },
  }
})
