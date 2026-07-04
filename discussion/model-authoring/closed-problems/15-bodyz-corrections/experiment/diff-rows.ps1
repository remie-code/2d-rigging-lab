# cp15: per-row diff profile (LockBits direct read). For each pixel row in
# [Y0..Y1], counts pixels differing between A and B within [X0..X1].
# Usage: powershell -File diff-rows.ps1 <A.png> <B.png> <x0> <y0> <x1> <y1>
param([string]$A, [string]$B, [int]$X0, [int]$Y0, [int]$X1, [int]$Y1)
Add-Type -AssemblyName System.Drawing
$ba = New-Object System.Drawing.Bitmap((Resolve-Path $A).Path)
$bb = New-Object System.Drawing.Bitmap((Resolve-Path $B).Path)
$rect = New-Object System.Drawing.Rectangle(0, 0, $ba.Width, $ba.Height)
$fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$da = $ba.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$db = $bb.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$len = [Math]::Abs($da.Stride) * $ba.Height
$bufA = New-Object byte[] $len; $bufB = New-Object byte[] $len
[System.Runtime.InteropServices.Marshal]::Copy($da.Scan0, $bufA, 0, $len)
[System.Runtime.InteropServices.Marshal]::Copy($db.Scan0, $bufB, 0, $len)
$ba.UnlockBits($da); $bb.UnlockBits($db)
$stride = $da.Stride
$out = @()
for ($y = $Y0; $y -le $Y1; $y++) {
  $row = $y * $stride; $c = 0
  for ($x = $X0; $x -le $X1; $x++) {
    $i = $row + $x * 4
    if ($bufA[$i] -ne $bufB[$i] -or $bufA[$i+1] -ne $bufB[$i+1] -or $bufA[$i+2] -ne $bufB[$i+2] -or $bufA[$i+3] -ne $bufB[$i+3]) { $c++ }
  }
  $out += "$y $c"
}
$out -join "`n" | Write-Output
$ba.Dispose(); $bb.Dispose()
