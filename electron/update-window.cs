// The small window the update installer shows while MDLxL is closed: the MDLxL
// icon, what is being installed, a progress bar, and the update popup's Shredder
// bird peeking around the edges (same sprites and timing as app/UpdateShredder.jsx).
// It is drawn as one per-pixel-alpha layered window so the bird can sit outside
// the box; transparent pixels let clicks through. The installer never waits on it.
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace MDLxLUpdate {
public class InstallWindow : Form {
    // Written by the installer thread, read by the timer.
    public volatile int Done;
    public volatile int Total;
    public volatile bool Undoing;
    public volatile bool Finished;
    public volatile bool CloseRequested;
    public readonly ManualResetEvent Gone = new ManualResetEvent(false);

    readonly string title, detail, undoing;
    readonly Color panel, text, muted, border, link, field;
    readonly Image icon, sheet, wings;
    readonly float scale;
    readonly int canvasW, canvasH;
    readonly RectangleF box;
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    readonly System.Diagnostics.Stopwatch clock = System.Diagnostics.Stopwatch.StartNew();
    readonly Random random = new Random();

    static readonly float[][] spots = {
        new float[] { .28f, 0, 0, -1, 0 },
        new float[] { 1, .24f, 1, 0, 90 },
        new float[] { .78f, 1, 0, 1, 180 },
        new float[] { 0, .86f, -1, 0, -90 },
    };
    string phase = "rest";
    float[] spot;
    double started, duration, reveal = 1600, next;
    bool peck, departed;
    PointF point;

    public static InstallWindow Start(string title, string detail, string undoing, string[] colors, byte[] icon, byte[] sheet, byte[] wings) {
        InstallWindow window = null;
        var ready = new ManualResetEvent(false);
        var thread = new Thread(() => {
            try {
                SetProcessDPIAware();
                window = new InstallWindow(title, detail, undoing, colors, Picture(icon), Picture(sheet), Picture(wings));
                window.HandleCreated += (s, e) => ready.Set();
                Application.Run(window);
            } catch { window = null; }
            finally { ready.Set(); if (window != null) window.Gone.Set(); }
        });
        thread.IsBackground = true;
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        ready.WaitOne(10000);
        return window;
    }
    static Image Picture(byte[] bytes) {
        if (bytes == null) return null;
        using (var stream = new MemoryStream(bytes)) using (var image = new Bitmap(stream)) return new Bitmap(image);
    }

    InstallWindow(string title, string detail, string undoing, string[] colors, Image icon, Image sheet, Image wings) {
        this.title = title; this.detail = detail; this.undoing = undoing;
        this.icon = icon; this.sheet = sheet; this.wings = wings;
        panel = ColorTranslator.FromHtml(colors[0]); text = ColorTranslator.FromHtml(colors[1]); muted = ColorTranslator.FromHtml(colors[2]);
        border = ColorTranslator.FromHtml(colors[3]); link = ColorTranslator.FromHtml(colors[4]); field = ColorTranslator.FromHtml(colors[5]);
        using (var screen = Graphics.FromHwnd(IntPtr.Zero)) scale = screen.DpiX / 96f;
        // Room around the box for the bird to peek out and fly off.
        float margin = 240 * scale;
        box = new RectangleF(margin, margin, 440 * scale, 104 * scale);
        canvasW = (int)Math.Ceiling(box.Width + 2 * margin); canvasH = (int)Math.Ceiling(box.Height + 2 * margin);
        Text = title;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = true;
        StartPosition = FormStartPosition.Manual;
        var area = Screen.FromPoint(Cursor.Position).WorkingArea;
        Bounds = new Rectangle(area.Left + (area.Width - canvasW) / 2, area.Top + (area.Height - canvasH) / 2, canvasW, canvasH);
        next = Between(900, 1800);
        timer.Interval = 30;
        timer.Tick += (s, e) => Tick();
        Shown += (s, e) => { Tick(); timer.Start(); };
    }
    protected override CreateParams CreateParams {
        get { var p = base.CreateParams; p.ExStyle |= 0x80000; return p; } // WS_EX_LAYERED
    }
    double Between(double low, double high) { return low + random.NextDouble() * (high - low); }
    static double Ease(double value) { var t = Math.Max(0, Math.Min(1, value)); return t * t * (3 - 2 * t); }
    void Choose(double now) {
        spot = spots[random.Next(spots.Length)];
        phase = "peek"; started = now; duration = Between(11000, 17000); peck = random.NextDouble() < .55;
    }
    PointF Edge(float[] at) { return new PointF(box.Left + box.Width * at[0], box.Top + box.Height * at[1]); }

    void Tick() {
        try {
            double now = clock.Elapsed.TotalMilliseconds;
            if (Finished && !departed) {
                departed = true;
                if (spot == null) Choose(now);
                phase = "fly"; started = now;
                var edge = Edge(spot);
                point = new PointF(edge.X + spot[2] * 18 * scale, edge.Y + spot[3] * 18 * scale);
            }
            if (phase == "rest" && !departed && now >= next) Choose(now);
            if (phase == "peek" && Hovered(now)) { phase = "escape"; started = now; }
            if (CloseRequested && (phase == "gone" || !departed)) { timer.Stop(); Close(); return; }
            Render(now);
        } catch { timer.Stop(); Close(); }
    }
    // Pointing at the visible part of the bird makes it dodge, like the popup.
    bool Hovered(double now) {
        var cursor = PointToClient(Cursor.Position);
        if (box.Contains(cursor)) return false;
        var at = BirdCenter(now);
        return Math.Abs(cursor.X - at.X) < 60 * scale && Math.Abs(cursor.Y - at.Y) < 66 * scale;
    }
    PointF BirdCenter(double now) {
        var edge = Edge(spot);
        double exposure = -82 + 94 * Ease((now - started) / reveal);
        return new PointF((float)(edge.X + spot[2] * exposure * scale), (float)(edge.Y + spot[3] * exposure * scale));
    }

    void Render(double now) {
        using (var canvas = new Bitmap(canvasW, canvasH, PixelFormat.Format32bppArgb)) {
            using (var g = Graphics.FromImage(canvas)) {
                g.Clear(Color.Transparent);
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                DrawBird(g, now);
                DrawBox(g, now);
            }
            Present(canvas);
        }
    }

    void DrawBird(Graphics g, double now) {
        if (phase == "rest" || phase == "gone" || sheet == null || wings == null) return;
        double age = now - started;
        var edge = Edge(spot);
        double x = edge.X, y = edge.Y, turn = spot[4], alpha = 1;
        int row = 0, column = 0, mirror = 1;
        bool flying = false;
        if (phase == "fly") {
            if (age >= 2600) { phase = "gone"; return; }
            double t = Math.Min(1, age / 2600), side = spot[2] < 0 ? -1 : 1;
            x = point.X + side * (canvasW / 2.0 + 180 * scale) * t * t;
            y = point.Y + (spot[3] > 0 ? 1 : -1) * (canvasH / 2.0 + 180 * scale) * t * t;
            turn = side < 0 ? -12 : 12;
            row = (int)(age / 120) % 8 >= 4 ? 1 : 0;
            column = (int)(age / 120) % 4;
            flying = true; mirror = (int)side;
            // The canvas ends before the screen does, so fade out instead of clipping.
            alpha = 1 - Ease((t - .45) / .45);
        } else {
            double exposure = phase == "escape" ? 12 - 120 * Ease(age / 360) :
                -82 + 94 * Ease(age / reveal) * (1 - Ease((age - duration + 1600) / 1600));
            x += spot[2] * exposure * scale; y += spot[3] * exposure * scale;
            if (phase == "escape") {
                x += spot[3] * 35 * Ease(age / 360) * scale; y -= spot[2] * 35 * Ease(age / 360) * scale;
                row = spot[2] < 0 ? 2 : 1; column = (int)(age / 55) % 8;
            } else if (peck && age >= 7200 && age < 9300) {
                double tap = (age - 7200) % 1100;
                double dip = tap < 650 ? Math.Sin(tap / 650 * Math.PI) : 0;
                row = dip > .7 ? 10 : 0; column = dip > .7 ? 0 : dip > .15 ? 3 : 0;
                turn += dip * 5;
                x -= spot[2] * dip * 4 * scale; y -= spot[3] * dip * 4 * scale;
            } else if (peck && age >= 9300 && age < 10300) { row = 8; column = 3; }
            else if (age >= 2600 && age < 5200) { row = 10; column = 4; }
            else if (age >= 5200 && age < 7200) { row = 9; column = 4; }
            else column = (int)(age / 440) % 6;
            if (phase == "escape" && age >= 360 || phase == "peek" && age >= duration) {
                bool dodged = phase == "escape";
                next = now + (dodged ? Between(350, 700) : Between(7000, 14000));
                reveal = dodged ? 1100 : 1600;
                phase = "rest";
                return;
            }
        }
        var state = g.Save();
        g.TranslateTransform((float)x, (float)y);
        g.RotateTransform((float)turn);
        g.ScaleTransform(mirror, 1);
        // Sheet frames are 192x208 shown at 144x156; wing frames are 240x240 shown 1:1.
        float w = (flying ? 240 : 144) * scale, h = (flying ? 240 : 156) * scale;
        var source = flying ? new Rectangle(column * 240, row * 240, 240, 240) : new Rectangle(column * 192, row * 208, 192, 208);
        using (var fade = new ImageAttributes()) {
            fade.SetColorMatrix(new ColorMatrix { Matrix33 = (float)Math.Max(0, alpha) });
            g.DrawImage(flying ? wings : sheet, new[] { new PointF(-w / 2, -h / 2), new PointF(w / 2, -h / 2), new PointF(-w / 2, h / 2) }, source, GraphicsUnit.Pixel, fade);
        }
        g.Restore(state);
    }

    void DrawBox(Graphics g, double now) {
        using (var fill = new SolidBrush(panel)) g.FillRectangle(fill, box);
        using (var line = new Pen(border, Math.Max(1, (float)Math.Round(scale)))) g.DrawRectangle(line, box.X, box.Y, box.Width - 1, box.Height - 1);
        float pad = 20 * scale, size = 64 * scale;
        if (icon != null) g.DrawImage(icon, box.X + pad, box.Y + 20 * scale, size, size);
        float left = box.X + pad + size + 16 * scale, width = box.Right - pad - left;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        using (var heading = new Font("Tahoma", 16 * scale, GraphicsUnit.Pixel))
        using (var small = new Font("Tahoma", 12 * scale, GraphicsUnit.Pixel))
        using (var linkBrush = new SolidBrush(link))
        using (var mutedBrush = new SolidBrush(muted))
        using (var format = new StringFormat(StringFormatFlags.NoWrap) { Trimming = StringTrimming.EllipsisCharacter }) {
            g.DrawString(Undoing ? undoing : title, heading, linkBrush, new RectangleF(left, box.Y + 20 * scale, width, 24 * scale), format);
            g.DrawString(detail, small, mutedBrush, new RectangleF(left, box.Y + 48 * scale, width, 36 * scale));
        }
        var bar = new RectangleF(left, box.Bottom - 26 * scale, width, 8 * scale);
        using (var back = new SolidBrush(field)) g.FillRectangle(back, bar);
        using (var front = new SolidBrush(link)) {
            int total = Total, done = Done;
            if (total > 0 && done > 0 && !Undoing) g.FillRectangle(front, bar.X, bar.Y, bar.Width * Math.Min(1, done / (float)total), bar.Height);
            else {
                // Waiting for MDLxL to close or checking files: a sliding segment.
                float span = bar.Width * .3f, travel = (float)(now / 1600 % 1);
                float start = bar.X - span + (bar.Width + span) * travel;
                var clip = g.Clip; g.SetClip(bar);
                g.FillRectangle(front, start, bar.Y, span, bar.Height);
                g.Clip = clip;
            }
        }
        using (var line = new Pen(border)) g.DrawRectangle(line, bar.X, bar.Y, bar.Width, bar.Height);
    }

    void Present(Bitmap canvas) {
        IntPtr screen = GetDC(IntPtr.Zero), memory = CreateCompatibleDC(screen), bitmap = canvas.GetHbitmap(Color.FromArgb(0)), old = SelectObject(memory, bitmap);
        try {
            var size = new Size(canvas.Width, canvas.Height);
            var source = new Point(0, 0);
            var position = new Point(Left, Top);
            var blend = new Blend { Op = 0, Flags = 0, Alpha = 255, Format = 1 };
            UpdateLayeredWindow(Handle, screen, ref position, ref size, memory, ref source, 0, ref blend, 2);
        } finally {
            SelectObject(memory, old); DeleteObject(bitmap); DeleteDC(memory); ReleaseDC(IntPtr.Zero, screen);
        }
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    struct Blend { public byte Op, Flags, Alpha, Format; }
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern bool UpdateLayeredWindow(IntPtr window, IntPtr screen, ref Point position, ref Size size, IntPtr source, ref Point sourcePoint, int key, ref Blend blend, int flags);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr window);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr window, IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc, IntPtr item);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr item);
}
}
