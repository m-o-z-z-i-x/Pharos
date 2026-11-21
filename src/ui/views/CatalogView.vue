<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- service catalog by groups with search, each group from a to z -->
<!-- events: back — go back, pick — a service is chosen (its description) -->
<!-- usage: <CatalogView @back="close" @pick="startConnect" /> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, ref } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { appStore } from "@/ui/stores/app.js";
  import { MAX_ACCOUNTS } from "@/core/model.js";
  import { byName } from "@/ui/format.js";
  import BaseIcon from "@/ui/components/BaseIcon.vue";
  import ServiceLogo from "@/ui/components/ServiceLogo.vue";
  import BaseHint from "@/ui/components/BaseHint.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["back", "pick"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const query = ref("");
  const ORDER = ["messengers", "social", "mail", "dev", "other"];
  // services people look for but the extension can not check honestly; shown with the reason instead of silence
  // services whose counters look reachable and are being added; shown so people know they are coming
  const PLANNED = [
    { id: "vk", name: "ВКонтакте", mono: "Вк" },
    { id: "mailru", name: "Почта Mail.ru", mono: "@" },
    { id: "outlook", name: "Outlook.com", mono: "Ol" },
    { id: "stackoverflow", name: "Stack Overflow", mono: "So" },
  ];

  const UNAVAILABLE = [
    { id: "discord", name: "Discord", mono: "Dc" },
    { id: "telegram", name: "Telegram", mono: "Tg" },
  ];

  // COMPUTED
  // ---------------------------------------------------------------------------
  const groups = computed(() => {
    const needle = query.value.trim().toLowerCase();
    const count = (service) => app.accounts.filter((account) => account.serviceId === service.id).length;

    return ORDER.map((group) => ({
      group,

      items: app.services
        .filter((service) => service.group === group && (!needle || service.name.toLowerCase().includes(needle)))
        .map((service) => ({ ...service, added: count(service) > 0, count: count(service) }))
        .sort((first, second) => byName(first.name, second.name)),
    })).filter((section) => section.items.length);
  });

  const matches = (service) => {
    const needle = query.value.trim().toLowerCase();

    return !needle || service.name.toLowerCase().includes(needle) || service.id.includes(needle);
  };

  const planned = computed(() => PLANNED.filter(matches).sort((first, second) => byName(first.name, second.name)));

  const unavailable = computed(() => UNAVAILABLE.filter(matches).sort((first, second) => byName(first.name, second.name)));
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <section class="view">
    <header class="ph">
      <button class="ib back" type="button" :aria-label="t('app.back')" :title="t('app.back')" @click="emit('back')"><BaseIcon name="back" /></button>
      <div class="grow"><h3>{{ t("catalog.title") }}</h3><small>{{ t("catalog.sub") }}</small></div>
    </header>

    <div class="pb">
      <div class="search"><BaseIcon name="search" /><input v-model="query" class="in" :placeholder="t('catalog.search')" :aria-label="t('catalog.search')"></div>

      <div class="banner legend"><span class="legend-line"><span class="dot api" /><span>{{ t("catalog.api") }}</span></span><span class="legend-line"><span class="dot web" /><span>{{ t("catalog.web") }}</span></span></div>

      <template v-for="section in groups" :key="section.group">
        <div class="group-t">{{ t(`groups.${section.group}`) }}</div>

        <div class="list">
          <div v-for="service in section.items" :key="service.id" class="row">
            <ServiceLogo :service="service" />

            <span class="grow"><strong>{{ service.name }}</strong><span class="meta"><span class="dot" :class="service.api ? 'api' : 'web'" />{{ t(`methods.${service.method}`) }}</span></span>

            <button v-if="!service.added" class="btn sm" type="button" @click="emit('pick', service)">{{ t("catalog.add") }}</button>
            <button v-else-if="service.multi && service.count < MAX_ACCOUNTS" class="btn sm ghost" type="button" @click="emit('pick', service)">{{ t("catalog.more") }} · {{ service.count }}/{{ MAX_ACCOUNTS }}</button>

            <template v-else>
              <BaseHint v-if="!service.multi" :text="t('hint.single')" />
              <span class="state good">{{ service.multi ? t("catalog.full", { n: MAX_ACCOUNTS }) : t("catalog.added") }}</span>
            </template>
          </div>
        </div>
      </template>

      <template v-if="planned.length">
        <div class="group-t">{{ t("catalog.planned") }}</div>

        <div class="list">
          <div v-for="service in planned" :key="service.id" class="row off">
            <ServiceLogo :service="service" />

            <span class="grow"><strong>{{ service.name }}</strong><span class="meta">{{ t("catalog.plannedNote") }}</span></span>

            <span class="state">{{ t("catalog.plannedChip") }}</span>
          </div>
        </div>
      </template>

      <template v-if="unavailable.length">
        <div class="group-t">{{ t("catalog.unavailable") }}</div>

        <div class="list">
          <div v-for="service in unavailable" :key="service.id" class="row off">
            <ServiceLogo :service="service" />

            <span class="grow"><strong>{{ service.name }}</strong><span class="meta">{{ t(`catalog.why.${service.id}`) }}</span></span>

            <BaseHint :text="t(`hint.${service.id}`)" />

            <span class="state warn">{{ t("catalog.soon") }}</span>
          </div>
        </div>
      </template>

      <BaseEmpty v-if="!groups.length && !planned.length && !unavailable.length" icon="search" :title="t('catalog.notFound')" compact />
    </div>
  </section>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .row.off .grow {
    opacity: .7;
  }

  .row.off .hint-tip {
    margin-right: 4px;
  }

  .search {
    position: relative;
  }

  .search :deep(.ic) {
    position: absolute;
    left: 12px;
    top: 10px;
  }

  .search .in {
    padding-left: 36px;
  }

  .legend {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .group-t {
    font-size: .78rem;
    color: var(--text);
    padding: 4px 4px 0;
  }

  .meta {
    display: flex;
    margin-top: 2px;
  }
</style>