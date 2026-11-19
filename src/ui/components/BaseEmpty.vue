<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- empty state in a panel: an icon in a circle, a title, a short explanation and an optional action -->
<!-- reusable. props: icon, title, text, compact (smaller, for a block inside a card), bare (no frame, inside a framed table) -->
<!-- usage: <BaseEmpty icon="bell" :title="t('list.empty')" :text="t('list.emptyHint')"><button class="btn">Add</button></BaseEmpty> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import BaseIcon from "./BaseIcon.vue";

  // PROPS
  // ---------------------------------------------------------------------------
  defineProps({
    icon: { type: String, default: "bell" },
    title: { type: String, required: true },
    text: { type: String, default: "" },
    compact: { type: Boolean, default: false },
    bare: { type: Boolean, default: false }
  });
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div class="base-empty" :class="{ compact, bare }" role="status">
    <span class="ico"><BaseIcon :name="icon" /></span>

    <strong>{{ title }}</strong>

    <span v-if="text" class="txt">{{ text }}</span>

    <div v-if="$slots.default" class="act"><slot /></div>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .base-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 20px;
    border-radius: 12px;
    background: var(--card);
    border: 1px dashed var(--border);
    text-align: center;
    animation: rise .32s var(--ease) both;
  }

  .base-empty.bare {
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .base-empty.compact {
    padding: 16px;
    gap: 6px;
  }

  .ico {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-bottom: 4px;
    border-radius: 50%;
    background: var(--panel-dark);
    border: 1px solid var(--line);
    color: var(--text);
  }

  .ico :deep(.ic) {
    width: 20px;
    height: 20px;
  }

  .compact .ico {
    width: 32px;
    height: 32px;
    margin-bottom: 0;
  }

  .compact .ico :deep(.ic) {
    width: 16px;
    height: 16px;
  }

  strong {
    color: var(--hi);
    font-size: .9rem;
    font-weight: 500;
  }

  .compact strong {
    font-size: .82rem;
  }

  .txt {
    max-width: 42ch;
    font-size: .8rem;
    line-height: 1.5;
    color: var(--text);
  }

  .act {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
  }
</style>