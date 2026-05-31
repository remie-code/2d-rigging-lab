# Wave 20 PSD Sample Characterization

> Target: `wave20-psd-spec-field-matrix-and-sample-characterization`
> Status: Domain A artifact
> Scope: safe file metadata, fixed PSD header bytes, and top-level length fields only.

## Provenance

`test_data/sample_model.psd` is a user-provided rights-cleared sample for this repository's verification work.

This artifact records only facts that can be obtained without a PSD parser dependency, raster extraction, Photoshop-compatible rendering, or copying the PSD.

## Measured File Facts

| Field | Value |
|---|---|
| Repository path | `test_data/sample_model.psd` |
| File size | `22,406,225` bytes |
| SHA-256 | `44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5` |

## Safe Header Facts

These facts come from the fixed 26-byte PSD header.

| Header field | Value | Interpretation |
|---|---:|---|
| Signature | `8BPS` | PSD/PSB signature |
| Version | `1` | PSD, not PSB |
| Reserved bytes | `000000000000` | All reserved bytes are zero |
| Channel count | `4` | Count only; no channel content was read |
| Height | `3072` | Canvas/header height in pixels |
| Width | `2048` | Canvas/header width in pixels |
| Depth | `8` | Bits per channel |
| Color mode | `3` | RGB |

## Safe Top-Level Length / Offset Facts

These facts were computed by reading only the top-level length fields defined by the PSD file structure. No bytes inside the final Image Data Section were read or interpreted.

| Section / field | Offset / length |
|---|---:|
| Header start | `0` |
| Header length | `26` |
| Color Mode Data length field offset | `26` |
| Color Mode Data start | `30` |
| Color Mode Data length | `0` bytes |
| Image Resources length field offset | `30` |
| Image Resources start | `34` |
| Image Resources length | `9,214` bytes |
| Layer and Mask Info length field offset | `9,248` |
| Layer and Mask Info start | `9,252` |
| Layer and Mask Info length | `18,199,362` bytes |
| Image Data start | `18,208,614` |
| Remaining bytes from Image Data start | `4,197,611` bytes, derived as `fileSizeBytes - imageDataStart` |

The nonzero Layer and Mask Info length only proves that the top-level section length is nonzero. It does not prove a layer count, layer tree, layer names, masks, or any specific Photoshop feature.

## Commands / Methods Used

File size:

```powershell
Get-Item test_data\sample_model.psd | Select-Object FullName,Length,LastWriteTime
```

Checksum:

```powershell
Get-FileHash -Algorithm SHA256 test_data\sample_model.psd | Select-Object Algorithm,Hash,Path
```

Header and top-level length fields:

```powershell
$path = 'test_data\sample_model.psd'
$resolved = Resolve-Path $path
$fs = [System.IO.File]::OpenRead($resolved)
try {
  $br = [System.IO.BinaryReader]::new($fs)
  function Read-UInt16BE($reader) {
    $b = $reader.ReadBytes(2)
    if ($b.Length -ne 2) { throw 'Unexpected EOF while reading UInt16BE' }
    return [uint16]((([uint16]$b[0]) -shl 8) -bor ([uint16]$b[1]))
  }
  function Read-UInt32BE($reader) {
    $b = $reader.ReadBytes(4)
    if ($b.Length -ne 4) { throw 'Unexpected EOF while reading UInt32BE' }
    return [uint32]((([uint32]$b[0]) -shl 24) -bor (([uint32]$b[1]) -shl 16) -bor (([uint32]$b[2]) -shl 8) -bor ([uint32]$b[3]))
  }

  $signature = [System.Text.Encoding]::ASCII.GetString($br.ReadBytes(4))
  $version = Read-UInt16BE $br
  $reservedBytes = $br.ReadBytes(6)
  $reservedHex = -join ($reservedBytes | ForEach-Object { $_.ToString('X2') })
  $channels = Read-UInt16BE $br
  $height = Read-UInt32BE $br
  $width = Read-UInt32BE $br
  $depth = Read-UInt16BE $br
  $colorMode = Read-UInt16BE $br

  $colorModeLengthOffset = $fs.Position
  $colorModeDataLength = [int64](Read-UInt32BE $br)
  $colorModeDataStart = $fs.Position
  $imageResourcesLengthOffset = $colorModeDataStart + $colorModeDataLength

  $fs.Position = $imageResourcesLengthOffset
  $imageResourcesLength = [int64](Read-UInt32BE $br)
  $imageResourcesStart = $fs.Position
  $layerAndMaskLengthOffset = $imageResourcesStart + $imageResourcesLength

  $fs.Position = $layerAndMaskLengthOffset
  $layerAndMaskInfoLength = [int64](Read-UInt32BE $br)
  $layerAndMaskInfoStart = $fs.Position
  $imageDataOffset = $layerAndMaskInfoStart + $layerAndMaskInfoLength

  [PSCustomObject]@{
    path = $path
    fileSizeBytes = $fs.Length
    signature = $signature
    version = $version
    reservedBytesHex = $reservedHex
    channels = $channels
    height = $height
    width = $width
    depth = $depth
    colorMode = $colorMode
    colorModeName = switch ($colorMode) {
      0 {'Bitmap'}
      1 {'Grayscale'}
      2 {'Indexed'}
      3 {'RGB'}
      4 {'CMYK'}
      7 {'Multichannel'}
      8 {'Duotone'}
      9 {'Lab'}
      default {'Unknown'}
    }
    offsets = [PSCustomObject]@{
      headerStart = 0
      headerLength = 26
      colorModeDataLengthOffset = $colorModeLengthOffset
      colorModeDataStart = $colorModeDataStart
      colorModeDataLength = $colorModeDataLength
      imageResourcesLengthOffset = $imageResourcesLengthOffset
      imageResourcesStart = $imageResourcesStart
      imageResourcesLength = $imageResourcesLength
      layerAndMaskInfoLengthOffset = $layerAndMaskLengthOffset
      layerAndMaskInfoStart = $layerAndMaskInfoStart
      layerAndMaskInfoLength = $layerAndMaskInfoLength
      imageDataStart = $imageDataOffset
      imageDataRemainingBytesFromStart = $fs.Length - $imageDataOffset
    }
  } | ConvertTo-Json -Depth 5
}
finally {
  if ($br) { $br.Dispose() }
  $fs.Dispose()
}
```

## Scope Limits

No claim is made about:

- full PSD parsing;
- layer count;
- layer names;
- layer tree or group hierarchy;
- image resource interpretation;
- mask content;
- channel image data content;
- raster extraction;
- texture generation;
- Photoshop rendering or compositing compatibility.

## Stop / Escalate Notes

Stop and escalate if a later claim requires any of the following:

- proving actual layer tree contents from `test_data/sample_model.psd`;
- interpreting Image Resources;
- reading per-layer channel image data or final Image Data bytes;
- decoding RLE or ZIP image data;
- extracting raster pixels or generating preview textures from this PSD;
- copying, transforming, fixture-izing, or deriving binary assets from this PSD;
- claiming Photoshop-compatible rendering.
