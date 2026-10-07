# Release validation — 7 October 2026

Verified against the built site at `/creators_of_fire/` in Chrome:

- Desktop (1352px), tablet (768px), mobile (390px), narrow mobile (320px): no horizontal document overflow after the video intrinsic-size fix.
- Mobile embedded viewport at least 200px high; docked frame 278 × 200px visible content at 390px viewport.
- Actual YouTube playback, progress/duration updates, native controls and visible dock.
- Fire Mix automatically advanced through multiple real videos; Keep playing exited preview mode and restored full-track seeking.
- Search, empty search results, genre filters, grid/list toggle and 12→24 track pagination.
- Saved-track add/remove and Saved filter (test favorite removed afterward).
- The player iframe is absent before playback is requested.
- No application console errors during the checked playback flow.
- Live Atom/oEmbed synchronization completed successfully with all 121 tracks retained.
- Five Node tests and four Python tests pass; production build succeeds without npm dependencies.
- Repository deployment workflow performs these checks before publishing.

Browser emulation verifies responsive layouts, not native iOS/Android hardware volume behavior. YouTube playback may differ by region, account, browser autoplay policy, advertisement, or video embedding permission. No Lighthouse score is claimed.
