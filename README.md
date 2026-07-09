# Milan — Dating App (Signup Flow: Backend + Frontend)

Dono saath test karne ke liye 2 terminal khulo.

## Terminal 1 — Backend

```bash
cd dating-app-backend
npm install
cp .env.example .env
```

`.env` me `MOCK_MODE=true` already set hai — isse bina kisi real Twilio/Google/AWS/KYC account ke poora flow test ho sakta hai.

```bash
npm run dev
```

Backend `http://localhost:5000` pe chalega.

⚠️ **Postgres zaroori hai** — schema (pehle wala `users`/`swipes`/`matches` etc.) + `src/db/schema_updates.sql` apne local Postgres me run karo, aur `.env` me `DATABASE_URL` sahi daalo. Bina DB ke sirf routing test hogi, account create nahi hoga.

## Terminal 2 — Frontend

```bash
cd dating-app-frontend
npm install
npm run dev
```

Browser me `http://localhost:5173` kholo.

## Test flow (MOCK_MODE)

1. **Phone**: koi bhi valid-looking number daalo, e.g. `+919876543210`
2. **OTP**: code `123456` daalo (screen pe bhi hint dikhega)
3. **Gmail**: koi bhi `@gmail.com` email + naam daalo (real Google button abhi nahi laga, ye simulate karta hai)
4. **Face scan**: browser camera permission allow karo, photo capture karo — real camera use hota hai, lekin verification mock hai (auto-pass)
5. **ID verify**: koi bhi ID number daalo (4+ digit) — auto-verify ho jayega
6. **Profile**: naam, DOB, gender, interest, state, city bharo → account ban jayega, user_id dikhega

Agar koi step fail ho (jaise Postgres na chal raha ho), red error banner screen pe dikhega — usi se pata chalega kahan atka.

## Real mode me switch karna (launch se pehle)

1. Backend `.env` me `MOCK_MODE=false` karo, aur Twilio/Google/AWS/KYC ki real keys daalo (README `dating-app-backend/README.md` me table hai kahan se milengi)
2. Frontend `src/App.jsx` me `MOCK_MODE = false` karo
3. `GoogleStep.jsx` ko real "Sign in with Google" button (Google Identity Services script) se replace karo — abhi wo email/naam form hai jo mock backend ke liye simulate karta hai

## Ab tak kya bana hai

- ✅ Database schema (tiers, users, swipes, matches, messages)
- ✅ Signup flow backend (phone OTP → Gmail → face scan dedupe → ID/KYC → profile)
- ✅ Signup flow frontend (Instagram-style UI, real camera capture)

## Aage kya banana hai

- Content filter middleware — chat/bio me phone number, ID number, ya social handle share hone se rokna
- Login flow (existing users ke liye)
- Swipe/match/chat screens aur APIs
- Payment tiers (₹99/₹299/₹499) integration
