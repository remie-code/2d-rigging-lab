export const aiTranscriptTestIds = {
  panel: "aiTranscript.panel",
  empty: "aiTranscript.empty",
  eventList: "aiTranscript.events"
} as const;

export const createAiTranscriptEventRowTestId = (index: number): string =>
  `aiTranscript.event.${index}`;
