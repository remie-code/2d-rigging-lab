import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { test } from "node:test";
import { createVenueTaskResources } from "./venue-task-resources.mjs";

test("相対指定の一時フォルダでも、別の作業先から資料の絶対参照を使える", async () => {
  const envKey = process.platform === "win32" ? "TEMP" : "TMPDIR";
  const original = process.env[envKey];
  const resources = createVenueTaskResources();
  let document;
  try {
    process.env[envKey] = ".";
    assert.equal(isAbsolute(tmpdir()), false);
    document = resources.access.storeDocument({ name: "fixture.txt", bytes: Buffer.from("synthetic") });
    assert.ok(isAbsolute(document.path));

    const reply = await resources.access.runTask({
      kind: "local", request: "read", content: "read", sessionOptions: {},
      create({ cwd }) {
        assert.ok(isAbsolute(cwd));
        return {
          async ask() { return { replyText: readFileSync(resolve(cwd, document.path), "utf8") }; },
          async dispose() {}
        };
      }
    });
    assert.equal(reply, "synthetic");
    assert.equal(resources.writerMaterials().documents[0].path, document.path);
  } finally {
    if (original === undefined) delete process.env[envKey];
    else process.env[envKey] = original;
    await resources.release();
  }
  assert.equal(existsSync(document.path), false);
});
