// test/copy-text.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { copyTextPlugin } from "../src/plugins/copy-text.js";
import { setupDOM, click, createMockWriteText } from "./helpers.js";

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

		const plugin = copyTextPlugin({ writeText, stopPropagation: true });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("copy-hello"));
		await new Promise((r) => setTimeout(r, 10));

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

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("custom"));

		await new Promise((r) => setTimeout(r, 10));
		assert.equal(writeText.calls.length, 1);
		assert.equal(writeText.calls[0].text, "");
	});
});
