<!-- ----------------------------------------------------------------------- -->
<!-- DESCRIPTION                                                             -->
<!-- ----------------------------------------------------------------------- -->
<!-- icon from the built-in set: 24×24 svg, stroke and color follow the surrounding text -->
<!-- reusable. props: name (logo, mail, reply, heart, user, bell, gear, moon, plus, refresh, back, check, x and others) -->
<!-- usage: <BaseIcon name="bell" /> -->
<!-- ----------------------------------------------------------------------- -->

<script setup>
  // PROPS
  // ---------------------------------------------------------------------------
  defineProps({ name: { type: String, required: true } });

  // REACTIVE DATA
  // ---------------------------------------------------------------------------
  // 24×24 outlines: stroke only, color is currentColor
  const PATHS = {
    logo: `<path d="M6.4 5H10v14H6.4z" fill="currentColor" stroke="none"/><path d="M11 5h2.4a4.2 4.2 0 0 1 0 8.4H11z" fill="var(--amber)" stroke="none"/>`,
    mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7.5 8 6 8-6"/>`,
    reply: `<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 6 6v1"/>`,
    heart: `<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>`,
    user: `<circle cx="10" cy="8" r="3.2"/><path d="M4 19c.6-3.4 3-5 6-5s5.4 1.6 6 5"/><path d="M18 8v6M15 11h6"/>`,
    bell: `<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>`,
    gear: `<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
    moon: `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    refresh: `<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>`,
    search: `<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>`,
    back: `<path d="m15 6-6 6 6 6"/>`,
    chevron: `<path d="m6 9 6 6 6-6"/>`,
    check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
    checks: `<path d="m2.5 12.5 4.5 4.5 9-9.5"/><path d="m12 16.5.5.5 9-9.5"/>`,
    x: `<path d="M6 6l12 12M18 6 6 18"/>`,
    sound: `<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6"/>`,
    lock: `<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
    warn: `<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.4v.01"/>`,
    ext: `<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`,
    flag: `<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>`,
    sliders: `<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`,
    list: `<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>`,
    book: `<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>`,
    shield: `<path d="M12 3 5 6v6c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6z"/>`,
    file: `<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>`,
  };
</script>

<!-- SEPARATOR ------------------------------------------------------------- -->

<template>
  <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" v-html="PATHS[name] ?? ''" />
</template>