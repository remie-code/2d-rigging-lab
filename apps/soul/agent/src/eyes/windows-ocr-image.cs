using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;

public static class WindowsOcrImage
{
    private static byte[] ReadRow(BitmapData data, int y)
    {
        var row = new byte[data.Width * 3];
        Marshal.Copy(IntPtr.Add(data.Scan0, y * data.Stride), row, 0, row.Length);
        return row;
    }

    public sealed class FrameEvidence
    {
        public string StrokeMask;
        public string PixelTiles;
        public int TileSize;
    }

    public static FrameEvidence ReadEvidence(Bitmap bitmap)
    {
        const int tileSize = 8;
        const ulong offset = 14695981039346656037UL, prime = 1099511628211UL;
        int width = bitmap.Width, height = bitmap.Height;
        int tileColumns = (width + tileSize - 1) / tileSize;
        int tileRows = (height + tileSize - 1) / tileSize;
        var tileHashes = new ulong[tileColumns * tileRows];
        for (int i = 0; i < tileHashes.Length; i++) tileHashes[i] = offset;
        var pixels = new byte[width * height];
        var data = bitmap.LockBits(new Rectangle(0, 0, width, height),
            ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
        try {
            for (int y = 0; y < height; y++) {
                var row = ReadRow(data, y);
                int tileRow = (y / tileSize) * tileColumns;
                for (int x = 0; x < width; x++) {
                    int p = x * 3;
                    pixels[y * width + x] = (byte)((29 * row[p] + 150 * row[p + 1] + 77 * row[p + 2] + 128) >> 8);
                    int tile = tileRow + x / tileSize;
                    ulong hash = tileHashes[tile];
                    hash = unchecked((hash ^ row[p]) * prime);
                    hash = unchecked((hash ^ row[p + 1]) * prime);
                    tileHashes[tile] = unchecked((hash ^ row[p + 2]) * prime);
                }
            }
        } finally { bitmap.UnlockBits(data); }

        // Separable Gaussian (sigma 2) approximates the replay's local blur.
        int[] kernel = { 14, 33, 61, 88, 100, 88, 61, 33, 14 };
        int weight = kernel.Sum();
        var horizontal = new float[pixels.Length];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int sum = 0;
                for (int k = -4; k <= 4; k++)
                    sum += kernel[k + 4] * pixels[y * width + Math.Min(width - 1, Math.Max(0, x + k))];
                horizontal[y * width + x] = (float)sum / weight;
            }
        }

        var mask = new byte[(pixels.Length + 7) / 8];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int index = y * width + x;
                if (pixels[index] <= 125) continue;
                float local = 0;
                for (int k = -4; k <= 4; k++)
                    local += kernel[k + 4] * horizontal[Math.Min(height - 1, Math.Max(0, y + k)) * width + x];
                if (pixels[index] - local / weight > 23)
                    mask[index >> 3] |= (byte)(1 << (index & 7));
            }
        }
        // Each digest includes every decoded color channel in the tile.
        var tileBytes = new byte[tileHashes.Length * sizeof(ulong)];
        Buffer.BlockCopy(tileHashes, 0, tileBytes, 0, tileBytes.Length);
        return new FrameEvidence {
            StrokeMask = Convert.ToBase64String(mask),
            PixelTiles = Convert.ToBase64String(tileBytes),
            TileSize = tileSize
        };
    }

    private static double Distance(Color first, Color second)
    {
        int r = first.R - second.R, g = first.G - second.G, b = first.B - second.B;
        return Math.Sqrt(r * r + g * g + b * b);
    }

    private static double Quantile(double[] values, double percentile)
    {
        Array.Sort(values);
        double index = percentile * (values.Length - 1);
        int low = (int)index, high = (int)Math.Ceiling(index);
        return values[low] + (index - low) * (values[high] - values[low]);
    }

    private static Color MedianColor(Color[] pixels)
    {
        return Color.FromArgb((int)Quantile(pixels.Select(p => (double)p.R).ToArray(), .5),
            (int)Quantile(pixels.Select(p => (double)p.G).ToArray(), .5),
            (int)Quantile(pixels.Select(p => (double)p.B).ToArray(), .5));
    }

    private static int Brightness(Color pixel)
    {
        return Math.Max(pixel.R, Math.Max(pixel.G, pixel.B));
    }

    // Contrast variant from the replay. Estimate foreground from the bright
    // outliers inside the OCR line and map nearby colors to dark ink.
    private static void ExtractInk(Bitmap tile, Rectangle line)
    {
        var pixels = new Color[tile.Width * tile.Height];
        for (int y = 0; y < tile.Height; y++)
            for (int x = 0; x < tile.Width; x++)
                pixels[y * tile.Width + x] = tile.GetPixel(x, y);
        var inside = new Color[line.Width * line.Height];
        for (int y = 0; y < line.Height; y++)
            Array.Copy(pixels, (y + line.Y) * tile.Width + line.X, inside, y * line.Width, line.Width);

        var background = MedianColor(pixels);
        double bright = Quantile(pixels.Select(p => (double)Brightness(p)).ToArray(), .5);
        double contrast = Quantile(inside.Select(p => Distance(p, background)).ToArray(), .83);
        var samples = inside.Where(p => Brightness(p) > bright && Distance(p, background) >= contrast).ToArray();
        var foreground = MedianColor(samples.Length == 0 ? inside : samples);
        for (int y = 0; y < tile.Height; y++) {
            for (int x = 0; x < tile.Width; x++) {
                int ink = (int)Math.Max(0, Math.Min(255, (Distance(pixels[y * tile.Width + x], foreground) - 18) * 3));
                tile.SetPixel(x, y, Color.FromArgb(ink, ink, ink));
            }
        }
    }

    public static byte[] RereadTile(Bitmap source, Rectangle clip, Rectangle line, int scale, int border, bool ink)
    {
        using (var tile = source.Clone(clip, PixelFormat.Format24bppRgb))
        using (var enlarged = new Bitmap(clip.Width * scale + 2 * border, clip.Height * scale + 2 * border))
        using (var stream = new MemoryStream()) {
            if (ink) ExtractInk(tile, new Rectangle(line.X - clip.X, line.Y - clip.Y, line.Width, line.Height));
            using (var graphics = Graphics.FromImage(enlarged)) {
                graphics.Clear(ink ? Color.White : Color.FromArgb(34, 34, 34));
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.PixelOffsetMode = PixelOffsetMode.Half;
                graphics.DrawImage(tile, new Rectangle(border, border, clip.Width * scale, clip.Height * scale));
            }
            enlarged.Save(stream, ImageFormat.Png);
            return stream.ToArray();
        }
    }
}
