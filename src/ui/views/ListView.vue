<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- main popup screen: summary, filters by type, account list, quiet and digest banners, check -->
<!-- events: add — open the catalog, configure — account settings (id), login — sign in again (account) -->
<!-- exposes checkNow and toggleQuiet for the R and Q keys -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, ref } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { browser } from "wxt/browser";
  import { appStore } from "@/ui/stores/app.js";
  import { hoursActive, hoursEnd } from "@/core/quiet.js";
  import { groupForList, filterCounts, supports, loudTotal, clock } from "@/ui/format.js";
  import AccountRow from "@/ui/components/AccountRow.vue";
  import AccountGroup from "@/ui/components/AccountGroup.vue";
  import BaseIcon from "@/ui/components/BaseIcon.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["add", "configure", "login"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const filter = ref("all");
  const checking = ref(false);

  // COMPUTED
  // ---------------------------------------------------------------------------
  const live = computed(() => app.accounts.filter((account) => account.enabled));
  const typesOf = (account) => app.serviceOf(account.serviceId).types ?? [];
  const counts = computed(() => filterCounts(live.value, typesOf));

  // a filter shows all services with this type, not only those with news: news are on top anyway
  const visible = computed(() => {
    const list = filter.value === "all" ? live.value : live.value.filter((account) => supports(account, filter.value, typesOf));

    return groupForList(list, app.serviceOf);
  });

  const important = computed(() => loudTotal(live.value));
  const problems = computed(() => live.value.filter((account) => account.state === "login" || account.state === "broken").length);

  const headline = computed(() => {
    const head = important.value ? t("list.important", { n: important.value }, important.value) : t("list.noImportant");

    return problems.value ? `${head} · ${t("list.problems", { n: problems.value }, problems.value)}` : head;
  });

  const isDue = computed(() => nextIn.value !== null && nextIn.value <= 0);
  // by hand: just "quiet mode"; by the hours: until when it lasts
  const quietText = computed(() => (!app.settings.quietManual && hoursActive(app.settings, new Date(app.now)) ? t("list.quietUntil", { time: app.settings.quietHours.to }) : t("list.quietOn")));
  const nextIn = computed(() => (app.st?.nextRunAt ? app.st.nextRunAt - app.now : null));

  // METHODS
  // ---------------------------------------------------------------------------
  const checkNow = async () => {
    checking.value = true;

    await app.act("checkNow");

    checking.value = false;
  }

  // opening a service that needs sign-in or is broken is useless: lead to sign-in or settings
  const open = async (account) => {
    if (account.state === "login") return emit("login", account);
    if (account.state === "broken") return emit("configure", account.id);

    const url = account.openUrl;

    await app.act("markSeen", { accountId: account.id });
    if (url) await browser.tabs.create({ url });
  }

  const read = async (account) => {
    await app.act("markSeen", { accountId: account.id });
  }

  // the moon is pressed whenever quiet is really on, by hand or by the hours; pressing it during the hours
  // pauses them until the window ends, pressing it again later turns quiet on by hand
  const toggleQuiet = () => {
    const settings = app.settings;
    const now = new Date();

    if (!app.st.quiet) return app.act("setSettings", { patch: { quietManual: true, quietSkipUntil: 0 } });

    const byHours = hoursActive(settings, now);

    return app.act("setSettings", { patch: { quietManual: false, quietSkipUntil: byHours ? hoursEnd(settings, now) : 0 } });
  }

  defineExpose({ checkNow, toggleQuiet });
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <section class="view">
    <header class="ph">
      <span class="mark"><svg viewBox="3 3 18 18"><path d="M6.4 5H10v14H6.4z" fill="currentColor" stroke="none"/><path d="M11 5h2.4a4.2 4.2 0 0 1 0 8.4H11z" fill="var(--amber)" stroke="none"/></svg></span>
      <div class="grow"><h3>{{ t("app.name") }}</h3><small>{{ headline }}</small></div>
      <button class="ib" type="button" :aria-pressed="String(Boolean(app.st?.quiet))" :aria-label="t('list.quiet')" :title="`${t('list.quiet')} (Q)`" @click="toggleQuiet"><BaseIcon name="moon" /></button>
      <button class="ib" type="button" :aria-label="t('list.settings')" :title="t('list.settings')" @click="browser.runtime.openOptionsPage()"><BaseIcon name="gear" /></button>
    </header>

    <div class="pb">
      <div v-if="app.st?.quiet" class="banner quiet"><BaseIcon name="moon" /><span>{{ quietText }}</span></div>

      <template v-if="live.length">
        <div class="filters">
          <button v-for="kind in ['all', 'dm', 'reply', 'react']" :key="kind" class="fchip" type="button" :aria-pressed="String(filter === kind)" :title="t(`list.filterHints.${kind}`)" @click="filter = kind">
            {{ t(`list.filters.${kind}`) }}<span v-if="counts[kind]" class="num">{{ counts[kind] }}</span>
          </button>
        </div>

        <div v-if="visible.length" class="list">
          <template v-for="section in visible" :key="section.key">
            <div class="group-t" :class="{ fresh: section.key === 'new' }">{{ section.key === "new" ? t("list.newGroup") : t(`groups.${section.key}`) }}</div>

            <template v-for="entry in section.entries" :key="entry.serviceId">
              <AccountGroup v-if="entry.accounts.length > 1" :accounts="entry.accounts" :service="app.serviceOf(entry.serviceId)" :now="app.now" @open="open" @read="read" @configure="emit('configure', $event)" />

              <template v-else>
                <AccountRow v-for="account in entry.accounts" :key="account.id" :account="account" :service="app.serviceOf(account.serviceId)" :now="app.now" @open="open(account)" @read="read(account)" @configure="emit('configure', account.id)" />
              </template>
            </template>
          </template>
        </div>

        <BaseEmpty v-else icon="list" :title="t('list.emptyFilter')" compact />
      </template>

      <BaseEmpty v-else icon="bell" :title="t('list.empty')" :text="t('list.emptyHint')">
        <button class="btn" type="button" @click="emit('add')"><BaseIcon name="plus" />{{ t("list.add") }}</button>
      </BaseEmpty>

      <div v-if="app.st?.digestCount" class="banner"><BaseIcon name="heart" /><span class="grow">{{ t("digest.banner", { n: app.st.digestCount }) }}</span><button class="linkbtn" type="button" @click="app.act('flushDigest')">{{ t("digest.now") }}</button></div>
    </div>

    <!-- with nothing connected there is nothing to check, and adding lives in the empty state -->
    <footer v-if="app.accounts.length" class="pf" :class="{ scan: checking || isDue }">
      <div class="grow">
        <span v-if="checking || isDue">{{ t("list.checking") }}</span>
        <span v-else-if="nextIn !== null">{{ t("list.next", { time: clock(nextIn) }) }}</span>
      </div>

      <button class="ib" type="button" :aria-label="t('list.checkNow')" :title="`${t('list.checkNow')} (R)`" @click="checkNow"><BaseIcon name="refresh" /></button>
      <button class="btn" type="button" @click="emit('add')"><BaseIcon name="plus" />{{ t("list.add") }}</button>
    </footer>
  </section>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .filters {
    display: flex;
    justify-content: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .fchip {
    padding: 4px 10px;
    border-radius: 8px;
    font-size: .78rem;
    transition: background-color .18s, color .18s;
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .fchip:hover {
    color: var(--hi);
    background: var(--hover);
  }

  .fchip[aria-pressed='true'] {
    background: var(--btn);
    color: var(--btn-text);
  }

  /* one line on a phone: the chips scroll sideways instead of wrapping */
  @media (hover: none) and (pointer: coarse) {
    .filters {
      flex-wrap: nowrap;
      justify-content: safe center;
      overflow-x: auto;
      scrollbar-width: none;
      gap: 2px;
    }

    .fchip {
      flex: none;
      min-height: 36px;
      padding: 6px 10px;
    }
  }

  .fchip .num {
    font-size: .72rem;
    opacity: .7;
  }

  .hi {
    color: var(--hi);
    font-weight: 500;
  }

  .group-t {
    padding: 8px 4px 0;
    font-size: .78rem;
    color: var(--text);
  }

  .group-t.fresh {
    color: var(--amber);
  }

  .scan .ib :deep(.ic) {
    animation: spin 1s linear infinite;
  }
</style>