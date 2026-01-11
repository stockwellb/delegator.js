// test/disable.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { disablePlugin } from "../src/plugins/disable.js";
import { setupDOM, click } from "./helpers.js";

describe("disablePlugin", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="disable-btn" data-disable>Submit</button>
				<button id="disable-timed" data-disable="100">Submit (timed)</button>
				<button id="disable-custom-class" data-disable data-disable-class="btn-disabled">Custom</button>
				<button id="disable-custom-loading" data-disable data-loading-class="btn-loading">Loading</button>
				<button id="already-disabled" data-disable disabled>Already Disabled</button>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("disables element on click", () => {
		const plugin = disablePlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-btn");
		assert.ok(!btn.hasAttribute("disabled"));

		click(btn);

		assert.ok(btn.hasAttribute("disabled"));
		assert.ok(btn.classList.contains("is-disabled"));
		assert.ok(btn.classList.contains("is-loading"));
	});

	test("does not match already disabled elements", () => {
		const disables = [];
		const plugin = disablePlugin({
			onDisable: (_ctx, el) => disables.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("already-disabled"));

		assert.equal(disables.length, 0);
	});

	test("re-enables after duration", async () => {
		const plugin = disablePlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-timed");
		click(btn);

		assert.ok(btn.hasAttribute("disabled"));

		await new Promise((resolve) => setTimeout(resolve, 150));

		assert.ok(!btn.hasAttribute("disabled"));
		assert.ok(!btn.classList.contains("is-disabled"));
	});

	test("uses custom disabled class", () => {
		const plugin = disablePlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-custom-class");
		click(btn);

		assert.ok(btn.classList.contains("btn-disabled"));
		assert.ok(!btn.classList.contains("is-disabled"));
	});

	test("uses custom loading class", () => {
		const plugin = disablePlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-custom-loading");
		click(btn);

		assert.ok(btn.classList.contains("btn-loading"));
		assert.ok(!btn.classList.contains("is-loading"));
	});

	test("plugin-level duration option", async () => {
		const plugin = disablePlugin({ duration: 50 });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-btn");
		click(btn);

		assert.ok(btn.hasAttribute("disabled"));

		await new Promise((resolve) => setTimeout(resolve, 100));

		assert.ok(!btn.hasAttribute("disabled"));
	});

	test("onDisable callback is called", () => {
		const disables = [];
		const plugin = disablePlugin({
			onDisable: (_ctx, el) => disables.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("disable-btn"));

		assert.equal(disables.length, 1);
		assert.equal(disables[0], "disable-btn");
	});

	test("onEnable callback is called after duration", async () => {
		const enables = [];
		const plugin = disablePlugin({
			onEnable: (_ctx, el) => enables.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("disable-timed"));

		assert.equal(enables.length, 0);

		await new Promise((resolve) => setTimeout(resolve, 150));

		assert.equal(enables.length, 1);
		assert.equal(enables[0], "disable-timed");
	});

	test("manual enable via _delegatorEnable", () => {
		const plugin = disablePlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-btn");
		click(btn);

		assert.ok(btn.hasAttribute("disabled"));

		btn._delegatorEnable();

		assert.ok(!btn.hasAttribute("disabled"));
		assert.ok(!btn.classList.contains("is-disabled"));
	});

	test("plugin.enable() can re-enable element", () => {
		const plugin = disablePlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-btn");
		click(btn);

		assert.ok(btn.hasAttribute("disabled"));

		plugin.enable(btn);

		assert.ok(!btn.hasAttribute("disabled"));
	});

	test("preventDefault option (default true)", () => {
		const plugin = disablePlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("disable-btn"));
		assert.equal(event.defaultPrevented, true);
	});

	test("ignore option works", () => {
		const plugin = disablePlugin({
			ignore: "#disable-btn",
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("disable-btn");
		click(btn);
		assert.ok(!btn.hasAttribute("disabled"));
	});
});
