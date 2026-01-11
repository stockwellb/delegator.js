// test/copy-link.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { copyLinkPlugin } from "../src/plugins/copy-link.js";
import { setupDOM, click, createMockWriteText } from "./helpers.js";

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
