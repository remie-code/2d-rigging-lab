export const createExplicitPsdSourceAssetId = (
  file: Pick<File, "name" | "size">
): string =>
  `src_explicit_psd_${sanitizePsdImportIdToken(removeFileExtension(file.name))}_${file.size}`;

export const createPsdSourcePackagePath = (
  source: Pick<File, "name" | "size"> | { readonly fileName: string; readonly byteLength: number }
): string => {
  const fileName = "fileName" in source ? source.fileName : source.name;
  const byteLength = "byteLength" in source ? source.byteLength : source.size;

  return `assets/sources/psd/${sanitizePsdImportIdToken(removeFileExtension(fileName))}_${byteLength}.psd`;
};

export const sanitizePsdImportIdToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "selected_layer";

const removeFileExtension = (fileName: string): string =>
  fileName.replace(/\.[^.\\/]+$/, "");
