import { createOperationCore } from "@private-2d-rigging-lab/operation-core";
import type {
  OperationCore,
  OperationLogEntryDto,
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

import { measureEvaluatedGeometry } from "./perception/measurement-command.js";
import { validatePackageDocument } from "./validate-package-document.js";

export interface AuthoringHostCommandHostOptions {
  readonly session: AuthoringSession;
  readonly now: () => Date;
  readonly initialOperationLogEntries?: readonly OperationLogEntryDto[];
  /**
   * The package document obtained at load time. In the one-shot CLI a validate request
   * does not dry-run or commit, so the loaded document is identical to the current
   * session graph and is what `validatePackage` validates.
   */
  readonly packageDocument: PackageDocumentDto;
}

/**
 * Concrete {@link AiOperationCommandHost} for the headless CLI. It owns a single
 * AuthoringSession loaded from disk and routes dry-run / commit through Operation
 * Core.
 *
 * Session handling matches the operation-core contract: `dryRunOperation` evaluates
 * against a cloned candidate session (operation-core's dry-run handlers clone the
 * session internally) and never advances the on-disk session, while
 * `commitOperation` advances the session revision and appends an operation-log entry.
 *
 * It also implements the read-side {@link AiReadCommandHost} contract for the read
 * commands the headless host supports today: `validatePackage` and
 * `inspectEvaluatedGeometry` (the measurement command — evaluated bounding boxes /
 * vertices / warp lattice control points, §3.3). Every other read command is
 * intentionally left unimplemented so the shared read mechanism resolves it to
 * `not_implemented`.
 */
export class AuthoringHostCommandHost implements AiOperationCommandHost, AiReadCommandHost {
  readonly #session: AuthoringSession;
  readonly #operationCore: OperationCore;
  readonly #packageDocument: PackageDocumentDto;

  constructor(options: AuthoringHostCommandHostOptions) {
    this.#session = options.session;
    this.#packageDocument = options.packageDocument;
    this.#operationCore = createOperationCore({
      now: options.now,
      ...(options.initialOperationLogEntries === undefined
        ? {}
        : { initialOperationLogEntries: options.initialOperationLogEntries })
    });
  }

  get session(): AuthoringSession {
    return this.#session;
  }

  get operationLogEntries(): readonly OperationLogEntryDto[] {
    return this.#operationCore.operationLog.entries;
  }

  dryRunOperation(request: OperationRequestDto): OperationResultDto {
    return this.#operationCore.dryRunOperation(this.#session, request);
  }

  commitOperation(request: OperationRequestDto): OperationResultDto {
    return this.#operationCore.commitOperation(this.#session, request).result;
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
