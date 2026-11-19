// UTILS
// -----------------------------------------------------------------------------
import { browser } from "wxt/browser";
import { defaultSettings } from "./model.js";

// SEPARATOR -------------------------------------------------------------------

const KEYS = { accounts: "accounts", settings: "settings", digest: "digest" };

export const EXPORT_FORMAT = 1;

const area = () => browser.storage.local;

async function read() {
  const raw = await area().get(Object.values(KEYS));

  return {
    accounts: raw.accounts ?? [],
    settings: { ...defaultSettings(), ...(raw.settings ?? {}) },
    digest: raw.digest ?? [],
  };
}

export const store = {
  getAll: read,

  /** @param {import('./model.js').Account} account */
  async putAccount(account) {
    const { accounts } = await read();
    const index = accounts.findIndex((stored) => stored.id === account.id);

    if (index === -1) accounts.push(account);
    else accounts[index] = account;

    await area().set({ accounts });
  },

  async putAccounts(list) {
    const { accounts } = await read();

    for (const account of list) {
      const index = accounts.findIndex((stored) => stored.id === account.id);

      if (index === -1) accounts.push(account);
      else accounts[index] = account;
    }

    await area().set({ accounts });
  },

  async removeAccount(id) {
    const { accounts } = await read();

    await area().set({ accounts: accounts.filter((stored) => stored.id !== id) });
  },

  async putSettings(patch) {
    const { settings } = await read();
    const next = { ...settings, ...patch };

    await area().set({ settings: next });

    return next;
  },

  async pushDigest(items) {
    if (!items.length) return;

    const { digest } = await read();

    await area().set({ digest: [...digest, ...items] });
  },

  async takeDigest() {
    const { digest } = await read();

    await area().set({ digest: [] });

    return digest;
  },

  /** settings and account list without secrets, for moving to another browser */
  async exportSettings() {
    const { accounts, settings } = await read();
    const safe = accounts.map(({ auth, log, counts, seen, error, ...rest }) => rest);

    return JSON.stringify({ format: EXPORT_FORMAT, settings, accounts: safe }, null, 2);
  },

  async wipe() {
    await area().clear();
  },
};