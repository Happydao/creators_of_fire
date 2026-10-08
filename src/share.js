const SITE_URL = 'https://happydao.github.io/creators_of_fire/';
const dialog = document.querySelector('#share-dialog');
const status = document.querySelector('#share-status');
let shareData = { title: 'Creators of Fire — AI Music', text: 'Discover Creators of Fire — AI Music 🔥', url: SITE_URL };
let previousFocus;
function fallback(data) {
  shareData = data;
  previousFocus = document.activeElement;
  status.textContent = '';
  document.querySelector('#share-description').textContent = data.url === SITE_URL ? 'Send this frequency to someone who needs it.' : `Share “${data.title}” with someone.`;
  const url = encodeURIComponent(data.url), text = encodeURIComponent(data.text);
  const targets = [
    ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${url}`],
    ['X', `https://twitter.com/intent/tweet?text=${text}&url=${url}`],
    ['WhatsApp', `https://api.whatsapp.com/send?text=${text}%20${url}`],
    ['Telegram', `https://t.me/share/url?url=${url}&text=${text}`],
    ['Email', `mailto:?subject=${encodeURIComponent(data.title)}&body=${text}%0A${url}`]
  ];
  document.querySelector('#share-targets').replaceChildren(...targets.map(([name, href]) => {
    const a = document.createElement('a'); a.href = href; a.textContent = `${name} ↗`;
    if (!href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }));
  dialog.showModal();
  document.querySelector('#copy-link').focus();
}
export async function share(data = { title: 'Creators of Fire — AI Music', text: 'Discover Creators of Fire — AI Music 🔥', url: SITE_URL }) {
  if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
    try { await navigator.share(data); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  fallback(data);
}
export function shareTrack(track) {
  if (!track) return;
  return share({ title: `${track.title} — Creators of Fire`, text: `Listen to ${track.title} by Creators of Fire 🔥`, url: track.url });
}
const copyButton = document.querySelector('#copy-link');
copyButton.addEventListener('click', async () => {
  let copied = false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(shareData.url); copied = true; } } catch { /* Try the selection fallback. */ }
  if (!copied) {
    const input = document.createElement('input'); input.value = shareData.url; input.readOnly = true; input.style.cssText = 'position:fixed;left:15px;bottom:15px;opacity:0';
    document.body.append(input); input.select();
    try { copied = document.execCommand('copy'); } catch { /* Manual copy is offered below. */ }
    input.remove();
  }
  if (copied) status.textContent = 'LINK COPIED 🔥';
  else {
    status.replaceChildren('Copy this link: ');
    const field = document.createElement('input'); field.readOnly = true; field.value = shareData.url; field.setAttribute('aria-label', 'Share URL'); status.append(field); field.select();
  }
});
dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => previousFocus?.focus());
document.querySelectorAll('[data-share-site]').forEach(button => button.addEventListener('click', () => share()));
