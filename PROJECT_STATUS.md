# Milan Dating App — Project Status
_Upload this file at the start of your next chat with Claude to continue exactly from here._

## Locked decisions
- **Backend**: Node.js + Express, on **Render** → `https://feelings-dating-app.onrender.com`
- **Frontend**: Plain HTML/CSS/JS, on **GitHub Pages** → `https://jspn9400.github.io/fill/`
- **Database**: PostgreSQL on **Supabase** (pooler connection string, not direct)
- **Repo**: `github.com/JSPN9400/fill`
- **MOCK_MODE=true** everywhere (OTP=123456, Google/face/KYC auto-pass)
- App name: **Milan**

## LIVE AND WORKING
- Full signup flow (phone → OTP → Gmail → face scan camera → ID → profile)
- Login for existing users (Gmail lookup, no re-verification)
- Discover / swipe / match / chat — built and code-reviewed this session, **user needs to push + test live**

## Bugs found and fixed this session
1. **Real, confirmed bug — this was "click not working for find match"**: `discoveryController.js` compared a plain-text parameter against a `gender_enum[]` column without casting (`$3 = ANY(u.interested_in)`), which Postgres rejects with a type error, making `/api/discover` fail silently → fixed to `$3::gender_enum = ANY(...)`.
2. Face-scan step restarted the camera every time the user navigated back to it, discarding an already-captured photo → now shows the existing preview instead if one exists.
3. Replaced all `alert()` popups (match celebration, chat content-filter errors) with proper in-app toast notifications — feels native instead of a browser popup.
4. (Earlier sessions) Express async-error crash, JWT re-signing crash, Render trust-proxy warning, MOCK_MODE env var mismatch on Render — all previously fixed, still in place.

## UI/UX overhaul this session
- Fully responsive: phone (single column, 16px inputs to stop iOS auto-zoom, bigger touch targets), tablet (centered card with shadow), desktop (wide layout, Messenger-style side-by-side Matches + Chat panel, top tab bar instead of bottom nav)
- Toast notification system (bottom-center, auto-dismiss, success/error variants)
- Phone number field: auto-prefixed `+91`, live valid/invalid inline hint, can't accidentally delete the prefix
- Subtle motion/elevation on buttons, chips, match rows (Google/Meta-style quiet interactions, not flashy)
- Login page cleaned up with clear copy and MOCK_MODE hint

## NOT yet done / next steps
- [ ] User needs to copy updated files into their local repo, `git push`, and test discover/swipe/match/chat live on the real deployment
- [ ] Real-time chat (currently 3-second polling, not Socket.io)
- [ ] Photo upload (profiles currently show a 🙂 placeholder — no way to add real `user_media` rows yet)
- [ ] Daily swipe/message limits per tier (DB columns exist, not enforced in code)
- [ ] Razorpay integration, admin panel, report/block safety features
- [ ] Desktop `:has()` CSS selector used for split-chat layout — works in modern Chrome/Edge/Safari; if the user needs older-browser support this may need a JS fallback later (not urgent)

## Files changed this session (copy these into the local project)
- `dating-app-backend/src/controllers/discoveryController.js` (bug fix)
- `dating-app-static/index.html`, `app.js`, `style.css` (bug fixes + full responsive/UX redesign)

## How to avoid hallucination / wasted tokens across sessions
1. At the end of each build session, ask Claude to update this file with what changed.
2. Start each new chat by uploading this file first.
3. Don't ask Claude to "build everything" in one shot — pick one item from the checklist above per session.
