export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—:—';
  const s = Math.floor(seconds);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// Editorial browsing labels, inferred only from explicit words in the published title.
export function category(title) {
  if (/drum\s*(and|&)\s*bass|\bdnb\b/i.test(title)) return 'Drum & bass';
  if (/dubstep/i.test(title)) return 'Dubstep';
  if (/rock|metal/i.test(title)) return 'Rock';
  if (/house|techno|electronic|edm|trance/i.test(title)) return 'Electronic';
  if (/pop/i.test(title)) return 'Pop';
  return 'Beyond genres';
}
export function shuffled(ids, first, random = Math.random) {
  const result = ids.filter(id => id !== first);
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return first ? [first, ...result] : result;
}
export function filterTracks(tracks, filter, query, saved) {
  const q = query.trim().toLocaleLowerCase();
  return tracks.filter(t => (filter === 'All' || (filter === 'Saved' ? saved.has(t.id) : category(t.title) === filter)) && (!q || t.title.toLocaleLowerCase().includes(q)));
}
export function validTrack(t) {
  return t && /^[\w-]{11}$/.test(t.id) && typeof t.title === 'string' && t.title.length > 0 && typeof t.thumbnail === 'string' && /^https:\/\/i\.ytimg\.com\//.test(t.thumbnail) && typeof t.url === 'string' && t.url === `https://www.youtube.com/watch?v=${t.id}`;
}
export function nextIndex(index, length, repeat, direction = 1) {
  if (!length) return -1;
  const next = index + direction;
  if (next >= 0 && next < length) return next;
  return repeat === 'all' ? (next + length) % length : -1;
}
