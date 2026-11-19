<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- service logo in a tile: one-color svg in the palette, the monogram when there is no logo -->
<!-- reusable. props: service ({ id, name, mono }), size (sm | md) -->
<!-- usage: <ServiceLogo :service="app.serviceOf(a.serviceId)" /> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed } from "vue";

  // PROPS
  // ---------------------------------------------------------------------------
  const props = defineProps({
    service: { type: Object, required: true },
    size: { type: String, default: "md" }
  });

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  // logos ship with the extension (src/assets/logos/<service id>.svg), nothing is loaded from the network
  const FILES = import.meta.glob("@/assets/logos/*.svg", { query: "?raw", import: "default", eager: true });

  const LOGOS = Object.fromEntries(Object.entries(FILES).map(([path, svg]) => [
    path.split("/").pop().replace(".svg", ""),
    svg.replace(/<title>.*?<\/title>/, "").replace("<svg ", `<svg aria-hidden="true" fill="currentColor" `),
  ]));

  // COMPUTED
  // ---------------------------------------------------------------------------
  const logo = computed(() => LOGOS[props.service.id] ?? null);
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <span class="logo" :class="size" :title="service.name">
    <span v-if="logo" class="svg" v-html="logo" />
    <span v-else class="txt">{{ service.mono }}</span>
  </span>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .logo {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--panel-dark);
    border: 1px solid var(--line);
    color: var(--hi);
    transition: border-color .2s, color .2s;
  }

  .logo.sm {
    width: 28px;
    height: 28px;
    border-radius: 7px;
  }

  .svg {
    display: grid;
    place-items: center;
  }

  .svg :deep(svg) {
    width: 16px;
    height: 16px;
  }

  .sm .svg :deep(svg) {
    width: 14px;
    height: 14px;
  }

  .txt {
    font-size: .74rem;
    font-weight: 500;
  }
</style>