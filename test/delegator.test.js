// test/delegator.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator, normalizeIgnore } from "../src/delegator.js";
import { setupDOM, click } from "./helpers.js";

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

	test("context contains event, target, rootEl", () => {
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

	test("onHandle callback is called when plugin handles", () => {
		const handleCalls = [];
		const plugin = {
			name: "test-plugin",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => true,
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onHandle: (p, ctx, el) => handleCalls.push({ plugin: p.name, el: el.id }),
		});
		delegator.start();

		click(document.getElementById("btn1"));

		assert.equal(handleCalls.length, 1);
		assert.equal(handleCalls[0].plugin, "test-plugin");
		assert.equal(handleCalls[0].el, "btn1");
	});

	test("onHandle receives correct arguments", () => {
		let captured = null;
		const plugin = {
			name: "capture-plugin",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => true,
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onHandle: (p, ctx, el) => { captured = { p, ctx, el }; },
		});
		delegator.start();

		const btn = document.getElementById("btn1");
		click(btn);

		assert.equal(captured.p, plugin);
		assert.equal(captured.el, btn);
		assert.ok(captured.ctx.event instanceof globalThis.window.Event);
		assert.equal(captured.ctx.target, btn);
	});

	test("onHandle is not called when plugin returns false", () => {
		const handleCalls = [];
		const plugin = {
			name: "decline-plugin",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => false, // Declines to handle
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onHandle: (p) => handleCalls.push(p.name),
		});
		delegator.start();

		click(document.getElementById("btn1"));

		assert.equal(handleCalls.length, 0);
	});

	test("onHandle error is caught and logged", () => {
		const errors = [];
		const originalError = console.error;
		console.error = (...args) => errors.push(args);

		const plugin = {
			name: "test",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => true,
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onHandle: () => { throw new Error("onHandle boom"); },
		});
		delegator.start();

		click(document.getElementById("btn1"));

		console.error = originalError;
		assert.equal(errors.length, 1);
		assert.ok(errors[0][0].includes("onHandle callback error"));
	});

	test("onHandle is called for each handling plugin when stopOnHandle=false", () => {
		const handleCalls = [];
		const plugin1 = {
			name: "p1",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => true,
		};
		const plugin2 = {
			name: "p2",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => true,
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin1, plugin2],
			stopOnHandle: false,
			onHandle: (p) => handleCalls.push(p.name),
		});
		delegator.start();

		click(document.getElementById("btn1"));

		assert.deepEqual(handleCalls, ["p1", "p2"]);
	});

	test("onError is called when match throws", () => {
		const errors = [];
		const plugin = {
			name: "bad-match",
			match: () => { throw new Error("match boom"); },
			handle: () => true,
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onError: (err, p, ctx, phase) => errors.push({ err, plugin: p.name, phase }),
		});
		delegator.start();

		click(document.getElementById("btn1"));

		assert.equal(errors.length, 1);
		assert.equal(errors[0].plugin, "bad-match");
		assert.equal(errors[0].phase, "match");
		assert.ok(errors[0].err.message.includes("match boom"));
	});

	test("onError is called when handle throws", () => {
		const errors = [];
		const plugin = {
			name: "bad-handle",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => { throw new Error("handle boom"); },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onError: (err, p, ctx, phase) => errors.push({ err, plugin: p.name, phase }),
		});
		delegator.start();

		click(document.getElementById("btn1"));

		assert.equal(errors.length, 1);
		assert.equal(errors[0].plugin, "bad-handle");
		assert.equal(errors[0].phase, "handle");
		assert.ok(errors[0].err.message.includes("handle boom"));
	});

	test("onError is called when onHandle throws", () => {
		const errors = [];
		const plugin = {
			name: "good-plugin",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => true,
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onHandle: () => { throw new Error("onHandle boom"); },
			onError: (err, p, ctx, phase) => errors.push({ err, plugin: p.name, phase }),
		});
		delegator.start();

		click(document.getElementById("btn1"));

		assert.equal(errors.length, 1);
		assert.equal(errors[0].plugin, "good-plugin");
		assert.equal(errors[0].phase, "onHandle");
		assert.ok(errors[0].err.message.includes("onHandle boom"));
	});

	test("onError receives correct arguments", () => {
		let captured = null;
		const plugin = {
			name: "error-plugin",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => { throw new Error("test error"); },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			onError: (err, p, ctx, phase) => { captured = { err, p, ctx, phase }; },
		});
		delegator.start();

		const btn = document.getElementById("btn1");
		click(btn);

		assert.ok(captured.err instanceof Error);
		assert.equal(captured.err.message, "test error");
		assert.equal(captured.p, plugin);
		assert.ok(captured.ctx.event instanceof globalThis.window.Event);
		assert.equal(captured.ctx.target, btn);
		assert.equal(captured.phase, "handle");
	});

	test("console.error is used when onError is not provided", () => {
		const errors = [];
		const originalError = console.error;
		console.error = (...args) => errors.push(args);

		const plugin = {
			name: "bad-plugin",
			match: (ctx) => ctx.target?.closest("button"),
			handle: () => { throw new Error("no callback"); },
		};

		const delegator = createDelegator({
			root: document,
			plugins: [plugin],
			// No onError provided
		});
		delegator.start();

		click(document.getElementById("btn1"));

		console.error = originalError;
		assert.equal(errors.length, 1);
		assert.ok(errors[0][0].includes("bad-plugin"));
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
