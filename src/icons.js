const paths = {
  play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" stroke="none"/>',
  next: '<path d="m5 5 10 7-10 7Z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>',
  previous: '<path d="m19 5-10 7 10 7Z" fill="currentColor" stroke="none"/><path d="M6 5v14"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3M18 15l3 3-3 3M3 18h3c1.7 0 3-1.4 4-3M14 9c1.3-2 2.4-3 4-3h3M18 3l3 3-3 3"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 10V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 14v2a2 2 0 0 1-2 2H3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" stroke="none"/><path d="m10 9 6 3-6 3Z" fill="#121214" stroke="none"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
  wave: '<path d="M3 10v4M7 6v12M12 2v20M17 6v12M21 10v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>'
};
export const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.link}</svg>`;
export function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
