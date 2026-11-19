// UTILS
// -----------------------------------------------------------------------------
import mastodon from "@/drivers/mastodon.js";
import bluesky from "@/drivers/bluesky.js";
import matrix from "@/drivers/matrix.js";

// SEPARATOR -------------------------------------------------------------------

const API = { mastodon, bluesky, matrix };

/**
 * origins to request for a service, computed without waiting so the click still counts as a user gesture
 * always a plain array of strings: Chrome rejects a Vue reactive Proxy synchronously in permissions.request
 */
export function hostsFor(service, input = {}) {
  if (service.hostsPreview) return Array.from(service.hostsPreview, String);

  try {
    return Array.from(API[service.id]?.hosts({ ...input }) ?? [], String);
  } catch {
    return [];
  }
}

export const displayHost = (pattern) => pattern.replace(/^https?:[/][/]/, "").replace(/[/][*]$/, "").replace(/^[*][.]/, "");