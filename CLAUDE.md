# BloodSheet Golf v1.1 — Claude Instructions

## Project Overview
React + TypeScript + Vite + Tailwind CSS. Mobile-first dark-theme app for match play golf betting with Nassau wagering and trash bets.

## Critical Rules
- **DO NOT modify Tailwind classes or CSS on existing elements.** Only wire logic unless explicitly asked to change styling.
- Keep solutions minimal — no extra error handling, helpers, or abstractions beyond what is asked.

## Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS (dark theme, `#1C1C1E` bg, neon red/green accents)
- Zustand (global state via `src/store/useMatchStore.ts`)
- Supabase (auth + database + realtime)
- RapidAPI golf-course-api for course search

## Key Files
- `src/lib/supabase.ts` — Supabase client
- `src/lib/courseApi.ts` — RapidAPI course search
- `src/contexts/AuthContext.tsx` — Auth state (signIn/signUp/signOut/updateProfile)
- `src/store/useMatchStore.ts` — Zustand store backed by Supabase
- `src/App.tsx` — BrowserRouter > AuthProvider > ProtectedRoute

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase publishable key
- `VITE_RAPIDAPI_KEY` — RapidAPI key for course search

## Database Schema
Run `SCHEMA.sql` in Supabase SQL Editor before anything works.

Tables (snake_case in DB, camelCase in TS):
- `profiles` — extends auth.users (full_name, handicap)
- `courses` — cached RapidAPI data, holes as JSONB
- `matches` — format, wager_amount, wager_type, status, side_bets (JSONB)
- `match_players` — match_id + user_id + team + initial_handicap
- `hole_scores` — PK: (match_id, hole_number, player_id), trash_dots TEXT[]
- `presses` — start_hole, pressed_by_team, status

## Known Stubs / Incomplete Features
- Settings "Delete Account" — not implemented
- Venmo integration — stub button only
- Dashboard lifetime payout — always $0 (needs full ledger calculation)
