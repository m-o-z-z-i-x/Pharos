<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "services": table of connected accounts and the add button -->
<!-- events: configure — open account settings (id); the add button sits in the page title -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { appStore } from "@/ui/stores/app.js";
  import { hhmm as fmtTime, byServiceName } from "@/ui/format.js";
  import ServiceLogo from "@/ui/components/ServiceLogo.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["configure"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const STATE = { ok: "good", pending: "warn", login: "warn", broken: "bad" };
  const ORDER = ["messengers", "social", "mail", "dev", "other"];

  // COMPUTED
  // ---------------------------------------------------------------------------
  const count = computed(() => app.accounts.length);

  // categories as in the catalog, services a to z inside, the accounts of one service together under it
  const sections = computed(() => {
    const sorted = [...app.accounts].sort(byServiceName((account) => app.serviceOf(account.serviceId).name));
    const services = new Map();

    for (const account of sorted) {
      if (!services.has(account.serviceId)) services.set(account.serviceId, { service: app.serviceOf(account.serviceId), accounts: [] });

      services.get(account.serviceId).accounts.push(account);
    }

    return ORDER.map((group) => ({ group, services: [...services.values()].filter((entry) => (entry.service.group ?? "other") === group) })).filter((section) => section.services.length);
  });

  // METHODS
  // ---------------------------------------------------------------------------
  const hhmm = (at) => (at ? fmtTime(at) : "—");
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <p v-if="count" class="lead">{{ t("opt.accounts.lead", { n: count }) }}</p>

  <div class="tblwrap">
    <table class="tbl">
      <thead><tr><th>{{ t("opt.accounts.service") }}</th><th>{{ t("opt.accounts.method") }}</th><th>{{ t("opt.accounts.interval") }}</th><th>{{ t("opt.accounts.last") }}</th><th>{{ t("opt.accounts.state") }}</th><th /></tr></thead>

      <tbody v-for="section in sections" :key="section.group">
        <tr class="cat"><th colspan="6" scope="colgroup">{{ t(`groups.${section.group}`) }}</th></tr>

        <template v-for="entry in section.services" :key="entry.service.id">
          <tr v-if="entry.accounts.length > 1" class="grp"><td colspan="6"><div class="svc"><ServiceLogo :service="entry.service" size="sm" /><div><strong>{{ entry.service.name }}</strong><small>{{ t("list.accounts", { n: entry.accounts.length }, entry.accounts.length) }}</small></div></div></td></tr>

          <tr v-for="account in entry.accounts" :key="account.id" class="acc-row" :class="{ nested: entry.accounts.length > 1 }">
            <td>
              <div v-if="entry.accounts.length > 1" class="svc"><div><strong>{{ account.label }}</strong></div></div>
              <div v-else class="svc"><ServiceLogo :service="entry.service" size="sm" /><div><strong>{{ entry.service.name }}</strong><small>{{ account.label }}</small></div></div>
            </td>

            <td><span class="meta"><span class="dot" :class="entry.service.api ? 'api' : 'web'" />{{ t(`methods.${entry.service.method}`) }}</span></td>
            <td class="num">{{ t("account.minutes", { n: account.interval }) }}</td>
            <td class="num">{{ hhmm(account.lastCheckAt) }}</td>
            <td><span class="state" :class="STATE[account.state]">{{ t(`opt.accounts.${account.state}`) }}</span></td>
            <td class="end"><button class="btn sm ghost" type="button" @click="emit('configure', account.id)">{{ t("opt.accounts.configure") }}</button></td>
          </tr>
        </template>
      </tbody>
    </table>

    <BaseEmpty v-if="!count" bare icon="plus" :title="t('opt.accounts.empty')" :text="t('opt.accounts.none')" />
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .acc-row {
    transition: background-color .18s;
  }

  .acc-row:hover {
    background: var(--hover);
  }

  .tbl .cat th {
    padding: 12px 16px 8px;
    font-size: .78rem;
    color: var(--text);
    background: var(--panel-dark);
  }

  .tbl .grp td {
    padding-bottom: 4px;
    border-top: 1px solid var(--line);
  }

  .tbl .nested td:first-child {
    padding-left: 48px;
  }

  .tbl .nested td {
    border-top: 0;
  }

  .svc {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* six columns do not fit a phone: every account becomes a card */
  @media (max-width: 720px) {
    .tbl,
    .tbl tbody {
      display: block;
    }

    .tbl thead {
      display: none;
    }

    .tbl .acc-row {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      grid-template-areas: "svc svc svc state" "meth int last ." "act act act act";
      align-items: center;
      gap: 8px 12px;
      padding: 12px 16px;
      border-top: 1px solid var(--line);
    }

    .tbl .acc-row:first-child {
      border-top: 0;
    }

    .tbl .cat,
    .tbl .cat th,
    .tbl .grp,
    .tbl .grp td {
      display: block;
      width: 100%;
    }

    .tbl .grp td {
      padding: 12px 16px 0;
    }

    .tbl .nested {
      padding-left: 48px;
    }

    .tbl .nested td:first-child {
      padding-left: 0;
    }

    .tbl .acc-row td {
      padding: 0;
      border: 0;
      white-space: normal;
    }

    .tbl .acc-row td:nth-child(1) { grid-area: svc; }
    .tbl .acc-row td:nth-child(2) { grid-area: meth; }
    .tbl .acc-row td:nth-child(3) { grid-area: int; }
    .tbl .acc-row td:nth-child(4) { grid-area: last; }
    .tbl .acc-row td:nth-child(5) { grid-area: state; }
    .tbl .acc-row td:nth-child(6) { grid-area: act; }

    .tbl .acc-row td:nth-child(6) .btn {
      width: 100%;
    }
  }
</style>