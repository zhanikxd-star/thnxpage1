import "@fontsource/unbounded/500.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/600.css";
import "./styles.css";
import { mountExamplePlayer } from "./player.js";

mountExamplePlayer(document.querySelector(".player"));

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

const PHONE_MIN_DIGITS = 6;

function bindConsultForm(form) {
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
    if (field.name === "country" && !value) return "Выберите страну интереса";

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
    if (!success || !errorSummary) return;

    const fields = ["name", "phone", "grade", "country"]
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
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });
}

bindConsultForm(document.querySelector("#consult-form"));
bindConsultForm(document.querySelector("#consult-dialog-form"));

const consultDialog = document.querySelector("#consult-dialog");

function openConsultDialog() {
  if (!consultDialog || consultDialog.open) return;
  document.body.classList.add("dialog-lock");
  consultDialog.showModal();
  const name = consultDialog.querySelector("input[name='name']");
  const success = consultDialog.querySelector(".form-success");
  if (name && !name.closest("form")?.hidden) name.focus();
  else success?.focus();
}

function dismissConsultDialog() {
  if (!consultDialog?.open) return;
  // close() внутри click по кнопке в диалоге не шлёт событие close.
  // Откладываем вызов, чтобы снять блокировку прокрутки в обработчике close.
  queueMicrotask(() => {
    if (consultDialog.open) consultDialog.close();
  });
}

consultDialog?.addEventListener("close", () => {
  document.body.classList.remove("dialog-lock");
});

document.querySelectorAll("[data-open-consult]").forEach((button) => {
  button.addEventListener("click", openConsultDialog);
});

consultDialog?.querySelector("[data-close-consult]")?.addEventListener("click", dismissConsultDialog);

consultDialog?.addEventListener("click", (event) => {
  if (event.target === consultDialog) dismissConsultDialog();
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
