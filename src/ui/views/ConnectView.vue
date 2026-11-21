<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- connecting a service step by step: site access → which account of the browser, or the data → check or sign-in → done -->
<!-- props: service (its description), resumeAccountId (continue signing in an existing account) -->
<!-- events: back — go back, done — finished, configure — open settings of the new account (id) -->
<!-- works in the popup and in the settings panel; if the browser closes the popup at the permission prompt, the background finishes the connect and notifies -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { browser } from "wxt/browser";
  import { appStore } from "@/ui/stores/app.js";
  import { send } from "@/messaging.js";
  import { hostsFor, displayHost } from "@/ui/hosts.js";
  import BaseIcon from "@/ui/components/BaseIcon.vue";

  // PROPS
  // ---------------------------------------------------------------------------
  const props = defineProps({ service: { type: Object, required: true }, resumeAccountId: { type: String, default: null } });

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["back", "done", "configure"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t, te } = useI18n();
  const app = appStore();
  const fields = props.service.fields ?? [];
  const connected = app.accounts.filter((account) => account.serviceId === props.service.id).length;
  // a numbered field is the n-th account of the browser (the n-th mailbox of google)
  const numbered = (field) => props.service.multi && /^\d+$/.test(String(field.default ?? ""));
  // such a service starts with a choice among the accounts of the browser, also for the very first one
  const choiceField = fields.find(numbered) ?? null;
  const input = reactive(Object.fromEntries(fields.map((field) => [field.key, field.default ?? ""])));
  const needsForm = fields.some((field) => field.required);
  // the accounts the browser is signed in to, offered by their address instead of a number; null while searching
  const choices = ref(choiceField ? null : []);
  // the site did not answer the search: the window says so instead of falling back to a bare number field
  const choicesFailed = ref(false);
  // the access is checked first: the accounts can only be listed with it, and an allowed site skips the access screen
  const step = ref(props.resumeAccountId ? "login" : choiceField || !needsForm ? "checking" : "form");
  const accountId = ref(props.resumeAccountId);
  const error = ref("");
  const denied = ref(false);
  let poll;

  // COMPUTED
  // ---------------------------------------------------------------------------
  const origins = computed(() => hostsFor(props.service, input));
  const hostText = computed(() => [...new Set(origins.value.map(displayHost))].join(", "));
  const picking = computed(() => Boolean(choices.value?.length));
  const pickFree = computed(() => choices.value?.some((choice) => !choice.connected) ?? false);
  const formOk = computed(() => (props.service.fields ?? []).every((field) => {
    if (picking.value && numbered(field)) return choices.value.some((choice) => choice.value === input[field.key] && !choice.connected);

    return !field.required || String(input[field.key]).trim();
  }));
  const stepIndex = computed(() => ({ form: 1, perm: 1, checking: 2, login: 2, waiting: 2, error: 2, done: 3 })[step.value]);
  const doneAccount = computed(() => app.accounts.find((account) => account.id === accountId.value));

  // login and network are codes in both problem and connect.errors: connecting takes connect.errors
  const errorText = computed(() => {
    const code = error.value;

    if (!code) return "";
    if (code === "duplicate" && (props.service.fields ?? []).some(numbered)) return t("connect.errors.duplicateSlot");
    if (te(`problem.${code}`) && code !== "login" && code !== "network") return t(`problem.${code}`);
    if (te(`connect.errors.${code}`)) return t(`connect.errors.${code}`);

    return code;
  });

  // WATCHERS
  // ---------------------------------------------------------------------------
  // the background finishes the sign-in on its own; the window only watches the account
  watch(
    () => app.accounts.find((account) => account.id === accountId.value),

    (account) => {
      if (step.value !== "waiting") return;
      if (!account) { error.value = "duplicate"; step.value = "error"; return; }

      if (account.state === "ok") step.value = "done";
      else if (!account.awaitingLogin) { error.value = account.error?.kind === "login" || !account.error ? t("connect.timeout") : account.error.kind; step.value = "error"; }
    },
  );

  watch(step, (value) => {
    clearInterval(poll);
    if (value === "waiting") poll = setInterval(() => app.refresh(), 2000);
  });

  // METHODS
  // ---------------------------------------------------------------------------
  // while the search runs the question is already the choice, so the number field never flashes
  const fieldLabel = (field) => (numbered(field) && (choices.value === null || picking.value || choicesFailed.value) ? t("connect.pick") : t(`fields.${field.key}`));

  // a mailbox the site has not opened yet is still offered: connecting it opens the sign-in page and finishes by itself
  const choiceNote = (choice) => (choice.connected ? t("connect.pickConnected") : choice.label ? "" : t("connect.pickClosed"));

  const loadChoices = async () => {
    choices.value = null;
    choicesFailed.value = false;

    // the first request after the browser starts often times out, so one failure is asked again at once
    let answer = await send("listAccounts", { serviceId: props.service.id });

    if (!answer?.ok) answer = await send("listAccounts", { serviceId: props.service.id });

    choicesFailed.value = !answer?.ok;
    choices.value = answer?.accounts ?? [];

    const free = choices.value.find((choice) => !choice.connected && choice.label) ?? choices.value.find((choice) => !choice.connected);

    // nothing found: the number field stays, starting after the accounts already connected
    input[choiceField.key] = free ? free.value : String(connected);
  };

  const fieldHint = (field) => (te(`fields.${field.key}Hint`) ? t(`fields.${field.key}Hint`) : "");

  // the list of the browser's accounts; a single free one leaves nothing to choose and is connected at once
  const choose = async () => {
    step.value = "form";
    await loadChoices();

    if (choices.value.length === 1 && !choices.value[0].connected) await connectNow();
  };

  const afterAccess = () => (choiceField ? choose() : connectNow());

  // the access screen is only for sites the browser has not allowed yet
  const toAccess = async () => {
    let allowed = false;

    try {
      allowed = await browser.permissions.contains({ origins: [...origins.value] });
    } catch (thrown) {
      console.error("permissions.contains failed", thrown);
    }

    if (allowed) await afterAccess();
    else step.value = "perm";
  };

  const submit = () => {
    if (!formOk.value) return;

    if (choiceField) connectNow();
    else toAccess();
  };

  const retry = () => {
    if (choiceField) choose();
    else if (needsForm) step.value = "form";
    else toAccess();
  };

  // permissions are requested first in the click: after an await the browser no longer sees a user gesture
  const allow = async () => {
    denied.value = false;

    // the browser may close the popup while it asks for the permission: the background keeps what was typed
    // and finishes the connect by itself; not awaited, so the permission request still runs inside the click
    // a choice of an account can not be made by the background: it opens the settings for it instead
    send("queueConnect", { serviceId: props.service.id, input: { ...input }, pick: Boolean(choiceField) });

    let granted = false;

    try {
      granted = await browser.permissions.request({ origins: [...origins.value] });
    } catch (thrown) {
      console.error("permissions.request failed", thrown);
    }

    if (!granted) { denied.value = true; return; }

    // the window is still here and goes on with the choice itself
    if (choiceField) send("dropQueued");

    await afterAccess();
  }

  const connectNow = async () => {
    step.value = "checking";
    const result = await app.act("connect", { serviceId: props.service.id, input: { ...input } });

    accountId.value = result.accountId ?? null;

    if (result.status === "ok") step.value = "done";
    else if (result.status === "login-required") step.value = "login";
    else { error.value = (result.detail && te(`problem.${result.detail}`) ? result.detail : result.error) || "rule"; step.value = "error"; }
  }

  const openLogin = async () => {
    const result = await app.act("awaitLogin", { accountId: accountId.value });

    if (result.status === "waiting") step.value = "waiting";
    else { error.value = result.error ?? ""; step.value = "error"; }
  }

  // a new account is added on the site itself; the list is searched again when the person is back
  const addAccount = () => browser.tabs.create({ url: props.service.addAccountUrl });

  // HOOKS
  // ---------------------------------------------------------------------------
  onMounted(() => {
    if (step.value === "checking") toAccess();
  });
  onUnmounted(() => clearInterval(poll));
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <section class="view">
    <header class="ph">
      <button class="ib back" type="button" :aria-label="t('app.back')" :title="t('app.back')" @click="emit('back')"><BaseIcon name="back" /></button>
      <div class="grow"><h3>{{ service.name }}</h3><small>{{ t(`methods.${service.method}`) }}</small></div>
    </header>

    <div class="pb">
      <div class="stepbar">
        <div class="steps"><i v-for="number in 3" :key="number" :class="{ on: number <= stepIndex }" /></div>
        <div class="steplbl"><span :class="{ on: stepIndex === 1 }">{{ t("connect.steps.access") }}</span><span :class="{ on: stepIndex === 2 }">{{ t("connect.steps.login") }}</span><span :class="{ on: stepIndex === 3 }">{{ t("connect.steps.done") }}</span></div>
      </div>

      <form v-if="step === 'form'" class="col" @submit.prevent="submit">
        <div v-for="field in service.fields" :key="field.key" class="field">
          <label class="lbl" :for="`f-${field.key}`">{{ fieldLabel(field) }}</label>
          <p v-if="numbered(field) && choices === null" class="hint">{{ t("connect.pickSearching") }}</p>

          <template v-else-if="numbered(field) && choicesFailed">
            <p class="hint warnline">{{ t("connect.pickFailed", { name: service.name }) }}</p>

            <div class="row2"><button class="btn sm ghost" type="button" data-act="refresh-accounts" @click="loadChoices">{{ t("connect.pickRefresh") }}</button></div>
          </template>

          <template v-else-if="numbered(field) && picking">
            <div :id="`f-${field.key}`" class="pick" role="radiogroup">
              <button v-for="choice in choices" :key="choice.value" type="button" role="radio" class="pick-item" :aria-checked="String(input[field.key] === choice.value)" :disabled="choice.connected" @click="input[field.key] = choice.value">
                <strong>{{ choice.label ?? t("connect.pickUnknown", { n: Number(choice.value) + 1 }) }}</strong>
                <small v-if="choiceNote(choice)">{{ choiceNote(choice) }}</small>
              </button>
            </div>

            <p v-if="!pickFree" class="hint">{{ t("connect.pickAllConnected") }}</p>

            <div class="row2">
              <button v-if="service.addAccountUrl" class="btn sm" type="button" data-act="add-account" @click="addAccount">{{ t("connect.pickAdd") }}</button>
              <button class="btn sm ghost" type="button" data-act="refresh-accounts" @click="loadChoices">{{ t("connect.pickRefresh") }}</button>
            </div>
          </template>

          <template v-else>
            <input :id="`f-${field.key}`" v-model="input[field.key]" class="in" :type="field.kind === 'password' ? 'password' : 'text'" autocomplete="off" spellcheck="false">

            <p v-if="fieldHint(field)" class="hint">{{ fieldHint(field) }}</p>
          </template>
        </div>

        <button v-if="!(choiceField && (choices === null || choicesFailed))" class="btn block" type="submit" data-act="next" :disabled="!formOk">{{ t("connect.next") }}</button>
      </form>

      <div v-else-if="step === 'perm'" class="center">
        <div class="big"><BaseIcon name="lock" /></div>

        <h4>{{ t("connect.permTitle", { host: hostText }) }}</h4>

        <ul class="perm">
          <li class="yes"><BaseIcon name="check" /><span>{{ t("connect.can1") }}</span></li>
          <li class="yes"><BaseIcon name="check" /><span>{{ t("connect.can2") }}</span></li>
          <li class="no"><BaseIcon name="x" /><span>{{ t("connect.cannot1") }}</span></li>
          <li class="no"><BaseIcon name="x" /><span>{{ t("connect.cannot2") }}</span></li>
          <li class="no"><BaseIcon name="x" /><span>{{ t("connect.cannot3") }}</span></li>
        </ul>

        <p class="hint">{{ t("connect.revoke") }}</p>
        <p v-if="denied" class="hint warnline">{{ t("connect.denied") }}</p>

        <button class="btn block" type="button" data-act="allow" @click="allow">{{ t("connect.allow") }}</button>
      </div>

      <div v-else-if="step === 'checking'" class="center"><div class="spin" /><h4>{{ t("connect.checking") }}</h4><p>{{ t("connect.checkingSub", { host: hostText }) }}</p></div>

      <div v-else-if="step === 'login'" class="center">
        <div class="big"><BaseIcon name="user" /></div>

        <h4>{{ t("connect.loginTitle", { name: service.name }) }}</h4>

        <p>{{ t("connect.loginSub") }}</p>

        <button class="btn block" type="button" @click="openLogin"><BaseIcon name="ext" />{{ t("connect.openLogin") }}</button>
      </div>

      <div v-else-if="step === 'waiting'" class="center"><div class="spin" /><h4>{{ t("connect.waiting") }}</h4><p>{{ t("connect.waitingSub", { name: service.name }) }}</p></div>

      <div v-else-if="step === 'error'" class="center">
        <div class="big badc"><BaseIcon name="warn" /></div>

        <h4>{{ t("connect.failed") }}</h4>

        <p v-if="errorText">{{ errorText }}</p>

        <button class="btn block" type="button" @click="retry">{{ t("connect.retry") }}</button>
      </div>

      <div v-else class="center">
        <div class="big okc"><BaseIcon name="check" /></div>

        <h4>{{ t("connect.doneTitle", { name: doneAccount?.label || service.name }) }}</h4>

        <p>{{ t("connect.doneSub") }}</p>

        <div class="pair"><button class="btn ghost" type="button" @click="emit('configure', accountId)">{{ t("connect.configure") }}</button><button class="btn" type="button" @click="emit('done')">{{ t("connect.finish") }}</button></div>
      </div>
    </div>
  </section>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: rise .28s both;
  }

  .stepbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .steps {
    display: flex;
    gap: 4px;
  }

  .steps i {
    flex: 1;
    height: 2px;
    border-radius: 1px;
    background: var(--line);
    transition: background-color .3s;
    display: block;
  }

  .steps i.on {
    background: var(--hi);
  }

  .steplbl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    font-size: .72rem;
  }

  .steplbl span:nth-child(2) {
    text-align: center;
  }

  .steplbl span:nth-child(3) {
    text-align: right;
  }

  .steplbl span.on {
    color: var(--hi);
  }

  .warnline {
    color: var(--bad);
  }

  .pair {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .pair .btn {
    flex: 1;
  }

  .pick {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pick-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--card);
    color: var(--text);
    text-align: left;
  }

  .pick-item strong {
    color: var(--hi);
    font-weight: 500;
  }

  .pick-item small {
    font-size: .75rem;
    color: var(--muted);
  }

  .pick-item:hover:not(:disabled) {
    background: var(--hover);
  }

  .pick-item[aria-checked='true'] {
    border-color: var(--amber);
  }

  .pick-item:disabled {
    opacity: .6;
    cursor: default;
  }
</style>