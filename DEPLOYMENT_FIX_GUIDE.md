# GV Street'26 — Deployment Fix Guide

## What was actually wrong

Both bugs you reported come from the same root cause: **your admin panel
(countries, sponsors, promo codes, registrations, uploaded ID/payment photos,
event settings — all of it) was storing data in local JSON files on disk**
(`data/countries.json`, etc.) and uploaded photos in `public/uploads/`.

That works perfectly on your own computer, because your local disk is
writable. But **Vercel's production servers use a read-only filesystem** —
every write from the admin panel either fails silently or never survives past
that one request. So:

- Adding/removing a country "worked" for a moment then reverted — because it
  was never actually saved anywhere permanent.
- The Google Sheets code itself was fine, but two things made it look broken:
  1. It was wrapped in a `catch` block that swallowed every error with no
     logging, so if your Google credentials were even slightly wrong, you'd
     never see why.
  2. Uploaded ID/payment images were never actually saved either (same
     read-only-disk problem), so even if Sheets syncing worked, some data
     going into it depended on files that didn't exist.

**I also found a security issue while looking at your repo:** your real
`ADMIN_EMAIL` and `ADMIN_PASSWORD` are committed to `.env.local` in your
**public GitHub repository**. Anyone can currently see your admin login.
Fix this today (steps below) — it takes 5 minutes.

## What I changed in the code

| File | Change |
|---|---|
| `lib/kv.ts` | **New.** Connects to a Redis database (Upstash, via Vercel's Marketplace) for permanent storage. |
| `lib/storage.ts` | Rewritten to read/write Redis instead of local files. Same function names, so nothing else in your app needed to change. Your existing `data/*.json` files are kept and used only as one-time seed data the first time each key is read. |
| `lib/file-upload.ts` | Rewritten to upload ID/payment photos to **Vercel Blob** storage (permanent public URL) instead of local disk. |
| `lib/integrations/sheets.ts` | Errors are now logged with `console.error` instead of silently discarded, so real problems show up in Vercel's logs. |
| `lib/integrations/drive.ts` | Unchanged behavior — now effectively optional since Blob already returns a public URL directly (comment added for clarity). |
| `.gitignore` | Added `.env*` so secrets are never committed again. |
| `.env.example` | Added the two new required variables (`KV_REST_API_URL`/`KV_REST_API_TOKEN` for Redis, `BLOB_READ_WRITE_TOKEN` for uploads). |
| `package.json` | Added `@upstash/redis` and `@vercel/blob`. |

I ran `tsc --noEmit` on the whole project after these changes — no type
errors.

---

## Step 1 — Rotate your admin password (do this first)

1. Pick a new strong password, e.g. following the same pattern as before but
   different (12+ chars, upper/lowercase, numbers, symbols).
2. You'll set it in Vercel's Environment Variables in Step 5 below — don't
   put the real value back in any file that goes into GitHub.
3. Optional but recommended: since the old password is permanently visible in
   your GitHub history, you can scrub it with a tool like
   [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) or simply
   make the repository private in GitHub settings if it doesn't need to be
   public.

## Step 2 — Replace your project code

1. Download the fixed project (link provided below this guide).
2. Copy every file over your existing project **except** `data/*.json` if you
   have since edited those files locally with real content — otherwise it's
   safe to overwrite everything.
3. From your project folder:
   ```bash
   npm install
   ```

## Step 3 — Connect a Redis database (fixes the "static countries" bug)

1. Go to your project on [vercel.com](https://vercel.com).
2. Click **Storage** → **Create Database**.
3. Choose **Upstash** → **Redis** (this is the databases-tab replacement for
   the old "Vercel KV" product — same idea, different name).
4. Follow the prompts to create it, then click **Connect to Project** and
   select your GV Street'26 project.
5. Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to
   your project's Environment Variables. You don't need to type anything.

## Step 4 — Connect Blob storage (fixes uploaded ID/payment photos)

1. Still in **Storage**, click **Create Database** again.
2. Choose **Blob**.
3. Connect it to your project the same way. Vercel adds
   `BLOB_READ_WRITE_TOKEN` automatically.

## Step 5 — Set/update your admin credentials on Vercel

1. Go to **Settings → Environment Variables**.
2. Set (or update) `ADMIN_EMAIL` and `ADMIN_PASSWORD` to your new values from
   Step 1.
3. Leave `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEETS_ID`,
   `GOOGLE_DRIVE_FOLDER_ID` as they already were — see Step 7 to verify them.

## Step 6 — Push and redeploy

```bash
git add -A
git commit -m "Fix Vercel storage: move admin data to Redis, uploads to Blob"
git push
```

Vercel will redeploy automatically. If it doesn't, go to **Deployments** →
the three dots on the latest one → **Redeploy**.

## Step 7 — Verify the countries fix

1. Go to `yourwebsite.com/admin` → **Countries** tab.
2. Add a test country, or edit an existing one.
3. Refresh the page — the change should now stick.
4. Open the site in an incognito window (or on your phone) and confirm the
   change shows there too.

## Step 8 — Verify (and actually debug, if needed) Google Sheets

Now that errors are logged instead of hidden, if Sheets still isn't syncing:

1. Submit a test registration on `/register`.
2. In Vercel, go to **Deployments** → click the latest deployment → **Logs**
   (or **Functions** tab depending on your Vercel UI version).
3. Look for a line starting with `[Google Sheets]`. It will now tell you the
   *actual* reason — most commonly one of:
   - `GOOGLE_PRIVATE_KEY` was pasted with real line breaks instead of `\n` —
     it must be **one single line** in the Vercel env variable value, exactly
     like `.env.example` shows.
   - The service account email was never actually granted **Editor** access
     on the Google Sheet (Section 2, Step 6 of your original operations
     guide).
   - Google Sheets API or Google Drive API isn't enabled on the same Google
     Cloud project the credentials belong to.
   - The env vars were added/edited but the project was never redeployed
     afterward (env var changes need a redeploy to take effect).
4. Fix whatever the log says, then **Redeploy** and test again.

---

## Quick reference — required environment variables after this fix

| Variable | Required? | Set by |
|---|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Yes | You, in Vercel dashboard |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Yes | Auto (Redis integration) |
| `BLOB_READ_WRITE_TOKEN` | Yes | Auto (Blob integration) |
| `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEETS_ID` | Optional | You, per your original guide Section 2 |
| `GOOGLE_DRIVE_FOLDER_ID` | Optional, no longer needed for uploads to work | You |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional | You, per your original guide Section 4 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Optional | You |
