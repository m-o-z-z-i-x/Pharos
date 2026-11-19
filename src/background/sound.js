// UTILS
// -----------------------------------------------------------------------------
import { handleOffscreen } from "./offscreenTasks.js";

// SEPARATOR -------------------------------------------------------------------

const OFFSCREEN_URL = "/offscreen.html";

/**
 * runs DOM work: through an offscreen document in Chrome, directly in the Firefox background page
 * @param {any} browser
 */
export function createDomBridge(browser) {
  const isChrome = typeof browser.offscreen?.createDocument === "function";
  let creating = null;

  async function ensureOffscreen() {
    const contexts = await browser.runtime.getContexts?.({ contextTypes: ["OFFSCREEN_DOCUMENT"] });

    if (contexts?.length) return;

    creating ??= browser.offscreen
      .createDocument({ url: OFFSCREEN_URL, reasons: ["AUDIO_PLAYBACK", "DOM_PARSER"], justification: "Notification sounds and reading counters from HTML" })
      .finally(() => { creating = null; });

    await creating;
  }

  async function run(message) {
    if (!isChrome) return handleOffscreen(message);

    await ensureOffscreen();

    return browser.runtime.sendMessage({ target: "offscreen", ...message });
  }

  return {
    play: (name) => run({ type: "play", url: browser.runtime.getURL(`/sounds/${name}.wav`) }),
    parse: (html, queries, mime) => run({ type: "parse", html, queries, mime }).then((response) => response.results),
  };
}