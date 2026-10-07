# Artist research — 7 October 2026

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

The initial catalog was transcribed from public uploads metadata (titles, IDs, durations and artwork), then verified/refreshed using the official Atom and oEmbed endpoints. Ongoing synchronization uses only official Atom, oEmbed or Data API endpoints; the site has no scraper.

## Platform verification

Exact-name, handle, title and distributor searches were performed for Creators of Fire / AI Sound CF / AISoundCF across Spotify, Apple Music, Amazon Music, YouTube Music, Deezer, Tidal, SoundCloud and DistroKid HyperFollow. The returned indexed results did not provide an artist-owned cross-link or a confident matching catalog. Similar names and irrelevant results were excluded. Search absence is not proof that artist profiles do not exist.

Only the official YouTube channel is linked. `data/platforms.json` records evidence. Owner-provided DistroKid HyperFollow/profile URLs can be verified and added later.

## Playback sources and decisions

- IFrame API: https://developers.google.com/youtube/iframe_api_reference
- Developer policies: https://developers.google.com/youtube/terms/developer-policies
- Player parameters: https://developers.google.com/youtube/player_parameters
- Playlist pagination: https://developers.google.com/youtube/v3/docs/playlistItems/list
- Video metadata: https://developers.google.com/youtube/v3/docs/videos/list

The API documents start/end segments, play/pause, volume, seek, duration, playback states and autoplay-blocked events. Fire Mix uses these functions with a visible, unmodified native player. Interpretation: a user-requested sequence of visible short previews is technically achievable without audio extraction. This is an implementation based on the published API, not a claim of YouTube certification or policy pre-approval.

The design preserves native controls and ads, docks the visible player rather than hiding it, pauses on tab visibility changes and offers direct watch links for restricted videos. It uses user-directed discovery and artist-specific editorial context rather than presenting a general YouTube clone.
