import type { AiCommandResponse } from "@private-2d-rigging-lab/ai-interface";

/**
 * Terminal outcome class for a single CLI command, used to pick a process exit code:
 *   - "success": the command was accepted (dry-run ok, or committed).
 *   - "rejected": the command was mechanically refused (rejected / needs_approval /
 *     permission_denied / not_implemented). The package was not mutated on disk.
 *   - "error": an exception or IO failure occurred before a normal response.
 */
export type AuthoringHostOutcome = "success" | "rejected" | "error";

export interface AuthoringHostAutoApprovalReport {
  readonly evaluated: boolean;
  readonly autoApproved: boolean;
  readonly reason?: string;
}

export interface AuthoringHostCommandResponse {
  readonly schemaVersion: "authoring-host-command-response-v1";
  readonly outcome: AuthoringHostOutcome;
  readonly command: string;
  readonly commandId?: string;
  readonly aiCommandStatus?: AiCommandResponse["status"];
  readonly aiCommandResponse?: AiCommandResponse;
  readonly autoApproval?: AuthoringHostAutoApprovalReport;
  readonly saved: boolean;
  readonly packageRevision?: number;
  readonly diagnostics?: AiCommandResponse["diagnostics"];
  readonly error?: {
    readonly name: string;
    readonly message: string;
  };
}

export const mapOutcomeToExitCode = (outcome: AuthoringHostOutcome): number => {
  switch (outcome) {
    case "success":
      return 0;
    case "rejected":
      return 2;
    case "error":
      return 1;
  }
};

export const aiStatusToOutcome = (status: AiCommandResponse["status"]): AuthoringHostOutcome => {
  switch (status) {
    case "ok":
      return "success";
    case "rejected":
    case "needs_approval":
    case "permission_denied":
    case "not_implemented":
      return "rejected";
    case "failed":
      return "error";
  }
};
