import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createVenueTaskResources } from "../src/cockpit/venue-task-resources.mjs";
import { runLocalTask } from "../src/mind/local-task.mjs";
import { makeLocalTaskPdf } from "../src/test-support/local-task-pdf.mjs";
import { resolveWriterBrainDef } from "./cockpit.mjs";

// Run explicitly in a normal Windows terminal with the existing Codex sign-in.
// No Discord, Cockpit profile, previous conversations, or memory is loaded.
const brain = resolveWriterBrainDef(process.argv[2] ?? "codex-61-sol");
const venue = createVenueTaskResources();
const workdirs = [];
try {
  for (const [kind, imageOnly, page] of [["text", false, 4], ["image", true, 5]]) {
    const { bytes, token } = makeLocalTaskPdf({ imageOnly, page });
    assert.equal(bytes.includes(token), false);
    const doc = venue.access.storeDocument({ name: `synthetic-${kind}.pdf`, bytes, kind: "pdf" });
    console.log(JSON.stringify({ fixture: kind, page, expected: token, rawContainsToken: false,
      bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }));
    const trace = [];
    const started = performance.now();
    const reply = await runLocalTask({
      resources: venue.access,
      create: (options) => brain.create({
        ...options,
        spawnImpl(...args) {
          const child = spawn(...args);
          createInterface({ input: child.stdout }).on("line", (line) => {
            const { method, params, result } = JSON.parse(line);
            if (result?.thread?.id && result?.sandbox) {
              trace.push({ threadId: result.thread.id, model: result.model, sandbox: result.sandbox });
            }
            if (method === "item/tool/call" && params.tool === "render_venue_pdf_page") {
              trace.push({ tool: params.tool, arguments: params.arguments });
            }
            if (method === "item/completed") {
              const item = params.item;
              if (item?.type === "commandExecution") {
                trace.push({ command: item.command, exitCode: item.exitCode });
              } else if (item?.type === "imageView") {
                trace.push({ imageView: item.path });
              }
            }
          });
          return child;
        }
      }),
      request: `合成PDF ${doc.id} の第${page}ページを render_venue_pdf_page で描画してください。返された絶対パスを view_image で開き、見える識別子を正確に読み取ってください。作業ディレクトリの result.txt に識別子だけを書き出し、そのファイルを再読込して返答してください。`
    });
    const { workdir } = venue.writerMaterials().replies.at(-1);
    workdirs.push(workdir);
    const saved = readFileSync(join(workdir, "result.txt"), "utf8");
    console.log(JSON.stringify({ fixture: kind, reply, saved, workdir, trace, elapsedMs: Math.round(performance.now() - started) }));
    assert.ok(trace.some(({ tool, arguments: args }) => tool === "render_venue_pdf_page" && args.materialId === doc.id && args.page === page));
    assert.ok(trace.some(({ imageView }) => typeof imageView === "string"));
    assert.ok(reply.includes(token));
    assert.equal(saved.trim(), token);
  }
  assert.notEqual(workdirs[0], workdirs[1]);
} finally {
  assert.deepEqual(await venue.release(), { retained: null });
}
