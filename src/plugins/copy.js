// src/plugins/copy.js
// Copy plugins for delegator.js
//
// Provides:
// - copyTextPlugin: [data-copy-text] copies plain text
// - copyLinkPlugin: [data-copy-link] copies a URL (hash → full URL; absolute URL left as-is)
//
// Both plugins:
// - use event delegation via closest()
// - preventDefault + stopPropagation by default (configurable)
// - optionally stopImmediatePropagation (configurable)
// - call ctx.feedbackSuccess / ctx.feedbackError (declarative feedback via data-feedback-*)
// - allow injection of writeText() for testing (jsdom) or custom clipboard handling
// - support ignore zones (selector string or predicate)

import { normalizeIgnore } from "../delegator.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").FeedbackOptions} FeedbackOptions
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} CopyPluginBaseOptions
 * @property {string=} selector - CSS selector for matching elements
 * @property {(text: string, ctx: DelegatorContext, el: Element) => Promise<void>=} writeText - override clipboard write
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default true)
 * @property {boolean=} stopImmediate - call stopImmediatePropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {FeedbackOptions=} feedbackSuccess - override feedback on success
 * @property {FeedbackOptions=} feedbackError - override feedback on error
 */

/**
 * @typedef {CopyPluginBaseOptions & {
 *   onSuccess?: (ctx: DelegatorContext, el: Element, text: string) => void,
 *   onError?: (ctx: DelegatorContext, el: Element, err: any) => void
 * }} CopyTextPluginOptions
 */

/**
 * @typedef {CopyPluginBaseOptions & {
 *   onSuccess?: (ctx: DelegatorContext, el: Element, url: string) => void,
 *   onError?: (ctx: DelegatorContext, el: Element, err: any) => void,
 *   buildURL?: (raw: string, ctx: DelegatorContext, el: Element) => string
 * }} CopyLinkPluginOptions
 */

/**
 * Create a copy-text plugin that copies the value of [data-copy-text] to clipboard.
 *
 * @param {CopyTextPluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function copyTextPlugin(opts = {}) {
	const { selector = "[data-copy-text]", onSuccess, onError, ...baseOpts } = opts;

	return createCopyPlugin({
		name: "copy-text",
		selector,
		attr: "data-copy-text",
		transform: (text, _ctx, _el) => {
			if (!text) {
				console.warn("[copyTextPlugin] Empty data-copy-text attribute");
			}
			return text;
		},
		onSuccess,
		onError,
		...baseOpts,
	});
}

/**
 * Create a copy-link plugin that copies a URL from [data-copy-link] to clipboard.
 * Hash values (e.g. "#section") are expanded to full URLs.
 *
 * @param {CopyLinkPluginOptions=} opts
 * @returns {DelegatorPlugin}
 */
export function copyLinkPlugin(opts = {}) {
	const { selector = "[data-copy-link]", buildURL, onSuccess, onError, ...baseOpts } = opts;

	return createCopyPlugin({
		name: "copy-link",
		selector,
		attr: "data-copy-link",
		transform: (raw, ctx, el) => {
			if (!raw) {
				console.warn("[copyLinkPlugin] Empty data-copy-link attribute");
			}
			return typeof buildURL === "function" ? buildURL(raw, ctx, el) : defaultBuildURL(raw);
		},
		onSuccess,
		onError,
		...baseOpts,
	});
}

// ---------------------------
// Shared factory
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
 * @param {FeedbackOptions=} config.feedbackSuccess
 * @param {FeedbackOptions=} config.feedbackError
 * @returns {DelegatorPlugin}
 */
function createCopyPlugin(config) {
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
		feedbackSuccess,
		feedbackError,
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

				ctx.feedbackSuccess(el, feedbackSuccess);

				if (typeof onSuccess === "function") {
					onSuccess(ctx, el, value);
				}
			} catch (err) {
				ctx.feedbackError(el, feedbackError);
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
// Helpers (exported for wrapping/testing)
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
