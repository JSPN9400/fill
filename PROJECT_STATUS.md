# FILLINGS — Project Status
_Upload this file (and the current project zip) at the start of your next chat with Claude._

## Locked decisions
- **Backend**: Node.js + Express, on **Render** → `https://fillings-backend.onrender.com`
- **Frontend**: Plain HTML/CSS/JS, on **GitHub Pages** → `https://jspn9400.github.io/fill/`
- **Database**: PostgreSQL on **Supabase**, pooler region **ap-northeast-1**
- **Repo**: `github.com/JSPN9400/fill`
- **App name: FILLINGS**

## Verification pass done this session — the app is much more complete than earlier notes suggested
Reviewed the actual current codebase (not assumptions) file by file. Confirmed solid:
- Refresh token rotation (15-min access token + 30-day refresh token), proper logout/revoke
- Socket.IO real-time chat — client (app.js `initSocket`) and server (`socketServer.js`) correctly wired, with typing indicators, read receipts, online presence
- Phone-based login AND Google-based login, both wired frontend-to-backend
- Full profile management: edit profile, upload/delete/reorder photos (real Supabase Storage), delete account
- Input validation middleware (`middleware/validate.js`), helmet, morgan — security hardening already in place
- New Sparks + Stories row (added last session) — code present, not yet live-tested

## Real bug found and fixed this session
**Signup photo inconsistency**: `authController.completeProfile` was storing the signup
photo as raw base64 text directly in `user_media.media_url`, while the separate
profile-edit photo system (`profileController.uploadPhoto`) properly uploads to
Supabase Storage and stores a real URL. This meant a signup photo could later crash
`deletePhoto`/reorder (which expect a real storage URL). **Fixed**: signup photos now
decode the base64 and go through `storageService.uploadPhoto` too, so every photo in
the system is consistent.

## CRITICAL — user must verify this before anything else works
`MASTER_SETUP.sql` now includes `refresh_tokens` and `notifications` tables that
**must exist** in Supabase or every signup/login will fail (since `completeProfile`
and `loginWithGoogle`/`loginWithPhoneVerifyOtp` all call `refreshTokenService.saveRefreshToken`,
which INSERTs into `refresh_tokens`). If the user only ran an older/smaller SQL
file before, this table won't exist yet. **Action: re-run the full current
`MASTER_SETUP.sql` in Supabase's SQL Editor — it's idempotent (IF NOT EXISTS
everywhere), safe to run even if some tables already exist.**

## Known non-bug (don't "fix" this, it's intentional)
In `MOCK_MODE=true`, `storageService.uploadPhoto` returns a **random Unsplash stock
photo URL**, not the actual uploaded photo — this is intentional (avoids needing to
actually wire real Supabase Storage keys just for local/mock testing). Real uploaded
photos will show correctly once `MOCK_MODE=false` and real Supabase Storage keys
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are set on Render.

## LIVE AND WORKING (needs re-confirmation after this session's fix + the SQL check above)
- Signup, login (phone + Google), discover/swipe/match, real-time chat, Feelings feed,
  New Sparks, Stories row, profile editing, photo management

## NOT yet done
- [ ] Razorpay payment integration
- [ ] Admin panel
- [ ] Report/Block feature
- [ ] Remaining Stitch design screens not yet implemented: onboarding step redesigns
      (step_1_basics/step_2_interests/step_3_photos), creator_revenue_dashboard,
      profile_with_revenue_entry, enable_location — only Stories/Feelings screen was done

## Immediate next steps (in order)
1. Re-run `MASTER_SETUP.sql` in Supabase (critical — confirms refresh_tokens/notifications exist)
2. Copy `authController.js` fix into local project, push
3. Live-test full signup → login → discover → match → real-time chat → Feelings/New Sparks flow end to end
4. Only after that's confirmed clean, move to a new feature (Razorpay/Admin/etc.)

## How to avoid hallucination / wasted tokens across sessions
1. At the end of each build session, ask Claude to update this file with what changed.
2. Start each new chat by uploading this file **AND the current project zip** — the
   codebase has grown faster than this file could track at least once before.
3. Don't ask Claude to "build everything" in one shot — pick one item per session.
