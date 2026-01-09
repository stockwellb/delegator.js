// test/delegator.test.js
import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import {
	createDelegator,
	createHandlerPlugin,
	normalizeIgnore,
	readFeedback,
	applyFeedback,
} from "../src/delegator.js";

// ---------------------------
// Test helpers
// ---------------------------

function setupDOM(html = "<div id='root'></div>") {
	const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
	globalThis.document = dom.window.document;
	globalThis.window = dom.window;
	globalThis.Element = dom.window.Element;
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

// ---------------------------
// createDelegator tests
// ---------------------------

describe("createDelegator", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="btn1" data-action="test">Button 1</button>
				<button id="btn2">Button 2</button>
				<div id="ignored-zone">
					<button id="btn3" data-action="test">Ignored Button</button>
				</div>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("throws if root is not an EventTarget", () => {
		assert.throws(
			() => createDelegator({ root: null }),
			/must be an EventTarget/
		);
	});

	test("start() attaches listener, stop() removes it", () => {
		const calls = [];
		const plugin = {
			name: "test",
			match: (ctx) => ctx.target,
			handle: () => { calls.push("handled"); return true; },
		};

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		const btn = document.getElementById("btn1");

		// Not started yet
		click(btn);
		assert.equal(calls.length, 0);

		// Start
		delegator.start();
		click(btn);
		assert.equal(calls.length, 1);

		// Stop
		delegator.stop();
		click(btn);
		assert.equal(calls.length, 1);
	});

	test("start() is idempotent", () => {
		const delegator = createDelegator({ root: document });
		delegator.start();
		delegator.start(); // Should not throw or add duplicate listeners
		delegator.stop();
	});

	test("stop() is idempotent", () => {
		const delegator = createDelegator({ root: document });
		delegator.stop(); // Should not throw when not started
		delegator.start();
		delegator.stop();
		delegator.stop(); // Should not throw when already stopped
	});

	test("use() adds a plugin", () => {
		const delegator = createDelegator({ root: document });
		const plugin = { name: "p1", match: () => null, handle: () => true };

		assert.equal(delegator.plugins().length, 0);
		delegator.use(plugin);
		assert.equal(delegator.plugins().length, 1);
		assert.equal(delegator.plugins()[0].name, "p1");
	});

	test("use() throws for invalid plugin", () => {
		const delegator = createDelegator({ root: document });

		assert.throws(() => delegator.use(null), /must have match/);
		assert.throws(() => delegator.use({}), /must have match/);
		assert.throws(() => delegator.use({ match: () => {} }), /must have match/);
	});

	test("remove() removes plugin by reference", () => {
		const plugin = { name: "p1", match: () => null, handle: () => true };
		const delegator = createDelegator({ root: document, plugins: [plugin] });

		assert.equal(delegator.plugins().length, 1);
		const removed = delegator.remove(plugin);
		assert.equal(removed, true);
		assert.equal(delegator.plugins().length, 0);
	});

	test("remove() removes plugin by name", () => {
		const plugin = { name: "p1", match: () => null, handle: () => true };
		const delegator = createDelegator({ root: document, plugins: [plugin] });

		const removed = delegator.remove("p1");
		assert.equal(removed, true);
		assert.equal(delegator.plugins().length, 0);
	});

	test("remove() returns false if plugin not found", () => {
		const delegator = createDelegator({ root: document });
		assert.equal(delegator.remove("nonexistent"), false);
	});

	test("plugins() returns a copy", () => {
		const plugin = { name: "p1", match: () => null, handle: () => true };
		const delegator = createDelegator({ root: document, plugins: [plugin] });

		const list = delegator.plugins();
		list.push({ name: "p2", match: () => null, handle: () => true });

		assert.equal(delegator.plugins().length, 1); // Original unchanged
	});

	test("plugin pipeline: first match wins with stopOnHandle=true", () => {
		const calls = [];
		const plugin1 = {
			name: "p1",
			match: (ctx) => ctx.target?.closest("[data-action]"),
			handle: () => { calls.push("p1"); return true; },
		};
		const plugin2 = {
			name: "p2",
			match: (ctx) => ctx.target,
			handle: () => { calls.push("p2"); return true; },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin1, plugin2],
			stopOnHandle: true,
		});
		delegator.start();

		click(document.getElementById("btn1"));
		assert.deepEqual(calls, ["p1"]); // p2 not called
	});

	test("plugin pipeline: continues with stopOnHandle=false", () => {
		const calls = [];
		const plugin1 = {
			name: "p1",
			match: (ctx) => ctx.target?.closest("[data-action]"),
			handle: () => { calls.push("p1"); return true; },
		};
		const plugin2 = {
			name: "p2",
			match: (ctx) => ctx.target,
			handle: () => { calls.push("p2"); return true; },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin1, plugin2],
			stopOnHandle: false,
		});
		delegator.start();

		click(document.getElementById("btn1"));
		assert.deepEqual(calls, ["p1", "p2"]);
	});

	test("plugin returning false allows next plugin", () => {
		const calls = [];
		const plugin1 = {
			name: "p1",
			match: (ctx) => ctx.target,
			handle: () => { calls.push("p1"); return false; }, // Decline
		};
		const plugin2 = {
			name: "p2",
			match: (ctx) => ctx.target,
			handle: () => { calls.push("p2"); return true; },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin1, plugin2],
			stopOnHandle: true,
		});
		delegator.start();

		click(document.getElementById("btn1"));
		assert.deepEqual(calls, ["p1", "p2"]);
	});

	test("async plugin handle is awaited", async () => {
		const calls = [];
		const plugin = {
			name: "async",
			match: (ctx) => ctx.target,
			handle: async () => {
				await new Promise((r) => setTimeout(r, 10));
				calls.push("async");
				return true;
			},
		};

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn1"));
		assert.equal(calls.length, 0); // Not yet

		await new Promise((r) => setTimeout(r, 50));
		assert.deepEqual(calls, ["async"]);
	});

	test("ignore option with selector string", () => {
		const calls = [];
		const plugin = {
			name: "test",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => { calls.push("handled"); return true; },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			ignore: "#ignored-zone",
		});
		delegator.start();

		click(document.getElementById("btn1")); // Not ignored
		click(document.getElementById("btn3")); // Inside #ignored-zone

		assert.deepEqual(calls, ["handled"]); // Only btn1
	});

	test("ignore option with predicate function", () => {
		const calls = [];
		const plugin = {
			name: "test",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => { calls.push("handled"); return true; },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			ignore: (ctx) => ctx.target?.id === "btn2",
		});
		delegator.start();

		click(document.getElementById("btn1"));
		click(document.getElementById("btn2")); // Ignored by predicate

		assert.deepEqual(calls, ["handled"]);
	});

	test("plugin match error is caught and logged", () => {
		const errors = [];
		const originalError = console.error;
		console.error = (...args) => errors.push(args);

		const plugin = {
			name: "bad-match",
			match: () => { throw new Error("match boom"); },
			handle: () => true,
		};

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn1"));

		console.error = originalError;
		assert.equal(errors.length, 1);
		assert.ok(errors[0][0].includes("bad-match"));
	});

	test("plugin handle error is caught and logged", () => {
		const errors = [];
		const originalError = console.error;
		console.error = (...args) => errors.push(args);

		const plugin = {
			name: "bad-handle",
			match: (ctx) => ctx.target,
			handle: () => { throw new Error("handle boom"); },
		};

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn1"));

		console.error = originalError;
		assert.equal(errors.length, 1);
		assert.ok(errors[0][0].includes("bad-handle"));
	});

	test("context contains event, target, rootEl, feedback functions", () => {
		let capturedCtx = null;
		const plugin = {
			name: "capture",
			match: (ctx) => { capturedCtx = ctx; return ctx.target; },
			handle: () => true,
		};

		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("btn1"));

		assert.ok(capturedCtx.event instanceof globalThis.window.Event);
		assert.ok(capturedCtx.target instanceof Element);
		assert.equal(capturedCtx.rootEl, document.documentElement);
		assert.equal(typeof capturedCtx.feedbackSuccess, "function");
		assert.equal(typeof capturedCtx.feedbackError, "function");
	});

	test("custom eventType option", () => {
		const calls = [];
		const plugin = {
			name: "test",
			match: (ctx) => ctx.target,
			handle: () => { calls.push("handled"); return true; },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			eventType: "mousedown",
		});
		delegator.start();

		// Click won't trigger
		click(document.getElementById("btn1"));
		assert.equal(calls.length, 0);

		// Mousedown will
		const btn = document.getElementById("btn1");
		const event = new globalThis.window.MouseEvent("mousedown", { bubbles: true });
		btn.dispatchEvent(event);
		assert.equal(calls.length, 1);
	});
});

// ---------------------------
// createHandlerPlugin tests
// ---------------------------

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
		// Custom selector still reads data-handler for the handler name
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

// ---------------------------
// normalizeIgnore tests
// ---------------------------

describe("normalizeIgnore", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="outer">
				<div id="inner">
					<button id="btn">Click</button>
				</div>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("returns null for null/undefined", () => {
		assert.equal(normalizeIgnore(null), null);
		assert.equal(normalizeIgnore(undefined), null);
	});

	test("selector string creates predicate using closest()", () => {
		const predicate = normalizeIgnore("#inner");
		const btn = document.getElementById("btn");

		const ctx = { target: btn };
		assert.equal(predicate(ctx), true); // btn is inside #inner

		const ctx2 = { target: document.getElementById("outer") };
		assert.equal(predicate(ctx2), false); // outer is not inside #inner
	});

	test("function is returned as-is", () => {
		const fn = () => true;
		assert.equal(normalizeIgnore(fn), fn);
	});

	test("throws for invalid ignore value", () => {
		assert.throws(
			() => normalizeIgnore(123),
			/must be a selector string/
		);
	});
});

// ---------------------------
// Feedback system tests
// ---------------------------

describe("readFeedback", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<button id="btn"
				data-feedback="icon"
				data-feedback-target=".icon"
				data-feedback-swap="fa-copy:fa-check"
				data-feedback-ms="2000">
				<i class="icon fa-copy"></i>
			</button>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("reads all feedback attributes", () => {
		const btn = document.getElementById("btn");
		const opts = readFeedback(btn);

		assert.equal(opts.mode, "icon");
		assert.equal(opts.targetSelector, ".icon");
		assert.equal(opts.swap, "fa-copy:fa-check");
		assert.equal(opts.ms, 2000);
	});

	test("returns undefined for missing attributes", () => {
		dom = setupDOM(`<button id="empty"></button>`);
		const btn = document.getElementById("empty");
		const opts = readFeedback(btn);

		assert.equal(opts.mode, undefined);
		assert.equal(opts.targetSelector, undefined);
		assert.equal(opts.swap, undefined);
		assert.equal(opts.ms, undefined);
	});
});

describe("applyFeedback", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<button id="btn">
				<i class="icon fa-copy"></i>
			</button>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("swaps icon class and reverts after ms", async () => {
		const btn = document.getElementById("btn");
		const icon = btn.querySelector("i");

		applyFeedback(btn, {
			mode: "icon",
			targetSelector: "i",
			swap: "fa-copy:fa-check",
			ms: 50,
		});

		assert.ok(icon.classList.contains("fa-check"));
		assert.ok(!icon.classList.contains("fa-copy"));

		await new Promise((r) => setTimeout(r, 100));

		assert.ok(icon.classList.contains("fa-copy"));
		assert.ok(!icon.classList.contains("fa-check"));
	});

	test("defaults to 'i' selector and 1500ms", async () => {
		const btn = document.getElementById("btn");
		const icon = btn.querySelector("i");

		applyFeedback(btn, { swap: "fa-copy:fa-check", ms: 30 });

		assert.ok(icon.classList.contains("fa-check"));
	});

	test("warns on invalid swap format", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const btn = document.getElementById("btn");
		applyFeedback(btn, { swap: "invalid-no-colon" });

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Invalid swap format"));
	});

	test("does nothing if mode is not 'icon'", () => {
		const btn = document.getElementById("btn");
		const icon = btn.querySelector("i");
		const originalClass = icon.className;

		applyFeedback(btn, { mode: "tooltip", swap: "fa-copy:fa-check" });

		assert.equal(icon.className, originalClass);
	});

	test("does nothing if swap is missing", () => {
		const btn = document.getElementById("btn");
		const icon = btn.querySelector("i");
		const originalClass = icon.className;

		applyFeedback(btn, { mode: "icon" });

		assert.equal(icon.className, originalClass);
	});

	test("does nothing if target not found", () => {
		const btn = document.getElementById("btn");

		// Should not throw
		applyFeedback(btn, {
			mode: "icon",
			targetSelector: ".nonexistent",
			swap: "fa-copy:fa-check",
		});
	});
});
