// UTILS
// -----------------------------------------------------------------------------
import { defineStore } from "pinia";
import { send } from "@/messaging.js";
import { setLocale, t } from "@/i18n";

// SEPARATOR -------------------------------------------------------------------

/** background state as the popup and settings see it. secrets never reach here */
export const appStore = defineStore("app", {
  state: () => ({
    st: null, // getState answer: accounts, services, settings, summary
    toast: "",
    now: Date.now(), // ui clock for "5 min ago" and the countdown
    busy: false,
  }),

  actions: {
    /**
     * re-reads the background state and applies language and theme
     * @return nothing; on failure the previous state stays
     */
    async refresh() {
      const state = await send("getState");

      if (state && !state.error) {
        this.st = state;

        setLocale(state.settings.lang);

        document.title = t("app.name");
        const skin = state.settings.theme === "light" ? "light" : "dark";
        const html = document.documentElement;

        // only a real change of theme fades, the first paint keeps its colors at once
        if (html.dataset.skin && html.dataset.skin !== skin) {
          html.classList.add("skin-anim");

          clearTimeout(this._skin);

          this._skin = setTimeout(() => html.classList.remove("skin-anim"), 360);
        }

        html.dataset.skin = skin;
      }

      this.now = Date.now();
    },

    /**
     * sends a command to the background and re-reads the state
     * @param type - message type from handlers in background/service.js
     * @param payload - message fields
     * @return the background answer
     */
    async act(type, payload = {}) {
      const answer = await send(type, payload);

      await this.refresh();

      return answer;
    },

    /**
     * shows a short message for 2 seconds
     * @param text - text from the dictionary
     */
    flash(text) {
      this.toast = text;

      clearTimeout(this._t);

      this._t = setTimeout(() => { this.toast = ""; }, 2000);
    },
  },

  getters: {
    accounts: (store) => store.st?.accounts ?? [],
    services: (store) => store.st?.services ?? [],
    settings: (store) => store.st?.settings ?? null,

    // unknown id (catalog still loading or rule removed): a stub so the row does not crash
    serviceOf: (store) => (id) => store.st?.services.find((service) => service.id === id) ?? { id, name: id, mono: "?", multi: false, api: false },
  },
});