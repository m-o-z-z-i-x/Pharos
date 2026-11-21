// UTILS
// -----------------------------------------------------------------------------
import { evaluate, fill, labelOf } from "@/rules/engine.js";

// SEPARATOR -------------------------------------------------------------------

// google keeps up to ten signed-in accounts
const LIST_MAX = 10;

/**
 * a declarative rule as a driver that uses the browser's own login
 * @returns {import('./contract.js').Driver}
 */
export function ruleDriver(rule) {
  return {
    id: rule.id,
    name: rule.name,
    mono: rule.mono,
    group: rule.group,
    method: "browser",
    api: false,
    multi: Boolean(rule.multi),
    rule: true,
    version: rule.version,
    types: Object.keys(rule.map),
    defaults: rule.defaults ?? null,
    // where the site adds one more signed-in account, for the window to offer when every one is connected
    addAccountUrl: rule.account?.addUrl ?? null,
    fields: rule.account ? [{ key: rule.account.field, kind: "text", default: rule.account.default ?? "0" }] : [],
    hosts: () => rule.hosts.map((host) => `https://${host}/*`),
    loginUrl: (input) => fill(rule.auth.loginUrl, input?.auth ?? input ?? {}),

    async connect(ctx, input) {
      const auth = rule.account ? { [rule.account.field]: String(input?.[rule.account.field] ?? rule.account.default ?? "0") } : {};
      const { bodies, tokens } = await evaluate(rule, { auth }, ctx);

      return { auth: tokens ? { ...auth, tokens } : auth, label: labelOf(rule, bodies) || rule.name };
    },

    /**
     * the accounts of this site signed in to in the browser, by their number (the n-th mailbox of google)
     * a number past the last one opens the first account again, so the search stops at a name already found
     * an account added to the browser but never opened on the site refuses the request: its page is loaded once, as a tab would.
     * one that still refuses ends the list, since every number after it refuses too when the browser is signed out
     * @return [{ value, label }]; label is null when the site still refuses the account
     * @throws the error of the first account when the site could not be asked at all
     */
    async listAccounts(ctx) {
      if (!rule.multi || !rule.account) return [];

      const found = [];
      const nameOf = async (auth) => labelOf(rule, (await evaluate(rule, { auth }, ctx)).bodies);

      for (let number = 0; number < LIST_MAX; number++) {
        const auth = { [rule.account.field]: String(number) };
        let label;

        try {
          label = await nameOf(auth);
        } catch (thrown) {
          // an empty list would read as "no accounts": a site that did not answer is reported instead
          if (thrown?.kind !== "login" && !found.length) throw thrown;
          if (thrown?.kind !== "login") break;

          await ctx.http.text(fill(rule.openUrl, auth), { withCookies: true }).catch(() => "");
          label = await nameOf(auth).catch(() => null);
        }

        if (label && found.some((item) => item.label === label)) break;

        found.push({ value: String(number), label: label || null });

        if (!label) break;
      }

      return found;
    },

    async check(account, ctx) {
      const { counts, tokens } = await evaluate(rule, account, ctx, { purpose: "check" });

      return tokens ? { counts, auth: { tokens } } : { counts };
    },

    openUrl: (account) => fill(rule.openUrl, account.auth),
  };
}