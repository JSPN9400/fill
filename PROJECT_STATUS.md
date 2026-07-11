# FILLINGS — Project Status
_Upload this file at the start of your next chat with Claude to continue exactly from here._

## Locked decisions
- **Backend**: Node.js + Express, on **Render** → `https://fillings-backend.onrender.com`
- **Frontend**: Plain HTML/CSS/JS, on **GitHub Pages** → `https://jspn9400.github.io/fill/`
- **Database**: PostgreSQL on **Supabase**, pooler region **ap-northeast-1**
- **Repo**: `github.com/JSPN9400/fill`
- **MOCK_MODE=true** everywhere
- **App name: FILLINGS**, design palette inspired by "Aura" reference (rose/berry gradient, Montserrat headings, glow shadows)

## LIVE AND WORKING
- Signup, login, discover/swipe/match/chat, Feelings feed, interest-based ranking, photo upload, profession field

## Bugs found and fixed this session
1. **Desktop split-view CSS bug** — the Matches+Chat side-by-side panel was forced visible via `!important` on ALL screens ≥1000px width, so it showed underneath Discover too. Fixed by scoping it to a `.section-matches` class that JS only adds when actually viewing Matches/Chat.
2. **Root cause of the "have to zoom in/out, feed doesn't scroll properly" complaint**: the whole page was scrolling as one unit instead of each screen's content scrolling independently while the bottom nav stayed fixed. Restructured to a proper mobile-app shell:
   - `.app-frame` is now a fixed `100dvh` (dynamic viewport height) container with `overflow:hidden`
   - `.content` (each screen) is the actual scrolling element (`overflow-y:auto`, `min-height:0`)
   - Bottom nav / top bar / progress bar no longer move — only the feed/form content scrolls beneath them
   - Added safe-area padding (`env(safe-area-inset-*)`) for notch/dynamic-island phones
   - Added `touch-action: manipulation` to remove the double-tap-zoom delay on buttons

## UI redesign (researched current dating-app UX practices: Tinder/Bumble/Hinge minimalism, pill buttons, segmented progress — confirmed our direction, found concrete gaps)
- Adopted an "Aura"-inspired rose/berry palette instead of the Instagram gradient
- Montserrat for headings (more premium feel), slightly larger heading/subtitle sizes for readability without zooming
- Glow shadows on primary buttons and the like/FAB buttons

## NOT yet done / next steps
- [ ] Push + test the scrolling fix live — this was the main complaint, confirm it's actually resolved on a real phone
- [ ] Real photo hosting (Cloudinary) instead of base64-in-database
- [ ] Real-time chat (currently 3-second polling)
- [ ] Daily swipe/message limits per tier
- [ ] Razorpay integration, admin panel, report/block
- [ ] User still needs to run `SELECT id, display_name, gender, interested_in FROM users ORDER BY id;` in Supabase to confirm their 4 test accounts actually have opposite gender/preference combos (matches won't appear otherwise — this is filtering logic, not a bug)

## Files changed this session
- `dating-app-static/style.css` (scroll/viewport structural fix, Aura-inspired palette)
- `dating-app-static/index.html` (Montserrat font link)

## How to avoid hallucination / wasted tokens across sessions
1. At the end of each build session, ask Claude to update this file with what changed.
2. Start each new chat by uploading this file first.
3. Don't ask Claude to "build everything" in one shot — pick one item from the checklist above per session.
