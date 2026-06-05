import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";
import {
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const sampleFileUrl = new URL("../../../test_data/sample_model.psd", import.meta.url);
const sampleSummaryUrl = new URL(
  "../../../fixtures/contracts/wave31-byte-sample-characterization/expected/sample-model-byte-characterization-summary.json",
  import.meta.url
);
const materializationEvidenceUrl = new URL(
  "../../../test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json",
  import.meta.url
);
const fixtureManifestUrl = new URL(
  "../../../discussion/tests/fixtures/fixture-manifest.md",
  import.meta.url
);
const traceabilityMatrixUrl = new URL(
  "../../../discussion/tests/traceability/test-traceability-matrix.md",
  import.meta.url
);

const selectedLayerNodeRef = "psd:root/layer[0]";
const psdImportFocusedSmokeViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  }
];

export const runPsdImportFocusedSmoke = async ({ page, viewport }) => {
  const sample = await readSampleEvidence();

  await waitForTestId(page, editorTestIds.explicitPsdImportPanel);
  await waitForTestId(page, editorTestIds.explicitPsdImportForm);
  await waitForTestId(page, editorTestIds.explicitPsdImportFileInput);
  await waitForTestId(page, editorTestIds.explicitPsdImportSubmit);
  await assertInitialExplicitPsdImportState(page, `${viewport.name} initial`);
  await assertExplicitPsdImportReachable(page, viewport);

  await setSelectedLayerNodeRef(page, selectedLayerNodeRef);
  await selectFileInput(page, editorTestIds.explicitPsdImportFileInput, fileURLToPath(sampleFileUrl));
  await clickTestId(page, editorTestIds.explicitPsdImportSubmit);
  await waitForText(
    page,
    editorTestIds.explicitPsdImportStatus,
    "PSD parsed in browser session",
    60_000
  );
  await assertParsedExplicitPsdImportState(page, sample, `${viewport.name} parsed`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} parsed`);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedProjectExcludesExplicitPsdPayload(page, sample, `${viewport.name} after save`);

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertExplicitPsdImportClearedAfterLoad(page, sample, `${viewport.name} after load`);

  const screenshot = await page.captureScreenshot(`${viewport.name} wave45 PSD import focused smoke`);

  return {
    viewport: viewport.name,
    sourcePath: "test_data/sample_model.psd",
    byteLength: sample.byteLength,
    sourceDigest: sample.sourceDigest,
    materializedByteLength: sample.materializedByteLength,
    materializedDigest: sample.materializedDigest,
    screenshot
  };
};

const readSampleEvidence = async () => {
  const summary = JSON.parse(await readFile(sampleSummaryUrl, "utf8"));
  const materialization = JSON.parse(await readFile(materializationEvidenceUrl, "utf8"));
  const sampleBytes = await readFile(sampleFileUrl);
  const base64Prefix = Buffer.from(sampleBytes.subarray(0, 256)).toString("base64").slice(0, 96);

  return {
    fileName: "sample_model.psd",
    byteLength: summary.byteEvidence.byteLength,
    byteLengthLabel: `${summary.byteEvidence.byteLength} bytes`,
    sourceDigest: summary.byteEvidence.digest.hex,
    base64Prefix,
    selectedLayerName: materialization.selectedLayer.name,
    selectedLayerNodeRef: materialization.selectedLayer.nodeRef,
    materializationId: "mat_psd_root_layer_0",
    materializedByteLength: materialization.materializationEvidence.byteLength,
    materializedByteLengthLabel: `${materialization.materializationEvidence.byteLength} bytes`,
    materializedDigest: materialization.materializationEvidence.digest.hex,
    materializedMediaType: materialization.materializationEvidence.mediaType
  };
};

const assertInitialExplicitPsdImportState = async (page, label) => {
  await waitForText(page, editorTestIds.explicitPsdImportStatus, "No PSD selected");
  await waitForText(page, editorTestIds.explicitPsdImportSource, "User-selected PSD file only");
  await waitForText(page, editorTestIds.explicitPsdImportDocument, "No parsed PSD document metadata");
  await waitForText(page, editorTestIds.explicitPsdImportLayerTree, "No parsed PSD layer tree");
  await waitForText(
    page,
    editorTestIds.explicitPsdImportMaterialization,
    "No selected layer materialization evidence summary"
  );
  await waitForText(page, editorTestIds.explicitPsdImportDiagnostics, "No PSD parser diagnostics");

  const state = await readExplicitPsdImportState(page);
  if (state.selectedLayerControlValue !== selectedLayerNodeRef) {
    throw new Error(`${label} selected layer control mismatch: ${JSON.stringify(state)}.`);
  }
};

const assertParsedExplicitPsdImportState = async (page, sample, label) => {
  const state = await readExplicitPsdImportState(page);
  const failures = [];
  const expectText = (field, text, expected) => {
    if (!String(text).includes(expected)) {
      failures.push(`${field} missing ${JSON.stringify(expected)} in ${JSON.stringify(text)}`);
    }
  };
  const expectFact = (section, key, expected) => {
    if (section[key] !== expected) {
      failures.push(`${key}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(section[key])}`);
    }
  };
  const expectNumberFactAtLeast = (section, key, minimum) => {
    const value = Number(section[key]);
    if (!Number.isInteger(value) || value < minimum) {
      failures.push(`${key}: expected integer >= ${minimum}, received ${JSON.stringify(section[key])}`);
    }
  };

  expectText("status", state.statusText, "PSD parsed in browser session");
  expectText("status", state.statusText, selectedLayerNodeRef);
  expectText("panel", state.panelText, "sample_model.psd");
  expectFact(state.sourceFacts, "Filename", sample.fileName);
  expectFact(state.sourceFacts, "Byte length", sample.byteLengthLabel);
  expectFact(state.sourceFacts, "Intake", "explicitFile");
  expectFact(state.sourceFacts, "Raw PSD bytes", "not persisted by parser bridge");
  expectFact(state.documentFacts, "Profile", "layered-character-psd-profile-v1");
  expectFact(
    state.documentFacts,
    "Adapter",
    "wave45-browser-explicit-psd-import-adapter / 0.1.0"
  );
  expectFact(state.documentFacts, "Parser", "webtoonPsd / @webtoon/psd / 0.4.0");
  expectFact(state.documentFacts, "Runtime", "browser");
  expectNumberFactAtLeast(state.documentFacts, "Groups", 1);
  expectNumberFactAtLeast(state.documentFacts, "Layers", 1);
  expectNumberFactAtLeast(state.documentFacts, "Visible layers", 1);
  expectNumberFactAtLeast(state.documentFacts, "Raster candidates", 1);
  expectFact(state.persistenceFacts, "Parser objects", "notPersisted");
  expectFact(
    state.persistenceFacts,
    "PSD bytes",
    "sessionReadOnlyNoRawBytesPersistedByParser"
  );
  expectFact(state.persistenceFacts, "Materialized bytes", "summaryOnlyNoRawBytes");
  expectFact(
    state.persistenceFacts,
    "Save/load",
    "sessionEvidenceClearedOnProjectLoadReparseRequiredV1"
  );
  expectFact(state.persistenceFacts, "Compositing claim", "none");
  expectFact(state.persistenceFacts, "Pixel oracle claim", "none");
  expectText("featureSupport", state.featureSupportText, "psd.fullCompositing");
  expectText("featureSupport", state.featureSupportText, "psd.rendererPixelOracle");
  expectText("layerTree", state.layerTreeText, sample.selectedLayerName);
  expectText("layerTree", state.layerTreeText, sample.selectedLayerNodeRef);
  expectText("layerTree", state.layerTreeText, "referenceOnly");
  expectText("materialization", state.materializationText, sample.materializationId);
  expectText("materialization", state.materializationText, sample.selectedLayerNodeRef);
  expectText("materialization", state.materializationText, sample.materializedMediaType);
  expectText("materialization", state.materializationText, sample.materializedByteLengthLabel);
  expectText("materialization", state.materializationText, `sha256:${sample.materializedDigest}`);
  expectText(
    "materialization",
    state.materializationText,
    "summary only; raw materialized bytes not persisted"
  );
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.parse.completed");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.materialization.completed");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.mainThreadRisk.recorded");

  if (failures.length > 0) {
    throw new Error(`${label} explicit PSD import assertions failed: ${failures.join("; ")}.`);
  }
};

const assertSavedProjectExcludesExplicitPsdPayload = async (page, sample, label) => {
  const stored = await page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const serializedProject = JSON.stringify(project);
    const packageText = Array.isArray(project.packageFileSet)
      ? project.packageFileSet.map((entry) => entry.text ?? "").join("\n")
      : "";
    const operationLogJsonl = String(project.operationLogJsonl ?? "");

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      serializedProject,
      packageText,
      operationLogJsonl
    };
  }, editorProjectStorageKey);

  if (stored === null) {
    throw new Error(`${label} did not save a browser-local project.`);
  }

  const forbiddenSerializedClaims = [
    sample.fileName,
    sample.sourceDigest,
    sample.materializedDigest,
    sample.base64Prefix,
    "explicitPsdImport",
    "browserPsdParser",
    "browser-explicit-file",
    "@webtoon/psd",
    sample.selectedLayerNodeRef,
    sample.materializedByteLengthLabel,
    "rawRgbaBytes",
    "visualBytes",
    "raw materialized bytes",
    "public demo asset"
  ].filter((claim) => stored.serializedProject.includes(claim));
  const forbiddenPackagePayloadClaims = [
    "arrayBuffer",
    "bytesBase64",
    "rawRgbaBytes",
    "visualBytes",
    sample.base64Prefix
  ].filter((claim) => stored.packageText.includes(claim) || stored.operationLogJsonl.includes(claim));

  if (
    stored.schemaVersion !== "editor-project-persistence-v1" ||
    stored.packageId !== "pkg_editor_browser_sample" ||
    forbiddenSerializedClaims.length > 0 ||
    forbiddenPackagePayloadClaims.length > 0
  ) {
    throw new Error(
      `${label} saved project persisted explicit PSD parser/materialization payload: ${JSON.stringify({
        schemaVersion: stored.schemaVersion,
        packageId: stored.packageId,
        forbiddenSerializedClaims,
        forbiddenPackagePayloadClaims
      })}.`
    );
  }
};

const assertExplicitPsdImportClearedAfterLoad = async (page, sample, label) => {
  await assertInitialExplicitPsdImportState(page, label);
  const state = await readExplicitPsdImportState(page);
  const forbiddenLoadedClaims = [
    sample.fileName,
    sample.selectedLayerName,
    sample.materializedDigest,
    "PSD parsed in browser session",
    "browserPsdParser.parse.completed"
  ].filter((claim) => state.panelText.includes(claim));

  if (forbiddenLoadedClaims.length > 0) {
    throw new Error(
      `${label} explicit PSD import panel retained session-only evidence: ${forbiddenLoadedClaims.join(", ")}.`
    );
  }
};

const assertExplicitPsdImportReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const fileInput = document.querySelector(`[data-testid="${ids.fileInput}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(form instanceof HTMLFormElement) ||
      !(fileInput instanceof HTMLInputElement) ||
      !(submit instanceof HTMLButtonElement)
    ) {
      return null;
    }

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rectVisible = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < viewportWidth &&
      rect.bottom > 0 &&
      rect.top < viewportHeight;

    submit.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    const inputRect = fileInput.getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      formVisible: rectVisible(formRect),
      fileInputVisible: rectVisible(inputRect),
      submitVisible: rectVisible(submitRect),
      panelWidth: panelRect.width,
      formWidth: formRect.width,
      fileInputWidth: inputRect.width,
      submitWidth: submitRect.width
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    form: editorTestIds.explicitPsdImportForm,
    fileInput: editorTestIds.explicitPsdImportFileInput,
    submit: editorTestIds.explicitPsdImportSubmit
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.formVisible ||
    !metrics.fileInputVisible ||
    !metrics.submitVisible ||
    metrics.panelWidth < 1 ||
    metrics.formWidth < 1 ||
    metrics.fileInputWidth < 1 ||
    metrics.submitWidth < 1
  ) {
    throw new Error(
      `${viewport.name} explicit PSD import panel was not reachable/usable: ${JSON.stringify(metrics)}.`
    );
  }
};

const assertNoUnsupportedExplicitPsdImportClaims = async (page, label) => {
  const evidence = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const text = panel?.textContent ?? "";
    const positivePhraseClaimPatterns = [
      {
        label: "public demo asset",
        pattern: /\bpublic demo asset\b/gi
      },
      {
        label: "raw bytes persisted",
        pattern: /\braw bytes\s+(?:are\s+)?persisted\b/gi
      },
      {
        label: "visual bytes persisted",
        pattern: /\bvisual bytes\s+(?:are\s+)?persisted\b/gi
      }
    ];
    const unsupportedScopeClaimPatterns = [
      {
        label: "Cubism compatibility",
        pattern: new RegExp(["Cubism", "compatibility"].join("\\s+"), "i")
      },
      {
        label: "archive import",
        pattern: /archive import/i
      },
      {
        label: "drag-drop",
        pattern: /drag-drop/i
      }
    ];
    const isNegatedAt = (index) => {
      const prefix = text.slice(Math.max(0, index - 40), index).toLowerCase();
      const directNegationPattern = /(?:^|\W)(?:not|no|never|without)\s+(?:a\s+|an\s+)?$/;
      const joinedByteNegationPattern = /\b(?:not|no|never|without)\s+(?:raw|visual)\s+(?:or|and)\s+$/;
      return directNegationPattern.test(prefix) || joinedByteNegationPattern.test(prefix) || /non-$/.test(prefix);
    };
    const positivePhraseClaim = positivePhraseClaimPatterns.find(({ pattern }) => {
      pattern.lastIndex = 0;

      for (const match of text.matchAll(pattern)) {
        if (!isNegatedAt(match.index ?? 0)) {
          return true;
        }
      }

      return false;
    });
    const unsupportedScopeClaim = unsupportedScopeClaimPatterns.find(({ pattern }) => pattern.test(text));

    return {
      text,
      forbiddenClaim: positivePhraseClaim?.label ?? unsupportedScopeClaim?.label ?? null
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel
  });

  if (evidence.forbiddenClaim) {
    throw new Error(
      `${label} explicit PSD import UI made an unsupported claim (${evidence.forbiddenClaim}): ${evidence.text}`
    );
  }
};

const assertFixtureDocsRegistration = async () => {
  const fixtureManifest = await readFile(fixtureManifestUrl, "utf8");
  const traceabilityMatrix = await readFile(traceabilityMatrixUrl, "utf8");
  const requiredManifestTokens = [
    "wave45-psd-import-focused-e2e-regression",
    "private/local",
    "not a public demo asset",
    "apps/editor/e2e/psd-import-focused-smoke.mjs",
    "scripts/check-psd-parser-import-boundary.mjs"
  ];
  const requiredTraceabilityTokens = [
    "TC-WAVE45-PSD-IMPORT-FOCUSED-E2E-001",
    "wave45-psd-import-focused-e2e-regression",
    "private/local",
    "no raw or visual bytes",
    "check-psd-parser-import-boundary"
  ];
  const missing = [
    ...requiredManifestTokens
      .filter((token) => !fixtureManifest.includes(token))
      .map((token) => `fixture-manifest:${token}`),
    ...requiredTraceabilityTokens
      .filter((token) => !traceabilityMatrix.includes(token))
      .map((token) => `traceability:${token}`)
  ];

  if (missing.length > 0) {
    throw new Error(`Wave45 PSD import fixture/traceability registration missing: ${missing.join(", ")}.`);
  }
};

const readExplicitPsdImportState = async (page) =>
  page.evaluate((ids) => {
    const readText = (testId) =>
      document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
    const readFacts = (testId) => {
      const root = document.querySelector(`[data-testid="${testId}"]`);
      const facts = {};

      for (const term of root?.querySelectorAll("dt") ?? []) {
        const key = term.textContent?.trim() ?? "";
        const value = term.nextElementSibling?.textContent?.trim() ?? "";
        facts[key] = value;
      }

      return facts;
    };
    const selectedLayerControl = document.querySelector(`[data-testid="${ids.selectedLayer}"]`);

    return {
      panelText: readText(ids.panel),
      statusText: readText(ids.status),
      sourceFacts: readFacts(ids.source),
      documentFacts: readFacts(ids.document),
      featureFacts: readFacts(ids.featureSupport),
      featureSupportText: readText(ids.featureSupport),
      materializationText: readText(ids.materialization),
      layerTreeText: readText(ids.layerTree),
      persistenceFacts: readFacts(ids.persistence),
      diagnosticsText: readText(ids.diagnostics),
      selectedLayerControlValue:
        selectedLayerControl instanceof HTMLInputElement ? selectedLayerControl.value : null
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    status: editorTestIds.explicitPsdImportStatus,
    source: editorTestIds.explicitPsdImportSource,
    document: editorTestIds.explicitPsdImportDocument,
    featureSupport: editorTestIds.explicitPsdImportFeatureSupport,
    materialization: editorTestIds.explicitPsdImportMaterialization,
    layerTree: editorTestIds.explicitPsdImportLayerTree,
    persistence: editorTestIds.explicitPsdImportPersistence,
    diagnostics: editorTestIds.explicitPsdImportDiagnostics,
    selectedLayer: editorTestIds.explicitPsdImportSelectedLayerNodeRef
  });

const setSelectedLayerNodeRef = async (page, nodeRef) => {
  await page.evaluate((id, value) => {
    const input = document.querySelector(`[data-testid="${id}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Missing selected layer input for test id ${id}.`);
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, editorTestIds.explicitPsdImportSelectedLayerNodeRef, nodeRef);
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

const waitForText = async (page, testId, expectedText, timeoutMs = 15_000) => {
  await page.waitFor(
    `${testId} text ${expectedText}`,
    (id, text) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.includes(text) ?? false,
    { timeoutMs },
    testId,
    expectedText
  );
};

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    await assertFixtureDocsRegistration();
    console.log(
      `psd-import-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of psdImportFocusedSmokeViewports) {
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

        const result = await runPsdImportFocusedSmoke({ page, viewport });
        console.log(
          `psd-import-focused-e2e: ${viewport.name} passed byteLength=${result.byteLength} materializedBytes=${result.materializedByteLength}`
        );
        console.log(
          `psd-import-focused-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("psd-import-focused-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
