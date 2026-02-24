# Handoff to Backend AI Developer (Claude Code)

## Project: BloodSheet Golf (v1.1)

**Current State:** 
The Front-End UI Scaffolding is **100% Complete**. 
The entire application has been built in React (TypeScript) and heavily customized Tailwind CSS mimicking the high-contrast "Sunlight Mode" mobile designs (dark slate background `#1C1C1E` and neon accents).

### What Has Been Built (The UI)
1.  **Routing (`src/App.tsx`)**: The app is structured using `react-router-dom` across 8 primary mobile views (Welcome, Dashboard, Match Setup, Add Player, Live Scorecard, Live Leaderboard, Final Ledger, Settings).
2.  **Design System (`src/components/ui/`)**: A highly reusable set of primitive components serving as Lego blocks for the app (`<Button>`, `<Card>`, `<StatBox>`, `<Toggle>`).
3.  **Data Types (`src/types/index.ts`)**: The core TypeScript interfaces define the exact shape of a `Match`, `User`, `HoleScore`, `Press`, and course constraints.
4.  **Mock State Management (`src/store/useMatchStore.ts`)**: We currently use a single *Zustand* store to hold **mock** match data locally so the UI can be interacted with.

---

## YOUR GOAL (The Backend Build)

Your primary objective is to **rip out the mock Zustand store** and replace it entirely with a **Supabase Real-Time Backend** and integrate **RapidAPI** for real golf course data.

### Phase 1: Database Setup
1.  Initialize the Supabase client inside the React project.
2.  Generate the Postgres schema representing the data structures defined in `src/types/index.ts`.
3.  Establish Row Level Security (RLS) policies.

### Phase 2: Authentication
1.  Wire up the Log In and Create Account buttons on the `Welcome.tsx` screen to use Supabase Auth (Magic Links or Email/Password).
2.  Ensure the `Dashboard.tsx` pulls the authenticated user's profile and historical stats from the database instead of hardcoded data.

### Phase 3: The Live Betting Engine (Hardest Part)
1.  In `MatchSetup.tsx`, hitting "Tee Off" should instantiate a new `Match` row in Supabase and invite other players.
2.  In `LiveScorecard.tsx`, updating a score (+ or -) must push that `HoleScore` to Supabase instantly.
3.  **Real-time sync:** You must use Supabase Subscriptions/WebSockets so if Player A updates their score from their phone, Player B's `LiveScorecard.tsx` on their device instantly turns green/updates.

### Phase 4: Golf Course API Integration (RapidAPI)
1.  We need to replace the generic hardcoded mock course data with real hole-by-hole data (Par, Yardage, Stroke Index) inside `LiveScorecard.tsx` and `MatchSetup.tsx`.
2.  You must integrate the `golf-course-api` via RapidAPI. 
3.  Here is the cURL snippet the user provided to use as a reference for the connection:
```bash
curl --request GET \
	--url 'https://golf-course-api.p.rapidapi.com/search?name=augusta%20national' \
	--header 'x-rapidapi-host: golf-course-api.p.rapidapi.com' \
	--header 'x-rapidapi-key: 3c93566f2cmsh2538c8adecb10bep1873a6jsn153f5793ad52'
```
4.  **Security Note:** Do not hardcode this key directly in the UI components! Set up an `.env` file (`VITE_RAPIDAPI_KEY`) and manage the calls cleanly, or consider wrapping the call in a Supabase Edge Function to avoid exposing the key entirely on the frontend.

### Design Constraints
*   **DO NOT modify the Tailwind styling, colors, or CSS classes.** The "Sunlight Mode" UI is pixel-perfect to the mockups and must remain untouched. 
*   Focus strictly on wiring the existing input controls `onClick` and `onChange` handlers to actual Supabase API mutations and the RapidAPI endpoints.

Good luck!
