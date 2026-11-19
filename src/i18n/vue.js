// UTILS
// -----------------------------------------------------------------------------
import { ref } from "vue";
import { t as plainT, te as plainTe, onLocale, getLocale } from "./index.js";

// SEPARATOR -------------------------------------------------------------------

// the texts themselves are plain; reading this ref inside t makes templates repaint when the language changes
const current = ref(getLocale());

onLocale((locale) => { current.value = locale; });

/** @type {typeof plainT} */
export const t = (key, params, count) => {
  void current.value;

  return plainT(key, params, count);
};

/** @type {typeof plainTe} */
export const te = (key) => {
  void current.value;

  return plainTe(key);
};

/** the same shape as useI18n of vue-i18n, so components keep `const { t } = useI18n()` */
export const useI18n = () => ({ t, te });