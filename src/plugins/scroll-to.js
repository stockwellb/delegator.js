// src/plugins/scroll-to.js
// Scroll-to plugin for delegator.js

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} ScrollToPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-scroll-to]")
 * @property {ScrollBehavior=} behavior - scroll behavior: "smooth" | "instant" | "auto" (default "smooth")
 * @property {ScrollLogicalPosition=} block - vertical alignment: "start" | "center" | "end" | "nearest" (default "start")
 * @property {ScrollLogicalPosition=} inline - horizontal alignment: "start" | "center" | "end" | "nearest" (default "nearest")
 * @property {number=} offset - pixel offset from top (for fixed headers, default 0)
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element, target: Element) => void=} onScroll - callback after scroll initiated
 */

/**
 * Create a scroll-to plugin that smoothly scrolls to a target element.
 *
 * Attributes:
 * - data-scroll-to: CSS selector for target element (required)
 * - data-scroll-behavior: "smooth" | "instant" | "auto" (optional, overrides plugin default)
 * - data-scroll-block: "start" | "center" | "end" | "nearest" (optional)
 * - data-scroll-offset: pixel offset for fixed headers (optional)
 *
 * @example
 * <a data-scroll-to="#section1">Go to Section 1</a>
 * <button data-scroll-to="#top" data-scroll-behavior="instant">Back to Top</button>
 * <a data-scroll-to="#content" data-scroll-offset="80">Content (with header offset)</a>
 *
 * @param {ScrollToPluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function scrollToPlugin(opts = {}) {
	const {
		selector = "[data-scroll-to]",
		behavior = "smooth",
		block = "start",
		inline = "nearest",
		offset = 0,
		preventDefault = true,
		stopPropagation = false,
		ignore = null,
		onScroll = null,
	} = opts;

	const ignorePredicate = normalizeIgnore(ignore);

	return {
		name: "scroll-to",
		match(ctx) {
			if (!ctx.target) return null;
			if (ignorePredicate && ignorePredicate(ctx)) return null;
			return ctx.target.closest(selector);
		},
		handle(ctx, el) {
			const e = ctx.event;

			if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
			if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();

			const targetSelector = el.getAttribute("data-scroll-to");
			if (!targetSelector) {
				console.warn("[scrollToPlugin] Empty data-scroll-to attribute");
				return true;
			}

			const target = document.querySelector(targetSelector);
			if (!target) {
				console.warn(`[scrollToPlugin] Target not found: ${targetSelector}`);
				return true;
			}

			// Get scroll options from attributes or use defaults
			const scrollBehavior = el.getAttribute("data-scroll-behavior") || behavior;
			const scrollBlock = el.getAttribute("data-scroll-block") || block;
			const scrollInline = el.getAttribute("data-scroll-inline") || inline;
			const scrollOffset = Number(el.getAttribute("data-scroll-offset")) || offset;

			if (scrollOffset !== 0) {
				// If there's an offset, we need to calculate position manually
				const targetRect = target.getBoundingClientRect();
				const absoluteTop = targetRect.top + window.pageYOffset - scrollOffset;

				window.scrollTo({
					top: absoluteTop,
					behavior: scrollBehavior,
				});
			} else {
				// Use native scrollIntoView
				target.scrollIntoView({
					behavior: scrollBehavior,
					block: scrollBlock,
					inline: scrollInline,
				});
			}

			if (typeof onScroll === "function") {
				onScroll(ctx, el, target);
			}

			return true;
		},
	};
}
