import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type { ControlFeedbackTone } from "./control-window-components";

export type BrowserSourceCopyUrlFeedback = {
  readonly message: string;
  readonly tone: ControlFeedbackTone;
};

export async function copyBrowserSourceUrlFromStatus(input: {
  readonly status: RuntimePlayerBrowserSourceStatus | null;
  readonly writeText: (text: string) => Promise<void>;
}): Promise<BrowserSourceCopyUrlFeedback> {
  const url = input.status?.browserSourceUrl;

  if (url === null || url === undefined || url.length === 0) {
    return {
      message: "Browser Source URL is not available yet.",
      tone: "error"
    };
  }

  await input.writeText(url);

  return {
    message: "Browser Source URL copied.",
    tone: "success"
  };
}
