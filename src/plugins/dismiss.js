// src/plugins/dismiss.js
// Dismiss plugin for delegator.js

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} DismissPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-dismiss]")
 * @property {"remove"|"hide"=} mode - "remove" removes from DOM, "hide" adds hidden class (default "remove")
 * @property {string=} hideClass - Class to add when mode is "hide" (default "hidden")
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element, target: Element) => void=} onDismiss - callback before dismiss
 */

/**
 * Create a dismiss plugin that removes or hides an element.
 *
 * Attributes:
 * - data-dismiss: CSS selector for target element, or empty to dismiss closest dismissable parent
 * - data-dismiss-mode: "remove" or "hide" (optional, overrides plugin default)
 *
 * @example
 * <div class="alert" id="alert1">
 *   Alert message <button data-dismiss="#alert1">×</button>
 * </div>
 *
 * <div class="alert">
 *   Alert message <button data-dismiss>×</button> <!-- dismisses parent .alert -->
 * </div>
 *
 * @param {DismissPluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function dismissPlugin(opts = {}) {
	const {
		selector = "[data-dismiss]",
		mode = "remove",
		hideClass = "hidden",
		preventDefault = true,
		stopPropagation = false,
		ignore = null,
		onDismiss = null,
	} = opts;

	const ignorePredicate = normalizeIgnore(ignore);

	return {
		name: "dismiss",
		match(ctx) {
			if (!ctx.target) return null;
			if (ignorePredicate && ignorePredicate(ctx)) return null;
			return ctx.target.closest(selector);
		},
		handle(ctx, el) {
			const e = ctx.event;

			if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
			if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();

			const targetSelector = el.getAttribute("data-dismiss");
			const dismissMode = el.getAttribute("data-dismiss-mode") || mode;

			// If no selector, find closest parent that looks dismissable
			let target;
			if (targetSelector) {
				target = document.querySelector(targetSelector);
			} else {
				// Find closest parent with common dismissable classes/roles
				target = el.closest(".alert, .toast, .modal, .notification, [role='alert']");
				if (!target) {
					target = el.parentElement;
				}
			}

			if (!target) {
				console.warn(`[dismissPlugin] Target not found: ${targetSelector}`);
				return true;
			}

			if (typeof onDismiss === "function") {
				onDismiss(ctx, el, target);
			}

			if (dismissMode === "hide") {
				target.classList.add(hideClass);
			} else {
				target.remove();
			}

			return true;
		},
	};
}
