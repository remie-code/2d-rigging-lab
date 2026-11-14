export const SPEECH_INTENT_WORD = "intent";

// A recognized but broken control marker is consumed without speaking its contents.
export function scanSpeechIntentTag(input, start, final = true) {
  let wordStart = start + 1;
  while (input[wordStart] === " " || input[wordStart] === "\t") wordStart += 1;
  // The streaming model can insert an extraneous Unicode character before the
  // reserved word. Recognize this as broken control syntax without assigning an intent.
  const stray = input.codePointAt(wordStart);
  if (stray > 0x7f) wordStart += stray > 0xffff ? 2 : 1;
  const prefix = input.slice(wordStart, wordStart + SPEECH_INTENT_WORD.length);
  if (!SPEECH_INTENT_WORD.startsWith(prefix)) return null;
  if (final && prefix.length === 0) return null;
  const bodyStart = wordStart + SPEECH_INTENT_WORD.length;
  const next = input[bodyStart];
  if (next === undefined) return final
    ? { kind: "broken", end: input.length }
    : { kind: "incomplete" };
  if (next !== ">" && !/\s/.test(next)) return null;
  let end = bodyStart;
  while (end < input.length && !/[<>\r\n]/.test(input[end])) end += 1;
  if (input[end] === ">") {
    if (wordStart !== start + 1) return { kind: "broken", end: end + 1 };
    return { kind: "tag", end: end + 1, intent: input.slice(bodyStart, end).trim() || null };
  }
  if (end === input.length && !final) return { kind: "incomplete" };
  return { kind: "broken", end };
}
