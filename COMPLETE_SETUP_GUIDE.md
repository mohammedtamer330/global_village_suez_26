# GV Street'26 — Complete Setup Guide (Zero to Live)

Follow this in order. Each step builds on the last. Total time: about 45–60
minutes if you go straight through.

---

## Before you start — accounts you'll need (all free)

Create these now so you're not switching tabs mid-setup:

1. A [GitHub](https://github.com) account — you already have `YousifWahed005`
2. A [Vercel](https://vercel.com) account — sign up with your GitHub account (one click, no separate password)
3. A [Google account](https://accounts.google.com) — for Sheets/Drive (can be any Gmail)
4. A [Resend](https://resend.com) account — for sending emails
5. Optional: a domain name (e.g. from Namecheap, GoDaddy, or Cloudflare) if you want `globalvillagestreet26.com` instead of a free `.vercel.app` URL

---

## Part 1 — Get the fixed code onto GitHub

1. Download the fixed project zip I gave you and unzip it.
2. Open a terminal in that folder.
3. Replace your existing repo's contents with these files (keep your `.git` folder — don't delete that):
   ```bash
   # from inside your existing GV repo folder
   # copy every file from the fixed project into it, overwriting
   ```
4. Commit and push:
   ```bash
   git add -A
   git commit -m "Fix Vercel storage: Redis for data, Blob for uploads"
   git push
   ```
5. **Important — your admin password was previously exposed publicly.** Either:
   - Make the repo private: GitHub → your repo → **Settings** → scroll to **Danger Zone** → **Change visibility** → **Make private**, or
   - Keep it public but make sure `.env.local` is never committed again (already handled — it's now in `.gitignore`).

---

## Part 2 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import** next to your `GV` repository. (If you don't see it, click **Adjust GitHub App Permissions** and grant access to the repo.)
3. Leave the framework preset as **Next.js** (auto-detected).
4. Don't click Deploy yet — first add environment variables (next step). Or deploy now and add them after; either works, you'll just redeploy once more.
5. Click **Deploy**. Your site will build and go live at something like `gv-xxxx.vercel.app`.

---

## Part 3 — Connect the database (fixes admin panel not saving)

This is the fix for your "countries section is static" bug — and the same fix covers every other admin feature (sponsors, promo codes, registrations, event settings).

1. In your Vercel project, click the **Storage** tab.
2. Click **Create Database**.
3. Choose **Upstash** → **Redis**.
4. Name it anything (e.g. `gv-street26-data`) → **Create**.
5. On the next screen, click **Connect Project** and select your GV Street'26 project → **Connect**.
6. Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project's Environment Variables. You don't type anything.

---

## Part 4 — Connect file storage (fixes ID/payment photo uploads)

1. Still in the **Storage** tab, click **Create Database** again.
2. Choose **Blob**.
3. Name it (e.g. `gv-street26-uploads`) → **Create**.
4. Click **Connect Project** → select your project → **Connect**.
5. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.

---

## Part 5 — Set your admin login

1. In your Vercel project, go to **Settings → Environment Variables**.
2. Add:
   - `ADMIN_EMAIL` = the email you want to log in with
   - `ADMIN_PASSWORD` = a strong password (12+ characters, mixed case, numbers, symbols)
3. Click **Save**.
4. Add one more: `NEXT_PUBLIC_SITE_URL` = your live site URL (e.g. `https://gv-xxxx.vercel.app`, or your custom domain once you set one up in Part 9).
5. Go to **Deployments** → click the **⋯** on the latest deployment → **Redeploy**. (Environment variable changes only take effect after a redeploy.)

Test it: go to `yourwebsite.com/admin` and log in.

---

## Part 6 — Set up Google Sheets (live spreadsheet of registrations)

### 6.1 Create a Google Cloud project
1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project dropdown at the top → **New Project**.
3. Name it `Global Village Street26` → **Create**. Wait ~10 seconds, then select it from the dropdown.

### 6.2 Enable the required APIs
1. In the search bar at the top, type **Google Sheets API** → click it → **Enable**.
2. Search **Google Drive API** → click it → **Enable**.
   (Both must be enabled — skipping one breaks uploads or sheet sync.)

### 6.3 Create a service account (the "robot" that writes to your sheet)
1. Go to **APIs & Services → Credentials** (left sidebar).
2. **Create Credentials → Service Account**.
3. Name it `gv-street26-bot` → **Done**.
4. Click into the new service account → **Keys** tab → **Add Key → Create New Key**.
5. Choose **JSON** → **Create**. A `.json` file downloads automatically.
   **Keep this file safe — never upload it to GitHub or share it.**

### 6.4 Create your Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) → **+** to create a new blank spreadsheet.
2. Name it `GV Street 26 Registrations`.
3. The website will auto-create all column headers the first time a registration comes in — you don't need to type headers yourself.

### 6.5 Get the Sheet ID
1. With the sheet open, look at the URL:
   `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`**`/edit`
2. Copy the long ID between `/d/` and `/edit`. Save it for Part 6.8.

### 6.6 Share the sheet with the service account
1. Open the downloaded JSON file — find the `client_email` field, looks like
   `gv-street26-bot@globalvillage-street26.iam.gserviceaccount.com`.
2. In your Google Sheet, click **Share** (top right).
3. Paste that email → set role to **Editor** → uncheck "Notify people" → **Share**.

### 6.7 Create the Drive upload folder (optional — see note below)
1. Go to [drive.google.com](https://drive.google.com) → **New → Folder**.
2. Name it `GV Street 26 Uploads` → **Create**.
3. Open it, copy the **Folder ID** from the URL (the part after `/folders/`).
4. Right-click the folder → **Share** → paste the same service account email → **Editor** → **Share**.

   > **Note:** with the fix I made, uploaded photos now go to Vercel Blob and
   > already get a permanent public link — Google Drive is no longer required
   > for uploads to work. Only set this up if you specifically want a second
   > copy of every ID/payment photo inside Google Drive too.

### 6.8 Add the credentials to Vercel
In Vercel → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | the `client_email` from the JSON file |
| `GOOGLE_PRIVATE_KEY` | the `private_key` from the JSON file — **must be one single line**, with `\n` characters, exactly as shown in the JSON (don't reformat it) |
| `GOOGLE_SHEETS_ID` | the Sheet ID from step 6.5 |
| `GOOGLE_DRIVE_FOLDER_ID` | the Folder ID from step 6.7 (only if you did that step) |

Then **Deployments → ⋯ → Redeploy**.

---

## Part 7 — Set up email (Resend, 3,000 free emails/month)

1. Go to [resend.com](https://resend.com) → **Sign Up**.
2. **Domains → Add Domain** → enter your domain (e.g. `globalvillagestreet26.com`).
3. Resend shows DNS records — log in to wherever you bought your domain (Namecheap, GoDaddy, Cloudflare, etc.) and add each record exactly as shown.
4. Back in Resend, click **Verify DNS Records** — wait a few minutes for it to turn green.
   - **No domain yet?** Skip verification and use `onboarding@resend.dev` as your `EMAIL_FROM` for testing. Real event emails should use a verified domain so they don't land in spam.
5. **API Keys → Create API Key** → name it `GV Street26` → **Create**. Copy the key now — you can't see it again.
6. In Vercel, add:
   - `RESEND_API_KEY` = the key you just copied
   - `EMAIL_FROM` = `noreply@yourdomain.com` (or `onboarding@resend.dev` for testing)
7. **Deployments → ⋯ → Redeploy**.

---

## Part 8 — Optional: Telegram notifications for new registrations

Only if you want a phone ping every time someone registers.

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts → copy the bot token it gives you.
2. Add your new bot to a Telegram group (or message it directly).
3. To get your Chat ID: message the bot, then visit
   `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser and look for `"chat":{"id":...}`.
4. In Vercel, add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
5. Redeploy.

---

## Part 9 — Optional: custom domain

1. In Vercel → your project → **Settings → Domains**.
2. Enter your domain → **Add**.
3. Vercel shows DNS records to add at your domain registrar. Add them.
4. Wait for the checkmark (can take a few minutes to a few hours).
5. Update `NEXT_PUBLIC_SITE_URL` in Environment Variables to the new domain, then redeploy.

---

## Part 10 — Test everything end-to-end

Go through this checklist on the **live** site (not localhost):

- [ ] `/admin` — log in with your `ADMIN_EMAIL`/`ADMIN_PASSWORD`
- [ ] **Countries tab** — add a test country, refresh the page, confirm it's still there
- [ ] **Event Settings** — change something small, save, refresh, confirm it stuck
- [ ] `/register` — submit a full test registration with a real ID photo and payment screenshot
- [ ] Check your email inbox for the **Pending** email (within ~1 minute)
- [ ] Open your Google Sheet — confirm a new row appeared with the test registration
- [ ] Back in `/admin` → **Registrations** → find the test entry → click **Approve**
- [ ] Check your inbox for the **Approval** email with QR code + ticket PDF
- [ ] Visit `/track`, search by the reference ID or email, confirm status shows **Approved** and the ticket downloads
- [ ] `/check-in` — scan or type in the reference ID, confirm it marks as **Checked In**
- [ ] Delete the test registration and test country from the admin panel once you're satisfied

If the Sheets step doesn't show a new row: go to Vercel → **Deployments → Logs**, submit another test registration, and look for a line starting with `[Google Sheets]` — it will now tell you exactly what's wrong (see the debugging checklist in `DEPLOYMENT_FIX_GUIDE.md`).

---

## Part 11 — Go-live checklist

- [ ] Admin password changed from any default/test value, and not committed to GitHub
- [ ] Repo is private, or confirmed `.env*` files are gitignored
- [ ] Real event details entered in **Event Settings** (name, date, location, price, capacity)
- [ ] Countries, sponsors, and promo codes populated with real content
- [ ] At least one full test registration completed successfully (Part 10)
- [ ] Custom domain connected (if using one) and `NEXT_PUBLIC_SITE_URL` matches it
- [ ] Told your team the admin URL and login — and only them

Once all of these are checked, the site is genuinely ready for real registrations.
