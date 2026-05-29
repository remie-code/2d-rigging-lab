import type { OperationRequestDto, OperationResultDto } from "@private-2d-rigging-lab/operation-core";

export interface AiOperationCommandHost {
  dryRunOperation(request: OperationRequestDto): OperationResultDto | Promise<OperationResultDto>;
  commitOperation(request: OperationRequestDto): OperationResultDto | Promise<OperationResultDto>;
}
