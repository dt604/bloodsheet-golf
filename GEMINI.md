# 🩸 BloodSheet Golf — Antigravity (Gemini) Mission Control

## 🤖 Agent Roles
- **Claude (Backend/Logic)**: Focuses on Supabase wiring, DB schema, and raw performance. (Ref: `CLAUDE.md`)
- **Antigravity (UI/UX/Polish)**: Focuses on the "Premium" feel, pixel-perfect design, animations, and making the user go "WOW." Ensure "Sunlight Mode" consistency.

## 🎨 Design System: "Sunlight Mode"
- **Background**: `#1C1C1E` (OLED Black/Deep Grey)
- **Primary Accent**: `#FF003F` (Blood Red)
- **Secondary Accent**: `#00FF66` (Neon Green)
- **Typography**: Heavy, Condensed, Black-weight headers for a "Sporty/Premium" feel.
- **Micro-interactions**: Use subtle blurs, glassmorphism (`backdrop-blur`), and glowing shadows (`drop-shadow`) for active states.

## 🚀 Progress Tracker
### Recently Completed
- [x] **Handicap System Documentation**: Explained the "Red Dot" system (Relative to Lowest HCP).
- [x] **Scorecard Component Audit**: Verified dot rendering logic in `LiveScorecard` and `PastMatchScorecard`.


### In Progress / Upcoming Polish
- [ ] **Interactive Onboarding**: Ensure the "Join Match" flow feels seamless with haptic-style animations.
- [ ] **Vibrant Results**: Add "Winner" confetti or premium transitions in the Final Ledger.
- [ ] **Real-time Feedback**: Visual "pings" when another player updates their score.

### 🪙 Active Feature Planning: Blood Coins (Virtual Currency)
*Note: Paused on active UI development to avoid merge conflicts with Claude's social feature (Likes, Comments, Shares) work.*
- [x] **Blood Coin Integration**: Integrated Blood Coins as a wager currency in Match Setup and Ledger.
- [x] **Dual Wager System**: Players can now place BOTH a USD wager AND a Blood Coin wager on the same match. Redesigned "The Stakes" UI with two distinct, prominent panels.
- [x] **Ledger Integration**: Match outcomes can now be settled using Blood Coins, with automatic wallet transfers.
- [x] **Wallet Dashboard UI**: Designed dark, premium dashboard with #FF003F glowing core elements.
- [x] **Coin Iconography**: High-quality SVG of Blood Coin implemented with glowing core.
- [x] **Micro-animations**: "Payout" logic ready through Supabase rpc.

## 🛠 Project Nuances
- **The "Red Dot" Rule**: Dots are rendered on the `n` hardest holes where `n` is the handicap difference from the lowest player.
- **Team B**: Always use Blood Red accents to differentiate from Team A (Green/Standard).
- **Trash Icons**: Ensure `Target` (Greenie), `Droplets` (Sandie), and `Worm` (Snake) icons maintain high-contrast colors.

## 📝 Stubs & Technical Debt (UI Side)
- Venmo button is a `variant="outline"` stub.
- Dashboard lifetime stats need a "Premium" transition once calculated.
