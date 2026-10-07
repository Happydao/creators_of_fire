let apiPromise;
function loadAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { apiPromise = null; reject(new Error('YouTube took too long to respond. Try again or open this track on YouTube.')); }, 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(); };
    const old = document.querySelector('script[data-youtube-api]');
    old?.remove();
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api'; script.dataset.youtubeApi = 'true';
    script.onerror = () => { clearTimeout(timer); apiPromise = null; reject(new Error('The YouTube player could not load. Check your connection or open the track on YouTube.')); };
    document.head.append(script);
  });
  return apiPromise;
}
export class MusicPlayer {
  constructor({ onState, onEnd, onError, onReady, onBlocked }) {
    this.callbacks = { onState, onEnd, onError, onReady, onBlocked };
    this.ready = false; this.volume = 75; this.request = 0; this.state = -1;
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    window.addEventListener('pagehide', () => this.pause());
  }
  async ensure() {
    if (this.ready) return;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      await loadAPI();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('The embedded player is unavailable. Open this track on YouTube.')), 20000);
        this.instance = new window.YT.Player('youtube-player', {
          host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%',
          playerVars: { controls: 1, playsinline: 1, origin: location.origin, rel: 0, autoplay: 0 },
          events: {
            onReady: () => {
              clearTimeout(timeout); this.ready = true;
              this.instance.getIframe().title = 'Creators of Fire — official YouTube video player';
              this.instance.setVolume(this.volume); this.callbacks.onReady(); resolve();
            },
            onStateChange: ({ data }) => {
              this.state = data;
              if (document.hidden && data === 1) { this.pause(); return; }
              this.callbacks.onState(data);
              if (data === 0) this.callbacks.onEnd();
            },
            onError: ({ data }) => {
              const messages = { 2: 'This video could not be loaded.', 5: 'Your browser could not play this video.', 100: 'This track is no longer available on YouTube.', 101: 'The owner has disabled embedded playback.', 150: 'The owner has disabled embedded playback.', 153: 'YouTube could not verify this embed. Open the track on YouTube.' };
              this.callbacks.onError(messages[data] || 'YouTube playback is unavailable.');
            },
            onAutoplayBlocked: () => this.callbacks.onBlocked()
          }
        });
      });
    })();
    try { await this.initializing; } catch (error) { this.initializing = null; if (!this.ready && this.instance) { this.instance.destroy(); const host = document.createElement('div'); host.id = 'youtube-player'; document.querySelector('#video-surface').prepend(host); } throw error; }
  }
  async load(id, mix = false, start = 0, autoplay = true) {
    const request = ++this.request;
    await this.ensure();
    if (request !== this.request) return;
    const options = { videoId: id, startSeconds: start };
    if (mix) options.endSeconds = start + 10;
    if (document.hidden || !autoplay) this.instance.cueVideoById(options);
    else this.instance.loadVideoById(options);
  }
  play() { if (this.ready && !document.hidden) this.instance.playVideo(); }
  pause() { if (this.ready) this.instance.pauseVideo(); }
  seek(time) { if (this.ready) this.instance.seekTo(time, true); }
  setVolume(value) { this.volume = value; if (this.ready) this.instance.setVolume(value); }
  get time() { return this.ready ? this.instance.getCurrentTime() || 0 : 0; }
  get duration() { return this.ready ? this.instance.getDuration() || 0 : 0; }
}
