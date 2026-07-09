# Milan Dating App — Project Status
_Last updated: this session. Upload this file at the start of your next chat with Claude to continue exactly from here._

## Locked decisions (don't re-ask these)
- **Backend**: Node.js + Express — hosted on **Render free tier**
- **Frontend**: Plain HTML/CSS/JS (no build step) — hosted on **GitHub Pages free tier**. The old React/Vite version (`dating-app-frontend/`) still exists but is no longer the one being deployed; `dating-app-static/` is the active frontend now.
- **Database**: PostgreSQL on **Supabase free tier** (already set up, tables created)
- **Payments (when we get there)**: Razorpay
- App name so far: **Milan**

## What actually works today (built + tested)
1. **Database** — live on Supabase, schema created via `full_setup.sql` (user_tiers, users, user_media, swipes, matches, messages)
2. **Signup backend** (`dating-app-backend/`) — phone OTP → Gmail link → face scan (dedupe) → ID/KYC → profile. `MOCK_MODE=true` lets it run fully without real Twilio/Google/AWS/KYC keys.
   - Fixed: async errors used to crash the server — now handled gracefully (`asyncHandler`)
   - Fixed: re-signing a JWT that already had `exp`/`iat` crashed the Google-login step — now stripped before re-signing (`regTokenService.js`)
3. **Content filter** — blocks phone numbers/emails/IDs/social handles/links in chat messages and bio. Wired into real `POST/GET /api/messages/:matchId` and `PATCH /api/profile/bio` endpoints (auth-gated via JWT).
4. **Signup frontend, React version** (`dating-app-frontend/`) — fully working, was tested locally end-to-end by the user (phone → OTP → Gmail → camera face scan → ID → profile → success), running against the live Supabase DB on `localhost:5034`.
5. **Signup frontend, static version** (`dating-app-static/`) — plain HTML/CSS/JS rebuild of the same flow (same Instagram-style UI, same steps, same API calls), built specifically so it can be hosted for free on GitHub Pages without a build pipeline. Syntax-checked and file-served locally; not yet click-tested end-to-end by the user (do this before/alongside deploying).

## Environment facts learned this session (don't re-discover)
- User is on Windows, project at `E:\My project with git\FILLINGS`
- Local backend runs on port **5034** (5000 was occupied by another process)
- Supabase direct hostname (`db.xxx.supabase.co`) didn't resolve on user's network — the **pooler connection string** (`aws-0-...pooler.supabase.com:6543`) worked instead
- `dating-app-static/app.js` has `API_BASE_URL` hardcoded at the top — must be updated to the Render URL after backend deploys

## Recommended build order (next steps)
- [x] Content filter (chat + bio)
- [ ] **In progress**: deploy backend to Render, deploy `dating-app-static/` to GitHub Pages, then point `API_BASE_URL` at the live Render URL
- [ ] Login flow for existing users
- [ ] Discovery feed + swipe + match creation
- [ ] Realtime chat (Socket.io)
- [ ] Profile edit UI (photos via Cloudinary)
- [ ] Razorpay integration (4 tiers)
- [ ] Basic admin panel
- [ ] Report/block safety features

## How to avoid hallucination / wasted tokens across sessions
1. At the end of each build session, ask Claude to update this file with what changed.
2. Start each new chat by uploading this file first.
3. Don't ask Claude to "build everything" in one shot — pick one item from the checklist above per session.
