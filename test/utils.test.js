// test/utils.test.js
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { defaultWriteText, defaultBuildURL } from "../src/plugins/utils.js";
import { setupDOM } from "./helpers.js";

describe("defaultWriteText", () => {
	let originalNavigator;

	beforeEach(() => {
		originalNavigator = globalThis.navigator;
	});

	afterEach(() => {
		Object.defineProperty(globalThis, "navigator", {
			value: originalNavigator,
			writable: true,
			configurable: true,
		});
	});

	test("throws if clipboard API not available", async () => {
		Object.defineProperty(globalThis, "navigator", {
			value: {},
			writable: true,
			configurable: true,
		});

		await assert.rejects(
			() => defaultWriteText("test", {}, {}),
			/Clipboard API not available/
		);
	});

	test("calls clipboard.writeText when available", async () => {
		const written = [];
		Object.defineProperty(globalThis, "navigator", {
			value: {
				clipboard: {
					writeText: async (text) => { written.push(text); },
				},
			},
			writable: true,
			configurable: true,
		});

		await defaultWriteText("hello", {}, {});
		assert.deepEqual(written, ["hello"]);
	});
});

describe("defaultBuildURL", () => {
	beforeEach(() => {
		setupDOM();
	});

	test("returns empty string for empty input", () => {
		assert.equal(defaultBuildURL(""), "");
	});

	test("expands hash to full URL with search params", () => {
		const result = defaultBuildURL("#section");
		assert.equal(result, "https://example.com/page?tab=1#section");
	});

	test("returns non-hash values unchanged", () => {
		assert.equal(defaultBuildURL("https://other.com"), "https://other.com");
		assert.equal(defaultBuildURL("/path/to/page"), "/path/to/page");
		assert.equal(defaultBuildURL("relative/path"), "relative/path");
	});

	test("handles missing location gracefully", () => {
		globalThis.location = undefined;
		assert.equal(defaultBuildURL("#section"), "#section");
	});
});
