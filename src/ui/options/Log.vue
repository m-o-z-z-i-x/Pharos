<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "log": checks of all accounts with filters by service and result, sort order and pages of 10 -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, ref, watch } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { appStore } from "@/ui/stores/app.js";
  import { stamp, logText, byServiceName } from "@/ui/format.js";
  import BaseIcon from "@/ui/components/BaseIcon.vue";
  import BaseSegmented from "@/ui/components/BaseSegmented.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const PAGE = 10;
  const service = ref("all");
  const result = ref("all");
  const order = ref("new");
  const page = ref(1);

  // COMPUTED
  // ---------------------------------------------------------------------------
  const sortedAccounts = computed(() => [...app.accounts].sort(byServiceName((account) => app.serviceOf(account.serviceId).name)));
  const all = computed(() =>
    app.accounts.flatMap((account) => account.log.map((entry) => ({ ...entry, name: app.serviceOf(account.serviceId).name, label: account.label, id: account.id }))),
  );

  const filtered = computed(() => {
    const list = all.value.filter((row) =>
      (service.value === "all" || row.id === service.value) &&
      (result.value === "all" || (result.value === "ok") === row.ok),
    );

    return list.sort((first, second) => (order.value === "new" ? second.at - first.at : first.at - second.at));
  });

  const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE)));
  const rows = computed(() => filtered.value.slice((page.value - 1) * PAGE, page.value * PAGE));
  const from = computed(() => (filtered.value.length ? (page.value - 1) * PAGE + 1 : 0));
  const to = computed(() => Math.min(page.value * PAGE, filtered.value.length));

  // WATCHERS
  // ---------------------------------------------------------------------------
  // a new filter or order starts from the first page, otherwise the page may point past the end
  watch([service, result, order], () => { page.value = 1; });

  // new checks arrive while the page is open: keep the page inside the range
  watch(pages, (pageCount) => { if (page.value > pageCount) page.value = pageCount; });

  // METHODS
  // ---------------------------------------------------------------------------
  const goToPage = (target) => { page.value = Math.min(pages.value, Math.max(1, target)); };
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <p class="lead">{{ t("opt.log.lead") }}</p>

  <div v-if="all.length" class="bar">
    <label class="field">
      <span class="lbl">{{ t("opt.log.service") }}</span>

      <select v-model="service" class="in">
        <option value="all">{{ t("opt.log.allServices") }}</option>
        <option v-for="account in sortedAccounts" :key="account.id" :value="account.id">{{ app.serviceOf(account.serviceId).name }} · {{ account.label }}</option>
      </select>
    </label>

    <div class="field">
      <span class="lbl">{{ t("opt.log.result") }}</span>
      <BaseSegmented :items="['all', 'ok', 'err'].map((value) => ({ value, label: t(`opt.log.res.${value}`) }))" :value="result" @pick="(value) => (result = value)" />
    </div>

    <div class="field">
      <span class="lbl">{{ t("opt.log.order") }}</span>
      <BaseSegmented :items="['new', 'old'].map((value) => ({ value, label: t(`opt.log.sort.${value}`) }))" :value="order" @pick="(value) => (order = value)" />
    </div>
  </div>

  <!-- the log panel is always there; while it has nothing, it says why -->
  <div class="tblwrap">
    <table class="tbl">
      <thead><tr><th>{{ t("opt.log.time") }}</th><th>{{ t("opt.log.service") }}</th><th>{{ t("opt.log.result") }}</th></tr></thead>

      <TransitionGroup name="row" tag="tbody">
        <tr v-for="(row, index) in rows" :key="row.id + row.at" :style="{ '--i': index }">
          <td class="num">{{ stamp(row.at) }}</td>
          <td><strong>{{ row.name }}</strong><small>{{ row.label }}</small></td>
          <td><span class="res" :class="row.ok ? 'ok' : 'bad'"><BaseIcon :name="row.ok ? 'check' : 'x'" />{{ logText(row) }}</span></td>
        </tr>
      </TransitionGroup>
    </table>

    <BaseEmpty v-if="!all.length" bare icon="refresh" :title="t('opt.log.empty')" :text="t('opt.log.emptySub')" />
    <BaseEmpty v-else-if="!rows.length" bare compact icon="search" :title="t('opt.log.none')" />
  </div>

    <nav v-if="filtered.length" class="pager" :aria-label="t('opt.log.pages')">
      <span class="count">{{ t("opt.log.range", { from, to, total: filtered.length }) }}</span>

      <div class="pg">
        <button class="ib" type="button" :disabled="page === 1" :aria-label="t('opt.log.prev')" :title="t('opt.log.prev')" @click="goToPage(page - 1)"><BaseIcon name="back" /></button>

        <span class="now">{{ page }} / {{ pages }}</span>

        <button class="ib next" type="button" :disabled="page === pages" :aria-label="t('opt.log.next')" :title="t('opt.log.next')" @click="goToPage(page + 1)"><BaseIcon name="back" /></button>
      </div>
    </nav>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 16px 24px;
    padding: 16px 20px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--line);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .field > :last-child {
    min-height: 36px;
    align-self: flex-start;
  }

  .field > .seg {
    align-self: flex-start;
    margin-block: auto;
  }

  .field select {
    min-width: 220px;
    max-width: 320px;
    height: 36px;
  }

  .tbl tbody tr {
    transition: background-color .18s;
  }

  .tbl tbody tr:hover {
    background: var(--hover);
  }

  .res {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px 2px 6px;
    border-radius: 999px;
    font-size: .76rem;
    color: var(--hi);
  }

  .res :deep(.ic) {
    width: 14px;
    height: 14px;
  }

  .res.ok {
    background: var(--ok-soft);
  }

  .res.ok :deep(.ic) {
    color: var(--ok);
  }

  .res.bad {
    background: var(--bad-soft);
  }

  .res.bad :deep(.ic) {
    color: var(--bad);
  }

  .pager {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    font-size: .8rem;
  }

  .count {
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .pg {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .pg .now {
    min-width: 56px;
    text-align: center;
    color: var(--hi);
    font-variant-numeric: tabular-nums;
  }

  .pg .ib:disabled {
    opacity: .35;
    pointer-events: none;
  }

  .pg .next :deep(.ic) {
    transform: scaleX(-1);
  }

  .row-enter-active {
    transition: opacity .22s ease, transform .22s var(--ease);
    transition-delay: calc(var(--i) * 18ms);
  }

  .row-enter-from {
    opacity: 0;
    transform: translateY(4px);
  }

  .row-leave-active {
    display: none;
  }

  /* on a phone the time moves next to the service and the result takes its own line */
  @media (max-width: 720px) {
    .tbl,
    .tbl tbody {
      display: block;
    }

    .tbl thead {
      display: none;
    }

    .tbl tbody tr {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px 12px;
      padding: 10px 16px;
      border-top: 1px solid var(--line);
    }

    .tbl tbody tr:first-child {
      border-top: 0;
    }

    .tbl tbody td {
      padding: 0;
      border: 0;
      white-space: normal;
    }

    .tbl tbody td:nth-child(1) {
      grid-column: 2;
      grid-row: 1;
    }

    .tbl tbody td:nth-child(3) {
      grid-column: 1 / -1;
    }

    .field select {
      min-width: 0;
      max-width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .row-enter-active,
    .tbl tbody tr {
      transition: none;
    }
  }
</style>