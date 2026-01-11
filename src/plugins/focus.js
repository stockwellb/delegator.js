// src/plugins/focus.js
// Focus plugin for delegator.js

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} FocusPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-focus]")
 * @property {boolean=} scroll - whether to scroll target into view (default true)
 * @property {ScrollBehavior=} scrollBehavior - scroll behavior: "smooth" | "instant" | "auto" (default "smooth")
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element, target: Element) => void=} onFocus - callback after focus
 */

/**
 * Create a focus plugin that moves focus to a target element.
 *
 * Attributes:
 * - data-focus: CSS selector for target element (required)
 * - data-focus-scroll: "true" or "false" to override scroll behavior
 *
 * Useful for skip links, form validation errors, and accessibility.
 *
 * @example
 * <a data-focus="#main-content">Skip to content</a>
 * <button data-focus="#email-input" data-focus-scroll="false">Fix email</button>
 *
 * @param {FocusPluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function focusPlugin(opts = {}) {
	const {
		selector = "[data-focus]",
		scroll = true,
		scrollBehavior = "smooth",
		preventDefault = true,
		stopPropagation = false,
		ignore = null,
		onFocus = null,
	} = opts;

	const ignorePredicate = normalizeIgnore(ignore);

	return {
		name: "focus",
		match(ctx) {
			if (!ctx.target) return null;
			if (ignorePredicate && ignorePredicate(ctx)) return null;
			return ctx.target.closest(selector);
		},
		handle(ctx, el) {
			const e = ctx.event;

			if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
			if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();

			const targetSelector = el.getAttribute("data-focus");
			if (!targetSelector) {
				console.warn("[focusPlugin] Empty data-focus attribute");
				return true;
			}

			const target = document.querySelector(targetSelector);
			if (!target) {
				console.warn(`[focusPlugin] Target not found: ${targetSelector}`);
				return true;
			}

			// Determine scroll behavior from attribute or option
			const scrollAttr = el.getAttribute("data-focus-scroll");
			const shouldScroll = scrollAttr !== null ? scrollAttr !== "false" : scroll;

			// Ensure element is focusable
			if (!target.hasAttribute("tabindex") && !isFocusable(target)) {
				target.setAttribute("tabindex", "-1");
			}

			// Focus the element
			target.focus({ preventScroll: !shouldScroll });

			// If scrolling is enabled and focus didn't scroll, scroll manually
			if (shouldScroll) {
				target.scrollIntoView({ behavior: scrollBehavior, block: "nearest" });
			}

			if (typeof onFocus === "function") {
				onFocus(ctx, el, target);
			}

			return true;
		},
	};
}

/**
 * Check if an element is natively focusable.
 * @param {Element} el
 * @returns {boolean}
 */
function isFocusable(el) {
	const focusableTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "DETAILS", "SUMMARY"];
	if (focusableTags.includes(el.tagName)) {
		// Links need href to be focusable
		if (el.tagName === "A" && !el.hasAttribute("href")) return false;
		// Form elements need to not be disabled
		if (el.disabled) return false;
		return true;
	}
	return el.hasAttribute("contenteditable");
}
