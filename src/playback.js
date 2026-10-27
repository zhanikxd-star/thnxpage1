// Сколько секунд плеер считает обычным ходом воспроизведения, а не перемоткой.
// Опрос идёт несколько раз в секунду, поэтому живой ролик не прыгает дальше этого порога.
export const SEEK_LIMIT_SECONDS = 2;

export function nextPlaybackHead(head, current, playing, maxStep = SEEK_LIMIT_SECONDS) {
  if (!Number.isFinite(current) || current < 0) return { head, seekBack: false };
  const delta = current - head;
  if (delta > maxStep || delta < -0.75) return { head, seekBack: true };
  if (!playing || delta < 0) return { head, seekBack: false };
  return { head: current, seekBack: false };
}

export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
