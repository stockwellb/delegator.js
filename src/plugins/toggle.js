// src/plugins/toggle.js
// Toggle class plugin for delegator.js

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} ToggleClassPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-toggle-class]")
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element, target: Element, classes: string[]) => void=} onToggle - callback after toggle
 */

/**
 * Create a toggle-class plugin that toggles CSS classes on a target element.
 *
 * Attributes:
 * - data-toggle-class: Space-separated class names to toggle
 * - data-toggle-target: CSS selector for target element (default: self)
 *
 * @example
 * <button data-toggle-class="hidden" data-toggle-target="#menu">Toggle Menu</button>
 * <button data-toggle-class="active open">Toggle Multiple</button>
 *
 * @param {ToggleClassPluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function toggleClassPlugin(opts = {}) {
	const {
		selector = "[data-toggle-class]",
		preventDefault = true,
		stopPropagation = false,
		ignore = null,
		onToggle = null,
	} = opts;

	const ignorePredicate = normalizeIgnore(ignore);

	return {
		name: "toggle-class",
		match(ctx) {
			if (!ctx.target) return null;
			if (ignorePredicate && ignorePredicate(ctx)) return null;
			return ctx.target.closest(selector);
		},
		handle(ctx, el) {
			const e = ctx.event;

			if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
			if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();

			const classNames = el.getAttribute("data-toggle-class");
			if (!classNames) {
				console.warn("[toggleClassPlugin] Empty data-toggle-class attribute");
				return true;
			}

			const classes = classNames.split(/\s+/).filter(Boolean);
			const targetSelector = el.getAttribute("data-toggle-target");
			const target = targetSelector ? document.querySelector(targetSelector) : el;

			if (!target) {
				console.warn(`[toggleClassPlugin] Target not found: ${targetSelector}`);
				return true;
			}

			for (const cls of classes) {
				target.classList.toggle(cls);
			}

			if (typeof onToggle === "function") {
				onToggle(ctx, el, target, classes);
			}

			return true;
		},
	};
}
