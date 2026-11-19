// UTILS
// -----------------------------------------------------------------------------
import { browser } from "wxt/browser";
import { createRegistry } from "@/drivers/registry.js";
import mastodon from "@/drivers/mastodon.js";
import bluesky from "@/drivers/bluesky.js";
import matrix from "@/drivers/matrix.js";
import { ruleDriver } from "@/drivers/ruleDriver.js";
import { loadCatalog } from "@/rules/catalog.js";
import { createHttp } from "@/background/http.js";
import { createDomBridge } from "@/background/sound.js";
import { createNotifier } from "@/background/notify.js";
import { createService } from "@/background/service.js";
import { store } from "@/core/store.js";
import { setLocale } from "@/i18n";
import { asyncListener } from "@/background/listen.js";

// SEPARATOR -------------------------------------------------------------------

export default defineBackground(() => {
  const registry = createRegistry();

  for (const driver of [mastodon, bluesky, matrix]) registry.register(driver);

  const domBridge = createDomBridge(browser);

  const ctx = {
    http: createHttp({ fetch: (...args) => fetch(...args), browser }),
    parseHtml: domBridge.parse,
    identity: browser.identity,
    online: () => navigator.onLine,
  };

  const registerRules = (catalog) => { for (const rule of catalog?.rules ?? []) registry.register(ruleDriver(rule)); };
  const loadFreshCatalog = (options = {}) => loadCatalog({ fetch: (...args) => fetch(...args), storage: browser.storage.local, now: Date.now(), ...options });

  const ready = (async () => {
    const { settings } = await store.getAll();

    setLocale(settings.lang);

    const { catalog } = await loadFreshCatalog().catch(() => ({ catalog: { rules: [] } }));

    registerRules(catalog);

    // cookie rules left by a worker that was stopped mid-request
    const stale = await browser.declarativeNetRequest.getSessionRules().catch(() => []);

    if (stale.length) await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: stale.map((rule) => rule.id) }).catch(() => {});
  })();

  const service = createService({
    browser,
    registry,
    store,
    ctx,
    now: () => Date.now(),
    sleep: (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
    notifier: createNotifier({ browser, play: domBridge.play }),
    loadCatalog: loadFreshCatalog,
    onCatalog: registerRules,
  });

  browser.runtime.onMessage.addListener(asyncListener(async (message) => {
    await ready;

    if (message?.type === "setSettings" && message.patch?.lang) setLocale(message.patch.lang);

    return service.handle(message);
  }, (message) => message?.target !== "offscreen"));

  // a permission was granted: finish a connect whose popup was closed by the browser prompt
  browser.permissions?.onAdded?.addListener(() => { ready.then(() => service.resumeConnect()); });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    await ready;

    if (alarm.name === "login") return service.loginTick();
    if (alarm.name === "tick") return service.tick();

    return undefined;
  });

  browser.notifications.onClicked.addListener(async (id) => {
    await ready;
    await service.notificationClicked(id);
  });

  // the old one-minute alarm of earlier versions, or a lost one, is replaced by the next real wake
  ready.then(async () => {
    await service.refreshBadge();

    const alarm = await browser.alarms.get("tick");

    if (!alarm || alarm.periodInMinutes) await service.scheduleTick();
  });
});