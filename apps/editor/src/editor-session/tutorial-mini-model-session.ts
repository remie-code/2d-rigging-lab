import {
  createTutorialMiniModelSeedPackageDocument
} from "@private-2d-rigging-lab/authoring-core";

import {
  createEditorSessionAdapter,
  type EditorSessionAdapter,
  type EditorSessionAdapterOptions
} from "./session-adapter.js";

export const EDITOR_TUTORIAL_MINI_MODEL_PACKAGE_HASH =
  "sha256:editor-tutorial-mini-model-v0";

export const createEditorTutorialMiniModelSeedAdapter = (
  options: Pick<EditorSessionAdapterOptions, "now"> = {}
): EditorSessionAdapter =>
  createEditorSessionAdapter({
    packageDocument: createTutorialMiniModelSeedPackageDocument(),
    packageHash: EDITOR_TUTORIAL_MINI_MODEL_PACKAGE_HASH,
    ...options
  });
