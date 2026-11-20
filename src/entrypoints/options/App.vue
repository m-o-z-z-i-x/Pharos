<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings page: sections on the left, content on the right, side panels on top -->
<!-- narrower than 720px the sections hide behind a burger button in a top bar and the panels take the whole screen -->
<!-- #section opens a section, #connect=<id>, #login=<id> and #account=<id> open the connect, sign-in and account panels at once -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, onMounted, onUnmounted, ref } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { browser } from "wxt/browser";
  import { appStore } from "@/ui/stores/app.js";
  import BaseIcon from "@/ui/components/BaseIcon.vue";
  import General from "@/ui/options/General.vue";
  import Notifications from "@/ui/options/Notifications.vue";
  import Accounts from "@/ui/options/Accounts.vue";
  import Rules from "@/ui/options/Rules.vue";
  import Log from "@/ui/options/Log.vue";
  import Privacy from "@/ui/options/Privacy.vue";
  import Help from "@/ui/options/Help.vue";
  import AccountView from "@/ui/views/AccountView.vue";
  import ConnectView from "@/ui/views/ConnectView.vue";
  import CatalogView from "@/ui/views/CatalogView.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();

  const SECTIONS = [
    { id: "general", icon: "sliders", comp: General },
    { id: "notif", icon: "bell", comp: Notifications },
    { id: "accounts", icon: "list", comp: Accounts },
    { id: "rules", icon: "file", comp: Rules },
    { id: "log", icon: "refresh", comp: Log },
    { id: "privacy", icon: "shield", comp: Privacy },
    { id: "help", icon: "book", comp: Help },
  ];

  const hashParam = (key) => (location.hash.startsWith(`#${key}=`) ? decodeURIComponent(location.hash.slice(key.length + 2)) : null);

  const fromHash = () => {
    if (hashParam("connect") || hashParam("login") || hashParam("account")) return "accounts";

    return SECTIONS.some((entry) => entry.id === location.hash.slice(1)) ? location.hash.slice(1) : "general";
  };

  const section = ref(fromHash());
  const editing = ref(null);
  const connecting = ref(null);
  const browsing = ref(false);
  const menu = ref(false);
  let timer;

  // COMPUTED
  // ---------------------------------------------------------------------------
  const current = computed(() => SECTIONS.find((entry) => entry.id === section.value));

  // METHODS
  // ---------------------------------------------------------------------------
  // on a narrow screen picking a section also closes the burger menu
  const pick = (id) => {
    section.value = id;
    menu.value = false;
    history.replaceState(null, "", `#${id}`);
  };

  const finishConnect = (configureId) => {
    connecting.value = null;

    history.replaceState(null, "", "#accounts");

    if (configureId) editing.value = configureId;
  }

  const startConnect = (service) => {
    browsing.value = false;
    connecting.value = { service, resume: null };
  }

  const relogin = (account) => {
    editing.value = null;
    connecting.value = { service: app.serviceOf(account.serviceId), resume: account.id };
  }

  // esc closes the top panel: connect first, then account settings, then the catalog
  const onKey = (event) => {
    if (event.key !== "Escape") return;
    if (menu.value) menu.value = false;
    else if (connecting.value) finishConnect();
    else if (editing.value) editing.value = null;
    else browsing.value = false;
  }

  const onStorage = () => app.refresh();

  // HOOKS
  // ---------------------------------------------------------------------------
  onMounted(async () => {
    await app.refresh();

    const serviceId = hashParam("connect");
    const accountId = hashParam("login");

    if (serviceId) connecting.value = { service: app.serviceOf(serviceId), resume: null };

    if (accountId) {
      const account = app.accounts.find((candidate) => candidate.id === accountId);

      if (account) connecting.value = { service: app.serviceOf(account.serviceId), resume: accountId };
    }

    const configureId = hashParam("account");

    // the link is used once: a reload after closing the panel must not open it again
    if (configureId) history.replaceState(null, "", "#accounts");
    if (configureId && app.accounts.some((candidate) => candidate.id === configureId)) editing.value = configureId;

    browser.storage.onChanged.addListener(onStorage);
    window.addEventListener("keydown", onKey);

    timer = setInterval(() => { app.now = Date.now(); }, 30_000);

  });

  onUnmounted(() => { browser.storage.onChanged.removeListener(onStorage); window.removeEventListener("keydown", onKey); clearInterval(timer); });
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div class="opt">
    <nav class="opt-nav" :class="{ open: menu }" :aria-label="t('list.settings')">
      <div class="brand"><span class="mark"><svg viewBox="3 3 18 18"><path d="M6.4 5H10v14H6.4z" fill="currentColor" stroke="none"/><path d="M11 5h2.4a4.2 4.2 0 0 1 0 8.4H11z" fill="var(--amber)" stroke="none"/></svg></span>{{ t("app.name") }}</div>

      <span class="opt-now">{{ t(`opt.nav.${section}`) }}</span>
      <button class="ib opt-burger" type="button" :aria-expanded="String(menu)" aria-controls="opt-links" :aria-label="t('opt.menu')" @click="menu = !menu"><BaseIcon :name="menu ? 'x' : 'list'" /></button>

      <div id="opt-links" class="opt-links">
      <button v-for="entry in SECTIONS" :key="entry.id" type="button" :aria-current="section === entry.id ? 'page' : undefined" @click="pick(entry.id)"><BaseIcon :name="entry.icon" />{{ t(`opt.nav.${entry.id}`) }}</button>
      </div>
    </nav>

    <main :key="section + (app.settings?.lang ?? '')" class="opt-main">
      <div class="opt-title">
        <h2>{{ t(`opt.nav.${section}`) }}</h2>
        <button v-if="section === 'accounts'" class="btn" type="button" @click="browsing = true"><BaseIcon name="plus" />{{ t("list.add") }}</button>
      </div>

      <component :is="current.comp" v-on="section === 'accounts' ? { configure: (id) => (editing = id) } : {}" />
    </main>

    <div v-if="browsing" class="drawer-wrap" @click.self="browsing = false">
      <div class="drawer"><CatalogView @back="browsing = false" @pick="startConnect" /></div>
    </div>

    <div v-if="connecting" class="drawer-wrap" @click.self="finishConnect()">
      <div class="drawer"><ConnectView :service="connecting.service" :resume-account-id="connecting.resume" @back="finishConnect()" @done="finishConnect()" @configure="(id) => finishConnect(id)" /></div>
    </div>

    <div v-if="editing" class="drawer-wrap" @click.self="editing = null">
      <div class="drawer"><AccountView :account-id="editing" @back="editing = null" @login="relogin" /></div>
    </div>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style>
  html {
    scrollbar-gutter: stable;
  }

  body {
    background: var(--bg);
  }

  .opt {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    min-height: 100vh;
    background: var(--panel);
  }

  .opt-nav {
    background: var(--panel-dark);
    border-right: 1px solid var(--line);
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: sticky;
    top: 0;
    align-self: start;
    min-height: 100vh;
  }

  .opt-nav .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 8px 16px;
    color: var(--hi);
    font-weight: 500;
  }

  .opt-nav button {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    text-align: left;
    font-size: .86rem;
    transition: background-color .18s, color .18s, transform .12s;
  }

  .opt-nav button:hover {
    background: var(--hover);
    color: var(--hi);
  }

  .opt-nav button[aria-current='page'] {
    background: var(--btn);
    color: var(--btn-text);
  }

  .opt-main {
    padding: 32px 40px 48px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: fade .2s ease both;
  }

  .opt-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 36px;
  }

  .opt-title h2 {
    font-size: 1.3rem;
  }

  .lead {
    font-size: .86rem;
    max-width: 72ch;
    margin-top: -8px;
  }

  .grid2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .grid2 > .wide {
    grid-column: 1 / -1;
  }

  .pair2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .pair2 > div {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pair2 .lbl {
    color: var(--hi);
    font-size: .84rem;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 20px;
    list-style: decimal;
    font-size: .82rem;
  }

  .steps li::marker {
    color: var(--text);
  }

  .oc {
    padding: 16px 20px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: border-color .2s;
  }

  .oc:hover {
    border-color: var(--border);
  }

  .opt-main > *,
  .grid2 > * {
    animation: rise .36s var(--ease) both;
  }

  .opt-main > :nth-child(2) {
    animation-delay: 40ms;
  }

  .opt-main > :nth-child(3) {
    animation-delay: 80ms;
  }

  .opt-main > :nth-child(n+4) {
    animation-delay: 120ms;
  }

  .grid2 > :nth-child(1) {
    animation-delay: 60ms;
  }

  .grid2 > :nth-child(2) {
    animation-delay: 100ms;
  }

  .grid2 > :nth-child(3) {
    animation-delay: 140ms;
  }

  .grid2 > :nth-child(4) {
    animation-delay: 180ms;
  }

  .grid2 > :nth-child(n+5) {
    animation-delay: 220ms;
  }

  .opt-nav button:active {
    transform: scale(.98);
  }

  .oc h3 {
    font-size: .92rem;
  }

  .oc p {
    font-size: .82rem;
  }

  .row2 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: .84rem;
  }

  label.row2 {
    flex-wrap: nowrap;
    gap: 12px;
    color: var(--hi);
    cursor: pointer;
  }

  .keys {
    display: flex;
    flex-direction: column;
  }

  .keys li {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: center;
    column-gap: 16px;
    min-height: 40px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
    font-size: .84rem;
  }

  .keys li:first-child {
    border-top: 0;
  }

  .keys li > :first-child {
    color: var(--hi);
    white-space: nowrap;
  }

  .keys li > :last-child {
    justify-self: end;
    text-align: right;
    color: var(--text);
  }

  .keys.pairs li {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 2px;
    padding: 12px 0;
  }

  .keys.pairs li > :first-child {
    white-space: normal;
  }

  .keys.pairs li > :last-child {
    justify-self: start;
    text-align: left;
    font-size: .8rem;
  }

  kbd {
    font-family: var(--mono);
    font-size: .75rem;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    color: var(--hi);
    background: var(--card);
  }

  .tblwrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--card);
  }

  .tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: .8rem;
  }

  .tbl th {
    text-align: left;
    font-size: .76rem;
    padding: 8px;
    font-weight: 400;
    color: var(--text);
  }

  .tbl td {
    padding: 8px;
    border-top: 1px solid var(--line);
    vertical-align: middle;
    white-space: nowrap;
  }

  .tbl th:first-child,
  .tbl td:first-child {
    padding-left: 16px;
  }

  .tbl th:last-child,
  .tbl td:last-child {
    padding-right: 12px;
  }

  .tbl td strong {
    color: var(--hi);
    font-weight: 500;
    display: block;
  }

  .tbl td small {
    display: block;
    color: var(--text);
    font-size: .72rem;
  }

  .tbl td.num {
    color: var(--text);
    font-family: var(--font);
    font-variant-numeric: tabular-nums;
  }

  .tbl td.end {
    text-align: right;
  }

  .drawer-wrap {
    position: fixed;
    inset: 0;
    background: var(--line);
    display: flex;
    justify-content: flex-end;
    z-index: 20;
    animation: fade .2s ease both;
  }

  .drawer {
    width: 400px;
    max-width: 100%;
    height: 100%;
    background: var(--panel);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    animation: slide-in .32s var(--ease) both;
  }

  @keyframes slide-in {
    from {
      transform: translateX(32px);
      opacity: 0;
    }

    to {
      transform: none;
      opacity: 1;
    }
  }

  @media (max-width: 960px) {
    .grid2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 560px) {
    .pair2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (hover: none) and (pointer: coarse) {
    .opt-nav button {
      min-height: 40px;
    }
  }

  .opt-links {
    display: contents;
  }

  .opt-nav .opt-now,
  .opt-nav .opt-burger {
    display: none;
  }

  @media (max-width: 720px) {
    .opt {
      grid-template-columns: minmax(0, 1fr);
      align-content: start;
    }

    .opt-nav {
      position: sticky;
      top: 0;
      z-index: 10;
      min-height: 0;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
      padding: 8px max(12px, env(safe-area-inset-right, 0px)) 8px max(12px, env(safe-area-inset-left, 0px));
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }

    .opt-nav .brand {
      padding: 0;
      font-size: 0;
    }

    .opt-nav .opt-now {
      display: block;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--hi);
      font-weight: 500;
    }

    .opt-nav .opt-burger {
      display: grid;
    }

    .opt-links {
      display: none;
      flex: 0 0 100%;
      flex-direction: column;
      gap: 2px;
      padding-top: 8px;
      border-top: 1px solid var(--line);
      animation: rise .2s var(--ease) both;
    }

    .opt-nav.open .opt-links {
      display: flex;
    }

    .opt-links button {
      min-height: 44px;
    }

    .opt-main {
      padding: 24px max(16px, env(safe-area-inset-right, 0px)) max(32px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
    }

    .drawer {
      width: 100%;
      border-left: 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  }
</style>