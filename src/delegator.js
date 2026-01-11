// src/delegator.js
// A tiny, dependency-free event delegation "kernel" for SSR/HTMX-style apps.
//
// Features:
// - Single delegated listener (capture optional)
// - Plugin pipeline: first plugin that matches handles the event
// - "Zones": opt-out mechanism via ignore selector OR ignore predicate (app/library decides naming)
//
// Philosophy:
// - Data attributes are the API
// - Keep the core tiny; push app specificity into plugins/handlers
// - Prefer explicitness over magic

/**
 * @typedef {Object} Delegator
 * @property {() => void} start
 * @property {() => void} stop
 * @property {(plugin: DelegatorPlugin) => void} use
 * @property {(plugin: DelegatorPlugin | string) => boolean} remove
 * @property {() => DelegatorPlugin[]} plugins
 */

/**
 * @typedef {Object} DelegatorPlugin
 * @property {string=} name
 * @property {(ctx: DelegatorContext) => Element|null} match
 * @property {(ctx: DelegatorContext, el: Element) => (boolean|void|Promise<boolean|void>)} handle
 */

/**
 * @typedef {Object} DelegatorContext
 * @property {Event} event
 * @property {Element|null} target
 * @property {Element} rootEl
 */

/**
 * @callback IgnorePredicate
 * @param {DelegatorContext} ctx
 * @returns {boolean} - true means "ignore (do not intercept)"
 */

/**
 * @callback OnHandleCallback
 * @param {DelegatorPlugin} plugin - the plugin that handled the event
 * @param {DelegatorContext} ctx - the delegator context
 * @param {Element} el - the matched element
 * @returns {void}
 */

/**
 * @callback OnErrorCallback
 * @param {Error} err - the error that was thrown
 * @param {DelegatorPlugin} plugin - the plugin that threw the error
 * @param {DelegatorContext} ctx - the delegator context
 * @param {"match"|"handle"|"onHandle"} phase - which phase the error occurred in
 * @returns {void}
 */

/**
 * Create a delegator.
 *
 * @param {Object} options
 * @param {EventTarget=} options.root - event target to attach to (document or an element)
 * @param {Element=} options.rootEl - semantic "root element" for context; defaults to documentElement
 * @param {string=} options.eventType - e.g. "click"
 * @param {boolean=} options.capture - attach in capture phase
 * @param {boolean=} options.passive - mark listener as passive (default false)
 * @param {string|IgnorePredicate|null=} options.ignore - "zones" opt-out:
 *        - string selector: ignore if event target is inside selector
 *        - predicate(ctx): ignore if it returns true
 * @param {DelegatorPlugin[]=} options.plugins - initial plugin list (order matters)
 * @param {boolean=} options.stopOnHandle - stop after first plugin handles (default true)
 * @param {OnHandleCallback=} options.onHandle - called when a plugin handles an event (useful for debugging/analytics)
 * @param {OnErrorCallback=} options.onError - called when a plugin throws an error (useful for error reporting)
 * @returns {Delegator}
 */
export function createDelegator(options = {}) {
  const {
    root = document,
    rootEl = document.documentElement,
    eventType = "click",
    capture = false,
    passive = false,
    ignore = null,
    plugins = [],
    stopOnHandle = true,
    onHandle = null,
    onError = null,
  } = options;

  const listenerOptions = { capture, passive };

  if (!root || typeof root.addEventListener !== "function") {
    throw new Error("createDelegator: options.root must be an EventTarget (e.g., document or an element).");
  }

  /** @type {DelegatorPlugin[]} */
  const _plugins = Array.isArray(plugins) ? [...plugins] : [];

  let _started = false;

  /** @type {IgnorePredicate|null} */
  const ignorePredicate = normalizeIgnore(ignore);

  const listener = async (event) => {
    const rawTarget = /** @type {any} */ (event).target;
    const target = rawTarget instanceof Element ? rawTarget : null;

    /** @type {DelegatorContext} */
    const ctx = {
      event,
      target,
      rootEl,
    };

    // Zones: if ignored, do nothing and let the event proceed naturally.
    if (ignorePredicate && ignorePredicate(ctx)) return;

    for (const plugin of _plugins) {
      let el = null;

      try {
        el = plugin.match(ctx);
      } catch (err) {
        if (typeof onError === "function") {
          onError(err, plugin, ctx, "match");
        } else {
          console.error(`[delegator] plugin "${plugin.name || "anonymous"}" match error:`, err);
        }
        continue;
      }

      if (!el) continue;

      try {
        const result = plugin.handle(ctx, el);
        const handled = result instanceof Promise ? await result : result;

        // Explicit false means "I matched but chose not to handle"
        const didHandle = handled !== false;

        if (didHandle) {
          if (typeof onHandle === "function") {
            try {
              onHandle(plugin, ctx, el);
            } catch (err) {
              if (typeof onError === "function") {
                onError(err, plugin, ctx, "onHandle");
              } else {
                console.error(`[delegator] onHandle callback error:`, err);
              }
            }
          }
          if (stopOnHandle) return;
        }
      } catch (err) {
        if (typeof onError === "function") {
          onError(err, plugin, ctx, "handle");
        } else {
          console.error(`[delegator] plugin "${plugin.name || "anonymous"}" handle error:`, err);
        }
        // If a plugin claimed the event and errored, we generally stop to avoid cascading.
        if (stopOnHandle) return;
      }
    }
  };

  /** @type {Delegator} */
  const api = {
    start() {
      if (_started) return;
      root.addEventListener(eventType, listener, listenerOptions);
      _started = true;
    },
    stop() {
      if (!_started) return;
      root.removeEventListener(eventType, listener, listenerOptions);
      _started = false;
    },
    use(plugin) {
      if (!plugin || typeof plugin.match !== "function" || typeof plugin.handle !== "function") {
        throw new Error("delegator.use: plugin must have match(ctx) and handle(ctx, el).");
      }
      _plugins.push(plugin);
    },
    remove(plugin) {
      const index = typeof plugin === "string"
        ? _plugins.findIndex((p) => p.name === plugin)
        : _plugins.indexOf(plugin);
      if (index === -1) return false;
      _plugins.splice(index, 1);
      return true;
    },
    plugins() {
      return [..._plugins];
    },
  };

  return api;
}

/**
 * Normalize an ignore option into a predicate function.
 * Exported for plugin authors who want consistent ignore zone support.
 *
 * @param {string|IgnorePredicate|null} ignore
 * @returns {IgnorePredicate|null}
 */
export function normalizeIgnore(ignore) {
  if (!ignore) return null;

  // Selector form
  if (typeof ignore === "string") {
    const selector = ignore;
    /** @type {IgnorePredicate} */
    return (ctx) => !!(ctx.target && ctx.target.closest(selector));
  }

  // Predicate form
  if (typeof ignore === "function") {
    /** @type {IgnorePredicate} */
    return ignore;
  }

  throw new Error("createDelegator: options.ignore must be a selector string, a predicate function, or null.");
}
