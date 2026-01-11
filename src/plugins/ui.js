// src/plugins/ui.js
// UI interaction plugins for delegator.js
//
// Provides:
// - toggleClassPlugin: [data-toggle-class] toggles classes on a target element
// - dismissPlugin: [data-dismiss] removes or hides an element
// - scrollToPlugin: [data-scroll-to] smoothly scrolls to a target element
// - disablePlugin: [data-disable] disables elements during async operations
// - focusPlugin: [data-focus] moves focus to a target element
// - confirmPlugin: [data-confirm] shows confirmation dialog before proceeding

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

/**
 * @typedef {Object} ConfirmPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-confirm]")
 * @property {string=} defaultMessage - default confirmation message (default "Are you sure?")
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default true)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element, message: string) => boolean=} confirmFn - custom confirm function
 * @property {(ctx: DelegatorContext, el: Element) => void=} onConfirm - callback when user confirms
 * @property {(ctx: DelegatorContext, el: Element) => void=} onCancel - callback when user cancels
 */

/**
 * Create a confirm plugin that shows a confirmation dialog before proceeding.
 *
 * Attributes:
 * - data-confirm: The confirmation message to show (required)
 *
 * The plugin prevents the default action and stops propagation.
 * If the user confirms, onConfirm is called. If canceled, onCancel is called.
 *
 * @example
 * <button data-confirm="Delete this item?">Delete</button>
 * <a href="/logout" data-confirm="Are you sure you want to log out?">Logout</a>
 *
 * @param {ConfirmPluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function confirmPlugin(opts = {}) {
	const {
		selector = "[data-confirm]",
		defaultMessage = "Are you sure?",
		preventDefault = true,
		stopPropagation = true,
		ignore = null,
		confirmFn = null,
		onConfirm = null,
		onCancel = null,
	} = opts;

	const ignorePredicate = normalizeIgnore(ignore);

	// Default confirm function uses browser's confirm()
	const doConfirm = confirmFn || ((_ctx, _el, message) => confirm(message));

	return {
		name: "confirm",
		match(ctx) {
			if (!ctx.target) return null;
			if (ignorePredicate && ignorePredicate(ctx)) return null;
			return ctx.target.closest(selector);
		},
		handle(ctx, el) {
			const e = ctx.event;

			if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
			if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();

			const message = el.getAttribute("data-confirm") || defaultMessage;

			if (doConfirm(ctx, el, message)) {
				if (typeof onConfirm === "function") {
					onConfirm(ctx, el);
				}
			} else {
				if (typeof onCancel === "function") {
					onCancel(ctx, el);
				}
			}

			return true;
		},
	};
}
