import fs from 'fs';
import path from 'path';

/**
 * Creates an uncompressed 24-bit BMP directional fixture image (1200x1600) with 4 distinct quadrants:
 * - Top-Left: Red (255, 0, 0)
 * - Top-Right: Blue (0, 0, 255)
 * - Bottom-Left: Green (0, 255, 0)
 * - Bottom-Right: Yellow (255, 255, 0)
 * - Center marker: White square (255, 255, 255)
 */
export function createDirectionalFixtureBMP(filePath: string, width: number = 1200, height: number = 1600): string {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = Buffer.alloc(fileSize);

  // BMP Header (14 bytes)
  buffer.write('BM', 0); // Signature
  buffer.writeUInt32LE(fileSize, 2); // File size
  buffer.writeUInt32LE(0, 6); // Reserved
  buffer.writeUInt32LE(54, 10); // Data offset

  // DIB Header (BITMAPINFOHEADER - 40 bytes)
  buffer.writeUInt32LE(40, 14); // Header size
  buffer.writeInt32LE(width, 18); // Width
  buffer.writeInt32LE(height, 22); // Height (positive: bottom-up)
  buffer.writeUInt16LE(1, 26); // Color planes
  buffer.writeUInt16LE(24, 28); // Bits per pixel
  buffer.writeUInt32LE(0, 30); // Compression (BI_RGB = none)
  buffer.writeUInt32LE(pixelArraySize, 34); // Image size
  buffer.writeInt32LE(2835, 38); // Horizontal resolution (pixels/meter)
  buffer.writeInt32LE(2835, 42); // Vertical resolution
  buffer.writeUInt32LE(0, 46); // Palette colors
  buffer.writeUInt32LE(0, 50); // Important colors

  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const markerHalfSize = 100;

  // Pixels in BMP are stored bottom-up, BGR format
  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + y * rowSize;
    // In bottom-up BMP: y=0 is bottom, y=height-1 is top
    const isTop = y >= halfH;

    for (let x = 0; x < width; x++) {
      const isRight = x >= halfW;
      const pixelOffset = rowOffset + x * 3;

      const isCenter =
        Math.abs(x - halfW) <= markerHalfSize &&
        Math.abs(y - halfH) <= markerHalfSize;

      let r = 0;
      let g = 0;
      let b = 0;

      if (isCenter) {
        // White center marker
        r = 255;
        g = 255;
        b = 255;
      } else if (isTop && !isRight) {
        // Top-Left: Red
        r = 255;
        g = 0;
        b = 0;
      } else if (isTop && isRight) {
        // Top-Right: Blue
        r = 0;
        g = 0;
        b = 255;
      } else if (!isTop && !isRight) {
        // Bottom-Left: Green
        r = 0;
        g = 255;
        b = 0;
      } else {
        // Bottom-Right: Yellow (Red + Green)
        r = 255;
        g = 255;
        b = 0;
      }

      buffer[pixelOffset] = b;     // Blue
      buffer[pixelOffset + 1] = g; // Green
      buffer[pixelOffset + 2] = r; // Red
    }
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, buffer);
  return filePath;
}
