// @ts-check

/**
 * 文字列の先頭か、画像の順序を保ったまま最初のテキストブロックに指示を足す。
 * @param {string | Array<any>} content
 * @param {string} instruction
 */
export function prependInstruction(content, instruction) {
  if (typeof content === "string") return `${instruction}\n\n${content}`;
  if (!Array.isArray(content)) return content;
  let applied = false;
  const blocks = content.map((block) => {
    if (applied || block?.type !== "text" || typeof block.text !== "string") return block;
    applied = true;
    return { ...block, text: `${instruction}\n\n${block.text}` };
  });
  if (!applied) blocks.push({ type: "text", text: instruction });
  return blocks;
}
