// @ts-check
/**
 * ui: 操縦席の視覚仕様の CSS。メイン画面は操縦席の作り直し（cockpit-glance-redesign.md・4 枚目の模型
 * tmp/cockpit-mock/cockpit-mock-v4.png）: 上の細い帯・会話（左）+ コメント（右）・下の細い帯。配色の基調は
 * 旧操縦席（cockpit-redesign.md §7・モック承認済み 2026-07-14）のトークンを流用する。準備・設定（ダイアログ）と
 * ログのタブの観測フィードは旧来の意匠のまま。
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
  --compacting: #a597d6;      /* 状態のピルの「圧縮中」（静かな紫・視聴者の紫や LLM の区間より彩度を落とす） */
  /* ── 死活（現 cockpit.html:17-18 を継承）── */
  --up: #57c7a3;
  --down: #ff5d5d;
  /* ── パネル（§7: 角丸 14px）── */
  --radius: 14px;
  /* ── 横目で見る画面（操縦席の作り直し・4 枚目の模型） ── */
  --fg-soft: #b9c0cb;
  --row-line: #1d242d;
  --track: #222a35;
  --gauge: #4cc9e6;
  --amber: #f0b44b;
  --amber-dim: #7a5d2a;
  --amber-bg: rgba(240, 180, 75, 0.08);
  --alert-text: #ff8a84;
  --alert-bg: rgba(255, 93, 93, 0.12);
  --kill-bg: #3b1215;
  --who-streamer: #e9c46a;     /* 会話の話者「配信者」（模型の金色） */
  --viewer-name: #e7eaee;
  --chip: #5fc4e8;             /* 判定の札（応答 / 自発 / 相槌 / 画面を見る + 確率） */
  --range: #3fb4cf;            /* 推論に使った範囲の縦線 */
  --latest-bg: rgba(86, 212, 176, 0.09);
  --linked-bg: rgba(86, 212, 176, 0.05);
  /* 遅延の区間（8 色・凡例と同じ並び） */
  --seg-transcribe: #4cc9e6;
  --seg-judge: #4a8fe7;
  --seg-screen: #d8c35a;
  --seg-llm-first: #a685f2;
  --seg-first-sentence: #ee7cc6;
  --seg-tts: #f2807a;
  --seg-voice: #5fdc9c;
  --seg-other: #5b6573;
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

/* ── 横目で見る画面（操縦席の作り直し・cockpit-glance-redesign.md §3・§8）: 上の細い帯 / 会話（左 約 6 割）+
      コメント（右 約 3.5 割）/ 下の細い帯。縦スクロールなしの 1 画面（1920×1080 基準・横 1280 まで崩さない）。── */
html, body { overflow: hidden; }
.cockpit {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 1200px;
}

/* ── 上の細い帯 ── */
.top-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 52px;
  padding: 8px 22px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.top-bar.killing { background: var(--kill-bg); border-bottom-color: var(--down); }
.top-name { font-size: 16px; font-weight: 700; margin: 0; color: var(--fg); letter-spacing: 0.02em; }
.top-model { color: var(--muted); padding-left: 14px; border-left: 1px solid var(--border); }
.status-pill { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--muted); }
.pill-dot { width: 9px; height: 9px; border-radius: 50%; background: currentColor; }
.status-pill.listening { color: var(--up); }
.status-pill.thinking { color: var(--speaking); }
.status-pill.speaking { color: var(--teal); }
.status-pill.speaking .pill-dot { box-shadow: 0 0 8px var(--teal); }
.status-pill.compacting { color: var(--compacting); }
.kill-status.killed {
  color: #fff;
  background: var(--down);
  border-radius: 6px;
  padding: 2px 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.top-warnings { display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0; overflow: hidden; }
.warn-chip {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  padding: 2px 9px;
  border-radius: 6px;
  border: 1px solid;
}
.warn-chip.warn { color: var(--amber); border-color: var(--amber-dim); background: var(--amber-bg); }
.warn-chip.alert { color: var(--alert-text); border-color: var(--down); background: var(--alert-bg); font-weight: 600; }
.warn-chip.more { color: var(--muted); border-color: var(--border); flex: 0 0 auto; }
.top-right { display: flex; align-items: center; gap: 20px; margin-left: auto; flex: 0 0 auto; }
.kill-error { font-size: 12px; }
.gauge { display: inline-flex; align-items: center; gap: 9px; font-size: 12px; color: var(--fg); }
.gauge-track { width: 112px; height: 8px; border-radius: 4px; background: var(--track); overflow: hidden; }
.gauge-fill { display: block; height: 100%; background: var(--gauge); }
.gauge.low { color: var(--amber); }
.gauge.low .gauge-fill { background: var(--amber); }
.gauge.critical { color: var(--alert-text); font-weight: 600; }
.gauge.critical .gauge-fill { background: var(--down); }
.gauge.unknown { color: var(--muted); }
.top-bar .kill-switch {
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--down);
  background: transparent;
  border: 1px solid var(--down);
  border-radius: 6px;
  padding: 4px 14px;
  cursor: pointer;
}
.top-bar .kill-switch:hover { background: var(--alert-bg); }
.top-bar .kill-switch.killed { color: var(--down); background: #fff; border-color: #fff; }

/* ── 本体（会話 + コメント） ── */
.glance-main {
  display: grid;
  grid-template-columns: minmax(0, 60fr) minmax(0, 36fr);
  min-height: 0;
  padding: 0 22px;
  column-gap: 0;
}
.glance-panel { display: flex; flex-direction: column; min-height: 0; padding: 14px 18px 10px 0; }
.comments-panel { padding: 14px 0 10px 22px; border-left: 1px solid var(--border); }
.panel-title { font-size: 14px; font-weight: 700; margin: 0 0 8px; color: var(--fg); }

/* 会話: 最新が下。入らない古い行は上で切る（スクロールしない・上端は淡く消す）。 */
.convo-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 32px);
  mask-image: linear-gradient(to bottom, transparent 0, #000 32px);
}
.convo-row {
  flex: 0 0 auto;
  position: relative;
  display: grid;
  grid-template-columns: 16px 84px 104px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 8px;
  min-height: 42px;
  padding: 5px 10px 5px 0;
  border-bottom: 1px solid var(--row-line);
  font-size: 14px;
}
.convo-row > .time { grid-column: 2; color: var(--muted); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.convo-row > .who { grid-column: 3; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.convo-row.you > .who { color: var(--who-streamer); }
.convo-row.soul > .who { color: var(--teal); }
.convo-row > .text { grid-column: 4; min-width: 0; display: flex; align-items: baseline; gap: 14px; }
.convo-row .body {
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.react-tag { flex: 0 0 auto; color: var(--muted); font-size: 12px; white-space: nowrap; }
.kind-tag {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 6px;
}
.convo-row > .side { grid-column: 5; display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.judge-chip { color: var(--chip); font-size: 13px; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* 相槌の間隔で流れた判定の薄い 1 行 */
.convo-row.note { min-height: 30px; color: var(--ghost); font-size: 12px; }
.convo-row.note > .text { color: var(--ghost); }
/* 最新の返事の行と、そのきっかけの配信者の行（同じ色で淡くつなぐ） */
.convo-row.latest { background: var(--latest-bg); }
.convo-row.linked { background: var(--linked-bg); }
/* 推論に使った範囲: 行の左端につながった細い縦線 + 範囲の始まりの上に極小の見出し */
.convo-row.in-range::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 0;
  bottom: -1px;
  width: 2px;
  background: var(--range);
}
.convo-row.range-start::before { top: 0; }
.convo-row.range-end::before { bottom: 6px; }
.range-label { flex: 0 0 auto; font-size: 11px; color: var(--range); padding: 8px 0 2px 0; letter-spacing: 0.04em; }

/* 遅延の棒: 長さ固定・中の区間は比（8 色）・合計の数字（4 秒超琥珀・6 秒超赤） */
.lat { display: inline-flex; align-items: center; gap: 10px; }
.lat-bar { display: flex; width: 132px; height: 9px; border-radius: 2px; overflow: hidden; background: var(--track); }
.lat-seg { display: block; height: 100%; }
.lat-seg + .lat-seg { border-left: 2px solid var(--bg); }
.lat-total { min-width: 52px; text-align: right; font-size: 13px; color: var(--fg); font-variant-numeric: tabular-nums; white-space: nowrap; }
.lat-total.warn { color: var(--amber); font-weight: 600; }
.lat-total.alert { color: var(--down); font-weight: 700; }
.seg-transcribe { background: var(--seg-transcribe); }
.seg-judge { background: var(--seg-judge); }
.seg-screen { background: var(--seg-screen); }
.seg-llm-first { background: var(--seg-llm-first); }
.seg-first-sentence { background: var(--seg-first-sentence); }
.seg-tts { background: var(--seg-tts); }
.seg-voice { background: var(--seg-voice); }
.seg-other { background: var(--seg-other); }

/* 配信前（場が閉じている間・配信の組み直し Domain D）: 会話の場所の中央に大きく「配信を始める」と横に「準備・設定」。
   始められなかった理由と、閉じかけの「記録中…」もここ。 */
.prestream { flex: 1 1 auto; display: grid; place-items: center; }
.prestream-box { display: flex; flex-direction: column; align-items: center; gap: 14px; max-width: 640px; padding: 0 16px; }
.prestream-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center; }
.prestream-start {
  font: inherit;
  font-size: 20px;
  font-weight: 600;
  color: var(--teal);
  background: var(--latest-bg);
  border: 1px solid var(--teal);
  border-radius: var(--radius);
  padding: 22px 48px;
  cursor: pointer;
}
.prestream-start:hover { background: var(--linked-bg); }
.prestream-start:disabled { opacity: 0.6; cursor: default; }
.prestream-open {
  font: inherit;
  font-size: 15px;
  color: var(--fg-soft);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 24px;
  cursor: pointer;
}
.prestream-open:hover { border-color: var(--teal); color: var(--teal); }
.prestream-note { margin: 0; color: var(--amber); font-size: 14px; }
.prestream-error {
  margin: 0;
  color: var(--alert-text);
  background: var(--alert-bg);
  border: 1px solid var(--down);
  border-radius: var(--radius);
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.5;
  white-space: normal;
}

/* コメント: 新しいものが上。入らない古い行は下で切る（下端は淡く消す）。 */
.comments-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  -webkit-mask-image: linear-gradient(to top, transparent 0, #000 32px);
  mask-image: linear-gradient(to top, transparent 0, #000 32px);
}
.comment-row {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
  min-height: 44px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--row-line);
  font-size: 14px;
}
.comment-row .name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--viewer-name); }
.comment-row .text { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.comment-row.reacted { background: var(--latest-bg); }
.react-mark { color: var(--teal); font-size: 12px; white-space: nowrap; }
.comment-row.rejected { display: flex; min-height: 34px; opacity: 0.8; }
.reject-chip { color: var(--alert-text); font-size: 12px; }

/* ── 下の細い帯（薄い文字） ── */
.bottom-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 44px;
  padding: 6px 22px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.drive-summary { display: flex; align-items: center; flex: 0 1 auto; min-width: 0; overflow: hidden; }
.drive-item .sep { margin: 0 10px; opacity: 0.6; }
.drive-value { color: var(--fg-soft); }
.lat-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-left: auto;
  padding-left: 18px;
  border-left: 1px solid var(--border);
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
}
.legend-item { display: inline-flex; align-items: center; gap: 5px; }
.legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
.bottom-bar .settings-toggle {
  flex: 0 0 auto;
  color: var(--fg-soft);
  background: transparent;
  border: 1px solid transparent;
  border-left: 1px solid var(--border);
  border-radius: 0;
  padding: 4px 0 4px 18px;
  font-size: 12px;
}
.bottom-bar .settings-toggle:hover { color: var(--teal); }
/* 配信の組み直し Domain D: 「配信を終える」（場が開いている間だけ・小さく・2 回押し。1 回目で armed = 赤みの枠） */
.bottom-bar .stream-end {
  flex: 0 0 auto;
  font: inherit;
  font-size: 12px;
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 3px 10px;
  cursor: pointer;
}
.bottom-bar .stream-end:hover { color: var(--fg-soft); }
.bottom-bar .stream-end.armed { color: var(--alert-text); border-color: var(--down); background: var(--alert-bg); }
/* 横 1280 程度まで: 帯の文字と間隔を詰める */
@media (max-width: 1500px) {
  .top-bar, .bottom-bar { gap: 10px; padding-left: 14px; padding-right: 14px; }
  .lat-legend { gap: 9px; padding-left: 10px; }
  .drive-item .sep { margin: 0 6px; }
  .top-right { gap: 12px; }
  .gauge-track { width: 80px; }
  .glance-main { padding: 0 14px; }
  .convo-row { grid-template-columns: 14px 76px 92px minmax(0, 1fr) auto; }
  .lat-bar { width: 110px; }
}

/* ── 準備・設定の「ログ」タブ（今の観測フィード + 旧ヘッダの一目の健康） ── */
.log-section .feed-panel { height: 62vh; }
.health-line {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 0 10px;
  color: var(--muted);
  font-size: 12px;
  flex-wrap: wrap;
}
/* 起動時の知らせ（配信の組み直し Domain A: ロールへの引っ越しの結果・ログのタブの上）。 */
.startup-notices { padding: 0 0 10px; color: var(--muted); font-size: 12px; }
.startup-notice { margin: 0 0 2px; }

/* ── 一目の健康（ログのタブ）・死活の色 ── */
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); display: inline-block; }
.dot.on { background: var(--up); box-shadow: 0 0 8px var(--up); } /* 発光ドット（§7） */
.dot.off { background: var(--muted); }
.ears { display: flex; align-items: center; gap: 8px; }
.ears-status { color: var(--muted); }
.health { display: flex; align-items: center; gap: 14px; color: var(--muted); font-size: 12px; }
.hstat { color: var(--muted); }
.hstat.up { color: var(--up); }
.hstat.down { color: var(--down); font-weight: bold; }
.hstat.unknown { color: var(--muted); }
.hstat.connecting { color: var(--speaking); }
.hstat.reconnecting { color: var(--speaking); font-weight: bold; } /* 文字起こしの繋ぎ直し中（黄色） */
.mic-in { color: var(--muted); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
/* speak-now の判定行（「判定: 自発 0.45」・speak-now 合意 §5）。小さく淡く。 */
.row.judgment-marker, .row.judgment-marker .who, .row.judgment-marker .text { color: var(--muted); font-size: 12px; }
.row.recall-marker, .row.recall-marker .who, .row.recall-marker .text { color: var(--marker-self); font-size: 12px; }

/* ── 準備・設定の「運転」タブ（旧運転バーの部品・cockpit-glance-redesign.md §5・§9.2）── */
.drive-panel { padding: 2px 0; }
.drive-row { gap: 12px; }
/* 引き出し共通のボタン意匠（現 cockpit.html:75-80 の意味論を新トークンで継承）。 */
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
.settings-drawer button:hover:not(:disabled),
.cockpit-settings-modal button:hover:not(:disabled) { border-color: var(--teal); }
.settings-drawer button:disabled,
.cockpit-settings-modal button:disabled { opacity: 0.45; cursor: default; }
/* Fire = 黄（現 cockpit.html:86 #btn-fire）・Fire+視覚 = 淡青（現 :96 #btn-vision-fire）を継承。 */
.drive-panel .btn-fire { color: var(--marker-fire); font-weight: 600; letter-spacing: 0.04em; }
.drive-panel .btn-vision-fire { color: var(--marker-vision); font-weight: 600; letter-spacing: 0.04em; }
/* soul busy 表示 + fire-note（現 cockpit.html:87-90 の意味論を継承）。 */
.soul-note { color: var(--muted); font-size: 12px; }
.soul-state { color: var(--muted); }
.soul-state.thinking { color: var(--speaking); }
.soul-state.speaking { color: var(--speaking); font-weight: bold; }
.fire-note { color: var(--muted); font-size: 12px; }
.control-error { font-size: 12px; }
/* 自発トグル pill（on = 緑は現 :100-101 継承）。 */
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
/* barge-in（かぶり）トグル pill（self-fire pill の写経）。 */
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
/* Codex の fast トグル pill（設定「頭脳・会話」タブ・barge-in pill の写経）。 */
.codex-fast-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-raised);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 5px 14px;
}
.codex-fast-toggle { accent-color: var(--teal); }
.codex-fast-status { color: var(--muted); font-size: 12px; }
.codex-fast-status.on { color: var(--up); }
/* 口数・話し始め・忙しい間のコメントのプルダウン。 */
.verbosity { display: flex; align-items: center; gap: 8px; }
.drawer-row .verbosity .pill-label { flex: 0 0 auto; }
.verbosity-select {
  background-color: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 26px 5px 10px;
  font: inherit;
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
/* 同じ区画の中の 2 つ目の見出し（頭脳・会話の「会話の圧縮」）。 */
.drawer-section h3.drawer-subhead { margin-top: 14px; }
.drawer-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 4px 0; }
.drawer-row > label:not([class]) { flex: 0 0 9em; color: var(--muted); } /* ラベル幅揃え（§7）。 */
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
.conversation-instruction-soul-skills { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 10px; }
.conversation-instruction-soul-skill-note { color: var(--muted); font-size: 12px; margin: 0 0 6px; }
.conversation-instruction-soul-skill-body {
  margin: 0; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
  white-space: pre-wrap; word-break: break-word; font-size: 12px; max-height: 220px; overflow: auto;
}
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
