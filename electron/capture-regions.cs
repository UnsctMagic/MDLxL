using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

internal static class CaptureRegions
{
    private const uint Child = 0x40000000, Disabled = 0x08000000;
    private const uint Layered = 0x80000, Transparent = 0x20;
    private const uint NoActivate = 0x10, Show = 0x40, Hide = 0x80;
    private const uint NoMoveOrSize = 0x03, NoZOrder = 0x04;

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateWindowEx(uint exStyle, string className, string title,
        uint style, int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr data);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetLayeredWindowAttributes(IntPtr window, uint color, byte alpha, uint flags);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")]
    private static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string title);
    [DllImport("user32.dll")]
    private static extern IntPtr GetWindowDpiAwarenessContext(IntPtr window);
    [DllImport("user32.dll")]
    private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

    private static IntPtr CreateRegion(IntPtr parent, string title)
    {
        // ShareX enumerates visible child HWNDs. Zero alpha and WS_EX_TRANSPARENT
        // let the Chromium surface underneath continue to render and receive input.
        IntPtr window = CreateWindowEx(Layered | Transparent, "Static", title, Child | Disabled,
            0, 0, 0, 0, parent, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
        if (window == IntPtr.Zero || !SetLayeredWindowAttributes(window, 0, 0, 2))
            throw new Win32Exception();
        return window;
    }

    private static void Position(IntPtr window, int[] edges, int offset)
    {
        int left = edges[offset], top = edges[offset + 1];
        int width = edges[offset + 2] - left, height = edges[offset + 3] - top;
        if (width <= 0 || height <= 0)
            SetWindowPos(window, IntPtr.Zero, 0, 0, 0, 0, NoActivate | Hide | NoMoveOrSize | NoZOrder);
        else
            SetWindowPos(window, IntPtr.Zero, left, top, width, height, NoActivate | Show);
    }

    [STAThread]
    private static void Main(string[] args)
    {
        IntPtr parent = new IntPtr(long.Parse(args[0]));
        SetThreadDpiAwarenessContext(GetWindowDpiAwarenessContext(parent));
        IntPtr host = IntPtr.Zero, viewport = IntPtr.Zero, toolbox = IntPtr.Zero;

        using (var dispatcher = new Control())
        {
            // A message loop keeps the child HWNDs responsive while stdin waits
            // on the worker thread. EOF closes the helper with its owning window.
            var handle = dispatcher.Handle;
            var input = new Thread(() =>
            {
                string line;
                while ((line = Console.ReadLine()) != null)
                {
                    string[] fields = line.Split(' ');
                    if (fields.Length != 8) continue;
                    int[] edges = Array.ConvertAll(fields, int.Parse);
                    dispatcher.Invoke((Action)(() =>
                    {
                        // ShareX visits descendants before their parent. The render host
                        // also starts below the native menu, at the DOM's (0, 0).
                        IntPtr renderHost = FindWindowEx(parent, IntPtr.Zero, "Chrome_RenderWidgetHostHWND", null);
                        if (renderHost == IntPtr.Zero) return;
                        if (renderHost != host)
                        {
                            if (viewport != IntPtr.Zero) DestroyWindow(viewport);
                            if (toolbox != IntPtr.Zero) DestroyWindow(toolbox);
                            host = renderHost;
                            viewport = CreateRegion(host, "MDLxL Viewport");
                            toolbox = CreateRegion(host, "MDLxL Toolbox");
                        }
                        Position(viewport, edges, 0);
                        Position(toolbox, edges, 4);
                    }));
                }
                dispatcher.BeginInvoke((Action)Application.ExitThread);
            });
            input.IsBackground = true;
            input.Start();
            Application.Run();
        }
        DestroyWindow(toolbox);
        DestroyWindow(viewport);
    }
}
