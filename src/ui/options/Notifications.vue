<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "notifications": sound and digest, badge and what a notification shows -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed } from "vue";
  import { useI18n } from "@/i18n/vue.js";
  import { browser } from "wxt/browser";
  import { appStore } from "@/ui/stores/app.js";
  import BaseSegmented from "@/ui/components/BaseSegmented.vue";
  import BaseHint from "@/ui/components/BaseHint.vue";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const app = appStore();
  const DIGEST = [30, 60, 180, 1440];

  // COMPUTED
  // ---------------------------------------------------------------------------
  const settings = computed(() => app.settings);

  // METHODS
  // ---------------------------------------------------------------------------
  const set = (patch) => app.act("setSettings", { patch });
  const label = (minutes) => (minutes === 1440 ? t("opt.notif.day") : minutes >= 60 ? t("opt.notif.hours", { n: minutes / 60 }) : t("opt.notif.min", { n: minutes }));

  // the settings page is a regular document, it plays the sound itself, no offscreen
  const test = () => new Audio(browser.runtime.getURL(`/sounds/${settings.value.sound.name}.wav`)).play().catch(() => {});
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div v-if="settings" class="grid2">
    <section class="oc"><h3>{{ t("opt.notif.sound") }}<BaseHint :text="t('hint.sound')" /></h3><p>{{ t("opt.notif.soundSub") }}</p>
      <div class="row2">
        <select class="in narrow" :value="settings.sound.name" :aria-label="t('opt.notif.sound')" @change="set({ sound: { ...settings.sound, name: $event.target.value } })">
          <option v-for="sound in ['soft', 'short', 'double']" :key="sound" :value="sound">{{ t(`opt.notif.sounds.${sound}`) }}</option>
        </select>

        <button class="btn ghost" type="button" @click="test">{{ t("opt.notif.test") }}</button>
      </div>
    </section>

    <section class="oc"><h3>{{ t("opt.notif.digest") }}<BaseHint :text="t('hint.digest')" /></h3><p>{{ t("opt.notif.digestSub") }}</p>
      <BaseSegmented :items="DIGEST.map((minutes) => ({ value: minutes, label: label(minutes) }))" :value="settings.digestEvery" @pick="(value) => set({ digestEvery: value })" />
    </section>

    <section class="oc"><h3>{{ t("opt.notif.badge") }}<BaseHint :text="t('hint.badge')" /></h3>
      <div class="radio">
        <label v-for="mode in ['important', 'all', 'dot']" :key="mode"><input type="radio" name="badge" :value="mode" :checked="settings.badgeMode === mode" @change="set({ badgeMode: mode })"><span>{{ t(`opt.notif.${mode}`) }}<small>{{ t(`opt.notif.${mode}Sub`) }}</small></span></label>
      </div>
    </section>

    <section class="oc"><h3>{{ t("opt.notif.show") }}</h3>
      <label class="row2"><input class="sw" type="checkbox" :checked="settings.showSender" @change="set({ showSender: $event.target.checked })">{{ t("opt.notif.sender") }}</label>
      <label class="row2"><input class="sw" type="checkbox" :checked="settings.notifyProblems" @change="set({ notifyProblems: $event.target.checked })">{{ t("opt.notif.problemsOn") }}<BaseHint :text="t('hint.problems')" /></label>

      <p>{{ t("opt.notif.noText") }}</p>
    </section>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .narrow {
    width: auto;
  }

  .radio {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: .84rem;
  }

  .radio label {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    cursor: pointer;
    color: var(--hi);
  }

  .radio input {
    appearance: none;
    flex: none;
    width: 16px;
    height: 16px;
    margin: 2px 0 0;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--border);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: box-shadow .2s;
  }

  .radio input::after {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--hi);
    transform: scale(0);
    transition: transform .22s var(--ease);
  }

  .radio input:checked {
    box-shadow: inset 0 0 0 1.5px var(--hi);
  }

  .radio input:checked::after {
    transform: scale(1);
  }

  .radio label:hover input:not(:checked) {
    box-shadow: inset 0 0 0 1.5px var(--text);
  }

  .radio input:focus-visible {
    outline: 2px solid var(--border);
    outline-offset: 2px;
  }

  .radio small {
    display: block;
    color: var(--text);
    font-size: .76rem;
  }
</style>