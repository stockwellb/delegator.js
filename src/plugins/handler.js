// src/plugins/handler.js
// Plugin for [data-handler] registry dispatch

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import('../delegator.js').DelegatorPlugin} DelegatorPlugin
 * @typedef {import('../delegator.js').DelegatorContext} DelegatorContext
 * @typedef {import('../delegator.js').IgnorePredicate} IgnorePredicate
 */

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
