export function isStableObservationElement(element: HTMLElement): boolean {
  return element.dataset.testid === "stable-observation";
}

export function hasBracketStableObservationElement(element: HTMLElement): boolean {
  return element.dataset["testid"] !== undefined;
}
