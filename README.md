# Living Word Commentary

A personal Bible commentary, written to the glory of Jesus Christ.

- Visitors read Scripture (NKJV via the YouVersion API). Any verse, passage, or chapter that has commentary shows a **+** button that opens it.
- Only the author can sign in at `/admin` to write, edit, and delete commentary. This is enforced by Supabase Row Level Security, not just the UI.
- Notes can cover a whole chapter or a verse range, have cross-references, and support simple formatting (`**bold**`, `*italic*`, `> quote`, `- list`, `[[Romans 5:8]]` links).

## Stack
Next.js 15 (App Router), Supabase (database + auth), hosted on Vercel.

## Environment variables
See `.env.example`. In Vercel, set:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyifaciyxgbwkkyybwfa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (in `.env.example`) |
| `YOUVERSION_API_KEY` | your YouVersion key (**secret**, never commit) |
| `YOUVERSION_BIBLE_ID` | `114` (NKJV) |
| `YOUVERSION_FALLBACK_BIBLE_ID` | `3034` (BSB), used if NKJV access is denied |

## Local dev
```
cp .env.example .env.local   # then add your YouVersion key
npm install
npm run dev
```

## Database
Schema lives in `supabase/migrations/`. To make an account the author:
```sql
insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
```
