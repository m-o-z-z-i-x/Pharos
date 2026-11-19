// UTILS
// -----------------------------------------------------------------------------
import { DriverError } from "./contract.js";

// SEPARATOR -------------------------------------------------------------------

const ENTRYWAY = "https://bsky.social";
const CHAT_PROXY = "did:web:api.bsky.chat#bsky_chat";
const REASONS = { like: "react", repost: "react", follow: "follow", reply: "reply", mention: "reply", quote: "reply" };

const pdsOf = (session) => session.didDoc?.service?.find((service) => service.id === "#atproto_pds")?.serviceEndpoint ?? ENTRYWAY;

async function xrpc(http, auth, method, { post = false, body, headers = {} } = {}) {
  const response = await http.request(`${auth.pds}/xrpc/${method}`, {
    method: post ? "POST" : "GET",
    headers: { Authorization: `Bearer ${auth.accessJwt}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    acceptStatus: [400],
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 400) {
    if (data.error === "ExpiredToken" || data.error === "InvalidToken") throw new DriverError("login", "expired");
    throw new DriverError("rule", data.error ?? "http-400");
  }

  return data;
}

async function refresh(http, auth) {
  const response = await http.request(`${auth.pds}/xrpc/com.atproto.server.refreshSession`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.refreshJwt}` },
    acceptStatus: [400],
  });

  if (!response.ok) throw new DriverError("login", "refresh-failed");

  const refreshed = await response.json();

  return { ...auth, accessJwt: refreshed.accessJwt, refreshJwt: refreshed.refreshJwt };
}

async function collect(http, auth) {
  const { notifications = [] } = await xrpc(http, auth, "app.bsky.notification.listNotifications?limit=50");
  const counts = { react: 0, follow: 0, reply: 0, other: 0 };
  let sender;

  for (const notification of notifications) {
    if (notification.isRead) continue;

    const type = REASONS[notification.reason] ?? "other";

    counts[type]++;

    if (type === "reply" && !sender) sender = notification.author?.displayName || notification.author?.handle;
  }

  try {
    const { convos = [] } = await xrpc(http, auth, "chat.bsky.convo.listConvos?limit=100", { headers: { "atproto-proxy": CHAT_PROXY } });

    counts.dm = convos.reduce((total, convo) => total + (convo.unreadCount ?? 0), 0);
  } catch (thrown) {
    if (thrown.kind !== "login") throw thrown; // app password without DM access: leave dm out
  }

  return { counts, sender };
}

/** @type {import('./contract.js').Driver} */
export default {
  id: "bluesky",
  name: "Bluesky",
  mono: "Bs",
  group: "social",
  method: "apppassword",
  api: true,
  multi: true,
  types: ["dm", "reply", "react", "follow", "other"],
  fields: [{ key: "handle", kind: "text", required: true }, { key: "appPassword", kind: "password", required: true }],

  hosts: () => ["https://bsky.social/*", "https://*.bsky.network/*"],

  async connect({ http }, input) {
    const identifier = String(input.handle).trim().replace(/^@/, "");

    const created = await http.json(`${ENTRYWAY}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password: input.appPassword }),
    });

    return {
      auth: { pds: pdsOf(created), did: created.did, handle: created.handle, accessJwt: created.accessJwt, refreshJwt: created.refreshJwt },
      label: `@${created.handle}`,
    };
  },

  async check(account, { http }) {
    try {
      return await collect(http, account.auth);
    } catch (thrown) {
      if (thrown.kind !== "login" || thrown.detail !== "expired") throw thrown;
      const auth = await refresh(http, account.auth);

      try {
        return { ...(await collect(http, auth)), auth };
      } catch (error) {
        error.auth = auth; // refresh tokens rotate: keep the new pair even if this check failed
        throw error;
      }
    }
  },

  openUrl: () => "https://bsky.app/notifications",
};