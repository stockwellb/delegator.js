// index.js
// Main entry point for delegator.js

// Core
export { createDelegator, normalizeIgnore } from "./src/delegator.js";

// Plugins
export { createHandlerPlugin } from "./src/plugins/handler.js";
export { toggleClassPlugin } from "./src/plugins/toggle.js";
export { dismissPlugin } from "./src/plugins/dismiss.js";
export { scrollToPlugin } from "./src/plugins/scroll-to.js";
export { disablePlugin } from "./src/plugins/disable.js";
export { focusPlugin } from "./src/plugins/focus.js";
export { confirmPlugin } from "./src/plugins/confirm.js";
export { copyTextPlugin } from "./src/plugins/copy-text.js";
export { copyLinkPlugin } from "./src/plugins/copy-link.js";

// Utilities (for custom plugins or testing)
export { createCopyPlugin, defaultWriteText, defaultBuildURL } from "./src/plugins/utils.js";
