<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "rules": catalog version and signature, manual update check -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, onMounted, ref } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { appStore } from "@/ui/stores/app.js";
  import { send } from "@/messaging.js";
  import { whenText } from "@/ui/format.js";
  import { REPO_URL } from "@/ui/links.js";
  import BaseIcon from "@/ui/components/BaseIcon.vue";
  import ServiceLogo from "@/ui/components/ServiceLogo.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const busy = ref(false);
  const rules = ref(null);
  const shown = ref(new Set());

  // COMPUTED
  // ---------------------------------------------------------------------------
  const catalog = computed(() => app.st?.catalog);

  // METHODS
  // ---------------------------------------------------------------------------
  const loadRules = async () => {
    const response = await send("getRules");

    rules.value = response?.rules ?? [];
  }

  const reload = async () => {
    busy.value = true;

    await app.act("reloadCatalog");
    await loadRules();

    busy.value = false;
  }

  // host and path are shown, the query is cut: it can be long and carries nothing to read
  const toggle = (id) => {
    const next = new Set(shown.value);

    if (!next.delete(id)) next.add(id);
    shown.value = next;
  }

  const hostOf = (url) => { try { const parsed = new URL(url); return parsed.host + parsed.pathname.replace(/[/]$/, ""); } catch { return url; } };

  // where a counter comes from: a json path, a regex over the answer or a tag
  const describeExtractor = (extractor) => (Array.isArray(extractor.json) ? extractor.json.join(" + ") : extractor.json ?? extractor.regex ?? extractor.xml ?? extractor.css ?? extractor.unreadChats ?? "");

  // headers with a value that is not plain text come from a cookie or from an earlier answer
  const specials = (request) => Object.entries(request.headers ?? {}).filter(([, header]) => typeof header === "object").map(([name, header]) => `${name}: ${header.cookie ? t("opt.rules.cookie", { name: header.cookie }) : t("opt.rules.uses", { what: header.from })}`);

  // the source is the real text of the rule, so what the user reads is what the extension runs
  const pretty = (rule) => JSON.stringify(rule, null, 2);

  // HOOKS
  // ---------------------------------------------------------------------------
  onMounted(loadRules);
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <p class="lead">{{ t("opt.rules.lead") }}</p>

  <div class="grid2">
    <section class="oc"><h3>{{ t("opt.rules.catalog") }}</h3>
      <div v-if="catalog" class="rulebox" :class="{ bad: !catalog.verified }"><BaseIcon :name="catalog.verified ? 'check' : 'warn'" />
        <span>{{ t("opt.rules.version", { v: catalog.version }) }} · {{ t(`opt.rules.${catalog.source}`) }} · {{ catalog.verified ? t("opt.rules.verified") : t("opt.rules.notVerified") }}</span>
      </div>

      <p>{{ catalog?.checkedAt ? t("opt.rules.checked", { when: whenText(catalog.checkedAt, app.now) }) : t("opt.rules.never") }}</p>

      <div class="row2"><button class="btn ghost" type="button" :disabled="busy" @click="reload"><BaseIcon name="refresh" />{{ t("opt.rules.checkNow") }}</button></div>
    </section>

    <section class="oc"><h3>{{ t("opt.rules.own") }}</h3><p>{{ t("opt.rules.ownSub") }}</p>
      <div class="row2"><a class="btn ghost" :href="REPO_URL" target="_blank" rel="noopener">{{ t("opt.rules.propose") }}</a></div>
    </section>

    <section class="oc wide"><h3>{{ t("opt.rules.list") }}<span v-if="rules" class="n">{{ rules.length }}</span></h3>
      <p>{{ t("opt.rules.listSub") }}</p>
      <p v-if="!rules" class="hint">{{ t("opt.rules.loading") }}</p>

      <div v-else class="rules">
        <details v-for="rule in rules" :key="rule.id" class="rule">
          <summary>
            <ServiceLogo :service="{ id: rule.id, name: rule.name, mono: rule.mono }" size="sm" />

            <span class="nm"><strong>{{ rule.name }}</strong><small>{{ rule.hosts.join(", ") }}</small></span>
            <span class="ver">{{ t("opt.rules.version", { v: rule.version }) }}</span>
          </summary>

          <div class="body">
            <div class="blk"><span class="lbl">{{ t("opt.rules.requests") }}</span>
              <ul>
                <li v-for="request in rule.requests" :key="request.key"><code>{{ request.method ?? (request.form || request.json !== undefined ? "POST" : "GET") }}</code> {{ hostOf(request.url) }}<span v-if="request.origin" class="mute"> · Origin</span>
                  <small v-for="header in specials(request)" :key="header" class="mute">{{ header }}</small>
                </li>
              </ul>
            </div>

            <div class="blk"><span class="lbl">{{ t("opt.rules.reads") }}</span>
              <ul>
                <li v-for="(extractor, type) in rule.map" :key="type"><strong>{{ t(`opt.rules.kinds.${type}`) }}</strong><code class="path">{{ describeExtractor(extractor) }}</code></li>
              </ul>
            </div>

            <div class="src">
              <button class="btn ghost sm" type="button" :aria-expanded="String(shown.has(rule.id))" @click="toggle(rule.id)">{{ shown.has(rule.id) ? t("opt.rules.hideJson") : t("opt.rules.showJson") }}</button>
              <Transition name="src"><pre v-if="shown.has(rule.id)">{{ pretty(rule) }}</pre></Transition>
            </div>
          </div>
        </details>
      </div>
    </section>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .n {
    margin-left: 8px;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--panel-dark);
    color: var(--text);
    font-size: .72rem;
    font-weight: 400;
    vertical-align: 1px;
  }

  .rules {
    border-radius: 10px;
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .rule {
    border-top: 1px solid var(--line);
  }

  .rule:first-child {
    border-top: 0;
  }

  .rule > summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    cursor: pointer;
    list-style: none;
    transition: background-color .18s;
  }

  .rule > summary::-webkit-details-marker {
    display: none;
  }

  .rule > summary:hover {
    background: var(--hover);
  }

  .rule > summary:focus-visible {
    outline: 2px solid var(--border);
    outline-offset: -2px;
  }

  .rule > summary::after {
    content: "";
    flex: none;
    width: 7px;
    height: 7px;
    margin-left: 4px;
    border-right: 1.5px solid var(--text);
    border-bottom: 1.5px solid var(--text);
    transform: rotate(45deg);
    transition: transform .2s var(--ease), border-color .18s;
  }

  .rule[open] > summary::after {
    transform: rotate(-135deg) translate(-2px, -2px);
    border-color: var(--hi);
  }

  .nm {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
  }

  .nm strong {
    color: var(--hi);
    font-size: .86rem;
    font-weight: 500;
  }

  .nm small {
    color: var(--text);
    font-size: .74rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ver {
    flex: none;
    color: var(--text);
    font-size: .74rem;
    font-variant-numeric: tabular-nums;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 14px 16px 54px;
    animation: rise .26s var(--ease) both;
  }

  .blk {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .blk ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: .8rem;
  }

  .blk li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    color: var(--hi);
  }

  .blk li strong {
    min-width: 86px;
    font-weight: 400;
  }

  code {
    font-family: var(--mono);
    font-size: .74rem;
    color: var(--text);
  }

  code.path {
    overflow-wrap: anywhere;
  }

  .mute {
    color: var(--text);
    font-size: .74rem;
  }

  .src {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .src-enter-active {
    transition: opacity .22s ease, transform .22s var(--ease);
  }

  .src-enter-from {
    opacity: 0;
    transform: translateY(-4px);
  }

  .src pre {
    align-self: stretch;
    max-height: 280px;
    overflow: auto;
    padding: 12px;
    border-radius: 8px;
    background: var(--panel-dark);
    border: 1px solid var(--line);
    font-family: var(--mono);
    font-size: .72rem;
    line-height: 1.5;
    color: var(--text);
    scrollbar-width: thin;
  }

  @media (max-width: 720px) {
    .body {
      padding-left: 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rule > summary::after,
    .body {
      transition: none;
      animation: none;
    }
  }
</style>