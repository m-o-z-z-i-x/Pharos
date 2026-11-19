// UTILS
// -----------------------------------------------------------------------------
import { DriverError } from "./contract.js";
import { normalizeHost, origin, queryString } from "./util.js";

// SEPARATOR -------------------------------------------------------------------

const GROUPS = {
  reply: ["mention"],
  react: ["favourite", "reblog"],
  follow: ["follow"],
  other: ["poll", "update", "status"],
};

const SCOPES = "read:notifications read:statuses read:accounts";

/** @type {import('./contract.js').Driver} */
export default {
  id: "mastodon",
  name: "Mastodon",
  mono: "Ma",
  group: "social",
  method: "server",
  api: true,
  multi: true,
  types: ["dm", "reply", "react", "follow", "other"],
  fields: [{ key: "server", kind: "url", required: true }],

  hosts: (input) => [`${origin(normalizeHost(input.server ?? input.auth?.server))}/*`],

  async connect({ http, identity }, input) {
    // firefox for android has no sign-in window for extensions
    if (!identity?.launchWebAuthFlow) throw new DriverError("no-oauth");

    const host = normalizeHost(input.server);
    const base = origin(host);
    const redirect = identity.getRedirectURL();

    const app = await http.json(`${base}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Pharos", redirect_uris: redirect, scopes: SCOPES }),
    });

    const authorize = `${base}/oauth/authorize?${queryString({ client_id: app.client_id, redirect_uri: redirect, response_type: "code", scope: SCOPES })}`;
    const back = await identity.launchWebAuthFlow({ url: authorize, interactive: true });
    const code = new URL(back).searchParams.get("code");

    if (!code) throw new DriverError("login", "no-code");

    const token = await http.json(`${base}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: queryString({ grant_type: "authorization_code", code, client_id: app.client_id, client_secret: app.client_secret, redirect_uri: redirect, scope: SCOPES }),
    });

    const profile = await http.json(`${base}/api/v1/accounts/verify_credentials`, { headers: { Authorization: `Bearer ${token.access_token}` } });

    return { auth: { server: host, token: token.access_token }, label: `@${profile.acct}@${host}` };
  },

  async check(account, { http }) {
    const base = origin(account.auth.server);
    const headers = { Authorization: `Bearer ${account.auth.token}` };
    const counts = {};

    for (const [type, kinds] of Object.entries(GROUPS)) {
      try {
        const unread = await http.json(`${base}/api/v1/notifications/unread_count?${queryString({ "types[]": kinds, limit: 1000 })}`, { headers });

        counts[type] = unread.count ?? 0;
      } catch (thrown) {
        if (thrown.kind === "rule" && thrown.detail === "http-404") throw new DriverError("rule", "server-too-old");
        throw thrown;
      }
    }

    const convos = await http.json(`${base}/api/v1/conversations?limit=40`, { headers });

    counts.dm = convos.filter((convo) => convo.unread).length;

    return { counts };
  },

  openUrl: (account) => `${origin(account.auth.server)}/notifications`,
};