export const PREVIEW_SECONDS = 30;
/** Pick an interior excerpt while leaving room at the end. Unknown durations return null. */
export function previewWindow(duration, random = Math.random) {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const length = Math.min(PREVIEW_SECONDS, Math.max(1, duration * (duration < 35 ? .7 : 1)));
  const tail = duration >= 75 ? 15 : Math.max(1, duration * .07);
  const latest = Math.max(0, duration - length - tail);
  const desired = duration * (.25 + Math.min(1, Math.max(0, random())) * .15);
  const start = Math.min(latest, desired);
  return { start: Math.round(start * 10) / 10, end: Math.round((start + length) * 10) / 10, length: Math.round(length * 10) / 10 };
}
