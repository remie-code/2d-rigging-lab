import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { runByteIntakePersistenceSmoke } from "./byte-intake-smoke.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createImportedSourceAssetRowTestId,
  createProjectPersistenceTransportCapabilityRowTestId,
  createProjectPersistenceTransportUnavailableActionTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

const portableBundleRoundTripViewports = [
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

const sampleManifestPath = "assets/sources/uploads/sample_model.psd";

const supportedTransportCapability = {
  capabilityId: "projectDefinedJsonBundleV0",
  label: "Portable JSON bundle",
  status: "supported"
};

const unavailableTransportCapabilities = [
  {
    capabilityId: "standardArchiveZipV0",
    label: "Standard ZIP package archive",
    status: "dependency-gated"
  },
  {
    capabilityId: "fileSystemAccessApiV0",
    label: "File System Access API",
    status: "future-gated"
  },
  {
    capabilityId: "directoryPickerV0",
    label: "Directory picker",
    status: "future-gated"
  },
  {
    capabilityId: "dragDropFileIntakeV0",
    label: "Drag-drop file intake",
    status: "future-gated"
  },
  {
    capabilityId: "nativeFilesystemPersistenceV0",
    label: "Native filesystem persistence",
    status: "unsupported"
  }
];

export const runPortableBundleRoundTripSmoke = async ({ page, viewport }) => {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "portable-bundle-roundtrip-")
  );

  try {
    const byteIntakeEvidence = await runByteIntakePersistenceSmoke({
      page,
      viewport,
      stopAfterPersistentRestore: true
    });
    const importedSourceRow = createImportedSourceAssetRowTestId(
      byteIntakeEvidence.sourceAssetId
    );

    await assertProjectTransportCapabilityOracle(
      page,
      `before ${viewport.name} portable bundle export`
    );
    await assertSourceFileNotSelected(page, "after browser-local restore");
    await installPortableBundleExportCapture(page);

    const exportedBundle = await exportPortableBundle(page);
    assertExportedBundleShape(exportedBundle, byteIntakeEvidence);

    await resetProject(page);
    await importPortableBundleFile({
      page,
      temporaryDirectory,
      filename: `${viewport.name}-valid.portable-package-bundle-v0.json`,
      bundleJson: exportedBundle.bundleJson
    });
    await waitForText(page, editorTestIds.projectPersistenceStatus, "Portable JSON imported");
    await waitForText(
      page,
      editorTestIds.projectPersistenceSummary,
      "Portable JSON bundle v0"
    );
    await waitForText(
      page,
      editorTestIds.projectPersistenceSummary,
      "1/1 binary assets registered in current session"
    );
    await waitForText(
      page,
      editorTestIds.projectPersistenceSummary,
      "persistent bytes 1/1 stored"
    );
    await assertSourceFileNotSelected(page, "after portable bundle import");
    await assertImportedBundleBytesAvailable({
      page,
      rowTestId: importedSourceRow,
      byteIntakeEvidence
    });

    const screenshot = await page.captureScreenshot(
      `${viewport.name} wave36 portable bundle roundtrip smoke`
    );

    await resetProject(page);
    const digestMismatchBundleJson = createDigestMismatchBundleJson(
      exportedBundle.bundleJson
    );
    await importPortableBundleFile({
      page,
      temporaryDirectory,
      filename: `${viewport.name}-digest-mismatch.portable-package-bundle-v0.json`,
      bundleJson: digestMismatchBundleJson
    });
    await waitForText(page, editorTestIds.projectPersistenceStatus, "Portable JSON import failed");
    await waitForText(
      page,
      editorTestIds.projectPersistenceSummary,
      "portableBundle.digest.mismatch"
    );
    await waitForText(page, editorTestIds.sourceIntakeImportedSources, "0 imported source assets");
    await assertSourceFileNotSelected(page, "after digest mismatch bundle import failure");
    await assertProjectTransportCapabilityOracle(
      page,
      `after ${viewport.name} digest mismatch failure`
    );

    return {
      viewport: viewport.name,
      sourceAssetId: byteIntakeEvidence.sourceAssetId,
      binaryAssetId: byteIntakeEvidence.binaryAssetId,
      byteLength: byteIntakeEvidence.byteLength,
      digestHex: byteIntakeEvidence.digestHex,
      exportedBundleSize: exportedBundle.size,
      suggestedFilename: exportedBundle.download,
      screenshot
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

const installPortableBundleExportCapture = async (page) => {
  await page.evaluate(() => {
    if (globalThis.__portableBundleE2eCapture?.installed === true) {
      globalThis.__portableBundleE2eCapture.records.length = 0;
      return;
    }

    const records = [];
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    let nextRecordId = 0;

    globalThis.__portableBundleE2eCapture = {
      installed: true,
      records
    };

    URL.createObjectURL = (value) => {
      if (!(value instanceof Blob)) {
        return originalCreateObjectURL(value);
      }

      const url = `blob:${location.origin}/portable-bundle-e2e-${nextRecordId}`;
      nextRecordId += 1;

      const record = {
        url,
        type: value.type,
        size: value.size,
        text: null,
        textReady: false,
        error: null,
        download: null,
        revoked: false
      };
      records.push(record);

      void value.text()
        .then((text) => {
          record.text = text;
          record.textReady = true;
        })
        .catch((error) => {
          record.error = error instanceof Error ? error.message : String(error);
        });

      return url;
    };

    URL.revokeObjectURL = (url) => {
      const record = records.find((candidate) => candidate.url === url);
      if (record !== undefined) {
        record.revoked = true;
        return;
      }

      originalRevokeObjectURL(url);
    };

    HTMLAnchorElement.prototype.click = function click() {
      const href = String(this.href);
      if (this.download.length > 0 && href.includes("/portable-bundle-e2e-")) {
        const record = records.find((candidate) =>
          candidate.url === href || candidate.url === this.getAttribute("href")
        );
        if (record !== undefined) {
          record.download = this.download;
          return;
        }
      }

      return originalAnchorClick.call(this);
    };
  });
};

const exportPortableBundle = async (page) => {
  await clickTestId(page, editorTestIds.projectPersistencePortableExport);
  await waitForTextWithStatusSnapshot(
    page,
    editorTestIds.projectPersistenceStatus,
    "Portable JSON exported",
    "portable bundle export"
  );
  await waitForText(
    page,
    editorTestIds.projectPersistenceSummary,
    "Portable JSON bundle v0 prepared"
  );
  await waitForText(
    page,
    editorTestIds.projectPersistenceSummary,
    "1 binary payloads verified from current editor session bytes"
  );
  await page.waitFor(
    "portable bundle export blob capture",
    () =>
      globalThis.__portableBundleE2eCapture?.records.some((record) =>
        record.textReady === true || record.error !== null
      ) === true,
    { timeoutMs: 8_000 }
  );

  const captured = await page.evaluate(() => {
    const records = globalThis.__portableBundleE2eCapture?.records ?? [];
    const record = records.find((candidate) =>
      candidate.textReady === true || candidate.error !== null
    );

    return record === undefined
      ? null
      : {
          bundleJson: record.text,
          download: record.download,
          error: record.error,
          revoked: record.revoked,
          size: record.size,
          type: record.type
        };
  });

  if (captured === null) {
    throw new Error("Portable bundle export did not create a captured Blob.");
  }
  if (captured.error !== null) {
    throw new Error(`Portable bundle export Blob text failed: ${captured.error}.`);
  }
  if (typeof captured.bundleJson !== "string" || captured.bundleJson.length === 0) {
    throw new Error("Portable bundle export captured an empty bundle JSON string.");
  }
  if (captured.download?.endsWith(".portable-package-bundle-v0.json") !== true) {
    throw new Error(
      `Portable bundle export suggested an unexpected filename: ${captured.download}.`
    );
  }
  if (captured.type !== "application/json") {
    throw new Error(`Portable bundle export Blob used unexpected type ${captured.type}.`);
  }
  if (captured.revoked !== true) {
    throw new Error("Portable bundle export did not revoke the captured object URL.");
  }

  return captured;
};

const waitForTextWithStatusSnapshot = async (page, testId, expectedText, label) => {
  try {
    await waitForText(page, testId, expectedText);
  } catch (error) {
    const status = await readText(page, editorTestIds.projectPersistenceStatus);
    const summary = await readText(page, editorTestIds.projectPersistenceSummary);
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `${message} Current project persistence state during ${label}: status=${JSON.stringify(status)} summary=${JSON.stringify(summary)}.`
    );
  }
};

const importPortableBundleFile = async ({
  page,
  temporaryDirectory,
  filename,
  bundleJson
}) => {
  const filePath = path.join(temporaryDirectory, filename);
  await writeFile(filePath, bundleJson, "utf8");
  await selectFileInput(page, editorTestIds.projectPersistencePortableImportInput, filePath);
};

const assertExportedBundleShape = (exportedBundle, byteIntakeEvidence) => {
  const bundle = JSON.parse(exportedBundle.bundleJson);
  const payload = bundle.binaryPayloads?.[0];
  const failures = [];
  const expectEqual = (field, actual, expected) => {
    if (actual !== expected) {
      failures.push(`${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
    }
  };

  expectEqual("schemaVersion", bundle.schemaVersion, "portable-package-bundle-v0");
  expectEqual("bundleKind", bundle.bundleKind, "project-defined-json-bundle-v0");
  expectEqual("binaryPayloadCount", bundle.binaryPayloads?.length, 1);
  expectEqual("payloadEncoding", payload?.payloadEncoding, "base64-v1");
  expectEqual("payload.binaryAssetId", payload?.binaryAssetRef?.binaryAssetId, byteIntakeEvidence.binaryAssetId);
  expectEqual("payload.packageRelativePath", payload?.binaryAssetRef?.packageRelativePath, sampleManifestPath);
  expectEqual("payload.byteLength", payload?.binaryAssetRef?.byteLength, byteIntakeEvidence.byteLength);
  expectEqual("payload.digest.hex", payload?.binaryAssetRef?.digest?.hex, byteIntakeEvidence.digestHex);
  expectEqual("document.packageId", bundle.packageId, bundle.packageDocument?.manifest?.packageId);
  expectEqual("document.packageRevision", bundle.packageRevision, bundle.packageDocument?.manifest?.packageRevision);

  if (typeof payload?.payloadBase64 !== "string" || payload.payloadBase64.length === 0) {
    failures.push("payloadBase64: expected a non-empty base64 payload.");
  }

  if (failures.length > 0) {
    throw new Error(`Portable bundle export shape mismatch: ${failures.join("; ")}.`);
  }
};

const assertImportedBundleBytesAvailable = async ({
  page,
  rowTestId,
  byteIntakeEvidence
}) => {
  await waitForText(page, rowTestId, sampleManifestPath);
  await waitForText(page, rowTestId, byteIntakeEvidence.binaryAssetId);
  await waitForText(page, rowTestId, `${byteIntakeEvidence.byteLength} bytes`);
  await waitForText(
    page,
    rowTestId,
    `sha256:${byteIntakeEvidence.digestHex.slice(0, 12)}...`
  );
  await waitForText(
    page,
    rowTestId,
    "session availability available in current editor session memory"
  );
  await waitForText(page, rowTestId, "validator bytesAvailability=available");
  await waitForText(page, rowTestId, "metadata only; no editor file import or image decode");

  const text = await readText(page, rowTestId);
  const forbiddenClaims = [
    "validator bytesAvailability=requiresReupload",
    "source filename sample_model.psd",
    "byte intake verified-pass-v1"
  ].filter((claim) => text.includes(claim));

  if (forbiddenClaims.length > 0) {
    throw new Error(
      `Portable bundle import made a reupload or browser-file-selection claim: ${forbiddenClaims.join(", ")}. Row=${text}.`
    );
  }
};

const createDigestMismatchBundleJson = (bundleJson) => {
  const bundle = JSON.parse(bundleJson);
  const payload = bundle.binaryPayloads?.[0];

  if (payload === undefined || typeof payload.payloadBase64 !== "string") {
    throw new Error("Cannot mutate portable bundle without a binary payload.");
  }

  payload.payloadBase64 = mutateBase64FirstCharacter(payload.payloadBase64);

  return JSON.stringify(bundle, null, 2);
};

const mutateBase64FirstCharacter = (base64) => {
  if (base64.length === 0) {
    throw new Error("Cannot mutate an empty base64 payload.");
  }

  const replacement = base64[0] === "A" ? "B" : "A";

  return `${replacement}${base64.slice(1)}`;
};

const resetProject = async (page) => {
  await clickTestId(page, editorTestIds.projectPersistenceReset);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Cleared");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "0 imported source assets");
  await assertSourceFileNotSelected(page, "after project reset");
};

const assertSourceFileNotSelected = async (page, label) => {
  await waitForText(page, editorTestIds.sourceIntakeSelectedFile, "No browser file selected");

  const sourceFileInput = await page.evaluate((id) => {
    const input = document.querySelector(`[data-testid="${id}"]`);

    if (!(input instanceof HTMLInputElement)) {
      return null;
    }

    return {
      fileCount: input.files?.length ?? 0,
      value: input.value
    };
  }, editorTestIds.sourceIntakeFileInput);

  if (sourceFileInput === null) {
    throw new Error(`Missing source intake file input during ${label}.`);
  }
  if (sourceFileInput.fileCount !== 0 || sourceFileInput.value !== "") {
    throw new Error(
      `Source file input was unexpectedly selected during ${label}: ${JSON.stringify(sourceFileInput)}.`
    );
  }
};

const assertProjectTransportCapabilityOracle = async (page, label) => {
  await waitForTestId(page, editorTestIds.projectPersistenceTransportCapabilityList);

  const supportedRow = {
    ...supportedTransportCapability,
    rowTestId: createProjectPersistenceTransportCapabilityRowTestId(
      supportedTransportCapability.capabilityId
    ),
    unavailableActionTestId: createProjectPersistenceTransportUnavailableActionTestId(
      supportedTransportCapability.capabilityId
    )
  };
  const unavailableRows = unavailableTransportCapabilities.map((capability) => ({
    ...capability,
    rowTestId: createProjectPersistenceTransportCapabilityRowTestId(
      capability.capabilityId
    ),
    unavailableActionTestId: createProjectPersistenceTransportUnavailableActionTestId(
      capability.capabilityId
    )
  }));

  const evidence = await page.evaluate(
    ({ forbiddenSuccessClaims, ids, supported, unavailable }) => {
      const byTestId = (testId) =>
        document.querySelector(`[data-testid="${testId}"]`);
      const readElementState = (testId) => {
        const element = byTestId(testId);

        return {
          disabled:
            element instanceof HTMLButtonElement || element instanceof HTMLInputElement
              ? element.disabled
              : null,
          exists: element !== null,
          tagName: element?.tagName ?? null,
          text: element?.textContent ?? ""
        };
      };
      const readRowState = (row) => {
        const element = byTestId(row.rowTestId);

        return {
          capabilityId: row.capabilityId,
          expectedLabel: row.label,
          expectedStatus: row.status,
          exists: element !== null,
          status: element?.dataset.capabilityStatus ?? null,
          text: element?.textContent ?? "",
          unavailableAction: readElementState(row.unavailableActionTestId)
        };
      };
      const panelText =
        byTestId(ids.projectPersistencePanel)?.textContent ?? "";

      return {
        forbiddenSuccessClaims: forbiddenSuccessClaims.filter((claim) =>
          panelText.includes(claim)
        ),
        list: readElementState(ids.projectPersistenceTransportCapabilityList),
        panelText,
        portableExport: readElementState(ids.projectPersistencePortableExport),
        portableImport: readElementState(ids.projectPersistencePortableImportInput),
        supportedRow: readRowState(supported),
        unavailableRows: unavailable.map(readRowState)
      };
    },
    {
      forbiddenSuccessClaims: [
        "ZIP/archive supported",
        "archive import supported",
        "archive export supported",
        "File System Access API available",
        "directory picker available",
        "drag-drop import available",
        "native filesystem available",
        "parsed from bytes",
        "decoded from bytes",
        "image decode",
        "raster extraction",
        "full renderer",
        "pixel oracle",
        "Cubism compatibility"
      ],
      ids: editorTestIds,
      supported: supportedRow,
      unavailable: unavailableRows
    }
  );

  const failures = [];

  if (!evidence.list.exists) {
    failures.push("missing transport capability list");
  }
  if (evidence.portableExport.tagName !== "BUTTON" || evidence.portableExport.disabled !== false) {
    failures.push(
      `portable JSON export action is not enabled: ${JSON.stringify(evidence.portableExport)}`
    );
  }
  if (evidence.portableImport.tagName !== "INPUT" || evidence.portableImport.disabled !== false) {
    failures.push(
      `portable JSON import input is not enabled: ${JSON.stringify(evidence.portableImport)}`
    );
  }

  const supported = evidence.supportedRow;
  if (!supported.exists) {
    failures.push("missing projectDefinedJsonBundleV0 row");
  }
  if (supported.status !== "supported") {
    failures.push(`projectDefinedJsonBundleV0 status is ${supported.status}`);
  }
  if (!supported.text.includes("Supported / Available in this editor")) {
    failures.push(`projectDefinedJsonBundleV0 availability text is missing: ${supported.text}`);
  }
  if (supported.unavailableAction.exists) {
    failures.push("projectDefinedJsonBundleV0 unexpectedly exposes an unavailable action");
  }

  for (const row of evidence.unavailableRows) {
    if (!row.exists) {
      failures.push(`missing ${row.capabilityId} row`);
      continue;
    }
    if (row.status !== row.expectedStatus) {
      failures.push(
        `${row.capabilityId} status expected ${row.expectedStatus}, received ${row.status}`
      );
    }
    if (!row.text.includes(row.expectedLabel)) {
      failures.push(`${row.capabilityId} label is missing: ${row.text}`);
    }
    if (!row.text.includes("Unavailable in this editor")) {
      failures.push(`${row.capabilityId} unavailable text is missing: ${row.text}`);
    }
    if (row.text.includes("Supported / Available in this editor")) {
      failures.push(`${row.capabilityId} masquerades as supported: ${row.text}`);
    }
    if (!row.unavailableAction.exists || row.unavailableAction.tagName !== "BUTTON") {
      failures.push(`${row.capabilityId} missing disabled unavailable button`);
    } else if (row.unavailableAction.disabled !== true) {
      failures.push(
        `${row.capabilityId} unavailable button is enabled: ${JSON.stringify(row.unavailableAction)}`
      );
    }
  }

  if (evidence.forbiddenSuccessClaims.length > 0) {
    failures.push(
      `forbidden transport success claims present: ${evidence.forbiddenSuccessClaims.join(", ")}`
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Transport capability oracle failed during ${label}: ${failures.join("; ")}. Panel=${evidence.panelText}`
    );
  }
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
    { timeoutMs: 15_000 },
    testId,
    expectedText
  );
};

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `portable-bundle-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of portableBundleRoundTripViewports) {
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

        const result = await runPortableBundleRoundTripSmoke({ page, viewport });
        console.log(`portable-bundle-e2e: ${viewport.name} roundtrip smoke passed`);
        console.log(
          `portable-bundle-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("portable-bundle-e2e: roundtrip smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
