// UTILS
// -----------------------------------------------------------------------------
import * as ed25519 from "@noble/ed25519";
import bundled from "../../rules/catalog.json";
import { PUBLIC_KEY, CATALOG_BASE } from "./publicKey.js";

// SEPARATOR -------------------------------------------------------------------

const DAY = 864e5;

const fromHex = (hex) => {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("bad hex");

  return Uint8Array.from(hex.match(/../g).map((pair) => parseInt(pair, 16)));
};

async function verifyCatalog(text, sigHex, publicKeyHex) {
  try {
    return await ed25519.verifyAsync(fromHex(sigHex), new TextEncoder().encode(text), fromHex(publicKeyHex));
  } catch {
    return false;
  }
}

/**
 * built-in catalog, replaced by a newer signed one from the repository at most once a day
 * a file whose signature does not match is ignored
 * @param {{fetch: typeof fetch, storage: any, now: number, force?: boolean}} deps
 * @returns {Promise<{catalog: Object, source: 'bundled'|'remote', checkedAt: number, verified: boolean}>}
 */
export async function loadCatalog({ fetch, storage, now, force = false }) {
  const { catalogCache } = await storage.get("catalogCache");
  let cache = catalogCache ?? null;

  if (force || !cache || now - cache.checkedAt > DAY) {
    try {
      const [text, signature] = await Promise.all([
        fetch(`${CATALOG_BASE}catalog.json`, { cache: "no-store" }).then((response) => (response.ok ? response.text() : Promise.reject(new Error(response.status)))),
        fetch(`${CATALOG_BASE}catalog.sig`, { cache: "no-store" }).then((response) => (response.ok ? response.text() : Promise.reject(new Error(response.status)))),
      ]);

      const verified = await verifyCatalog(text, signature.trim(), PUBLIC_KEY);

      cache = verified ? { text, checkedAt: now, verified: true } : { ...(cache ?? {}), checkedAt: now, verified: false };
    } catch {
      cache = { ...(cache ?? {}), checkedAt: now };
    }

    await storage.set({ catalogCache: cache });
  }

  const remote = cache?.text ? JSON.parse(cache.text) : null;

  if (remote && remote.version > bundled.version) return { catalog: remote, source: "remote", checkedAt: cache.checkedAt, verified: true };

  return { catalog: bundled, source: "bundled", checkedAt: cache?.checkedAt ?? 0, verified: cache?.verified !== false };
}