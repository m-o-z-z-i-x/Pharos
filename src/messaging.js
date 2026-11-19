// UTILS
// -----------------------------------------------------------------------------
import { browser } from "wxt/browser";

// SEPARATOR -------------------------------------------------------------------

// ask the background. every answer is a plain object. failures come back as { ok: false, error }
export function send(type, payload = {}) {
  return browser.runtime.sendMessage({ type, ...payload }).catch((thrown) => ({ ok: false, error: String(thrown?.message ?? thrown) }));
}