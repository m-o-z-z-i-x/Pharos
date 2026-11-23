// UTILS
// -----------------------------------------------------------------------------
import { DriverError } from "@/drivers/contract.js";

// SEPARATOR -------------------------------------------------------------------

let ruleSeq = 1000;

/**
 * requests to services on behalf of the user
 * withCookies: the browser's own login is used. If the browser does not attach the cookies to
 * an extension request (SameSite, partitioning), the request is retried with the cookies read
 * through the cookies permission and set by a one-off session rule. Such hosts are remembered
 * @param {{fetch: typeof fetch, browser: any}} deps
 */
export function createHttp({ fetch, browser, timeoutMs = 10_000 }) {
  const injectHosts = new Set();
  const session = browser.storage?.session;

  const loaded = (async () => {
    try {
      const stored = await session?.get("injectHosts");

      for (const host of stored?.injectHosts ?? []) injectHosts.add(host);
    } catch {
      // no session storage: start empty
    }
  })();

  const remember = async (host) => {
    injectHosts.add(host);
    try { await session?.set({ injectHosts: [...injectHosts] }); } catch { /* best effort */ }
  };

  async function cookieHeader(url) {
    const list = await browser.cookies.getAll({ url });

    return list.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  }

  // headers a page can not set itself (cookie, origin) are set by a one-off session rule for this url only
  async function withInjected(url, init, wanted) {
    // firefox refuses a header rule with an empty value: no cookies of the site means the request goes as it is
    const set = wanted.filter(([, value]) => value);

    if (!set.length) return send(url, init);

    const id = ++ruleSeq;
    const netRequest = browser.declarativeNetRequest;
    // the host of the extension's own pages: its id in chrome, a random uuid in firefox, where the id is no domain at all
    const extensionId = browser.runtime?.getURL ? new URL(browser.runtime.getURL("/")).host : null;

    await netRequest.updateSessionRules({
      removeRuleIds: [id], // a rule left over from a stopped worker must not block this one

      addRules: [{
        id,
        priority: 1,
        action: { type: "modifyHeaders", requestHeaders: set.map(([header, value]) => ({ header, operation: "set", value })) },
        condition: { urlFilter: `|${url}`, tabIds: [-1], resourceTypes: ["xmlhttprequest", "other"], ...(extensionId ? { initiatorDomains: [extensionId] } : {}) },
      }],
    });

    try {
      return await send(url, init);
    } finally {
      await netRequest.updateSessionRules({ removeRuleIds: [id] });
    }
  }

  async function send(url, init) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new DriverError("network", String(error?.message ?? error));
    }
  }

  async function request(url, options = {}) {
    const init = {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      credentials: options.withCookies ? "include" : "omit",
      redirect: options.redirect ?? "follow",
      cache: "no-store",
    };

    const host = new URL(url).host;
    const extra = options.origin ? [["origin", options.origin], ["referer", `${options.origin}/`]] : [];

    await loaded;
    let response;

    if (options.withCookies && (options.inject || injectHosts.has(host))) {
      response = await withInjected(url, init, [["cookie", await cookieHeader(url)], ...extra]);
    } else {
      response = extra.length ? await withInjected(url, init, extra) : await send(url, init);

      if (options.withCookies && (response.status === 401 || response.status === 403)) {
        const header = await cookieHeader(url);

        if (header) {
          const retry = await withInjected(url, init, [["cookie", header], ...extra]);

          if (retry.ok) await remember(host);

          response = retry;
        }
      }
    }

    // a site that sends a signed-out visitor to its login page answers 200 with that page
    if (options.loggedOutPath && response.redirected && new URL(response.url).pathname.startsWith(options.loggedOutPath)) throw new DriverError("login", "login-redirect");
    if (options.acceptStatus?.includes(response.status)) return response;
    if (response.status === 401 || response.status === 403) throw new DriverError("login", `http-${response.status}`);
    if (response.status === 429 || response.status >= 500) throw new DriverError("network", `http-${response.status}`);
    if (!response.ok) throw new DriverError("rule", `http-${response.status}`);

    return response;
  }

  return {
    request,

    /** value of one cookie of the site, for headers that repeat it (csrf tokens) */
    async cookie(url, name) {
      return (await browser.cookies.get({ url, name }).catch(() => null))?.value ?? null;
    },

    async text(url, options) {
      return (await request(url, options)).text();
    },

    async json(url, options) {
      const body = await (await request(url, options)).text();

      try {
        return JSON.parse(body);
      } catch {
        throw new DriverError("rule", "bad-json");
      }
    },
  };
}