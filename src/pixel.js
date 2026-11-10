const fired = new Set();

export function track(event, params) {
  if (typeof window.fbq !== "function") return;
  if (params) window.fbq("track", event, params);
  else window.fbq("track", event);
}

export function trackOnce(key, event, params) {
  if (fired.has(key)) return;
  fired.add(key);
  track(event, params);
}

export function watchFormStart(form, { key, event, params }) {
  if (!form) return;
  const fire = () => trackOnce(key, event, params);
  form.addEventListener("focusin", fire);
  form.addEventListener("pointerdown", fire);
  form.addEventListener("input", fire);
  form.addEventListener("submit", fire);
}
