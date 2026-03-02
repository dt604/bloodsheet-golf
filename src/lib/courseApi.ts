import { Course } from '../types';

const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY as string;
const RAPIDAPI_HOST = 'golf-course-api.p.rapidapi.com';

// Actual shape returned by the API
interface ApiScorecardEntry {
  Hole: number;
  Par: number;
  Handicap: number; // this IS the stroke index
  tees: Record<string, { color: string; yards: number }>;
}

interface ApiCourse {
  _id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  scorecard?: ApiScorecardEntry[];
}

function extractHoles(apiCourse: ApiCourse): Course['holes'] {
  if (apiCourse.scorecard && apiCourse.scorecard.length > 0) {
    return apiCourse.scorecard.map((entry) => {
      // Use the first available tee box yardage
      const firstTee = Object.values(entry.tees)[0];
      return {
        number: entry.Hole,
        par: entry.Par,
        strokeIndex: entry.Handicap || entry.Hole, // fall back to hole number if API has no handicap data
        yardage: firstTee?.yards ?? 400,
      };
    });
  }

  // Fallback: 18 par-4 holes
  return Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: 4,
    strokeIndex: i + 1,
    yardage: 400,
  }));
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export async function fetchCourseImage(name: string): Promise<string | undefined> {
  if (!GOOGLE_MAPS_API_KEY) return undefined;

  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name + ' golf course')}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const place = data.results[0];
      if (place.photos && place.photos.length > 0) {
        const photoRef = place.photos[0].photo_reference;
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
      }
    }
  } catch (err) {
    console.error('Error fetching course image:', err);
  }
  return undefined;
}

export async function searchCourses(name: string): Promise<Course[]> {
  const url = `https://${RAPIDAPI_HOST}/search?name=${encodeURIComponent(name)}`;
  return fetchAndMapCourses(url);
}

export async function searchNearbyCourses(lat: number, lng: number, radius: number = 25): Promise<Course[]> {
  const url = `https://${RAPIDAPI_HOST}/search?lat=${lat}&lng=${lng}&radius=${radius}`;
  return fetchAndMapCourses(url);
}

async function fetchAndMapCourses(url: string): Promise<Course[]> {
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });

  if (!res.ok) throw new Error(`Course search failed: ${res.status}`);

  const data: ApiCourse[] = await res.json();
  const coursesRaw = Array.isArray(data) ? data : [data];

  return coursesRaw.filter((c) => c.name).map((c) => ({
    id: c._id,
    name: c.name + (c.city ? ` • ${c.city}, ${c.state}` : ''),
    holes: extractHoles(c),
  }));
}
