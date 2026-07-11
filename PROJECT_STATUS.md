# FILLINGS — Project Status
_Upload this file at the start of your next chat with Claude to continue exactly from here._

## Locked decisions
- **Backend**: Node.js + Express, on **Render** → `https://fillings-backend.onrender.com`
- **Frontend**: Plain HTML/CSS/JS, on **GitHub Pages** → `https://jspn9400.github.io/fill/`
- **Database**: PostgreSQL on **Supabase**, pooler region is **ap-northeast-1**
- **Repo**: `github.com/JSPN9400/fill`
- **MOCK_MODE=true** everywhere
- **App name: FILLINGS**

## About the friend's "aura" project (uploaded this session)
It's a **Google AI Studio–generated UI/UX prototype** — React+TS+Vite+Firebase+Drizzle,
but almost entirely **hardcoded mock data** (fake profiles "Elena"/"Julian", placeholder
Firebase/Drizzle scaffolding with no real business logic wired up). Not usable as a
working backend to "continue" — it's a design reference. We are NOT switching stacks
to it; we extracted the good ideas and merged them into our existing tested FILLINGS app:
- **Adopted**: client-side image compression before storing photos as base64 (resize to
  800px + JPEG 70% quality) — this was a real gap we'd flagged (unbounded base64 photo size)
- **Adopted**: a `profession` profile field
- **Noted for later, not built yet**: "Aura Gold" (premium tier naming/branding idea),
  "Creator Monetization" (a bigger feature — users monetizing content/subscriptions —
  out of scope for now), Stories-style "active" ring indicator on Feelings avatars

## LIVE AND WORKING
- Signup, login, discover/swipe/match/chat, Feelings feed, interest-based match ranking

## NEW this session
1. Image compression (`compressImage()` in app.js) applied to both profile-photo upload and Feelings photo upload — shrinks images before they're sent/stored
2. `profession` field — new DB column, profile-setup input, shown on discover cards and public profile view

## Still pending from last session (not yet confirmed live-tested)
- [ ] Run in Supabase: `dating-app-backend/src/db/interests_column.sql` (now also adds `profession` column — this file was appended to, run the WHOLE file even if you ran an earlier version before)
- [ ] Push + test photo upload, interests, and now profession live

## NOT yet done / next steps
- [ ] Real photo hosting (Cloudinary) instead of base64-in-database — compression helps but doesn't fully solve this
- [ ] Real-time chat (currently 3-second polling)
- [ ] Daily swipe/message limits per tier (DB columns exist, not enforced)
- [ ] Razorpay integration, admin panel, report/block
- [ ] Consider: "Aura Gold" style premium branding, Stories active-ring UI polish (low priority, cosmetic)

## Files changed/added this session
- CHANGED: `dating-app-backend/src/db/interests_column.sql` (now also has profession column)
- CHANGED: `dating-app-backend/src/controllers/authController.js`, `discoveryController.js`, `publicProfileController.js` (profession field)
- CHANGED: `dating-app-static/index.html`, `app.js`, `style.css` (image compression, profession field + display)

## How to avoid hallucination / wasted tokens across sessions
1. At the end of each build session, ask Claude to update this file with what changed.
2. Start each new chat by uploading this file first.
3. Don't ask Claude to "build everything" in one shot — pick one item from the checklist above per session.
