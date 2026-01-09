// src/delegator.js
// A tiny, dependency-free event delegation "kernel" for SSR/HTMX-style apps.
//
// Features:
// - Single delegated listener (capture optional)
// - Plugin pipeline: first plugin that matches handles the event
// - Fallback plugin for [data-handler] registry dispatch (safe; no eval)
// - "Zones": opt-out mechanism via ignore selector OR ignore predicate (app/library decides naming)
// - Small declarative feedback helper used by plugins
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
 * @property {(el: Element, opts?: FeedbackOptions) => void} feedbackSuccess
 * @property {(el: Element, opts?: FeedbackOptions) => void} feedbackError
 */

/**
 * @typedef {Object} FeedbackOptions
 * @property {string=} mode            // currently supports: "icon"
 * @property {string=} targetSelector  // e.g. "i", ".icon"
 * @property {string=} swap            // e.g. "fa-copy:fa-check"
 * @property {number=} ms              // duration to revert
 * @property {string=} text            // reserved for future
 */

/**
 * @callback IgnorePredicate
 * @param {DelegatorContext} ctx
 * @returns {boolean} - true means "ignore (do not intercept)"
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
      feedbackSuccess: (el, opts) =>
        applyFeedback(el, { ...readFeedback(el), ...(opts || {}), kind: "success" }),
      feedbackError: (el, opts) =>
        applyFeedback(el, { ...readFeedback(el), ...(opts || {}), kind: "error" }),
    };

    // Zones: if ignored, do nothing and let the event proceed naturally.
    if (ignorePredicate && ignorePredicate(ctx)) return;

    for (const plugin of _plugins) {
      let el = null;

      try {
        el = plugin.match(ctx);
      } catch (err) {
        console.error(`[delegator] plugin "${plugin.name || "anonymous"}" match error:`, err);
        continue;
      }

      if (!el) continue;

      try {
        const result = plugin.handle(ctx, el);
        const handled = result instanceof Promise ? await result : result;

        // Explicit false means "I matched but chose not to handle"
        const didHandle = handled !== false;

        if (didHandle && stopOnHandle) return;
      } catch (err) {
        console.error(`[delegator] plugin "${plugin.name || "anonymous"}" handle error:`, err);
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

// -----------------------------------------------------------------------------
// Built-in plugin: [data-handler] registry dispatch
// -----------------------------------------------------------------------------

/**
 * Create a plugin that dispatches [data-handler] to a provided handler registry.
 *
 * Supports dot notation: "StudyGuide.toggleShowAnswer"
 *
 * @param {Object} opts
 * @param {Record<string, any>} opts.handlers - registry object (e.g., window.Handlers)
 * @param {string=} opts.selector - override selector (default "[data-handler]")
 * @param {string|IgnorePredicate|null=} opts.ignore - plugin-level ignore zones (optional)
 * @param {boolean=} opts.preventDefault - call preventDefault on matched events (default true)
 * @param {boolean=} opts.stopPropagation - call stopPropagation on matched events (default true)
 * @param {(ctx: DelegatorContext, el: Element, name: string) => void=} opts.onMissing
 * @param {(ctx: DelegatorContext, el: Element, fn: Function, name: string) => any=} opts.onInvoke
 * @returns {DelegatorPlugin}
 */
export function createHandlerPlugin(opts) {
  const {
    handlers,
    selector = "[data-handler]",
    ignore = null,
    preventDefault = true,
    stopPropagation = true,
    onMissing = null,
    onInvoke = null,
  } = opts || {};

  if (!handlers || typeof handlers !== "object") {
    throw new Error("createHandlerPlugin: opts.handlers must be an object registry.");
  }

  const ignorePredicate = normalizeIgnore(ignore);

  return {
    name: "data-handler",
    match(ctx) {
      if (!ctx.target) return null;
      if (ignorePredicate && ignorePredicate(ctx)) return null;
      const el = ctx.target.closest(selector);
      return el || null;
    },
    handle(ctx, el) {
      const e = ctx.event;

      if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
      if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();

      const name = el.getAttribute("data-handler");
      if (!name) return true;

      const fn = resolveHandler(handlers, name);

      if (typeof fn === "function") {
        if (typeof onInvoke === "function") return onInvoke(ctx, el, fn, name);
        fn(e, el);
        return true;
      }

      if (typeof onMissing === "function") {
        onMissing(ctx, el, name);
      } else {
        console.warn(`[delegator] Handler "${name}" not found in registry`);
      }
      return true;
    },
  };
}

function resolveHandler(registry, name) {
  if (!name.includes(".")) return registry[name];
  return name.split(".").reduce((obj, key) => (obj ? obj[key] : undefined), registry);
}

// -----------------------------------------------------------------------------
// Feedback helper
// -----------------------------------------------------------------------------

/**
 * Read declarative feedback settings from data attributes.
 * Exported for plugin authors who want to leverage the feedback system.
 *
 * @param {Element} el
 * @returns {FeedbackOptions & {kind?: "success"|"error"}}
 */
export function readFeedback(el) {
  const mode = el.getAttribute("data-feedback") || undefined;
  const targetSelector = el.getAttribute("data-feedback-target") || undefined;
  const swap = el.getAttribute("data-feedback-swap") || undefined;

  const msRaw = el.getAttribute("data-feedback-ms");
  const ms = msRaw ? Number(msRaw) : undefined;

  return { mode, targetSelector, swap, ms };
}

/**
 * Apply feedback based on options.
 * Exported for plugin authors who want to leverage the feedback system.
 *
 * Currently supports:
 * - mode="icon": swap CSS classes on a target element
 *
 * @param {Element} el
 * @param {FeedbackOptions & {kind?: "success"|"error"}} opts
 */
export function applyFeedback(el, opts) {
  const mode = opts.mode || "icon";
  if (mode !== "icon") return;

  const targetSelector = opts.targetSelector || "i";
  const swap = opts.swap;
  if (!swap) return;

  const [fromClass, toClass] = swap.split(":").map((s) => s.trim());
  if (!fromClass || !toClass) {
    console.warn(`[delegator] Invalid swap format "${swap}". Expected "fromClass:toClass".`);
    return;
  }

  const ms = Number.isFinite(opts.ms) ? /** @type {number} */ (opts.ms) : 1500;

  const target = el.querySelector(targetSelector);
  if (!target) return;

  // Save original class name to revert reliably.
  const original = target.className;

  // Swap token if present, else just add "to".
  if (target.classList.contains(fromClass)) {
    target.classList.remove(fromClass);
  }
  target.classList.add(toClass);

  window.setTimeout(() => {
    target.className = original;
  }, ms);
}

