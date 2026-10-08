// @ts-check
/**
 * ui: 操縦席の視覚仕様（cockpit-redesign.md §7・モック承認済み 2026-07-14）の CSS。
 *
 * 置き場の裁定（Domain B・タスク B-3 の推奨 (a) を採用）: CSS 文字列を .mjs で export し、
 * mount 時に <style> 要素として注入する。根拠: ソース=実行物（配信される .mjs がそのまま
 * スタイルの正本）・静的配信は .mjs のみで完結（.css 用の配信ルート追加が不要）・Domain D の
 * cockpit.html 書き換えが inline module エントリだけの薄い形で済む。
 * 自己完結（外部フォント/CDN 禁止）・ビルド段ゼロ。
 *
 * トークン（§7 配色・モック承認値）:
 *  - 基調: ダーク・こーでぃーの teal(#56d4b0 系) をアイデンティティ色に。
 *  - 話者: you=青 #7fb3ff / soul=teal #56d4b0 / viewer=紫 #c99be8。
 *  - 行種: 自発マーカー=淡 teal / barge-in=赤 #e0928f / 演出行=緑 / ゴースト行=グレー斜体。
 *  - §7 に指定のない色（speaking 行の黄・発火マーカーの黄・視覚マーカーの淡青・死活の赤緑）は
 *    現 cockpit.html の意味論（cockpit.html:19 --speaking / :123 fire-marker / :130 vision-marker /
 *    :17-18 --down/--up）を引き継ぐ。
 *  - 角丸 14px のパネル・時刻は mono 小・演出はサブ行インデント（§7）。
 *
 * このモジュールはトップレベル副作用ゼロ（文字列定義のみ）。document へ触るのは
 * injectStyles(doc) が呼ばれた時だけ（Node からの import が安全に通る＝スモークテスト対象）。
 */

/** 注入する <style> 要素の id（二重注入防止・再 mount 冪等）。 */
export const COCKPIT_STYLE_ID = "cockpit-styles";

/** 操縦席全体の CSS（§7 視覚仕様の実装・カスタムプロパティ手書き・フレームワークなし）。 */
export const COCKPIT_CSS = `
:root {
  color-scheme: dark;
  /* ── 基調（ダーク・teal アイデンティティ）── */
  --bg: #0e1114;
  --panel: #161a20;
  --panel-raised: #1b2028;
  --border: #262d37;
  --fg: #e7eaee;
  --muted: #8b93a1;
  --teal: #56d4b0;
  /* ── 話者色（§7 承認値）── */
  --speaker-you: #7fb3ff;
  --speaker-soul: #56d4b0;
  --speaker-viewer: #c99be8;
  --viewer-text: #e9dcf2;
  /* ── 行種色（§7 承認値 + 現 cockpit.html 継承）── */
  --marker-self: #9fe3cd;     /* 自発マーカー = 淡 teal（§7） */
  --marker-barge: #e0928f;    /* barge-in = 赤（§7） */
  --marker-expr: #86d98b;     /* 演出行 = 緑（§7） */
  --ghost: #7d8695;           /* ゴースト行 = グレー斜体（§7） */
  --marker-fire: #f0c14b;     /* 発火マーカー（現 cockpit.html:123 の黄を継承） */
  --marker-vision: #8fb7ff;   /* 視覚マーカー（現 cockpit.html:130 の淡青を継承） */
  --speaking: #f0c14b;        /* speaking 行（現 cockpit.html:19 を継承） */
  /* ── 死活（現 cockpit.html:17-18 を継承）── */
  --up: #57c7a3;
  --down: #ff5d5d;
  /* ── パネル（§7: 角丸 14px）── */
  --radius: 14px;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font: 14px/1.5 system-ui, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  background: var(--bg);
  color: var(--fg);
}
#app { height: 100%; }

/* ── 三層レイアウト: ヘッダ（固定）/ 観測フィード（主役・伸縮）/ 運転バー（常駐・Domain C）── */
.cockpit {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

/* ── ヘッダ（§7: 名前 + Listening ランプ + 一目の健康 + 右端 ⚙）── */
.cockpit-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 16px;
}
.cockpit-header h1 {
  font-size: 16px;
  margin: 0;
  color: var(--teal);
  letter-spacing: 0.03em;
  font-weight: 600;
}
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); display: inline-block; }
.dot.on { background: var(--up); box-shadow: 0 0 8px var(--up); } /* 発光ドット（§7） */
.dot.off { background: var(--muted); }
.ears { display: flex; align-items: center; gap: 8px; }
.ears-status { color: var(--muted); }
.health { display: flex; align-items: center; gap: 14px; color: var(--muted); font-size: 12px; margin-left: auto; }
.hstat { color: var(--muted); }
.hstat.up { color: var(--up); }
.hstat.down { color: var(--down); font-weight: bold; }
.hstat.unknown { color: var(--muted); }
.voice-out { color: var(--muted); }
.settings-toggle {
  background: var(--panel-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  cursor: pointer;
  line-height: 1;
}
.settings-toggle:hover { border-color: var(--teal); }

/* ── 観測フィード（主役・§7: 角丸 14px パネル・自動スクロール）── */
.feed-panel {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.feed-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 14px;
}
/* usage / discarded / uptime（観測層のメタ計器・パネル下端の控えめな 1 行） */
.feed-meta {
  flex: 0 0 auto;
  display: flex;
  gap: 18px;
  padding: 6px 14px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
}
.feed-meta .usage-note { flex: 1 1 auto; }
/* 「最新へ↓」（自動スクロール停止中のみ表示・モック §2） */
.jump-to-latest {
  position: absolute;
  right: 16px;
  bottom: 42px;
  background: var(--panel-raised);
  color: var(--teal);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 14px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}
.jump-to-latest:hover { border-color: var(--teal); }

/* ── 行（§7: 時刻 mono 小・話者ラベル色分け）── */
.row { display: flex; gap: 10px; padding: 3px 2px; align-items: baseline; white-space: pre-wrap; }
.row .time {
  color: var(--muted);
  flex: 0 0 auto;
  font: 11px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  min-width: 5.5em;
}
.row .who { color: var(--teal); flex: 0 0 auto; min-width: 3.5em; }
.row .text { flex: 1 1 auto; }
.row .lat { color: var(--muted); flex: 0 0 auto; font-size: 11px; }
.row .marker { flex: 0 0 auto; }
/* 話者色分け（§7 承認値） */
.row.speaker-you .who { color: var(--speaker-you); }
.row.speaker-soul .who { color: var(--speaker-soul); }
.row.speaker-viewer .who { color: var(--speaker-viewer); }
.row.speaker-viewer .text { color: var(--viewer-text); }
/* speaking 行（VAD 連動・出現消滅） */
.row.speaking .text { color: var(--speaking); font-style: italic; }
/* ゴースト行（§7: グレー斜体） */
.row.ghost .who { color: var(--ghost); }
.row.ghost .text { color: var(--ghost); font-style: italic; }
/* 発火マーカー行 */
.row.fire-marker, .row.fire-marker .who, .row.fire-marker .text { color: var(--marker-fire); }
/* 演出行（§7: 緑・サブ行 = インデント + arrow-back-up） */
.row.expression { padding-left: 1.5em; }
.row.expression .sub-arrow { color: var(--marker-expr); flex: 0 0 auto; }
.row.expression, .row.expression .who, .row.expression .text { color: var(--marker-expr); }
/* 視覚マーカー行（§7: 小サムネ枠 + "saw title (WxH)"） */
.row.vision-marker, .row.vision-marker .who, .row.vision-marker .text { color: var(--marker-vision); }
.vision-thumb {
  max-height: 54px;
  max-width: 96px;
  border-radius: 4px;
  border: 1px solid var(--border);
  margin-left: 6px;
  vertical-align: middle;
  align-self: center;
}
/* barge-in マーカー行（§7: 赤・"interrupted (X/Y字, Nms)"） */
.row.barge-in-marker, .row.barge-in-marker .who, .row.barge-in-marker .text { color: var(--marker-barge); }
/* 自発マーカー行（§7: 淡 teal） */
.row.self-fire-marker, .row.self-fire-marker .who, .row.self-fire-marker .text { color: var(--marker-self); }

/* ── 運転バー（Domain C・§7: 常駐・左 = Fire/Fire+視覚・右 = 自発 pill・口数・KILL 赤枠）── */
.control-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
}
.control-bar-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.control-bar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
/* 運転バー/引き出し共通のボタン意匠（現 cockpit.html:75-80 の意味論を新トークンで継承）。 */
.control-bar button,
.settings-drawer button,
.cockpit-settings-modal button {
  background: var(--panel-raised);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 14px;
  font: inherit;
  cursor: pointer;
}
.control-bar button:hover:not(:disabled),
.settings-drawer button:hover:not(:disabled),
.cockpit-settings-modal button:hover:not(:disabled) { border-color: var(--teal); }
.control-bar button:disabled,
.settings-drawer button:disabled,
.cockpit-settings-modal button:disabled { opacity: 0.45; cursor: default; }
/* Fire = 黄（現 cockpit.html:86 #btn-fire）・Fire+視覚 = 淡青（現 :96 #btn-vision-fire）を継承。 */
.control-bar .btn-fire { color: var(--marker-fire); font-weight: 600; letter-spacing: 0.04em; }
.control-bar .btn-vision-fire { color: var(--marker-vision); font-weight: 600; letter-spacing: 0.04em; }
/* soul busy 表示 + fire-note（現 cockpit.html:87-90 の意味論を継承）。 */
.soul-note { color: var(--muted); font-size: 12px; }
.soul-state { color: var(--muted); }
.soul-state.thinking { color: var(--speaking); }
.soul-state.speaking { color: var(--speaking); font-weight: bold; }
.fire-note { color: var(--muted); font-size: 12px; }
.control-error { font-size: 12px; }
/* 自発トグル pill（§7: 右側の pill・on = 緑は現 :100-101 継承）。 */
.self-fire-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-raised);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 14px;
}
.pill-label { color: var(--muted); font-size: 12px; }
.self-fire-toggle { accent-color: var(--teal); }
.self-fire-status { color: var(--muted); font-size: 12px; }
.self-fire-status.on { color: var(--up); }
/* barge-in トグル pill（「朗読と合いの手」・self-fire pill の写経・既定 ON は server 側 born-disabled）。 */
.barge-in-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-raised);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 14px;
}
.barge-in-toggle { accent-color: var(--teal); }
.barge-in-status { color: var(--muted); font-size: 12px; }
.barge-in-status.on { color: var(--up); }
/* 口数モード（プルダウンの場所のみ・実配線は s6-followup §12 の将来課題）。 */
.verbosity { display: flex; align-items: center; gap: 8px; }
.verbosity-select {
  background-color: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 26px 5px 10px;
  font: inherit;
}
/* KILL（§7: 赤枠・S8 実装済み）。killed 中はボタン自体を反転表示 + バー全体（.control-bar.killing）に
   赤いアクセントを付けて視覚的に「殺し中」と分かるようにする（人間ゲート要求）。 */
.control-bar .kill-switch {
  color: var(--down);
  border-color: var(--down);
  font-weight: 600;
  letter-spacing: 0.06em;
}
.control-bar .kill-switch.killed {
  background: var(--down);
  color: var(--panel);
}
.kill-switch-wrap { display: flex; align-items: center; gap: 8px; }
.kill-status { font-size: 12px; color: var(--down); font-weight: 600; }
.control-bar.killing {
  border-color: var(--down);
  box-shadow: 0 0 0 1px var(--down) inset;
}

/* ── 設定引き出し（Domain C・§7: 区画見出し・ラベル幅揃え・chevron select・色ドット・
      角丸 14px パネル・普段は畳む = ⚙ で .open）── */
.settings-drawer { display: none; }
.settings-drawer.open {
  display: block;
  flex: 0 0 auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
  max-height: 46vh;
  overflow-y: auto;
}
.drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.drawer-head h2 {
  font-size: 13px;
  margin: 0;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.drawer-close { line-height: 1; }
.drawer-section { padding: 8px 0; }
.drawer-section + .drawer-section { border-top: 1px solid var(--border); }
.drawer-section h3 { font-size: 12px; margin: 0 0 8px; color: var(--teal); letter-spacing: 0.06em; }
.drawer-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 4px 0; }
.drawer-row label { flex: 0 0 9em; color: var(--muted); } /* ラベル幅揃え（§7）。 */
/* 状態/エラーの補助行（ラベル幅ぶんインデントして入力列に揃える）。 */
.drawer-note {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 0 0 6px calc(9em + 10px);
  font-size: 12px;
  flex-wrap: wrap;
}
.settings-drawer input[type="text"],
.cockpit-settings-modal input[type="text"] {
  flex: 1 1 280px;
  min-width: 240px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
}
.drawer-select {
  min-width: 240px;
  background-color: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 26px 6px 10px;
  font: inherit;
}
/* select は chevron 付き（§7）。矢印は自己完結の data URI（色は --muted の値 #8b93a1 の複写・
   url() 内では var() が使えないため）。 */
.drawer-select,
.verbosity-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238b93a1' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
/* 状態は色ドット + 文言（§7）。色クラスは現 cockpit.html の意味論を継承（:56-67）。 */
.drawer-status { color: var(--muted); }
.drawer-status::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 6px;
}
.channel-status.connected { color: var(--up); }
.channel-status.error { color: var(--down); }
.channel-status.connecting { color: var(--speaking); }
.chat-status.live { color: var(--up); }
.chat-status.connecting { color: var(--speaking); }
.chat-status.retrying { color: var(--speaking); }
.chat-status.dead { color: var(--down); }
/* ボタンの意味色（現 cockpit.html:68-69 :81-82 を継承）。 */
.settings-drawer .btn-chat-connect, .cockpit-settings-modal .btn-chat-connect { color: var(--up); }
.settings-drawer .btn-chat-disconnect, .cockpit-settings-modal .btn-chat-disconnect { color: var(--down); }
.settings-drawer .btn-start, .cockpit-settings-modal .btn-start { color: var(--up); }
.settings-drawer .btn-stop, .cockpit-settings-modal .btn-stop { color: var(--down); }
.audio-device-status, .vision-target-status { color: var(--muted); }
/* エラー欄（現 cockpit.html:83 .err の意味論を継承・各区画に配置）。 */
.err { color: var(--down); }

/* Cockpit Settings modal shell. Existing drawer control classes remain as
   aliases so migrated controls retain their visual and endpoint behaviour. */
.cockpit-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 5vh 4vw;
  background: rgba(5, 8, 12, 0.72);
}
.cockpit-settings-backdrop[hidden] { display: none; }
.cockpit-settings-modal {
  width: min(980px, 94vw);
  max-height: 90vh;
  overflow: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 18px 70px rgba(0, 0, 0, 0.52);
  padding: 16px 20px;
}
.cockpit-settings-modal[hidden] { display: none; }
.cockpit-settings-head { margin-bottom: 12px; }
.cockpit-settings-head h2 { color: var(--fg); text-transform: none; letter-spacing: 0; font-size: 17px; }
.cockpit-settings-close { margin-left: auto; }
.cockpit-settings-tabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 8px; }
.cockpit-settings-tab[aria-selected="true"] { color: var(--teal); border-color: var(--teal); }
.cockpit-settings-tab:focus-visible, .cockpit-settings-close:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
.cockpit-settings-dirty-warning { display: flex; align-items: center; gap: 8px; padding: 8px 0; color: var(--speaking); }
.cockpit-settings-dirty-warning span { margin-right: auto; }
.cockpit-settings-prompt-slot { border-top: 1px solid var(--border); margin-top: 8px; }
.cockpit-settings-advanced { color: var(--muted); }
/* Conversation-instruction editor (Domain C). Status always has text; the
   class is an additional cue and is never the sole indication of state. */
.conversation-instruction-editor { padding: 8px 0; }
.conversation-instruction-editor-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.conversation-instruction-editor-head h3 { margin: 0; color: var(--teal); }
.conversation-instruction-back { margin-right: auto; }
.conversation-instruction-selection { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.conversation-instruction-selection label { color: var(--muted); }
.conversation-instruction-selection select {
  min-width: 240px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 26px 6px 10px;
  font: inherit;
}
.conversation-instruction-technical-label,
.conversation-instruction-readonly-note,
.conversation-instruction-revision { color: var(--muted); font-size: 12px; }
.conversation-instruction-managed {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
  margin: 12px 0 6px;
}
.conversation-instruction-managed > div { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
.conversation-instruction-managed dt { color: var(--muted); font-size: 11px; }
.conversation-instruction-managed dd { margin: 4px 0 0; }
.conversation-instruction-editor > label { display: block; color: var(--muted); margin-top: 12px; }
.conversation-instruction-editor textarea {
  display: block;
  width: 100%;
  min-height: 180px;
  box-sizing: border-box;
  resize: vertical;
  margin-top: 6px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  font: inherit;
  line-height: 1.5;
}
.conversation-instruction-status { margin-top: 8px; min-height: 1.4em; font-size: 12px; }
.conversation-instruction-status.error { color: var(--down); }
.conversation-instruction-status.saved,
.conversation-instruction-status.default { color: var(--up); }
.conversation-instruction-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
`;

/**
 * COCKPIT_CSS を <style id=${COCKPIT_STYLE_ID}> として document へ注入する（冪等）。
 * mount（app.mjs）だけが呼ぶ。doc が falsy なら何もしない。
 * @param {Document | null | undefined} doc
 */
export function injectStyles(doc) {
  if (!doc || doc.getElementById(COCKPIT_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = COCKPIT_STYLE_ID;
  style.textContent = COCKPIT_CSS;
  (doc.head || doc.documentElement).appendChild(style);
}
