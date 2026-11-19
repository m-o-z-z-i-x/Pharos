// UTILS
// -----------------------------------------------------------------------------
import ru from "./ru.js";
import en from "./en.js";

// SEPARATOR -------------------------------------------------------------------

const MESSAGES = { ru, en };
const listeners = new Set();
let locale = "en";

// which of the "one | few | many" forms a number takes
const PLURAL = {
  ru(count) {
    const m10 = count % 10;
    const m100 = count % 100;

    if (m100 > 10 && m100 < 20) return 2;
    if (m10 === 1) return 0;
    if (m10 >= 2 && m10 <= 4) return 1;

    return 2;
  },

  en: (count, forms) => (forms === 2 ? (count === 1 ? 0 : 1) : Math.min(count, 2)),
};

const lookup = (lang, key) => key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), MESSAGES[lang]);

/** @param {'ru'|'en'} next */
export function setLocale(next) {
  const chosen = next in MESSAGES ? next : "en";

  if (chosen === locale) return;

  locale = chosen;
  listeners.forEach((listener) => listener(locale));
}

export const getLocale = () => locale;

/**
 * call back on every change of language
 * @return a function that stops the calls
 */
export function onLocale(listener) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** whether the key has a text, in the current language or in English */
export const te = (key) => typeof lookup(locale, key) === "string" || typeof lookup("en", key) === "string";

/**
 * the text for a key with {name} filled in; a count picks the "one | few | many" form
 * a missing text falls back to English, then to the key itself
 * @param params - values for {name}
 * @param count - the number that picks the plural form
 */
export function t(key, params, count) {
  let text = lookup(locale, key);

  if (typeof text !== "string") text = lookup("en", key);
  if (typeof text !== "string") return key;

  if (count !== undefined && text.includes(" | ")) {
    const forms = text.split(" | ");
    const pick = (PLURAL[locale] ?? PLURAL.en)(Math.abs(count), forms.length);

    text = forms[Math.min(pick, forms.length - 1)];
  }

  return params ? text.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole)) : text;
}