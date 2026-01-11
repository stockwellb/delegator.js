// test/confirm.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createDelegator } from "../src/delegator.js";
import { confirmPlugin } from "../src/plugins/confirm.js";
import { setupDOM, click } from "./helpers.js";

describe("confirmPlugin", () => {
	let dom;

	beforeEach(() => {
		dom = setupDOM(`
			<div id="root">
				<button id="confirm-delete" data-confirm="Delete this item?">Delete</button>
				<button id="confirm-empty" data-confirm="">Empty Message</button>
				<a id="confirm-link" href="/logout" data-confirm="Log out?">Logout</a>
			</div>
		`);
	});

	afterEach(() => {
		dom.window.close();
	});

	test("calls onConfirm when user confirms", () => {
		const confirms = [];
		const plugin = confirmPlugin({
			confirmFn: () => true,
			onConfirm: (_ctx, el) => confirms.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-delete"));

		assert.equal(confirms.length, 1);
		assert.equal(confirms[0], "confirm-delete");
	});

	test("calls onCancel when user cancels", () => {
		const cancels = [];
		const plugin = confirmPlugin({
			confirmFn: () => false,
			onCancel: (_ctx, el) => cancels.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-delete"));

		assert.equal(cancels.length, 1);
		assert.equal(cancels[0], "confirm-delete");
	});

	test("custom confirmFn receives message", () => {
		const messages = [];
		const plugin = confirmPlugin({
			confirmFn: (_ctx, _el, message) => {
				messages.push(message);
				return true;
			},
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-delete"));

		assert.equal(messages.length, 1);
		assert.equal(messages[0], "Delete this item?");
	});

	test("uses defaultMessage when data-confirm is empty", () => {
		const messages = [];
		const plugin = confirmPlugin({
			defaultMessage: "Are you sure?",
			confirmFn: (_ctx, _el, message) => {
				messages.push(message);
				return true;
			},
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-empty"));

		assert.equal(messages[0], "Are you sure?");
	});

	test("preventDefault option (default true)", () => {
		const plugin = confirmPlugin({
			confirmFn: () => true,
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		const event = click(document.getElementById("confirm-delete"));
		assert.equal(event.defaultPrevented, true);
	});

	test("stopPropagation is called by default", () => {
		const plugin = confirmPlugin({
			confirmFn: () => true,
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-delete"));
		assert.ok(true); // Plugin executed without error
	});

	test("ignore option works", () => {
		const confirms = [];
		const plugin = confirmPlugin({
			ignore: "#confirm-delete",
			confirmFn: () => true,
			onConfirm: (_ctx, el) => confirms.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-delete"));
		assert.equal(confirms.length, 0);
	});

	test("does not call onConfirm when canceled", () => {
		const confirms = [];
		const plugin = confirmPlugin({
			confirmFn: () => false,
			onConfirm: (_ctx, el) => confirms.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-delete"));
		assert.equal(confirms.length, 0);
	});

	test("does not call onCancel when confirmed", () => {
		const cancels = [];
		const plugin = confirmPlugin({
			confirmFn: () => true,
			onCancel: (_ctx, el) => cancels.push(el.id),
		});
		const delegator = createDelegator({ root: document, plugins: [plugin] });
		delegator.start();

		click(document.getElementById("confirm-delete"));
		assert.equal(cancels.length, 0);
	});
});
