export const wave42FocusedE2eRegistryBoundary = {
  root: "apps/editor/e2e",
  entryKind: "directFocusedSmokeScript",
  includeFileNamePattern: "*-smoke.mjs",
  aggregateEntryPoints: ["scripts/editor-e2e-smoke.mjs"],
  excludedHelperFiles: [
    "apps/editor/e2e/browser-discovery.mjs",
    "apps/editor/e2e/cdp-client.mjs",
    "apps/editor/e2e/chrome-launcher.mjs",
    "apps/editor/e2e/early-escape.mjs",
    "apps/editor/e2e/page-session.mjs",
    "apps/editor/e2e/smoke-checks.mjs",
    "apps/editor/e2e/test-ids.mjs",
    "apps/editor/e2e/vite-server.mjs"
  ],
  entries: [
    {
      id: "assetIoBoundary",
      path: "apps/editor/e2e/asset-io-boundary-smoke.mjs",
      command: "node apps/editor/e2e/asset-io-boundary-smoke.mjs",
      category: "assetIoBoundary"
    },
    {
      id: "byteIntake",
      path: "apps/editor/e2e/byte-intake-smoke.mjs",
      command: "node apps/editor/e2e/byte-intake-smoke.mjs",
      category: "assetIoBoundary"
    },
    {
      id: "canvasMeshEditPersistence",
      path: "apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs",
      command: "node apps/editor/e2e/canvas-mesh-edit-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "codexProposalReview",
      path: "apps/editor/e2e/codex-proposal-review-smoke.mjs",
      command: "node apps/editor/e2e/codex-proposal-review-smoke.mjs",
      category: "codexProposal"
    },
    {
      id: "compositionPersistence",
      path: "apps/editor/e2e/composition-persistence-smoke.mjs",
      command: "node apps/editor/e2e/composition-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "dynamicsPersistence",
      path: "apps/editor/e2e/dynamics-persistence-smoke.mjs",
      command: "node apps/editor/e2e/dynamics-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "layerControls",
      path: "apps/editor/e2e/layer-controls-smoke.mjs",
      command: "node apps/editor/e2e/layer-controls-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "layerTreeDirectManipulation",
      path: "apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs",
      command: "node apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "meshVertex",
      path: "apps/editor/e2e/mesh-vertex-smoke.mjs",
      command: "node apps/editor/e2e/mesh-vertex-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "partTextureLayerPersistence",
      path: "apps/editor/e2e/part-texture-layer-persistence-smoke.mjs",
      command: "node apps/editor/e2e/part-texture-layer-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "portableBundleRoundtrip",
      path: "apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs",
      command: "node apps/editor/e2e/portable-bundle-roundtrip-smoke.mjs",
      category: "transportBoundary"
    },
    {
      id: "productPreflight",
      path: "apps/editor/e2e/product-preflight-smoke.mjs",
      command: "node apps/editor/e2e/product-preflight-smoke.mjs",
      category: "productPreflight"
    },
    {
      id: "productPreflightDiff",
      path: "apps/editor/e2e/product-preflight-diff-smoke.mjs",
      command: "node apps/editor/e2e/product-preflight-diff-smoke.mjs",
      category: "productPreflight"
    },
    {
      id: "rigControlPersistence",
      path: "apps/editor/e2e/rig-control-persistence-smoke.mjs",
      command: "node apps/editor/e2e/rig-control-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "sourceIntake",
      path: "apps/editor/e2e/source-intake-smoke.mjs",
      command: "node apps/editor/e2e/source-intake-smoke.mjs",
      category: "assetIoBoundary"
    },
    {
      id: "topologyUvPersistence",
      path: "apps/editor/e2e/topology-uv-persistence-smoke.mjs",
      command: "node apps/editor/e2e/topology-uv-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "tutorialMiniModelPersistence",
      path: "apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs",
      command: "node apps/editor/e2e/tutorial-mini-model-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    },
    {
      id: "viewerRuntime",
      path: "apps/editor/e2e/viewer-runtime-smoke.mjs",
      command: "node apps/editor/e2e/viewer-runtime-smoke.mjs",
      category: "viewerRuntime"
    },
    {
      id: "warpLatticePersistence",
      path: "apps/editor/e2e/warp-lattice-persistence-smoke.mjs",
      command: "node apps/editor/e2e/warp-lattice-persistence-smoke.mjs",
      category: "editorAuthoringPersistence"
    }
  ]
};
