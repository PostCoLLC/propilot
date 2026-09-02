[README-UPLOAD.md](https://github.com/user-attachments/files/31742167/README-UPLOAD.md)
# Upload set for PostCoLLC/propilot

Everything in `repo-upload/` goes to the **repo root**, keeping the folder structure.

```
index.html                        current build, includes the stale-feed guard
rpt-feed.json                     July 9 fallback; the workflow rewrites it on the first run
rpt-sync.js                       weekly 14-day window + sweptAt cache
accounts.json                     operator mappings, incl. @doi.us and @discoveryoperating.com
sw.js                             offline service worker
teardown-photos.json              214 photo index
.gitignore
assets/                           7 images (sw.js caches five of them for offline)
.github/workflows/sync.yml        the workflow — nothing runs without this
```

## What was wrong with the v64 upload

| File | Status |
|---|---|
| `rpt-sync.js` | Correct, unchanged |
| `sw.js` | Correct, unchanged |
| `teardown-photos.json` | Correct, unchanged |
| `rpt-feed.json` | Fine as fallback |
| `index.html` | Older build — no stale-feed guard. Replaced. |
| `.github/workflows/sync.yml` | **Was missing.** Actions had nothing to run, which is why data sat at July 9. |
| `accounts.json` | **Was missing.** Sync falls back to built-in defaults and loses the newer operator mappings. |
| `assets/` | Not in the upload. Included here; skip if already in the repo. |

## Steps

1. Upload the contents of `repo-upload` to the repo root — the files themselves, not the folder.
2. Include the hidden `.github` folder and `.gitignore`. If the web uploader skips them, create
   `.github/workflows/sync.yml` directly on GitHub with the pencil icon and paste the contents.
3. Upload in a few smaller batches. The web uploader silently drops files on large drags.
4. Commit.
5. Actions tab → **Sync RPT feed** → **Run workflow**.

## Confirming it worked

The run should finish green. Three guards make a failure loud instead of silent:

- **Verify the app is actually here** — fails if `index.html` is missing, rather than deploying an empty site.
- **Confirm the feed actually refreshed** — fails if the feed is more than 2 hours old.
- The staging step fails if `rpt-sync.js` or `accounts.json` would be published to the public site.

Then open the app. The Rod Pump Tracker header should read **LIVE** with today's date. If it reads
**STALE · <date>**, the workflow did not publish a new feed — that label is the new guard working.

Two things to expect on that first run:

- It will be the full 1,825-request sweep, because there is no `rpt-raw-cache.json.gz` in the repo
  yet. Every run after it is the 14-request weekly pull.
- Roughly eight weeks of runs and teardowns land at once, so well counts and inventory will shift.

## Still outstanding

- `postauto` has to be reactivated by RPT before any sync can succeed.
- The 214 teardown photos are not in this set. `teardown-photos.json` has `base: ""`, so it expects
  them at the repo root; upload them to match, or the teardown gallery comes up empty.
- The RPT password was published at `/propilot/rpt-sync.js` until 2026-08-17 and is still in git
  history. Rotation is the only real remediation.
