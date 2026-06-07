# Codex / Automation View 画面仕様

> 状態: Draft screen spec。Wave54 Domains A-H `pass` / Domain H verification `pass` により、bounded read-only / status-only skeleton route として到達可能。full view / provider integration は未完了。

## 1. 役割

Codex / Automation Viewは、Codex proposal review、AI approval、AI transcript、structured command surface状態を扱うviewである。

## 2. レイアウト

```text
+--------------------------------------------------------------------------------+
| Codex / Automation                                                              |
+----------------------------+---------------------------------------------------+
| Automation Tools           | Tool Detail                                       |
| - Proposal Review          | pasted proposal / validation / diff / approval   |
| - AI Approval              | dry-run / approve / commit                       |
| - AI Transcript            | command and approval events                      |
| - Command Surface Status   | available structured surfaces                    |
+----------------------------+---------------------------------------------------+
```

## 3. 表示するもの

- Codex Proposal Review
- AI Approval
- AI Transcript
- structured command host availability
- Codex-facing structural parityの状態
- PSD import / structural scaffold command availability: parse / plan / approve / preview / commit / latest result

## 4. 関連機能ID

- `UX-FEAT-030`
- `UX-FEAT-031`
- `UX-FEAT-032`
- `UX-FEAT-037`
- 一部 `UX-FEAT-018`, `UX-FEAT-019`, `UX-FEAT-028`, `UX-FEAT-029`

## 5. 未決事項

- 通常authoring UIの機能として見せるか、Codex/evidence専用viewとして扱うか。
- Codex-facing structural execute/stale parityをこのviewでどのように示すか。
- PSD Import TaskのHuman UIをCodex観測用にverbose化せず、deterministic command / operation APIで同等操作を実行できる状態をどう示すか。
- Wave51ではこのViewの最終UIは未実装。Domain Cはshell surface metadataとして分類し、Domain DはPSD Import Task observationの詳細導線を準備しただけで、Codex / Automation Viewへのpanel migrationやstructural-specific execute/stale parityは後続waveに残る。
- Wave54 A-H では Codex / Automation は bounded read-only / status-only skeleton route として Toolbox から到達可能になった。これは LLM/provider integration、repo-side proposal generation、semantic recognition、auto-rigging、auto-fix、automatic commit、external transport、または full Codex / Automation View 完成ではない。
