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
- [ ] **Naming Conventions**: Finalize name for "The Vault" since 'Vault' is already used (Ideas: *The Treasury, The Stash, Blood Bank, Coin Pouch*).
- [ ] **Wallet Dashboard UI**: Design dark, premium dashboard with #FF003F glowing core elements to display balance and transactions.
- [ ] **Coin Iconography**: Create 3D rendering or high-quality SVG of a gunmetal/blood-red coin for currency displays.
- [ ] **Ledger Integration**: Update match settings and post-match scorecard ledger to accept/display Blood Coins instead of USD.
- [ ] **Micro-animations**: Design the "payout" animation (framer-motion coin fountain) and heavy haptics for transitions.

## 🛠 Project Nuances
- **The "Red Dot" Rule**: Dots are rendered on the `n` hardest holes where `n` is the handicap difference from the lowest player.
- **Team B**: Always use Blood Red accents to differentiate from Team A (Green/Standard).
- **Trash Icons**: Ensure `Target` (Greenie), `Droplets` (Sandie), and `Worm` (Snake) icons maintain high-contrast colors.

## 📝 Stubs & Technical Debt (UI Side)
- Venmo button is a `variant="outline"` stub.
- Dashboard lifetime stats need a "Premium" transition once calculated.
