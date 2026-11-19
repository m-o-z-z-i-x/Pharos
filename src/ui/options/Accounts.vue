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
  import { hhmm as fmtTime } from "@/ui/format.js";
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

  // COMPUTED
  // ---------------------------------------------------------------------------
  const rows = computed(() => app.accounts.map((account) => ({ account, service: app.serviceOf(account.serviceId) })));

  // METHODS
  // ---------------------------------------------------------------------------
  const hhmm = (at) => (at ? fmtTime(at) : "—");
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <p v-if="rows.length" class="lead">{{ t("opt.accounts.lead", { n: rows.length }) }}</p>

  <div class="tblwrap">
    <table class="tbl">
      <thead><tr><th>{{ t("opt.accounts.service") }}</th><th>{{ t("opt.accounts.method") }}</th><th>{{ t("opt.accounts.interval") }}</th><th>{{ t("opt.accounts.last") }}</th><th>{{ t("opt.accounts.state") }}</th><th /></tr></thead>

      <tbody>
        <tr v-for="{ account, service } in rows" :key="account.id" class="acc-row">
          <td><div class="svc"><ServiceLogo :service="service" size="sm" /><div><strong>{{ service.name }}</strong><small>{{ account.label }}</small></div></div></td>
          <td><span class="meta"><span class="dot" :class="service.api ? 'api' : 'web'" />{{ t(`methods.${service.method}`) }}</span></td>
          <td class="num">{{ t("account.minutes", { n: account.interval }) }}</td>
          <td class="num">{{ hhmm(account.lastCheckAt) }}</td>
          <td><span class="state" :class="STATE[account.state]">{{ t(`opt.accounts.${account.state}`) }}</span></td>
          <td class="end"><button class="btn sm ghost" type="button" @click="emit('configure', account.id)">{{ t("opt.accounts.configure") }}</button></td>
        </tr>
      </tbody>
    </table>

    <BaseEmpty v-if="!rows.length" bare icon="plus" :title="t('opt.accounts.empty')" :text="t('opt.accounts.none')" />
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