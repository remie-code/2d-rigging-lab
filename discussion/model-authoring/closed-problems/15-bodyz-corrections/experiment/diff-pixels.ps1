# cp15: pixel differ (LockBits direct read — no DrawImage, per cp14 craft note 5).
# Usage: powershell -File diff-pixels.ps1 <imgA.png> <imgB.png> [x0 y0 x1 y1]
#   Compares RGBA bytes inside the optional pixel rect (frame coords, inclusive).
#   Prints: diff pixel count, bbox of differing pixels (frame coords).
param(
  [string]$A, [string]$B,
  [int]$X0 = 0, [int]$Y0 = 0, [int]$X1 = -1, [int]$Y1 = -1
)
Add-Type -AssemblyName System.Drawing
$ba = New-Object System.Drawing.Bitmap((Resolve-Path $A).Path)
$bb = New-Object System.Drawing.Bitmap((Resolve-Path $B).Path)
if ($ba.Width -ne $bb.Width -or $ba.Height -ne $bb.Height) { throw "size mismatch" }
if ($X1 -lt 0) { $X1 = $ba.Width - 1 }
if ($Y1 -lt 0) { $Y1 = $ba.Height - 1 }
$rect = New-Object System.Drawing.Rectangle(0, 0, $ba.Width, $ba.Height)
$fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$da = $ba.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$db = $bb.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$len = [Math]::Abs($da.Stride) * $ba.Height
$bufA = New-Object byte[] $len
$bufB = New-Object byte[] $len
[System.Runtime.InteropServices.Marshal]::Copy($da.Scan0, $bufA, 0, $len)
[System.Runtime.InteropServices.Marshal]::Copy($db.Scan0, $bufB, 0, $len)
$ba.UnlockBits($da); $bb.UnlockBits($db)
$stride = $da.Stride
$count = 0; $bx0 = [int]::MaxValue; $by0 = [int]::MaxValue; $bx1 = -1; $by1 = -1
for ($y = $Y0; $y -le $Y1; $y++) {
  $row = $y * $stride
  for ($x = $X0; $x -le $X1; $x++) {
    $i = $row + $x * 4
    if ($bufA[$i] -ne $bufB[$i] -or $bufA[$i+1] -ne $bufB[$i+1] -or $bufA[$i+2] -ne $bufB[$i+2] -or $bufA[$i+3] -ne $bufB[$i+3]) {
      $count++
      if ($x -lt $bx0) { $bx0 = $x }; if ($x -gt $bx1) { $bx1 = $x }
      if ($y -lt $by0) { $by0 = $y }; if ($y -gt $by1) { $by1 = $y }
    }
  }
}
if ($count -eq 0) { Write-Output "diff=0" }
else { Write-Output "diff=$count bbox=($bx0,$by0)..($bx1,$by1)" }
$ba.Dispose(); $bb.Dispose()
