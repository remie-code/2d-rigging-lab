import { randomInt } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

function rasterizeToken(token) {
  const powershell = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
$bitmap = [Drawing.Bitmap]::new(600, 220)
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([Drawing.Color]::White)
$graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$font = [Drawing.Font]::new('Consolas', 54, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('${token}', $font, [Drawing.Brushes]::Black, 36, 74)
$memory = [IO.MemoryStream]::new()
$bitmap.Save($memory, [Drawing.Imaging.ImageFormat]::Jpeg)
[Console]::WriteLine([Convert]::ToBase64String($memory.ToArray()))
$memory.Dispose()
$font.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
`;
  return Buffer.from(execFileSync(powershell, [
    "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")
  ], { encoding: "utf8", windowsHide: true }).trim(), "base64");
}

function stream(data, metadata = "", jpeg = false) {
  const compressed = jpeg ? data : deflateSync(data);
  return Buffer.concat([
    Buffer.from(`<< /Length ${compressed.length} /Filter /${jpeg ? "DCTDecode" : "FlateDecode"} ${metadata} >>\nstream\n`),
    compressed,
    Buffer.from("\nendstream")
  ]);
}

// Avoid lookalike glyphs and make the token independent of the request.
const tokenAlphabet = "234579ACEF";

export function makeLocalTaskPdf({ imageOnly = false, page = 4 } = {}) {
  const token = Array.from({ length: 12 }, () => tokenAlphabet[randomInt(tokenAlphabet.length)]).join("");
  const pageIds = Array.from({ length: 5 }, (_, index) => 4 + 2 * index);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count 5 /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>"
  ];
  for (const [index, id] of pageIds.entries()) {
    const target = index + 1 === page;
    const resources = imageOnly ? "/XObject << /Token 14 0 R >>" : "/Font << /F 3 0 R >>";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 220] /Resources << ${resources} >> /Contents ${id + 1} 0 R >>`);
    const contents = imageOnly
      ? target ? "q 600 0 0 220 0 0 cm /Token Do Q" : "0.5 g 32 100 536 20 re f"
      : `BT /F 45 Tf 36 91 Td (${target ? token : "PAGE " + (index + 1)}) Tj ET`;
    objects.push(stream(Buffer.from(contents)));
  }
  if (imageOnly) objects.push(stream(rasterizeToken(token),
    "/Type /XObject /Subtype /Image /Width 600 /Height 220 /ColorSpace /DeviceRGB /BitsPerComponent 8", true));
  const parts = [Buffer.from("%PDF-1.4\n")];
  let offset = parts[0].length;
  const offsets = ["0000000000 65535 f \n"];
  for (const [index, object] of objects.entries()) {
    const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), Buffer.from(object), Buffer.from("\nendobj\n")]);
    offsets.push(String(offset).padStart(10, "0") + " 00000 n \n");
    parts.push(part);
    offset += part.length;
  }
  parts.push(Buffer.from(`xref\n0 ${offsets.length}\n${offsets.join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return { bytes: Buffer.concat(parts), token };
}
