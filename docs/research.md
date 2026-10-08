# Artist research — updated 8 October 2026

## Verified primary source

- Supplied channel: https://www.youtube.com/@AISoundCF/videos
- Channel name: **Creators of Fire**
- Handle: **@AISoundCF**
- Channel ID: **UCebUIqV2bAL9L2e_apvQSFw**
- Public channel description: **I Creators of fire ... ANDIAMO!**
- Public uploads playlist: https://www.youtube.com/playlist?list=UUebUIqV2bAL9L2e_apvQSFw
- Verified launch catalog: **121 uploads**, from “HOUR PEGASUS” through “Dark world”.
- Artwork: a hooded creator with illuminated eyes/headphones beside a robot, instruments and a burning orange city. Original avatar and banner downloaded from the channel's publicly referenced `yt3.googleusercontent.com` assets. See `assets/avatar.jpg` and `assets/banner.jpg`.
- The AI-music positioning and DistroKid distribution are supplied by the project owner. The minimal public channel description does not support invented names, locations, founding dates, biographies, awards or audience claims. None are added.

The initial catalog was transcribed from public uploads metadata (titles, IDs, durations and artwork), then verified/refreshed using the official Atom and oEmbed endpoints. The 106 older missing publication dates were filled once from public watch-page metadata, with channel-ID verification; this reads no media. Ongoing synchronization uses only official Atom, oEmbed or Data API endpoints.

## Platform verification

The project owner supplied the [official Spotify artist page](https://open.spotify.com/intl-it/artist/2A4wnASeDhlk5DYjnZjWGE). The [Apple Music artist page](https://music.apple.com/us/artist/creators-of-fire/1896547128) was confirmed by matching several distinct Creators of Fire release titles against the YouTube catalog. Similar names and irrelevant results were excluded. The other major music services are presented as distribution-presence marks only, without fabricated links. Availability can vary by release and region; search absence is not proof that a profile does not exist.

`data/platforms.json` retains verification evidence. At the owner's request, all six platform tiles are visual and non-clickable, including the two verified profiles.

## Playback sources and decisions

- IFrame API: https://developers.google.com/youtube/iframe_api_reference
- Developer policies: https://developers.google.com/youtube/terms/developer-policies
- Player parameters: https://developers.google.com/youtube/player_parameters
- Playlist pagination: https://developers.google.com/youtube/v3/docs/playlistItems/list
- Video metadata: https://developers.google.com/youtube/v3/docs/videos/list

The API documents start/end segments, play/pause, volume, seek, duration, playback states and autoplay-blocked events. Fire Mix uses these functions with a visible, unmodified native player. Interpretation: a user-requested sequence of visible short previews is technically achievable without audio extraction. This is an implementation based on the published API, not a claim of YouTube certification or policy pre-approval.

The smoother transition uses only the documented `setVolume` method with a short outgoing/incoming volume envelope. It does not process audio, overlay an alternate soundtrack, or create a second player. Mobile systems may ignore scripted volume changes; a restrained visual transition is retained. The official policy prohibits hidden/background playback, so the tab-visibility pause remains.

The design preserves native controls and ads, keeps one main player in its normal section, pauses on tab visibility changes, and offers direct watch links for restricted videos. The compact Now Playing bar stays on screen during scrolling; the video is never duplicated or detached into a floating card. It uses user-directed discovery and artist-specific editorial context rather than presenting a general YouTube clone.

## Existing Google Form

The project owner supplied the published Italian song-request Form. Its eight questions, exact option values, required status, consent and `entry.*` IDs were inspected on 8 October 2026 and are documented in `src/form-config.js`. A clearly marked test POST to its published `/formResponse` endpoint returned HTTP 200 and the Form's Italian confirmation page. This verifies Google Forms accepted that test response; the linked private Google Sheet was not accessed. The site uses English display labels with exact Italian submission values and no Google credentials.
