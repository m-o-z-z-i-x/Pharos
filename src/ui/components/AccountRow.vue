<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- account row in the popup list: logo, name, counters by type, hover actions -->
<!-- props: account (without secrets), service (its description), now (current time for "5 min ago"), nested (a row inside a group: the address is the title), group (the number of accounts when the row stands for a group), expanded (the group is open), problems (accounts of the group that need attention) -->
<!-- events: open — open the service, read — mark as read, configure — account settings -->
<!-- usage: <AccountRow :account="a" :service="app.serviceOf(a.serviceId)" :now="app.now" @open="open(a)" /> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { TYPES } from "@/core/model.js";
  import { whenText } from "@/ui/format.js";
  import BaseIcon from "./BaseIcon.vue";
  import ServiceLogo from "./ServiceLogo.vue";

  // PROPS
  // ---------------------------------------------------------------------------
  const props = defineProps({
    account: { type: Object, required: true },
    service: { type: Object, required: true },
    now: { type: Number, required: true },
    nested: { type: Boolean, default: false },
    group: { type: Number, default: 0 },
    expanded: { type: Boolean, default: false },
    problems: { type: Number, default: 0 },
  });

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["open", "read", "configure"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const ICONS = { dm: "mail", reply: "reply", react: "heart", follow: "user", other: "bell" };

  // COMPUTED
  // ---------------------------------------------------------------------------
  const current = computed(() => props.account);
  const problem = computed(() => current.value.state === "login" || current.value.state === "broken");

  // the numbers are the site's own; only what arrived after "mark as read" is bright, so marking visibly dims the row
  const counts = computed(() =>
    TYPES.filter((type) => current.value.prefs[type].mode !== "off")
      .map((type) => {
        const n = current.value.counts[type] ?? 0;
        const fresh = Math.max(0, n - (current.value.seen?.[type] ?? 0));

        return { type, n, fresh: fresh > 0, icon: ICONS[type], title: t(`types.long.${type}`), hot: fresh > 0 && current.value.prefs[type].mode === "now" };
      })
      .filter((count) => count.n > 0),
  );

  const unread = computed(() => counts.value.some((count) => count.fresh));

  const reason = computed(() => {
    if (current.value.state === "login") return t("problem.login");

    const detail = current.value.error?.detail;

    if (detail && t(`problem.${detail}`) !== `problem.${detail}`) return t(`problem.${detail}`);

    return t(`problem.${current.value.error?.kind === "network" ? "network" : "broken"}`);
  });

  const subtitle = computed(() => {
    if (props.group) return props.problems ? `${t("list.accounts", { n: props.group }, props.group)} · ${t("list.problems", { n: props.problems }, props.problems)}` : t("list.accounts", { n: props.group }, props.group);
    if (problem.value) return reason.value;
    if (current.value.state === "pending") return t("list.pending");

    const when = current.value.lastCheckAt ? whenText(current.value.lastCheckAt, props.now) : "";

    return unread.value ? when : `${t("list.nothingNew")} · ${when}`;
  });

  const label = computed(() => (current.value.label && current.value.label !== props.service.name ? current.value.label : ""));
  const title = computed(() => (label.value ? `${props.service.name} ${label.value}` : props.service.name));
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div class="row" :class="{ 'has-new': account.isNew, broken: account.state === 'broken', nested, group: props.group }">
    <button class="row-main" type="button" :aria-label="`${title}: ${subtitle}`" @click="emit('open')" />

    <ServiceLogo v-if="!nested" :service="service" />

    <span class="grow">
      <strong v-if="nested">{{ label || service.name }}</strong>
      <strong v-else>{{ service.name }}<span v-if="label && !group" class="lab">{{ label }}</span></strong>
      <small>{{ subtitle }}</small>
    </span>

    <span v-if="account.state === 'broken'" class="state bad">{{ t("list.broken") }}</span>
    <span v-else-if="account.state === 'login'" class="state warn">{{ t("list.login") }}</span>

    <span v-else class="counts">
      <span v-if="problems" class="cnt bad" :title="t('list.problems', { n: problems }, problems)"><BaseIcon name="warn" />{{ problems }}</span>

      <span v-for="count in counts" :key="count.type" class="cnt" :class="{ hot: count.hot, seen: !count.fresh }" :title="count.title">
        <BaseIcon :name="count.icon" />{{ count.n }}
      </span>
    </span>

    <span v-if="group" class="chev" :class="{ open: expanded }" aria-hidden="true"><BaseIcon name="chevron" /></span>

    <span v-if="!problem" class="row-acts" :class="{ grouped: group }">
      <button v-if="unread" class="ib" type="button" data-act="read" :aria-label="t('list.markRead')" :title="t('list.markRead')" @click.stop="emit('read')"><BaseIcon name="checks" /></button>
      <button v-if="!group" class="ib" type="button" data-act="cfg" :aria-label="t('list.settings')" :title="t('list.settings')" @click.stop="emit('configure')"><BaseIcon name="gear" /></button>
    </span>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .row-main {
    position: absolute;
    inset: 0;
    border-radius: 0;
  }

  .row-main:focus-visible {
    outline-offset: -2px;
  }

  .grow,
  .counts,
  .state {
    pointer-events: none;
  }

  .grow strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lab {
    color: var(--text);
    font-weight: 400;
    font-size: .8rem;
    margin-left: 6px;
  }

  .row.has-new::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: var(--amber);
  }

  .row.broken {
    background: repeating-linear-gradient(135deg, transparent 0 7px, var(--bad-soft) 7px 8px);
  }

  .counts {
    display: flex;
    gap: 8px;
    flex: none;
  }

  .cnt {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--mono);
    font-size: .8rem;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  .cnt :deep(.ic) {
    width: 14px;
    height: 14px;
  }

  .cnt.hot {
    color: var(--hi);
  }

  .cnt.seen {
    color: var(--muted);
  }

  .cnt.bad {
    color: var(--bad);
  }

  .row.nested {
    min-height: 44px;
    border-top: 1px solid var(--line);
    background: var(--panel-dark);
  }

  .row.nested:hover,
  .row.nested:focus-within {
    background: var(--hover);
  }

  .chev {
    display: inline-flex;
    flex: none;
    color: var(--text);
    pointer-events: none;
    transition: transform .2s var(--ease);
  }

  .chev.open {
    transform: rotate(180deg);
  }

  .row-acts.grouped {
    right: 32px;
  }

  .row-acts {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    padding-left: 16px;
    background: linear-gradient(90deg, transparent, var(--hover) 16px);
    opacity: 0;
    pointer-events: none;
    transition: opacity .15s;
  }

  .row:hover .row-acts,
  .row:focus-within .row-acts {
    opacity: 1;
    pointer-events: auto;
  }

  .row-acts .ib {
    width: 28px;
    height: 28px;
  }

  /* a finger can not hover: the actions stand in the row all the time */
  @media (hover: none) and (pointer: coarse) {
    .row-acts,
    .row-acts.grouped {
      position: relative;
      right: auto;
      top: auto;
      transform: none;
      padding-left: 0;
      background: none;
      opacity: 1;
      pointer-events: auto;
    }

    .row-acts .ib {
      width: 40px;
      height: 40px;
    }
  }
</style>