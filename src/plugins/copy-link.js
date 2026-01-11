// src/plugins/copy-link.js
// Copy link plugin for delegator.js

import { createCopyPlugin, defaultBuildURL } from "./utils.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} CopyLinkPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-copy-link]")
 * @property {(text: string, ctx: DelegatorContext, el: Element) => Promise<void>=} writeText - override clipboard write
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default true)
 * @property {boolean=} stopImmediate - call stopImmediatePropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(raw: string, ctx: DelegatorContext, el: Element) => string=} buildURL - custom URL builder
 * @property {(ctx: DelegatorContext, el: Element, url: string) => void=} onSuccess - callback on successful copy
 * @property {(ctx: DelegatorContext, el: Element, err: any) => void=} onError - callback on copy error
 */

/**
 * Create a copy-link plugin that copies a URL from [data-copy-link] to clipboard.
 * Hash values (e.g. "#section") are expanded to full URLs.
 *
 * @example
 * <button data-copy-link="#section1">Copy link to section</button>
 * <button data-copy-link="https://example.com">Copy URL</button>
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
