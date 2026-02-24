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
        strokeIndex: entry.Handicap,
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

export async function searchCourses(name: string): Promise<Course[]> {
  const res = await fetch(
    `https://${RAPIDAPI_HOST}/search?name=${encodeURIComponent(name)}`,
    {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    }
  );

  if (!res.ok) throw new Error(`Course search failed: ${res.status}`);

  const data: ApiCourse[] = await res.json();

  return data.map((c) => ({
    id: c._id,
    name: c.name + (c.city ? ` • ${c.city}, ${c.state}` : ''),
    holes: extractHoles(c),
  }));
}
