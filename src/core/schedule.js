const JITTER_MS = 20_000;
// accounts due within this time are checked together, so the worker wakes once for them
const GROUP_MS = 60_000;
const WAKE_MIN_MS = 30_000;
const WAKE_MAX_MS = 60 * 60_000;

export function dueAccounts(accounts, now) {
  return accounts.filter((account) => account.enabled && (account.nextCheckAt ?? 0) <= now + GROUP_MS);
}

/**
 * when the worker has something to do next: a check, a digest or a quiet-mode edge
 * the worker sleeps in between, so nothing wakes it every minute for nothing
 * @param quietChange - ms of the next quiet-mode edge or null
 * @return ms for the alarm
 */
export function nextWake({ accounts, settings, digest, now, quietChange }) {
  const moments = accounts.filter((account) => account.enabled).map((account) => account.nextCheckAt ?? 0);

  if (digest.length) moments.push((settings.lastDigestAt ?? 0) + settings.digestEvery * 60_000);
  if (quietChange) moments.push(quietChange);

  const soonest = moments.length ? Math.min(...moments) : now + WAKE_MAX_MS;

  return Math.min(Math.max(soonest, now + WAKE_MIN_MS), now + WAKE_MAX_MS);
}

export function planNext(account, now, random = Math.random) {
  return now + account.interval * 60_000 + Math.floor(random() * JITTER_MS);
}

const PROBLEM = { login: "login", rule: "broken", network: "broken" };

/**
 * a login or rule error is a problem at once; a network error only on the second in a row
 * problemNotice is true only on the transition from a healthy state into a problem
 */
export function applyError(account, failure, now) {
  const kind = PROBLEM[failure.kind] ? failure.kind : "rule";
  const failStreak = account.failStreak + 1;
  const wasHealthy = account.state === "ok" || account.state === "pending";
  const becomes = kind === "network" && failStreak < 2 ? account.state : PROBLEM[kind];
  const next = { ...account, failStreak, lastCheckAt: now, state: becomes, error: { kind, detail: failure.detail ?? "" } };
  const isProblem = becomes === "login" || becomes === "broken";

  return { account: next, problemNotice: wasHealthy && isProblem };
}