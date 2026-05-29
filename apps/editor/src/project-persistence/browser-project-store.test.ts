import {
  createEmptyAiCommandTranscriptDocument,
  parseAiCommandTranscriptDocument
} from "@private-2d-rigging-lab/ai-interface";
import { describe, expect, it } from "vitest";

import { createEditorSessionAdapter } from "../editor-session/session-adapter.js";
import { createBrowserProjectStore } from "./browser-project-store.js";
import type { StorageLike } from "./storage-like.js";

describe("browser project store", () => {
  it("saves and loads package file set and operation log JSONL", () => {
    const storage = createMemoryStorage();
    const store = createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T03:00:00.000Z")
    });
    const persistence = createCommittedEditorPersistence();

    const saved = store.saveProject({
      packageFileSet: persistence.packageFileSet,
      operationLogJsonl: persistence.operationLogJsonl,
      generatedArtifactPaths: persistence.generatedArtifactPaths
    });
    const loaded = store.loadProject();

    expect(saved.status).toBe("saved");
    expect(saved.project.savedAt).toBe("2026-05-29T03:00:00.000Z");
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error(`Expected loaded project, received ${loaded.status}.`);
    }
    expect(loaded.project.packageFileSet).toEqual(persistence.packageFileSet);
    expect(loaded.project.operationLogJsonl).toBe(persistence.operationLogJsonl);
    expect(loaded.project.aiCommandTranscript).toEqual(createEmptyAiCommandTranscriptDocument());
    expect(loaded.project.generatedArtifactPaths).toEqual(persistence.generatedArtifactPaths);
    expect(loaded.project.packageSummary).toEqual({
      packageId: persistence.reloadedDocument.manifest.packageId,
      packageDisplayName: persistence.reloadedDocument.manifest.packageDisplayName,
      formatVersion: persistence.reloadedDocument.manifest.formatVersion,
      packageRevision: persistence.reloadedDocument.manifest.packageRevision,
      updatedAt: persistence.reloadedDocument.manifest.updatedAt
    });
  });

  it("saves and loads an AI command transcript document", () => {
    const storage = createMemoryStorage();
    const store = createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T03:00:00.000Z")
    });
    const persistence = createCommittedEditorPersistence();
    const aiCommandTranscript = createAiCommandTranscriptDocument();

    const saved = store.saveProject({
      packageFileSet: persistence.packageFileSet,
      operationLogJsonl: persistence.operationLogJsonl,
      aiCommandTranscript,
      generatedArtifactPaths: persistence.generatedArtifactPaths
    });
    const loaded = store.loadProject();

    expect(saved.project.aiCommandTranscript).toEqual(aiCommandTranscript);
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error(`Expected loaded project, received ${loaded.status}.`);
    }
    expect(loaded.project.aiCommandTranscript).toEqual(aiCommandTranscript);
  });

  it("loads legacy saved projects without AI transcript as an empty transcript", () => {
    const project = createSavedProject();
    const legacyProject = {
      schemaVersion: project.schemaVersion,
      savedAt: project.savedAt,
      packageFileSet: project.packageFileSet,
      operationLogJsonl: project.operationLogJsonl,
      generatedArtifactPaths: project.generatedArtifactPaths,
      packageSummary: project.packageSummary
    };
    const storage = createMemoryStorage([
      ["private-2d-rigging-lab.editor-project", JSON.stringify(legacyProject)]
    ]);
    const store = createBrowserProjectStore({ storage });

    const loaded = store.loadProject();

    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error(`Expected loaded project, received ${loaded.status}.`);
    }
    expect(loaded.project.aiCommandTranscript).toEqual(createEmptyAiCommandTranscriptDocument());
  });

  it("clears saved project storage", () => {
    const storage = createMemoryStorage();
    const store = createBrowserProjectStore({ storage });
    const persistence = createCommittedEditorPersistence();

    store.saveProject({
      packageFileSet: persistence.packageFileSet,
      operationLogJsonl: persistence.operationLogJsonl,
      generatedArtifactPaths: persistence.generatedArtifactPaths
    });
    const cleared = store.clearProject();

    expect(cleared.status).toBe("cleared");
    expect(store.loadProject()).toEqual({
      status: "empty",
      storageKey: cleared.storageKey
    });
  });

  it("returns failed result for invalid JSON without throwing", () => {
    const storage = createMemoryStorage([
      ["private-2d-rigging-lab.editor-project", "{not-json"]
    ]);
    const store = createBrowserProjectStore({ storage });

    expect(() => store.loadProject()).not.toThrow();
    expect(store.loadProject()).toEqual(
      expect.objectContaining({
        status: "failed",
        reason: "invalid-json"
      })
    );
  });

  it("returns failed result for invalid schema without throwing", () => {
    const storage = createMemoryStorage([
      ["private-2d-rigging-lab.editor-project", JSON.stringify({ schemaVersion: "wrong" })]
    ]);
    const store = createBrowserProjectStore({ storage });

    expect(() => store.loadProject()).not.toThrow();
    expect(store.loadProject()).toEqual(
      expect.objectContaining({
        status: "failed",
        reason: "invalid-schema"
      })
    );
  });

  it("returns failed result for corrupt package file set without throwing", () => {
    const project = createSavedProject();
    const storage = createMemoryStorage([
      [
        "private-2d-rigging-lab.editor-project",
        JSON.stringify({
          ...project,
          packageFileSet: [{ path: "manifest.json", text: "{not-json" }]
        })
      ]
    ]);
    const store = createBrowserProjectStore({ storage });

    expect(() => store.loadProject()).not.toThrow();
    expect(store.loadProject()).toEqual(
      expect.objectContaining({
        status: "failed",
        reason: "invalid-package-file-set"
      })
    );
  });

  it("returns failed result for corrupt operation log JSONL without throwing", () => {
    const project = createSavedProject();
    const storage = createMemoryStorage([
      [
        "private-2d-rigging-lab.editor-project",
        JSON.stringify({
          ...project,
          operationLogJsonl: "\n"
        })
      ]
    ]);
    const store = createBrowserProjectStore({ storage });

    expect(() => store.loadProject()).not.toThrow();
    expect(store.loadProject()).toEqual(
      expect.objectContaining({
        status: "failed",
        reason: "invalid-operation-log-jsonl"
      })
    );
  });

  it("returns failed result for corrupt AI command transcript without throwing", () => {
    const project = createSavedProject();
    const storage = createMemoryStorage([
      [
        "private-2d-rigging-lab.editor-project",
        JSON.stringify({
          ...project,
          aiCommandTranscript: {
            schemaVersion: "ai-command-transcript-v1",
            entries: [
              {
                schemaVersion: "ai-command-transcript-entry-v1",
                entryType: "approval",
                dryRunCommandId: "cmd_project_store_dry_run",
                agentId: "agent_project_store",
                approvalStatus: "rejected",
                evidenceRefs: []
              }
            ]
          }
        })
      ]
    ]);
    const store = createBrowserProjectStore({ storage });

    expect(() => store.loadProject()).not.toThrow();
    expect(store.loadProject()).toEqual(
      expect.objectContaining({
        status: "failed",
        reason: "invalid-ai-command-transcript"
      })
    );
  });
});

const createAiCommandTranscriptDocument = () =>
  parseAiCommandTranscriptDocument({
    schemaVersion: "ai-command-transcript-v1",
    entries: [
      {
        schemaVersion: "ai-command-transcript-entry-v1",
        entryType: "command",
        commandId: "cmd_project_store_dry_run",
        agentId: "agent_project_store",
        command: "dryRunOperation",
        capabilities: ["dryRunEdit"],
        basis: {
          packageRevision: 0,
          relatedAC: ["AC-MVP-014"],
          relatedScenarios: ["SC-AGENT-002"]
        },
        status: "needs_approval",
        evidenceRefs: ["runtime/snapshots/snap_project_store.runtime-snapshot.json"],
        operationId: "op_project_store_create_parameter_smile"
      },
      {
        schemaVersion: "ai-command-transcript-entry-v1",
        entryType: "approval",
        dryRunCommandId: "cmd_project_store_dry_run",
        agentId: "agent_project_store",
        approvalStatus: "approved",
        evidenceRefs: [],
        operationId: "op_project_store_create_parameter_smile"
      }
    ]
  });

const createSavedProject = () => {
  const persistence = createCommittedEditorPersistence();
  const store = createBrowserProjectStore({
    storage: createMemoryStorage(),
    now: () => new Date("2026-05-29T03:00:00.000Z")
  });

  return store.saveProject({
    packageFileSet: persistence.packageFileSet,
    operationLogJsonl: persistence.operationLogJsonl,
    generatedArtifactPaths: persistence.generatedArtifactPaths
  }).project;
};

const createCommittedEditorPersistence = () => {
  const adapter = createEditorSessionAdapter({
    now: () => new Date("2026-05-29T02:30:00.000Z")
  });

  return adapter.commitCreateParameter({
    operationId: "op_project_store_create_parameter_smile",
    parameterId: "param_project_store_smile",
    displayName: "Project Store Smile",
    semanticRole: "mouth",
    projectPresetAlias: "private-project-store-smile-control",
    min: 0,
    max: 1,
    defaultValue: 0,
    recommendedUiStep: 0.01
  });
};

const createMemoryStorage = (
  entries: readonly (readonly [string, string])[] = []
): StorageLike => {
  const values = new Map(entries);

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
