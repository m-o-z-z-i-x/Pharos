// UTILS
// -----------------------------------------------------------------------------
import { TYPES } from "./model.js";
import { t } from "@/i18n";

// SEPARATOR -------------------------------------------------------------------

/**
 * @param {{accountId: string, type: string, delta: number}[]} items
 * @param {(accountId: string) => string} nameOf
 * @returns {{title: string, lines: string[], total: number}|null}
 */
export function summarizeDigest(items, nameOf) {
  if (!items.length) return null;

  const byAccount = new Map();
  let total = 0;

  for (const { accountId, type, delta } of items) {
    if (!byAccount.has(accountId)) byAccount.set(accountId, {});

    const sums = byAccount.get(accountId);

    sums[type] = (sums[type] ?? 0) + delta;
    total += delta;
  }

  const lines = [...byAccount].map(([id, sums]) => {
    const parts = TYPES.filter((type) => sums[type]).map((type) => `${t(`types.short.${type}`)} ${sums[type]}`);

    return `${nameOf(id)}: ${parts.join(", ")}`;
  });

  return { title: t("digest.title", { n: total }, total), lines, total };
}