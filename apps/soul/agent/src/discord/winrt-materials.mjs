// @ts-check
import { execFile } from "node:child_process";
import path from "node:path";
import { buildPowerShellInvocationArgs } from "../eyes/powershell-exec.mjs";

export const WINRT_ASYNC = String.raw`
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$methods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Length -eq 1
}
$asTask = $methods | Where-Object {
  $_.IsGenericMethod -and $_.GetGenericArguments().Length -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'
}
function Wait-Operation($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $task.GetAwaiter().GetResult()
}
`;

/** Read only the supplied bytes. Do not pipe native diagnostics into the application. */
export const WINRT_OPEN_INPUT = String.raw`
$inputBytes = New-Object IO.MemoryStream
[Console]::OpenStandardInput().CopyTo($inputBytes)
$inputBytes.Position = 0
$sourceStream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($inputBytes)
`;

/**
 * @param {string} script
 * @param {Buffer} bytes
 * @param {{signal?:AbortSignal, maxOutputBytes:number, timeoutMs:number}} options
 * @returns {Promise<{value:any}|{error:"unavailable"|"limit"|"timeout"|"invalid-output"}>}
 */
export async function runWinRtMaterialScript(script, bytes, { signal, maxOutputBytes, timeoutMs }) {
  if (process.platform !== "win32" || signal?.aborted) return { error: "unavailable" };
  const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return new Promise((resolve) => {
    const child = execFile(powershell, buildPowerShellInvocationArgs(script), {
      windowsHide: true, maxBuffer: maxOutputBytes, timeout: timeoutMs, signal
    }, (error, stdout) => {
      if (error) {
        resolve({ error: error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ? "limit" :
          error.killed ? "timeout" : "unavailable" });
        return;
      }
      try {
        resolve({ value: JSON.parse(stdout) });
      } catch {
        resolve({ error: "invalid-output" });
      }
    });
    child.stdin?.on("error", () => {}); // A child can exit before consuming all the input.
    child.stdin?.end(bytes);
  });
}
