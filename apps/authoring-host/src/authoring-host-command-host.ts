import { createOperationCore } from "@private-2d-rigging-lab/operation-core";
import type {
  OperationCore,
  OperationRequestDto,
  OperationResultDto
} from "@private-2d-rigging-lab/operation-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  AiOperationCommandHost,
  AiReadCommandHost,
  InspectEvaluatedGeometryPayload,
  InspectEvaluatedGeometryResult,
  ValidatePackagePayload,
  ValidatePackageResult
} from "@private-2d-rigging-lab/ai-interface";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";

import { isMaterialImageOperationRequest, prepareMaterialImageOperationSession } from "./material-image-operation-intake.js";
import { measureEvaluatedGeometry } from "./perception/measurement-command.js";
import { validatePackageDocument } from "./validate-package-document.js";

export interface AuthoringHostCommandHostOptions {
  readonly session: AuthoringSession;
  /**
   * The package document obtained at load time. In the one-shot CLI a validate request
   * does not dry-run or commit, so the loaded document is identical to the current
   * session graph and is what `validatePackage` validates.
   */
  readonly packageDocument: PackageDocumentDto;
  /** The package directory on disk. Image operations refuse to overwrite a file already at their texture path. */
  readonly packageDirectory?: string;
}

/**
 * Concrete {@link AiOperationCommandHost} for the headless CLI. It owns a single
 * AuthoringSession loaded from disk and routes dry-run / commit through Operation
 * Core.
 *
 * Session handling matches the operation-core contract: `dryRunOperation` evaluates
 * against a cloned candidate session (operation-core's dry-run handlers clone the
 * session internally) and never advances the on-disk session, while
 * `commitOperation` advances the session revision.
 *
 * addDrawableFromImage / replaceDrawableImage first read, check and register the PNG named by the payload
 * (prepareMaterialImageOperationSession) on both dry-run and commit. The bytes live in a separate session that
 * replaces the host session only when the commit succeeds, so a dry-run, rejection or failure leaves no bytes behind.
 *
 * It also implements the read-side {@link AiReadCommandHost} contract for the read
 * commands the headless host supports today: `validatePackage` and
 * `inspectEvaluatedGeometry` (the measurement command — evaluated bounding boxes /
 * vertices / warp lattice control points, §3.3). Every other read command is
 * intentionally left unimplemented so the shared read mechanism resolves it to
 * `not_implemented`.
 */
export class AuthoringHostCommandHost implements AiOperationCommandHost, AiReadCommandHost {
  #session: AuthoringSession;
  readonly #operationCore: OperationCore;
  readonly #packageDocument: PackageDocumentDto;
  readonly #packageDirectory: string | undefined;

  constructor(options: AuthoringHostCommandHostOptions) {
    this.#session = options.session;
    this.#packageDocument = options.packageDocument;
    this.#packageDirectory = options.packageDirectory;
    this.#operationCore = createOperationCore();
  }

  get session(): AuthoringSession {
    return this.#session;
  }

  async dryRunOperation(request: OperationRequestDto): Promise<OperationResultDto> {
    if (!isMaterialImageOperationRequest(request)) return this.#operationCore.dryRunOperation(this.#session, request);
    const prepared = await prepareMaterialImageOperationSession(this.#session, request, this.#packageDirectory);
    if (prepared.status === "rejected") return prepared.result;
    return this.#operationCore.dryRunOperation(prepared.session, request);
  }

  async commitOperation(request: OperationRequestDto): Promise<OperationResultDto> {
    if (!isMaterialImageOperationRequest(request)) return this.#operationCore.commitOperation(this.#session, request).result;
    const prepared = await prepareMaterialImageOperationSession(this.#session, request, this.#packageDirectory);
    if (prepared.status === "rejected") return prepared.result;
    const outcome = this.#operationCore.commitOperation(prepared.session, request);
    if (outcome.result.status === "committed") this.#session = prepared.session;
    return outcome.result;
  }

  inspectEvaluatedGeometry(
    payload: InspectEvaluatedGeometryPayload
  ): InspectEvaluatedGeometryResult {
    return measureEvaluatedGeometry({ session: this.#session, payload });
  }

  validatePackage(payload: ValidatePackagePayload): ValidatePackageResult {
    const report = validatePackageDocument({
      packageDocument: this.#packageDocument,
      profile: payload.profile,
      ...(payload.packageRevision === undefined ? {} : { packageRevision: payload.packageRevision })
    });

    return { reportId: report.reportId, report };
  }
}
