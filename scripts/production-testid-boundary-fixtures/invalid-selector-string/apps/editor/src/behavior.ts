export function findSubmit(root: ParentNode): Element | null {
  return root.querySelector('[data-testid="submit"]');
}
