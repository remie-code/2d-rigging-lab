/**
 * settings の視覚発火対象ウインドウ（visionTarget）を、cockpit-server の口
 * （onSetVisionTarget/visionTargetStatus）と fire-orchestrator の口（getVisionTarget）へ橋渡しする
 * （S5「目が開く」・Domain C 前半）。Channel URL の onSetChannelUrl/channelStatus と同型の薄い配線層
 * （テスト可能化のため main() から抽出・export）。
 *
 * @param {{ getVisionTarget: () => string | null; setVisionTarget: (title: string | null) => void }} settings
 * @returns {{
 *   getVisionTarget: () => string | null;
 *   onSetVisionTarget: (title: string | null) => void;
 *   visionTargetStatus: () => { title: string | null };
 * }}
 */
export function createVisionTargetHooks(settings) {
  return {
    /** fire-orchestrator の getVisionTarget（対象タイトルの解決関数）。 */
    getVisionTarget: () => settings.getVisionTarget(),
    /** cockpit-server の onSetVisionTarget（POST /api/vision-target が呼ぶ）。 */
    onSetVisionTarget: (title) => {
      try {
        settings.setVisionTarget(title ?? null); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetChannelUrl と同型の失敗寛容）。
      }
    },
    /** cockpit-server の visionTargetStatus（state snapshot に載せる現況）。 */
    visionTargetStatus: () => ({ title: settings.getVisionTarget() })
  };
}

/**
 * 発火が撮る見る窓を、開いている場の体験で選ぶ（Discord モード Domain G・discord-mode.md §4.3 の 7・§9: 見る窓は体験の準備で
 * 選んだもの）。Discord の場（開きかけ・閉じかけを含む）では Discord の準備の見る窓（選んでいなければ null = 画像なしの発火）、
 * それ以外（配信の場・閉じている間）は今まで通り配信の見る窓。fire-orchestrator の getVisionTarget に渡す。
 *
 * @param {{ stream: () => (string | null); discord: () => (string | null); experience: () => (string | null | undefined) }} deps
 * @returns {() => (string | null)}
 */
export function createVenueVisionTarget(deps) {
  return () => {
    /** @type {unknown} */
    let kind = null;
    try {
      kind = deps.experience();
    } catch {
      kind = null;
    }
    if (kind === "discord") {
      try {
        const title = deps.discord();
        return typeof title === "string" && title.length > 0 ? title : null;
      } catch {
        return null;
      }
    }
    return deps.stream();
  };
}
