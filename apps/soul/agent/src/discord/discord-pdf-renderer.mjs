// @ts-check
import { runWinRtMaterialScript, WINRT_ASYNC, WINRT_OPEN_INPUT } from "./winrt-materials.mjs";

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_MATERIAL_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 1536;
const TIMEOUT_MS = 8000;
const MAX_OUTPUT_BYTES = Math.ceil(MAX_MATERIAL_IMAGE_BYTES * 4 / 3) + 1024;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// The attachment is passed as bytes over stdin. The WinRT streams and all rendered
// pages live in memory. Only status and bounded PNG data are returned on stdout.
const script = (pageNumber) => String.raw`
$ErrorActionPreference = 'Stop'
$result = @{ status = 'pdf-unreadable'; totalPages = 0; pages = @() }
$inputBytes = $null
$sourceStream = $null
try {
  ${WINRT_ASYNC}
  $pdfType = [Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
  $optionsType = [Windows.Data.Pdf.PdfPageRenderOptions,Windows.Data.Pdf,ContentType=WindowsRuntime]
  $streamType = [Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
  $readerType = [Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
  $encoder = [Windows.Graphics.Imaging.BitmapEncoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
  $asAction = $methods | Where-Object {
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
  }

  ${WINRT_OPEN_INPUT}
  $pdf = Wait-Operation ($pdfType::LoadFromStreamAsync($sourceStream)) $pdfType
  $result.totalPages = [int]$pdf.PageCount
  if ($pdf.IsPasswordProtected -or $result.totalPages -lt 1) { throw 'PDF unavailable' }

  $pages = New-Object 'Collections.Generic.List[string]'
  $outputBytes = 0
  $result.status = 'ok'
  if (${pageNumber} -gt $result.totalPages) { $result.status = 'out-of-range' }
  for ($i = ${pageNumber - 1}; $i -lt ${pageNumber} -and $i -lt $result.totalPages; $i++) {
    $page = $null
    $pngStream = $null
    $reader = $null
    try {
      $page = $pdf.GetPage($i)
      $options = $optionsType::new()
      $edge = [Math]::Max($page.Size.Width, $page.Size.Height)
      if ($edge -le 0) { throw 'invalid page size' }
      $options.DestinationWidth = [uint32][Math]::Max(1, [Math]::Round($page.Size.Width * ${MAX_EDGE} / $edge))
      $options.DestinationHeight = [uint32][Math]::Max(1, [Math]::Round($page.Size.Height * ${MAX_EDGE} / $edge))
      $options.BitmapEncoderId = $encoder::PngEncoderId
      $pngStream = $streamType::new()
      $null = $asAction.Invoke($null, @($page.RenderToStreamAsync($pngStream, $options))).GetAwaiter().GetResult()
      if ($pngStream.Size -gt ${MAX_PAGE_BYTES} -or ($outputBytes + $pngStream.Size) -gt ${MAX_MATERIAL_IMAGE_BYTES}) {
        $result.status = 'limit'
        break
      }
      $reader = $readerType::new($pngStream.GetInputStreamAt(0))
      $size = Wait-Operation ($reader.LoadAsync([uint32]$pngStream.Size)) ([uint32])
      if ($size -ne $pngStream.Size) { throw 'short PNG' }
      $bytes = New-Object byte[] $size
      $reader.ReadBytes($bytes)
      $pages.Add([Convert]::ToBase64String($bytes))
      $outputBytes += $size
    } catch {
      $result.status = 'pdf-unreadable'
      break
    } finally {
      if ($null -ne $reader) { $reader.Dispose() }
      if ($null -ne $pngStream) { $pngStream.Dispose() }
      if ($null -ne $page) { $page.Dispose() }
    }
  }
  $result.pages = $pages.ToArray()
} catch {
  $result.status = 'pdf-unreadable'
} finally {
  if ($null -ne $sourceStream) { $sourceStream.Dispose() }
  if ($null -ne $inputBytes) { $inputBytes.Dispose() }
}
[Console]::WriteLine(($result | ConvertTo-Json -Compress))
`;

/** @param {Buffer} bytes @param {number} pageNumber @param {{signal?: AbortSignal}} [options] */
export async function renderDiscordPdfPage(bytes, pageNumber, { signal } = {}) {
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) {
    return { status: "out-of-range", totalPages: 0, pages: [] };
  }
  if (process.platform !== "win32" || signal?.aborted) return { status: "pdf-unavailable", totalPages: 0, pages: [] };
  if (bytes.length > MAX_ATTACHMENT_BYTES) return { status: "limit", totalPages: 0, pages: [] };
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    return { status: "pdf-unreadable", totalPages: 0, pages: [] };
  }
  const native = await runWinRtMaterialScript(script(pageNumber), bytes, { signal, maxOutputBytes: MAX_OUTPUT_BYTES, timeoutMs: TIMEOUT_MS });
  if ("error" in native) {
    const status = { limit: "limit", timeout: "pdf-timeout", unavailable: "pdf-unavailable",
      "invalid-output": "pdf-unreadable" }[native.error];
    return { status, totalPages: 0, pages: [] };
  }
  const { status, totalPages, pages } = native.value ?? {};
  if (!["ok", "limit", "pdf-unreadable", "pdf-unavailable", "pdf-timeout", "out-of-range"].includes(status) ||
      !Number.isSafeInteger(totalPages) || totalPages < 0 || !Array.isArray(pages) ||
      pages.length > 1) {
    return { status: "pdf-unreadable", totalPages: 0, pages: [] };
  }
  let imageBytes = 0;
  const rendered = [];
  for (const data of pages) {
    if (typeof data !== "string") break;
    const png = Buffer.from(data, "base64");
    imageBytes += png.length;
    if (png.length < 24 || png.length > MAX_PAGE_BYTES || imageBytes > MAX_MATERIAL_IMAGE_BYTES ||
        !png.subarray(0, pngSignature.length).equals(pngSignature)) break;
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE) break;
    rendered.push(png);
  }
  return { status: rendered.length === pages.length ? status : "pdf-unreadable", totalPages, pages: rendered };
}
