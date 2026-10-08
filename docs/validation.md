# Release validation — 8 October 2026

Verified against the built site at `/creators_of_fire/` in Chrome:

- Desktop (1352px), tablet (768px), mobile (390px), narrow mobile (320px): no horizontal document overflow after the video intrinsic-size fix.
- Mobile embedded viewport at least 200px high. The main video remains in the player section; only the Now Playing bar stays fixed during scrolling.
- Actual YouTube playback, progress/duration updates, native controls, and a single iframe. Fire Mix began at an interior timestamp (1:49 on a 5:52 track) using the 30-second window.
- Fire Mix automatically advanced through real videos; Keep playing exits preview mode and restores full-track seeking.
- Six streaming-presence tiles rendered at desktop width, with only Spotify and Apple Music as verified links. All platform icon assets loaded.
- Share the Fire fallback dialog opened on desktop and Copy Link showed “LINK COPIED 🔥”.
- Create Your Track modal opened and closed; English fields, translated choice pills, required fields and email validation were inspected. The exact Italian `entry.*` and option mapping were tested. A marked POST received HTTP 200 and Google's Italian confirmation page; the private Sheet was not inspected.
- Search, empty search results, genre filters, grid/list toggle and 12→24 track pagination.
- Saved-track add/remove and Saved filter (test favorite removed afterward).
- The player iframe is absent before playback is requested.
- No application console errors during the checked playback flow.
- Live Atom/oEmbed synchronization completed successfully with all 121 tracks retained.
- Node and Python test suites pass; production build succeeds without npm dependencies.
- Repository deployment workflow performs these checks before publishing.

Browser emulation verifies responsive layouts, not native iOS/Android hardware volume behavior. YouTube playback may differ by region, account, browser autoplay policy, advertisement, or video embedding permission. No Lighthouse score is claimed.
