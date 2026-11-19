// UTILS
// -----------------------------------------------------------------------------
import { browser } from "wxt/browser";
import { handleOffscreen } from "@/background/offscreenTasks.js";
import { asyncListener } from "@/background/listen.js";

// SEPARATOR -------------------------------------------------------------------

// chrome only: the service worker has no Audio and no DOMParser, so it asks this hidden page

browser.runtime.onMessage.addListener(asyncListener(handleOffscreen, (message) => message?.target === "offscreen"));