import "@fontsource/unbounded/600.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/600.css";
import "./styles.css";

const navToggle = document.querySelector("#nav-toggle");
const header = document.querySelector(".header");
const mobileLinks = document.querySelectorAll("[data-close-nav]");
const prepButtons = document.querySelectorAll("[data-prep]");
const prepStatus = document.querySelector("[data-prep-status]");
const PREP_KEY = "impact-thankyou-prep";

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

function readPrep() {
  try {
    const raw = localStorage.getItem(PREP_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writePrep(selected) {
  try {
    localStorage.setItem(PREP_KEY, JSON.stringify([...selected]));
  } catch {
    /* private mode */
  }
}

function renderPrep(selected) {
  prepButtons.forEach((button) => {
    const on = selected.has(button.dataset.prep);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  if (!prepStatus) return;
  prepStatus.textContent = `Отмечено ${selected.size} из ${prepButtons.length}. Список хранится только в этом браузере.`;
}

const selectedPrep = readPrep();
renderPrep(selectedPrep);

prepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.prep;
    if (!id) return;
    if (selectedPrep.has(id)) selectedPrep.delete(id);
    else selectedPrep.add(id);
    writePrep(selectedPrep);
    renderPrep(selectedPrep);
  });
});

const navLinks = [...document.querySelectorAll("[data-nav]")];
const sections = [...new Set(navLinks.map((link) => link.getAttribute("href")))]
  .map((href) => document.querySelector(href))
  .filter(Boolean);

function markCurrent() {
  const line = window.scrollY + 140;
  let current = null;
  for (const section of sections) {
    if (section.offsetTop <= line) current = section.id;
  }
  navLinks.forEach((link) => {
    const on = current !== null && link.getAttribute("href") === `#${current}`;
    if (on) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

markCurrent();
document.addEventListener("scroll", markCurrent, { passive: true });
