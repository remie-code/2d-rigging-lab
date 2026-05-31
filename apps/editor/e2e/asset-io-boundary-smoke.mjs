import { readFile } from "node:fs/promises";

import {
  createImportedSourceAssetRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const packageDocumentUrl = new URL(
  "../../../fixtures/e2e/wave22-asset-io-boundary/package-document.json",
  import.meta.url
);

const sourceSummary = {
  psdSourceAssetId: "src_wave22_psd_boundary",
  psdLayerId: "layer_wave22_psd_face",
  psdTextureId: "tex_wave22_psd_face",
  psdAdapterName: "wave22-e2e-psd-profile",
  splitSourceAssetId: "src_wave22_split_png_boundary",
  splitLayerId: "layer_wave22_split_face",
  splitTextureId: "tex_wave22_split_face"
};

export const runAssetIoBoundaryPersistenceSmoke = async ({ page, viewport }) => {
  const packageDocument = await readAssetIoBoundaryPackageDocument();

  await seedAssetIoBoundaryProject(page, packageDocument);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertAssetIoBoundaryVisible(page);
  await assertAssetIoBoundaryStoredMetadata(page, "seeded load");

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertAssetIoBoundaryStoredMetadata(page, "after browser save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertAssetIoBoundaryVisible(page);
  await assertAssetIoBoundaryStoredMetadata(page, "after browser reload and load");

  const screenshot = await page.captureScreenshot(`${viewport.name} wave22 asset I/O boundary smoke`);

  return {
    viewport: viewport.name,
    sourceAssetIds: [
      sourceSummary.psdSourceAssetId,
      sourceSummary.splitSourceAssetId
    ],
    screenshot
  };
};

const readAssetIoBoundaryPackageDocument = async () => {
  const text = await readFile(packageDocumentUrl, "utf8");
  return JSON.parse(text);
};

const seedAssetIoBoundaryProject = async (page, packageDocument) => {
  const project = createPersistedProject(packageDocument);

  await page.evaluate((key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, editorProjectStorageKey, project);
};

const createPersistedProject = (packageDocument) => ({
  schemaVersion: "editor-project-persistence-v1",
  savedAt: "2026-05-31T02:30:00.000Z",
  packageFileSet: serializePackageDocumentToFileSet(packageDocument),
  operationLogJsonl: "",
  generatedArtifactPaths: [],
  packageSummary: {
    packageId: packageDocument.manifest.packageId,
    packageDisplayName: packageDocument.manifest.packageDisplayName,
    formatVersion: packageDocument.manifest.formatVersion,
    packageRevision: packageDocument.manifest.packageRevision,
    updatedAt: packageDocument.manifest.updatedAt
  }
});

const serializePackageDocumentToFileSet = (document) => {
  const entries = [
    createJsonFileEntry("manifest.json", document.manifest),
    createJsonFileEntry(document.manifest.modelFiles.graph, document.model.graph),
    createJsonFileEntry(document.manifest.modelFiles.drawables, document.model.drawables),
    createJsonFileEntry(document.manifest.modelFiles.meshes, document.model.meshes),
    createJsonFileEntry(document.manifest.modelFiles.parameters, document.model.parameters),
    createJsonFileEntry(document.manifest.modelFiles.keyforms, document.model.keyforms),
    createJsonFileEntry(document.manifest.modelFiles.rigControls, document.model.rigControls),
    createJsonFileEntry(document.manifest.modelFiles.dynamics, document.model.dynamics),
    createJsonFileEntry(document.manifest.modelFiles.masks, document.model.masks),
    createJsonFileEntry(document.manifest.modelFiles.drawOrder, document.model.drawOrder),
    createJsonFileEntry(document.manifest.assetIndex, document.assets.sourceManifest),
    createJsonFileEntry("assets/textures/texture-atlas.json", document.assets.textureAtlas),
    createJsonFileEntry("assets/provenance.json", document.assets.provenance),
    createJsonFileEntry("assets/rights.json", document.assets.rights)
  ];

  if (document.manifest.modelFiles.editorState !== undefined) {
    entries.push(createJsonFileEntry(
      document.manifest.modelFiles.editorState,
      document.model.editorState
    ));
  }

  return entries;
};

const createJsonFileEntry = (path, value) => ({
  path,
  text: `${JSON.stringify(value, null, 2)}\n`
});

const assertAssetIoBoundaryVisible = async (page) => {
  const psdRow = createImportedSourceAssetRowTestId(sourceSummary.psdSourceAssetId);
  const splitRow = createImportedSourceAssetRowTestId(sourceSummary.splitSourceAssetId);

  await waitForText(page, editorTestIds.packageStatus, "pkg_wave22_asset_io_e2e");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "2 imported source assets");

  await waitForText(page, psdRow, sourceSummary.psdSourceAssetId);
  await waitForText(page, psdRow, "assets/sources/e2e/wave22-character.psd");
  await waitForText(page, psdRow, "layered-character-psd-profile-v1");
  await waitForText(page, psdRow, sourceSummary.psdLayerId);
  await waitForText(
    page,
    psdRow,
    `Structured PSD profile metadata from ${sourceSummary.psdAdapterName}; editor did not parse PSD bytes.`
  );
  await waitForText(page, psdRow, `${sourceSummary.psdAdapterName} / adapter-supplied-metadata-v1`);
  await waitForText(page, psdRow, "1 structured layer");
  await waitForText(page, psdRow, "structured-profile-preferred-v1");
  await waitForText(page, psdRow, `${sourceSummary.psdTextureId} / part_root`);
  await waitForText(
    page,
    psdRow,
    "Source binary ref / bin_wave22_psd_source / missing-package-local-bytes-v1; package-local bytes are missing"
  );
  await waitForText(page, psdRow, "assets/sources/e2e/wave22-character.psd");
  await waitForText(page, psdRow, "2048 bytes");
  await waitForText(page, psdRow, "sha256:111111111111...");
  await waitForText(
    page,
    psdRow,
    "Texture binary ref tex_wave22_psd_face / bin_wave22_psd_face_preview / missing-package-local-bytes-v1; package-local bytes are missing"
  );
  await waitForText(page, psdRow, "assets/textures/e2e/wave22-psd-face.texture-bytes");
  await waitForText(page, psdRow, "metadata only; no editor file import or image decode");

  await waitForText(page, splitRow, sourceSummary.splitSourceAssetId);
  await waitForText(page, splitRow, "assets/sources/e2e/wave22-split-manifest.json");
  await waitForText(page, splitRow, "split-png-fallback-v1");
  await waitForText(page, splitRow, "Split PNG source manifest metadata.");
  await waitForText(page, splitRow, sourceSummary.splitLayerId);
  await waitForText(page, splitRow, sourceSummary.splitTextureId);
  await waitForText(
    page,
    splitRow,
    "Source binary ref / bin_wave22_split_manifest / storage-unsupported-v1; current workflow cannot store bytes"
  );
  await waitForText(
    page,
    splitRow,
    "Texture binary ref tex_wave22_split_face / bin_wave22_split_texture / storage-unsupported-v1; current workflow cannot store bytes"
  );
  await waitForText(page, splitRow, "assets/textures/e2e/wave22-split-face.texture-bytes");
  await waitForText(page, splitRow, "metadata only; no editor file import or image decode");

  await assertAssetIoBoundaryVisibleTruthfulness(page);
};

const assertAssetIoBoundaryStoredMetadata = async (page, label) => {
  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const sourceManifest = readPackageJsonFile(project, "assets/sources/source-manifest.json");
    const textureAtlas = readPackageJsonFile(project, "assets/textures/texture-atlas.json");
    const packageText = Array.isArray(project.packageFileSet)
      ? project.packageFileSet.map((entry) => entry.text).join("\n")
      : "";

    const psdSource = sourceManifest?.sourceAssets?.find(
      (source) => source.sourceAssetId === "src_wave22_psd_boundary"
    );
    const splitSource = sourceManifest?.sourceAssets?.find(
      (source) => source.sourceAssetId === "src_wave22_split_png_boundary"
    );
    const psdTexture = textureAtlas?.textures?.find(
      (texture) => texture.textureId === "tex_wave22_psd_face"
    );
    const splitTexture = textureAtlas?.textures?.find(
      (texture) => texture.textureId === "tex_wave22_split_face"
    );
    const psdLayer = psdSource?.psdProfile?.sourceLayers?.find(
      (layer) => layer.sourceLayerId === "layer_wave22_psd_face"
    );

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      sourceCount: sourceManifest?.sourceAssets?.length ?? 0,
      textureCount: textureAtlas?.textures?.length ?? 0,
      psdProfile: {
        adapterName: psdSource?.psdProfile?.adapter?.adapterName ?? null,
        sourceProfile: psdSource?.psdProfile?.adapter?.sourceProfile ?? null,
        structuredLayerTextureId: psdLayer?.textureId ?? null,
        structuredLayerTexturePreviewReference: psdLayer?.texturePreviewReference ?? null,
        compatibility: psdSource?.psdProfile?.compatibility?.structuredProfilePrecedence ?? null
      },
      splitProfile: {
        kind: splitSource?.kind ?? null,
        importProfile: splitSource?.importProfile ?? null,
        layerId: splitSource?.layers?.[0]?.sourceLayerId ?? null
      },
      refs: [
        summarizeRef("psdSource", psdSource?.binaryAssetRef),
        summarizeRef("psdTexture", psdTexture?.binaryAssetRef),
        summarizeRef("splitSource", splitSource?.binaryAssetRef),
        summarizeRef("splitTexture", splitTexture?.binaryAssetRef)
      ],
      forbiddenPayloadFieldsPresent:
        packageText.includes("bytesBase64") ||
        packageText.includes("decodedImageSize") ||
        packageText.includes("pixelData") ||
        packageText.includes("arrayBuffer")
    };

    function summarizeRef(owner, ref) {
      return {
        owner,
        binaryAssetId: ref?.binaryAssetId ?? null,
        packageRelativePath: ref?.packageRelativePath ?? null,
        storageStatus: ref?.storageStatus ?? null,
        mediaType: ref?.mediaType ?? null,
        byteLength: ref?.byteLength ?? null,
        digestHex: ref?.digest?.hex ?? null,
        provenanceId: ref?.provenanceId ?? null,
        rightsAssetId: ref?.rightsAssetId ?? null
      };
    }

    function readPackageJsonFile(projectValue, path) {
      if (!Array.isArray(projectValue.packageFileSet)) {
        return null;
      }

      const entry = projectValue.packageFileSet.find((candidate) => candidate.path === path);
      if (typeof entry?.text !== "string") {
        return null;
      }

      return JSON.parse(entry.text);
    }
  }, editorProjectStorageKey);

  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: "pkg_wave22_asset_io_e2e",
    packageRevision: 7,
    sourceCount: 2,
    textureCount: 2,
    psdProfile: {
      adapterName: "wave22-e2e-psd-profile",
      sourceProfile: "layered-character-psd-profile-v1",
      structuredLayerTextureId: "tex_wave22_psd_face",
      structuredLayerTexturePreviewReference: "assets/textures/e2e/wave22-psd-face.texture-bytes",
      compatibility: "structured-profile-preferred-v1"
    },
    splitProfile: {
      kind: "split-png-set-v1",
      importProfile: "split-png-fallback-v1",
      layerId: "layer_wave22_split_face"
    },
    refs: [
      {
        owner: "psdSource",
        binaryAssetId: "bin_wave22_psd_source",
        packageRelativePath: "assets/sources/e2e/wave22-character.psd",
        storageStatus: "missing-package-local-bytes-v1",
        mediaType: "application/octet-stream",
        byteLength: 2048,
        digestHex: "1111111111111111111111111111111111111111111111111111111111111111",
        provenanceId: "prov_wave22_psd_boundary",
        rightsAssetId: "src_wave22_psd_boundary"
      },
      {
        owner: "psdTexture",
        binaryAssetId: "bin_wave22_psd_face_preview",
        packageRelativePath: "assets/textures/e2e/wave22-psd-face.texture-bytes",
        storageStatus: "missing-package-local-bytes-v1",
        mediaType: "application/octet-stream",
        byteLength: 128,
        digestHex: "2222222222222222222222222222222222222222222222222222222222222222",
        provenanceId: "prov_wave22_psd_boundary",
        rightsAssetId: "src_wave22_psd_boundary"
      },
      {
        owner: "splitSource",
        binaryAssetId: "bin_wave22_split_manifest",
        packageRelativePath: "assets/sources/e2e/wave22-split-manifest.json",
        storageStatus: "storage-unsupported-v1",
        mediaType: "application/octet-stream",
        byteLength: 1536,
        digestHex: "3333333333333333333333333333333333333333333333333333333333333333",
        provenanceId: "prov_wave22_split_boundary",
        rightsAssetId: "src_wave22_split_png_boundary"
      },
      {
        owner: "splitTexture",
        binaryAssetId: "bin_wave22_split_texture",
        packageRelativePath: "assets/textures/e2e/wave22-split-face.texture-bytes",
        storageStatus: "storage-unsupported-v1",
        mediaType: "application/octet-stream",
        byteLength: 96,
        digestHex: "4444444444444444444444444444444444444444444444444444444444444444",
        provenanceId: "prov_wave22_split_boundary",
        rightsAssetId: "src_wave22_split_png_boundary"
      }
    ],
    forbiddenPayloadFieldsPresent: false
  };

  if (JSON.stringify(stored) !== JSON.stringify(expected)) {
    throw new Error(
      `Wave 22 asset I/O stored metadata mismatch during ${label}: expected ${JSON.stringify(
        expected
      )}, received ${JSON.stringify(stored)}.`
    );
  }
};

const assertAssetIoBoundaryVisibleTruthfulness = async (page) => {
  const evidence = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const text = panel?.textContent ?? "";
    const unsupportedClaim = /file picker|uploaded binary|parsed from bytes|image decoding|raster extraction|decoded PSD|decoded PNG|archive import/i;

    return {
      text,
      unsupportedClaim: unsupportedClaim.test(text)
    };
  }, {
    panel: editorTestIds.sourceIntakePanel
  });

  if (evidence.unsupportedClaim) {
    throw new Error(`Wave 22 asset I/O UI made an unsupported binary boundary claim: ${evidence.text}`);
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
