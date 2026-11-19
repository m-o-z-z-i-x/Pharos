<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- extension popup: the account list, the catalog and account settings replace each other -->
<!-- connecting and signing in open in a settings tab. keys: R — check, Q — quiet mode -->
<!-- on a touch screen the popup fills the screen; from 760px wide the list stays on the left and the other screens open on the right -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { onMounted, onUnmounted, ref } from "vue";
  import { browser } from "wxt/browser";
  import { useI18n } from "@/i18n/vue.js";
  import { appStore } from "@/ui/stores/app.js";
  import ListView from "@/ui/views/ListView.vue";
  import CatalogView from "@/ui/views/CatalogView.vue";
  import AccountView from "@/ui/views/AccountView.vue";
  import ConnectView from "@/ui/views/ConnectView.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const view = ref({ name: "list" });
  const list = ref(null);

  // a wide touch screen (a tablet in firefox for android) keeps the list in sight; a mouse keeps the small popup
  const WIDE = window.matchMedia("(hover: none) and (pointer: coarse) and (min-width: 760px)");
  const wide = ref(WIDE.matches);
  let timer;

  // METHODS
  // ---------------------------------------------------------------------------
  const openView = (name, extra = {}) => { view.value = { name, ...extra }; };

  // signing in again goes through the same connect screen, resuming the account that lost its sign-in
  const relogin = (account) => openView("connect", { service: app.serviceOf(account.serviceId), resume: account.id });

  // letters in both layouts; keys are not intercepted in form fields
  const onKey = (event) => {
    if (view.value.name !== "list" || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? "")) return;

    const key = event.key.toLowerCase();

    if (key === "r" || key === "к") list.value?.checkNow();
    if (key === "q" || key === "й") list.value?.toggleQuiet();
  }

  const onStorage = () => app.refresh();
  const onWide = () => { wide.value = WIDE.matches; };

  // HOOKS
  // ---------------------------------------------------------------------------
  onMounted(async () => {
    await app.refresh();

    timer = setInterval(() => { app.now = Date.now(); }, 1000);

    browser.storage.onChanged.addListener(onStorage);
    window.addEventListener("keydown", onKey);
    WIDE.addEventListener("change", onWide);
  });

  onUnmounted(() => {
    clearInterval(timer);

    browser.storage.onChanged.removeListener(onStorage);
    window.removeEventListener("keydown", onKey);
    WIDE.removeEventListener("change", onWide);
  });
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div v-if="app.st" class="popup" :class="{ wide }">
    <ListView v-if="wide || view.name === 'list'" ref="list" @add="openView('catalog')" @configure="(id) => openView('account', { id })" @login="(account) => relogin(account)" />

    <div v-if="wide || view.name !== 'list'" class="pane">
      <CatalogView v-if="view.name === 'catalog'" @back="openView('list')" @pick="(service) => openView('connect', { service })" />

      <ConnectView v-else-if="view.name === 'connect'" :key="view.service.id + (view.resume ?? '')" :service="view.service" :resume-account-id="view.resume ?? null" @back="openView('list')" @done="openView('list')" @configure="(id) => openView('account', { id })" />

      <AccountView v-else-if="view.name === 'account'" :key="view.id" :account-id="view.id" @back="openView('list')" @login="(account) => relogin(account)" />

      <BaseEmpty v-else icon="gear" :title="t('list.pickTitle')" :text="t('list.pickHint')" />
    </div>

    <div v-if="app.toast" class="toast" role="status">{{ app.toast }}</div>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style>
  body {
    width: 380px;
  }

  .popup {
    height: 600px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--panel);
  }

  .pane {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .pane > .base-empty {
    margin: auto;
  }

  /* firefox for android opens the popup on the whole screen: it takes the screen instead of a 380px column */
  @media (hover: none) and (pointer: coarse) {
    body {
      width: auto;
    }

    .popup {
      height: 100vh;
      height: 100dvh;
    }
  }

  .popup.wide {
    flex-direction: row;
  }

  .popup.wide > .view {
    flex: none;
    width: 380px;
    border-right: 1px solid var(--line);
  }
</style>