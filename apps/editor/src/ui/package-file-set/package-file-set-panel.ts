const operationLogPath = "operations/log.jsonl";

export interface PackageFileSetPanelInput {
  readonly packageFilePaths: readonly string[];
  readonly generatedArtifactPaths?: readonly string[];
}

export const packageFileSetPanelTestId = "package.fileSet.paths";

export const createPackageFileSetPanel = (
  summary: PackageFileSetPanelInput
): HTMLElement => {
  const filePaths = [...summary.packageFilePaths];
  const generatedArtifactPaths = [...(summary.generatedArtifactPaths ?? [])];
  const generatedPathSet = new Set(generatedArtifactPaths);
  const generatedFileCount = filePaths.filter((path) => generatedPathSet.has(path)).length;
  const authoredFileCount = filePaths.length - generatedFileCount;

  const panel = document.createElement("section");
  panel.className = "package-file-set-panel";
  panel.dataset.testid = packageFileSetPanelTestId;
  panel.setAttribute("aria-labelledby", "package-file-set-title");

  const title = document.createElement("h2");
  title.id = "package-file-set-title";
  title.textContent = "Package file set";

  const overview = document.createElement("dl");
  overview.className = "package-file-set-panel__facts";
  appendFact(overview, "Files", String(filePaths.length));
  appendFact(overview, "Authored or log files", String(authoredFileCount));
  appendFact(overview, "Generated evidence files", String(generatedFileCount));
  appendFact(overview, "Operation log", filePaths.includes(operationLogPath) ? operationLogPath : "Absent");

  panel.append(title, overview);
  panel.append(createPathList(filePaths, generatedPathSet));

  return panel;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  list.append(term, description);
};

const createPathList = (
  filePaths: readonly string[],
  generatedPathSet: ReadonlySet<string>
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "package-file-set-panel__paths";

  const title = document.createElement("h3");
  title.textContent = "Paths";
  section.append(title);

  if (filePaths.length === 0) {
    const empty = document.createElement("p");
    empty.className = "package-file-set-panel__empty";
    empty.textContent = "No package files serialized.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "package-file-set-panel__list";

  for (const path of filePaths) {
    const item = document.createElement("li");
    item.className = generatedPathSet.has(path)
      ? "package-file-set-panel__path package-file-set-panel__path--generated"
      : "package-file-set-panel__path";

    const text = document.createElement("span");
    text.textContent = path;
    item.append(text);

    if (generatedPathSet.has(path)) {
      const badge = document.createElement("span");
      badge.className = "package-file-set-panel__badge";
      badge.textContent = "generated";
      item.append(badge);
    }

    list.append(item);
  }

  section.append(list);
  return section;
};
