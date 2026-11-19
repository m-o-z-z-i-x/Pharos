<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- settings section "help": frequent questions as an accordion, the author card with the repository link -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // IMPORTS
  // ---------------------------------------------------------------------------
  import { useI18n } from "@/i18n/vue.js";
  import { REPO_URL } from "@/ui/links.js";
  import BaseIcon from "@/ui/components/BaseIcon.vue";
  import authorLogo from "@/assets/author.png";

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  const { t } = useI18n();
  const QUESTIONS = 8;
  const LINKS = [{ id: "repo", url: REPO_URL, icon: "file" }];
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <div class="help">
    <section class="faq" aria-label="FAQ">
      <details v-for="number in QUESTIONS" :key="number" :open="number === 1">
        <summary>{{ t(`opt.help.q${number}`) }}</summary>
        <p>{{ t(`opt.help.a${number}`) }}</p>
      </details>
    </section>

    <aside class="author">
      <div class="who">
        <img class="avatar" :src="authorLogo" alt="m-o-z-z-i-x" width="40" height="40">

        <div>
          <h3>{{ t("opt.help.author") }}</h3>
          <small>m-o-z-z-i-x</small>
        </div>
      </div>

      <p>{{ t("opt.help.authorSub") }}</p>

      <a v-for="link in LINKS" :key="link.id" class="link" :href="link.url" target="_blank" rel="noopener">
        <span class="ico"><BaseIcon :name="link.icon" /></span>
        <span class="txt"><strong>{{ t(`opt.help.${link.id}`) }}</strong><small>{{ t(`opt.help.${link.id}Sub`) }}</small></span>

        <BaseIcon class="go" name="ext" />
      </a>
    </aside>
  </div>
</template>

<!-- SEPARATOR ------------------------------------------------------------- -->

<style scoped>
  .help {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 12px;
    align-items: start;
  }

  .faq {
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .faq details {
    border-top: 1px solid var(--line);
  }

  .faq details:first-child {
    border-top: 0;
  }

  .faq summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    cursor: pointer;
    list-style: none;
    color: var(--hi);
    font-size: .9rem;
    transition: background-color .18s;
  }

  .faq summary::-webkit-details-marker {
    display: none;
  }

  .faq summary:hover {
    background: var(--hover);
  }

  .faq summary:focus-visible {
    outline: 2px solid var(--border);
    outline-offset: -2px;
  }

  .faq summary::after {
    content: "";
    flex: none;
    width: 7px;
    height: 7px;
    margin-right: 4px;
    border-right: 1.5px solid var(--text);
    border-bottom: 1.5px solid var(--text);
    transform: rotate(45deg);
    transition: transform .2s var(--ease), border-color .18s;
  }

  .faq details[open] summary::after {
    transform: rotate(-135deg) translate(-2px, -2px);
    border-color: var(--hi);
  }

  .faq details p {
    padding: 4px 20px 18px;
    max-width: 68ch;
    font-size: .84rem;
    line-height: 1.6;
  }

  .faq details[open] summary {
    padding-bottom: 12px;
  }

  .faq details[open] p {
    animation: rise .28s var(--ease) both;
  }

  .author {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--line);
  }

  .who {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .who .avatar {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    object-fit: cover;
    border: 1px solid var(--line);
  }

  .who h3 {
    font-size: .95rem;
  }

  .who small {
    color: var(--text);
    font-family: var(--mono);
    font-size: .76rem;
  }

  .author > p {
    font-size: .82rem;
    line-height: 1.5;
  }

  .link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
    background: var(--panel-dark);
    border: 1px solid var(--line);
    color: var(--hi);
    text-decoration: none;
    transition: background-color .18s, border-color .18s;
  }

  .link:hover {
    background: var(--hover);
    border-color: var(--border);
  }

  .link:focus-visible {
    outline: 2px solid var(--border);
    outline-offset: 2px;
  }

  .link .ico {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--card);
  }

  .link .txt {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
  }

  .link strong {
    font-weight: 500;
    font-size: .86rem;
  }

  .link small {
    color: var(--text);
    font-size: .74rem;
  }

  .link .go {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--text);
    transition: color .18s, transform .18s;
  }

  .link:hover .go {
    color: var(--hi);
    transform: translate(1px, -1px);
  }

  @media (max-width: 960px) {
    .help {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .faq summary::after,
    .link .go {
      transition: none;
    }
  }
</style>