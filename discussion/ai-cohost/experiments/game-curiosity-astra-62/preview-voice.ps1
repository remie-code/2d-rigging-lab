param([Parameter(Mandatory=$true)][string]$OutputDirectory, [string]$LinesFile = (Join-Path $PSScriptRoot 'lines.txt'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$synthType = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$streamType = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
$synth = [Activator]::CreateInstance($synthType)
$synth.Voice = $synthType::AllVoices | Where-Object DisplayName -eq 'Microsoft Haruka' | Select-Object -First 1
$synth.Options.SpeakingRate = 1.13
$lines = @(Get-Content -Encoding UTF8 $LinesFile)
[IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
try {
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $task = $asTask.MakeGenericMethod($streamType).Invoke($null, @($synth.SynthesizeTextToStreamAsync($lines[$i])))
        $task.Wait()
        $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($task.Result)
        $file = [IO.File]::Create((Join-Path $OutputDirectory "line-$i.wav"))
        try { $stream.CopyTo($file) } finally { $file.Dispose(); $stream.Dispose() }
    }
} finally { $synth.Dispose() }
