import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AiMaterialCommandResultSchema } from "@private-2d-rigging-lab/ai-interface";
import { runAuthoringHostCli } from "./cli.js";
import { materialEnvelope, materialFixture } from "./material-command-test-fixtures.js";
import { fingerprintMaterialPackage } from "./material-package-fingerprint.js";

describe("material CLI envelope", () => {
  it("inspects using stdin and command-file; distinguishes rejected and failed outcomes", async () => {
    const f = await materialFixture(), c = await f.register();
    const run = async (command: unknown, file: boolean) => {
      const path = join(f.root, "command.json"); if (file) await writeFile(path, JSON.stringify(command));
      let text = "";
      const result = await runAuthoringHostCli({ argv: ["--package-dir", f.packageDirectory, "--state-dir", f.stateDirectory, ...(file ? ["--command-file", path] : [])], readStdin: async () => JSON.stringify(command), writeStdout: s => { text += s; } });
      expect(JSON.parse(text).outcome).toBe(result.response.outcome); return result;
    };
    for (const file of [false, true]) {
      const response = await run(materialEnvelope("inspectMaterialCandidate", { candidateId: c.candidateId }), file);
      expect(response.exitCode).toBe(0); expect(response.response.saved).toBe(false);
      expect(AiMaterialCommandResultSchema.parse(response.response.aiCommandResponse?.payload).candidate).toEqual(c);
    }
    expect((await run(materialEnvelope("applyMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: 0 }), false)).exitCode).toBe(2);
    expect((await run(materialEnvelope("discardMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: 0 }, ["read"]), true)).exitCode).toBe(2);
    expect((await run({ broken: true }, false)).exitCode).toBe(1);
  }, 40000);
  it("a structurally invalid build returns rejected without partially saving base or candidate", async () => {
    const f = await materialFixture("add"); const intent = { ...f.intent, parentPartId: "part_missing" };
    const c = await f.register(intent as typeof f.intent), hash = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    const response = await f.invoke("buildMaterialCandidate", { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision });
    expect(response.outcome).toBe("rejected"); expect(response.saved).toBe(false);
    expect((await f.load(c)).candidate).toEqual(c); expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(hash);
  }, 25000);
  it("failed build and rejected placement leave candidate and base unchanged", async () => {
    const f = await materialFixture(); let c = await f.register(); const hash = await fingerprintMaterialPackage({ directory: f.packageDirectory });
    const r = await f.invoke("setMaterialPlacement", { candidateId: c.candidateId, expectedCandidateRevision: c.candidateRevision + 1, alignment: { placement: c.placement } });
    expect(r.outcome).toBe("rejected"); expect((await f.load(c)).candidate).toEqual(c);
    c = await f.next("buildMaterialCandidate", c); c = await f.next("approveMaterialCandidate", c);
    const reset = await f.next("setMaterialPlacement", c, { alignment: { placement: { ...c.placement, scale: 3 } } });
    expect(reset.state).toBe("registered"); expect("workingPackage" in reset).toBe(false); expect("approval" in reset).toBe(false);
    expect(await fingerprintMaterialPackage({ directory: f.packageDirectory })).toBe(hash);
  }, 60000);
});
