<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "data and permissions": what is stored (with explanations), sites with granted access, full wipe -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { onMounted, ref } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { browser } from "wxt/browser";
  import { appStore } from "@/ui/stores/app.js";
  import { displayHost } from "@/ui/hosts.js";
  import BaseHint from "@/ui/components/BaseHint.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const origins = ref([]);
  const confirmWipe = ref(false);
  const message = ref("");
  const STORED = ["services", "tokens", "counts", "journal"];

  // METHODS
  // ---------------------------------------------------------------------------
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
  onMounted(loadOrigins);
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <p class="lead">{{ t("opt.privacy.lead") }}</p>

  <div class="grid2">
    <section class="oc"><h3>{{ t("opt.privacy.stored") }}</h3>
      <ul class="keys pairs">
        <li v-for="key in STORED" :key="key"><span>{{ t(`opt.privacy.${key}`) }}<BaseHint :text="t(`hint.privacy${key[0].toUpperCase()}${key.slice(1)}`)" /></span><span>{{ t(`opt.privacy.${key}Where`) }}</span></li>
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