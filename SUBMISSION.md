# DEV Weekend Challenge Submission: BloodSheet Golf

This is my submission for the **DEV Weekend Challenge: Build for Your Community**.

## 1. The Community
**The Weekly Cash-Game Golf Group.**
We play every weekend. We play for money. We play complicated games: Skins, Team Nassau, Greenies, Sandies, Snakes. We do not want to use an Excel spreadsheet on the 14th hole, and we do not want a generic "score tracking" app that doesn't understand the intricacies of how a "Red Dot" handicap system affects a skins game.

This app is built for us—the competitive amateurs who want a premium, sports-betting style app that settles the bets automatically in the parking lot.

## 2. The Solution
**BloodSheet Golf** is a digital scorecard and settlement engine designed specifically for these high-stakes formats. It replaces the clipboard and the endless group chat math.

### Why it solves the problem:
*   **The "Red Dot" Engine:** Instantly calculates relative handicaps. If you're a 12 and the best player is an 8, you get 4 strokes. The app puts a red dot on the 4 hardest holes instantly.
*   **Rapid Data Entry:** On the course, you don't have time to fiddle with drop-downs. The scorecard is designed for rapid single-tap entry of strokes, and toggles for side-bets (Greenies, Sandies, Snakes).
*   **Automated Ledger:** The hardest part of cash games is the end. BloodSheet calculates every skin won or lost, factors in the side bets, and presents a clear Ledger of who owes whom, ready to settle.
*   **Lifetime Bragging Rights:** The dashboard aggregates your lifetime wins, win rate, and total "BloodSheet" bankroll.

## 3. Tech Stack & Features
The application was built rapidly over the weekend using:
*   **React + Vite** for a fast, responsive frontend.
*   **Tailwind CSS** for a strict "Sunlight Mode" design system: deep OLED blacks (to save phone battery on the course), with high-contrast Blood Red and Neon Green accents.
*   **Framer Motion** for premium sheet-sliding animations and micro-interactions.
*   **Supabase** (Postgres, Auth, RLS) for real-time data syncing, so multiple players can open the scorecard and see the same live leaderboard update instantly.

## 4. Journey & Learnings
The biggest challenge this weekend was the underlying business logic. Calculating a "Pot Style" skins game format vs. a "Per-Skin" format requires iterating through all 18 holes, checking the lowest net score, and dealing with carryovers (when no one wins a hole, the pot rolls over to the next hole).

Writing the algorithm that takes a player's raw score, applies their course handicap relative to the group's "scratch" player, determines the net score for that hole, checks for side bets, and outputs a final dollar figure for the Ledger was an intense but rewarding puzzle.

The app now successfully handles multiple complex wagering structures seamlessly, letting the community focus on the golf, not the math.

## Links
*   **Repo:** [Insert GitHub URL]
*   **Live Demo:** [Insert Vercel URL]

