<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings of one account: connection method, recent checks, interval, mode and sound by type -->
<!-- props: accountId. events: back — go back, login — sign in again (account) -->
<!-- usage: <AccountView :account-id="id" @back="close" @login="relogin" /> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, ref } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { browser } from "wxt/browser";
  import { INTERVALS } from "@/core/model.js";
  import { appStore } from "@/ui/stores/app.js";
  import { reportUrl } from "@/ui/links.js";
  import { hhmm, logText } from "@/ui/format.js";
  import BaseIcon from "@/ui/components/BaseIcon.vue";
  import BaseSegmented from "@/ui/components/BaseSegmented.vue";
  import BaseEmpty from "@/ui/components/BaseEmpty.vue";
  import BaseHint from "@/ui/components/BaseHint.vue";

  // PROPS
  // ---------------------------------------------------------------------------
  const props = defineProps({ accountId: { type: String, required: true } });

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["back", "login"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t, te } = useI18n();
  const app = appStore();
  const ICONS = { dm: "mail", reply: "reply", react: "heart", follow: "user", other: "bell" };
  const confirmRemove = ref(false);

  // COMPUTED
  // ---------------------------------------------------------------------------
  const account = computed(() => app.accounts.find((candidate) => candidate.id === props.accountId));
  const service = computed(() => (account.value ? app.serviceOf(account.value.serviceId) : null));
  const problem = computed(() => account.value && (account.value.state === "login" || account.value.state === "broken"));

  const reason = computed(() => {
    const detail = account.value?.error?.detail;

    if (account.value?.state === "login") return t("problem.login");
    if (detail && te(`problem.${detail}`)) return t(`problem.${detail}`);

    return t(`problem.${account.value?.error?.kind === "network" ? "network" : "broken"}`);
  });

  // METHODS
  // ---------------------------------------------------------------------------
  const setMode = (type, mode) => app.act("setAccount", { id: props.accountId, patch: { prefs: { [type]: { mode } } } });
  const setSound = (type, sound) => app.act("setAccount", { id: props.accountId, patch: { prefs: { [type]: { sound } } } });
  const setCheckInterval = (minutes) => app.act("setAccount", { id: props.accountId, patch: { interval: Number(minutes) } });
  const checkNow = () => app.act("checkNow", { accountId: props.accountId });
  const report = () => browser.tabs.create({ url: reportUrl({ service: service.value, account: account.value, version: browser.runtime.getManifest().version }) });

  // the first press only asks to confirm, the second one disconnects
  const remove = async () => {
    if (!confirmRemove.value) { confirmRemove.value = true; return; }

    await app.act("removeAccount", { id: props.accountId });

    emit("back");
  }
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <section v-if="account && service" class="view">
    <header class="ph">
      <button class="ib back" type="button" :aria-label="t('app.back')" :title="t('app.back')" @click="emit('back')"><BaseIcon name="back" /></button>

      <div class="grow"><h3>{{ service.name }}</h3><small>{{ account.label }}</small></div>

      <button class="ib" type="button" :aria-label="t('list.checkNow')" :title="t('list.checkNow')" @click="checkNow"><BaseIcon name="refresh" /></button>
    </header>

    <div class="pb">
      <div v-if="problem" class="rulebox bad"><BaseIcon name="warn" /><span>{{ reason }}. <button v-if="account.state === 'login'" class="linkbtn" type="button" @click="emit('login', account)">{{ t("account.relogin") }}</button></span></div>

      <dl class="facts">
        <div class="fact"><dt>{{ t("account.connection") }}</dt><dd>{{ t(`methods.${service.method}`) }}<small>{{ service.api ? t("account.apiNote") : t("account.webNote") }}</small></dd></div>
        <div class="fact"><dt>{{ t("account.reliability") }}<BaseHint :text="t('hint.reliability')" /></dt><dd>{{ service.api ? t("account.stable") : t("account.fragile") }}</dd></div>
        <div class="fact"><dt>{{ t("account.risk") }}<BaseHint :text="t('hint.risk')" /></dt><dd>{{ service.api ? t("account.riskLow") : t("account.riskWeb") }}</dd></div>
        <div v-if="service.version" class="fact"><dt>{{ t("account.rule") }}</dt><dd class="num">v{{ service.version }}</dd></div>
      </dl>

      <div class="lbl">{{ t("account.lastChecks") }}</div>

      <ul v-if="account.log.length" class="facts log">
        <li v-for="entry in account.log.slice(0, 3)" :key="entry.at"><span class="st" :class="entry.ok ? 'ok' : 'bad'"><BaseIcon :name="entry.ok ? 'check' : 'x'" /></span><span class="txt">{{ logText(entry) }}</span><time>{{ hhmm(entry.at) }}</time></li>
      </ul>

      <BaseEmpty v-else icon="refresh" :title="t('account.noChecks')" compact />

      <div class="kv"><label for="interval">{{ t("account.interval") }}<BaseHint :text="t('hint.interval')" /></label>
        <select id="interval" class="in narrow" :value="account.interval" @change="setCheckInterval($event.target.value)">
          <option v-for="minutes in INTERVALS" :key="minutes" :value="minutes">{{ t("account.minutes", { n: minutes }) }}</option>
        </select>
      </div>

      <p v-if="!service.api && account.interval < 5" class="hint warn">{{ t("account.intervalWarn") }}</p>

      <div class="lbl">{{ t("account.what") }}<BaseHint :text="t('hint.modes')" /></div>

      <div class="facts">
        <div v-for="type in service.types" :key="type" class="trow">
          <div class="t1"><BaseIcon :name="ICONS[type]" />{{ t(`types.long.${type}`) }}</div>

          <div class="t2">
            <BaseSegmented stretch :aria-label="t(`types.long.${type}`)" :items="['now', 'digest', 'off'].map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))" :value="account.prefs[type].mode" @pick="(mode) => setMode(type, mode)" />
            <label class="snd"><BaseIcon name="sound" /><input class="sw" type="checkbox" :checked="account.prefs[type].sound" :disabled="account.prefs[type].mode !== 'now'" :aria-label="t('account.sound')" @change="setSound(type, $event.target.checked)"></label>
          </div>
        </div>
      </div>

      <div class="pair">
        <button class="btn ghost" type="button" @click="report"><BaseIcon name="flag" />{{ t("account.report") }}</button>
        <button class="btn ghost" :class="{ danger: confirmRemove }" type="button" @click="remove">{{ confirmRemove ? t("account.removeConfirm") : t("account.remove") }}</button>
      </div>
    </div>
  </section>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .narrow {
    width: auto;
    min-height: 32px;
  }

  .hi {
    color: var(--hi);
    font-size: .8rem;
  }

  .warn {
    color: var(--amber);
    margin-top: -4px;
  }

  .trow {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid var(--line);
  }

  .trow:first-child {
    border-top: 0;
  }

  .t1 {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--hi);
    font-size: .86rem;
  }

  .t2 {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .snd {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .pair {
    display: flex;
    gap: 8px;
  }

  .pair .btn {
    flex: 1;
  }
</style>