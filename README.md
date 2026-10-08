# Creators of Fire — AI Music

The official artist experience for [Creators of Fire / @AISoundCF](https://www.youtube.com/@AISoundCF).

**Website:** https://happydao.github.io/creators_of_fire/

Dark editorial design built around the artist's original hooded creator/robot artwork. Includes the verified 121-video launch catalog, a visible YouTube player, Fire Shuffle, 30-second Fire Mix, queue, progress, volume, repeat, search, editorial genre filters, grid/list views, locally saved favorites, sharing, and an on-site track request form. The queue normally follows newest uploads first; Shuffle changes its order. A **NEW RELEASE** badge appears for uploads less than 14 days old.

## Local development

Requires Node.js 22+; Python 3.9+ is needed only for catalog synchronization. No npm dependencies or install step.

```sh
npm run dev
# http://127.0.0.1:4173/creators_of_fire/
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
node scripts/serve.mjs --dist
```

The server serves both `/` and `/creators_of_fire/`. Stop a previous server before starting another on the same port, or set `PORT=4174`. Open through HTTP, not `file://`; YouTube requires a valid origin/referrer.

## Architecture

A static HTML/CSS/ES-module site, without a frontend framework, paid backend, or runtime API key. `scripts/build.mjs` validates the catalog and copies only public site files into `dist/`.

| Location | Purpose |
| --- | --- |
| `index.html` | Accessible document, artist copy, SEO/Open Graph and structured data |
| `src/styles.css` | Responsive design, reduced-motion support, self-hosted fonts |
| `src/app.js` | UI state, library, favorites, queue, shuffle and discovery |
| `src/player.js` | Official YouTube IFrame API and playback lifecycle |
| `src/catalog.js` | Catalog validation, filtering, queue boundaries, shuffle |
| `data/catalog.json` | Generated track metadata; actual media remains on YouTube |
| `data/artist.json` | Verified channel identity and artwork references |
| `data/platforms.json` | Six visual streaming-presence tiles and separately recorded verification evidence |
| `src/mix.js` | Duration-based, interior Fire Mix preview selection |
| `src/share.js` | Native sharing, accessible desktop fallback, and track sharing |
| `src/form-config.js` | Inspected Italian Google Form schema and English-to-Italian option mapping |
| `src/request.js` | English request modal, validation, anti-spam, and Google Forms submission |
| `assets/` | Artist-provided public channel imagery, original SVG favicon, licensed fonts |
| `scripts/sync_catalog.py` | Official Atom/oEmbed or Data API synchronization |
| `scripts/backfill_dates.py` | One-time historical publication-date repair from public watch-page metadata |
| `.github/workflows/pages.yml` | Scheduled sync, validation, build and Pages deployment |
| `privacy.html` | YouTube disclosures and local-preference deletion |
| `docs/research.md` | Source provenance, platform verification and design decisions |

`data/artist.json` is an identity reference for maintainers, not a runtime content CMS. Edit the static artist copy/SEO in `index.html` when changing identity information. All CSS, JavaScript, JSON, and asset URLs are relative; the canonical URL, sitemap, 404 return link and Open Graph URL explicitly target this repository's Pages URL.

## GitHub Pages deployment

1. Push to the repository's `main` branch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. The **Sync catalog & deploy Pages** workflow validates, builds, uploads `dist`, and deploys.
4. Visit https://happydao.github.io/creators_of_fire/.

The workflow uses the built-in `GITHUB_TOKEN` with narrowly scoped job permissions. No deployment token is needed. An initial push deploys the committed catalog even without an API key. Scheduled and manually dispatched runs synchronize first, then deploy in the same workflow; this avoids the limitation that bot commits do not recursively trigger another workflow. Concurrent runs are serialized. A sync failure fails the workflow and preserves the last deployed site and catalog.

If branch protection prevents the bot's catalog commit, adapt that step to open a pull request or store the snapshot in a dedicated branch; this repository initially has no such rule. GitHub scheduled jobs may be delayed and public-repository schedules can be disabled after 60 days of inactivity. Monitor the Actions page and re-enable the workflow if needed.

## Automatic YouTube synchronization

The workflow runs **every six hours**, at minute 23. It can also be run from **Actions → Sync catalog & deploy Pages → Run workflow**.

### Default: no key required

The public [YouTube Atom feed](https://www.youtube.com/feeds/videos.xml?channel_id=UCebUIqV2bAL9L2e_apvQSFw) returns recent uploads (typically the latest 15). The synchronizer merges them into the complete committed launch catalog by video ID, preserving older entries and known durations. It refreshes titles and availability for older entries via official YouTube oEmbed after 25 days. It validates channel ownership, rejects empty or malformed responses, retries transient network failures, and replaces the file atomically only after a successful complete run.

**Limitations:** RSS is a recent window, not a complete archive. If more than its window of uploads appear between successful runs, older missed videos require the full API sync below. RSS/oEmbed don't supply duration; new lengths appear when the YouTube player loads a track. Removed/private/non-embeddable older entries may disappear during oEmbed verification. Feed failures never erase the catalog. This mode does not use page scraping or undocumented YouTube endpoints.

All 121 existing tracks now have `publishedAt`. The newest dates came from Atom; a one-time historical backfill read public watch-page date metadata for older tracks and checked each channel ID. New uploads continue to receive dates automatically from Atom (or the optional Data API). `scripts/backfill_dates.py` is kept only for a future legacy-data repair; it is not part of the scheduled sync.

```sh
npm run sync
npm test
npm run build
```

### Optional: full YouTube Data API v3 sync

For the most reliable full archive refresh, create a Google Cloud API key restricted to **YouTube Data API v3**, enable that API, and add the key as a repository **Actions secret** named `YOUTUBE_API_KEY`. Do not add it to a public file, repository variable, JavaScript, or `.env` committed to Git.

When the secret exists, the same scheduled workflow uses the official uploads playlist with complete `playlistItems.list` pagination and batched `videos.list` calls. It refreshes titles, durations, publication dates, and embedding availability; deleted/private videos are removed. It uses a few low-cost quota requests for this catalog size (not expensive search requests). No paid backend is required, but Google API quotas still apply. Key creation is an owner setup step; no key is included in this project.

Use `YOUTUBE_API_KEY` in your shell environment for local full sync. The synchronizer suppresses URLs from error logs so secrets cannot be printed accidentally. An API error fails the run instead of silently downgrading to incomplete RSS results.

## YouTube playback and Fire Mix

Playback uses the supported [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), following the [developer policies](https://developers.google.com/youtube/terms/developer-policies):

- No media downloads, audio extraction, proxying, re-hosting, Web Audio interception, crossfading, or hidden audio player.
- The actual video is visible with YouTube controls, links, branding, and ads intact. Controls outside the frame call documented API methods.
- The main video remains in its normal player section. Scrolling shows only the compact bottom Now Playing bar; no second or floating video player is created. Hiding the browser tab pauses playback. Returning does not auto-resume. Browser and YouTube playback restrictions can still interrupt an off-screen video.
- The API and iframe load only after a user chooses playback. Thumbnail requests occur while browsing; see the privacy page.
- Fire Shuffle randomly selects a different track and creates a shuffled queue.
- Fire Mix is explicit opt-in. For tracks with a known duration it selects an interior start at approximately 25–40% of the track, keeps an ending margin, and requests about 30 seconds through `loadVideoById({videoId, startSeconds, endSeconds})`. Short tracks use a shorter safe window. For new RSS tracks without known durations, it waits for the official player to report the duration, then seeks into the interior. The `ENDED` event and a time check advance the queue. A 3.5-second outgoing fade uses the official IFrame API's `setVolume` method on the **single** visible player; no audio capture, distortion, or simultaneous crossfade is used. Mobile browsers can limit scripted volume changes, so a subtle visual transition accompanies the change. **Keep playing** reloads the same video at its current time without the preview end limit. **Stop** cues the full track without autoplay.
- Native YouTube seeking remains available. The main and bottom-player seek bars work in full-track mode; custom seeking is disabled during Fire Mix because YouTube documents that seeking cancels `endSeconds`.
- Timing is approximate due to buffering, keyframes, advertisements, and browser autoplay policies. Ads are never inspected, suppressed, or skipped. There is no promise of seamless DJ mixing.
- Autoplay blocking shows an explicit instruction to press the visible video player's Play control. Unavailable embeds display a direct YouTube fallback. Mobile OSes may reserve volume control for hardware buttons.
- Decorative energy effects follow playback state; they are not advertised as analysis of the underlying audio.
- The compact player has a small animated energy motif on its artwork. It runs only while the official player reports playback, pauses with playback, and becomes static under reduced-motion preferences. It is decorative, not BPM analysis or a captured audio waveform.

## Streaming presence

The six prominent tiles are Spotify, Apple Music, Amazon Music, YouTube Music, Deezer, and TIDAL. They are all **visual, non-clickable** marks at the owner's request, communicating the broader distribution ecosystem; availability can vary by release and region. `data/platforms.json` retains separately verified Spotify and Apple Music URLs for maintainers, but the section does not turn them into profile links or generic searches.

Platform icons live in `assets/platforms/`; see attribution below. An artist-owned profile cross-link or multiple uniquely matching releases are useful evidence for future links.

## Share the Fire

The site share button uses the browser's Web Share API when available. Otherwise an accessible dialog offers Copy Link, Facebook, X, WhatsApp, Telegram, and Email. The selected track has its own share button with the official YouTube watch URL. Share metadata and the absolute preview image URL are in `index.html`; preview caches on external social services can take time to refresh.

## Create Your Track

The English on-site modal posts to the **existing Italian Google Form**. The form and its linked Sheet are unchanged. The public form's questions, required fields, option values, consent text, and `entry.*` IDs were inspected on 8 October 2026 and centralized in `src/form-config.js`. English labels and choices map to the exact Italian values Google Forms expects, including its `__other_option__` mechanism. Required fields, optional email format, consent, a honeypot, pending-button lock, and a 30-second repeat cooldown are handled by `src/request.js`.

Submission is a native POST to the published `/formResponse` endpoint targeting a hidden iframe. GitHub Pages cannot read the cross-origin response or the private Sheet because Google Forms does not expose a CORS-readable submission result. The UI distinguishes an iframe response from a verified Sheet entry, and reports timeout/network uncertainty rather than asserting that a row exists. A clearly marked test request received HTTP 200 and the Form's Italian confirmation page; the private Sheet row was not inspected. The visible interface remains English, including the faithful translation of the existing terms. No Google credentials or Sheet access are present in the site.

If the Form owner edits questions, choices, or required status, re-inspect the published Form and update `src/form-config.js` and the request modal together. A future Form ID or `entry.*` change requires a corresponding code update.

## Manual content changes

- Artist/about copy and social metadata: `index.html`.
- Platform links: `data/platforms.json`.
- Verified source identity: `data/artist.json`.
- Channel artwork: `assets/avatar.jpg` and `assets/banner.jpg`.
- Catalog corrections: edit `data/catalog.json`, keeping valid 11-character YouTube IDs, original titles, `https://www.youtube.com/watch?v=ID`, YouTube thumbnail URLs, and verified `publishedAt` timestamps. Duration is optional and measured in seconds. Future syncs refresh source metadata, so permanent editorial content should be kept separately.
- Genre filters are site editorial labels derived from explicit words in original video titles; they are not YouTube category metadata. Unknown styles remain under **All tracks** / **Beyond genres**.
- Favorites and volume live only in browser local storage. The privacy page can clear them.

## Checks

Node tests cover catalog integrity, no-repeat shuffle, queue boundaries, search/saved filtering, duration formatting, Fire Mix windows, and request mapping. Python tests cover feed ownership, safe history merge, shortened channel-ID handling, and duration parsing. Before a release, also inspect desktop/tablet/mobile layouts, keyboard controls, real embed playback, autoplay/error states, Fire Mix advancement, form handling, and the `/creators_of_fire/` build path. Do not claim a Lighthouse score without running an audit.

## Rights and attribution

Artist artwork comes from the user-specified official channel and is used for this artist website at the project owner's request. Track thumbnails remain hosted by YouTube and videos retain their original titles and attribution. No rights to third-party material appearing in videos are asserted. Platform SVG marks come from [Simple Icons](https://simpleicons.org/) (CC0); names and marks belong to their respective owners. Barlow Condensed and DM Sans are self-hosted under their included SIL Open Font Licenses in `assets/fonts/`.
