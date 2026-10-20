import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("browser entrypoint works without an ES-module server", async () => {
    const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
    const corePosition = html.indexOf("lottery-core.js");
    const appPosition = html.indexOf("script.js");

    assert.ok(corePosition >= 0, "lottery core script is present");
    assert.ok(appPosition > corePosition, "lottery core loads before the application");
    assert.doesNotMatch(html, /type=["']module["']/);
});
