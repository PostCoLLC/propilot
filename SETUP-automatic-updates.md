# Pro Pilot — Fully Automatic RPT Updates (setup once, then hands-off)

This folder is a ready-to-publish website. Once set up, GitHub pulls your
RodPumpTracker data every hour, rebuilds the well feed, and republishes the app
automatically. **You never upload anything again**, and the app moves to a
permanent web address you control.

The trade-off: the app moves off tiiny.host to **GitHub Pages** (free). You'll
get a new link; point people (and your QR) at it once.

---

## What you need
- A free **GitHub account** (github.com) — 2 minutes to create.
- The **postauto** RodPumpTracker username + password (you already have these).

## Step 1 — Create the repository
1. Sign in to github.com → click **+** (top right) → **New repository**.
2. Name it `propilot` (or anything). Set it **Public**. Click **Create repository**.

## Step 2 — Upload this folder's contents
1. On the new repo page, click **uploading an existing file**.
2. Drag in **everything inside this `propilot-site` folder** — including the
   hidden `.github` folder. (On Mac, press Cmd+Shift+. to show hidden folders;
   or drag the whole `propilot-site` folder in.)
3. Click **Commit changes**.

## Step 3 — Add your RPT login as secrets
1. Repo → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret**: name `RPT_USER`, value `postauto` → Add.
3. **New repository secret** again: name `RPT_PASS`, value `Postauto0226` → Add.

## Step 4 — Turn on GitHub Pages
1. Repo → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

## Step 5 — Run it once
1. Repo → **Actions** tab → click **Sync RPT feed** → **Run workflow** → **Run**.
2. Wait ~1 minute. When it finishes green, the **Pages URL** appears in the run
   summary (also under Settings → Pages). That's your live app link.

Done. From now on it refreshes every hour on its own. Update the QR / share the
new link once, and the home-screen app (Add to Home Screen) tracks it.

---

## How it works (plain English)
- The scheduled job logs into RodPumpTracker with your secrets (kept private),
  pulls the last 60 days, and rebuilds `rpt-feed.json`.
- GitHub Pages serves the app + that feed from the same address, so the app
  reads live data with no upload and no CORS issues.
- If RPT is briefly unreachable, the job keeps the last good feed.

## Changing who sees what
Edit **scripts/accounts.json** in the repo (pencil icon → commit). Anyone on
`@postcompaniesllc.com` is staff (sees all wells); add an operator's email like
`"name@operator.com": { "operator": "Blackbeard Operating" }` to scope them.

## Changing the refresh frequency
In **.github/workflows/sync.yml**, the line `cron: '0 * * * *'` = hourly.
`'0 */4 * * *'` = every 4 hours; `'0 12 * * *'` = once daily at noon UTC.

## Moving your existing QR/link
Your current QR points to tiiny.host. Two options:
1. Keep tiiny.host as the address by pointing it at the Pages site (redirect), or
2. Regenerate the QR to the new Pages URL — tell me the URL and I'll make it.

Not comfortable doing this solo? Hand this folder + these steps to whoever
manages IT, or send me the Pages URL after Step 5 and I'll verify it's live.
