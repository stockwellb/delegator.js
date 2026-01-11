// test/scroll-to.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { scrollToPlugin } from "../src/plugins/scroll-to.js";
import { setupDOM, click } from "./helpers.js";

describe("scrollToPlugin", () => {
	let dom;
	let scrollIntoViewCalls;
	let scrollToCalls;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<nav>
					<button id="scroll-to-section1" data-scroll-to="#section1">Section 1</button>
					<button id="scroll-to-section2" data-scroll-to="#section2" data-scroll-behavior="instant">Section 2</button>
					<button id="scroll-to-section3" data-scroll-to="#section3" data-scroll-block="center">Section 3</button>
					<button id="scroll-with-offset" data-scroll-to="#section1" data-scroll-offset="80">With Offset</button>
					<button id="scroll-to-missing" data-scroll-to="#nonexistent">Missing</button>
					<button id="scroll-empty" data-scroll-to="">Empty</button>
				</nav>
				<section id="section1">Section 1</section>
				<section id="section2">Section 2</section>
				<section id="section3">Section 3</section>
			</div>
		`);

		// Mock scrollIntoView and scrollTo since jsdom doesn't fully support them
		scrollIntoViewCalls = [];
		scrollToCalls = [];

		dom.window.Element.prototype.scrollIntoView = function (opts) {
			scrollIntoViewCalls.push({ element: this, opts });
		};

		dom.window.scrollTo = (opts) => {
			scrollToCalls.push(opts);
		};

		dom.window.Element.prototype.getBoundingClientRect = function () {
			return { top: 500, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
		};

		Object.defineProperty(dom.window, "pageYOffset", { value: 100, writable: true });
	});

	afterEach(() => {
		dom.window.close();
	});

	test("scrolls to target element", () => {
		const plugin = scrollToPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-section1"));

		assert.equal(scrollIntoViewCalls.length, 1);
		assert.equal(scrollIntoViewCalls[0].element.id, "section1");
		assert.equal(scrollIntoViewCalls[0].opts.behavior, "smooth");
		assert.equal(scrollIntoViewCalls[0].opts.block, "start");
	});

	test("respects data-scroll-behavior attribute", () => {
		const plugin = scrollToPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-section2"));

		assert.equal(scrollIntoViewCalls.length, 1);
		assert.equal(scrollIntoViewCalls[0].opts.behavior, "instant");
	});

	test("respects data-scroll-block attribute", () => {
		const plugin = scrollToPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-section3"));

		assert.equal(scrollIntoViewCalls.length, 1);
		assert.equal(scrollIntoViewCalls[0].opts.block, "center");
	});

	test("uses window.scrollTo when offset is specified", () => {
		const plugin = scrollToPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-with-offset"));

		assert.equal(scrollIntoViewCalls.length, 0);
		assert.equal(scrollToCalls.length, 1);
		assert.equal(scrollToCalls[0].top, 520);
		assert.equal(scrollToCalls[0].behavior, "smooth");
	});

	test("plugin-level offset option", () => {
		const plugin = scrollToPlugin({ offset: 60 });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-section1"));

		assert.equal(scrollIntoViewCalls.length, 0);
		assert.equal(scrollToCalls.length, 1);
		assert.equal(scrollToCalls[0].top, 540);
	});

	test("warns when target not found", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = scrollToPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-missing"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Target not found"));
	});

	test("warns on empty data-scroll-to", () => {
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args);

		const plugin = scrollToPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-empty"));

		console.warn = originalWarn;
		assert.equal(warnings.length, 1);
		assert.ok(warnings[0][0].includes("Empty data-scroll-to"));
	});

	test("preventDefault option (default true)", () => {
		const plugin = scrollToPlugin();
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("scroll-to-section1"));
		assert.equal(event.defaultPrevented, true);
	});

	test("preventDefault: false does not prevent default", () => {
		const plugin = scrollToPlugin({ preventDefault: false });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("scroll-to-section1"));
		assert.equal(event.defaultPrevented, false);
	});

	test("onScroll callback is called", () => {
		const scrolls = [];
		const plugin = scrollToPlugin({
			onScroll: (ctx, el, target) => {
				scrolls.push({ el: el.id, target: target.id });
			},
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-section1"));

		assert.equal(scrolls.length, 1);
		assert.equal(scrolls[0].el, "scroll-to-section1");
		assert.equal(scrolls[0].target, "section1");
	});

	test("ignore option works", () => {
		const plugin = scrollToPlugin({
			ignore: "#scroll-to-section1",
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-section1"));
		assert.equal(scrollIntoViewCalls.length, 0);
	});

	test("plugin-level behavior option", () => {
		const plugin = scrollToPlugin({ behavior: "instant" });
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("scroll-to-section1"));

		assert.equal(scrollIntoViewCalls[0].opts.behavior, "instant");
	});
});
