// test/helpers.js
// Shared test utilities for delegator.js tests

import { JSDOM } from "jsdom";

/**
 * Set up a JSDOM environment with the given HTML.
 * @param {string} html - HTML content for the body
 * @param {Object} options - JSDOM options
 * @returns {JSDOM}
 */
export function setupDOM(html = "<div id='root'></div>", options = {}) {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
		url: "https://example.com/page?tab=1",
		...options,
	});
	globalThis.document = dom.window.document;
	globalThis.window = dom.window;
	globalThis.Element = dom.window.Element;
	globalThis.location = dom.window.location;
	return dom;
}

/**
 * Simulate a click event on an element.
 * @param {Element} el - Element to click
 * @returns {MouseEvent}
 */
export function click(el) {
	const event = new globalThis.window.MouseEvent("click", {
		bubbles: true,
		cancelable: true,
	});
	el.dispatchEvent(event);
	return event;
}

/**
 * Create a mock writeText function for testing copy plugins.
 * @returns {Function & { calls: Array }}
 */
export function createMockWriteText() {
	const calls = [];
	const writeText = async (text, ctx, el) => {
		calls.push({ text, ctx, el });
	};
	writeText.calls = calls;
	return writeText;
}
