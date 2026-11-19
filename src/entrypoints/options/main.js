// COMPONENTS
// -----------------------------------------------------------------------------
import App from "./App.vue";

// UTILS
// -----------------------------------------------------------------------------
import { createApp } from "vue";
import { createPinia } from "pinia";
import "@/ui/fonts.js";

// SEPARATOR -------------------------------------------------------------------

createApp(App).use(createPinia()).mount("#app");