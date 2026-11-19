<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- segmented switch: a row of buttons, a pill slides under the chosen one -->
<!-- reusable. props: items ([{ value, label }]), value (selected), stretch (buttons share the width). events: pick -->
<!-- usage: <BaseSegmented :items="items" :value="s.defaultInterval" @pick="(v) => set({ defaultInterval: v })" /> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

  // PROPS
  // ---------------------------------------------------------------------------
  const props = defineProps({
    items: { type: Array, required: true },
    value: { type: [String, Number], default: null },
    stretch: { type: Boolean, default: false }
  });

  // EMITS
  // ---------------------------------------------------------------------------
  const emit = defineEmits(["pick"]);

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const root = ref(null);
  const box = ref({ left: 0, width: 0 });
  const animate = ref(false);
  let observer;

  // COMPUTED
  // ---------------------------------------------------------------------------
  const index = computed(() => props.items.findIndex((item) => item.value === props.value));
  const pill = computed(() => ({ width: `${box.value.width}px`, transform: `translateX(${box.value.left}px)` }));

  // WATCHERS
  // ---------------------------------------------------------------------------
  watch(() => [props.value, props.items.length], () => nextTick(measure));

  // METHODS
  // ---------------------------------------------------------------------------
  // buttons differ in width, so the pill takes the real size of the chosen one
  const measure = () => {
    const button = root.value?.querySelectorAll("button")[index.value];

    if (button) box.value = { left: button.offsetLeft, width: button.offsetWidth };
  }

  // HOOKS
  // ---------------------------------------------------------------------------
  // the first position is set without motion, the pill only slides on later changes
  onMounted(async () => {
    measure();
    await document.fonts?.ready;
    measure();
    requestAnimationFrame(() => { animate.value = true; });
    observer = new ResizeObserver(measure);
    observer.observe(root.value);
  });

  onBeforeUnmount(() => observer?.disconnect());
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div ref="root" class="modeseg seg" :class="{ stretch }" role="group">
    <span class="pill" :class="{ on: index >= 0, animate }" :style="pill" aria-hidden="true" />
    <button v-for="item in items" :key="item.value" type="button" :aria-pressed="String(item.value === value)" @click="emit('pick', item.value)">{{ item.label }}</button>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .seg {
    position: relative;
    isolation: isolate;
    flex: none;
  }

  .seg.stretch {
    flex: 1;
  }

  .seg button {
    position: relative;
    z-index: 1;
  }

  .seg button[aria-pressed='true'] {
    background: transparent;
  }

  .pill {
    position: absolute;
    z-index: 0;
    top: 2px;
    bottom: 2px;
    left: 0;
    border-radius: 6px;
    background: var(--btn);
    opacity: 0;
    pointer-events: none;
  }

  .pill.on {
    opacity: 1;
  }

  .pill.animate {
    transition: transform .28s var(--ease), width .28s var(--ease), opacity .18s;
  }

  @media (prefers-reduced-motion: reduce) {
    .pill.animate {
      transition: none;
    }
  }
</style>