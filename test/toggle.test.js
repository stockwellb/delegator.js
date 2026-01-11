// test/toggle.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { toggleClassPlugin } from "../src/plugins/toggle.js";
import { setupDOM, click } from "./helpers.js";

describe("toggleClassPlugin", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="toggle-self" data-toggle-class="active">Toggle Self</button>
				<button id="toggle-target" data-toggle-class="hidden" data-toggle-target="#menu">Toggle Menu</button>
				<div id="menu" class="menu">Menu Content</div>
				<button id="toggle-multiple" data-toggle-class="open expanded" data-toggle-target="#panel">Toggle Multiple</button>
				<div id="panel" class="panel">Panel Content</div>
				<button id="toggle-empty" data-toggle-class="">Empty Toggle</button>
				<button id="toggle-missing" data-toggle-class="foo" data-toggle-target="#nonexistent">Missing Target</button>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("toggles class on self when no target specified", () => {
		const plugin = toggleClassPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("toggle-self");
		assert.ok(!btn.classList.contains("active"));

		click(btn);
		assert.ok(btn.classList.contains("active"));

		click(btn);
		assert.ok(!btn.classList.contains("active"));
	});

	test("toggles class on target element", () => {
		const plugin = toggleClassPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("toggle-target");
		const menu = document.getElementById("menu");
		assert.ok(!menu.classList.contains("hidden"));

		click(btn);
		assert.ok(menu.classList.contains("hidden"));

		click(btn);
		assert.ok(!menu.classList.contains("hidden"));
	});

	test("toggles multiple classes", () => {
		const plugin = toggleClassPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("toggle-multiple");
		const panel = document.getElementById("panel");

		click(btn);
		assert.ok(panel.classList.contains("open"));
		assert.ok(panel.classList.contains("expanded"));

		click(btn);
		assert.ok(!panel.classList.contains("open"));
		assert.ok(!panel.classList.contains("expanded"));
	});

	test("warns on empty data-toggle-class", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = toggleClassPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("toggle-empty"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Empty data-toggle-class"));
	});

	test("warns when target not found", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = toggleClassPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("toggle-missing"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Target not found"));
	});

	test("preventDefault option (default true)", () => {
		const plugin = toggleClassPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("toggle-self"));
		assert.equal(event.defaultPrevented, true);
	});

	test("preventDefault: false does not prevent default", () => {
		const plugin = toggleClassPlugin({ preventDefault: false });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("toggle-self"));
		assert.equal(event.defaultPrevented, false);
	});

	test("onToggle callback is called", () => {
		const toggles = [];
		const plugin = toggleClassPlugin({
			onToggle: (ctx, el, target, classes) => {
				toggles.push({ el: el.id, target: target.id, classes });
			},
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("toggle-target"));

		assert.equal(toggles.length, 1);
		assert.equal(toggles[0].el, "toggle-target");
		assert.equal(toggles[0].target, "menu");
		assert.deepEqual(toggles[0].classes, ["hidden"]);
	});

	test("ignore option works", () => {
		const plugin = toggleClassPlugin({
			ignore: "#toggle-self",
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("toggle-self");
		click(btn);
		assert.ok(!btn.classList.contains("active")); // Should not toggle
	});
});
