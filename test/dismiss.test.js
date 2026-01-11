// test/dismiss.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { dismissPlugin } from "../src/plugins/dismiss.js";
import { setupDOM, click } from "./helpers.js";

describe("dismissPlugin", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<div class="alert" id="alert1">
					Alert 1 <button id="dismiss-alert1" data-dismiss="#alert1">×</button>
				</div>
				<div class="alert" id="alert2">
					Alert 2 <button id="dismiss-parent" data-dismiss>×</button>
				</div>
				<div class="toast" id="toast1">
					Toast <button id="dismiss-toast" data-dismiss>×</button>
				</div>
				<div id="hide-target">
					Hideable <button id="dismiss-hide" data-dismiss="#hide-target" data-dismiss-mode="hide">Hide</button>
				</div>
				<button id="dismiss-missing" data-dismiss="#nonexistent">Missing</button>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("removes element by selector", () => {
		const plugin = dismissPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		assert.ok(document.getElementById("alert1"));
		click(document.getElementById("dismiss-alert1"));
		assert.ok(!document.getElementById("alert1"));
	});

	test("removes closest dismissable parent when no selector", () => {
		const plugin = dismissPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		assert.ok(document.getElementById("alert2"));
		click(document.getElementById("dismiss-parent"));
		assert.ok(!document.getElementById("alert2"));
	});

	test("finds closest .toast parent", () => {
		const plugin = dismissPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		assert.ok(document.getElementById("toast1"));
		click(document.getElementById("dismiss-toast"));
		assert.ok(!document.getElementById("toast1"));
	});

	test("hide mode adds class instead of removing", () => {
		const plugin = dismissPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const target = document.getElementById("hide-target");
		assert.ok(!target.classList.contains("hidden"));

		click(document.getElementById("dismiss-hide"));

		assert.ok(document.getElementById("hide-target")); // Still in DOM
		assert.ok(target.classList.contains("hidden"));
	});

	test("plugin-level mode option", () => {
		const plugin = dismissPlugin({ mode: "hide" });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const alert = document.getElementById("alert1");
		click(document.getElementById("dismiss-alert1"));

		assert.ok(document.getElementById("alert1")); // Still in DOM
		assert.ok(alert.classList.contains("hidden"));
	});

	test("custom hideClass option", () => {
		const plugin = dismissPlugin({ mode: "hide", hideClass: "is-hidden" });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const alert = document.getElementById("alert1");
		click(document.getElementById("dismiss-alert1"));

		assert.ok(alert.classList.contains("is-hidden"));
	});

	test("warns when target not found", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = dismissPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("dismiss-missing"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Target not found"));
	});

	test("onDismiss callback is called before dismiss", () => {
		const dismissals = [];
		const plugin = dismissPlugin({
			onDismiss: (ctx, el, target) => {
				dismissals.push({ el: el.id, target: target.id });
			},
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("dismiss-alert1"));

		assert.equal(dismissals.length, 1);
		assert.equal(dismissals[0].el, "dismiss-alert1");
		assert.equal(dismissals[0].target, "alert1");
	});

	test("preventDefault option (default true)", () => {
		const plugin = dismissPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("dismiss-alert1"));
		assert.equal(event.defaultPrevented, true);
	});

	test("ignore option works", () => {
		const plugin = dismissPlugin({
			ignore: "#dismiss-alert1",
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("dismiss-alert1"));
		assert.ok(document.getElementById("alert1")); // Should still exist
	});
});
