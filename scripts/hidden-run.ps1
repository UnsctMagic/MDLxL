# Runs a command on a separate, invisible Windows desktop ("MDLxLTests") so no window it opens can
# appear on the user's screen or take focus. Waits for it and returns its exit code.
# The command inherits this PowerShell's environment. Pass it as -Command, or in $env:MDLXL_HIDDEN_COMMAND
# when it contains quotes (callers such as scripts/run-packaged-tests.mjs do this to avoid quoting rules).
# Example: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\hidden-run.ps1 -Command 'node test\startup.electron.cjs' -WorkDir .
param([string]$Command = $env:MDLXL_HIDDEN_COMMAND, [string]$WorkDir = (Get-Location).Path)
if (-not $Command) { throw 'No command: pass -Command or set MDLXL_HIDDEN_COMMAND.' }
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class HiddenDesktop {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct STARTUPINFO {
    public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError; }
  [StructLayout(LayoutKind.Sequential)] public struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Unicode)] public static extern IntPtr CreateDesktop(string name, IntPtr d, IntPtr m, int f, uint access, IntPtr sa);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool CreateProcess(string app, string cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string dir, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll")] public static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] public static extern bool GetExitCodeProcess(IntPtr h, out uint code);
  public static int Run(string cmd, string dir) {
    IntPtr desk = CreateDesktop("MDLxLTests", IntPtr.Zero, IntPtr.Zero, 0, 0x10000000, IntPtr.Zero);
    if (desk == IntPtr.Zero) throw new Exception("CreateDesktop failed " + Marshal.GetLastWin32Error());
    var si = new STARTUPINFO(); si.cb = Marshal.SizeOf(si); si.lpDesktop = @"WinSta0\MDLxLTests";
    si.dwFlags = 1; si.wShowWindow = 0; // STARTF_USESHOWWINDOW, SW_HIDE for the console
    PROCESS_INFORMATION pi;
    if (!CreateProcess(null, cmd, IntPtr.Zero, IntPtr.Zero, false, 0x08000000, IntPtr.Zero, dir, ref si, out pi))
      throw new Exception("CreateProcess failed " + Marshal.GetLastWin32Error());
    WaitForSingleObject(pi.hProcess, 0xFFFFFFFF); uint code; GetExitCodeProcess(pi.hProcess, out code); return (int)code; }
}
'@
$code = [HiddenDesktop]::Run($Command, (Resolve-Path $WorkDir).Path)
"exit $code"
exit $code
