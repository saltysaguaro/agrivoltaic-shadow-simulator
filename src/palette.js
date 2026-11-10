// Keep native RGB values for fine cell lines, shadow edges and antialiased type.
// Each palette addition targets the remaining color with the largest weighted error.
export function indexFrame(bytes) {
  const pixels = new Uint32Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength / 4,
  );
  const histogram = new Map();
  for (const color of pixels)
    histogram.set(color, (histogram.get(color) || 0) + 1);

  const colors = [];
  let mostFrequent = 0;
  for (const [key, count] of histogram) {
    const [r, g, b] = bytesOf(key);
    colors.push({ key, r, g, b, count, index: colors.length, error: Infinity });
    if (count > colors[mostFrequent].count) mostFrequent = colors.length - 1;
  }

  let palette;
  if (colors.length <= 256) {
    palette = colors.map(({ r, g, b }) => [r, g, b]);
  } else {
    palette = [];
    let next = colors[mostFrequent];
    while (palette.length < 256) {
      const { r, g, b } = next;
      const index = palette.length;
      palette.push([r, g, b]);
      let worst = -1;
      for (const color of colors) {
        const error =
          (r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2;
        if (error < color.error) {
          color.error = error;
          color.index = index;
        }
        const score = color.error * color.count;
        if (score > worst) {
          worst = score;
          next = color;
        }
      }
    }
  }
  for (const color of colors) histogram.set(color.key, color.index);
  const indices = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) indices[i] = histogram.get(pixels[i]);
  return { palette, indices };
}

// Canvas ImageData is always in RGBA byte order, regardless of host endianness.
function bytesOf(color) {
  return new Uint8Array(Uint32Array.of(color).buffer);
}
