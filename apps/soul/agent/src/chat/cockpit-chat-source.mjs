/**
 * settings の視聴者チャット配信 source（chatSource）を、cockpit-server の口（onSetChatSource/
 * chatSourceStatus）へ橋渡しする（S7「視聴者が混ざる」・Domain C。Channel URL/visionTarget と同型の
 * 薄い配線層）。実チャット器官の生成/Connect/停止ライフサイクルは cockpit-server が所有する
 * （POST /api/chat/connect 駆動・ear-pipeline の流儀）——ここは「Connect した配信 URL を次回起動で
 * 復元するための永続化」だけを担う（token を含まない YouTube 公開 URL/ID）。
 *
 * @param {{ getChatSource: () => string | null; setChatSource: (source: string | null) => void }} settings
 * @returns {{
 *   onSetChatSource: (source: string | null) => void;
 *   chatSourceStatus: () => { source: string | null };
 * }}
 */
export function createChatSourceHooks(settings) {
  return {
    /** cockpit-server の onSetChatSource（POST /api/chat/connect と POST /api/chat/source（欄に入れた値の保存）が呼ぶ）。 */
    onSetChatSource: (source) => {
      try {
        settings.setChatSource(source ?? null); // 次回起動で入力欄に復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は Connect を止めない（onSetVisionTarget と同型の失敗寛容）。
      }
    },
    /** cockpit-server の chatSourceStatus（state snapshot の chat.source に載る記憶済み source）。 */
    chatSourceStatus: () => ({ source: settings.getChatSource() })
  };
}
