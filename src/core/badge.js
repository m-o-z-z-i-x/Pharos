// UTILS
// -----------------------------------------------------------------------------
import { TYPES } from "./model.js";

// SEPARATOR -------------------------------------------------------------------

function sum(account, include) {
  // only what arrived since the user last marked the account read
  const fresh = (t) => Math.max(0, (account.counts[t] ?? 0) - (account.seen?.[t] ?? 0));

  return TYPES.reduce((total, t) => (include(account.prefs[t].mode) ? total + fresh(t) : total), 0);
}

/**
 * @returns {{text: string, color: 'amber'|'bad'}}
 */
export function badgeFor(accounts, settings, quiet) {
  if (quiet) return { text: "", color: "amber" };

  const live = accounts.filter((account) => account.enabled);
  const healthy = live.filter((account) => account.state === "ok");
  const important = healthy.reduce((total, account) => total + sum(account, (mode) => mode === "now"), 0);

  if (settings.badgeMode === "dot") {
    if (important) return { text: "•", color: "amber" };
  } else {
    const count = settings.badgeMode === "all" ? healthy.reduce((total, account) => total + sum(account, (mode) => mode !== "off"), 0) : important;

    if (count) return { text: count > 999 ? "999+" : String(count), color: "amber" };
  }

  if (live.some((account) => account.state === "login" || account.state === "broken")) return { text: "!", color: "bad" };

  return { text: "", color: "amber" };
}