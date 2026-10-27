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

const form = document.querySelector("#consult-form");
const success = document.querySelector("#consult-success");
const errorSummary = document.querySelector("#consult-error");

// Куда уходит заявка, сайт не называет: ни CRM, ни почта, ни другой адрес.
// Этот обработчик только показывает локальный успех и ничего не отправляет.
// Текст успеха и текст ошибки на публичных страницах не найдены — строки ниже плейсхолдер.

const PHONE_MIN_DIGITS = 6;

function fieldError(name) {
  return form?.querySelector(`[data-error="${name}"]`);
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
  if (!form) return;
  errorSummary.hidden = true;
  Array.from(form.elements).forEach((field) => {
    if (!field.name || !fieldError(field.name)) return;
    showFieldError(field, "");
  });
}

form?.addEventListener("input", (event) => {
  const field = event.target;
  if (!(field instanceof HTMLElement) || !field.name || !fieldError(field.name)) return;
  if (field.getAttribute("aria-invalid") === "true") {
    showFieldError(field, validateField(field));
  }
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!form || !success || !errorSummary) return;

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
