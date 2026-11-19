// UTILS
// -----------------------------------------------------------------------------
import { DriverError } from "./contract.js";
import { normalizeHost, origin, queryString } from "./util.js";

// SEPARATOR -------------------------------------------------------------------

const FILTER = JSON.stringify({
  presence: { types: [] },
  account_data: { types: ["m.direct"] },
  room: { timeline: { limit: 1 }, state: { lazy_load_members: true, types: [] }, ephemeral: { types: ["m.receipt"] }, account_data: { types: [] } },
});

async function discover(http, server) {
  const host = normalizeHost(server);

  try {
    const wellKnown = await http.json(`${origin(host)}/.well-known/matrix/client`);
    const base = wellKnown?.["m.homeserver"]?.base_url;

    if (base) return base.replace(/\/+$/, "");
  } catch {
    // no well-known: the server itself is the homeserver
  }

  return origin(host);
}

/** @type {import('./contract.js').Driver} */
export default {
  id: "matrix",
  name: "Matrix",
  mono: "Mx",
  group: "messengers",
  method: "server",
  api: true,
  multi: true,
  types: ["dm", "reply", "other"],
  fields: [{ key: "server", kind: "url", required: true }],

  hosts: (input) => {
    const homeserver = input.auth?.hs ? new URL(input.auth.hs).host : null;

    return [...new Set([normalizeHost(input.server ?? input.auth?.hs), homeserver].filter(Boolean))].map((host) => `${origin(host)}/*`);
  },

  async connect({ http, identity }, input) {
    // firefox for android has no sign-in window for extensions
    if (!identity?.launchWebAuthFlow) throw new DriverError("no-oauth");

    const homeserver = await discover(http, input.server);
    const redirect = identity.getRedirectURL();

    const back = await identity.launchWebAuthFlow({
      url: `${homeserver}/_matrix/client/v3/login/sso/redirect?${queryString({ redirectUrl: redirect })}`,
      interactive: true,
    });

    const token = new URL(back).searchParams.get("loginToken");

    if (!token) throw new DriverError("login", "no-token");

    const login = await http.json(`${homeserver}/_matrix/client/v3/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "m.login.token", token, initial_device_display_name: "Pharos" }),
    });

    return { auth: { hs: homeserver, token: login.access_token, userId: login.user_id, since: null, rooms: {}, direct: [] }, label: login.user_id };
  },

  async check(account, { http }) {
    const sessionAuth = account.auth;
    const params = { timeout: 0, filter: FILTER, since: sessionAuth.since ?? undefined };
    const sync = await http.json(`${sessionAuth.hs}/_matrix/client/v3/sync?${queryString(params)}`, { headers: { Authorization: `Bearer ${sessionAuth.token}` } });

    const rooms = { ...(sessionAuth.rooms ?? {}) };

    for (const [id, room] of Object.entries(sync.rooms?.join ?? {})) {
      const unread = room.unread_notifications;

      if (unread) rooms[id] = { n: unread.notification_count ?? 0, h: unread.highlight_count ?? 0 };
    }

    for (const id of Object.keys(sync.rooms?.leave ?? {})) delete rooms[id];

    let direct = sessionAuth.direct ?? [];
    const dmEvent = sync.account_data?.events?.find((event) => event.type === "m.direct");

    if (dmEvent) direct = [...new Set(Object.values(dmEvent.content ?? {}).flat())];

    const counts = { dm: 0, reply: 0, other: 0 };

    for (const [id, { n: notifications, h: highlights }] of Object.entries(rooms)) {
      if (direct.includes(id)) counts.dm += notifications;
      else { counts.reply += highlights; counts.other += Math.max(0, notifications - highlights); }
    }

    return { counts, auth: { since: sync.next_batch, rooms, direct } };
  },

  openUrl: () => "https://app.element.io/",
};