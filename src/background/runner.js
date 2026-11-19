// UTILS
// -----------------------------------------------------------------------------
import { applyCounts, routeEvents } from "@/core/diff.js";
import { dueAccounts, planNext, applyError } from "@/core/schedule.js";
import { trimLog } from "@/core/model.js";
import { DriverError } from "@/drivers/contract.js";

// SEPARATOR -------------------------------------------------------------------

// services are checked side by side, but one service never gets two requests at once: its accounts go in a row
const CONCURRENCY = 5;

const pause = (random) => 300 + Math.floor(random() * 500);

/**
 * check due accounts: different services in parallel, accounts of one service one by one. Returns what changed;
 * the caller persists and notifies. The order of the result follows the order of the queue
 * @param {Object} o
 * @param {number} o.now
 * @param {Object[]} o.accounts
 * @param {(serviceId: string) => {check: Function}|undefined} o.getDriver
 * @param {Object} o.ctx
 * @param {boolean} o.quiet
 * @param {(ms: number) => Promise<void>} o.sleep
 * @param {() => number} [o.rand]
 * @param {string[]} [o.only] - check these ids now, ignoring the schedule
 */
export async function runDue({ now, accounts, getDriver, ctx, quiet, sleep, rand: random = Math.random, only }) {
  const queue = only ? accounts.filter((account) => only.includes(account.id)) : dueAccounts(accounts, now);

  // one account: never throws, the outcome is data
  async function checkOne(start) {
    let account = start;
    const outcome = { instant: null, toDigest: [], problem: false, failed: false };

    try {
      const driver = getDriver(account.serviceId);

      if (!driver) throw new DriverError("rule", "unknown-service");

      const result = await driver.check(account, ctx);

      if (result.auth) account = { ...account, auth: { ...account.auth, ...result.auth } };

      const applied = applyCounts(account, result.counts ?? {}, now);
      const { instant, toDigest } = routeEvents(applied.events, { quiet });
      const delta = applied.events.reduce((total, event) => total + event.delta, 0);

      account = { ...applied.account, log: trimLog([{ at: now, ok: true, delta }, ...account.log], now) };

      if (instant.length) outcome.instant = { account, events: instant, sender: result.sender };
      for (const event of toDigest) outcome.toDigest.push({ accountId: account.id, type: event.type, delta: event.delta });
    } catch (thrown) {
      const failure = thrown instanceof DriverError ? thrown : new DriverError("rule", String(thrown?.message ?? thrown));

      if (thrown?.auth) account = { ...account, auth: { ...account.auth, ...thrown.auth } };

      if (failure.kind === "network") {
        outcome.failed = true;
        account = { ...account, pendingError: failure };
      } else {
        const handled = applyError(account, failure, now);

        account = { ...handled.account, log: trimLog([{ at: now, ok: false, error: failure.kind }, ...account.log], now) };
        outcome.problem = handled.problemNotice;
      }
    }

    outcome.account = { ...account, nextCheckAt: planNext(account, now, random) };

    return outcome;
  }

  // groups by service, each group is a chain; a few chains run at the same time
  const groups = new Map();

  queue.forEach((account, index) => groups.set(account.serviceId, [...(groups.get(account.serviceId) ?? []), index]));

  const pending = [...groups.values()];
  const results = new Array(queue.length);

  const lane = async () => {
    while (pending.length) {
      const chain = pending.shift();

      for (let position = 0; position < chain.length; position++) {
        if (position > 0) await sleep(pause(random));
        results[chain[position]] = await checkOne(queue[chain[position]]);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, lane));

  const out = { accounts: [], instant: [], toDigest: [], problems: [] };
  const failed = [];

  results.forEach((outcome, index) => {
    out.accounts.push(outcome.account);

    if (outcome.instant) out.instant.push(outcome.instant);

    out.toDigest.push(...outcome.toDigest);

    if (outcome.problem) out.problems.push(outcome.account);
    if (outcome.failed) failed.push(index);
  });

  // network failures are judged after the run: with no connection a service is not broken
  const offline = ctx?.online?.() === false || (queue.length >= 2 && failed.length === queue.length);

  for (const index of failed) {
    const { pendingError: error, ...account } = out.accounts[index];
    const logged = { ...account, log: trimLog([{ at: now, ok: false, error: "network" }, ...account.log], now) };

    if (offline) { out.accounts[index] = logged; continue; }

    const applied = applyError(logged, error, now);

    out.accounts[index] = applied.account;

    if (applied.problemNotice) out.problems.push(applied.account);
  }

  return out;
}