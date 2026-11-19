<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- small question mark with a tooltip: explains an option next to its label -->
<!-- reusable. props: text (the explanation). the bubble lives in <body>, so no scroll area or card can clip it; it opens below, above near the bottom edge, and stays inside the window -->
<!-- usage: <h3>Quiet hours<BaseHint :text="t('hint.quiet')" /></h3> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { nextTick, ref } from "vue";

  // PROPS
  // ---------------------------------------------------------------------------
  defineProps({
    text: { type: String, required: true }
  });

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const GAP = 8;
  const root = ref(null);
  const bubble = ref(null);
  const open = ref(false);
  const position = ref({ left: 0, top: 0 });

  // METHODS
  // ---------------------------------------------------------------------------
  // the bubble is measured after it is drawn: it starts under the mark, slides left to stay GAP inside the window
  // and flips above the mark when there is no room below
  const show = async () => {
    open.value = true;

    await nextTick();

    const mark = root.value?.getBoundingClientRect();
    const box = bubble.value?.getBoundingClientRect();

    if (!mark || !box) return;

    const left = Math.min(Math.max(GAP, mark.left - GAP), window.innerWidth - box.width - GAP);
    const below = mark.bottom + GAP;
    const top = below + box.height + GAP > window.innerHeight && mark.top - GAP - box.height >= GAP ? mark.top - GAP - box.height : below;

    position.value = { left: Math.max(GAP, left), top: Math.max(GAP, top) };
  }

  const hide = () => { open.value = false; }
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <span ref="root" class="hint-tip" tabindex="0" role="note" :aria-label="text" @mouseenter="show" @mouseleave="hide" @focus="show" @blur="hide">
    <span class="hint-tip__mark" aria-hidden="true">?</span>

    <Teleport to="body">
      <span v-if="open" ref="bubble" class="hint-tip__bubble" role="tooltip" :style="{ left: `${position.left}px`, top: `${position.top}px` }">{{ text }}</span>
    </Teleport>
  </span>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .hint-tip {
    display: inline-flex;
    vertical-align: middle;
    margin-left: 6px;
    cursor: help;
  }

  .hint-tip__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--border);
    color: var(--text);
    font-size: .64rem;
    font-weight: 500;
    line-height: 1;
    transition: color .18s, box-shadow .18s;
  }

  .hint-tip:hover .hint-tip__mark,
  .hint-tip:focus-visible .hint-tip__mark {
    color: var(--hi);
    box-shadow: inset 0 0 0 1px var(--hi);
  }

  .hint-tip:focus-visible {
    outline: none;
  }

  .hint-tip__bubble {
    position: fixed;
    z-index: 1000;
    width: max-content;
    max-width: 240px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--panel-dark);
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
    color: var(--hi);
    font-size: .74rem;
    font-weight: 400;
    line-height: 1.4;
    text-align: left;
    white-space: normal;
    pointer-events: none;
    animation: hint-in .18s ease both;
  }

  @keyframes hint-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hint-tip__mark {
      transition: none;
    }

    .hint-tip__bubble {
      animation: none;
    }
  }
</style>