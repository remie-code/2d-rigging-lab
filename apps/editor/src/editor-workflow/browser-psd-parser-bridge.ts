import {
  browserPsdParserBridgeDefaultSizeCapBytes,
  browserPsdParserBridgeDefaultSourceAssetId,
  createBrowserPsdParserErrorEvidence,
  createBrowserPsdSourceEvidence,
  createBrowserPsdThreadingEvidence,
  type BrowserPsdParserBridgeResult
} from "./browser-psd-parser-bridge-result.js";
import { parseBrowserPsdBytesWithAdapter } from "./browser-psd-parser-adapter.js";

export interface ExplicitBrowserPsdArrayBufferInput {
  readonly fileName: string;
  readonly bytes: ArrayBuffer | Uint8Array;
  readonly declaredMediaType?: string;
  readonly sourceAssetId?: string;
  readonly sizeCapBytes?: number;
  readonly selectedLayerNodeRef?: string;
}

export interface ExplicitBrowserPsdFileInput {
  readonly file: File;
  readonly sourceAssetId?: string;
  readonly sizeCapBytes?: number;
  readonly selectedLayerNodeRef?: string;
}

export const parseExplicitBrowserPsdFile = async (
  input: ExplicitBrowserPsdFileInput
): Promise<BrowserPsdParserBridgeResult> => {
  const sizeCapBytes = input.sizeCapBytes ?? browserPsdParserBridgeDefaultSizeCapBytes;
  if (input.file.size > sizeCapBytes) {
    const source = createBrowserPsdSourceEvidence({
      intakeKind: "explicitFile",
      sourceAssetId: input.sourceAssetId ?? browserPsdParserBridgeDefaultSourceAssetId,
      fileName: input.file.name,
      declaredMediaType: input.file.type,
      byteLength: input.file.size,
      sizeCapBytes
    });
    const diagnostics = [
      {
        checkId: "browserPsdParser.sizeCapExceeded",
        severity: "error" as const,
        message: `Selected PSD byte length ${input.file.size} exceeds the browser parser bridge cap ${sizeCapBytes}.`,
        source: { kind: "adapter" as const, path: "/browser-psd-parser-bridge/size-cap" },
        evidence: ["browser-psd-parser-bridge:size-cap"]
      }
    ];

    return {
      status: "rejected",
      source,
      threading: createBrowserPsdThreadingEvidence(),
      diagnostics,
      errorEvidence: [
        createBrowserPsdParserErrorEvidence({
          errorId: "browserPsdParser.sizeCapExceeded",
          failureKind: "sizeLimitExceeded",
          severity: "error",
          message: `Selected PSD byte length ${input.file.size} exceeds size cap ${sizeCapBytes}.`,
          source
        })
      ]
    };
  }

  const bytes = await input.file.arrayBuffer();

  return parseExplicitBrowserPsdBytes({
    intakeKind: "explicitFile",
    fileName: input.file.name,
    bytes,
    declaredMediaType: input.file.type,
    ...(input.sourceAssetId === undefined ? {} : { sourceAssetId: input.sourceAssetId }),
    sizeCapBytes,
    ...(input.selectedLayerNodeRef === undefined ? {} : { selectedLayerNodeRef: input.selectedLayerNodeRef })
  });
};

export const parseExplicitBrowserPsdArrayBuffer = async (
  input: ExplicitBrowserPsdArrayBufferInput
): Promise<BrowserPsdParserBridgeResult> =>
  parseExplicitBrowserPsdBytes({
    intakeKind: "explicitArrayBuffer",
    ...input
  });

const parseExplicitBrowserPsdBytes = async (
  input: ExplicitBrowserPsdArrayBufferInput & {
    readonly intakeKind: "explicitFile" | "explicitArrayBuffer";
  }
): Promise<BrowserPsdParserBridgeResult> => {
  const bytes = normalizeExplicitBrowserPsdBytes(input.bytes);
  const sizeCapBytes = input.sizeCapBytes ?? browserPsdParserBridgeDefaultSizeCapBytes;
  const source = createBrowserPsdSourceEvidence({
    intakeKind: input.intakeKind,
    sourceAssetId: input.sourceAssetId ?? browserPsdParserBridgeDefaultSourceAssetId,
    fileName: input.fileName,
    ...(input.declaredMediaType === undefined ? {} : { declaredMediaType: input.declaredMediaType }),
    byteLength: bytes.byteLength,
    sizeCapBytes
  });
  const threading = createBrowserPsdThreadingEvidence();

  if (bytes.byteLength > sizeCapBytes) {
    const diagnostics = [
      {
        checkId: "browserPsdParser.sizeCapExceeded",
        severity: "error" as const,
        message: `Selected PSD byte length ${bytes.byteLength} exceeds the browser parser bridge cap ${sizeCapBytes}.`,
        source: { kind: "adapter" as const, path: "/browser-psd-parser-bridge/size-cap" },
        evidence: ["browser-psd-parser-bridge:size-cap"]
      }
    ];

    return {
      status: "rejected",
      source,
      threading,
      diagnostics,
      errorEvidence: [
        createBrowserPsdParserErrorEvidence({
          errorId: "browserPsdParser.sizeCapExceeded",
          failureKind: "sizeLimitExceeded",
          severity: "error",
          message: `Selected PSD byte length ${bytes.byteLength} exceeds size cap ${sizeCapBytes}.`,
          source
        })
      ]
    };
  }

  return parseBrowserPsdBytesWithAdapter({
    source,
    threading,
    bytes,
    ...(input.selectedLayerNodeRef === undefined ? {} : { selectedLayerNodeRef: input.selectedLayerNodeRef })
  });
};

const normalizeExplicitBrowserPsdBytes = (bytes: ArrayBuffer | Uint8Array): Uint8Array =>
  bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
