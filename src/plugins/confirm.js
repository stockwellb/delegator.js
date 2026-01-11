// src/plugins/confirm.js
// Confirm plugin for delegator.js

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} ConfirmPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-confirm]")
 * @property {string=} defaultMessage - default confirmation message (default "Are you sure?")
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default true)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element, message: string) => boolean=} confirmFn - custom confirm function
 * @property {(ctx: DelegatorContext, el: Element, message: string) => void=} onConfirm - callback when user confirms
 * @property {(ctx: DelegatorContext, el: Element, message: string) => void=} onCancel - callback when user cancels
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
					onConfirm(ctx, el, message);
				}
			} else {
				if (typeof onCancel === "function") {
					onCancel(ctx, el, message);
				}
			}

			return true;
		},
	};
}
