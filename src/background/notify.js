// UTILS
// -----------------------------------------------------------------------------
import { t } from "@/i18n";

// SEPARATOR -------------------------------------------------------------------

const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * one notification per account per check
 * @returns {{id: string, title: string, message: string, contextMessage: string, sound: boolean}}
 */
export function buildInstant(account, serviceName, events, settings, quiet, sender) {
  const sorted = [...events].sort((first, second) => second.delta - first.delta);
  const top = sorted[0];
  const total = account.counts[top.type] ?? top.delta;
  const title = `${serviceName}: ${t("notify.count", { n: total }, total)} · ${lower(t(`types.long.${top.type}`))}`;
  const lines = [sender && settings.showSender ? t("notify.from", { name: sender }) : t("notify.open", { service: serviceName })];
  const rest = sorted.slice(1).map((event) => `${t(`types.short.${event.type}`)} ${event.delta}`);

  if (rest.length) lines.push(t("notify.more", { list: rest.join(", ") }));

  return {
    id: `acc:${account.id}`,
    title,
    message: lines.join("\n"),
    contextMessage: account.label,
    sound: !quiet && events.some((event) => event.sound),
  };
}

export function buildProblem(account, serviceName) {
  const kind = account.state === "login" ? "login" : account.error?.kind === "network" ? "network" : "broken";

  return {
    id: `problem:${account.id}`,
    title: t("problem.title", { service: serviceName }),
    message: t(`problem.${kind}`),
    contextMessage: account.label,
    sound: false,
  };
}

/**
 * how a connect that finished without the popup went: the person is told in a notification
 * its id says where a click leads: the new account, its sign-in page, or the connect panel of the service again
 */
export function buildConnectResult(name, result, serviceId) {
  const ok = result.status === "ok";
  const login = result.status === "login-required";
  const detail = login ? t("connect.notify.login") : `${t(`connect.errors.${result.error ?? "rule"}`)}\n${t("connect.notify.retry")}`;
  const id = ok && result.accountId ? `account:${result.accountId}` : login && result.accountId ? `login:${result.accountId}` : `connect:${serviceId}`;

  return {
    id,
    title: ok ? t("connect.notify.done", { name }) : login ? t("connect.notify.loginTitle", { name }) : t("connect.notify.failed", { name }),
    message: ok ? t("connect.notify.doneSub") : detail,
    contextMessage: "",
    sound: false,
  };
}

export function buildDigest(summary) {
  return {
    id: `digest:${Date.now()}`,
    title: t("digest.notifyTitle", { title: summary.title }),
    message: summary.lines.join("\n"),
    contextMessage: "",
    sound: false,
  };
}

/**
 * thin wrapper over browser.notifications
 * @param {{browser: any, play: (name: string) => Promise<void>}} deps
 */
export function createNotifier({ browser, play }) {
  const icon = browser.runtime.getURL("/icon/128.png");

  async function show(notice, soundName = "soft") {
    await browser.notifications.create(notice.id, {
      type: "basic",
      iconUrl: icon,
      title: notice.title,
      message: notice.message,
      contextMessage: notice.contextMessage || undefined,
      silent: true,
    });

    if (notice.sound) await play(soundName).catch(() => {});
  }

  return { show };
}

/** @param {{text: string, color: 'amber'|'bad'}} badge */
export async function setBadge(browser, badge) {
  // firefox for android keeps extensions in its menu, without a badge
  if (!browser.action?.setBadgeText) return;

  await browser.action.setBadgeText({ text: badge.text });
  if (browser.action.setBadgeBackgroundColor) await browser.action.setBadgeBackgroundColor({ color: badge.color === "bad" ? "#D66C6C" : "#C69B69" });
  if (browser.action.setBadgeTextColor) await browser.action.setBadgeTextColor({ color: "#242424" });
}