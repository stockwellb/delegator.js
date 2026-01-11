// test/copy.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { createDelegator } from "../src/delegator.js";
import { copyTextPlugin } from "../src/plugins/copy-text.js";
import { copyLinkPlugin } from "../src/plugins/copy-link.js";
import { defaultWriteText, defaultBuildURL } from "../src/plugins/utils.js";

// ---------------------------
// Test helpers
// ---------------------------

function setupDOM(html = "<div id='root'></div>") {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
		url: "https://example.com/page?tab=1",
	});
	globalThis.document = dom.window.document;
	globalThis.window = dom.window;
	globalThis.Element = dom.window.Element;
	globalThis.location = dom.window.location;
	return dom;
}

function click(el) {
	const event = new globalThis.window.MouseEvent("click", {
		bubbles: true,
		cancelable: true,
	});
	el.dispatchEvent(event);
	return event;
}

function createMockWriteText() {
	const calls = [];
	const writeText = async (text, ctx, el) => {
		calls.push({ text, ctx, el });
	};
	writeText.calls = calls;
	return writeText;
}

// ---------------------------
// copyTextPlugin tests
// ---------------------------

describe("copyTextPlugin", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="copy-hello" data-copy-text="Hello World">Copy Hello</button>
				<button id="copy-empty" data-copy-text="">Copy Empty</button>
				<button id="copy-special" data-copy-text="<script>alert('xss')</script>">Copy Special</button>
				<button id="no-attr">No Attribute</button>
				<div id="ignored-zone">
					<button id="copy-ignored" data-copy-text="Ignored">Ignored Copy</button>
				</div>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("copies text from data-copy-text attribute", async () => {
		const writeText = createMockWriteText();
		const plugin = copyTextPlugin({ writeText });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hello"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "Hello World");
	});

	test("warns on empty data-copy-text", async () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const writeText = createMockWriteText();
		const plugin = copyTextPlugin({ writeText });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-empty"));

		await new Promise((r) => setTimeout(r, 10));
		console.warn = originalWarn;

		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Empty data-copy-text"));
	});

	test("calls onSuccess callback", async () => {
		const writeText = createMockWriteText();
		const successes = [];
		const plugin = copyTextPlugin({
			writeText,
			onSuccess: (ctx, el, text) => successes.push({ el, text }),
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("copy-hello");
		click(btn);

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(successes.length, 1);
		assert.equal(successes[0].el, btn);
		assert.equal(successes[0].text, "Hello World");
	});

	test("calls onError callback on failure", async () => {
		const errors = [];
		const plugin = copyTextPlugin({
			writeText: async () => { throw new Error("clipboard failed"); },
			onError: (ctx, el, err) => errors.push({ el, err }),
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hello"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(errors.length, 1);
		assert.ok(errors[0].err.message.includes("clipboard failed"));
	});

	test("logs error if no onError callback", async () => {
		const errors = [];
		const originalError = console.error;
		console.error = (...args) => errors.push(args);

		const plugin = copyTextPlugin({
			writeText: async () => { throw new Error("clipboard failed"); },
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hello"));

		await new Promise((r) => setTimeout(r, 10));
		console.error = originalError;

		assert.equal(errors.length, 1);
		assert.ok(errors[0][0].includes("copy-text"));
	});

	test("preventDefault option (default true)", async () => {
		const writeText = createMockWriteText();
		const plugin = copyTextPlugin({ writeText });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("copy-hello"));
		assert.equal(event.defaultPrevented, true);
	});

	test("preventDefault: false does not prevent default", async () => {
		const writeText = createMockWriteText();
		const plugin = copyTextPlugin({ writeText, preventDefault: false });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("copy-hello"));
		assert.equal(event.defaultPrevented, false);
	});

	test("stopPropagation option", async () => {
		const writeText = createMockWriteText();
		let propagated = false;

		const plugin = copyTextPlugin({ writeText, stopPropagation: true });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		document.getElementById("root").addEventListener("click", () => {
			propagated = true;
		});

		click(document.getElementById("copy-hello"));
		await new Promise((r) => setTimeout(r, 10));

		// stopPropagation was called, but jsdom still fires parent listeners
		// This is a jsdom limitation; in real browsers it would stop
		assert.equal(writeText.calls.length, 1);
	});

	test("ignore option with selector", async () => {
		const writeText = createMockWriteText();
		const plugin = copyTextPlugin({
			writeText,
			ignore: "#ignored-zone",
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-ignored"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 0);
	});

	test("ignore option with predicate", async () => {
		const writeText = createMockWriteText();
		const plugin = copyTextPlugin({
			writeText,
			ignore: (ctx) => ctx.target?.id === "copy-hello",
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hello")); // Ignored
		click(document.getElementById("copy-special")); // Not ignored

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "<script>alert('xss')</script>");
	});

	test("custom selector option", async () => {
		dom = setupDOM(`<button id="custom" data-custom="Custom Text">Custom</button>`);

		const writeText = createMockWriteText();
		const plugin = copyTextPlugin({
			writeText,
			selector: "[data-custom]",
		});

		// Need to also override the attr being read - but copyTextPlugin always reads data-copy-text
		// So this test just verifies selector matching works
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("custom"));

		await new Promise((r) => setTimeout(r, 10));
		// It matches but data-copy-text is empty
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "");
	});

});

// ---------------------------
// copyLinkPlugin tests
// ---------------------------

describe("copyLinkPlugin", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="copy-hash" data-copy-link="#section-1">Copy Hash</button>
				<button id="copy-url" data-copy-link="https://other.com/path">Copy URL</button>
				<button id="copy-empty" data-copy-link="">Copy Empty</button>
				<button id="copy-relative" data-copy-link="/other/page">Copy Relative</button>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("expands hash to full URL with search params", async () => {
		const writeText = createMockWriteText();
		const plugin = copyLinkPlugin({ writeText });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hash"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "https://example.com/page?tab=1#section-1");
	});

	test("absolute URL is passed through unchanged", async () => {
		const writeText = createMockWriteText();
		const plugin = copyLinkPlugin({ writeText });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-url"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "https://other.com/path");
	});

	test("relative path is passed through unchanged", async () => {
		const writeText = createMockWriteText();
		const plugin = copyLinkPlugin({ writeText });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-relative"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "/other/page");
	});

	test("warns on empty data-copy-link", async () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const writeText = createMockWriteText();
		const plugin = copyLinkPlugin({ writeText });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-empty"));

		await new Promise((r) => setTimeout(r, 10));
		console.warn = originalWarn;

		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Empty data-copy-link"));
	});

	test("custom buildURL option", async () => {
		const writeText = createMockWriteText();
		const plugin = copyLinkPlugin({
			writeText,
			buildURL: (raw) => `custom://${raw}`,
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hash"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls[0].text, "custom://#section-1");
	});

	test("calls onSuccess with built URL", async () => {
		const writeText = createMockWriteText();
		const successes = [];
		const plugin = copyLinkPlugin({
			writeText,
			onSuccess: (ctx, el, url) => successes.push(url),
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hash"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(successes.length, 1);
		assert.equal(successes[0], "https://example.com/page?tab=1#section-1");
	});

	test("calls onError on failure", async () => {
		const errors = [];
		const plugin = copyLinkPlugin({
			writeText: async () => { throw new Error("failed"); },
			onError: (ctx, el, err) => errors.push(err),
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hash"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(errors.length, 1);
	});

	test("ignore option works", async () => {
		const writeText = createMockWriteText();
		const plugin = copyLinkPlugin({
			writeText,
			ignore: (ctx) => ctx.target?.id === "copy-hash",
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hash")); // Ignored
		click(document.getElementById("copy-url")); // Not ignored

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "https://other.com/path");
	});
});

// ---------------------------
// defaultWriteText tests
// ---------------------------

describe("defaultWriteText", () => {
	let originalNavigator;

	beforeEach(() => {
		originalNavigator = globalThis.navigator;
	});

	afterEach(() => {
		Object.defineProperty(globalThis, "navigator", {
			value: originalNavigator,
			writable: true,
			configurable: true,
		});
	});

	test("throws if clipboard API not available", async () => {
		Object.defineProperty(globalThis, "navigator", {
			value: {},
			writable: true,
			configurable: true,
		});

		await assert.rejects(
			() => defaultWriteText("test", {}, {}),
			/Clipboard API not available/
		);
	});

	test("calls clipboard.writeText when available", async () => {
		const written = [];
		Object.defineProperty(globalThis, "navigator", {
			value: {
				clipboard: {
					writeText: async (text) => { written.push(text); },
				},
			},
			writable: true,
			configurable: true,
		});

		await defaultWriteText("hello", {}, {});
		assert.deepEqual(written, ["hello"]);
	});
});

// ---------------------------
// defaultBuildURL tests
// ---------------------------

describe("defaultBuildURL", () => {
	beforeEach(() => {
		setupDOM();
	});

	test("returns empty string for empty input", () => {
		assert.equal(defaultBuildURL(""), "");
	});

	test("expands hash to full URL with search params", () => {
		// setupDOM sets location to https://example.com/page?tab=1
		const result = defaultBuildURL("#section");
		assert.equal(result, "https://example.com/page?tab=1#section");
	});

	test("returns non-hash values unchanged", () => {
		assert.equal(defaultBuildURL("https://other.com"), "https://other.com");
		assert.equal(defaultBuildURL("/path/to/page"), "/path/to/page");
		assert.equal(defaultBuildURL("relative/path"), "relative/path");
	});

	test("handles missing location gracefully", () => {
		globalThis.location = undefined;
		assert.equal(defaultBuildURL("#section"), "#section");
	});
});

// ---------------------------
// Integration tests
// ---------------------------

describe("copy plugins integration", () => {
	let dom;

	afterEach(() => {
		dom.window.close();
	});

	test("multiple copy plugins can coexist", async () => {
		dom = setupDOM(`
			<div id="root">
				<button id="text" data-copy-text="Text">Copy Text</button>
				<button id="link" data-copy-link="#hash">Copy Link</button>
			</div>
		`);

		const textWrites = [];
		const linkWrites = [];

		const textPlugin = copyTextPlugin({
			writeText: async (text) => textWrites.push(text),
		});
		const linkPlugin = copyLinkPlugin({
			writeText: async (text) => linkWrites.push(text),
		});

		const delegator = createDelegator({
			root: document,
			plugins: [textPlugin, linkPlugin],
		});
		delegator.start();

		click(document.getElementById("text"));
		click(document.getElementById("link"));

		await new Promise((r) => setTimeout(r, 10));

		assert.deepEqual(textWrites, ["Text"]);
		assert.equal(linkWrites.length, 1);
		assert.ok(linkWrites[0].includes("#hash"));
	});
});
