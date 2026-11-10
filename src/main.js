import "@fontsource/unbounded/500.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/600.css";
import "./styles.css";
import { mountExamplePlayer } from "./player.js";
import { createVideoGate } from "./video-gate.js";

const ACCESS_KEY = "vls-video-access";
const AUDIENCE_KEY = "vls-video-audience";
const root = document.documentElement;
const accessForm = document.querySelector("#access-form");
const playerRoot = document.querySelector(".player");
const playerBar = playerRoot?.querySelector(".player-bar");

function videoFor(audience) {
  if (audience === "student") return playerRoot?.dataset.videoStudent;
  if (audience === "parent") return playerRoot?.dataset.videoParent;
  return undefined;
}

function savedAudience() {
  try {
    return localStorage.getItem(AUDIENCE_KEY);
  } catch (error) {
    return null;
  }
}

const videoGate = createVideoGate();
const examplePlayer = mountExamplePlayer(playerRoot, {
  videoId: videoFor(savedAudience()),
  onProgress: (watched, duration) => videoGate.progress(watched, duration),
  onEnded: () => videoGate.unlock(),
  onFail: () => videoGate.unlock({ keep: false }),
  isLocked: () => root.classList.contains("is-video-locked"),
  onLocked: () => accessSteps?.focus(),
});

if (playerBar) playerBar.inert = root.classList.contains("is-video-locked");

function grantVideoAccess(form) {
  const audience = form.elements.namedItem("audience")?.value;
  try {
    localStorage.setItem(ACCESS_KEY, "1");
    if (audience) localStorage.setItem(AUDIENCE_KEY, audience);
  } catch (error) {}
  root.classList.remove("is-video-locked");
  if (playerBar) playerBar.inert = false;
  ["name", "phone", "grade"].forEach((name) => {
    const value = form.elements.namedItem(name)?.value;
    if (!value) return;
    document.querySelectorAll(`#consult-form [name='${name}'], #consult-dialog-form [name='${name}']`).forEach((field) => {
      if (!field.value) field.value = value;
    });
  });
  examplePlayer?.start(videoFor(audience));
}

const PHONE_MIN_DIGITS = 6;

const STEP_PAUSE_MS = 180;
const STEP_LEAVE_MS = 140;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function mountVideoSteps(form, { onDone }) {
  if (!form) return null;
  const steps = [...form.querySelectorAll("[data-step]")];
  const count = form.querySelector("[data-step-label]");
  const fill = form.querySelector("[data-step-fill]");
  const back = form.querySelector("[data-step-back]");
  let index = 0;
  let moving = false;

  function problem(step) {
    const kind = step.dataset.step;
    if (kind === "name" && !form.elements.namedItem("name").value.trim()) return "Укажите ФИО";
    if (kind === "phone") {
      const value = form.elements.namedItem("phone").value;
      if (!value.trim() || value.replace(/\D/g, "").length < PHONE_MIN_DIGITS) return "Укажите телефон";
    }
    return "";
  }

  function showProblem(step, message) {
    const slot = step.querySelector(".vsl-error");
    const input = step.querySelector("input:not([type='hidden'])");
    if (!slot || !input) return;
    slot.textContent = message;
    slot.hidden = !message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (message) input.setAttribute("aria-describedby", slot.id);
    else input.removeAttribute("aria-describedby");
  }

  function focusStep() {
    const step = steps[index];
    const target =
      step.querySelector(".vsl-option[aria-pressed='true']") ||
      step.querySelector(".vsl-option") ||
      step.querySelector("input:not([type='hidden'])");
    target?.focus({ preventScroll: true });
  }

  function paint() {
    steps.forEach((step, n) => {
      step.hidden = n !== index;
    });
    if (count) count.textContent = `Шаг ${index + 1} из ${steps.length}`;
    if (fill) fill.style.width = `${((index + 1) / steps.length) * 100}%`;
    if (back) back.hidden = index === 0;
  }

  function go(nextIndex, { focus = true } = {}) {
    if (moving || nextIndex === index || nextIndex < 0 || nextIndex >= steps.length) return;
    const leaving = steps[index];
    const finish = () => {
      leaving.classList.remove("is-leaving");
      index = nextIndex;
      paint();
      moving = false;
      if (focus) focusStep();
    };
    moving = true;
    if (reducedMotion.matches) {
      finish();
      return;
    }
    leaving.classList.add("is-leaving");
    window.setTimeout(finish, STEP_LEAVE_MS);
  }

  form.addEventListener("click", (event) => {
    const option = event.target instanceof Element ? event.target.closest(".vsl-option") : null;
    if (!option || moving) return;
    const step = option.closest("[data-step]");
    const field = form.elements.namedItem(step.dataset.field);
    if (field) field.value = option.dataset.value;
    step.querySelectorAll(".vsl-option").forEach((other) => {
      other.setAttribute("aria-pressed", other === option ? "true" : "false");
    });
    const next = steps.indexOf(step) + 1;
    window.setTimeout(() => go(next), reducedMotion.matches ? 0 : STEP_PAUSE_MS);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const step = steps[index];
    if (!step.querySelector("input:not([type='hidden'])")) return;
    const message = problem(step);
    showProblem(step, message);
    if (message) {
      focusStep();
      return;
    }
    if (index < steps.length - 1) go(index + 1);
    else onDone(form);
  });

  form.addEventListener("input", (event) => {
    const step = steps[index];
    if (event.target.getAttribute?.("aria-invalid") === "true") showProblem(step, problem(step));
  });

  back?.addEventListener("click", () => go(index - 1));

  paint();
  return { focus: focusStep };
}

const accessSteps = mountVideoSteps(accessForm, { onDone: grantVideoAccess });

const header = document.querySelector(".header");
const navToggle = document.querySelector("#nav-toggle");
const mobileLinks = document.querySelectorAll("[data-close-nav]");

function setNavOpen(open) {
  if (!navToggle || !header) return;
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  header.classList.toggle("is-open", open);
  document.body.classList.toggle("nav-lock", open);
}

navToggle?.addEventListener("click", () => {
  setNavOpen(navToggle.getAttribute("aria-expanded") !== "true");
});

mobileLinks.forEach((link) => {
  link.addEventListener("click", () => setNavOpen(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setNavOpen(false);
});

const faqItems = document.querySelectorAll("#faq details");
faqItems.forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    faqItems.forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

// Куда уходит заявка, сайт не называет: ни CRM, ни почта, ни другой адрес.
// Этот обработчик только показывает локальный успех и ничего не отправляет.
// Текст успеха и текст ошибки на публичных страницах не найдены — строки ниже плейсхолдер.

function bindConsultForm(form, { onSuccess } = {}) {
  if (!form) return;
  const panel = form.closest(".consult-panel");
  const success = panel?.querySelector(".form-success");
  const errorSummary = form.querySelector(".form-error");

  function fieldError(name) {
    return form.querySelector(`[data-error="${name}"]`);
  }

  function validateField(field) {
    const value = field.value;

    if (field.name === "name") {
      if (!value.trim()) return "Укажите имя";
    }

    if (field.name === "phone") {
      // Маска и обязательный код страны на сайте не описаны.
      // Ниже только пустое поле и строка без нескольких цифр, не международная маска.
      const digits = value.replace(/\D/g, "");
      if (!value.trim() || digits.length < PHONE_MIN_DIGITS) return "Укажите телефон";
    }

    if (field.name === "grade" && !value) return "Выберите класс";

    return "";
  }

  function showFieldError(field, message) {
    const slot = fieldError(field.name);
    field.setAttribute("aria-invalid", message ? "true" : "false");
    if (!slot) return;
    slot.textContent = message;
    slot.hidden = !message;
    if (message) field.setAttribute("aria-describedby", slot.id);
    else field.removeAttribute("aria-describedby");
  }

  function clearFormErrors() {
    if (errorSummary) errorSummary.hidden = true;
    Array.from(form.elements).forEach((field) => {
      if (!field.name || !fieldError(field.name)) return;
      showFieldError(field, "");
    });
  }

  form.addEventListener("input", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || !field.name || !fieldError(field.name)) return;
    if (field.getAttribute("aria-invalid") === "true") {
      showFieldError(field, validateField(field));
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if ((!success && !onSuccess) || !errorSummary) return;

    const fields = ["name", "phone", "grade"]
      .map((name) => form.elements.namedItem(name))
      .filter((field) => field instanceof HTMLInputElement || field instanceof HTMLSelectElement);

    let firstInvalid = null;
    fields.forEach((field) => {
      const message = validateField(field);
      showFieldError(field, message);
      if (message && !firstInvalid) firstInvalid = field;
    });

    if (firstInvalid) {
      errorSummary.hidden = false;
      firstInvalid.focus();
      return;
    }

    clearFormErrors();
    if (onSuccess) {
      onSuccess(form);
      return;
    }
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });
}

bindConsultForm(document.querySelector("#consult-form"));
bindConsultForm(document.querySelector("#consult-dialog-form"));

const consultDialog = document.querySelector("#consult-dialog");

function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  document.body.classList.add("dialog-lock");
  dialog.showModal();
  const name = dialog.querySelector("input[name='name']");
  const success = dialog.querySelector(".form-success");
  if (name && !name.closest("form")?.hidden) name.focus();
  else success?.focus();
}

function dismissDialog(dialog) {
  if (!dialog?.open) return;
  // close() внутри click по кнопке в диалоге не шлёт событие close.
  // Откладываем вызов, чтобы снять блокировку прокрутки в обработчике close.
  queueMicrotask(() => {
    if (dialog.open) dialog.close();
  });
}

[consultDialog].forEach((dialog) => {
  if (!dialog) return;
  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-lock");
  });
  dialog.querySelector("[data-close-consult], [data-close-dialog]")?.addEventListener("click", () => dismissDialog(dialog));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dismissDialog(dialog);
  });
});

document.querySelectorAll("[data-open-consult]").forEach((button) => {
  button.addEventListener("click", () => openDialog(consultDialog));
});

const selectionTimer = document.querySelector("[data-selection-timer]");

if (selectionTimer) {
  const HOUR_MS = 60 * 60 * 1000;
  const storageKey = "vls-uni-session-deadline";
  const saved = sessionStorage.getItem(storageKey);
  let deadline = Number(saved);
  if (!saved || !Number.isFinite(deadline)) {
    deadline = Date.now() + HOUR_MS;
    sessionStorage.setItem(storageKey, String(deadline));
  }

  const hoursEl = selectionTimer.querySelector("[data-timer-hours]");
  const minutesEl = selectionTimer.querySelector("[data-timer-minutes]");
  const secondsEl = selectionTimer.querySelector("[data-timer-seconds]");
  const spoken = document.querySelector("[data-timer-spoken]");
  let spokenMinute = -1;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function minuteWord(minutes) {
    const mod10 = minutes % 10;
    const mod100 = minutes % 100;
    if (mod10 === 1 && mod100 !== 11) return "минута";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "минуты";
    return "минут";
  }

  function paintSelectionTimer() {
    const left = Math.max(0, deadline - Date.now());
    const totalSeconds = Math.ceil(left / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hoursEl) hoursEl.textContent = pad(hours);
    if (minutesEl) minutesEl.textContent = pad(minutes);
    if (secondsEl) secondsEl.textContent = pad(seconds);

    const wholeMinutes = Math.ceil(totalSeconds / 60);
    if (spoken && wholeMinutes !== spokenMinute) {
      spokenMinute = wholeMinutes;
      spoken.textContent = totalSeconds <= 0
        ? "Регистрация на эту сессию закрыта."
        : wholeMinutes >= 60
          ? "До закрытия регистрации остался 1 час."
          : `До закрытия регистрации осталось ${wholeMinutes} ${minuteWord(wholeMinutes)}.`;
    }

    if (left > 0) window.setTimeout(paintSelectionTimer, 1000 - (Date.now() % 1000));
  }

  paintSelectionTimer();
}
