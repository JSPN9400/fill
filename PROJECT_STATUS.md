# Milan Dating App — Project Status
_Last updated: this session. Upload this file at the start of your next chat with Claude to continue exactly from here._

## Locked decisions
- **Backend**: Node.js + Express, deployed on **Render** (free tier) at `https://feelings-dating-app.onrender.com`
- **Frontend**: Plain HTML/CSS/JS, deployed on **GitHub Pages** at `https://jspn9400.github.io/fill/`
- **Database**: PostgreSQL on **Supabase** (pooler connection string, not direct — direct hostname didn't resolve on user's network)
- **Repo**: `github.com/JSPN9400/fill`
- **MOCK_MODE=true** everywhere for now (OTP=123456, Google/face/KYC auto-pass) — not yet using real Twilio/Google/AWS/KYC keys
- App name: **Milan**

## LIVE AND WORKING (confirmed by user testing on the deployed site)
- Full signup flow (phone → OTP → Gmail → face scan camera capture → ID → profile) — tested live on Render + GitHub Pages + Supabase, works end to end.

## Built this session, not yet live-tested by user
**Discovery + Swipe + Match + Chat** (the core Tinder-like loop):
- Backend: `GET /api/discover` (feed excluding already-swiped, filtered by mutual gender interest), `POST /api/swipe` (like/dislike/superlike, auto-creates a match on mutual like, schema's unique constraint blocks double-swiping), `GET /api/matches` (list with last message preview)
- Frontend: added a "main app" section to `dating-app-static/` — Discover screen (swipe cards + like/dislike/superlike buttons), Matches list, Chat screen (uses the existing `/api/messages/:matchId` endpoints, simple 3-second polling — not real Socket.io realtime yet)
- Auth: after signup, the `session_token` JWT returned by `complete-profile` is stored in-memory and sent as `Authorization: Bearer` on all discover/swipe/match/message/profile calls
- Syntax-checked and static-file-served locally; **not yet clicked through live** — next step is for the user to push and test the full discover→swipe→match→chat loop live.

## Known bugs fixed this session (don't reintroduce)
1. Express 4 doesn't auto-catch async route errors → wrapped everything in `asyncHandler` (crashed server otherwise)
2. Re-signing a JWT that already had `exp`/`iat` claims crashed the Google-login step → stripped in `regTokenService.issueRegToken`
3. Render sits behind a proxy → added `app.set('trust proxy', 1)` so express-rate-limit doesn't warn/misbehave
4. On Render, if `MOCK_MODE` env var isn't exactly `true`, the real Twilio path runs with placeholder credentials and crashes — always double check Render's Environment tab has `MOCK_MODE=true` exactly

## Recommended next steps
- [ ] User to test discover/swipe/match/chat live end-to-end, report bugs
- [ ] Content filter already applied to chat — confirm it still works on the live deployment
- [ ] Login flow for returning users (currently only fresh signup exists)
- [ ] Replace chat polling with real-time (Socket.io) once basic flow is confirmed solid
- [ ] Photo upload (currently no way to add `user_media` rows — profiles show a placeholder emoji instead of a real photo)
- [ ] Razorpay integration for the 4 tiers
- [ ] Daily swipe/message limits per tier (columns already exist in DB: `swipes_used_today`, `messages_sent_today`, `daily_swipe_limit`, `daily_message_limit` — not enforced in code yet)
- [ ] Admin panel, report/block, deployment hardening (CORS restricted to real domain instead of open)

## How to avoid hallucination / wasted tokens across sessions
1. At the end of each build session, ask Claude to update this file with what changed.
2. Start each new chat by uploading this file first.
3. Don't ask Claude to "build everything" in one shot — pick one item from the checklist above per session.
