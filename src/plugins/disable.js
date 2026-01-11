// src/plugins/disable.js
// Disable plugin for delegator.js

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} DisablePluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-disable]")
 * @property {string=} disabledClass - class to add when disabled (default "is-disabled")
 * @property {string=} loadingClass - class to add during loading (default "is-loading")
 * @property {number=} duration - auto-reenable after ms (0 = manual, default 0)
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element) => void=} onDisable - callback when disabled
 * @property {(ctx: DelegatorContext, el: Element) => void=} onEnable - callback when re-enabled
 */

/**
 * Create a disable plugin that prevents double-clicks/submits by disabling elements.
 *
 * Attributes:
 * - data-disable: presence enables the behavior (value can specify duration in ms)
 * - data-disable-class: custom disabled class (optional)
 * - data-loading-class: custom loading class (optional)
 *
 * The element is re-enabled automatically after the specified duration,
 * or you can call the returned enable() function on the element.
 *
 * @example
 * <button data-disable>Submit</button>
 * <button data-disable="3000">Submit (re-enables after 3s)</button>
 * <button data-disable data-disable-class="btn-disabled">Custom Class</button>
 *
 * @param {DisablePluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function disablePlugin(opts = {}) {
	const {
		selector = "[data-disable]",
		disabledClass = "is-disabled",
		loadingClass = "is-loading",
		duration = 0,
		preventDefault = true,
		stopPropagation = false,
		ignore = null,
		onDisable = null,
		onEnable = null,
	} = opts;

	const ignorePredicate = normalizeIgnore(ignore);

	// Store timeouts to allow cleanup
	const timeouts = new WeakMap();

	/**
	 * Enable a previously disabled element.
	 * @param {Element} el - The element to enable
	 */
	function enable(el) {
		const customDisabledClass = el.getAttribute("data-disable-class") || disabledClass;
		const customLoadingClass = el.getAttribute("data-loading-class") || loadingClass;

		el.removeAttribute("disabled");
		el.classList.remove(customDisabledClass, customLoadingClass);

		// Clear any pending timeout
		const timeout = timeouts.get(el);
		if (timeout) {
			clearTimeout(timeout);
			timeouts.delete(el);
		}
	}

	return {
		name: "disable",
		match(ctx) {
			if (!ctx.target) return null;
			if (ignorePredicate && ignorePredicate(ctx)) return null;

			const el = ctx.target.closest(selector);
			// Don't match if already disabled
			if (el && el.hasAttribute("disabled")) return null;
			return el;
		},
		handle(ctx, el) {
			const e = ctx.event;

			if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
			if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();

			const customDisabledClass = el.getAttribute("data-disable-class") || disabledClass;
			const customLoadingClass = el.getAttribute("data-loading-class") || loadingClass;
			const customDuration = Number(el.getAttribute("data-disable")) || duration;

			// Disable the element
			el.setAttribute("disabled", "disabled");
			el.classList.add(customDisabledClass, customLoadingClass);

			if (typeof onDisable === "function") {
				onDisable(ctx, el);
			}

			// Auto-enable after duration if specified
			if (customDuration > 0) {
				const timeout = setTimeout(() => {
					enable(el);
					if (typeof onEnable === "function") {
						onEnable(ctx, el);
					}
				}, customDuration);
				timeouts.set(el, timeout);
			}

			// Attach enable function to element for manual re-enabling
			el._delegatorEnable = () => {
				enable(el);
				if (typeof onEnable === "function") {
					onEnable(ctx, el);
				}
			};

			return true;
		},
		// Expose enable function for external use
		enable,
	};
}
