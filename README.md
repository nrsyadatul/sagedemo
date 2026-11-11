# Sage Phase 2 — React/Vite + Supabase

## What's included
- Migrated Phase 1 styling, Balance First home, four-tab floating navigation, Mine/Partner/Shared switcher, personalized time-of-day greeting, Wishlist heading.
- Email/password sign-in and registration; passwordless email-link sign-in.
- Profile display-name editing.
- Household creation, one-time 32-character random invitation codes, optional invite-email restriction, invite redemption and 2-member limit.
- Row Level Security for profiles and household membership; SQL functions for invitation writes.
- Sample financial summaries and **debit/credit card preview only**. No real finance engine or private financial data is stored.

## Setup
1. Install Node.js 20+ and run `npm install`.
2. Create a Supabase project. In SQL Editor, run `supabase/schema.sql`.
3. Under Supabase Auth settings, configure Site URL to your deployed HTTPS URL and add the URL to allowed redirect URLs. Enable email/password and email OTP/magic link. Set up a real email provider for reliable delivery before inviting others.
4. Copy `.env.example` to `.env.local`, fill in project URL and **publishable / anon key**. Never put a service-role or secret key in frontend env variables.
5. Run `npm run dev` locally. For production, `npm run build` then deploy `dist/` to Netlify, configuring the same VITE_ environment variables in Netlify before build.
6. For iPhone, open the HTTPS URL in Safari, Share → Add to Home Screen.

## Important limits / unfinished items
- **Not deployed:** user must supply their own Supabase and hosting credentials; this ZIP does not contain credentials.
- **Email invitation** currently creates an invite restricted to the specified email, but does NOT automatically send an email. Share the generated code privately; automatic delivery requires a trusted server-side email service.
- **Face ID / passkeys:** Not implemented. Browser passkey support is not equivalent to having a passkey authentication provider configured. A supported passkey integration needs separate testing and implementation before claiming biometric sign-in.
- **Financial numbers are always mock values**, including partner summaries and debit/credit cards. No partner finance data is fetched from Supabase. In Phase 3, implement secure server-side aggregate summaries and test privacy before real use.
- No transaction recording, bank sync, credit card calculations, reimbursement settlement, recurring bills or actual savings contributions in this phase.
- The Home Screen icon is a placeholder and can be replaced with the user's chosen picture later.
- No automated browser or two-user integration tests were run in this environment. Validate RLS and auth flows in a Supabase test project before using with real information.
- For production, add invite request rate limits at the API/edge layer and audit/monitor auth and invite abuse.
