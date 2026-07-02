import { createOperationCore } from "@private-2d-rigging-lab/operation-core";
import type {
  OperationCore,
  OperationLogEntryDto,
  OperationRequestDto,
  OperationResultDto
} from "@private-2d-rigging-lab/operation-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { AiOperationCommandHost } from "@private-2d-rigging-lab/ai-interface";

export interface AuthoringHostCommandHostOptions {
  readonly session: AuthoringSession;
  readonly now: () => Date;
  readonly initialOperationLogEntries?: readonly OperationLogEntryDto[];
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
 */
export class AuthoringHostCommandHost implements AiOperationCommandHost {
  readonly #session: AuthoringSession;
  readonly #operationCore: OperationCore;

  constructor(options: AuthoringHostCommandHostOptions) {
    this.#session = options.session;
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
}
