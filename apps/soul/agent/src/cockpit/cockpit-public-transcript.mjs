/** @param {any} entry */
  export const toWireEntry = (entry) => ({
    seq: entry.seq,
    startMs: entry.startMs,
    endMs: entry.endMs,
    text: entry.text,
    appendedAtMs: entry.appendedAtMs,
    speaker: entry.speaker ?? "you", // S3 で会話ログへ昇格（you/soul）。既定は you（S2 挙動不変）。
    // S7「視聴者が混ざる」: viewer コメントの投稿者名（Domain C が `viewer(名前):` を描く材料）。
    // 名前の無い行では null（追加フィールド・既存の購読者は無視）。Discord モード Domain A: soul の行はロールの名前を
    // 正本に持つが、放送には載せない（配信で出ていなかった名前を新たに出さない・ロールが 1 つの間は `soul` のまま）。
    // speakerId（場の中の記録にだけ持つ id）はここで拾わない＝放送に出ない。
    displayName: entry.speaker === "soul" ? null : entry.displayName ?? null,
    ...(entry.speaker === "game" ? {
      startedAt: entry.startedAt,
      lastSeenAt: entry.lastSeenAt,
      closedAt: entry.closedAt,
      displayOrder: entry.displayOrder,
      closeReason: entry.closeReason
    } : {})
  });
