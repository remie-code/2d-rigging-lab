import {
  projectExplicitPsdImportStateFromBridgeResult,
  type ExplicitPsdImportState
} from "../editor-state/index.js";
import {
  parseExplicitBrowserPsdFile
} from "./browser-psd-parser-bridge.js";
import type { BrowserPsdParserBridgeResult } from "./browser-psd-parser-bridge-result.js";

export interface EditorExplicitPsdImportFileCommand {
  readonly file: File;
  readonly selectedLayerNodeRef?: string;
}

export interface EditorExplicitPsdImportWorkflowResult {
  readonly status: BrowserPsdParserBridgeResult["status"];
  readonly fileName: string;
  readonly byteLength: number;
  readonly selectedLayerNodeRef: string;
}

export interface EditorExplicitPsdImportWorkflowOutcome {
  readonly state: ExplicitPsdImportState;
  readonly result: EditorExplicitPsdImportWorkflowResult;
}

export const runEditorExplicitPsdImportWorkflow = async (
  command: EditorExplicitPsdImportFileCommand
): Promise<EditorExplicitPsdImportWorkflowOutcome> => {
  const selectedLayerNodeRef = command.selectedLayerNodeRef?.trim();
  const bridgeResult = await parseExplicitBrowserPsdFile({
    file: command.file,
    ...(selectedLayerNodeRef === undefined || selectedLayerNodeRef.length === 0
      ? {}
      : { selectedLayerNodeRef })
  });
  const state = projectExplicitPsdImportStateFromBridgeResult(bridgeResult, {
    ...(selectedLayerNodeRef === undefined || selectedLayerNodeRef.length === 0
      ? {}
      : { selectedLayerNodeRef })
  });

  return {
    state,
    result: {
      status: bridgeResult.status,
      fileName: bridgeResult.source.fileName,
      byteLength: bridgeResult.source.byteLength,
      selectedLayerNodeRef: state.selectedLayerNodeRef
    }
  };
};
