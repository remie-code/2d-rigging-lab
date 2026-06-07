export function readStableTestId(element: Element): string | null {
  return element.getAttribute("data-testid");
}
