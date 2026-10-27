const SLACK = 140;
const DURATION = 680;
const COOLDOWN = 220;

let animating = false;
let wheelAccum = 0;
let wheelTimer = 0;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function navHeight() {
  return document.querySelector(".header")?.offsetHeight ?? 0;
}

function blocks() {
  const nodes = [...document.querySelectorAll("main > section")];
  const footer = document.querySelector("footer");
  if (footer) nodes.push(footer);
  return nodes;
}

function docTop(el) {
  return el.getBoundingClientRect().top + window.scrollY;
}

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function currentIndex(list) {
  const mark = window.scrollY + navHeight() + 2;
  let index = 0;
  list.forEach((el, i) => {
    if (docTop(el) <= mark) index = i;
  });
  return index;
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function scrollToY(top) {
  const target = Math.max(0, Math.min(top, maxScroll()));
  if (Math.abs(target - window.scrollY) < 2) return;

  if (reducedMotion()) {
    window.scrollTo(0, target);
    return;
  }

  animating = true;
  document.documentElement.classList.add("is-paging");
  const start = window.scrollY;
  const distance = target - start;
  const t0 = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - t0) / DURATION);
    window.scrollTo(0, start + distance * easeInOut(t));
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    window.scrollTo(0, target);
    window.setTimeout(() => {
      animating = false;
      document.documentElement.classList.remove("is-paging");
    }, COOLDOWN);
  }

  requestAnimationFrame(frame);
}

function step(direction) {
  if (animating) return;
  const list = blocks();
  if (!list.length) return;

  const index = currentIndex(list);
  const el = list[index];
  const top = docTop(el);
  const bottom = top + el.offsetHeight;
  const view = window.innerHeight;
  const nav = navHeight();
  const page = Math.max(120, view - nav);

  if (direction > 0) {
    const hiddenBelow = bottom - (window.scrollY + view);
    if (hiddenBelow > SLACK) {
      scrollToY(Math.min(window.scrollY + page, bottom - view));
      return;
    }
    const next = list[index + 1];
    if (next) scrollToY(docTop(next) - nav);
    return;
  }

  const hiddenAbove = window.scrollY - Math.max(0, top - nav);
  if (hiddenAbove > SLACK) {
    scrollToY(Math.max(top - nav, window.scrollY - page));
    return;
  }

  const prev = list[index - 1];
  if (!prev) {
    scrollToY(0);
    return;
  }

  const prevTop = docTop(prev);
  const prevBottom = prevTop + prev.offsetHeight;
  if (prevBottom - prevTop > page + SLACK) scrollToY(Math.max(prevTop - nav, prevBottom - view));
  else scrollToY(Math.max(0, prevTop - nav));
}

function chromeBlocked() {
  return Boolean(
    document.querySelector("dialog[open]") ||
      document.fullscreenElement ||
      document.body.classList.contains("nav-lock"),
  );
}

function inField(node) {
  return node instanceof Element && Boolean(node.closest("input, textarea, select, [contenteditable='true']"));
}

function wheelPixels(event) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

export function mountSectionScroll() {
  window.addEventListener(
    "wheel",
    (event) => {
      if (chromeBlocked()) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (animating) return;

      const delta = wheelPixels(event);
      if (!delta) return;

      if (event.deltaMode !== 0 || Math.abs(delta) >= 48) {
        wheelAccum = 0;
        step(delta > 0 ? 1 : -1);
        return;
      }

      wheelAccum += delta;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        wheelAccum = 0;
      }, 180);
      if (Math.abs(wheelAccum) < 64) return;
      const direction = wheelAccum > 0 ? 1 : -1;
      wheelAccum = 0;
      step(direction);
    },
    { passive: false },
  );

  window.addEventListener("keydown", (event) => {
    const down = event.key === "ArrowDown" || event.key === "PageDown";
    const up = event.key === "ArrowUp" || event.key === "PageUp";
    if (!down && !up) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (chromeBlocked() || inField(event.target) || inField(document.activeElement)) return;
    event.preventDefault();
    if (event.repeat || animating) return;
    step(down ? 1 : -1);
  });
}
