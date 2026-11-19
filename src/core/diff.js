// UTILS
// -----------------------------------------------------------------------------
import { TYPES } from "./model.js";

// SEPARATOR -------------------------------------------------------------------

/**
 * merge a fresh check result into the account
 * the first successful check ever (baselined is false) is a baseline: no events, seen = counts,
 * whatever state the account was in before (pending, login, broken)
 * events are emitted only for growth of types whose mode is not "off"
 * @param {import('./model.js').Account} account
 * @param {Partial<import('./model.js').Counts>} counts
 * @param {number} now
 */
export function applyCounts(account, counts, now) {
  const first = !account.baselined;

  const next = {
    ...account,
    counts: { ...account.counts },
    seen: { ...account.seen },
    state: "ok",
    failStreak: 0,
    error: null,
    lastCheckAt: now,
    baselined: true,
  };

  const events = [];

  for (const type of TYPES) {
    if (!(type in counts)) continue; // a type missing from this result keeps its last value

    const value = Math.max(0, Number(counts[type]) || 0);
    const before = account.counts[type] ?? 0;

    next.counts[type] = value;

    // a type the service starts reporting later (after a rule update) is a baseline too, like the first check
    if (first || !(type in account.counts)) {
      next.seen[type] = value;
      continue;
    }

    if (value < before) next.seen[type] = value; // read in the service: what is left counts as seen

    const preference = account.prefs[type];

    if (value > before && preference.mode !== "off") {
      events.push({ type, delta: value - before, mode: preference.mode, sound: preference.sound });
    }
  }

  return { account: next, events };
}

/** something important arrived since the user last opened the service */
export function isNew(account) {
  if (account.state !== "ok") return false;

  return TYPES.some((t) => account.prefs[t].mode === "now" && (account.counts[t] ?? 0) > (account.seen[t] ?? 0));
}

export function markSeen(account) {
  return { ...account, seen: { ...account.counts } };
}

export function routeEvents(events, { quiet }) {
  if (quiet) return { instant: [], toDigest: events.filter((event) => event.mode !== "off") };

  return {
    instant: events.filter((event) => event.mode === "now"),
    toDigest: events.filter((event) => event.mode === "digest"),
  };
}