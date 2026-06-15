export interface PortableProjectDownloadInput {
  readonly bundleJson: string;
  readonly fileName: string;
}

export const triggerPortableProjectDownload = (
  input: PortableProjectDownloadInput
): boolean => {
  if (
    typeof document === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }

  const blob = new Blob([input.bundleJson], {
    type: "application/json"
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = input.fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  if (typeof anchor.click !== "function") {
    anchor.parentNode?.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
    return false;
  }

  anchor.click();
  anchor.parentNode?.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);

  return true;
};

export const readPortableProjectFileText = async (file: File): Promise<string> => file.text();
