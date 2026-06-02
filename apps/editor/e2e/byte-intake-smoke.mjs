import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";
import {
  createImportedSourceAssetRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const sampleFileUrl = new URL("../../../test_data/sample_model.psd", import.meta.url);
const sampleSummaryUrl = new URL(
  "../../../fixtures/contracts/wave31-byte-sample-characterization/expected/sample-model-byte-characterization-summary.json",
  import.meta.url
);

const byteIntakeSmoke = {
  sourceAssetId: "src_wave31_sample_psd_e2e",
  sourceLayerId: "layer_wave31_sample_psd_reference",
  manifestPath: "assets/sources/uploads/sample_model.psd",
  adapterName: "manual-wave31-byte-intake-profile",
  canvasWidth: 256,
  canvasHeight: 256,
  defaultPartId: "part_root",
  originalName: "Wave31 Sample PSD Reference",
  normalizedName: "wave31_sample_psd_reference",
  groupPath: "Local/Sample",
  creator: "Wave31 Local Sample Provider",
  license: "user-provided-rights-cleared-local-test-fixture",
  sourceUrl: "",
  notes:
    "Workspace-local user-provided sample bytes for local byte-intake smoke; no PSD parser, image decode, or raster extraction.",
  redistributionAllowed: false,
  aiUsed: false,
  bounds: {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  },
  binaryAssetId: "bin_wave31_sample_psd_e2e_source"
};

const byteIntakeSmokeViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    isMobile: true
  }
];

export const runByteIntakePersistenceSmoke = async ({
  page,
  viewport,
  initialOperationLogEntryCount = 0
}) => {
  const sample = await readByteSampleSummary();
  const importedSourceRow = createImportedSourceAssetRowTestId(byteIntakeSmoke.sourceAssetId);

  await waitForTestId(page, editorTestIds.sourceIntakePanel);
  await waitForTestId(page, editorTestIds.sourceIntakeForm);
  await waitForTestId(page, editorTestIds.sourceIntakeFileInput);
  await waitForTestId(page, editorTestIds.sourceIntakeSelectedFile);
  await waitForText(page, editorTestIds.sourceIntakeSelectedFile, "No browser file selected");

  await setByteIntakeFormValues(page, byteIntakeSmoke);
  await selectFileInput(page, editorTestIds.sourceIntakeFileInput, fileURLToPath(sampleFileUrl));
  await assertSelectedFileDraftVisible(page, sample);
  await clickTestId(page, editorTestIds.sourceIntakeSubmit);

  await waitForText(page, editorTestIds.operationStatus, "importPsdSourceAsset committed");
  await waitForText(page, editorTestIds.sourceIntakeSummary, "Draft confirmed");
  await waitForText(
    page,
    editorTestIds.sourceIntakeSummary,
    "Bytes are registered in current editor session memory; browser-local save/load stores metadata only and requires reupload."
  );
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, importedSourceRow, byteIntakeSmoke.sourceAssetId);
  await assertByteIntakeVisibleAvailable(page, importedSourceRow, sample);
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 1);
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset");
  await assertByteIntakeVisibleTruthfulness(page, "after byte intake commit");

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertStoredByteIntakeMetadata(page, sample, "after browser save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, importedSourceRow, byteIntakeSmoke.sourceAssetId);
  await assertByteIntakeVisibleRequiresReupload(page, importedSourceRow, sample);
  await assertStoredByteIntakeMetadata(page, sample, "after browser reload and load");
  await assertByteIntakeVisibleTruthfulness(page, "after byte intake browser-local load");

  const screenshot = await page.captureScreenshot(`${viewport.name} wave31 byte intake smoke`);

  return {
    viewport: viewport.name,
    sourceAssetId: byteIntakeSmoke.sourceAssetId,
    binaryAssetId: byteIntakeSmoke.binaryAssetId,
    byteLength: sample.byteLength,
    digestHex: sample.digestHex,
    screenshot
  };
};

const readByteSampleSummary = async () => {
  const summary = JSON.parse(await readFile(sampleSummaryUrl, "utf8"));

  return {
    fileName: "sample_model.psd",
    byteLength: summary.byteEvidence.byteLength,
    byteLengthLabel: `${summary.byteEvidence.byteLength} bytes`,
    digestHex: summary.byteEvidence.digest.hex,
    digestShortLabel: `sha256:${summary.byteEvidence.digest.hex.slice(0, 12)}...`,
    expectedMediaType: summary.byteEvidence.mediaTypeExpectation.declaredMediaType
  };
};

const setByteIntakeFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Source intake form was missing.");
    }

    const setValue = (name, value) => {
      const control = form.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing source intake field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setChecked = (name, checked) => {
      const control = form.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement)) {
        throw new Error(`Missing source intake checkbox ${name}.`);
      }

      control.checked = checked;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };

    setValue("intakeMode", "psdAdapterProfile");
    setValue("manifestPath", values.manifestPath);
    setValue("sourceAssetId", values.sourceAssetId);
    setValue("contentHash", "");
    setValue("psdAdapterName", values.adapterName);
    setValue("psdCanvasWidth", values.canvasWidth);
    setValue("psdCanvasHeight", values.canvasHeight);
    setValue("defaultPartId", values.defaultPartId);
    setValue("placementPolicy", "use-metadata");
    setValue("rightsStatus", "cleared");
    setValue("creator", values.creator);
    setValue("license", values.license);
    setValue("sourceUrl", values.sourceUrl);
    setValue("notes", values.notes);
    setChecked("redistributionAllowed", values.redistributionAllowed);
    setChecked("aiUsed", values.aiUsed);
    setValue("sourceLayerId.0", values.sourceLayerId);
    setValue("originalName.0", values.originalName);
    setValue("normalizedName.0", values.normalizedName);
    setValue("groupPath.0", values.groupPath);
    setValue("texturePreviewReference.0", "");
    setValue("textureId.0", "");
    setValue("targetPartId.0", "");
    setValue("x.0", values.bounds.x);
    setValue("y.0", values.bounds.y);
    setValue("width.0", values.bounds.width);
    setValue("height.0", values.bounds.height);
    setValue("opacityInSource.0", 1);
    setValue("role.0", "unsupported");
    setChecked("visibleInSource.0", true);
    setValue("unsupportedFeatures.0", "");
  }, {
    form: editorTestIds.sourceIntakeForm
  }, input);
};

const selectFileInput = async (page, testId, filePath) => {
  await page.client.call("DOM.enable");
  const { root } = await page.client.call("DOM.getDocument", {
    depth: -1,
    pierce: true
  });
  const { nodeId } = await page.client.call("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: `[data-testid="${testId}"]`
  });

  if (nodeId === 0) {
    throw new Error(`Missing file input for test id ${testId}.`);
  }

  await page.client.call("DOM.setFileInputFiles", {
    nodeId,
    files: [filePath]
  });
  await page.evaluate((id) => {
    const input = document.querySelector(`[data-testid="${id}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Missing file input for test id ${id}.`);
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, testId);
};

const assertSelectedFileDraftVisible = async (page, sample) => {
  await waitForText(page, editorTestIds.sourceIntakeSelectedFile, sample.fileName);
  await waitForText(page, editorTestIds.sourceIntakeSelectedFile, sample.byteLengthLabel);
  await waitForText(
    page,
    editorTestIds.sourceIntakeSelectedFile,
    "Bytes are selected in browser memory only; not committed to package; reupload is required after reload."
  );
  await waitForText(
    page,
    editorTestIds.sourceIntakeSelectedFile,
    "Cleared / user-provided-rights-cleared-local-test-fixture"
  );
  await waitForText(
    page,
    editorTestIds.sourceIntakeSelectedFile,
    "Wave31 Local Sample Provider / No AI use"
  );

  const text = await readText(page, editorTestIds.sourceIntakeSelectedFile);
  if (!text.includes("No declared media type") && !text.includes(sample.expectedMediaType)) {
    throw new Error(`Selected file media type was not truthful/fallback-safe: ${text}.`);
  }
};

const assertByteIntakeVisibleAvailable = async (page, rowTestId, sample) => {
  await waitForText(page, rowTestId, byteIntakeSmoke.manifestPath);
  await waitForText(page, rowTestId, byteIntakeSmoke.binaryAssetId);
  await waitForText(page, rowTestId, "stored-package-local-v1 status; bytes are not decoded by the editor");
  await waitForText(page, rowTestId, sample.byteLengthLabel);
  await waitForText(page, rowTestId, sample.digestShortLabel);
  await waitForText(
    page,
    rowTestId,
    "session availability available in current editor session memory; browser-local save/load stores metadata only"
  );
  await waitForText(page, rowTestId, "validator bytesAvailability=available");
  await waitForText(page, rowTestId, "source filename sample_model.psd");
  await waitForText(page, rowTestId, "byte intake verified-pass-v1");
  await waitForText(page, rowTestId, "metadata only; no editor file import or image decode");
};

const assertByteIntakeVisibleRequiresReupload = async (page, rowTestId, sample) => {
  await waitForText(page, rowTestId, byteIntakeSmoke.binaryAssetId);
  await waitForText(page, rowTestId, byteIntakeSmoke.manifestPath);
  await waitForText(page, rowTestId, sample.byteLengthLabel);
  await waitForText(page, rowTestId, sample.digestShortLabel);
  await waitForText(
    page,
    rowTestId,
    "session availability metadata reloaded without bytes; reupload required before byte validation can pass"
  );
  await waitForText(page, rowTestId, "validator bytesAvailability=requiresReupload");

  const text = await readText(page, rowTestId);
  const forbiddenLoadedClaims = [
    "source filename sample_model.psd",
    "byte intake verified-pass-v1",
    "validator bytesAvailability=available",
    "session availability available in current editor session memory"
  ].filter((claim) => text.includes(claim));

  if (forbiddenLoadedClaims.length > 0) {
    throw new Error(`Loaded byte intake row still claimed current-session byte verification: ${text}.`);
  }
};

const assertStoredByteIntakeMetadata = async (page, sample, label) => {
  const stored = await page.evaluate((key, expected) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const sourceManifest = readPackageJsonFile(project, "assets/sources/source-manifest.json");
    const rights = readPackageJsonFile(project, "assets/rights.json");
    const provenance = readPackageJsonFile(project, "assets/provenance.json");
    const sourceAsset = sourceManifest?.sourceAssets?.find(
      (candidate) => candidate.sourceAssetId === expected.sourceAssetId
    );
    const rightsRecord = rights?.records?.find(
      (candidate) => candidate.assetId === expected.sourceAssetId
    );
    const provenanceRecord = provenance?.records?.find(
      (candidate) => candidate.assetId === expected.sourceAssetId
    );
    const packageFilePaths = Array.isArray(project.packageFileSet)
      ? project.packageFileSet.map((entry) => entry.path)
      : [];
    const packageText = Array.isArray(project.packageFileSet)
      ? project.packageFileSet.map((entry) => entry.text ?? "").join("\n")
      : "";
    const operationLogJsonl = String(project.operationLogJsonl ?? "");

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      sourceAsset: {
        sourceAssetId: sourceAsset?.sourceAssetId ?? null,
        filePath: sourceAsset?.filePath ?? null,
        contentHash: sourceAsset?.contentHash ?? null,
        binaryAssetRef: sourceAsset?.binaryAssetRef ?? null
      },
      rightsRecord: {
        rightsStatus: rightsRecord?.rightsStatus ?? null,
        license: rightsRecord?.license ?? null,
        redistributionAllowed: rightsRecord?.redistributionAllowed ?? null
      },
      provenanceRecord: {
        creator: provenanceRecord?.creator ?? null,
        license: provenanceRecord?.license ?? null,
        aiUsed: provenanceRecord?.aiUsed ?? null,
        transformHistory: provenanceRecord?.transformHistory ?? []
      },
      binaryFilePathPersisted: packageFilePaths.includes(expected.manifestPath),
      forbiddenPayloadFieldsPresent:
        packageText.includes("bytesBase64") ||
        packageText.includes("arrayBuffer") ||
        packageText.includes("pixelData") ||
        packageText.includes("decodedImageSize") ||
        packageText.includes("rasterData") ||
        operationLogJsonl.includes("selectedFile") ||
        operationLogJsonl.includes("bytesBase64") ||
        operationLogJsonl.includes("arrayBuffer")
    };

    function readPackageJsonFile(projectValue, packagePath) {
      if (!Array.isArray(projectValue.packageFileSet)) {
        return null;
      }

      const entry = projectValue.packageFileSet.find((candidate) => candidate.path === packagePath);
      if (typeof entry?.text !== "string") {
        return null;
      }

      return JSON.parse(entry.text);
    }
  }, editorProjectStorageKey, {
    sourceAssetId: byteIntakeSmoke.sourceAssetId,
    manifestPath: byteIntakeSmoke.manifestPath
  });

  const failures = [];
  const ref = stored?.sourceAsset.binaryAssetRef;
  const expectEqual = (field, actual, expected) => {
    if (actual !== expected) {
      failures.push(`${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
  };
  const expectIncludes = (field, values, expected) => {
    if (!Array.isArray(values) || !values.includes(expected)) {
      failures.push(`${field}: expected to include ${JSON.stringify(expected)}, received ${JSON.stringify(values)}`);
    }
  };

  expectEqual("schemaVersion", stored?.schemaVersion, "editor-project-persistence-v1");
  expectEqual("packageId", stored?.packageId, "pkg_editor_browser_sample");
  expectEqual("sourceAssetId", stored?.sourceAsset.sourceAssetId, byteIntakeSmoke.sourceAssetId);
  expectEqual("sourceFilePath", stored?.sourceAsset.filePath, byteIntakeSmoke.manifestPath);
  expectEqual("sourceContentHash", stored?.sourceAsset.contentHash, `sha256:${sample.digestHex}`);
  expectEqual("binary.referenceKind", ref?.referenceKind, "package-binary-asset-ref-v1");
  expectEqual("binary.binaryAssetId", ref?.binaryAssetId, byteIntakeSmoke.binaryAssetId);
  expectEqual("binary.packageRelativePath", ref?.packageRelativePath, byteIntakeSmoke.manifestPath);
  expectEqual("binary.digest.algorithm", ref?.digest?.algorithm, "sha256");
  expectEqual("binary.digest.hex", ref?.digest?.hex, sample.digestHex);
  expectEqual("binary.byteLength", ref?.byteLength, sample.byteLength);
  expectEqual("binary.mediaType", ref?.mediaType, sample.expectedMediaType);
  expectEqual("binary.storageStatus", ref?.storageStatus, "stored-package-local-v1");
  expectEqual("binary.rightsAssetId", ref?.rightsAssetId, byteIntakeSmoke.sourceAssetId);
  if (typeof ref?.provenanceId !== "string" || !ref.provenanceId.startsWith("prov_editor_import_psd_profile_source_")) {
    failures.push(`binary.provenanceId: expected editor import provenance id, received ${JSON.stringify(ref?.provenanceId)}`);
  }
  expectEqual("rights.rightsStatus", stored?.rightsRecord.rightsStatus, "cleared");
  expectEqual("rights.license", stored?.rightsRecord.license, byteIntakeSmoke.license);
  expectEqual("rights.redistributionAllowed", stored?.rightsRecord.redistributionAllowed, false);
  expectEqual("provenance.creator", stored?.provenanceRecord.creator, byteIntakeSmoke.creator);
  expectEqual("provenance.license", stored?.provenanceRecord.license, byteIntakeSmoke.license);
  expectEqual("provenance.aiUsed", stored?.provenanceRecord.aiUsed, false);
  expectIncludes("provenance.transformHistory", stored?.provenanceRecord.transformHistory, "importPsdSourceAsset:adapter-result-metadata");
  expectIncludes("provenance.transformHistory", stored?.provenanceRecord.transformHistory, `psdAdapter:${byteIntakeSmoke.adapterName}`);
  expectEqual("binaryFilePathPersisted", stored?.binaryFilePathPersisted, false);
  expectEqual("forbiddenPayloadFieldsPresent", stored?.forbiddenPayloadFieldsPresent, false);

  if (failures.length > 0) {
    throw new Error(
      `Wave31 byte intake stored metadata mismatch during ${label}: ${failures.join("; ")}. Stored=${JSON.stringify(stored)}.`
    );
  }
};

const assertByteIntakeVisibleTruthfulness = async (page, label) => {
  const evidence = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const text = panel?.textContent ?? "";
    const unsupportedClaim =
      /parsed from bytes|decoded from bytes|image decoding|raster extraction|rasterized|archive import|full renderer|pixel oracle|decoded PSD|decoded PNG/i;

    return {
      text,
      unsupportedClaim: unsupportedClaim.test(text)
    };
  }, {
    panel: editorTestIds.sourceIntakePanel
  });

  if (evidence.unsupportedClaim) {
    throw new Error(`Wave31 byte intake UI made an unsupported parser/decode claim during ${label}: ${evidence.text}`);
  }
};

const clickTestId = async (page, testId) => {
  await page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);

    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing element for test id ${id}.`);
    }

    element.click();
  }, testId);
};

const waitForTestId = async (page, testId) => {
  await page.waitFor(
    `test id ${testId}`,
    (id) => document.querySelector(`[data-testid="${id}"]`) !== null,
    { timeoutMs: 8_000 },
    testId
  );
};

const waitForText = async (page, testId, expectedText) => {
  await page.waitFor(
    `${testId} text ${expectedText}`,
    (id, text) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.includes(text) ?? false,
    { timeoutMs: 8_000 },
    testId,
    expectedText
  );
};

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const waitForOperationLogEntryCount = async (page, expectedCount) => {
  await page.waitFor(
    `operation log entry count ${expectedCount}`,
    (id, count) => {
      const panel = document.querySelector(`[data-testid="${id}"]`);
      const terms = [...(panel?.querySelectorAll("dt") ?? [])];
      const entryTerm = terms.find((term) => term.textContent === "Entries");

      return entryTerm?.nextElementSibling?.textContent === String(count);
    },
    { timeoutMs: 8_000 },
    editorTestIds.operationLogSummary,
    expectedCount
  );
};

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `byte-intake-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of byteIntakeSmokeViewports) {
      const page = await createPageSession({
        browserPort: launchedBrowser.port,
        viewport,
        url: server.baseUrl
      });

      try {
        await waitForTestId(page, editorTestIds.shell);
        await page.evaluate((storageKey) => localStorage.removeItem(storageKey), editorProjectStorageKey);
        await page.reload();
        await waitForTestId(page, editorTestIds.shell);

        const result = await runByteIntakePersistenceSmoke({ page, viewport });
        console.log(`byte-intake-e2e: ${viewport.name} smoke passed`);
        console.log(
          `byte-intake-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    if (launchedBrowser !== undefined) {
      await launchedBrowser.close();
    }

    await server.close();
  }
};

const isDirectRun = () => {
  if (process.argv[1] === undefined) {
    return false;
  }

  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
};

if (isDirectRun()) {
  try {
    await main();
    console.log("byte-intake-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
