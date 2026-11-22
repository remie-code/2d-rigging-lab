/** Production composition for the Cockpit CLI. */
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { acquireDiscordGuildLease } from "../../discord/discord-guild-lease.mjs";
import { remoteVenueLedgerPath, reserveRemoteVenuePort, writeRemoteVenueReceipt } from "../remote-discord-venue.mjs";
import { createCockpitServer, DEFAULT_COCKPIT_PORT } from "../cockpit-server.mjs";
import { createFileSettingsStore, DEFAULT_SETTINGS_PATH } from "../cockpit-settings-store.mjs";
import { cockpitHtmlPath } from "../cockpit-page.mjs";
import { assertSubscriptionAuthEnv } from "../../mind/env-guard.mjs";
import { BRAINS, isCodexBrainId } from "../../mind/brains.mjs";
import { createFireOrchestrator } from "../../mind/fire-orchestrator.mjs";
import {
  DEFAULT_ROLES_DIR,
  createRoleInstructionStore,
  roleIdentity,
  roleDiscordBotKeyFile,
  roleDiscordBotKeyFileRefused
} from "../../roles/role-store.mjs";
import {
  DEFAULT_MIGRATION_BACKUP_ROOT,
  formatStartupMigrationReport,
  migrationBackupDir,
  runStartupMigration
} from "../../roles/role-migration.mjs";
import { createFireDiagnostics } from "../../mind/fire-diagnostics.mjs";
import { createContextCompactor } from "../../mind/context-compactor.mjs";
import {
  createSessionUsageLog,
  fireUsageRecord,
  replyLatencyUsageRecord,
  judgmentUsageRecord,
  fireRefusedUsageRecord,
  controlUsageRecord
} from "../../mind/session-usage-log.mjs";
import { createQuotaMonitor, fetchElevenLabsSubscription } from "../quota.mjs";
import { createResidentCapture } from "../../eyes/resident-capture.mjs";
import { resolveStreamGameOcrInterval } from "../../eyes/game-dialogue-ocr-scheduler.mjs";
import { FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "../../mind/fire-injection.mjs";
import { redactToken } from "../../channel/channel-client.mjs";
import { createStreamPlayer } from "../../voice/stream-player.mjs";
import { createTtsClient } from "../../voice/tts-client.mjs";
import { createLiveChatClient } from "../../chat/live-chat-client.mjs";
import { writeStreamRecord } from "../../mind/memory.mjs";
import { DEFAULT_MEMORY_DIR } from "../../memory/memory-store.mjs";
import { sweepCodexRollouts } from "../../mind/codex-session.mjs";
import { runRecall } from "../../mind/recall.mjs";
import { runLocalTask } from "../../mind/local-task.mjs";
import { listSoulSkills, loadSoulSkills, soulSkillNamesForBody } from "../../mind/soul-skills.mjs";
import {
  buildRoleSessionSystemPrompt,
  createInstructionRevisionController,
  venueSoulWords,
  listVenueSoulSkills,
  createConversationInstructionHooks
} from "../../mind/conversation-instructions.mjs";
import { createSessionProxy } from "../../mind/conversation-session-proxy.mjs";
import { createLazyChannel, resolveFireChannel } from "../../channel/cockpit-channel.mjs";
import { createVisionTargetHooks, createVenueVisionTarget } from "../../eyes/cockpit-vision-target.mjs";
import {
  createSelfFireHooks,
  createBargeInHooks,
  createVerbosityHooks,
  createSpeakStartHooks,
  createCommentBusyHooks
} from "../cockpit-conversation-settings.mjs";
import { createAudioDeviceHooks, createSttEngineHooks, createTtsEngineHooks } from "../cockpit-device-settings.mjs";
import { createChatSourceHooks } from "../../chat/cockpit-chat-source.mjs";
import { MEMORY_CHECKPOINT_TICK_MS, resolveWriterBrainDef, createMemoryRecorder } from "../../mind/venue-memory-recorder.mjs";
import { createRoleMemoryPlaces } from "../../memory/role-memory-places.mjs";
import { MEMORY_BACKUP_ROOT, createMemoryOrganiserRunner } from "../../mind/venue-memory-organiser.mjs";
import { createDiscordVenueExperience } from "../../discord/cockpit-discord-experience.mjs";
import { createVenuePlayerSlot } from "../../discord/venue-player-slot.mjs";
import {
  createRoleHooks,
  createRoleEditHooks,
  resolveRoleVoice,
  applyRoleHotwords
} from "../../roles/cockpit-roles.mjs";
import { createVoiceEngineManager } from "../../voice/cockpit-voice-engines.mjs";
import { createCodexFastHooks } from "../../mind/codex-conversation-settings.mjs";
import { resolveContextCompactionOptions, createContextCompactionHooks } from "../../mind/conversation-compaction-settings.mjs";
import { openCockpitBrowser } from "./open-browser.mjs";
import { startupMigrationWarnings } from "./startup-warnings.mjs";
import { createStreamVenueHooks, createVenueRoleBundle } from "../venue/role-hooks.mjs";
import {
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
} from "./cockpit-diagnostics.mjs";
import { createCockpitShutdown } from "./shutdown.mjs";

export async function runCockpit(args, remoteVenueId) {
  const reservedServer = remoteVenueId ? await reserveRemoteVenuePort(args.port ?? DEFAULT_COCKPIT_PORT) : undefined;

  // 前回の起動で取り残した Codex の記録ファイル（台帳 codex-rollouts.local.json の分）を、起動時に 1 回だけ消す。
  // 以後のセッション（①・②書き出し役・④思い出し役）を作っても掃除は走らない（応答の遅れの直し・latency-fix-plan.md §2-1）。
  try {
    sweepCodexRollouts(remoteVenueId ? { ledgerPath: remoteVenueLedgerPath } : undefined);
  } catch {
    // 掃除は best effort（起動を止めない）。
  }
  // 配信の組み直し Domain A・B: 起動時の引っ越し（stream-restructure.md §2.4）。設定の分はロールの置き場（roles/）が
  // 無いときだけ設定ファイルから chappy と cody を作る（古いキーは消さない）。記憶の分は memories/ の直下に記録があって
  // memories/chappy/ が無いときだけ、中身を .git ごと memories/chappy/ へ移す（記憶のフォルダの準備より前）。2 つの
  // 条件は混ぜずに独立に判定する。移す前の写しは、この起動の 1 つの写しのフォルダ（tmp/restructure-backups/ の下）に
  // 両方置く。何が起きたかはここでターミナルへ 1 回だけ出し、操縦席のログのタブにも同じ行を出す。
  const migrationBackup = migrationBackupDir(DEFAULT_MIGRATION_BACKUP_ROOT, Date.now());
  const startupMigration = runStartupMigration({
    rolesDir: DEFAULT_ROLES_DIR,
    settingsPath: DEFAULT_SETTINGS_PATH,
    memoriesDir: DEFAULT_MEMORY_DIR,
    backupDir: migrationBackup
  });
  const startupNotices = formatStartupMigrationReport(startupMigration);
  const startupMigrationFailed =
    startupMigration.roles.status === "failed" || startupMigration.memories.status === "failed";
  for (const line of startupNotices) {
    if (startupMigrationFailed) process.stderr.write(`[cockpit] WARN: ${line}\n`);
    else process.stdout.write(`[cockpit] ${line}\n`);
  }

  // ── S3 追撃 domain-c: fire は常時結線・session/player は遅延生成・Channel URL は後入力可 ──────
  const settings = createFileSettingsStore();
  // 配信の組み直し Domain A: ロールの選択（頭の選択の置き換え・§createRoleHooks）。名前・性格の指示・動かすモデル・
  // 声・口数・話し始め・hotwords は今のロールから引く。
  const roleHooks = createRoleHooks({ rolesDir: DEFAULT_ROLES_DIR, settings });
  /** @type {ReturnType<typeof createCockpitServer> | undefined} */
  let server;
  const effectiveRole = () => server?.discordVenueRole() ?? roleHooks.current();
  const effectiveRoleId = () => effectiveRole().id;
  const effectiveBrain = () => effectiveRole().brain;
  // S5「目が開く」: 視覚発火の対象ウインドウ設定（Channel URL と同型の薄い橋渡し・§createVisionTargetHooks）。
  const visionTargetHooks = createVisionTargetHooks(settings);
  // Discord モード Domain G: 発火が撮る見る窓は開いている場の体験で選ぶ（Discord の場は Discord の準備の見る窓）。
  const venueVisionTarget = createVenueVisionTarget({
    stream: visionTargetHooks.getVisionTarget,
    discord: () => server ? server.discordVisionTitle() : settings.getDiscordVisionTarget(),
    experience: () => server?.venueContext()?.experience ?? null
  });
  // S6「会話が続く」: 魂の声の出力デバイス設定（vision target と同型の薄い橋渡し・§createAudioDeviceHooks）。
  const audioDeviceHooks = createAudioDeviceHooks(settings);
  // S6「会話が続く」: 自発発火 ON/OFF の永続トグル（既定 OFF・§createSelfFireHooks）。
  const selfFireHooks = createSelfFireHooks(settings, false);
  // 「朗読と合いの手」: barge-in ON/OFF の永続トグル（既定 ON・裁定 1・§createBargeInHooks）。
  const bargeInHooks = createBargeInHooks(settings, true);
  // 口数モード（quiet/normal/chatty・既定 "normal"・§createVerbosityHooks）。配信の組み直し Domain A から値の
  // 出どころは今のロール（role.json の verbosity）。
  const verbosityHooks = createVerbosityHooks(roleHooks.roleSettings);
  // S7「視聴者が混ざる」: 視聴者チャット配信 source の永続化（Channel URL と同型の薄い橋渡し・
  // §createChatSourceHooks）。実チャット器官の Connect/停止は cockpit-server 所有（POST 駆動）。
  const chatSourceHooks = createChatSourceHooks(settings);
  // 操縦席の文字起こし選択（whisper / ElevenLabs・既定 whisper・§createSttEngineHooks）。
  const sttEngineHooks = createSttEngineHooks(settings);
  // 声の方式（AivisSpeech / ElevenLabs・既定 aivis・§createTtsEngineHooks）。出どころは今のロール（voice.engine）。
  const ttsEngineHooks = createTtsEngineHooks(roleHooks.roleSettings);
  // 話し始めの方式（従来 / speak-now・初回既定 speak-now・§createSpeakStartHooks）。出どころは今のロール
  // （speakStartMode）。相槌どうしの最小間隔は技術のつまみなので設定ファイルのまま。
  const speakStartHooks = createSpeakStartHooks({
    ...roleHooks.roleSettings,
    getBackchannelMinIntervalSec: () => settings.getBackchannelMinIntervalSec()
  });
  // 忙しい間のコメントの扱い（あとで拾う / 見逃す・既定 あとで拾う・§createCommentBusyHooks）。
  const commentBusyHooks = createCommentBusyHooks(settings);
  const commentHold = commentBusyHooks.resolveCommentHold();
  // ①チャッピーの Codex の頭の fast（service tier "priority"・既定 OFF・§createCodexFastHooks）。次の受理の
  // configuration に段を載せる＝次の返事から効く（セッションは作り直さない・②④は通らない）。
  const codexFastHooks = createCodexFastHooks(settings, false);

  /** @type {ReturnType<typeof import("../../mind/llm-session.mjs").createLlmSession> | null} */
  let session = null;
  // Instruction changes are persisted independently from existing settings.
  // A session captures the revision used to compose its system prompt; the
  // next Fire refreshes only when this effective revision is stale.
  const instructionRevision = createInstructionRevisionController();
  let sessionInstructionRevision = null;
  let sessionContextRevision = 0;
  let sessionAcceptedContextRevision = null;
  // 今のセッションを作ったときのロールの体の有無（①に表情の教えを足したか）。今のロールの体と違えば次の Fire の境目で
  // 作り直す（配信の組み直し Domain C）。
  /** @type {boolean | null} */
  let sessionBody = null;
  /** @type {ReturnType<typeof createStreamPlayer> | null} */
  let player = null;
  // Discord モード Domain E: その場の再生器（§createVenuePlayerSlot）。Discord の場では Bot の接続に結んだ再生器が入り、
  // 手元の再生器（player）の代わりに使う。配信の場では空のまま（今のふるまい）。
  const venuePlayers = createVenuePlayerSlot({
    onTrace: (event) => fireDiagnostics.record("player.discord", { marker: event })
  });
  /** 今の場で声を出す再生器（Discord の場の再生器・無ければ手元の再生器）。 */
  const activePlayer = () => venuePlayers.current() ?? player;
  let audioRevision = 0;
  let playerAudioRevision = null;
  // 声の差し替え口（Start のときに作る・種類が変われば作り直す）。desiredTtsEngine は最後に Start で選ばれた方式
  // （起動直後は記憶の値）で、Start より前の Fire もこの方式で作る。
  let desiredTtsEngine = ttsEngineHooks.resolveInitialTtsEngine();
  // 配信の組み直し Domain A: 声（AivisSpeech の話者・ElevenLabs の声の id）は今のロールから引く。`--speaker` は
  // ロールの話者を上書きする（§resolveRoleVoice）。話者・声の id が替われば engine を作り直す（voiceKey）。
  const roleVoice = () => resolveRoleVoice(effectiveRole(), server?.discordVenueRole() ? {} : args);
  const effectiveTtsEngine = () => server?.discordVenueRole()?.voice.engine ?? desiredTtsEngine;
  const voiceEngines = createVoiceEngineManager({
    aivisDeps: () => ({ ttsBaseUrl: args.ttsBaseUrl, speaker: roleVoice().speaker }),
    // D と E の接点（voice-swap-wave-plan.md §3）: 読みは AivisSpeech の /accent_phrases（tts-client の口）から取る。
    elevenLabsDeps: () => {
      const voice = roleVoice();
      return {
        readingClient: createTtsClient({ baseUrl: args.ttsBaseUrl, speaker: voice.speaker }),
        ttsBaseUrl: args.ttsBaseUrl,
        speaker: voice.speaker,
        ...(voice.voiceId ? { voiceId: voice.voiceId } : {})
      };
    },
    voiceKey: () => JSON.stringify(roleVoice()),
    onStatus: (info) => server?.setVoiceEngineStatus(info),
    onReadingsFallback: () => server?.reportVoiceReadingsFallback()
  });
  // 配信の組み直し Domain C: 今のロールに体があるか（role.json の body）。値は持ち回らず、使う時点でいつも今のロールから
  // 読む（受理のたび・頭に聞くたび・セッションを作るとき）。耳が止まっている間にロールを替えても古い値が残らない。
  const currentBody = () => effectiveRole().body !== false;
  // 会話指示 = 今のロールの性格の指示（roles/<id>/instructions.md・§createRoleInstructionStore）。
  // 編集画面に読むだけで見せる教えは、①に足すものと同じく今のロールの体に合わせる（体なしは expression を出さない）。
  // Discord モード Domain C: 場が開いていてその体験が語の組か教えを持つ（配信でない）ときは、その体験の語で差した本文と体験の
  // 教えを見せる（§venueSoulWords）。場が閉じている・配信なら今の道（配信の語）。
  const conversationInstructionHooks = createConversationInstructionHooks(
    createRoleInstructionStore({ dir: DEFAULT_ROLES_DIR, knownIds: () => roleHooks.knownIds() }),
    effectiveRoleId,
    instructionRevision,
    () => listSoulSkills({ names: soulSkillNamesForBody(currentBody()) }),
    () => {
      const venue = venueSoulWords(server?.venueContext() ?? null);
      return venue ? listVenueSoulSkills({ body: currentBody(), venue }) : null;
    }
  );
  // One runtime authority for the current name. All identity seams (prompt, Whisper, scheduler, and public
  // state) read this closure at the appropriate lifecycle boundary. 配信の組み直し Domain A: 名前は今のロールが
  // 持つ（頭からは引かない）。
  const getCurrentRoleIdentity = () => roleIdentity(effectiveRole());

  // 配信間記憶（記憶の作り直し Wave 2）: 起動時に記憶を①へ載せることはしない（①は思い出したいときに頼む・
  // recall-flow.md §7）。記憶のフォルダを準備し（無ければ作る・git init・`_conventions.md` の種）、
  // 場の保存の持ち回り（場の日付と、この場で②が書いた本体のファイル・createStreamRecordLog）を場の間持ち回る。本体の
  // 名前と置き場所は②が `_conventions.md` に従って決める（魂は決めない・記憶の整理 Domain A）。
  // 配信の組み直し Domain B: 記憶のフォルダは今のロールのフォルダ（memories/<role-id>/・§createRoleMemoryPlaces）。
  // 準備・場の保存の持ち回り・②・③・④はどれも今のロールの置き場を使う。記憶の引っ越しが失敗した起動では、記憶を読み書き
  // しない（前の形の記録が残る根を触らない）。配信の組み直し Domain D: 置き場（場の保存の持ち回り）は場の始まりで作り直し、
  // そのロールの置き場の準備もそこで待つ（§createStreamVenueHooks の renewRecords・起動時とロールの切り替えでは待たない）。
  const memoryStartedAtMs = Date.now();
  const memoryPlaces = createRoleMemoryPlaces({
    root: DEFAULT_MEMORY_DIR,
    currentRole: effectiveRole,
    startedAtMs: memoryStartedAtMs,
    available: startupMigration.memories.status !== "failed",
    onPrepareFailed: ({ roleId, error }) => {
      // 記録できないだけで配信は止めない（保存のたびにコミットが失敗として警告に出る）。
      process.stderr.write(`[cockpit] WARN: memory folder is not ready (${roleId}: ${error})\n`);
    }
  });
  // 頭のセッション（①・②）の警告はターミナルへ 1 行。MCP の名前の読み取り（config/read）の失敗は、ユーザーの
  // MCP が起動しうるので操縦席の上の帯にも alert で出す（ユーザー決定 2026-10-21・続けるのは同じ）。
  const onBrainWarning = (/** @type {string} */ w) => {
    process.stderr.write(`[cockpit] WARN: ${w}\n`);
    if (isMcpConfigReadFailureWarning(w)) server?.reportMcpConfigReadFailed();
  };
  // 最新の記録時刻（snapshot の memory.lastRecordAtMs）と「転写が前回記録から不変ならスキップ」の判定用の件数は、
  // 配信の組み直し Domain D から場ごと（§createStreamVenueHooks が持つ・場の始まりで null / 0 に戻す）。

  // 初期 Channel URL: --channel（後方互換）> settings の lastChannelUrl（前回起動の記憶）> 未設定。
  const initialUrl = args.channel ?? settings.getLastChannelUrl() ?? null;
  let desiredChannelUrl = initialUrl;
  let channelRevision = 0;
  let appliedChannelRevision = 0;
  const fireDiagnostics = createFireDiagnostics();
  // 頭の文脈の記録（session-usage/・本文なし・context-growth-2026-10.md §6）。発火ごとの 1 行（Codex の頭のとき）と、
  // 圧縮の開始・終了を 1 行ずつ。配信の組み直し Domain D: 場 1 つに 1 ファイル（場の始まりで作り直す・
  // §createStreamVenueHooks の renewRecords）。起動から最初の場までの分は起動の時刻のファイル（書くものが無ければ作られない）。
  let sessionUsageLog = createSessionUsageLog();
  /**
   * Discord モード Domain H（discord-mode.md §13.7）: 判定・発火の断り・つまみの行を今の場の記録へ 1 行（本文・名前・id
   * なし・頭の種類に関係なく書く）。作れなかった行（null = 許す一覧に無い control）は書かない。記録の失敗で判定・発火を
   * 止めない（append も throw しない）。Domain I〜K は VC の出来事をサーバの reportControl（onControl）から渡すか、
   * cockpit.mjs 側ならこの口を `recordSessionUsage(controlUsageRecord({ control: "vc-join" }))` の形で呼ぶ。
   * @param {Record<string, unknown> | null} record
   */
  const recordSessionUsage = (record) => {
    if (record == null) return;
    try {
      sessionUsageLog.append(record);
    } catch {
      // 記録の失敗で判定・発火を止めない。
    }
  };
  // 隙間で手動の圧縮（Codex の頭のみ・context-growth-2026-10.md §6・§8）。目安は settings ファイルのキー
  // （無ければ 20 万トークン / 3 秒 / 10 分）。圧縮を始める大きさは操縦席の設定（頭脳・会話のタブ）からも変えられ、
  // contextCompactionHooks が保存と走っている compactor の差し替えを担う（次の確認から効く）。隙間の材料は
  // cockpit-server、頭のセッションは今の session（Codex で、設定の変更で作り直し待ちになっていないときだけ）。見え方はターミナル 1 行・ログのタブ 1 行・記録 1 行と、
  // 最中の間の上の帯の状態のピル「圧縮中」（broadcastContextCompaction が snapshot の compacting を切り替える）。
  const contextCompactor = createContextCompactor({
    ...resolveContextCompactionOptions(settings),
    getSession: () => {
      if (!isCodexBrainId(effectiveBrain()) || session == null) return null;
      const stale =
        sessionInstructionRevision !== instructionRevision.getRevision() ||
        sessionAcceptedContextRevision !== sessionContextRevision;
      return stale ? null : /** @type {any} */ (session);
    },
    getQuietGap: () => (server ? server.getQuietGap() : null),
    onEvent: (event) => {
      process.stdout.write(formatContextCompactionLine(event));
      sessionUsageLog.append(contextCompactionUsageRecord(event, effectiveBrain()));
      server?.broadcastContextCompaction(
        event.type === "started"
          ? { phase: "started", inputTokens: event.lastInputTokens, thresholdTokens: event.thresholdTokens, ratio: event.ratio }
          : {
              phase: event.ok ? "finished" : "failed",
              durationMs: event.durationMs,
              reason: event.reason,
              personaInjected: event.personaInjected
            }
      );
    }
  });
  const contextCompactionHooks = createContextCompactionHooks(settings, contextCompactor);
  // 残量ゲージの材料（Codex は頭が Codex のときに App Server から・ElevenLabs は 10 分おき・cockpit-glance-redesign.md §9.2）。
  // 監視は listen の後に始め、終了時に止める。キーやアカウント情報は状態にもログにも載せない。
  const quotaMonitor = createQuotaMonitor({
    readCodex: createCodexQuotaReader({ getBrain: effectiveBrain, getSession: () => session }),
    readElevenLabs: () => fetchElevenLabsSubscription()
  });
  // 画面キャプチャの撮る係（常駐 PowerShell）。場を開くとき（場の共通の段・耳の後）に立ち上げ、場を閉じるとき・操縦席の終了で止める
  // （discussion/ai-cohost/research/vision-capture-latency-2026-10.md §4）。使えない間の撮影は今の
  // captureWindow（毎回起動）に戻る。記録は標準出力へ 1 行（数字と種類だけ）。
  const residentCapture = createResidentCapture({
    onEvent: (event) => process.stdout.write(formatCaptureEventLine(event))
  });
  const lazyChannel = createLazyChannel(initialUrl, {
    onTrace: (event, fields) => fireDiagnostics.record(event, fields)
  });
  if (args.channel) {
    // --channel 明示指定は初期値として settings にも載せる（次回起動で復元）。
    settings.setLastChannelUrl(args.channel);
  }

  const windowMs = args.fireWindowMin != null && Number.isFinite(args.fireWindowMin)
    ? args.fireWindowMin * 60_000
    : undefined;
  const maxChars = args.fireMaxChars != null && Number.isFinite(args.fireMaxChars)
    ? args.fireMaxChars
    : undefined;

  /**
   * session/player を遅延生成する（S2.5 無退行の要）。呼ばれるまで LLM の spawn（≈12s）は走らない。
   * 冪等（既に生成済みなら何もしない）。env ガードは session 初回生成時に一度だけ通す。
   *
   * S6「会話が続く」: player は起動時（またはデバイス変更後の再生成時）に settings の出力デバイス名を
   * env 経由で渡す（`createStreamPlayer({ deviceName })`）。未記憶なら deviceName 未指定 = 既定デバイス。
   * 声の差し替え Wave 2: player と声の差し替え口は ensureVoiceResources()（場を開くときに先に作る・ロールの束の voice.startResources）。
   */
  const ensureFireResources = () => {
    ensureSession();
    ensureVoiceResources();
  };

  /**
   * 頭のセッションを遅延生成する（冪等・既に生成済みなら何もしない）。配信の組み直し Domain D から、ふだんは「配信を始める」
   * で作る（§openStreamSession）。場の途中で会話指示・体が替わったときは、次の Fire の境目で作り直す（applyDesiredFireSettings）。
   */
  const ensureSession = () => {
    if (session == null) {
      // 多頭化 Domain B: 頭の生成は registry 経由（brains.mjs の BRAINS）。未知値は防御的に Claude へ。
      const sessionBrain = effectiveBrain();
      const brainDef = BRAINS[sessionBrain] ?? BRAINS.claude;
      // Resolve once for this newly-created session. A later role selection
      // disposes this session; the next Fire resolves the new identity again.
      const sessionIdentity = getCurrentRoleIdentity();
      // このセッションの頭（fast の対応の有無をどの頭のものとして覚えるか）。
      // このセッションのロールの体の有無（体なしは表情の教えを①に足さない・配信の組み直し Domain C）。
      const sessionHasBody = currentBody();
      // このセッションの場の言葉（Discord モード Domain C・§venueSoulWords）。体験の教えと語の組を持つ場（配信でない）だけ
      // 体験の道で教えを読む。配信・場の外は null で、今の道（①の固定の指示は一字も変わらない）。
      const sessionVenue = venueSoulWords(server?.venueContext() ?? null);
      // ── Claude 既定経路は現状と完全同一（blocking #2「1 ビット不変」）───────────────────────
      //  sessionBrain === "claude" のとき: 起動経路でも Anthropic env ガードを明示的に通す（llm-session
      //  内でも呼ばれるが二重の防波堤・cli.mjs の型）→ 従来と同じ warnings 出力順序。BRAINS.claude.create は
      //  `(o) => createLlmSession(o)` の薄いラッパゆえ、下の create({...}) は従来の createLlmSession({...})
      //  と同じ引数・同じ呼び出しになりバイト等価。
      //  Codex 経路では codex-session が内部で OpenAI 版ガード（assertSubscriptionAuthEnvOpenAI）を
      //  onWarning 経由で走らせるため、ここで Anthropic ガードは呼ばない（別 provider へ Anthropic ガードを
      //  当てると誤った拒否/検査になる）。
      //  2026-10-16: Claude Opus 5.5（"claude-opus-55"）も同じ llm-session 経路なので同じガードを通す。
      if (sessionBrain === "claude" || sessionBrain === "claude-opus-55") {
        const { warnings } = assertSubscriptionAuthEnv(process.env);
        for (const warning of warnings) {
          process.stderr.write(`[cockpit] WARN: ${warning}\n`);
        }
      }
      // onInit は createCodexSession では余剰プロパティとして単に無視される（JS の余剰プロパティ・
      // Domain A 確認済み）。createLlmSession は従来どおり onInit/onWarning を使う。
      session = brainDef.create({
        ...(remoteVenueId && isCodexBrainId(sessionBrain) ? { ledgerPath: remoteVenueLedgerPath } : {}),
        // 人格の指示は「名前 + 会話指示」+ 魂の教え（`<recall>` の使い方・skills/）。起動時の記憶の搭載は撤去
        // （記憶の作り直し Wave 2）。教えは会話指示とは別の固定の部分で、会話指示を書き換えても消えない（Wave 3）。
        // 配信の組み直し Domain A: 名前と性格の指示は今のロールから（§buildRoleSessionSystemPrompt）。
        systemPrompt: buildRoleSessionSystemPrompt(
          sessionIdentity,
          conversationInstructionHooks.getProfile(effectiveRoleId()).body,
          sessionVenue
            ? listVenueSoulSkills({ body: sessionHasBody, venue: sessionVenue, onWarning: onBrainWarning })
                .map((skill) => skill.body)
                .join("\n\n")
            : loadSoulSkills({ names: soulSkillNamesForBody(sessionHasBody), onWarning: onBrainWarning })
        ),
        onWarning: onBrainWarning,
        // Codex の使用率の差分（account/rateLimits/updated）を残量にマージする。Claude のセッションは無視する。
        onRateLimits: (/** @type {any} */ rateLimits) => {
          if (isCodexBrainId(sessionBrain)) quotaMonitor.mergeCodexUpdate(rateLimits);
        },
        // 今のモデルが fast（priority）を持つか（codex-session が model/list で読んだ段）。操縦席の
        // 「このモデルは fast 非対応」の表示に使う。Claude のセッションは無視する。
        onServiceTiers: (/** @type {any} */ info) => {
          if (codexFastHooks.noteServiceTiers(sessionBrain, info?.serviceTiers)) server?.codexFastStatusChanged();
        },
        onInit: (init) =>
          process.stderr.write(
            `${JSON.stringify({ event: "session_init", model: init.model, apiKeySource: init.apiKeySource, tools: init.tools })}\n`
          )
      });
      sessionInstructionRevision = instructionRevision.getRevision();
      sessionAcceptedContextRevision = sessionContextRevision;
      sessionBody = sessionHasBody;
    }
  };

  /**
   * 頭のセッションを畳む（冪等・配信の組み直し Domain D: 「配信を終える」と、始めるの途中の失敗の巻き戻し）。畳んだ頭の
   * 圧縮はもう続かないので、操縦席の「圧縮中」も戻す。
   */
  const disposeSession = async () => {
    const current = session;
    if (current == null) return;
    session = null;
    sessionInstructionRevision = null;
    sessionAcceptedContextRevision = null;
    sessionBody = null;
    server?.resetContextCompaction();
    try {
      await current.dispose();
    } catch {
      // best-effort（畳んだセッションは使わない）。
    }
  };

  /**
   * 「配信を始める」の頭のセッション（stream-restructure.md §3 の 5）: 前の場のセッション（や起動時に作ったもの）は使わず、
   * 今のロールのモデルと指示で作り直す。
   */
  const openStreamSession = async () => {
    await disposeSession();
    ensureSession();
  };

  /**
   * 流し込みプレイヤー（常駐 PowerShell + C#・起動に約 0.5 秒）と声の差し替え口を用意する（冪等）。
   * 場を開くとき（耳の後・ロールの束の voice.startResources）に呼んで先に起こしておく（申し送り 1・最初の Fire に起動を乗せない）。常駐が
   * 落ちていたら作り直す。出力デバイスの変更は applyDesiredFireSettings が次の Fire の境目で反映する
   * （revision 方式・進行中の発話は accepted snapshot の player を最後まで使う）。
   */
  const ensureVoiceResources = () => {
    // Discord モード Domain E: Discord の場では手元の再生器を起こさない（声は Bot の接続へ・手元のスピーカーから出さない）。
    if (venuePlayers.current() != null) {
      voiceEngines.ensure(effectiveTtsEngine());
      return;
    }
    if (player != null && !player.isAlive()) {
      try {
        player.dispose();
      } catch {
        // best-effort（落ちた常駐は使わない）。
      }
      player = null;
      playerAudioRevision = null;
    }
    if (player == null) {
      const deviceName = audioDeviceHooks.getAudioDevice() ?? undefined;
      player = createStreamPlayer({
        ...(deviceName ? { deviceName } : {}),
        // 診断は行の種類だけ（id や本文は残さない）。
        onOutput: (line) => {
          const marker = typeof line === "string" ? line.split("\t", 1)[0] : "unknown";
          fireDiagnostics.record("player.child", { marker });
        },
        onError: () => fireDiagnostics.record("player.child.error")
      });
      playerAudioRevision = audioRevision;
    }
    // 声の engine（Start で用意済みならそれ・Start より前の Fire は今の方式で作る。用意できなければ理由で投げる）。
    voiceEngines.ensure(effectiveTtsEngine());
  };

  const applyDesiredFireSettings = async () => {
    // 器の URL の差し替えは体のあるロールのときだけ（体なしは器を使わない。差し替えは体のあるロールに戻った最初の
    // Fire の境目で効く・配信の組み直し Domain C）。
    if (currentBody() && appliedChannelRevision !== channelRevision) {
      lazyChannel.setUrl(desiredChannelUrl);
      appliedChannelRevision = channelRevision;
    }
    if (player != null && playerAudioRevision !== audioRevision) {
      try {
        player.dispose();
      } catch {
        // Best effort; replacement remains authoritative for the next Fire.
      }
      player = null;
      playerAudioRevision = null;
    }
    const sessionStale =
      session != null &&
      (sessionInstructionRevision !== instructionRevision.getRevision() ||
        sessionAcceptedContextRevision !== sessionContextRevision ||
        sessionBody !== currentBody());
    if (sessionStale) {
      const stale = session;
      try {
        await stale.dispose();
      } catch {
        // Best effort; the stale session is never reused for the next Fire.
      }
      // 畳んだ頭の圧縮はもう続かない（dispose が待っている compact() を失敗で返し、ふつうは failed が先に届く）。
      // 届かなかったときも操縦席の「圧縮中」を出しっぱなしにしない（冪等）。
      server?.resetContextCompaction();
      if (session === stale) {
        session = null;
        sessionInstructionRevision = null;
        sessionAcceptedContextRevision = null;
        sessionBody = null;
      }
    }
  };

  // orchestrator に渡す session/player は proxy（実体は ensureFireResources で遅延生成）。
  // session.ask は URL 未設定なら spawn せず明示エラー（→ orchestrator が fireError 診断に落とす）。
  // 配信の組み直し Domain C: URL の確かめはロールに体があるときだけ（hasBody）。
  // S5: ask(input) は string | content ブロック配列を透過する（createSessionProxy 参照）。
  const sessionProxy = createSessionProxy({
    getUrl: () => lazyChannel.getUrl(),
    hasBody: currentBody,
    ensureFireResources,
    getSession: () => session,
    ensureSessionCurrent: applyDesiredFireSettings
  });
  // acquireFireResources が無い経路のための proxy（本番は accepted snapshot の player 実体を使う）。
  const playerProxy = {
    /** @param {string} id @param {{ sampleRate: number; channels: number }} format */
    open(id, format) {
      ensureFireResources();
      return /** @type {any} */ (activePlayer()).open(id, format);
    },
    /** @param {string} id @param {Uint8Array} pcm */
    write(id, pcm) {
      const p = activePlayer();
      return p != null ? p.write(id, pcm) : false;
    },
    /** @param {string} id */
    end(id) {
      const p = activePlayer();
      return p != null ? p.end(id) : false;
    },
    /** barge-in の声止め（S6）。open が走った後にしか呼ばれない = player は生成済み。best-effort。 */
    stop() {
      const p = activePlayer();
      if (p != null) p.stop();
    },
    /** @param {(event: any) => void} listener */
    onEvent(listener) {
      ensureVoiceResources();
      return /** @type {any} */ (activePlayer()).onEvent(listener);
    }
  };
  // 既定の AivisSpeech engine の deps（話者は今のロールの声・`--speaker` が上書き）。受理のたびに作る。
  const productionSpeakDeps = () =>
    Object.freeze({
      ttsBaseUrl: args.ttsBaseUrl,
      speaker: roleVoice().speaker
    });
  const acquireAcceptedFireResources = async () => {
    await applyDesiredFireSettings();
    // 配信の組み直し Domain C: 体の有無は受理の時点の今のロールから読む。体ありは今どおり URL が無ければ断る。
    // 体なしは器を渡さない（URL を見ない・運び手は手元の再生器だけで鳴らす・§resolveFireChannel）。
    const fireChannel = resolveFireChannel({ body: currentBody(), channel: lazyChannel });
    ensureFireResources();
    const acceptedSession = session;
    // 進行中の発話はこの player / engine を最後まで使う（デバイス変更の作り直しは次の Fire の境目）。
    // Discord モード Domain E: Discord の場ではその場の再生器（Bot の接続に結んだもの）。
    const acceptedPlayer = activePlayer();
    const acceptedEngine = voiceEngines.current();
    const acceptedVenue = server?.venueGeneration();
    return Object.freeze({
      session: acceptedSession,
      channel: fireChannel.channel,
      body: fireChannel.body,
      player: acceptedPlayer,
      engine: acceptedEngine,
      ...(fireChannel.body && acceptedEngine?.kind === "elevenlabs" ? {
        speechIntentMotion: lazyChannel.speechIntentMotion(),
        speechIntentScene: acceptedVenue,
        isSpeechMotionVenueActive: () =>
          server?.venueGeneration() === acceptedVenue && server?.streamStatus().phase === "open",
        gameScreenShared: Boolean(venueVisionTarget())
      } : {}),
      speakDeps: productionSpeakDeps(),
      configuration: Object.freeze({
        brain: effectiveBrain(),
        sessionContextRevision,
        instructionRevision: instructionRevision.getRevision(),
        audioDevice: audioDeviceHooks.getAudioDevice(),
        audioRevision,
        channelUrl: fireChannel.channelUrl,
        channelRevision,
        // ①の turn/start に送る速さの段（Codex の頭のときだけ・受理の時点の fast の設定・Claude は null）。
        serviceTier: codexFastHooks.serviceTierFor(effectiveBrain())
      }),
      metadata: Object.freeze({
        sessionContextRevision,
        instructionRevision: instructionRevision.getRevision(),
        audioRevision,
        channelRevision,
        // 体なしの Fire は器につながないので、器の接続の世代も持たない（null）。
        channelConnectionGeneration: fireChannel.body ? lazyChannel.acceptedConnectionGeneration() : null
      })
    });
  };

  /**
   * 操縦席（POST /api/audio-device）から出力デバイスを設定/変更する（S6「会話が続く」）。
   *
   * ── デバイス変更の適用方式【次 accepted Fire で再起動】──────────────────────
   *  常駐プレイヤーは起動時に env `SOUL_AUDIO_DEVICE_NAME` でデバイス名を受ける（Domain A）ため、
   *  デバイス変更を反映するには常駐プロセスの再起動が要る。「次回起動から適用」（設定だけ書き換えて
   *  次回 `cockpit.mjs` 起動まで待つ）と「次 accepted Fire で再起動」の後者を採る。進行中 Fire は accepted
   *  snapshot の player を最後まで保持し、次の sessionProxy.ask 境界でのみ dispose→再生成する。
   * @param {string | null} name
   */
  const onSetAudioDevice = async (name) => {
    audioDeviceHooks.onSetAudioDevice(name); // 次回起動でも復元（file-backed・失敗寛容）。
    audioRevision += 1;
    process.stdout.write(
      name ? `[cockpit] audio device set: ${name}\n` : "[cockpit] audio device cleared (default)\n"
    );
  };

  /**
   * 操縦席（POST /api/role）からロールを選ぶ（配信の組み直し Domain A・旧 onSetBrain の置き換え）。
   * 場が閉じていない間は cockpit-server が断る（場の途中でロールを替えない・stream-restructure.md §2.1・Domain D）。
   *
   * ── ロールの切替【次 accepted Fire で dispose→再生成】────────────────────────
   *  頭・名前・性格の指示は、desired context revision を進めて次の sessionProxy.ask 境界でセッションを作り直して
   *  替わる（旧 onSetBrain と同じ。進行中 Fire の session は触らない）。声は次の Start（か Start より前の Fire）で、
   *  話者・声の id が違えば engine を作り直す（voiceKey）。口数・話し始め・声の方式は戻り値で cockpit-server へ
   *  渡す（scheduler と Start の既定に入れる）。whisper の手がかり・呼びかけの照合は次の発話から今のロールを読む。
   *  体の有無（Domain C）は持ち回らず、次の受理・頭に聞くとき・セッションを作るときに今のロールから読む（currentBody）。
   * @param {string} id
   */
  const onSetRole = async (id) => {
    const selected = roleHooks.select(id);
    if (!selected.ok) return selected;
    const role = selected.role;
    desiredTtsEngine = role.voice.engine;
    sessionContextRevision += 1;
    // Codex の残量は頭が Codex のときだけ（Codex でなくなったら不明に戻す・Codex 同士の切替は同じアカウントなので保つ）。
    if (!isCodexBrainId(effectiveBrain())) quotaMonitor.clearCodex();
    // 配信の組み直し Domain B・D: 記憶の置き場は替えたロールのフォルダ。準備（git init・種）は場の始まりで待つ
    // （ロールの切り替えの応答を待たせない・§createStreamVenueHooks の renewRecords）。走っている・待っている保存は、
    // 頼んだときのロールの置き場に書く（createMemoryRecorder の getPlace）。
    process.stdout.write(`[cockpit] role set: ${role.id} (brain ${role.brain})\n`);
    return { ok: true, verbosity: role.verbosity, speakStartMode: role.speakStartMode, ttsEngine: role.voice.engine };
  };

  /**
   * 操縦席（POST /api/role/edit・/api/role/new）からロールを編集する・今のロールを写して新しいロールを作る（配信の組み直し
   * Domain E・§createRoleEditHooks）。場が閉じている間だけ（cockpit-server が場の途中は 409 で断る）。編集したら、頭・声の
   * 方式を今のロールに揃え、頭の文脈の revision を進める（次のセッションは新しい名前・モデル・性格・体で作る＝ロールの
   * 切り替えと同じ）。体は持ち回らないので currentBody() がすぐ新しい値を読む。
   */
  const roleEditHooks = createRoleEditHooks({
    roleHooks,
    selectRole: (id) => onSetRole(id),
    onRoleEdited: (role) => {
      desiredTtsEngine = role.voice.engine;
      sessionContextRevision += 1;
      if (!isCodexBrainId(effectiveBrain())) quotaMonitor.clearCodex();
      process.stdout.write(`[cockpit] role edited: ${role.id} (brain ${role.brain}, body ${role.body ? "on" : "off"})\n`);
    }
  });

  /**
   * state snapshot に載せるロールの現況（今のロールと選べるロールの一覧）。配信の組み直し Domain E: ロールの編集の画面が
   * 読む持ち物（名前・声・口数・話し始め・体）も載せる。性格の指示の本文は載せない（専用の API だけ）。
   */
  const roleStatus = () => {
    const role = effectiveRole();
    return {
      id: role.id,
      displayName: role.name.display,
      brain: role.brain,
      body: role.body,
      name: { canonical: role.name.canonical, display: role.name.display, latin: role.name.latin },
      voice: { engine: role.voice.engine, aivisSpeaker: role.voice.aivisSpeaker, elevenLabsVoiceId: role.voice.elevenLabsVoiceId },
      verbosity: role.verbosity,
      speakStartMode: role.speakStartMode,
      editable: roleHooks.isPersisted(),
      roles: roleHooks.list()
    };
  };

  /**
   * 操縦席（POST /api/codex-fast）から①の Codex の頭の fast を切り替える。保存して、次の受理の configuration から
   * 効かせる（進行中の返事・セッションは触らない）。
   * @param {boolean} enabled
   */
  const onSetCodexFastMode = (enabled) => {
    codexFastHooks.onSetCodexFastMode(enabled);
    process.stdout.write(`[cockpit] codex fast: ${codexFastHooks.isEnabled() ? "on" : "off"} (from the next reply)\n`);
  };

  /**
   * state snapshot に載せる頭脳の現況（audioDeviceStatus と同型）。資格情報は **existsSync の存在確認のみ**
   * （blocking #4）——auth.json / .credentials.json の中身は絶対に読まない・ログ/SSE にも出さない。
   */
  const brainStatus = () => {
    const brain = effectiveBrain();
    const def = BRAINS[brain] ?? BRAINS.claude;
    return { brain, credentialHealth: existsSync(def.credentialPath) };
  };

  // ── 配信間記憶: 保存の係（定期・手動「今日を記録」・配信を終える（Ctrl+C）のどれもここを通る・直列）──────────
  //  1 回の保存 = ②書き出し役（使い捨ての Codex・cwd = 記憶のフォルダ・workspace-write）が本体と目次を書き、
  //  魂が記憶のフォルダの git にコミットする（writeStreamRecord）。②の頭は Codex に固定（resolveWriterBrainDef）。
  //  server は下方の createCockpitServer(...) で代入される前方参照(sessionProxy の getSession と同型)。
  //  配信の組み直し Domain B: 記憶のフォルダ（と場の保存の持ち回り）は保存を頼んだ時点のロールの置き場（getPlace）。
  //  配信の組み直し Domain D: 引き金は 20 分ごと・手動「今日を記録」（どちらも場が開いている間だけ）・「配信を終える」
  //  （Ctrl+C も同じ道）。耳の Stop の引き金は「配信を終える」に 1 本化した。
  const memoryRecorder = createMemoryRecorder({
    getLiveEntries: () => (server ? server.getTranscript() : []),
    getPlace: () => memoryPlaces.place(),
    getWriterBrain: effectiveBrain,
    // Discord モード Domain C: 保存を頼んだ時点の場の語の組（定期・手動・「配信を終える」の最後の保存のどれも場が開いている
    // 間に頼む・閉じる段の最後の保存も場を閉じる前）。場の外・配信は null = 配信の語の組。
    getWording: () => server?.venueContext()?.wording ?? null,
    writeImpl: async (entries, /** @type {ReturnType<typeof memoryPlaces.place>} */ place, wording, materials, onUnconfirmedExit, writerBrain) => {
      if (!place) throw new Error("memory folder is not available (the memory move failed; see the startup log)");
      await place.ready;
      return writeStreamRecord({
        create: /** @type {any} */ (resolveWriterBrainDef(writerBrain).create),
        entries,
        record: place.streamRecord,
        dir: place.dir,
        wording,
        materials,
        onUnconfirmedExit,
        onWarning: onBrainWarning,
        strictOutcome: Boolean(remoteVenueId)
      });
    },
    onSaved: (info) => {
      // 配信の組み直し Domain D: 頼んだ時点の場の保存だけを、その場の数えにする（§createStreamVenueHooks の noteSaved）。
      if (!remoteVenueId || info.commit?.ok) streamVenue.noteSaved(info);
      const { commit } = info;
      // 本文・トピック名は出さない（コミットの有無だけ）。
      const what = commit && commit.ok ? (commit.committed ? `commit ${String(commit.commit).slice(0, 7)}` : "no changes") : "commit failed";
      process.stdout.write(`[cockpit] memory recorded (${what})\n`);
    },
    onError: (error) => {
      process.stderr.write(
        `[cockpit] WARN: memory record failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
    },
    // 「記録中」の表示を操縦席へ（走り始めと全部終わったとき）。
    onRecordingChange: () => server?.memoryStatusChanged()
  });

  // 記憶の整理 Domain C: ③整理役の係（§createMemoryOrganiserRunner）。場を閉じる道（配信を終える・通話を終える・Ctrl+C の
  // 終える）で、閉じの書き出しのあと、そのロールの置き場の整理の時期なら走らせて待つ。頭は②と同じ決め方
  // （resolveWriterBrainDef）。控えは apps/soul/agent/memory-backups/（MEMORY_BACKUP_ROOT）。始まりと終わりはターミナルに
  // 1 行（中身なし）、B の警告と見送りは①②と同じ onBrainWarning へ。走っている間は snapshot の stream.organising（画面の「整理中」）。
  const memoryOrganiser = createMemoryOrganiserRunner({
    getCreate: () => resolveWriterBrainDef(effectiveBrain()).create,
    backupRoot: MEMORY_BACKUP_ROOT,
    onLine: (line) => process.stdout.write(`[cockpit] ${line}\n`),
    onWarning: onBrainWarning,
    onRunningChange: (running) => server?.setMemoryOrganising(running)
  });

  // 配信の組み直し Domain D: 場（配信を始める / 終える）の cockpit.mjs 側の口と場ごとの記録（§createStreamVenueHooks）。
  // cockpit-server の openStream / closeStream が streamHooks として順に呼ぶ。器の URL は場の始まりで今の値に揃えてから
  // 確かめる（体のあるロールのときだけ・体なしは器を見ない）。
  const streamVenue = createStreamVenueHooks({
    memoryPlaces,
    memoryRecorder,
    renewUsageLog: (startedAtMs) => {
      const previous = sessionUsageLog;
      sessionUsageLog = createSessionUsageLog({ startedAtMs });
      void previous.flush();
    },
    openSession: openStreamSession,
    closeSession: disposeSession,
    hasBody: currentBody,
    channel: {
      getUrl: () => {
        if (appliedChannelRevision !== channelRevision) {
          lazyChannel.setUrl(desiredChannelUrl);
          appliedChannelRevision = channelRevision;
        }
        return lazyChannel.getUrl();
      },
      connect: () => lazyChannel.connect(),
      close: () => lazyChannel.close()
    },
    isStreamOpen: () => server?.streamStatus().phase === "open",
    getEntries: () => (server ? server.getTranscript() : []),
    onMemoryWait: () => process.stdout.write("[cockpit] 記録を書き出し中…\n"),
    organiser: memoryOrganiser
  });

  // 引き金①: 定期保存(20 分毎・場が開いている間だけ・転写が前回記録から不変ならスキップ=inventory §2-4)。
  // unref() でプロセス生存に寄与させない(ears-cli 等の既存タイマ規律)。
  // Discord モード Domain H（discord-mode.md §13.6）: 張るのは起動時の 1 回のまま、1 分ごとに確かめる。頼むかは checkpoint
  // が「場の始まり・前の保存（途中・手動）から 20 分」で決める（起動から 20 分ごとに当たって、入り直した直後に頼む、を直す）。
  const memoryCheckpointTimer = setInterval(() => {
    streamVenue.checkpoint();
  }, MEMORY_CHECKPOINT_TICK_MS);
  memoryCheckpointTimer.unref();

  /** 引き金②: 操縦席(POST /api/memory-record)からの手動「今日を記録」(保存の係の薄いラッパ・場が閉じていればサーバが断る)。 */
  const onMemoryRecord = () => memoryRecorder.record();

  /**
   * ④思い出し役を 1 回走らせる（記憶の作り直し Wave 3・思い出しの係が呼ぶ）。使い捨ての Codex（resolveWriterBrainDef と
   * 同じ決め方）を cwd = 記憶のフォルダ・read-only・最後の答えだけで作る。警告は①②と同じ onBrainWarning へ。
   * 配信の組み直し Domain B: 記憶のフォルダは今のロールのフォルダ（ほかのロールの記憶は読まない）。
   * @param {import("../../mind/recall-desk.mjs").RecallJob} job
   */
  const prepareRecall = (job) => {
    const place = memoryPlaces.place();
    if (!place) throw new Error("memory folder is not available (the memory move failed; see the startup log)");
    const brain = resolveWriterBrainDef(effectiveBrain());
    return async () => {
      await place.ready;
      return runRecall({
        create: /** @type {any} */ (brain.create),
        taskSessions: job.taskSessions,
        request: job.request,
        entries: job.entries,
        nowMs: job.nowMs,
        dir: place.dir,
        wording: job.wording ?? null,
        onReply: job.onReply,
        onWarning: onBrainWarning
      });
    };
  };

  /** state snapshot に載せる記憶の現況（この場で最後に記録した時刻と、今記録中か）。 */
  // 配信の組み直し Domain E: 記憶のタブに「どのロールの記憶か」を出す（memoryPlaces.placeInfo・置き場は作らない）。
  const memoryStatus = () => {
    const info = memoryPlaces.placeInfo();
    return {
      lastRecordAtMs: streamVenue.lastRecordAtMs(),
      recording: memoryRecorder.isRecording(),
      available: info != null,
      roleId: info ? info.roleId : null,
      roleName: info ? effectiveRole().name.display : null,
      dir: info ? info.dir : null
    };
  };

  /** fireOrchestratorFactory は常に注入する（Channel URL 未設定でも fire は「使えないが結線済み」）。 */
  const fireOrchestratorFactory = (/** @type {any} */ hooks) =>
    createFireOrchestrator({
      ...hooks,
      onFire: (info) => {
        if (info?.accepted === true) {
          fireDiagnostics.begin({
            injectedChars: typeof info.injectedChars === "number" ? info.injectedChars : null,
            includedCount: typeof info.includedCount === "number" ? info.includedCount : null,
            vision: info.vision === true,
            // 操縦席の発火番号ときっかけの種類（本文なし）で、診断の JSONL と画面のデータを結べるようにする。
            fireNo: typeof info.fireId === "number" ? info.fireId : null,
            causeType: info.cause && typeof info.cause.type === "string" ? info.cause.type : null
          });
        }
        hooks.onFire?.(info);
      },
      onDiagnostic: (diagnostic) => {
        fireDiagnostics.record("fire.diagnostic", {
          diagnosticType: typeof diagnostic?.type === "string" ? diagnostic.type : "unknown",
          kind: typeof diagnostic?.kind === "string" ? diagnostic.kind : null
        });
        hooks.onDiagnostic?.(diagnostic);
      },
      // 頭の文脈の記録: ask が返るたびに 1 行（Codex の頭のときだけ・本文なし）。
      onAskRecord: (info) => {
        if (isCodexBrainId(info?.brain ?? effectiveBrain()) || info?.conversationWindow?.hasGameScreen === true) {
          sessionUsageLog.append(fireUsageRecord(info));
        }
      },
      onTrace: (trace) => {
        // 発火のたびに Codex の使用率を読む（ask が済んだ直後・失敗したとき。App Server の起動後にしか読めない）。
        if (trace?.event === "llm.ask.completed" || trace?.event === "fire.failed") void quotaMonitor.refreshCodex();
        // 返事が終わるたびに、隙間で圧縮してよいかを確かめる（発火の後始末が済んでから）。
        if (trace?.event === "fire.completed" || trace?.event === "fire.failed") contextCompactor.noteReplyFinished();
        if (trace?.event === "fire.completed") {
          fireDiagnostics.finish({ fired: trace.fired === true, reason: trace.reason ?? null });
          return;
        }
        if (trace?.event === "fire.failed") {
          fireDiagnostics.fail(
            typeof trace.stage === "string" ? trace.stage : "unknown",
            { name: trace.failureName ?? "Error", code: trace.failureCode ?? null }
          );
          return;
        }
        if (trace && typeof trace.event === "string") {
          const { event, ...fields } = trace;
          fireDiagnostics.record(event, fields);
        }
      },
      session: /** @type {any} */ (sessionProxy),
      channel: /** @type {any} */ (lazyChannel),
      player: /** @type {any} */ (playerProxy),
      progressivePlayback: true,
      acquireFireResources: acquireAcceptedFireResources,
      // S5「目が開く」: 対象ウインドウの解決関数（settings 経由）。撮影は常駐の撮る係に頼む
      // （vision-capture-latency §4・使えない間は captureWindow＝毎回起動に戻る）。
      // Discord モード Domain G: Discord の場では Discord の準備の見る窓（§createVenueVisionTarget）。
      getVisionTarget: venueVisionTarget,
      captureImpl: residentCapture.capture,
      speakDeps: productionSpeakDeps(),
      ...(windowMs != null ? { windowMs } : {}),
      ...(maxChars != null ? { maxChars } : {})
    });

  /** 操縦席（POST /api/channel）から Channel URL を設定/変更する。token を平文で保持/ログしない。 */
  const onSetChannelUrl = async (/** @type {string | null} */ url) => {
    desiredChannelUrl = url;
    channelRevision += 1;
    try {
      settings.setLastChannelUrl(url); // 次回起動で復元（file-backed・失敗寛容）。
    } catch {
      // 永続化失敗は起動/操作を止めない。
    }
    process.stdout.write(
      url ? `[cockpit] channel set: ${redactToken(url)}\n` : "[cockpit] channel cleared\n"
    );
  };

  /**
   * state snapshot に載せる Channel の現況（redact 済み・token を平文で出さない）。
   * 配信の組み直し Domain C: 今のロールの体の有無（body）も載せる。体なしなら画面の器の状態は「体なし」
   * （view-logic/status.mjs の channelStatusView）。
   */
  const channelStatus = () => {
    const u = desiredChannelUrl;
    return {
      configured: u != null,
      url: u != null ? redactToken(u) : null,
      connection: lazyChannel.connectionStatus(),
      body: currentBody()
    };
  };

  // 配信の組み直し Domain D: --channel で起動しても、起動時には頭のセッションを作らない（先充填はやめた）。頭のセッションは
  // 「配信を始める」で今のロールのモデルと指示で作る（§openStreamSession・stream-restructure.md §3 の 5）。

  // Discord モード Domain B: 場に入るロールの束（§createVenueRoleBundle・最初の的では今のロール 1 つ）。今の 1 つずつの変数を
  // 包む: 今のロールの名前、場の口（場の記録・頭のセッション・器・記憶の最後の保存）、声の engine の用意（耳を開く前・種類が
  // 変われば作り直す・ElevenLabs のキーはここで読む・用意できなければ場は開かない）と再生器（流し込みプレイヤーと声の差し替え
  // 口・最初の Fire に乗せない）、④思い出し役。サーバはロールに依る値をこの束から引く。
  const venueRole = createVenueRoleBundle({
    currentId: effectiveRoleId,
    identity: getCurrentRoleIdentity,
    streamHooks: streamVenue.hooks,
    prepareVoice: (kind) => {
      if (!server?.discordVenueRole()) desiredTtsEngine = kind;
      return voiceEngines.prepare(kind);
    },
    startVoiceResources: ensureVoiceResources,
    recallRunner: async (job) => prepareRecall(job)(),
    prepareRecall,
    // Discord モード Domain D: Discord の入口が鍵を読むファイル名（今のロールの role.json の discordBotKeyFile・無ければ既定）。
    discordBotKeyFile: () => roleDiscordBotKeyFile(effectiveRole()),
    // Discord モード Domain E: 鍵のファイル名の形が合わなければ Discord の入口が断る（既定の鍵で入らない）。
    discordBotKeyFileRefused: () => roleDiscordBotKeyFileRefused(effectiveRole()),
    // Discord モード Domain E: Discord の出口（VC に入った直後にこのロールの Bot の接続に再生器を結ぶ・§createVenuePlayerSlot）。
    openVoiceOutlet: (info) => venuePlayers.open(info),
    onWarning: (line) => process.stderr.write(`[cockpit] WARN: ${line}\n`)
  });

  // Discord モード Domain D: Discord の体験の口（§createDiscordVenueExperience）。準備（サーバー・ボイスチャンネル・文字起こしの
  // 方式）は settings に保存し、鍵は今のロールの指すファイルから読む。ログは数と状態だけ。
  const discordExperience = createDiscordVenueExperience({
    settings,
    currentKeyFile: () => roleDiscordBotKeyFile(effectiveRole()),
    currentKeyFileRefused: () => roleDiscordBotKeyFileRefused(effectiveRole()),
    write: (line) => process.stdout.write(line),
    options: { getTaskResources: () => server?.getActiveVenueTaskResources() ?? null, acquireGuildLease: acquireDiscordGuildLease }
  });

  server = createCockpitServer({
    port: args.port ?? DEFAULT_COCKPIT_PORT,
    reservedServer,
    indexHtmlPath: cockpitHtmlPath,
    settingsStore: settings,
    // Discord モード Domain B: 場に入るロールの一覧（最初の的では今のロールの束 1 つ・§createVenueRoleBundle）。名前（whisper・
    // 呼びかけの照合・判定・snapshot）・場の口・声の engine と再生器・④はこの束から引く。束の口は呼んだ時点の今のロールを読む
    // （ロールの切り替えで耳や予定を作り直さない）。
    roles: [venueRole],
    // Discord モード Domain D: 場の体験の口（配信の口はサーバの中・Discord の口はここから渡す）。
    experiences: { discord: discordExperience },
    resolveDiscordVenueRole: roleHooks.resolveForVenue,
    ...(remoteVenueId ? { remoteVenue: { id: remoteVenueId, finish: async (outcome) => {
      await shutdown("remote");
      await writeRemoteVenueReceipt(remoteVenueId, outcome);
      process.exit(0);
    } } } : {}),
    releaseDiscordVenueVoice: () => voiceEngines.dispose(),
    localTaskRunner: async ({ resources, request }) => runLocalTask({
      resources, request, create: resolveWriterBrainDef(effectiveBrain()).create, onWarning: onBrainWarning
    }),
    // 配信の組み直し Domain A: 起動時の引っ越しの結果（ログのタブに出す・引っ越しが無ければ空）。
    notices: startupNotices,
    fireOrchestratorFactory,
    onSetChannelUrl,
    channelStatus,
    // S5「目が開く」: 対象ウインドウ設定の口（GET /api/windows は既定 listWindowsImpl=Domain A listWindows
    // をそのまま使う・差し替え不要）。
    onSetVisionTarget: visionTargetHooks.onSetVisionTarget,
    visionTargetStatus: visionTargetHooks.visionTargetStatus,
    gameDialogueOcr: {
      intervalMs: resolveStreamGameOcrInterval(process.env.STREAM_GAME_OCR_INTERVAL_MS),
      getTarget: visionTargetHooks.getVisionTarget
    },
    // S6「会話が続く」: 出力デバイス設定の口（GET /api/audio-devices は既定 listAudioDevicesImpl=
    // Domain A listAudioDevices をそのまま使う・差し替え不要）。
    onSetAudioDevice,
    audioDeviceStatus: audioDeviceHooks.audioDeviceStatus,
    // S6「会話が続く」: 自発発火 ON/OFF の永続トグル（起動時は settings から復元・既定 OFF）。
    selfFireInitialEnabled: selfFireHooks.resolveInitialEnabled(),
    onSetSelfFireEnabled: selfFireHooks.onSetSelfFireEnabled,
    // 「朗読と合いの手」: barge-in ON/OFF の永続トグル（起動時は settings から復元・既定 ON・裁定 1）。
    // resolveInitialEnabled() を bargeInGate 構築時の enabled へ直接渡す（born-disabled の伝播経路）。
    bargeInInitialEnabled: bargeInHooks.resolveInitialEnabled(),
    onSetBargeInEnabled: bargeInHooks.onSetBargeInEnabled,
    // 口数モード（quiet/normal/chatty・起動時は settings から復元・既定 "normal"）。
    verbosityInitialMode: verbosityHooks.resolveInitialVerbosity(),
    onSetVerbosity: verbosityHooks.onSetVerbosity,
    // 配信の組み直し Domain A: ロールの選択（旧 頭脳選択）。POST /api/role で onSetRole（選択の永続化 + 次の Fire の
    // 境目でのセッションの作り直し）を呼び、snapshot に roleStatus()（今のロール・一覧）と brainStatus()（ロールが
    // 指す頭の札 + 資格情報の存在確認）を載せる。状態の正本は cockpit.mjs 側（roleHooks と場の設定）。
    onSetRole,
    roleStatus,
    // 配信の組み直し Domain E: ロールの編集（POST /api/role/edit）と、今のロールを写して新しいロール（POST /api/role/new）。
    onUpdateRole: roleEditHooks.onUpdateRole,
    onCreateRole: roleEditHooks.onCreateRole,
    // 配信の組み直し Domain E: 起動時の引っ越しの失敗は上の帯の警告にも出す（ログのタブの行に加えて）。
    startupWarnings: startupMigrationWarnings(startupMigration),
    brainStatus,
    // Conversation instructions are exposed only through the dedicated local API. The hook owns durable
    // settings writes and effective revision advancement; no instruction text enters state/SSE/transcript.
    conversationInstructionHooks,
    // S7「視聴者が混ざる」: 実チャット器官のファクトリを注入（本番 createLiveChatClient）。生成/Connect/
    // 停止のライフサイクルは cockpit-server が所有し、POST /api/chat/connect で `factory({ source })` を
    // 生成 start()・onMessage/onStatus/onDiagnostic を取り込み経路へ繋ぐ。配信 source は settings に記憶。
    chatClientFactory: createLiveChatClient,
    onSetChatSource: chatSourceHooks.onSetChatSource,
    chatSourceStatus: chatSourceHooks.chatSourceStatus,
    // 配信間記憶: 手動「今日を記録」+ 現況（最後に記録した時刻・記録中か）。記憶の ON/OFF は撤去（Wave 2）。
    onMemoryRecord,
    memoryStatus,
    // 圧縮を始める大きさ（設定の「頭脳・会話」タブ）: 保存 + 走っている compactor の差し替え・snapshot の compaction。
    onSetCompactThresholdTokens: contextCompactionHooks.onSetCompactThresholdTokens,
    contextCompactionStatus: contextCompactionHooks.contextCompactionStatus,
    // ①の Codex の頭の fast（設定の「頭脳・会話」タブ・POST /api/codex-fast と snapshot の codexFast）。
    onSetCodexFastMode,
    codexFastStatus: () => codexFastHooks.codexFastStatus(effectiveBrain()),
    // 操縦席の文字起こし選択: 起動時に前回の選択を復元・Start ごとに記憶・遅延は標準出力へ 1 行（数字のみ）。
    // ElevenLabs のキーは cockpit-server の既定（.env.elevenlabs.local をコード内で直接読む）に任せる。
    sttEngineInitial: sttEngineHooks.resolveInitialSttEngine(),
    onSetSttEngine: sttEngineHooks.onSetSttEngine,
    // ローカルの文字起こし（Parakeet / Zipformer）の設定（画面なし・設定ファイルのキー）。Start ごとに読む。
    // モデルの存在確認は cockpit-server の既定（vendor/models）に任せる。
    // 配信の組み直し Domain A: hotwords は今のロールの名前の手がかり（ロールに無ければ設定ファイルか既定）。
    localSttSettings: () => applyRoleHotwords(settings.getLocalStt(), effectiveRole()),
    onSttLatency: (info) => process.stdout.write(formatSttLatencyLine(info)),
    // 声の方式（声の差し替え Wave 3）: 起動時に前回の選択を復元・Start ごとに記憶する。engine の用意（耳を開く前・用意
    // できなければ Start は理由つきで失敗する）と再生器はロールの束（venueRole.voice）が持つ。
    ttsEngineInitial: desiredTtsEngine,
    onSetTtsEngine: ttsEngineHooks.onSetTtsEngine,
    // 画面キャプチャの撮る係（目）の寿命を場に合わせる（vision-capture-latency §4 の 2・Discord モード Domain B: 場の共通の段）。
    // close() でも止まる。
    onEyesStart: () => residentCapture.start(),
    onEyesStop: () => residentCapture.stop(),
    // speak-now（話し始めの判定）: 方式は settings から復元（初回既定 speak-now）・切替ごとに記憶・判定ごとに
    // 標準出力へ 1 行（遅延・選択・確率のみ）。Decisions API のキーは cockpit-server の既定
    // （.env.decisions.local をコード内で直接読む）に任せる。
    speakStartModeInitial: speakStartHooks.resolveInitialSpeakStartMode(),
    onSetSpeakStartMode: speakStartHooks.onSetSpeakStartMode,
    onSpeakNowJudgment: (info) => {
      process.stdout.write(formatSpeakNowLine(info));
      // Discord モード Domain H（discord-mode.md §13.7）: 判定ごとに今の場の記録（session-usage/）へ 1 行（時刻・きっかけ・
      // 選択・確率・行き先・遅延・エラーの種類だけ・エラー文は書かない）。ターミナルの 1 行はそのまま。
      recordSessionUsage(judgmentUsageRecord(info));
    },
    // Discord モード Domain H: 発火の要求を断った（場が開いていない・KILL・忙しい・耳が無い・窓が空など）を記録へ 1 行。
    onFireRefused: (info) => recordSessionUsage(fireRefusedUsageRecord(info)),
    // Discord モード Domain H: つまみ（自発・かぶり判定・KILL）の切り替えを記録へ 1 行（前後の真偽だけ）。
    onControl: (info) => recordSessionUsage(controlUsageRecord(info)),
    // 相槌どうしの最小間隔は settings ファイルの backchannelMinIntervalSec（無ければ 8 秒・backchannel.md §2）。
    backchannelMinIntervalMs: speakStartHooks.resolveBackchannelMinIntervalMs(),
    // コメント判定（弾く判定は全モード・反応する判定は speak-now の間）: 忙しい間のコメントの扱いは settings から
    // 復元（既定 あとで拾う）・切替ごとに記憶。鮮度と件数は settings ファイルの値（無ければ 20 秒 / 3 件）。
    // 判定ごとに標準出力へ 1 行（コメント本文は書かない）。キーは speak-now と同じ既定の読み口。
    commentBusyPolicyInitial: commentBusyHooks.resolveInitialCommentBusyPolicy(),
    onSetCommentBusyPolicy: commentBusyHooks.onSetCommentBusyPolicy,
    commentHoldMaxAgeMs: commentHold.maxAgeMs,
    commentHoldMaxCount: commentHold.maxCount,
    onCommentJudgment: (info) => process.stdout.write(formatCommentJudgmentLine(info)),
    // 記憶の作り直し Wave 3: 思い出しの係（④は使い捨ての Codex・ロールの束の recall.run・「避けるか」判定は cockpit-server の
    // 既定の Decisions API）。係の出来事は標準出力へ 1 行（頼みごと・記憶の中身は書かない）。
    onRecallEvent: (event) => process.stdout.write(formatRecallEventLine(event)),
    // 操縦席の作り直し 1 回目（データ側）: 残量・遅延のしきい値（settings の latencyWarnSec / latencyAlertSec・既定 4 / 6 秒）・
    // 返事ごとの遅延の 1 行（数字ときっかけの種類だけ）。
    quotaSource: quotaMonitor,
    latencyThresholds: resolveLatencyThresholdsFromSettings(settings),
    onReplyLatency: (record) => {
      process.stdout.write(formatReplyLatencyLine(record));
      // 返事ごとの遅延の内訳を起動ごとの記録（session-usage/）にも 1 行（SSE "latency" と同じ値・本文なし・全部の頭）。
      sessionUsageLog.append(replyLatencyUsageRecord(record));
    }
  });

  const url = await server.listen();
  quotaMonitor.start();
  contextCompactor.start();
  process.stdout.write(`[cockpit] listening on ${url} (loopback only)\n`);
  process.stdout.write(`[cockpit] open  ${url}/  in your browser — 「配信を始める」を押して、話しかける。\n`);
  const startupUrl = lazyChannel.getUrl();
  // 配信の組み直し Domain D: 頭のセッションと器の接続は「配信を始める」で作る（起動時には作らない・--channel でも同じ）。
  if (!currentBody()) {
    // 配信の組み直し Domain C: 体の無いロールは器を使わない（URL の有無を案内しない）。
    process.stdout.write(
      `[cockpit] fire wired: ロール ${effectiveRoleId()} は体なし — 器（Channel）にはつながず、手元の再生器だけで声を出します` +
        "（表情タグは使いません）。LLM セッションは「配信を始める」で作ります。\n"
    );
  } else if (startupUrl) {
    process.stdout.write(
      `[cockpit] fire enabled: channel = ${redactToken(startupUrl)} ` +
        `(window ${(args.fireWindowMin ?? FIRE_WINDOW_MS / 60000)} min, max ${args.fireMaxChars ?? FIRE_MAX_CHARS} chars). ` +
        (args.channel ? "起動引数から。" : "設定から復元。") +
        "LLM セッションと Channel の接続は「配信を始める」で作ります（Channel につながらなければ配信は始まりません）。\n"
    );
  } else {
    process.stdout.write(
      "[cockpit] fire wired but no channel URL yet — 操縦席の Channel 欄に URL を入れてから「配信を始める」を押してください" +
        "（体のあるロールは Channel につながらないと配信を始められません）。\n"
    );
  }
  process.stdout.write("[cockpit] Ctrl+C / EOF で終了します（配信中なら「配信を終える」と同じ道で記録してから畳みます）。\n");

  // 配信の組み直し Domain D: Ctrl+C は、場が開いていれば「配信を終える」と同じ道（server.endStream）を通ってから畳む
  // （§createCockpitShutdown）。閉じていれば保存は頼まない。終了中の Ctrl+C はプロセスを強制終了し、閉場途中の作業領域はそのまま残す。
  const shutdown = createCockpitShutdown({
    write: (line) => process.stdout.write(line),
    beforeClose: () => contextCompactor.dispose(),
    server,
    venue: streamVenue,
    // S3: fire 結線の常駐リソースも確実に畳む（リーク禁止・cli.mjs の dispose 順の型）。頭のセッションと器は場の終わりで
    // 畳み済みのはず（冪等）。
    disposeRest: async () => {
      await disposeSession();
      if (player) {
        try {
          player.dispose();
        } catch {
          // best-effort
        }
      }
      voiceEngines.dispose();
      try {
        await lazyChannel.close();
      } catch {
        // best-effort
      }
    },
    forceExit: () => process.exit(130),
    finalize: async () => {
      // 撮る係は close() の onEyesStop で止まっているはずだが、途中で throw しても取り残さない（冪等）。
      residentCapture.stop();
      quotaMonitor.stop();
      // 記録の書き残しを少しだけ待つ（固まらないよう上限つき）。
      await Promise.race([sessionUsageLog.flush(), new Promise((resolve) => setTimeout(resolve, 1000))]);
      if (!remoteVenueId) process.exit(0);
    }
  });
  // stdin EOF（Ctrl+Z→Enter / パイプ終端）でも畳む（ears-cli.mjs の型）。
  if (!remoteVenueId) {
    process.on("SIGINT", shutdown);
    const rl = createInterface({ input: process.stdin });
    rl.on("close", () => void shutdown("EOF"));
  }
  if (args.open) openCockpitBrowser(`${url}/`);
}
