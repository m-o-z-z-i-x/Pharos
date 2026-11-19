/** @typedef {'dm'|'reply'|'react'|'follow'|'other'} NoticeType */
/** @typedef {'now'|'digest'|'off'} Mode */
/** @typedef {Record<NoticeType, number>} Counts */
/**
 * @typedef {Object} Account
 * @property {string} id
 * @property {string} serviceId
 * @property {string} label
 * @property {boolean} enabled
 * @property {number} interval  minutes
 * @property {Record<NoticeType, {mode: Mode, sound: boolean}>} prefs
 * @property {Object} auth       secrets, never leave the browser profile
 * @property {Object} extras     service-specific switches
 * @property {'pending'|'ok'|'login'|'broken'} state
 * @property {number} failStreak
 * @property {boolean} baselined  a successful check has set the baseline
 * @property {Partial<Counts>} counts
 * @property {Partial<Counts>} seen
 * @property {number|null} lastCheckAt
 * @property {number} nextCheckAt
 * @property {{kind: string, detail?: string}|null} error
 * @property {{at: number, ok: boolean, note: string}[]} log
 */

export const TYPES = /** @type {const} */ (["dm", "reply", "react", "follow", "other"]);
// accounts of one service: enough for work and personal, small enough to keep checks rare
export const MAX_ACCOUNTS = 3;
export const INTERVALS = [1, 5, 10, 15, 30];

const LOG_MAX = 50;
const LOG_TTL = 7 * 864e5;

function defaultPrefs() {
  return {
    dm: { mode: "now", sound: true },
    reply: { mode: "now", sound: true },
    react: { mode: "digest", sound: false },
    follow: { mode: "digest", sound: false },
    other: { mode: "off", sound: false },
  };
}

/**
 * @param {{serviceId: string, label: string, auth: Object, interval?: number, extras?: Object}} init
 * @returns {Account}
 */
export function createAccount({ serviceId, label, auth, interval = 5, extras = {}, defaults = null }) {
  return {
    id: `${serviceId}-${crypto.randomUUID().slice(0, 8)}`,
    serviceId,
    label,
    enabled: true,
    interval,
    // a service may say which of its types matter by default (one general counter is "other" but important)
    prefs: { ...defaultPrefs(), ...(defaults ?? {}) },
    auth,
    extras,
    state: "pending",
    failStreak: 0,
    baselined: false,
    counts: {},
    seen: {},
    lastCheckAt: null,
    nextCheckAt: 0,
    error: null,
    log: [],
  };
}

export function defaultSettings() {
  return {
    theme: "dark",
    lang: "en",
    badgeMode: "important",
    quietManual: false,
    quietSkipUntil: 0,
    quietHours: { on: true, from: "23:00", to: "08:00" },
    digestEvery: 60,
    lastDigestAt: 0,
    sound: { name: "soft", perType: true },
    showSender: true,
    notifyProblems: true,
    defaultInterval: 5,
  };
}

/** newest first, at most 50 entries, none older than 7 days */
export function trimLog(log, now) {
  return [...log]
    .filter((entry) => now - entry.at <= LOG_TTL)
    .sort((first, second) => second.at - first.at)
    .slice(0, LOG_MAX);
}