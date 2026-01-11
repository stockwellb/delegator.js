// src/plugins/utils.js
// Shared utilities for delegator.js plugins

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

// ---------------------------
// Copy plugin factory
// ---------------------------

/**
 * @param {Object} config
 * @param {string} config.name - plugin name
 * @param {string} config.selector - CSS selector
 * @param {string} config.attr - data attribute to read
 * @param {(raw: string, ctx: DelegatorContext, el: Element) => string} config.transform - transform raw value
 * @param {(ctx: DelegatorContext, el: Element, value: string) => void=} config.onSuccess
 * @param {(ctx: DelegatorContext, el: Element, err: any) => void=} config.onError
 * @param {(text: string, ctx: DelegatorContext, el: Element) => Promise<void>=} config.writeText
 * @param {boolean=} config.preventDefault
 * @param {boolean=} config.stopPropagation
 * @param {boolean=} config.stopImmediate
 * @param {string|IgnorePredicate|null=} config.ignore
 * @returns {DelegatorPlugin}
 */
export function createCopyPlugin(config) {
	const {
		name,
		selector,
		attr,
		transform,
		onSuccess,
		onError,
		writeText,
		preventDefault = true,
		stopPropagation = true,
		stopImmediate = false,
		ignore = null,
	} = config;

	const ignorePredicate = normalizeIgnore(ignore);

	return {
		name,
		match(ctx) {
			if (!ctx.target) return null;
			if (ignorePredicate && ignorePredicate(ctx)) return null;
			return ctx.target.closest(selector);
		},
		async handle(ctx, el) {
			const e = ctx.event;

			if (preventDefault && typeof e.preventDefault === "function") e.preventDefault();
			if (stopPropagation && typeof e.stopPropagation === "function") e.stopPropagation();
			if (stopImmediate && typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

			const raw = el.getAttribute(attr) ?? "";
			const value = transform(raw, ctx, el);

			try {
				await (writeText || defaultWriteText)(value, ctx, el);

				if (typeof onSuccess === "function") {
					onSuccess(ctx, el, value);
				}
			} catch (err) {
				if (typeof onError === "function") {
					onError(ctx, el, err);
				} else {
					console.error(`[${name}] Failed to copy:`, err);
				}
			}

			return true;
		},
	};
}

// ---------------------------
// Clipboard helpers
// ---------------------------

/**
 * Default clipboard write implementation.
 * Exported so users can wrap it rather than replace entirely.
 *
 * @param {string} text
 * @param {DelegatorContext} _ctx
 * @param {Element} _el
 * @returns {Promise<void>}
 */
export async function defaultWriteText(text, _ctx, _el) {
	const clipboard = globalThis?.navigator?.clipboard;
	if (!clipboard || typeof clipboard.writeText !== "function") {
		throw new Error("Clipboard API not available. Provide opts.writeText for tests or unsupported browsers.");
	}
	await clipboard.writeText(text);
}

/**
 * Default URL builder for copy-link.
 * Hashes are expanded to full URLs (preserving search params).
 * Exported for custom buildURL implementations that want to extend default behavior.
 *
 * @param {string} raw
 * @returns {string}
 */
export function defaultBuildURL(raw) {
	if (!raw) return "";
	if (raw.startsWith("#")) {
		// Build full URL from current location (preserves search params)
		const loc = globalThis?.location;
		if (!loc) return raw;
		return loc.origin + loc.pathname + loc.search + raw;
	}
	return raw;
}
