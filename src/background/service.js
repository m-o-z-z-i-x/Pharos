// UTILS
// -----------------------------------------------------------------------------
import { createAccount, TYPES, MAX_ACCOUNTS } from "@/core/model.js";
import { markSeen, isNew } from "@/core/diff.js";
import { badgeFor } from "@/core/badge.js";
import { isQuiet, nextQuietChange } from "@/core/quiet.js";
import { nextWake } from "@/core/schedule.js";
import { summarizeDigest } from "@/core/digest.js";
import { EXPORT_FORMAT } from "@/core/store.js";
import { runDue } from "./runner.js";
import { buildInstant, buildProblem, buildDigest, buildConnectResult, setBadge } from "./notify.js";
import { DriverError } from "@/drivers/contract.js";

// SEPARATOR -------------------------------------------------------------------

const LOGIN_TIMEOUT_MS = 10 * 60_000;

const publicAccount = ({ auth, ...rest }) => ({ ...rest, isNew: isNew(rest) });

const serviceMeta = (driver) => ({
  id: driver.id, name: driver.name, mono: driver.mono, group: driver.group, method: driver.method,
  api: driver.api, multi: driver.multi, types: driver.types, fields: driver.fields, rule: Boolean(driver.rule),
  hostsPreview: driver.rule ? driver.hosts({}) : null, version: driver.version ?? null, addAccountUrl: driver.addAccountUrl ?? null,
});

/**
 * everything the background does, without browser wiring, so it can be tested
 * @param {Object} deps
 */
export function createService({ browser, registry, store, ctx, now, sleep, notifier, loadCatalog, onCatalog }) {
  let catalogInfo = null;
  let busy = Promise.resolve();

  /** serialize state-changing work so two checks never interleave */
  const exclusive = (task) => {
    const run = busy.then(task, task);

    busy = run.catch(() => {});

    return run;
  };

  const nameOf = (account) => registry.get(account.serviceId)?.name ?? account.serviceId;
  const hostsOf = (account) => registry.get(account.serviceId)?.hosts({ ...account.auth, auth: account.auth }) ?? [];

  async function refreshBadge() {
    const { accounts, settings } = await store.getAll();

    await setBadge(browser, badgeFor(accounts, settings, isQuiet(settings, new Date(now()))));
  }

  /** one alarm for the next thing to do; creating it again replaces the old one */
  async function scheduleTick() {
    const { accounts, settings, digest } = await store.getAll();
    const date = new Date(now());
    const when = nextWake({ accounts, settings, digest, now: now(), quietChange: nextQuietChange(settings, date) });

    await browser.alarms?.create?.("tick", { when });
  }

  async function check(only) {
    const { accounts, settings } = await store.getAll();
    const quiet = isQuiet(settings, new Date(now()));
    const result = await runDue({ now: now(), accounts, getDriver: (id) => registry.get(id), ctx, quiet, sleep, only });

    await store.putAccounts(result.accounts);
    await store.pushDigest(result.toDigest);

    for (const { account, events, sender } of result.instant) {
      await notifier.show(buildInstant(account, nameOf(account), events, settings, quiet, sender), settings.sound.name);
    }

    if (settings.notifyProblems) for (const account of result.problems) await notifier.show(buildProblem(account, nameOf(account)));
    await refreshBadge();

    return result;
  }

  async function flushDigest({ force = false } = {}) {
    const { accounts, settings } = await store.getAll();

    if (!force && isQuiet(settings, new Date(now()))) return { ok: true, sent: false };
    if (!force && now() - (settings.lastDigestAt ?? 0) < settings.digestEvery * 60_000) return { ok: true, sent: false };

    await store.putSettings({ lastDigestAt: now() });

    const items = await store.takeDigest();

    const summary = summarizeDigest(items, (id) => {
      const account = accounts.find((candidate) => candidate.id === id);

      return account ? nameOf(account) : "?";
    });

    if (summary) await notifier.show(buildDigest(summary));

    return { ok: true, sent: Boolean(summary) };
  }

  // the same signed-in identity must not be added twice; a generic label (the service name) says nothing about who it is
  const sameIdentity = (account, serviceId, label, driver) =>
    account.serviceId === serviceId && Boolean(label) && label !== driver.name && account.label?.toLowerCase() === label.toLowerCase();

  // the browser closes the popup while it shows the permission prompt, so the popup leaves what it wanted to
  // connect here first; once the permission is granted this finishes the job and says how it went
  const PENDING_TTL = 10 * 60_000;
  const memory = browser.storage?.session ?? browser.storage.local;
  const pendingKey = "pendingConnect";

  // pick: the person still has to choose which account of the browser to connect
  async function queueConnect({ serviceId, input, pick = false }) {
    await memory.set({ [pendingKey]: { serviceId, input: input ?? {}, pick, at: now() } });

    return { ok: true };
  }

  async function takePending() {
    const { [pendingKey]: pending } = await memory.get(pendingKey);

    await memory.remove(pendingKey);

    return pending && now() - pending.at < PENDING_TTL ? pending : null;
  }

  // the permission was granted: if the popup is still alive it takes the pending connect itself within a moment
  async function resumeConnect({ wait = 1500 } = {}) {
    await sleep(wait);

    const pending = await takePending();

    if (!pending) return { ok: true, resumed: false };

    const driver = registry.get(pending.serviceId);

    if (!driver) return { ok: false };

    // the choice of an account needs a page: the settings open on the connect panel of this service
    if (pending.pick) {
      await browser.tabs.create({ url: browser.runtime.getURL(`options.html#connect=${encodeURIComponent(pending.serviceId)}`) });

      return { ok: true, resumed: true, status: "pick" };
    }

    const result = await exclusive(() => connect({ serviceId: pending.serviceId, input: pending.input, fromQueue: true }));

    await notifier.show(buildConnectResult(driver.name, result, pending.serviceId), settingsSound());

    return { ok: true, resumed: true, status: result.status };
  }

  const settingsSound = () => "soft";

  async function connect({ serviceId, input, fromQueue = false }) {
    // the popup is alive and connects by itself: the queued copy must not run a second time
    if (!fromQueue) await memory.remove(pendingKey);

    const driver = registry.get(serviceId);

    if (!driver) return { status: "error", error: "unknown-service" };

    const { settings } = await store.getAll();

    try {
      const { auth, label } = await driver.connect(ctx, input ?? {});
      const { accounts } = await store.getAll();
      // a service with one account per browser can not get a second one, even when its name is unknown
      const taken = driver.multi ? accounts.some((candidate) => sameIdentity(candidate, serviceId, label, driver)) : accounts.some((candidate) => candidate.serviceId === serviceId);

      if (taken) return { status: "error", error: "duplicate", detail: label };
      if (accounts.filter((candidate) => candidate.serviceId === serviceId).length >= MAX_ACCOUNTS) return { status: "error", error: "limit" };

      const account = createAccount({ serviceId, label, auth, interval: settings.defaultInterval, defaults: driver.defaults });

      await store.putAccount(account);
      await check([account.id]);

      return { status: "ok", accountId: account.id };
    } catch (thrown) {
      const failure = thrown instanceof DriverError ? thrown : new DriverError("rule", String(thrown?.message ?? thrown));

      if (failure.kind !== "login" || !driver.loginUrl) return { status: "error", error: failure.kind, detail: failure.detail };

      const field = driver.fields?.[0];
      const auth = field ? { [field.key]: String(input?.[field.key] ?? field.default ?? "") } : {};
      const account = { ...createAccount({ serviceId, label: driver.name, auth, interval: settings.defaultInterval, defaults: driver.defaults }), state: "login", error: { kind: "login" } };

      await store.putAccount(account);
      await refreshBadge();

      return { status: "login-required", accountId: account.id };
    }
  }

  /** open the sign-in page once and remember it; loginTick finishes the job, so it survives the worker sleeping */
  async function awaitLogin({ accountId }) {
    const { accounts } = await store.getAll();
    const account = accounts.find((candidate) => candidate.id === accountId);
    const driver = account && registry.get(account.serviceId);

    if (!driver?.loginUrl) return { status: "error", error: "no-login-url" };
    if (account.awaitingLogin && account.awaitingLogin.until > now()) return { status: "waiting" };

    const tab = await browser.tabs.create({ url: driver.loginUrl({ ...account.auth, auth: account.auth }), active: true });

    await store.putAccount({ ...account, awaitingLogin: { tabId: tab?.id ?? null, until: now() + LOGIN_TIMEOUT_MS } });
    await browser.alarms?.create?.("login", { periodInMinutes: 0.5 });

    return { status: "waiting" };
  }

  async function loginTick() {
    const { accounts } = await store.getAll();
    const waiting = accounts.filter((account) => account.awaitingLogin);

    for (const account of waiting) {
      const driver = registry.get(account.serviceId);

      if (!driver || now() > account.awaitingLogin.until) {
        await store.putAccount({ ...account, awaitingLogin: null });
        continue;
      }

      try {
        const { auth, label } = await driver.connect(ctx, account.auth);

        // signed in as someone already connected: the placeholder goes away, the window reports the duplicate
        if (accounts.some((other) => other.id !== account.id && sameIdentity(other, account.serviceId, label, driver))) {
          await store.removeAccount(account.id);

          if (account.awaitingLogin.tabId != null) await browser.tabs.remove(account.awaitingLogin.tabId).catch(() => {});

          continue;
        }

        await store.putAccount({ ...account, auth, label, state: "pending", error: null, awaitingLogin: null, nextCheckAt: 0 });
        await check([account.id]);

        if (account.awaitingLogin.tabId != null) await browser.tabs.remove(account.awaitingLogin.tabId).catch(() => {});
      } catch (thrown) {
        if (thrown?.kind === "login") continue;
        await store.putAccount({ ...account, awaitingLogin: null, error: { kind: thrown?.kind ?? "rule", detail: thrown?.detail ?? "" } });
      }
    }

    if (!waiting.length || !(await store.getAll()).accounts.some((account) => account.awaitingLogin)) await browser.alarms?.clear?.("login");
  }

  async function notificationClicked(id) {
    const [kind, accountId] = String(id).split(":");

    await browser.notifications?.clear?.(id);

    const { accounts } = await store.getAll();
    const account = accounts.find((candidate) => candidate.id === accountId);
    const options = (hash) => browser.tabs.create({ url: browser.runtime.getURL(`options.html#${hash}`) });

    if (kind === "login" && account) {
      // the sign-in page opens at once and loginTick finishes the connect, as the button of the panel does
      const result = await awaitLogin({ accountId: account.id });

      if (result.status !== "waiting") await options(`login=${encodeURIComponent(account.id)}`);
    } else if (kind === "account" && account) {
      await options(`account=${encodeURIComponent(account.id)}`);
    } else if (kind === "connect" && registry.get(accountId)) {
      await options(`connect=${encodeURIComponent(accountId)}`);
    } else if (kind === "acc" && account) {
      const driver = registry.get(account.serviceId);

      if (driver) await browser.tabs.create({ url: driver.openUrl(account) });

      await store.putAccount(markSeen(account));
      await refreshBadge();
    } else if (kind === "problem" && account) {
      // a lost sign-in goes straight to signing in again, any other trouble to the settings of this account
      const hash = account.state === "login" ? "login" : "account";

      await options(`${hash}=${encodeURIComponent(account.id)}`);
    } else {
      await browser.runtime.openOptionsPage();
    }
  }

  async function removeAccount({ id }) {
    const { accounts } = await store.getAll();
    const gone = accounts.find((account) => account.id === id);

    if (!gone) return { ok: true };

    await store.removeAccount(id);

    const stillUsed = new Set(accounts.filter((account) => account.id !== id).flatMap(hostsOf));
    const free = hostsOf(gone).filter((host) => !stillUsed.has(host));

    if (free.length) await browser.permissions.remove({ origins: free }).catch(() => false);

    await refreshBadge();

    return { ok: true };
  }

  async function setAccount({ id, patch }) {
    const { accounts } = await store.getAll();
    const account = accounts.find((candidate) => candidate.id === id);

    if (!account) return { ok: false, error: "not-found" };

    const allowed = {};

    for (const key of ["interval", "enabled", "label", "extras"]) if (key in patch) allowed[key] = patch[key];

    const prefs = { ...account.prefs };

    for (const t of TYPES) if (patch.prefs?.[t]) prefs[t] = { ...prefs[t], ...patch.prefs[t] };

    await store.putAccount({ ...account, ...allowed, prefs });
    await refreshBadge();

    return { ok: true };
  }

  async function importSettings({ json }) {
    let data;

    try { data = JSON.parse(json); } catch { return { ok: false, error: "parse" }; }

    if (data?.format !== EXPORT_FORMAT) return { ok: false, error: "format" };

    await store.putSettings(data.settings ?? {});

    const { accounts } = await store.getAll();
    const missing = [];

    for (const imported of data.accounts ?? []) {
      const own = accounts.find((account) => account.serviceId === imported.serviceId && account.label === imported.label);

      if (own) await store.putAccount({ ...own, prefs: imported.prefs ?? own.prefs, interval: imported.interval ?? own.interval, extras: imported.extras ?? own.extras });
      else missing.push({ serviceId: imported.serviceId, label: imported.label });
    }

    return { ok: true, missing };
  }

  async function getState() {
    const { accounts, settings, digest } = await store.getAll();

    catalogInfo ??= await loadCatalog().catch(() => null);
    const next = accounts.filter((account) => account.enabled).map((account) => account.nextCheckAt).sort((first, second) => first - second)[0] ?? null;

    return {
      accounts: accounts.map((account) => {
        let openUrl = null;

        try { openUrl = registry.get(account.serviceId)?.openUrl(account) ?? null; } catch { openUrl = null; }

        return { ...publicAccount(account), openUrl };
      }),

      settings,
      digestCount: digest.reduce((total, item) => total + item.delta, 0),
      nextRunAt: next,
      quiet: isQuiet(settings, new Date(now())),
      services: registry.list().map(serviceMeta),
      catalog: catalogInfo && { version: catalogInfo.catalog.version, source: catalogInfo.source, checkedAt: catalogInfo.checkedAt, verified: catalogInfo.verified },
    };
  }

  const handlers = {
    getState,

    // "Check now" means now: every enabled account, not only those whose time has come
    checkNow: (message) => exclusive(async () => {
      const accountIds = message.accountId ? [message.accountId] : (await store.getAll()).accounts.filter((account) => account.enabled).map((account) => account.id);

      if (accountIds.length) await check(accountIds);

      return { ok: true };
    }),

    // the accounts the browser is signed in to, so the window offers a choice instead of asking for a number
    listAccounts: async ({ serviceId }) => {
      const driver = registry.get(serviceId);
      const field = driver?.fields?.[0]?.key;

      if (!driver?.listAccounts || !field) return { ok: true, accounts: [] };

      const { accounts } = await store.getAll();
      const used = new Set(accounts.filter((account) => account.serviceId === serviceId).map((account) => String(account.auth?.[field])));

      try {
        const found = await driver.listAccounts(ctx);

        return { ok: true, accounts: found.map((item) => ({ ...item, connected: used.has(item.value) })) };
      } catch (thrown) {
        return { ok: false, accounts: [], error: thrown?.kind ?? "network" };
      }
    },

    queueConnect: (message) => queueConnect(message),
    // the window survived the permission prompt and goes on by itself
    dropQueued: async () => {
      await memory.remove(pendingKey);

      return { ok: true };
    },
    resumeConnect: (message) => resumeConnect(message),
    connect: (message) => exclusive(() => connect(message)),
    awaitLogin: (message) => exclusive(() => awaitLogin(message)),

    markSeen: (message) => exclusive(async () => {
      const { accounts } = await store.getAll();
      const account = accounts.find((candidate) => candidate.id === message.accountId);

      if (account) await store.putAccount(markSeen(account));
      await refreshBadge();

      return { ok: true };
    }),

    setSettings: (message) => exclusive(async () => { const saved = await store.putSettings(message.patch); await refreshBadge(); return { ok: true, settings: saved }; }),
    setAccount: (message) => exclusive(() => setAccount(message)),
    removeAccount: (message) => exclusive(() => removeAccount(message)),
    flushDigest: () => exclusive(() => flushDigest({ force: true })),
    exportSettings: async () => ({ ok: true, json: await store.exportSettings() }),
    importSettings: (message) => exclusive(() => importSettings(message)),

    // the rules as downloaded, for the read-only view in the settings
    getRules: async () => {
      catalogInfo ??= await loadCatalog().catch(() => null);

      return { ok: true, rules: catalogInfo?.catalog.rules ?? [] };
    },

    reloadCatalog: async () => {
      try {
        catalogInfo = await loadCatalog({ force: true });

        onCatalog?.(catalogInfo.catalog);

        return { ok: true };
      } catch {
        return { ok: false, error: "catalog" };
      }
    },

    wipe: () => exclusive(async () => {
      const { accounts } = await store.getAll();
      const origins = [...new Set(accounts.flatMap(hostsOf))];

      if (origins.length) await browser.permissions.remove({ origins }).catch(() => false);

      await store.wipe();
      await refreshBadge();

      return { ok: true };
    }),
  };

  // reading never moves the next wake
  const READ_ONLY = new Set(["getState", "getRules", "exportSettings", "queueConnect", "dropQueued", "listAccounts"]);

  return {
    resumeConnect,

    async handle(message) {
      const handler = handlers[message?.type];

      if (!handler) return { ok: false, error: "unknown-message" };

      const answer = await handler(message);

      if (!READ_ONLY.has(message.type)) await exclusive(scheduleTick);

      return answer;
    },

    /** everything that is due, then the alarm for the next time */
    tick: () => exclusive(async () => {
      await loginTick();
      await check();
      await flushDigest();
      await scheduleTick();
    }),

    loginTick: () => exclusive(() => loginTick()),
    scheduleTick: () => exclusive(scheduleTick),
    notificationClicked: (id) => exclusive(() => notificationClicked(id)),
    refreshBadge,
  };
}