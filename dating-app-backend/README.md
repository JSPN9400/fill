# Dating App - Signup Flow Backend

Ye 5 step ka signup flow hai:

1. **Phone number** → OTP bhejo → verify karo
2. **Gmail login** → Google se link karo (email/google_id verify hota hai)
3. **Face scan** → quality check + duplicate check (ek face = ek account) + face collection me store
4. **ID verify (KYC)** → government ID document verify hota hai third-party provider se
5. **Basic profile** → naam, DOB, gender, interested_in, nationality, state, city, area → account ban jata hai

Har step ke baad ek `reg_token` milta hai jo agla step allow karta hai. Agar koi step skip karne ki koshish kare (jaise seedha face-scan call kare bina phone verify kiye), request reject ho jayegi.

## Setup

```bash
npm install
cp .env.example .env
# .env me apni real keys daalo (neeche dekho kahan se milengi)
```

Database schema (pehle wala + naya `schema_updates.sql`) run karo Postgres me, phir:

```bash
npm run dev
```

## API Keys kahan se milengi

| Kaam | Provider | Note |
|---|---|---|
| Phone OTP | [Twilio Verify](https://www.twilio.com/docs/verify) | India ke liye MSG91/Gupshup bhi use kar sakte ho, service same rahegi bas `otpService.js` badalna hoga |
| Gmail login | [Google Cloud Console](https://console.cloud.google.com/) → OAuth Client ID | Frontend pe "Sign in with Google" button se id_token milta hai, wahi backend ko bhejna hai |
| Face verification | [AWS Rekognition](https://aws.amazon.com/rekognition/) | Pehle ek "Collection" banani hogi (`CreateCollection` API), uska ID `.env` me daalo |
| ID/KYC verification | HyperVerge / IDfy / Signzy / DigiLocker | Koi bhi lo, sabka pattern same hai: doc bhejo → reference_id + status milta hai |

## Endpoints

```
POST /api/auth/signup/send-otp        { phone_number }
POST /api/auth/signup/verify-otp      { phone_number, code }
POST /api/auth/signup/google          { reg_token, google_id_token }
POST /api/auth/signup/face-scan       multipart: reg_token, face_image
POST /api/auth/signup/id-verify       { reg_token, id_document }
POST /api/auth/signup/complete-profile { reg_token, name, dob, gender, interested_in, nationality, state, city, area }
```

## Security notes

- Har response me sirf zaroori info jaati hai, koi internal error detail client ko nahi dikhta.
- OTP endpoint pe rate-limit hai (5 requests / 15 min) taaki koi spam na kar sake.
- Face dedupe (`findDuplicateFace`) hi "ek face = ek account" wala rule enforce karta hai.
- `reg_token` sirf 30 minute ke liye valid hai — poora signup 30 min me complete karna hoga.

## Next steps (agla part)

- Content filter middleware — chat/bio me phone number, ID number, social handle detect karke block karna
- Login flow (existing users ke liye — phone OTP ya Google se seedha login)
- Swipe/match/message APIs
