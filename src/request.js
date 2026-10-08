import { requestForm, mappedRequest } from './form-config.js';
const dialog = document.querySelector('#request-dialog');
const form = document.querySelector('#request-form');
const iframe = document.querySelector('#request-response');
const status = document.querySelector('#request-status');
const submitButton = document.querySelector('#request-submit');
let previousFocus, pending = false, timeout;
for (const [key, field] of Object.entries(requestForm.fields)) {
  if (!field.options) continue;
  const group = dialog.querySelector(`[data-options="${key}"]`);
  group.replaceChildren(...field.options.map((option, index) => {
    const label = document.createElement('label'); label.className = 'choice-pill';
    const input = document.createElement('input'); input.type = 'radio'; input.name = key; input.value = option.value; input.required = index === 0;
    const span = document.createElement('span'); span.textContent = option.label;
    label.append(input, span); return label;
  }));
}
const other = form.querySelector('#other-genre-wrap');
form.addEventListener('change', event => {
  if (event.target.name !== 'genre') return;
  const enabled = event.target.value === '__other_option__';
  other.hidden = !enabled; other.querySelector('input').required = enabled;
});
function setPending(value) {
  pending = value; submitButton.disabled = value;
  submitButton.textContent = value ? 'SENDING YOUR REQUEST…' : 'SEND REQUEST ↗';
  form.setAttribute('aria-busy', String(value));
}
function fail(message) { clearTimeout(timeout); setPending(false); status.textContent = message; status.classList.add('error'); }
function open() {
  previousFocus = document.activeElement; status.classList.remove('error');
  dialog.showModal(); form.querySelector('[name="name"]').focus();
}
function close() { if (pending) return; dialog.close(); }
document.querySelectorAll('[data-open-request]').forEach(button => button.addEventListener('click', open));
dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', close));
dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
dialog.addEventListener('close', () => { previousFocus?.focus(); if (!pending && !dialog.querySelector('#request-success').hidden) { form.reset(); other.hidden = true; other.querySelector('input').required = false; form.hidden = false; dialog.querySelector('#request-success').hidden = true; status.textContent = 'Fields marked * are required.'; } });
form.addEventListener('submit', event => {
  event.preventDefault();
  if (pending) return;
  const last = Number(sessionStorage.getItem('cof-request-last') || 0);
  if (Date.now() - last < 30000) { status.textContent = 'Please wait a moment before sending another request.'; return; }
  if (!form.reportValidity()) { status.textContent = 'Please complete the required fields and check your email address.'; status.classList.add('error'); return; }
  const values = Object.fromEntries(new FormData(form));
  values.name = values.name?.trim(); values.description = values.description?.trim();
  if (!values.name || !values.description) { status.textContent = 'Your name and track description are required.'; status.classList.add('error'); (values.name ? form.elements.description : form.elements.name).focus(); return; }
  if (values.website) { status.textContent = 'Please try again.'; return; }
  let mapped;
  try { mapped = mappedRequest(values); }
  catch { status.textContent = 'Please review your choices and try again.'; status.classList.add('error'); return; }
  status.classList.remove('error'); status.textContent = 'SENDING YOUR REQUEST…'; setPending(true);
  // Google Forms does not expose a CORS-readable response to GitHub Pages.
  // A single hidden frame receives its native formResponse page; never store credentials.
  let handled = false;
  const finish = () => {
    if (handled) return; handled = true; clearTimeout(timeout); iframe.removeEventListener('load', finish);
    setPending(false); sessionStorage.setItem('cof-request-last', String(Date.now()));
    form.hidden = true; dialog.querySelector('#request-success').hidden = false;
    dialog.querySelector('#request-success button').focus();
  };
  iframe.addEventListener('load', finish);
  timeout = setTimeout(() => {
    if (handled) return; handled = true; iframe.removeEventListener('load', finish);
    fail('We could not confirm a response from Google Forms. Please check your connection before trying again.');
  }, 25000);
  const payload = document.createElement('form'); payload.method = 'POST'; payload.action = requestForm.action;
  payload.target = iframe.name; payload.acceptCharset = 'UTF-8'; payload.hidden = true;
  for (const [key, value] of mapped) { const input = document.createElement('input'); input.type = 'hidden'; input.name = key; input.value = value; payload.append(input); }
  document.body.append(payload); payload.submit(); payload.remove();
});
