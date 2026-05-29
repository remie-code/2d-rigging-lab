export class EarlyEscapeError extends Error {
  constructor(message) {
    super(message);
    this.name = "EarlyEscapeError";
  }
}

export const earlyEscape = (message) => {
  throw new EarlyEscapeError(message);
};
