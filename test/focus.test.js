// test/focus.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { focusPlugin } from "../src/plugins/focus.js";
import { setupDOM, click } from "./helpers.js";

describe("focusPlugin", () => {
	let dom;
	let focusCalls;
	let scrollIntoViewCalls;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="focus-input" data-focus="#email-input">Focus Email</button>
				<button id="focus-div" data-focus="#content-section">Focus Section</button>
				<button id="focus-no-scroll" data-focus="#email-input" data-focus-scroll="false">Focus No Scroll</button>
				<button id="focus-missing" data-focus="#nonexistent">Missing</button>
				<button id="focus-empty" data-focus="">Empty</button>
				<input id="email-input" type="email" placeholder="Email">
				<div id="content-section">Content here</div>
				<a id="focusable-link" href="#">Link</a>
				<button id="focusable-btn">Button</button>
			</div>
		`);

		focusCalls = [];
		scrollIntoViewCalls = [];

		const origFocus = dom.window.HTMLElement.prototype.focus;
		dom.window.HTMLElement.prototype.focus = function (opts) {
			focusCalls.push({ element: this, opts });
			origFocus.call(this);
		};

		dom.window.Element.prototype.scrollIntoView = function (opts) {
			scrollIntoViewCalls.push({ element: this, opts });
		};
	});

	afterEach(() => {
		dom.window.close();
	});

	test("focuses target element", () => {
		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-input"));

		assert.ok(focusCalls.some((c) => c.element.id === "email-input"));
	});

	test("adds tabindex to non-focusable elements", () => {
		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const div = document.getElementById("content-section");
		assert.ok(!div.hasAttribute("tabindex"));

		click(document.getElementById("focus-div"));

		assert.equal(div.getAttribute("tabindex"), "-1");
	});

	test("does not add tabindex to natively focusable elements", () => {
		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const input = document.getElementById("email-input");
		assert.ok(!input.hasAttribute("tabindex"));

		click(document.getElementById("focus-input"));

		assert.ok(!input.hasAttribute("tabindex"));
	});

	test("scrolls by default", () => {
		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-input"));

		assert.ok(scrollIntoViewCalls.length > 0);
	});

	test("data-focus-scroll='false' prevents scrolling", () => {
		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-no-scroll"));

		const focusCall = focusCalls.find((c) => c.element.id === "email-input");
		assert.ok(focusCall);
		assert.equal(focusCall.opts.preventScroll, true);
	});

	test("plugin-level scroll: false option", () => {
		const plugin = focusPlugin({ scroll: false });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-input"));

		const focusCall = focusCalls.find((c) => c.element.id === "email-input");
		assert.equal(focusCall.opts.preventScroll, true);
	});

	test("warns when target not found", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-missing"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Target not found"));
	});

	test("warns on empty data-focus", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-empty"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Empty data-focus"));
	});

	test("onFocus callback is called", () => {
		const focuses = [];
		const plugin = focusPlugin({
			onFocus: (ctx, el, target) => {
				focuses.push({ el: el.id, target: target.id });
			},
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-input"));

		assert.equal(focuses.length, 1);
		assert.equal(focuses[0].el, "focus-input");
		assert.equal(focuses[0].target, "email-input");
	});

	test("preventDefault option (default true)", () => {
		const plugin = focusPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("focus-input"));
		assert.equal(event.defaultPrevented, true);
	});

	test("ignore option works", () => {
		const plugin = focusPlugin({
			ignore: "#focus-input",
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("focus-input"));
		assert.ok(!focusCalls.some((c) => c.element.id === "email-input"));
	});
});
