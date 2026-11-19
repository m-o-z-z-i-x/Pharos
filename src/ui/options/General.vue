<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "general": checks (interval, quiet hours), appearance (language, theme), shortcuts, backup file -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, onMounted, ref } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { INTERVALS } from "@/core/model.js";
  import { appStore } from "@/ui/stores/app.js";
  import BaseSegmented from "@/ui/components/BaseSegmented.vue";
  import BaseHint from "@/ui/components/BaseHint.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const fileInput = ref(null);
  const message = ref("");
  const failed = ref(false);

  // COMPUTED
  // ---------------------------------------------------------------------------
  const settings = computed(() => app.settings);

  // METHODS
  // ---------------------------------------------------------------------------
  const set = (patch) => app.act("setSettings", { patch });
  const okTime = (value) => /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);

  // an incomplete or invalid time is not saved: the field is still being typed
  const setTime = (key, value) => {
    if (okTime(value)) set({ quietHours: { ...settings.value.quietHours, [key]: value } });
  }

  // local date for the file name: toISOString would give the UTC day
  const today = () => {
    const date = new Date();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  const say = (text, bad = false) => {
    message.value = text;
    failed.value = bad;
  }

  // the file is built in the page and handed to the browser download, nothing leaves the computer
  const saveFile = async () => {
    const exported = await app.act("exportSettings");

    if (!exported?.json) return say(t("opt.general.saveError"), true);

    const url = URL.createObjectURL(new Blob([exported.json], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `pharos-backup-${today()}.json` });

    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    say(t("opt.general.saved"));
  }

  // the input is reset so choosing the same file again still fires change
  const loadFile = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    const imported = await app.act("importSettings", { json: await file.text() });

    if (!imported.ok) return say(t(`opt.general.importError.${imported.error === "format" ? "format" : "parse"}`), true);
    say(imported.missing?.length ? t("opt.general.importMissing", { list: imported.missing.map((missing) => missing.label).join(", ") }) : t("opt.general.imported"));
  }

  // HOOKS
  // ---------------------------------------------------------------------------
  onMounted(() => { if (!app.st) app.refresh(); });
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div v-if="settings" class="grid2">
    <section class="oc"><h3>{{ t("opt.general.interval") }}<BaseHint :text="t('hint.interval')" /></h3><p>{{ t("opt.general.intervalSub") }}</p>
      <BaseSegmented :items="INTERVALS.map((minutes) => ({ value: minutes, label: t('account.minutes', { n: minutes }) }))" :value="settings.defaultInterval" @pick="(value) => set({ defaultInterval: value })" />
    </section>

    <section class="oc"><h3>{{ t("opt.general.quiet") }}<BaseHint :text="t('hint.quiet')" /></h3><p>{{ t("opt.general.quietSub") }}</p>
      <label class="row2"><input class="sw" type="checkbox" :checked="settings.quietHours.on" @change="set({ quietHours: { ...settings.quietHours, on: $event.target.checked } })">{{ t("opt.general.on") }}</label>
      <div class="row2">{{ t("opt.general.from") }}<input class="in time" :value="settings.quietHours.from" maxlength="5" :aria-label="t('opt.general.from')" @change="setTime('from', $event.target.value)">{{ t("opt.general.to") }}<input class="in time" :value="settings.quietHours.to" maxlength="5" :aria-label="t('opt.general.to')" @change="setTime('to', $event.target.value)"></div>
    </section>

    <section class="oc"><h3>{{ t("opt.general.look") }}</h3>
      <div class="pair2">
        <div><span class="lbl">{{ t("opt.general.lang") }}</span>
          <BaseSegmented :items="[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]" :value="settings.lang" @pick="(value) => set({ lang: value })" />
        </div>

        <div><span class="lbl">{{ t("opt.general.theme") }}</span>
          <BaseSegmented :items="[{ value: 'dark', label: t('opt.general.dark') }, { value: 'light', label: t('opt.general.light') }]" :value="settings.theme" @pick="(value) => set({ theme: value })" />
        </div>
      </div>

      <p>{{ t("opt.general.lookSub") }}</p>
    </section>

    <section class="oc"><h3>{{ t("opt.general.keys") }}</h3>
      <ul class="keys">
        <li><span>{{ t("opt.general.keyOpen") }}</span><span><kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>S</kbd></span></li>
        <li><span>{{ t("opt.general.keyCheck") }}</span><span><kbd>R</kbd></span></li>
        <li><span>{{ t("opt.general.keyQuiet") }}</span><span><kbd>Q</kbd></span></li>
      </ul>
    </section>

    <section class="oc wide"><h3>{{ t("opt.general.backup") }}<BaseHint :text="t('hint.backup')" /></h3>
      <p>{{ t("opt.general.backupSub") }}</p>

      <ol class="steps">
        <li>{{ t("opt.general.step1") }}</li>
        <li>{{ t("opt.general.step2") }}</li>
        <li>{{ t("opt.general.step3") }}</li>
      </ol>

      <div class="row2">
        <button class="btn" type="button" data-act="save" @click="saveFile">{{ t("opt.general.save") }}</button>
        <button class="btn ghost" type="button" data-act="load" @click="fileInput.click()">{{ t("opt.general.load") }}</button>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="loadFile">
      </div>

      <p v-if="message" class="hint" :class="failed ? 'bad' : 'hi'" role="status">{{ message }}</p>
    </section>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .hi {
    color: var(--hi);
  }

  .bad {
    color: var(--bad);
  }
</style>