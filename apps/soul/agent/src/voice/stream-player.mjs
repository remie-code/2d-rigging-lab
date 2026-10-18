// @ts-check
/**
 * 流し込みプレイヤー（声の差し替え Wave 1 Domain B）— apps/soul/agent。
 *
 * ── なぜ作るか（voice-swap-inventory §2・wave-plan §1 Domain B）────────────────────
 *  旧 `audio-player.mjs` は WinRT MediaPlayer に**ファイルパス**を渡す方式で、PCM を受け取りながら鳴らす
 *  口がない。ElevenLabs TTD は音のかたまりを順に届けるので、届いた分から鳴らすには PCM を流し込める
 *  再生器が要る。さらに旧方式の `STARTED` は Play() 直後に出るだけ・`ENDED` は 50ms ポーリングで、
 *  「本当に鳴り始めた時刻」が取れない。
 *
 * ── 方式: 常駐 PowerShell + C#（Add-Type）の WASAPI 共有モード再生器 ───────────────
 *  - 外部 DLL なし。PowerShell 5.1 の Add-Type（.NET Framework の C# 5）で COM interop を直接書く。
 *  - WASAPI を選んだ理由（waveOut ではなく）:
 *     1. デバイス名を**全長で**一致させられる。WASAPI の PKEY_Device_FriendlyName は操縦席の
 *        `listAudioDevices`（WinRT DeviceInformation.Name）と同じ文字列。waveOut の szPname は 31 字で
 *        切れ、「ヘッドホン (2- Shure MV7+)」級の名前は前方一致で曖昧になる。
 *     2. 再生位置が取れる。IAudioClock の位置が 0 を超えた時点で `STARTED` を返すので、「最初の
 *        バッファが実際に鳴り始めた時刻」に近い（口の t=0 との突き合わせ材料・Wave 2 の voiceMs）。
 *     3. 遅れが小さい。共有モードのエンジン周期（通常 10ms）+ 本ループのポーリング（5ms・timeBeginPeriod(1)）
 *        で、書き込みから再生開始まで数十 ms の見込み。waveOut は WASAPI の上に載ったエミュレーションで、
 *        その分のバッファが足される。
 *  - 形式変換は AUTOCONVERTPCM | SRC_DEFAULT_QUALITY に任せる（24kHz モノラルの PCM16LE をそのまま渡せる）。
 *  - スレッド: C# のメイン（= PowerShell のスレッド）が stdin を 1 行ずつ同期で読み、音の仕事は専用の
 *    MTA スレッドが持つ。COM オブジェクトは MTA スレッドだけで作って使う（PS5.1 は STA で、WinRT の
 *    イベント購読が使えなかった実測もあるため、PowerShell 側には何もさせない）。
 *
 * ── 行プロトコル（stdin / stdout、タブ区切り、1 行 1 件）─────────────────────────
 *  Node → PS:
 *    "OPEN\t<id>\t<sampleRate>\t<channels>"  新しい発話。前の再生は止めて捨て、置き換える（返りなし）。
 *    "DATA\t<id>\t<base64 PCM16LE>"          音の続き。<id> が今の発話でなければ無視。END 後も無視。
 *    "END\t<id>"                             もう続きはない。<id> が今の発話でなければ無視。
 *    "STOP"                                  即座に止め、溜めた分を捨てる。
 *  PS → Node:
 *    "READY\t<deviceFriendlyName>"           常駐の準備ができた（使う出力デバイスの名前）。
 *    "STARTED\t<id>"                         最初のバッファが実際に鳴り始めた（IAudioClock 位置 > 0）。
 *    "ENDED\t<id>"                           END 後、全部鳴り終わった（音のない発話は STARTED なしで ENDED）。
 *    "STOPPED" / "STOPPED\t<id>"             STOP を処理した（止めた発話があればその id を付ける）。
 *    "ERROR\t<id>\t<message>"                失敗（<id> は空のことがある）。常駐は続き、次の OPEN で作り直す。
 *  診断は stderr に `device-set:` / `device-not-found:` / `device-default:` を出す（旧プレイヤーと同じ語）。
 *
 * ── 出力デバイス ───────────────────────────────────────────────────────────
 *  env `SOUL_AUDIO_DEVICE_NAME`（旧プレイヤーと同じ受け渡し）と FriendlyName を大文字小文字無視で
 *  全長一致させる（旧 PS の `-eq` と同じ比較）。一致しなければ既定デバイス（eConsole）。既定デバイスで
 *  鳴らしている間は、OPEN のたびに既定が変わっていないかを見て、変わっていれば作り直す。
 *
 * ── 機械テストは無音（絶対規律）─────────────────────────────────────────────
 *  command/args/spawnImpl/env を差し替え可能にしてある。テストは偽の常駐プロセスを注入し、行プロトコルと
 *  状態遷移だけを固定する。実際に音を出すのは人間ゲートの領分。
 */

import { spawn } from "node:child_process";

/**
 * 常駐プロセスに載せる C# 再生器（C# 5 / .NET Framework・OS 標準のみ）。
 * コマンドラインでの引用符崩れを避けるため、PowerShell には base64 で渡す（{@link buildStreamPlayerScript}）。
 */
export const STREAM_PLAYER_CSHARP_SOURCE = String.raw`using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace SoulVoice {
  [StructLayout(LayoutKind.Sequential)]
  public struct PropertyKey { public Guid fmtid; public int pid; }

  [StructLayout(LayoutKind.Explicit)]
  public struct PropVariant {
    [FieldOffset(0)] public short vt;
    [FieldOffset(8)] public IntPtr p;
    [FieldOffset(16)] public IntPtr p2;
  }

  [StructLayout(LayoutKind.Sequential, Pack = 2)]
  public struct WaveFormatEx {
    public short wFormatTag; public short nChannels; public int nSamplesPerSec; public int nAvgBytesPerSec;
    public short nBlockAlign; public short wBitsPerSample; public short cbSize;
  }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator {
    void EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    void GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
    void GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    void RegisterEndpointNotificationCallback(IntPtr client);
    void UnregisterEndpointNotificationCallback(IntPtr client);
  }

  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection {
    void GetCount(out int count);
    void Item(int index, out IMMDevice device);
  }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice {
    void Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
    void OpenPropertyStore(int access, out IPropertyStore store);
    void GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    void GetState(out int state);
  }

  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IPropertyStore {
    void GetCount(out int count);
    void GetAt(int index, out PropertyKey key);
    void GetValue(ref PropertyKey key, out PropVariant value);
    void SetValue(ref PropertyKey key, ref PropVariant value);
    void Commit();
  }

  [ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioClient {
    void Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, [In] ref WaveFormatEx format, IntPtr sessionGuid);
    void GetBufferSize(out int frames);
    void GetStreamLatency(out long latency);
    void GetCurrentPadding(out int frames);
    [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
    void GetMixFormat(out IntPtr format);
    void GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
    void Start();
    void Stop();
    void Reset();
    void SetEventHandle(IntPtr handle);
    void GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
  }

  [ComImport, Guid("F294ACFC-3146-4483-A7BF-ADDCA7C260E2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioRenderClient {
    void GetBuffer(int frames, out IntPtr data);
    void ReleaseBuffer(int frames, int flags);
  }

  [ComImport, Guid("CD63314F-3FBA-4A1B-812C-EF96358728E7"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioClock {
    void GetFrequency(out long frequency);
    void GetPosition(out long position, out long qpc);
    void GetCharacteristics(out int characteristics);
  }

  sealed class Command {
    public string Kind; public string Id; public int SampleRate; public int Channels; public byte[] Data;
  }

  sealed class Engine {
    static readonly Guid IidAudioClient = new Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2");
    static readonly Guid IidRenderClient = new Guid("F294ACFC-3146-4483-A7BF-ADDCA7C260E2");
    static readonly Guid IidAudioClock = new Guid("CD63314F-3FBA-4A1B-812C-EF96358728E7");
    const int StreamFlags = unchecked((int)0x80000000) | 0x08000000;
    const long BufferDuration = 5000000;
    const int DrainGraceMs = 300;

    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PropVariant pv);

    readonly string deviceName;
    readonly BlockingCollection<Command> queue = new BlockingCollection<Command>();
    IMMDeviceEnumerator enumerator;
    IMMDevice device; string deviceId; bool usingNamed; string lastDeviceLog;
    IAudioClient client; IAudioRenderClient render; IAudioClock clock; long clockFreq;
    int clientRate, clientChannels, bufferFrames, blockAlign;
    string id; bool active, endRequested, clientStarted, startedEmitted, draining; int drainedAt;
    readonly Queue<byte[]> pending = new Queue<byte[]>(); int pendingOffset; long pendingBytes; long framesWritten;
    bool quit;

    public Engine(string deviceName) { this.deviceName = deviceName; }

    public void Post(Command c) { queue.Add(c); }

    public void Loop() {
      try {
        try {
          enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")));
          Host.Emit("READY\t" + Host.Clean(ResolveDevice()));
        } catch (Exception e) {
          Host.Emit("ERROR\t\tinit: " + Host.Describe(e));
        }
        while (!quit) {
          Command c;
          if (queue.TryTake(out c, active ? 5 : Timeout.Infinite)) {
            Handle(c);
            while (!quit && queue.TryTake(out c)) Handle(c);
          }
          if (active && !quit) {
            try { Pump(); } catch (Exception e) { Fail(e); }
          }
        }
        StopCurrent();
        ReleaseClient();
      } catch (Exception fatal) {
        Host.Emit("ERROR\t\tfatal: " + Host.Describe(fatal));
        Environment.Exit(3);
      }
    }

    void Handle(Command c) {
      try {
        if (c.Kind == "OPEN") Open(c);
        else if (c.Kind == "DATA") Data(c);
        else if (c.Kind == "END") { if (active && c.Id == id) endRequested = true; }
        else if (c.Kind == "STOP") {
          string prev = active ? id : null;
          StopCurrent();
          Host.Emit(prev != null ? "STOPPED\t" + prev : "STOPPED");
        } else if (c.Kind == "QUIT") quit = true;
      } catch (Exception e) { Fail(e); }
    }

    void Open(Command c) {
      StopCurrent();
      id = c.Id;
      if (c.SampleRate < 8000 || c.SampleRate > 192000 || c.Channels < 1 || c.Channels > 2) {
        Host.Emit("ERROR\t" + Host.Clean(c.Id) + "\tunsupported format " + c.SampleRate + "/" + c.Channels);
        id = null;
        return;
      }
      if (client == null || clientRate != c.SampleRate || clientChannels != c.Channels || DefaultDeviceChanged()) {
        ReleaseClient();
        ResolveDevice();
        CreateClient(c.SampleRate, c.Channels);
      }
      active = true; endRequested = false; clientStarted = false; startedEmitted = false; draining = false;
      framesWritten = 0;
    }

    void Data(Command c) {
      if (!active || c.Id != id || endRequested || c.Data == null || c.Data.Length == 0) return;
      pending.Enqueue(c.Data);
      pendingBytes += c.Data.Length;
    }

    void Pump() {
      int padding;
      client.GetCurrentPadding(out padding);
      long framesAvail = pendingBytes / blockAlign;
      int n = (int)Math.Min(bufferFrames - padding, framesAvail);
      if (n > 0) {
        IntPtr dst;
        render.GetBuffer(n, out dst);
        CopyPending(dst, n * blockAlign);
        render.ReleaseBuffer(n, 0);
        framesWritten += n;
        padding += n;
      }
      if (!clientStarted && framesWritten > 0) { client.Start(); clientStarted = true; }
      long pos = 0, qpc;
      if (clientStarted) clock.GetPosition(out pos, out qpc);
      if (clientStarted && !startedEmitted && pos > 0) { startedEmitted = true; Host.Emit("STARTED\t" + id); }
      if (!endRequested || pendingBytes >= blockAlign) return;
      if (framesWritten == 0) { Finish(); return; }
      if (padding > 0) { draining = false; return; }
      int now = Environment.TickCount;
      if (!draining) { draining = true; drainedAt = now; }
      double playedSec = (double)pos / clockFreq;
      double writtenSec = (double)framesWritten / clientRate;
      if (playedSec >= writtenSec - 0.002 || now - drainedAt > DrainGraceMs) Finish();
    }

    void CopyPending(IntPtr dst, int bytes) {
      int written = 0;
      while (written < bytes) {
        byte[] head = pending.Peek();
        int take = Math.Min(head.Length - pendingOffset, bytes - written);
        Marshal.Copy(head, pendingOffset, IntPtr.Add(dst, written), take);
        written += take;
        pendingOffset += take;
        if (pendingOffset >= head.Length) { pending.Dequeue(); pendingOffset = 0; }
      }
      pendingBytes -= bytes;
    }

    void Finish() {
      string done = id;
      if (framesWritten > 0 && !startedEmitted) Host.Emit("STARTED\t" + done);
      StopCurrent();
      Host.Emit("ENDED\t" + done);
    }

    void StopCurrent() {
      if (client != null) {
        try { if (clientStarted) client.Stop(); client.Reset(); } catch (Exception) { ReleaseClient(); }
      }
      pending.Clear(); pendingOffset = 0; pendingBytes = 0;
      active = false; endRequested = false; clientStarted = false; startedEmitted = false; draining = false;
      id = null;
    }

    void Fail(Exception e) {
      string failed = id;
      Host.Emit("ERROR\t" + Host.Clean(failed) + "\t" + Host.Describe(e));
      try { StopCurrent(); } catch (Exception) {}
      ReleaseClient();
      id = null; active = false;
    }

    bool DefaultDeviceChanged() {
      if (usingNamed || enumerator == null) return false;
      IMMDevice d = null;
      try {
        enumerator.GetDefaultAudioEndpoint(0, 0, out d);
        string did; d.GetId(out did);
        return did != deviceId;
      } catch (Exception) { return true; }
      finally { if (d != null) Marshal.ReleaseComObject(d); }
    }

    string ResolveDevice() {
      if (enumerator == null) {
        enumerator = (IMMDeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")));
      }
      if (device != null) { Marshal.ReleaseComObject(device); device = null; }
      IMMDevice found = null;
      string log;
      if (!string.IsNullOrEmpty(deviceName)) {
        IMMDeviceCollection col;
        enumerator.EnumAudioEndpoints(0, 1, out col);
        int count; col.GetCount(out count);
        for (int i = 0; i < count && found == null; i++) {
          IMMDevice d; col.Item(i, out d);
          if (string.Equals(FriendlyName(d), deviceName, StringComparison.OrdinalIgnoreCase)) found = d;
          else Marshal.ReleaseComObject(d);
        }
        Marshal.ReleaseComObject(col);
      }
      usingNamed = found != null;
      if (found == null) enumerator.GetDefaultAudioEndpoint(0, 0, out found);
      device = found;
      device.GetId(out deviceId);
      string name = FriendlyName(device) ?? "";
      if (usingNamed) log = "device-set: " + deviceName;
      else if (!string.IsNullOrEmpty(deviceName)) log = "device-not-found: " + deviceName;
      else log = "device-default: " + name;
      if (log != lastDeviceLog) { Host.Log(log); lastDeviceLog = log; }
      return name;
    }

    static string FriendlyName(IMMDevice d) {
      IPropertyStore ps = null;
      try {
        d.OpenPropertyStore(0, out ps);
        PropertyKey k = new PropertyKey();
        k.fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0");
        k.pid = 14;
        PropVariant v;
        ps.GetValue(ref k, out v);
        string s = v.vt == 31 ? Marshal.PtrToStringUni(v.p) : null;
        PropVariantClear(ref v);
        return s;
      } catch (Exception) { return null; }
      finally { if (ps != null) Marshal.ReleaseComObject(ps); }
    }

    void CreateClient(int rate, int channels) {
      object o;
      Guid iid = IidAudioClient;
      device.Activate(ref iid, 23, IntPtr.Zero, out o);
      client = (IAudioClient)o;
      WaveFormatEx f = new WaveFormatEx();
      f.wFormatTag = 1; f.nChannels = (short)channels; f.nSamplesPerSec = rate; f.wBitsPerSample = 16;
      f.nBlockAlign = (short)(channels * 2); f.nAvgBytesPerSec = rate * channels * 2; f.cbSize = 0;
      client.Initialize(0, StreamFlags, BufferDuration, 0, ref f, IntPtr.Zero);
      client.GetBufferSize(out bufferFrames);
      Guid riid = IidRenderClient;
      client.GetService(ref riid, out o);
      render = (IAudioRenderClient)o;
      Guid ciid = IidAudioClock;
      client.GetService(ref ciid, out o);
      clock = (IAudioClock)o;
      clock.GetFrequency(out clockFreq);
      clientRate = rate; clientChannels = channels; blockAlign = channels * 2;
    }

    void ReleaseClient() {
      if (clock != null) { try { Marshal.ReleaseComObject(clock); } catch (Exception) {} clock = null; }
      if (render != null) { try { Marshal.ReleaseComObject(render); } catch (Exception) {} render = null; }
      if (client != null) { try { client.Stop(); } catch (Exception) {} try { Marshal.ReleaseComObject(client); } catch (Exception) {} client = null; }
      clientRate = 0; clientChannels = 0; clientStarted = false;
    }
  }

  public static class Host {
    static readonly object OutLock = new object();
    static StreamWriter output;
    static StreamWriter errorOutput;

    [DllImport("winmm.dll")] static extern int timeBeginPeriod(int ms);

    public static void Emit(string line) {
      lock (OutLock) { output.Write(line); output.Write('\n'); output.Flush(); }
    }

    public static void Log(string line) {
      try { lock (OutLock) { errorOutput.Write(line); errorOutput.Write('\n'); errorOutput.Flush(); } } catch (Exception) {}
    }

    public static string Clean(string s) {
      return (s ?? "").Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ');
    }

    public static string Describe(Exception e) {
      COMException ce = e as COMException;
      string head = ce != null ? "0x" + ce.ErrorCode.ToString("X8") + " " : "";
      return Clean(head + e.GetType().Name + ": " + e.Message);
    }

    public static int Run(string deviceName) {
      output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
      errorOutput = new StreamWriter(Console.OpenStandardError(), new UTF8Encoding(false));
      try { timeBeginPeriod(1); } catch (Exception) {}
      Engine engine = new Engine(deviceName);
      Thread worker = new Thread(engine.Loop);
      worker.SetApartmentState(ApartmentState.MTA);
      worker.IsBackground = true;
      worker.Start();
      StreamReader input = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false), false, 65536);
      string line;
      while ((line = input.ReadLine()) != null) {
        if (line.Length == 0) continue;
        string[] parts = line.Split('\t');
        string lineId = parts.Length > 1 ? parts[1] : "";
        try {
          Command c = new Command();
          c.Kind = parts[0];
          c.Id = lineId;
          if (c.Kind == "OPEN" && parts.Length >= 4) {
            c.SampleRate = int.Parse(parts[2]);
            c.Channels = int.Parse(parts[3]);
          } else if (c.Kind == "DATA" && parts.Length >= 3) {
            c.Data = Convert.FromBase64String(parts[2]);
          } else if (c.Kind == "END" && parts.Length >= 2) {
          } else if (c.Kind == "STOP") {
          } else {
            Emit("ERROR\t" + Clean(lineId) + "\tbad command: " + Clean(parts[0]));
            continue;
          }
          engine.Post(c);
        } catch (Exception e) {
          Emit("ERROR\t" + Clean(lineId) + "\t" + Describe(e));
        }
      }
      Command q = new Command();
      q.Kind = "QUIT";
      engine.Post(q);
      worker.Join(2000);
      return 0;
    }
  }
}
`;

/**
 * 常駐 PowerShell スクリプトを組み立てる。C# は base64 で埋め込む（-Command 引数に二重引用符を
 * 含めると Node → powershell.exe のコマンドライン解釈で崩れやすいため、スクリプト本体は単一引用符のみ）。
 * @param {string} [csharpSource]
 * @returns {string}
 */
export function buildStreamPlayerScript(csharpSource = STREAM_PLAYER_CSHARP_SOURCE) {
  const encoded = Buffer.from(csharpSource, "utf8").toString("base64");
  return [
    "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)",
    "$ErrorActionPreference = 'Stop'",
    `try { Add-Type -Language CSharp -TypeDefinition ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encoded}'))) }`,
    "catch { [Console]::Error.WriteLine('compile-error: ' + $_.Exception.Message); [Console]::Out.WriteLine('ERROR' + [char]9 + [char]9 + 'compile failed'); exit 2 }",
    "exit ([SoulVoice.Host]::Run($env:SOUL_AUDIO_DEVICE_NAME))"
  ].join("\n");
}

const DEFAULT_COMMAND = "powershell.exe";

/** 既定の引数（旧プレイヤーと同じ前置き + 組み立てたスクリプト）。 */
export function buildDefaultStreamPlayerArgs() {
  return [
    "-NoProfile",
    "-NonInteractive",
    "-NoLogo",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    buildStreamPlayerScript()
  ];
}

/**
 * DATA 1 行に載せる PCM の既定上限（バイト）。16KiB = 24kHz モノラルで約 0.34 秒・base64 で約 22KB/行。
 * 届いたかたまり（ElevenLabs は最大 1 秒前後）を 1 行にせず、行の長さと読み取り側のバッファを抑える。
 */
export const DEFAULT_MAX_DATA_BYTES = 16384;

const MARK_READY = "READY";
const MARK_STARTED = "STARTED";
const MARK_ENDED = "ENDED";
const MARK_STOPPED = "STOPPED";
const MARK_ERROR = "ERROR";

/**
 * @typedef {(
 *   { type: "ready"; device: string; atMs: number } |
 *   { type: "started"; id: string; atMs: number } |
 *   { type: "ended"; id: string; atMs: number } |
 *   { type: "stopped"; id: string | null; atMs: number } |
 *   { type: "error"; id: string | null; message: string; atMs: number } |
 *   { type: "exit"; id: string | null; code: number | null; signal: string | null; message?: string; atMs: number }
 * )} StreamPlayerEvent
 */

/**
 * 常駐プロセスの stdout 1 行を解釈する純関数。知らない行は null（onOutput には流れる）。
 * @param {string} line
 * @returns {(
 *   { type: "ready"; device: string } |
 *   { type: "started" | "ended"; id: string } |
 *   { type: "stopped"; id: string | null } |
 *   { type: "error"; id: string | null; message: string }
 * ) | null}
 */
export function parseStreamPlayerLine(line) {
  const parts = line.split("\t");
  const marker = parts[0];
  if (marker === MARK_READY) {
    return { type: "ready", device: parts.slice(1).join("\t") };
  }
  if (marker === MARK_STARTED || marker === MARK_ENDED) {
    if (parts.length < 2 || parts[1].length === 0) return null;
    return { type: marker === MARK_STARTED ? "started" : "ended", id: parts[1] };
  }
  if (marker === MARK_STOPPED) {
    return { type: "stopped", id: parts.length >= 2 && parts[1].length > 0 ? parts[1] : null };
  }
  if (marker === MARK_ERROR) {
    if (parts.length >= 3) {
      return { type: "error", id: parts[1].length > 0 ? parts[1] : null, message: parts.slice(2).join("\t") };
    }
    return { type: "error", id: null, message: parts[1] ?? "" };
  }
  return null;
}

/**
 * PCM を DATA 行の大きさに切る純関数（コピーせず subarray を返す）。
 * @param {Uint8Array} pcm
 * @param {number} maxBytes
 * @returns {Uint8Array[]}
 */
export function splitPcm(pcm, maxBytes) {
  const size = Math.max(4, Math.floor(maxBytes / 4) * 4);
  const pieces = [];
  for (let offset = 0; offset < pcm.byteLength; offset += size) {
    pieces.push(pcm.subarray(offset, Math.min(offset + size, pcm.byteLength)));
  }
  return pieces;
}

/**
 * 流し込みプレイヤーを起動する。
 *
 * 状態は「今の発話」1 本だけ持つ（open で置き換え・ENDED/STOP/ERROR/異常終了で空になる）。
 * - write/end は今の発話の id のときだけ送る（別 id・END 後は false を返して捨てる。常駐側も同じく無視する）。
 * - 今の発話でない id の STARTED/ENDED は古い発話の残りとして捨てる。STOPPED と ERROR はそのまま届ける。
 *
 * @param {object} [options]
 * @param {string} [options.deviceName]  出力デバイス名（env SOUL_AUDIO_DEVICE_NAME で渡す）。未指定は既定デバイス。
 * @param {string} [options.command]  実行コマンド（既定 powershell.exe）。テストで差し替える注入点。
 * @param {string[]} [options.args]  引数（既定は常駐 C# 再生器のスクリプト）。
 * @param {(command: string, args: string[], opts: object) => import("node:child_process").ChildProcess} [options.spawnImpl]
 * @param {NodeJS.ProcessEnv} [options.env]  spawn へ渡す基底 env（既定 process.env）。
 * @param {number} [options.maxDataBytes]  DATA 1 行の PCM 上限（既定 {@link DEFAULT_MAX_DATA_BYTES}）。
 * @param {(event: StreamPlayerEvent) => void} [options.onEvent]  最初の購読者（onEvent() と同じ）。
 * @param {(line: string) => void} [options.onOutput]  子プロセス stdout の 1 行ごと（診断用）。
 * @param {(line: string) => void} [options.onError]  子プロセス stderr の 1 行ごと（診断用）。
 * @param {() => number} [options.nowImpl]  イベントの atMs（既定 Date.now）。
 */
export function createStreamPlayer(options = {}) {
  const command = options.command ?? DEFAULT_COMMAND;
  const args = options.args ?? buildDefaultStreamPlayerArgs();
  const spawnImpl = options.spawnImpl ?? spawn;
  const maxDataBytes = options.maxDataBytes ?? DEFAULT_MAX_DATA_BYTES;
  const now = options.nowImpl ?? Date.now;
  const baseEnv = options.env ?? process.env;
  const spawnEnv = options.deviceName
    ? { ...baseEnv, SOUL_AUDIO_DEVICE_NAME: options.deviceName }
    : baseEnv;

  /** @type {Set<(event: StreamPlayerEvent) => void>} */
  const listeners = new Set();
  if (options.onEvent) listeners.add(options.onEvent);

  /** @type {{ id: string; started: boolean; endSent: boolean } | null} */
  let current = null;
  let disposed = false;
  let exited = false;
  let ready = false;
  /** @type {Array<(value: boolean) => void>} */
  let readyWaiters = [];

  const child = spawnImpl(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: spawnEnv
  });

  /** @param {StreamPlayerEvent} event */
  const emit = (event) => {
    if (disposed) return;
    for (const listener of [...listeners]) {
      try {
        listener(event);
      } catch {
        // 購読者の失敗はプレイヤーの状態を壊さない。
      }
    }
  };

  /** @param {boolean} value */
  const settleReady = (value) => {
    const waiters = readyWaiters;
    readyWaiters = [];
    for (const resolve of waiters) resolve(value);
  };

  /** @param {string} line */
  const handleLine = (line) => {
    if (options.onOutput) {
      try {
        options.onOutput(line);
      } catch {
        // 診断の観測者はプレイヤーを持たない。
      }
    }
    const parsed = parseStreamPlayerLine(line);
    if (parsed == null) return;
    const atMs = now();
    switch (parsed.type) {
      case "ready":
        ready = true;
        settleReady(true);
        emit({ type: "ready", device: parsed.device, atMs });
        return;
      case "started":
        if (current == null || current.id !== parsed.id) return;
        current.started = true;
        emit({ type: "started", id: parsed.id, atMs });
        return;
      case "ended":
        if (current == null || current.id !== parsed.id) return;
        current = null;
        emit({ type: "ended", id: parsed.id, atMs });
        return;
      case "stopped":
        if (current != null && current.id === parsed.id) current = null;
        emit({ type: "stopped", id: parsed.id, atMs });
        return;
      case "error":
        if (current != null && parsed.id != null && current.id === parsed.id) current = null;
        emit({ type: "error", id: parsed.id, message: parsed.message, atMs });
        return;
    }
  };

  /**
   * @param {number | null} code
   * @param {string | null} signal
   * @param {string} [message]
   */
  const markExited = (code, signal, message) => {
    if (exited) return;
    exited = true;
    const inFlight = current?.id ?? null;
    current = null;
    settleReady(false);
    emit({
      type: "exit",
      id: inFlight,
      code,
      signal,
      ...(message ? { message } : {}),
      atMs: now()
    });
  };

  if (child.stdout) lineReader(child.stdout, handleLine);
  if (options.onError && child.stderr) lineReader(child.stderr, options.onError);
  if (typeof child.on === "function") {
    child.on("exit", (code, signal) => markExited(code ?? null, signal ?? null));
    child.on("error", (error) => markExited(null, null, error instanceof Error ? error.message : String(error)));
  }
  // 子が先に死んだときの EPIPE は exit 側で扱う（ここで投げると Node ごと落ちる）。
  if (child.stdin && typeof child.stdin.on === "function") {
    child.stdin.on("error", () => {});
  }

  const assertUsable = () => {
    if (disposed) throw new Error("stream player already disposed.");
    if (exited) throw new Error("stream player process exited.");
  };

  /** @param {string} line */
  const writeLine = (line) => {
    if (!child.stdin || child.stdin.destroyed) {
      throw new Error("stream player stdin is not writable.");
    }
    child.stdin.write(`${line}\n`);
  };

  return {
    /**
     * 新しい発話を始める。前の発話は常駐側で止めて置き換える（返りの行はない）。
     * @param {string} id
     * @param {{ sampleRate: number; channels: number }} format
     */
    open(id, format) {
      assertUsable();
      assertId(id, "open");
      const sampleRate = format?.sampleRate;
      const channels = format?.channels;
      if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
        throw new RangeError("open(id, format): sampleRate must be an integer in 8000..192000.");
      }
      if (channels !== 1 && channels !== 2) {
        throw new RangeError("open(id, format): channels must be 1 or 2.");
      }
      current = { id, started: false, endSent: false };
      writeLine(`OPEN\t${id}\t${sampleRate}\t${channels}`);
    },
    /**
     * 音の続きを送る（PCM16LE）。今の発話でない id・END 後は送らずに false。
     * @param {string} id
     * @param {Uint8Array} pcm
     * @returns {boolean}
     */
    write(id, pcm) {
      assertUsable();
      assertId(id, "write");
      if (!(pcm instanceof Uint8Array)) {
        throw new TypeError("write(id, pcm): pcm must be a Uint8Array.");
      }
      if (current == null || current.id !== id || current.endSent) return false;
      for (const piece of splitPcm(pcm, maxDataBytes)) {
        const base64 = Buffer.from(piece.buffer, piece.byteOffset, piece.byteLength).toString("base64");
        writeLine(`DATA\t${id}\t${base64}`);
      }
      return true;
    },
    /**
     * もう続きはないと伝える。鳴り終わると ENDED が届く。今の発話でない id・二度目は false。
     * @param {string} id
     * @returns {boolean}
     */
    end(id) {
      assertUsable();
      assertId(id, "end");
      if (current == null || current.id !== id || current.endSent) return false;
      current.endSent = true;
      writeLine(`END\t${id}`);
      return true;
    },
    /** 即座に止め、溜めた分を捨てる（barge-in 用）。STOPPED が届く。 */
    stop() {
      assertUsable();
      current = null;
      writeLine("STOP");
    },
    /**
     * イベントを購読する。戻り値で解除する。
     * @param {(event: StreamPlayerEvent) => void} listener
     * @returns {() => void}
     */
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * READY を待つ（true）。先に終了・dispose したら false（reject しない＝放置しても未処理の拒否にならない）。
     * @returns {Promise<boolean>}
     */
    whenReady() {
      if (ready) return Promise.resolve(true);
      if (exited || disposed) return Promise.resolve(false);
      return new Promise((resolve) => readyWaiters.push(resolve));
    },
    /** 今の発話（なければ null）。 */
    current() {
      return current == null ? null : { ...current };
    },
    /** 常駐プロセスが生きていて使えるか。 */
    isAlive() {
      return !disposed && !exited;
    },
    /**
     * 常駐プロセスを畳む（stdin を閉じてから kill・パイプを destroy して unref。旧プレイヤーと同じ作法）。
     * 以後のイベントは届けない。
     */
    dispose() {
      if (disposed) return;
      settleReady(false);
      disposed = true;
      current = null;
      listeners.clear();
      try {
        if (child.stdin && !child.stdin.destroyed) child.stdin.end();
      } catch {
        // best-effort
      }
      try {
        child.kill();
      } catch {
        // best-effort
      }
      try {
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
      } catch {
        // best-effort
      }
      child.unref?.();
    },
    child
  };
}

/**
 * @param {unknown} id
 * @param {string} method
 */
function assertId(id, method) {
  if (typeof id !== "string" || id.length === 0 || /[\t\r\n]/.test(id)) {
    throw new TypeError(`${method}(id): id must be a non-empty single-line token without tabs.`);
  }
}

/**
 * ストリームを行単位に割ってコールバックへ流す（依存ゼロの簡易 line reader）。
 * @param {import("node:stream").Readable} stream
 * @param {(line: string) => void} onLine
 */
function lineReader(stream, onLine) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        onLine(line);
      }
    }
  });
}
