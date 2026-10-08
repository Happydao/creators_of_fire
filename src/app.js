import { category, filterTracks, formatPublished, formatTime, isNewRelease, nextIndex, shuffled, validTrack } from './catalog.js';
import { hydrateIcons, icon } from './icons.js';
import { MusicPlayer } from './player.js';
import { previewGain, previewWindow } from './mix.js';
import { shareTrack } from './share.js';
import './request.js';
const $ = selector => document.querySelector(selector);
const text = (selector, value) => { $(selector).textContent = value; };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode: session remains usable. */ } }
const storedSaved = readStored('cof-saved', []);
const saved = new Set(Array.isArray(storedSaved) ? storedSaved.filter(id => typeof id === 'string') : []);
let tracks = [], trackMap = new Map(), order = [], position = 0, current;
let filter = 'All', limit = 12, repeat = 'off', shuffle = false, mix = false;
let started = false, hasError = false, loading = false, loadRequest = 0, mixPlan = null, mixAdvancing = false;
let toastTimer, liveAnnounce, fadeTimer, fadeRequest = 0, mixFadeStarted = false;
hydrateIcons();
text('#year', new Date().getFullYear());
function toast(message) { text('#toast', message); $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2600); }
function message(value) { text('#player-message', value); }
const player = new MusicPlayer({
  onReady: () => { $('#video-poster').hidden = true; },
  onState: state => {
    document.body.classList.toggle('is-playing', state === 1);
    const playing = state === 1;
    ['#play', '#bar-play'].forEach(selector => { $(selector).innerHTML = icon(playing ? 'pause' : 'play'); $(selector).setAttribute('aria-label', playing ? 'Pause' : 'Play'); });
    text('#playback-state', ({ 1: 'SIGNAL ACTIVE', 2: 'PAUSED', 3: 'CONNECTING', 0: 'TRACK ENDED', 5: 'READY TO PLAY' })[state] || 'READY TO IGNITE');
    if (state === 1) {
      hasError = false; message(mix ? 'Fire Mix · 30-second discovery from within each track.' : 'Playing through the official YouTube player.');
      if (mix && !mixFadeStarted) { mixFadeStarted = true; fadeIn(); }
    }
    if (mix && mixFadeStarted && (state === 2 || state === 3)) { ++fadeRequest; clearInterval(fadeTimer); player.setTransitionGain(1); }
    if (state === 2 && document.hidden) message('Paused while this tab is hidden. Press play to continue.');
    updateNowBar();
  },
  onEnd: () => {
    if (loading || hasError || document.hidden) return;
    if (!mix && repeat === 'one') { select(current.id, { rebuild: false }); return; }
    const index = nextIndex(position, order.length, mix ? 'all' : repeat);
    if (index === -1) { message('You’ve reached the end of the queue. Try Fire Shuffle for another direction.'); return; }
    position = index; select(order[position], { rebuild: false });
  },
  onError: error => { hasError = true; setMix(false); message(`${error} Use the YouTube link, or choose another track.`); text('#playback-state', 'PLAYBACK UNAVAILABLE'); },
  onBlocked: () => { message('Your browser paused autoplay. Press play in the visible YouTube video to continue.'); text('#playback-state', 'PRESS PLAY TO CONTINUE'); }
});
const initialVolume = Number(readStored('cof-volume', 75));
player.setVolume(Number.isFinite(initialVolume) ? Math.max(0, Math.min(100, initialVolume)) : 75);
$('#volume').value = player.volume;
function updateNowBar() { $('#now-bar').hidden = !started; }
function fadeIn() {
  const request = ++fadeRequest;
  clearInterval(fadeTimer);
  const began = performance.now();
  fadeTimer = setInterval(() => {
    if (request !== fadeRequest || !mix || player.state !== 1) { clearInterval(fadeTimer); return; }
    const gain = Math.min(1, (performance.now() - began) / 850);
    player.setTransitionGain(gain);
    if (gain >= 1) clearInterval(fadeTimer);
  }, 70);
}
function resetFade() { ++fadeRequest; clearInterval(fadeTimer); player.setTransitionGain(1); document.body.classList.remove('mix-changing'); }
function mixFlash() { document.body.classList.add('mix-changing'); setTimeout(() => document.body.classList.remove('mix-changing'), 700); }
function updateCurrent() {
  if (!current) return;
  text('#now-title', current.title); text('#bar-title', current.title);
  text('#track-category', 'CREATORS OF FIRE / YOUTUBE');
  text('#now-date', formatPublished(current.publishedAt)); text('#bar-date', formatPublished(current.publishedAt));
  $('#now-new').hidden = !isNewRelease(current.publishedAt);
  $('#now-youtube').href = current.url;
  $('#poster-image').src = current.thumbnail; $('#bar-art').src = current.thumbnail;
  text('#duration', formatTime(current.duration)); text('#elapsed', '0:00'); text('#bar-duration', formatTime(current.duration)); text('#bar-elapsed', '0:00'); $('#progress').value = 0; $('#bar-seek').value = 0;
  $('#favorite').setAttribute('aria-pressed', saved.has(current.id));
  $('#favorite').setAttribute('aria-label', saved.has(current.id) ? 'Unsave selected track' : 'Save selected track');
  document.querySelectorAll('.track-card').forEach(card => card.classList.toggle('selected', card.dataset.id === current.id));
  renderQueue();
}
function renderQueue() {
  $('#queue').innerHTML = order.map((id, index) => ({ track: trackMap.get(id), index })).slice(position, position + 12).map(({ track: t, index }) => `<li><button class="queue-track ${index === position ? 'current' : ''}" data-id="${t.id}" data-position="${index}" ${index === position ? 'aria-current="true"' : ''} aria-label="Play ${escape(t.title)}"><span class="queue-number">${index === position ? '▶' : String(index + 1).padStart(2, '0')}</span><img src="${escape(t.thumbnail)}" alt="" loading="lazy" width="52" height="43"><span class="queue-text"><b>${escape(t.title)}</b><small>Creators of Fire · ${formatPublished(t.publishedAt)}</small>${isNewRelease(t.publishedAt) ? '<em class="release-badge">NEW RELEASE</em>' : ''}</span><time>${formatTime(t.duration)}</time></button></li>`).join('');
  text('#queue-count', `${order.length - position} IN QUEUE`);
}
function setMix(value) {
  mix = value; $('#mix-status').hidden = !mix;
  if (!value) resetFade();
  text('#device-mode', mix ? '30-SECOND PREVIEW' : 'FULL TRACK');
  $('#progress').disabled = mix || !player.ready || hasError;
  $('#bar-seek').disabled = mix || !player.ready || hasError;
  $('#fire-mix').setAttribute('aria-pressed', mix);
}
function setShuffle(value) {
  shuffle = value; $('#shuffle-mode').setAttribute('aria-pressed', value);
  $('#shuffle-mode').setAttribute('aria-label', value ? 'Disable shuffle' : 'Enable shuffle');
  text('.queue-intro', value ? 'A shuffled current. Pick what comes next.' : 'Newest releases first. Or change the current.');
}
async function select(id, { rebuild = true, scroll = false } = {}) {
  if (!trackMap.has(id)) return;
  const request = ++loadRequest;
  current = trackMap.get(id); hasError = false; loading = true;
  if (rebuild) { order = shuffle ? shuffled(tracks.map(t => t.id), id) : tracks.map(t => t.id); position = order.indexOf(id); }
  mixPlan = mix ? previewWindow(current.duration) : null; mixAdvancing = false;
  mixFadeStarted = false;
  if (mix) { ++fadeRequest; clearInterval(fadeTimer); player.setTransitionGain(0); mixFlash(); }
  started = true; updateCurrent(); updateNowBar(); message('Connecting to YouTube…');
  if (scroll) $('#listen').scrollIntoView({ behavior: 'smooth' });
  $('#listen').classList.remove('igniting'); requestAnimationFrame(() => $('#listen').classList.add('igniting'));
  try { await player.load(id, mix && Boolean(mixPlan), mixPlan?.start || 0, true, mixPlan?.length || 30); if (request === loadRequest) { $('#progress').disabled = mix; $('#bar-seek').disabled = mix; } }
  catch (error) { if (request === loadRequest) { hasError = true; message(error.message); text('#playback-state', 'CONNECTION UNAVAILABLE'); } }
  finally { if (request === loadRequest) loading = false; }
}
async function togglePlay() {
  if (!current) return;
  if (!started || hasError || !player.ready) { await select(current.id, { rebuild: false }); return; }
  if (player.state === 1) player.pause();
  else player.play();
}
function skip(direction) {
  if (!current) return;
  if (direction < 0 && player.time > 3 && !mix) { player.seek(0); return; }
  const index = nextIndex(position, order.length, 'all', direction);
  if (index < 0) return;
  position = index; select(order[position], { rebuild: false });
}
function fireShuffle() {
  if (!tracks.length) return;
  setMix(false); setShuffle(true);
  const candidates = tracks.filter(t => t.id !== current?.id);
  const id = (candidates.length ? candidates : tracks)[Math.floor(Math.random() * (candidates.length || tracks.length))].id;
  select(id, { scroll: !started }); toast('A new frequency. Let it take you somewhere.');
}
function renderLibrary() {
  const result = filterTracks(tracks, filter, $('#search').value, saved);
  text('#result-count', `${result.length} ${result.length === 1 ? 'track' : 'tracks'}${filter !== 'All' ? ` / ${filter}` : ' / Full collection'} · Artwork & videos from YouTube`);
  $('#empty-state').hidden = result.length > 0; $('#load-more').hidden = result.length <= limit;
  $('#track-grid').innerHTML = result.slice(0, limit).map(t => `<article class="track-card ${t.id === current?.id ? 'selected' : ''}" data-id="${t.id}"><button class="track-art" data-play="${t.id}" aria-label="Play ${escape(t.title)}"><img src="${escape(t.thumbnail)}" alt="" width="480" height="360" loading="lazy"><span class="track-category">${escape(category(t.title).toUpperCase())}</span><span class="art-play">${icon('play')}</span><time>${formatTime(t.duration)}</time></button><h3><button data-play="${t.id}">${escape(t.title)}</button></h3><div class="card-bottom"><span>Creators of Fire · <time ${t.publishedAt ? `datetime="${escape(t.publishedAt)}"` : ''}>${formatPublished(t.publishedAt)}</time>${isNewRelease(t.publishedAt) ? '<em class="release-badge">NEW RELEASE</em>' : ''}</span><div class="card-actions"><button data-queue="${t.id}" aria-label="Play next: ${escape(t.title)}" title="Play next">${icon('plus')}</button><a href="${t.url}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${escape(t.title)} on YouTube">YouTube ↗</a></div></div></article>`).join('');
}
$('#queue').addEventListener('click', event => { const button = event.target.closest('[data-id]'); if (button) { setMix(false); position = Number(button.dataset.position); select(button.dataset.id, { rebuild: false }); } });
$('#track-grid').addEventListener('click', event => {
  const play = event.target.closest('[data-play]');
  if (play) { setMix(false); select(play.dataset.play, { scroll: !started }); }
  const add = event.target.closest('[data-queue]');
  if (add) {
    const id = add.dataset.queue;
    if (id === current.id) { toast('This track is already selected.'); return; }
    order = order.filter((item, i) => item !== id || i <= position);
    order.splice(position + 1, 0, id); renderQueue(); toast('Added to play next.');
  }
});
$('#favorite').onclick = () => {
  if (!current) return;
  saved.has(current.id) ? saved.delete(current.id) : saved.add(current.id);
  store('cof-saved', [...saved]); updateCurrent(); if (filter === 'Saved') renderLibrary(); toast(saved.has(current.id) ? 'Saved to your collection on this device.' : 'Removed from saved tracks.');
};
['#play', '#bar-play', '#video-poster'].forEach(selector => { $(selector).onclick = togglePlay; });
$('#hero-play').onclick = () => { if (!current) return; setMix(false); select(current.id, { scroll: true }); };
['#next', '#bar-next'].forEach(selector => { $(selector).onclick = () => skip(1); });
['#previous', '#bar-previous'].forEach(selector => { $(selector).onclick = () => skip(-1); });
document.querySelectorAll('[data-action="shuffle"]').forEach(button => { button.onclick = fireShuffle; });
$('#shuffle-mode').onclick = () => { if (!current) return; setShuffle(!shuffle); order = shuffle ? shuffled(tracks.map(t => t.id), current.id) : tracks.map(t => t.id); position = order.indexOf(current.id); renderQueue(); };
$('#repeat').onclick = () => { repeat = ({ off: 'all', all: 'one', one: 'off' })[repeat]; $('#repeat').setAttribute('aria-pressed', repeat !== 'off'); $('#repeat').setAttribute('aria-label', `Repeat ${repeat}; change repeat mode`); $('#repeat-one').hidden = repeat !== 'one'; toast(`Repeat ${repeat}`); };
$('#fire-mix').onclick = () => {
  if (!tracks.length) return;
  setMix(true); setShuffle(true); order = shuffled(tracks.map(t => t.id)); position = 0;
  select(order[0], { rebuild: false, scroll: true }); toast('Fire Mix on · 30-second previews.');
};
$('#keep-track').onclick = () => { const time = player.time; setMix(false); player.load(current.id, false, time).catch(error => message(error.message)); toast('This one stays. Full track playing.'); };
$('#stop-mix').onclick = () => { setMix(false); player.pause(); player.load(current.id, false, player.time, false).catch(error => message(error.message)); message('Fire Mix stopped. Press play for the full track.'); };
$('#progress').oninput = event => { if (!mix) { player.seek(Number(event.target.value)); text('#elapsed', formatTime(Number(event.target.value))); } };
$('#bar-seek').oninput = event => { if (!mix) { text('#bar-elapsed', formatTime(Number(event.target.value))); $('#bar-seek').style.setProperty('--played', `${Number(event.target.value) / Math.max(1, Number(event.target.max)) * 100}%`); } };
$('#bar-seek').onchange = event => { if (!mix) player.seek(Number(event.target.value)); };
$('#volume').oninput = event => { const value = Number(event.target.value); player.setVolume(value); store('cof-volume', value); };
$('#share-track').onclick = () => shareTrack(current);
$('#search').oninput = () => { clearTimeout(liveAnnounce); liveAnnounce = setTimeout(() => { limit = 12; renderLibrary(); }, 120); };
document.querySelectorAll('[data-filter]').forEach(button => { button.onclick = () => { filter = button.dataset.filter; limit = 12; document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); }); renderLibrary(); }; });
$('#reset-filters').onclick = () => { $('#search').value = ''; $('[data-filter="All"]').click(); };
$('#load-more').onclick = () => { limit += 12; renderLibrary(); };
const menuToggle = $('#menu-toggle'), mainNav = $('#main-nav');
function closeMenu() { mainNav.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'Open menu'); }
menuToggle.onclick = () => { const open = mainNav.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && mainNav.classList.contains('open')) { closeMenu(); menuToggle.focus(); } });
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
window.matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);
['grid', 'list'].forEach(view => { $(`#${view}-view`).onclick = () => { $('#track-grid').classList.toggle('list', view === 'list'); ['grid', 'list'].forEach(v => { $(`#${v}-view`).classList.toggle('active', v === view); $(`#${v}-view`).setAttribute('aria-pressed', v === view); }); }; });
setInterval(() => {
  if (!player.ready || document.hidden || !current) return;
  const time = player.time, duration = player.duration || current.duration;
  if (mix && !mixPlan && duration > 0 && player.state === 1) {
    mixPlan = previewWindow(duration);
    if (mixPlan && time < mixPlan.start - 1) player.seek(mixPlan.start);
  }
  if (mix && mixPlan && !mixAdvancing && player.state === 1 && time >= mixPlan.end - .25) {
    mixAdvancing = true; const index = nextIndex(position, order.length, 'all');
    if (index >= 0) { position = index; select(order[position], { rebuild: false }); return; }
  }
  if (mix && mixPlan && player.state === 1 && !mixAdvancing && time > mixPlan.end - 1.4) player.setTransitionGain(previewGain(time, mixPlan.end));
  text('#elapsed', formatTime(time)); text('#duration', formatTime(duration));
  if (document.activeElement !== $('#bar-seek')) { $('#bar-seek').max = duration || 100; $('#bar-seek').value = Math.min(time, duration || 100); text('#bar-elapsed', formatTime(time)); $('#bar-seek').style.setProperty('--played', `${duration ? Math.min(100, Math.max(0, time / duration * 100)) : 0}%`); }
  text('#bar-duration', formatTime(duration)); $('#bar-seek').setAttribute('aria-valuetext', `${formatTime(time)} of ${formatTime(duration)}`);
  if (document.activeElement !== $('#progress')) { $('#progress').max = duration || 100; $('#progress').value = Math.min(time, duration); }
  $('#progress').setAttribute('aria-valuetext', `${formatTime(time)} of ${formatTime(duration)}`);
}, 400);
async function initialize() {
  try {
    const response = await fetch(new URL('../data/catalog.json', import.meta.url));
    if (!response.ok) throw new Error('Catalog unavailable');
    const catalog = await response.json();
    tracks = catalog.tracks.filter(validTrack); if (!tracks.length) throw new Error('Empty catalog');
    trackMap = new Map(tracks.map(t => [t.id, t])); order = tracks.map(t => t.id); current = tracks[0];
    text('#hero-count', tracks.length); text('#library-count', tracks.length); updateCurrent(); renderLibrary();
  } catch {
    message('The catalog could not load. Explore all releases on our YouTube channel.');
    text('#result-count', 'The library is temporarily unavailable. Please reload or visit YouTube.');
    $('#load-more').hidden = true;
    document.querySelectorAll('#hero-play, [data-action="shuffle"], #fire-mix, #play, #next, #previous, #favorite, #shuffle-mode, #video-poster').forEach(button => { button.disabled = true; });
  }
  try {
    const response = await fetch(new URL('../data/platforms.json', import.meta.url));
    if (!response.ok) return;
    const platforms = await response.json();
    const allowed = new Set(['spotify', 'applemusic', 'amazonmusic', 'youtubemusic', 'deezer', 'tidal']);
    $('#platforms').innerHTML = platforms.filter(p => allowed.has(p.icon)).map(p => `<div class="stream-tile"><span class="stream-icon"><img src="./assets/platforms/${p.icon}.svg" alt="" width="48" height="48"></span><strong>${escape(p.name)}</strong></div>`).join('');
  } catch { /* Keep the static platform preview if the data file is unavailable. */ }
}
initialize();
