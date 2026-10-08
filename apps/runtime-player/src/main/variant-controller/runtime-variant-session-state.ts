import type {
  RuntimeExportLoadedPayload
} from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerVariantControllerStatus,
  RuntimePlayerVariantSingleSelectRequest,
  RuntimePlayerVariantMultiToggleRequest
} from "../../preload/runtime-variant-bridge-contract";
import {
  createRuntimeVariantControllerStatus,
  resetVariantSelectionToDefault,
  selectSingleVariant,
  toggleMultiVariant
} from "../../shared/runtime-export-variant-selection";

export class RuntimePlayerVariantSessionState {
  #payload: RuntimeExportLoadedPayload | null = null;
  #status: RuntimePlayerVariantControllerStatus =
    createRuntimeVariantControllerStatus({
      model: null,
      nowIso: new Date().toISOString()
    });

  getStatus(): RuntimePlayerVariantControllerStatus {
    return this.#status;
  }

  setRuntimeExportPayload(
    payload: RuntimeExportLoadedPayload,
    nowIso = new Date().toISOString()
  ): RuntimePlayerVariantControllerStatus {
    this.#payload = payload;
    this.#status = createRuntimeVariantControllerStatus({
      model: payload.artifacts.model,
      nowIso
    });
    return this.#status;
  }

  clearRuntimeExport(
    nowIso = new Date().toISOString()
  ): RuntimePlayerVariantControllerStatus {
    this.#payload = null;
    this.#status = createRuntimeVariantControllerStatus({
      model: null,
      nowIso
    });
    return this.#status;
  }

  selectSingle(
    request: RuntimePlayerVariantSingleSelectRequest,
    nowIso = new Date().toISOString()
  ): RuntimePlayerVariantControllerStatus {
    this.#status = selectSingleVariant({
      status: this.#status,
      variantGroupId: request.variantGroupId,
      variantId: request.variantId,
      nowIso
    });
    return this.#status;
  }

  toggleMulti(
    request: RuntimePlayerVariantMultiToggleRequest,
    nowIso = new Date().toISOString()
  ): RuntimePlayerVariantControllerStatus {
    this.#status = toggleMultiVariant({
      status: this.#status,
      variantGroupId: request.variantGroupId,
      variantId: request.variantId,
      ...(request.active === undefined ? {} : { active: request.active }),
      nowIso
    });
    return this.#status;
  }

  resetToDefault(
    nowIso = new Date().toISOString()
  ): RuntimePlayerVariantControllerStatus {
    this.#status = resetVariantSelectionToDefault({
      status: this.#status,
      nowIso
    });
    return this.#status;
  }

  rebuildFromCurrentPayload(
    nowIso = new Date().toISOString()
  ): RuntimePlayerVariantControllerStatus {
    this.#status = createRuntimeVariantControllerStatus({
      model: this.#payload?.artifacts.model ?? null,
      activeSelections: this.#status.activeVariantSelection.activeSelections,
      nowIso
    });
    return this.#status;
  }
}
