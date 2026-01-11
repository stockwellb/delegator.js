// test/handler.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { createHandlerPlugin } from "../src/plugins/handler.js";
import { setupDOM, click } from "./helpers.js";

describe("createHandlerPlugin", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="btn1" data-handler="doSomething">Handler Button</button>
				<button id="btn2" data-handler="Nested.action">Nested Handler</button>
				<button id="btn3" data-handler="missing">Missing Handler</button>
				<button id="btn4">No Handler</button>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("throws if handlers is not an object", () => {
		assert.throws(
			() => createHandlerPlugin({ handlers: null }),
			/must be an object registry/
		);
	});

	test("dispatches to handler function", () => {
		const calls = [];
		const handlers = {
			doSomething: (e, el) => calls.push({ e, el }),
		};

		const plugin = createHandlerPlugin({ handlers });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("btn1");
		click(btn);

		assert.equal(calls.length, 1);
		assert.equal(calls[0].el, btn);
	});

	test("supports dot notation for nested handlers", () => {
		const calls = [];
		const handlers = {
			Nested: {
				action: (e, el) => calls.push(el.id),
			},
		};

		const plugin = createHandlerPlugin({ handlers });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn2"));
		assert.deepEqual(calls, ["btn2"]);
	});

	test("warns on missing handler", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = createHandlerPlugin({ handlers: {} });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn3"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("missing"));
	});

	test("onMissing callback overrides default warning", () => {
		const missing = [];
		const plugin = createHandlerPlugin({
			handlers: {},
			onMissing: (ctx, el, name) => missing.push(name),
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn3"));
		assert.deepEqual(missing, ["missing"]);
	});

	test("onInvoke callback intercepts handler call", () => {
		const invokes = [];
		const handlers = { doSomething: () => {} };

		const plugin = createHandlerPlugin({
			handlers,
			onInvoke: (ctx, el, fn, name) => {
				invokes.push(name);
				return "custom-result";
			},
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn1"));
		assert.deepEqual(invokes, ["doSomething"]);
	});

	test("preventDefault option (default true)", () => {
		const plugin = createHandlerPlugin({ handlers: { doSomething: () => {} } });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("btn1");
		const event = click(btn);

		assert.equal(event.defaultPrevented, true);
	});

	test("preventDefault: false does not prevent default", () => {
		const plugin = createHandlerPlugin({
			handlers: { doSomething: () => {} },
			preventDefault: false,
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const btn = document.getElementById("btn1");
		const event = click(btn);

		assert.equal(event.defaultPrevented, false);
	});

	test("plugin-level ignore option", () => {
		const calls = [];
		const handlers = { doSomething: () => calls.push("called") };

		const plugin = createHandlerPlugin({
			handlers,
			ignore: (ctx) => ctx.target?.id === "btn1",
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn1")); // Ignored
		assert.equal(calls.length, 0);
	});

	test("custom selector option", () => {
		dom = setupDOM(`<button id="custom" class="my-handler" data-handler="test">Custom</button>`);

		const calls = [];
		const handlers = { test: () => calls.push("called") };

		const plugin = createHandlerPlugin({
			handlers,
			selector: ".my-handler",
		});

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("custom"));
		assert.equal(calls.length, 1);
	});
});
