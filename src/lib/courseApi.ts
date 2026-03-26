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

function extractHoles(apiCourse: ApiCourse, teeKey?: string): Course['holes'] {
  if (apiCourse.scorecard && apiCourse.scorecard.length > 0) {
    return apiCourse.scorecard.map((entry) => {
      const tee = teeKey ? entry.tees[teeKey] : Object.values(entry.tees)[0];
      return {
        number: entry.Hole,
        par: entry.Par,
        strokeIndex: entry.Handicap || entry.Hole,
        yardage: tee?.yards ?? 400,
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

function extractTeeOptions(apiCourse: ApiCourse): {
  tees: Array<{ key: string; color: string }>;
  yardages: Record<string, number[]>;
} {
  if (!apiCourse.scorecard?.length) return { tees: [], yardages: {} };
  const keys = Object.keys(apiCourse.scorecard[0].tees);
  const tees = keys.map(k => ({
    key: k,
    color: apiCourse.scorecard![0].tees[k].color || k,
  }));
  const yardages: Record<string, number[]> = {};
  for (const key of keys) {
    yardages[key] = apiCourse.scorecard.map(entry => entry.tees[key]?.yards ?? 400);
  }
  return { tees, yardages };
}

export async function fetchCourseImage(name: string): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/get-course-photo?query=${encodeURIComponent(name)}`);
    if (!res.ok) {
      const err = await res.json();
      console.error('Proxy Error:', err.error);
      return undefined;
    }
    const data = await res.json();
    return data.imageUrl || undefined;
  } catch (err) {
    console.error('Error fetching course image via proxy:', err);
    return undefined;
  }
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

  return coursesRaw.filter((c) => c.name).map((c) => {
    const { tees, yardages } = extractTeeOptions(c);
    return {
      id: c._id,
      name: c.name + (c.city ? ` • ${c.city}, ${c.state}` : ''),
      holes: extractHoles(c), // defaults to first tee until user picks
      availableTees: tees.length > 1 ? tees : undefined,
      allTeeYardages: tees.length > 1 ? yardages : undefined,
    };
  });
}
