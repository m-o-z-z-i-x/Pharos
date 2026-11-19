// UTILS
// -----------------------------------------------------------------------------
import { execSync } from "node:child_process";
import { defineConfig } from "wxt";

// SEPARATOR -------------------------------------------------------------------

// everything git ignores (local notes, keys, build output) stays out of the source archive
const ignoredByGit = () => {
  try {
    const out = execSync("git ls-files --others --ignored --exclude-standard --directory", { encoding: "utf8" });
    return out.split("\n").filter(Boolean).map((path) => (path.endsWith("/") ? `${path}**` : path));
  } catch {
    return [];
  }
};

export default defineConfig({
  srcDir: "src",
  manifestVersion: 3,
  modules: ["@wxt-dev/module-vue"],

  // components use only <script setup>: the options api and the devtools hooks are left out of the bundle
  vite: () => ({
    define: {
      __VUE_OPTIONS_API__: "false",
      __VUE_PROD_DEVTOOLS__: "false",
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
    },
  }),

  // the source archive for Firefox review holds what is needed to rebuild, nothing local
  zip: { excludeSources: ignoredByGit() },

  manifest: ({ browser }) => ({
    // texts come from public/_locales
    default_locale: "en",
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",

    permissions: [
      "storage",
      "alarms",
      "notifications",
      "cookies",
      "identity",
      "declarativeNetRequestWithHostAccess",
      ...(browser === "chrome" ? ["offscreen"] : []),
    ],

    optional_host_permissions: ["<all_urls>"],
    // test builds only (PHAROS_TEST_HOSTS=1): sites granted up front so checks run without the permission prompt
    ...(process.env.PHAROS_TEST_HOSTS ? { host_permissions: ["<all_urls>"] } : {}),
    minimum_chrome_version: "116",
    // firefox asks every new extension to say what data it collects: none
    browser_specific_settings: { gecko: { id: "pharos@neurocrat.io", strict_min_version: "128.0", data_collection_permissions: { required: ["none"] } }, gecko_android: { strict_min_version: "128.0" } },
    action: { default_title: "__MSG_actionTitle__" },
    commands: { _execute_action: { suggested_key: { default: "Alt+Shift+S" } } },
  })
});