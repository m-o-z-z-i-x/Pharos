/** "https://Social.Test/" or "social.test" → "social.test" */
export function normalizeHost(input) {
  const raw = String(input ?? "").trim().replace(/^@/, "");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);

  return url.host.toLowerCase();
}

export const origin = (host) => `https://${host}`;

/** query string with repeated keys: {"types[]": ["a", "b"]} → types[]=a&types[]=b */
export function queryString(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined && item !== null) search.append(key, item);
  }

  return search.toString();
}