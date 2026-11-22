<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "data and permissions": every stored part apart with its json behind a button (secrets by size only), sites with granted access, full wipe -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, onMounted, ref, watch } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { browser } from "wxt/browser";
  import { appStore } from "@/ui/stores/app.js";
  import { send } from "@/messaging.js";
  import { displayHost } from "@/ui/hosts.js";
  import { byServiceName } from "@/ui/format.js";
  import BaseHint from "@/ui/components/BaseHint.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const origins = ref([]);
  const confirmWipe = ref(false);
  const message = ref("");
  // the stored parts as the background shows them: { bytes, accounts: [{ id, serviceId, label, bytes, json }], parts: [{ key, bytes, json }] }; null while loading
  const stored = ref(null);
  // ids of the parts whose json is open
  const open = ref(new Set());
  const KNOWN = ["settings", "digest", "catalogCache"];

  // COMPUTED
  // ---------------------------------------------------------------------------
  const accounts = computed(() => [...(stored.value?.accounts ?? [])].sort(byServiceName((account) => app.serviceOf(account.serviceId).name)));
  const parts = computed(() => [...(stored.value?.parts ?? [])].sort((first, second) => rank(first.key) - rank(second.key)));

  // WATCHERS
  // ---------------------------------------------------------------------------
  // every check writes to the storage: the shown data follows it
  watch(() => app.st, () => loadStored());

  // METHODS
  // ---------------------------------------------------------------------------
  const size = (bytes = 0) => (bytes < 1024 ? t("opt.privacy.bytes", { n: bytes }) : t("opt.privacy.kilobytes", { n: (bytes / 1024).toFixed(1) }));
  const rank = (key) => (KNOWN.includes(key) ? KNOWN.indexOf(key) : KNOWN.length);
  // a key the section does not know yet is shown by its own name rather than hidden
  const partName = (key) => (KNOWN.includes(key) ? t(`opt.privacy.parts.${key}`) : key);
  const partSub = (key) => (KNOWN.includes(key) ? t(`opt.privacy.parts.${key}Sub`) : "");

  const toggle = (id) => {
    const next = new Set(open.value);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    open.value = next;
  }

  const loadStored = async () => {
    const answer = await send("storedData");

    stored.value = answer?.ok ? answer : { bytes: 0, accounts: [], parts: [] };
  }

  // <all_urls> is only the declared optional permission, not granted access
  const loadOrigins = async () => {
    try {
      const all = await browser.permissions.getAll();

      origins.value = (all.origins ?? []).filter((origin) => origin !== "<all_urls>");
    } catch {
      origins.value = [];
    }
  }

  const revoke = async (origin) => {
    await browser.permissions.remove({ origins: [origin] }).catch(() => false);

    message.value = t("opt.privacy.revoked");

    await loadOrigins();
  }

  // the first press only asks to confirm, the second one wipes
  const wipe = async () => {
    if (!confirmWipe.value) { confirmWipe.value = true; return; }

    await app.act("wipe", {});

    confirmWipe.value = false;
    message.value = t("opt.privacy.wiped");

    await loadOrigins();
  }

  // HOOKS
  // ---------------------------------------------------------------------------
  onMounted(() => { loadOrigins(); loadStored(); });
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <p class="lead">{{ t("opt.privacy.lead") }}</p>

  <div class="grid2">
    <section class="oc"><h3>{{ t("opt.privacy.stored") }}<BaseHint :text="t('hint.privacyStored')" /></h3>
      <p>{{ stored ? t("opt.privacy.storedSub", { size: size(stored.bytes) }) : t("opt.privacy.loading") }}</p>

      <ul v-if="stored" class="parts">
        <li v-for="part in parts" :key="part.key">
          <span class="nm">{{ partName(part.key) }}<small v-if="partSub(part.key)">{{ partSub(part.key) }}</small></span>
          <span class="sz">{{ size(part.bytes) }}</span>
          <button class="btn sm ghost" type="button" :aria-expanded="String(open.has(part.key))" @click="toggle(part.key)">{{ open.has(part.key) ? t("opt.privacy.hideJson") : t("opt.privacy.showJson") }}</button>
          <pre v-if="open.has(part.key)" class="json">{{ part.json }}</pre>
        </li>
      </ul>

      <div v-if="accounts.length" class="sub">{{ t("opt.privacy.parts.accounts", { n: accounts.length }, accounts.length) }}</div>

      <ul v-if="accounts.length" class="parts">
        <li v-for="account in accounts" :key="account.id">
          <span class="nm">{{ app.serviceOf(account.serviceId).name }}<small>{{ account.label }}</small></span>
          <span class="sz">{{ size(account.bytes) }}</span>
          <button class="btn sm ghost" type="button" :aria-expanded="String(open.has(account.id))" @click="toggle(account.id)">{{ open.has(account.id) ? t("opt.privacy.hideJson") : t("opt.privacy.showJson") }}</button>
          <pre v-if="open.has(account.id)" class="json">{{ account.json }}</pre>
        </li>
      </ul>

      <div class="row2"><button class="btn" :class="{ danger: confirmWipe }" type="button" data-act="wipe" @click="wipe">{{ confirmWipe ? t("opt.privacy.wipeConfirm") : t("opt.privacy.wipe") }}</button><BaseHint :text="t('hint.privacyWipe')" /></div>
    </section>

    <section class="oc"><h3>{{ t("opt.privacy.access") }}<BaseHint :text="t('hint.privacyAccess')" /></h3>
      <ul v-if="origins.length" class="keys">
        <li v-for="origin in origins" :key="origin"><span>{{ displayHost(origin) }}</span><button class="btn sm ghost" type="button" @click="revoke(origin)">{{ t("opt.privacy.revoke") }}</button></li>
      </ul>

      <BaseEmpty v-else icon="shield" :title="t('opt.privacy.noAccess')" compact />

      <p v-if="message" class="hint" role="status">{{ message }}</p>
    </section>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .parts {
    display: flex;
    flex-direction: column;
  }

  .parts li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }

  .parts li:first-child {
    border-top: 0;
  }

  .parts .nm {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    font-size: .84rem;
    color: var(--hi);
  }

  .parts .nm small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: .76rem;
    color: var(--text);
  }

  .parts .sz {
    font-family: var(--mono);
    font-size: .76rem;
    color: var(--text);
  }

  .sub {
    margin-top: 4px;
    font-size: .78rem;
    color: var(--text);
  }

  .json {
    flex: 0 0 100%;
    max-width: 100%;
    max-height: 320px;
    overflow: auto;
    padding: 12px;
    border-radius: 8px;
    background: var(--panel-dark);
    border: 1px solid var(--line);
    font-family: var(--mono);
    font-size: .72rem;
    line-height: 1.5;
    color: var(--text);
    white-space: pre;
    scrollbar-width: thin;
  }
</style>