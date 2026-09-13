// dom.js
// Thin wrapper around document.getElementById used everywhere in this app.
//
// Why this exists: the app has no build step and no per-element typing, so
// `document.getElementById(...)` returns a bare `HTMLElement | null` and
// every read of `.value`, `.checked`, `.style`, `.innerText`, etc. fails
// TypeScript's `checkJs`. Casting each of the ~260 call sites individually
// (`/** @type {HTMLInputElement} */ (...)`) would just move that busywork
// call-site by call-site and invite wrong casts along the way.
//
// $id intentionally returns `any`, not a specific element type. That is a
// deliberate, honest choice: this codebase doesn't track which element type
// lives behind which id, so pretending otherwise (casting to
// HTMLInputElement everywhere, including on the handful of ids that are
// actually a <select> or <span>) would be a bigger footgun than opting out
// of element-type checking. It still restores every other checkJs benefit:
// catching typos, wrong argument counts, wrong shapes, undefined variables.
/**
 * @param {string} id
 * @returns {any}
 */
function $id(id) {
  return document.getElementById(id);
}

/**
 * @param {string} selector
 * @returns {any}
 */
function $q(selector) {
  return document.querySelector(selector);
}

/**
 * @param {string} selector
 * @returns {any}
 */
function $qa(selector) {
  return document.querySelectorAll(selector);
}

if (typeof window !== 'undefined') {
  window.$id = $id;
  window.$q = $q;
  window.$qa = $qa;
}
