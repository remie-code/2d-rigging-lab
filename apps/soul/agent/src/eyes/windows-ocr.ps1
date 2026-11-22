$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime]

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage(
    [Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]::new('ja'))
if (-not $engine) {
    Write-Output '{"unavailable":true}'
    exit 0
}

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing,System.Core -TypeDefinition @'
/* IMAGE_SOURCE */
'@

$taskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
        $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Wait-Operation($operation, $type) {
    $task = $taskMethod.MakeGenericMethod($type).Invoke($null, @($operation))
    $task.Wait()
    $task.Result
}

function Read-Lines($source) {
    $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($source)
    try {
        $decoder = Wait-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Wait-Operation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        try {
            $result = Wait-Operation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
            # Word rectangles refer to the deskewed bitmap when TextAngle is present.
            # Rotate each word's corners around the image center back into source pixels.
            $angle = [double]$result.TextAngle * [Math]::PI / 180
            $cos = [Math]::Cos($angle)
            $sin = [Math]::Sin($angle)
            $originX = $bitmap.PixelWidth / 2
            $originY = $bitmap.PixelHeight / 2
            foreach ($line in $result.Lines) {
                if (-not $line.Text -or -not $line.Words.Count) { continue }
                $left = [double]::PositiveInfinity
                $top = [double]::PositiveInfinity
                $right = 0
                $bottom = 0
                foreach ($word in $line.Words) {
                    $rect = $word.BoundingRect
                    foreach ($x in @($rect.X, ($rect.X + $rect.Width))) {
                        foreach ($y in @($rect.Y, ($rect.Y + $rect.Height))) {
                            $dx = $x - $originX
                            $dy = $y - $originY
                            $sourceX = $originX + $cos*$dx - $sin*$dy
                            $sourceY = $originY + $sin*$dx + $cos*$dy
                            $left = [Math]::Min($left, $sourceX)
                            $top = [Math]::Min($top, $sourceY)
                            $right = [Math]::Max($right, $sourceX)
                            $bottom = [Math]::Max($bottom, $sourceY)
                        }
                    }
                }
                [pscustomobject]@{text=$line.Text; x=$left; y=$top; w=($right-$left); h=($bottom-$top)}
            }
        } finally { $bitmap.Dispose() }
    } finally { $stream.Dispose() }
}

function Confirm-NumericLine($image, $line) {
    $normalized = $line.text.Normalize([Text.NormalizationForm]::FormKC) -replace '\s', ''
    if ($normalized -notmatch '[\p{IsHiragana}\p{IsKatakana}\p{IsCJKUnifiedIdeographs}]') { return }
    $seed = $normalized -replace '[^0-9]', ''
    if ($seed.Length -lt 2) { return }

    $x = [Math]::Max(0, [int][Math]::Floor($line.x))
    $y = [Math]::Max(0, [int][Math]::Floor($line.y))
    $right = [Math]::Min($image.Width, [int][Math]::Ceiling($line.x + $line.w))
    $bottom = [Math]::Min($image.Height, [int][Math]::Ceiling($line.y + $line.h))
    if ($right -le $x -or $bottom -le $y) { return }
    $original = [Drawing.Rectangle]::FromLTRB($x, $y, $right, $bottom)
    $inkPad = [Math]::Max(12, [Math]::Min(60, $original.Height))
    $variants = @(
        @{padX=[Math]::Max(2, [Math]::Round($original.Height*.12)); padY=[Math]::Max(2, [Math]::Round($original.Height*.12)); scale=3; border=12; ink=$false}
        @{padX=[Math]::Max(2, [Math]::Round($original.Height*.35)); padY=[Math]::Max(2, [Math]::Round($original.Height*.35)); scale=2; border=12; ink=$false}
        @{padX=(2*$inkPad); padY=$inkPad; scale=2; border=18; ink=$true}
    )
    foreach ($variant in $variants) {
        $left = [Math]::Max(0, $x - $variant.padX)
        $top = [Math]::Max(0, $y - $variant.padY)
        $clip = [Drawing.Rectangle]::FromLTRB($left, $top,
            [Math]::Min($image.Width, $right + $variant.padX),
            [Math]::Min($image.Height, $bottom + $variant.padY))
        $maxDimension = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
        if ([Math]::Max($clip.Width, $clip.Height) * $variant.scale + 2 * $variant.border -gt $maxDimension) { continue }

        try {
            $tile = [WindowsOcrImage]::RereadTile($image, $clip, $original, $variant.scale, $variant.border, $variant.ink)
            $tileStream = [IO.MemoryStream]::new($tile)
            try { $reads = @(Read-Lines $tileStream) }
            finally { $tileStream.Dispose() }
        } catch { continue }
        if ($reads.Count -ne 1) { continue }
        $read = $reads[0]
        $value = $read.text.Normalize([Text.NormalizationForm]::FormKC) -replace '\s', ''
        if ($value -notmatch '^[0-9]{3,}$' -or -not $value.Contains($seed)) { continue }

        # Project the reread back to the source image. Nearby labels can fall
        # into the crop, so require overlap with the original line.
        $newX = $left + ($read.x - $variant.border) / $variant.scale
        $newY = $top + ($read.y - $variant.border) / $variant.scale
        $newW = $read.w / $variant.scale
        $newH = $read.h / $variant.scale
        $overlapW = [Math]::Min($right, $newX + $newW) - [Math]::Max($x, $newX)
        $overlapH = [Math]::Min($bottom, $newY + $newH) - [Math]::Max($y, $newY)
        if ($overlapW -ge .50*$original.Width -and $overlapH -ge .45*$original.Height -and
            $overlapW*$overlapH -ge .50*$newW*$newH) { return $value }
    }
}

$bytes = [Convert]::FromBase64String([Console]::In.ReadToEnd())
$source = [IO.MemoryStream]::new($bytes)
$imageSource = [IO.MemoryStream]::new($bytes)
try {
    $image = [Drawing.Bitmap]::new($imageSource)
    try {
        $lines = [Collections.Generic.List[object]]::new()
        $damage = [Collections.Generic.List[object]]::new()
        foreach ($line in @(Read-Lines $source)) {
            $numeric = Confirm-NumericLine $image $line
            if ($numeric) {
                $line | Add-Member -NotePropertyName rereadText -NotePropertyValue $numeric
                $damage.Add($line)
            } else {
                $lines.Add($line)
            }
        }
        $evidence = [WindowsOcrImage]::ReadEvidence($image)
        [pscustomobject]@{
            width=$image.Width
            height=$image.Height
            lines=$lines.ToArray()
            damageExclusions=$damage.ToArray()
            strokeMask=$evidence.StrokeMask
            pixelTiles=$evidence.PixelTiles
            tileSize=$evidence.TileSize
        } | ConvertTo-Json -Depth 4 -Compress
    } finally { $image.Dispose() }
} finally {
    $imageSource.Dispose()
    $source.Dispose()
}
