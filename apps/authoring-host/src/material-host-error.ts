export class MaterialHostError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MaterialHostError";
  }
}
