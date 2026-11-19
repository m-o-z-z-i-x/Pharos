// UTILS
// -----------------------------------------------------------------------------
import { TYPES } from "@/core/model.js";
import { t } from "@/i18n/vue.js";

// SEPARATOR -------------------------------------------------------------------

const shown = (account, type) => (account.prefs[type].mode !== "off" ? account.counts[type] ?? 0 : 0);
const fresh = (account, type) => Math.max(0, (account.counts[type] ?? 0) - (account.seen?.[type] ?? 0));
/** important and not yet marked read */
const loud = (account) => TYPES.reduce((sum, type) => sum + (account.prefs[type].mode === "now" ? fresh(account, type) : 0), 0);
const total = (account) => TYPES.reduce((sum, type) => sum + shown(account, type), 0);

function rank(account) {
  if (account.state === "login" || account.state === "broken") return 3;
  if (loud(account)) return 0;
  if (total(account)) return 1;

  return 2;
}

/** important first, then quiet news, then nothing new, then problems; stable inside a group */
/**
 * the sorted accounts as rows: accounts of one service stand together as one group, placed where its first account is
 * @return [{ serviceId, accounts }]
 */
export function groupByService(accounts) {
  const groups = new Map();

  for (const account of sortAccounts(accounts)) {
    if (!groups.has(account.serviceId)) groups.set(account.serviceId, { serviceId: account.serviceId, accounts: [] });

    groups.get(account.serviceId).accounts.push(account);
  }

  return [...groups.values()];
}

export function sortAccounts(accounts) {
  return accounts.map((account, index) => [account, index]).sort((first, second) => rank(first[0]) - rank(second[0]) || first[1] - second[1]).map(([account]) => account);
}

/**
 * whether the account follows this type: the service knows it and the mode is not off
 * @param a - account
 * @param type - notification type
 * @param typesOf - (account) => types of its service
 * @return true — the account belongs to the filter
 */
export const supports = (account, type, typesOf) => typesOf(account).includes(type) && account.prefs[type].mode !== "off";

/**
 * popup filter numbers: how many enabled services follow each type
 * @param accounts - enabled accounts
 * @param typesOf - (account) => types of its service
 * @return { all, dm, reply, react }
 */
export function filterCounts(accounts, typesOf) {
  const out = { all: accounts.length, dm: 0, reply: 0, react: 0 };

  for (const account of accounts) {
    for (const type of ["dm", "reply", "react"]) if (supports(account, type, typesOf)) out[type]++;
  }

  return out;
}

export function loudTotal(accounts) {
  return accounts.filter((account) => account.state === "ok" && account.enabled).reduce((sum, account) => sum + loud(account), 0);
}

export function whenText(at, now) {
  const seconds = Math.max(0, (now - at) / 1000);

  if (seconds < 60) return t("when.now");
  if (seconds < 3600) return t("when.min", { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return t("when.hour", { n: Math.floor(seconds / 3600) });

  return t("when.day", { n: Math.floor(seconds / 86400) });
}

export function clock(milliseconds) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const hostOf = (url) => {
  try { return new URL(url).host; } catch { return url; }
};

const two = (number) => String(number).padStart(2, "0");

/** 14:05, independent of the browser locale */
export const hhmm = (at) => {
  const date = new Date(at);

  return `${two(date.getHours())}:${two(date.getMinutes())}`;
};

/** 16.11 14:05 */
export const stamp = (at) => {
  const date = new Date(at);

  return `${two(date.getDate())}.${two(date.getMonth() + 1)} ${hhmm(at)}`;
};

/** one line of the check log: what the check found or why it failed */
export const logText = (entry) => (entry.ok ? (entry.delta ? t("account.logDelta", { n: entry.delta }) : t("account.logOk")) : t(`account.logError.${entry.error ?? "rule"}`));