// src/plugins/copy-text.js
// Copy text plugin for delegator.js

import { createCopyPlugin } from "./utils.js";

/**
 * @typedef {import("../delegator.js").DelegatorPlugin} DelegatorPlugin
 * @typedef {import("../delegator.js").DelegatorContext} DelegatorContext
 * @typedef {import("../delegator.js").IgnorePredicate} IgnorePredicate
 */

/**
 * @typedef {Object} CopyTextPluginOptions
 * @property {string=} selector - CSS selector for matching elements (default "[data-copy-text]")
 * @property {(text: string, ctx: DelegatorContext, el: Element) => Promise<void>=} writeText - override clipboard write
 * @property {boolean=} preventDefault - call preventDefault (default true)
 * @property {boolean=} stopPropagation - call stopPropagation (default true)
 * @property {boolean=} stopImmediate - call stopImmediatePropagation (default false)
 * @property {string|IgnorePredicate|null=} ignore - ignore zones (selector or predicate)
 * @property {(ctx: DelegatorContext, el: Element, text: string) => void=} onSuccess - callback on successful copy
 * @property {(ctx: DelegatorContext, el: Element, err: any) => void=} onError - callback on copy error
 */

/**
 * Create a copy-text plugin that copies the value of [data-copy-text] to clipboard.
 *
 * @example
 * <button data-copy-text="Hello, World!">Copy greeting</button>
 * <button data-copy-text="secret-code-123">Copy code</button>
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
