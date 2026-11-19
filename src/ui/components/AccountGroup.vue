<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- several accounts of one service as one row: the sum of their counters, opens into a row per account -->
<!-- props: accounts (of one service, without secrets), service (its description), now (current time) -->
<!-- events: open — open the service of an account, read — mark an account as read, configure — account settings (id) -->
<!-- usage: <AccountGroup :accounts="list" :service="app.serviceOf(id)" :now="app.now" @open="open" /> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, ref } from "vue";
  import { TYPES } from "@/core/model.js";
  import AccountRow from "./AccountRow.vue";

  // PROPS
  // ---------------------------------------------------------------------------
  const props = defineProps({
    accounts: { type: Array, required: true },
    service: { type: Object, required: true },
    now: { type: Number, required: true },
  });

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["open", "read", "configure"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const KEY = "pharos.openGroups";

  // which groups were left open is a convenience of this browser only
  const remembered = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      return [];
    }
  };

  const isProblem = (account) => account.state === "login" || account.state === "broken";
  // a group with an account that needs attention starts open, so the way to fix it is in sight
  const expanded = ref(remembered().includes(props.service.id) || props.accounts.some(isProblem));

  // COMPUTED
  // ---------------------------------------------------------------------------
  const healthy = computed(() => props.accounts.filter((account) => !isProblem(account)));
  const problems = computed(() => props.accounts.length - healthy.value.length);

  // the group row reads like an account: the counters of the healthy accounts added up, the strongest mode of a type
  const total = computed(() => {
    const sum = (key, type) => healthy.value.reduce((all, account) => all + (account[key]?.[type] ?? 0), 0);
    const strongest = (type) => {
      const modes = healthy.value.map((account) => account.prefs[type].mode);
      const mode = modes.includes("now") ? "now" : modes.includes("digest") ? "digest" : "off";

      return { mode, sound: healthy.value.some((account) => account.prefs[type].sound) };
    };

    return {
      id: props.service.id,
      serviceId: props.service.id,
      label: "",
      state: "ok",
      enabled: true,
      isNew: props.accounts.some((account) => account.isNew),
      lastCheckAt: Math.max(...props.accounts.map((account) => account.lastCheckAt ?? 0)),
      counts: Object.fromEntries(TYPES.map((type) => [type, sum("counts", type)])),
      seen: Object.fromEntries(TYPES.map((type) => [type, sum("seen", type)])),
      prefs: Object.fromEntries(TYPES.map((type) => [type, strongest(type)])),
    };
  });

  // METHODS
  // ---------------------------------------------------------------------------
  const toggle = () => {
    expanded.value = !expanded.value;

    try {
      const open = new Set(remembered());

      if (expanded.value) open.add(props.service.id);
      else open.delete(props.service.id);

      localStorage.setItem(KEY, JSON.stringify([...open]));
    } catch {
      // the open state just is not remembered
    }
  };

  const readAll = () => props.accounts.forEach((account) => emit("read", account));
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div class="group-box">
    <AccountRow :account="total" :service="service" :now="now" :group="accounts.length" :expanded="expanded" :problems="problems" @open="toggle" @read="readAll" />

    <div v-show="expanded" class="group-list">
      <AccountRow v-for="account in accounts" :key="account.id" :account="account" :service="service" :now="now" nested @open="emit('open', account)" @read="emit('read', account)" @configure="emit('configure', account.id)" />
    </div>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .group-box {
    border-top: 1px solid var(--line);
  }

  .group-box:first-child {
    border-top: 0;
  }
</style>