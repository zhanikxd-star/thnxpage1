// Блоки после первого экрана открываются, когда ролик просмотрен UNLOCK_SECONDS.
// Перемотка в плеере заблокирована, поэтому позиция воспроизведения равна просмотренному времени.
// Если ролик короче, открываем по его окончании. Если плеер не загрузился, открываем сразу,
// чтобы страница не осталась пустой.
export const UNLOCK_SECONDS = 180;
const STORAGE_KEY = "vls-video-unlocked";

function remembered() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Без хранилища блоки всё равно открываются до перезагрузки.
  }
}

export function createVideoGate() {
  const root = document.documentElement;
  const gated = [...document.querySelectorAll("main > section")].filter((section) => section.id !== "hero");
  const preview = new URLSearchParams(window.location.search).has("all");
  let open = preview || remembered();

  function apply() {
    root.classList.toggle("is-gated", !open);
    gated.forEach((section) => {
      section.hidden = !open;
    });
  }

  function unlock({ keep = true } = {}) {
    if (open) return;
    open = true;
    if (keep) remember();
    apply();
  }

  document.addEventListener("click", (event) => {
    if (open) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;
    const target = document.getElementById(link.getAttribute("href").slice(1));
    if (!target?.hidden) return;
    event.preventDefault();
    if (link.classList.contains("nav-cta")) document.querySelector(".hero-cta")?.click();
  });

  apply();

  return {
    isOpen: () => open,
    unlock,
    progress(watched, duration) {
      if (open) return;
      const need = duration > 0 ? Math.min(UNLOCK_SECONDS, duration - 1) : UNLOCK_SECONDS;
      if (watched >= need) unlock();
    },
  };
}
