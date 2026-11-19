/** Cockpit command-line entry point. Production wiring lives in src/cockpit/startup. */
import { pathToFileURL } from "node:url";
import { DEFAULT_COCKPIT_PORT } from "../src/cockpit/cockpit-server.mjs";
import { isRemoteVenueId } from "../src/cockpit/remote-discord-venue.mjs";
import { FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "../src/mind/fire-injection.mjs";
import { runCockpit } from "../src/cockpit/startup/run-cockpit.mjs";

// Keep the script imports used by operators and existing tests compatible.
export {
  buildRoleSessionSystemPrompt,
  createInstructionRevisionController,
  venueSoulWords,
  listVenueSoulSkills,
  createConversationInstructionHooks
} from "../src/mind/conversation-instructions.mjs";
export { createSessionProxy } from "../src/mind/conversation-session-proxy.mjs";
export { createLazyChannel, CHANNEL_URL_NOT_SET_MESSAGE, resolveFireChannel } from "../src/channel/cockpit-channel.mjs";
export { createVisionTargetHooks, createVenueVisionTarget } from "../src/eyes/cockpit-vision-target.mjs";
export {
  createSelfFireHooks,
  createBargeInHooks,
  createVerbosityHooks,
  createSpeakStartHooks,
  createCommentBusyHooks
} from "../src/cockpit/cockpit-conversation-settings.mjs";
export { createAudioDeviceHooks, createSttEngineHooks, createTtsEngineHooks } from "../src/cockpit/cockpit-device-settings.mjs";
export { createChatSourceHooks } from "../src/chat/cockpit-chat-source.mjs";
export {
  MEMORY_CHECKPOINT_INTERVAL_MS,
  MEMORY_CHECKPOINT_TICK_MS,
  shouldSkipMemoryCheckpoint,
  countSpokenEntries,
  isMemoryCheckpointDue,
  resolveWriterBrainDef,
  createMemoryRecorder
} from "../src/mind/venue-memory-recorder.mjs";
export { createRoleMemoryPlaces } from "../src/memory/role-memory-places.mjs";
export {
  MEMORY_BACKUP_ROOT,
  ORGANISER_WRITER_BUSY_WARNING,
  ORGANISER_START_FAILED_WARNING,
  createMemoryOrganiserRunner
} from "../src/mind/venue-memory-organiser.mjs";
export { createDiscordVenueExperience } from "../src/discord/cockpit-discord-experience.mjs";
export { HELD_VENUE_PLAYER_MESSAGE, HELD_VENUE_PLAYER, createVenuePlayerSlot } from "../src/discord/venue-player-slot.mjs";
export { createRoleHooks, createRoleEditHooks, resolveRoleVoice, applyRoleHotwords } from "../src/roles/cockpit-roles.mjs";
export { voiceDiagnosticReason, createVoiceEngineManager } from "../src/voice/cockpit-voice-engines.mjs";
export { isCodexBrainId } from "../src/mind/brains.mjs";
export { resolveCodexServiceTier, createCodexFastHooks } from "../src/mind/codex-conversation-settings.mjs";
export { resolveContextCompactionOptions, createContextCompactionHooks } from "../src/mind/conversation-compaction-settings.mjs";

export { openCockpitBrowser } from "../src/cockpit/startup/open-browser.mjs";
export { startupMigrationWarnings } from "../src/cockpit/startup/startup-warnings.mjs";
export {
  BODY_CONNECT_FAILED_MESSAGE,
  BODY_URL_NOT_SET_MESSAGE,
  createStreamVenueHooks,
  createVenueRoleBundle
} from "../src/cockpit/venue/role-hooks.mjs";
export {
  isMcpConfigReadFailureWarning,
  formatRecallEventLine,
  formatSttLatencyLine,
  formatCaptureEventLine,
  formatCommentJudgmentLine,
  formatSpeakNowLine,
  createCodexQuotaReader,
  resolveLatencyThresholdsFromSettings,
  contextCompactionUsageRecord,
  formatContextCompactionLine,
  formatReplyLatencyLine
} from "../src/cockpit/startup/cockpit-diagnostics.mjs";
export { createCockpitShutdown } from "../src/cockpit/startup/shutdown.mjs";

/** @param {string[]} argv */
export function parseCockpitArgs(argv) {
  const args = {
    port: /** @type {number | undefined} */ (undefined),
    help: false,
    open: false,
    /** @type {string | undefined} */ channel: undefined,
    /** @type {string | undefined} */ ttsBaseUrl: undefined,
    /** @type {string | undefined} */ speaker: undefined,
    /** @type {number | undefined} */ fireWindowMin: undefined,
    /** @type {number | undefined} */ fireMaxChars: undefined
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--open") args.open = true;
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--channel") args.channel = argv[++i];
    else if (a === "--tts-base-url") args.ttsBaseUrl = argv[++i];
    else if (a === "--speaker") args.speaker = argv[++i];
    else if (a === "--fire-window-min") args.fireWindowMin = Number(argv[++i]);
    else if (a === "--fire-max-chars") args.fireMaxChars = Number(argv[++i]);
  }
  return args;
}

const HELP = `usage: node scripts/cockpit.mjs [--port N] [--channel <ws-url>] [options]
  --port N              listen port（既定 ${DEFAULT_COCKPIT_PORT}・127.0.0.1 限定）
  --open                待受け完了後に既定ブラウザを開く（Windows）
  --channel <ws-url>    器（runtime-player）の Control Channel URL（ws://127.0.0.1:<port>/channel?token=..）の
                        **初期値**（後方互換）。ふだんは操縦席の「準備・設定」→「配信の準備」の器（Channel）の欄に
                        入れる（ロールに体があるときだけ出る・URL は次回起動まで記憶される）。指定しても起動時には
                        何もつながない（頭のセッションと器の接続は「配信を始める」で作る）。体のないロールでは使わない。
  --tts-base-url <url>  AivisSpeech の base URL（既定 http://127.0.0.1:10101）
  --speaker <id>        AivisSpeech の話者 ID（ロールの話者を上書きする・無ければロールの値）
  --fire-window-min <m> 注入窓の幅（分・既定 ${FIRE_WINDOW_MS / 60000}）
  --fire-max-chars <n>  注入テキストの文字数上限（既定 ${FIRE_MAX_CHARS}）
  起動後、表示された http://127.0.0.1:<port>/ をブラウザで開き「配信を始める」を押す。Ctrl+C / EOF で終了
  （配信中なら「配信を終える」と同じ道で記録してから畳む）。
`;

async function main() {
  const remoteVenueId = process.env.SOUL_REMOTE_VENUE_ID;
  if (remoteVenueId && !isRemoteVenueId(remoteVenueId)) throw new Error("invalid Discord venue id");
  const args = parseCockpitArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
    return;
  }

  await runCockpit(args, remoteVenueId);
}

const invokedDirectly = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `[cockpit] FATAL: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exit(1);
  });
}
