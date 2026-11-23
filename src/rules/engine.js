// UTILS
// -----------------------------------------------------------------------------
import { DriverError } from "@/drivers/contract.js";

// SEPARATOR -------------------------------------------------------------------

// path parts: "name", "[1]" or "[key=value]" (the first array element whose key equals value)
const PART = /([^.[\]]+)|\[(\d+)\]|\[([^=\]]+)=([^\]]*)\]/g;

/** "a.b[1].c" or "data.elements[tab=MESSAGING].count" → value or null */
function byPath(source, path) {
  let node = source;

  for (const [, name, index, key, value] of path.matchAll(PART)) {
    if (node == null || typeof node !== "object") return null;

    if (name !== undefined) node = node[name];
    else if (index !== undefined) node = node[Number(index)];
    else node = Array.isArray(node) ? node.find((item) => String(item?.[key]) === value) : undefined;
  }

  return node ?? null;
}

const toCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? 1 : 0;

  const number = Number(String(value).replace(/[^\d]/g, ""));

  return Number.isFinite(number) && String(value).match(/\d/) ? number : null;
};

/**
 * a meta mailbox (instagram, threads) lists chats, not a number, so the count is made as the site makes its badge:
 * a chat is unread when it is marked so, or when it is not muted and the own read mark is older than its last activity
 * the mailbox id is the own participant id. a threads chat carries its unread flag and mute end itself
 * @return the number of unread chats, or null when the answer holds no mailbox
 */
function unreadChats(mailbox, now = Date.now()) {
  if (!mailbox || typeof mailbox !== "object" || !mailbox.threads_by_folder) return null;

  const self = String(mailbox.id);
  const chats = (mailbox.threads_by_folder.edges ?? []).map((edge) => edge?.node?.as_ig_direct_thread ?? edge?.node?.as_micg_interface ?? edge?.node).filter(Boolean);

  return chats.filter((chat) => {
    // 0 is not muted, a negative end is muted for good
    if ("is_unread" in chat) {
      const muteEnd = Number(chat.mute_until_ms ?? 0);

      return Boolean(chat.is_unread) && !(muteEnd < 0 || muteEnd > now);
    }

    if (chat.marked_as_unread) return true;
    if (chat.is_muted) return false;

    const own = chat.slide_read_receipts?.find((receipt) => String(receipt.participant_fbid) === self);

    return Number(own?.watermark_timestamp_ms ?? 0) < Number(chat.last_activity_timestamp_ms ?? 0);
  }).length;
}

/**
 * @param {{json?: string|string[], regex?: string, group?: number, xml?: string, unreadChats?: string, isNot?: string}} ex
 * @param {any} body - parsed JSON or text
 * @returns {number|null}
 */
function extract(extractor, body) {
  // a site that shows only a dot: 1 while the value is anything but the quiet one
  if (extractor.isNot !== undefined) {
    const value = byPath(body, extractor.json);

    return value === null ? null : Number(String(value) !== String(extractor.isNot));
  }

  // several json paths add up: one type often collects a few counters of the site
  if (Array.isArray(extractor.json)) {
    const parts = extractor.json.map((path) => toCount(byPath(body, path)));

    return parts.every((part) => part === null) ? null : parts.reduce((sum, part) => sum + (part ?? 0), 0);
  }

  if (extractor.json !== undefined) return toCount(byPath(body, extractor.json));

  const text = typeof body === "string" ? body : JSON.stringify(body);

  if (extractor.regex !== undefined) {
    const match = text.match(new RegExp(extractor.regex));

    return match ? toCount(match[extractor.group ?? 1] ?? match[0]) : null;
  }

  if (extractor.unreadChats !== undefined) return unreadChats(byPath(body, extractor.unreadChats));

  if (extractor.xml !== undefined) {
    const match = text.match(new RegExp(`<${extractor.xml}>\\s*([^<]*?)\\s*</${extractor.xml}>`));

    return match ? toCount(match[1]) : null;
  }

  return null;
}

export const fill = (template, auth) => template.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(auth?.[key] ?? "0"));

// some sites prefix json with a guard against script inclusion
const parseJson = (text) => {
  try {
    return JSON.parse(text.replace(/^for \(;;\);/, ""));
  } catch {
    throw new DriverError("rule", "bad-json");
  }
};

/**
 * a value in a rule: plain text, a cookie of the site or a piece of an earlier answer
 * @param spec - "text {n}" | { cookie, strip, template } | { from, regex, template, fallback } | { uuid, template } | { sapisidhash: origin }
 */
async function resolve(spec, { url, account, bodies, http, kept, learned }) {
  if (typeof spec === "string") return fill(spec, account.auth);

  // some sites only want any device id of the form a browser makes up
  if (spec.uuid) return spec.template ? spec.template.replace("{value}", crypto.randomUUID()) : crypto.randomUUID();

  if (spec.cookie) {
    const raw = (await http.cookie(url, spec.cookie)) ?? "";
    const value = spec.strip ? decodeURIComponent(raw).replace(/^"|"$/g, "") : raw;

    return spec.template ? spec.template.replace("{value}", value) : value;
  }

  // google signs requests of its own pages with a hash of the SAPISID cookie, the time and the page origin
  if (spec.sapisidhash) {
    const sid = (await http.cookie(url, "SAPISID")) ?? "";
    const time = Math.floor(Date.now() / 1000);
    const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${time} ${sid} ${spec.sapisidhash}`));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

    return `SAPISIDHASH ${time}_${hash}`;
  }

  if (spec.from) {
    const id = JSON.stringify(spec);
    // a token remembered from an earlier check saves loading the page it comes from
    let value = kept[spec.from]?.[id];

    if (value === undefined) {
      const source = bodies[spec.from];
      const text = typeof source === "string" ? source : JSON.stringify(source);
      const match = text?.match(new RegExp(spec.regex));

      // a value the site gives only sometimes falls back instead of failing the check
      if (!match && spec.fallback !== undefined) return spec.fallback;
      // a page that hands the token only to a signed-in visitor: its absence means a lost sign-in, not a changed site
      if (!match && spec.onMissing === "login") throw new DriverError("login", `no-token-${spec.from}`);
      if (!match) throw new DriverError("rule", `no-token-${spec.from}`);

      value = match[1] ?? match[0];
      if (learned[spec.from]) learned[spec.from][id] = value;
    }

    return spec.template ? spec.template.replace("{value}", value) : value;
  }

  return "";
}

const specsOf = (request) => [...Object.values(request.headers ?? {}), ...Object.values(request.form ?? {}), request.jsonFrom].filter((spec) => spec?.from);

/**
 * the answers a check reads: counters, the logged-out test, the error test and the tokens they need
 * the account name is read only when connecting; null when every answer may reveal a logged-out session
 */
function neededForCheck(rule) {
  if (rule.auth?.loggedOutIf?.bodyIncludes) return null;

  const needed = new Set(Object.values(rule.map).map((extractor) => extractor.from));

  if (rule.auth?.loggedOutIf?.missing) needed.add(rule.auth.loggedOutIf.missing.from);
  if (rule.auth?.loggedOutIf?.equals) needed.add(rule.auth.loggedOutIf.equals.from);
  if (rule.errorIf) needed.add(rule.errorIf.from);

  // a token always comes from an earlier answer, so walking back collects the whole chain
  for (const request of [...rule.requests].reverse()) if (needed.has(request.key)) for (const spec of specsOf(request)) needed.add(spec.from);

  return needed;
}

// an answer read only for its tokens, whose tokens are still fresh, is not loaded again
function keptTokens(rule, account, needed, now) {
  const kept = {};

  for (const request of rule.requests) {
    const saved = account.auth?.tokens?.[request.key];
    const direct = Object.values(rule.map).some((extractor) => extractor.from === request.key) || rule.auth?.loggedOutIf?.missing?.from === request.key || rule.auth?.loggedOutIf?.equals?.from === request.key || rule.errorIf?.from === request.key;

    if (!request.reuse || !needed || direct || !saved || now - saved.at > request.reuse * 60_000) continue;

    const ids = rule.requests.flatMap(specsOf).filter((spec) => spec.from === request.key).map((spec) => JSON.stringify(spec));

    if (ids.every((id) => id in saved.values)) kept[request.key] = saved.values;
  }

  return kept;
}

/**
 * the account name for telling accounts apart: a json path or a regex over an answer
 * @return the name or null
 */
export function labelOf(rule, bodies) {
  const label = rule.label;

  if (!label) return null;
  const body = bodies[label.from];

  if (label.json) return String(byPath(body, label.json) ?? "").trim() || null;
  const text = typeof body === "string" ? body : JSON.stringify(body);

  return text?.match(new RegExp(label.regex))?.[1]?.trim() || null;
}

/**
 * run a declarative rule with the browser's login
 * @param purpose - "connect" reads every answer (the account name too), "check" only what the counters need
 * @returns {Promise<{counts: Object, bodies: Object, tokens: Object|null}>} tokens - to remember in the account, null when unchanged
 */
export async function evaluate(rule, account, deps, { purpose = "connect", now = Date.now() } = {}) {
  const needed = purpose === "check" ? neededForCheck(rule) : null;
  const kept = purpose === "check" ? keptTokens(rule, account, needed, now) : {};

  try {
    return await run(rule, account, deps, { needed, kept, now });
  } catch (thrown) {
    // remembered tokens may have expired: the check is repeated once with their pages loaded again
    if (!Object.keys(kept).length || thrown?.kind === "network") throw thrown;

    return run(rule, account, deps, { needed, kept: {}, now });
  }
}

async function run(rule, account, { http, parseHtml }, { needed, kept, now }) {
  const bodies = {};
  const learned = {};

  for (const request of rule.requests) {
    if (kept[request.key] || (needed && !needed.has(request.key))) continue;
    if (request.reuse) learned[request.key] = {};

    const url = fill(request.url, account.auth);
    const ctx = { url, account, bodies, http, kept, learned };
    const headers = {};

    for (const [name, spec] of Object.entries(request.headers ?? {})) {
      const value = await resolve(spec, ctx);

      // an empty value means the site did not ask for this header this time
      if (value !== "") headers[name] = value;
    }

    let body;

    if (request.form) {
      const form = new URLSearchParams();

      for (const [name, spec] of Object.entries(request.form)) form.set(name, await resolve(spec, ctx));
      body = form.toString();
      headers["content-type"] = "application/x-www-form-urlencoded";
    } else if (request.json !== undefined) {
      body = JSON.stringify(request.json);
      headers["content-type"] = "application/json";
    } else if (request.jsonFrom) {
      // the body an earlier answer asks for, or the fallback when it asks for nothing
      body = JSON.stringify(byPath(bodies[request.jsonFrom.from], request.jsonFrom.json) ?? request.jsonFrom.fallback ?? {});
      headers["content-type"] = "application/json";
    }

    // origin: the site checks where a request comes from, so it is sent as if from its own page
    const text = await http.text(url, {
      withCookies: true,
      method: request.method ?? (body ? "POST" : "GET"),
      headers,
      body,
      origin: request.origin ?? undefined,
      // the site sends its session cookies only to its own pages: they are read and attached by hand
      inject: request.inject ?? false,
      loggedOutPath: rule.auth?.loggedOutIf?.redirectTo,
      // a site that answers a guest with its own error code, read further by loggedOutIf
      acceptStatus: request.acceptStatus,
    });

    const out = rule.auth?.loggedOutIf?.bodyIncludes;

    if (out && text.includes(out)) throw new DriverError("login", "logged-out-page");

    // an empty answer holds no data rather than broken json: the logged-out tests read it as missing
    bodies[request.key] = request.parse === "json" ? (text.trim() ? parseJson(text) : null) : text;
  }

  // a site that answers 200 to a guest still lacks the signed-in part of the answer
  const missing = rule.auth?.loggedOutIf?.missing;

  if (missing && byPath(bodies[missing.from], missing.json) === null) throw new DriverError("login", "logged-out");

  // a site that answers a guest like a member, only with a flag saying so
  const equals = rule.auth?.loggedOutIf?.equals;

  if (equals && String(byPath(bodies[equals.from], equals.json)) === String(equals.value)) throw new DriverError("login", "logged-out");

  // a site that reports an error inside a 200 answer would otherwise read as zero notifications
  if (rule.errorIf && byPath(bodies[rule.errorIf.from], rule.errorIf.json) !== null) throw new DriverError("rule", "site-error");

  const counts = {};

  for (const [type, extractor] of Object.entries(rule.map)) {
    let value;

    if (extractor.css) {
      if (!parseHtml) throw new DriverError("rule", "no-dom");

      const [raw] = await parseHtml(bodies[extractor.from], [{ css: extractor.css, attr: extractor.attr }]);

      value = toCount(raw);
    } else value = extract(extractor, bodies[extractor.from]);

    // some counters are left out of an answer when they are zero
    if (value === null && extractor.zero) value = 0;

    if (value === null) {
      if (extractor.optional) continue;
      throw new DriverError("rule", `no-${type}`);
    }

    counts[type] = value;
  }

  const fresh = Object.entries(learned).filter(([, values]) => Object.keys(values).length);
  const tokens = fresh.length ? { ...(account.auth?.tokens ?? {}), ...Object.fromEntries(fresh.map(([key, values]) => [key, { at: now, values }])) } : null;

  return { counts, bodies, tokens };
}